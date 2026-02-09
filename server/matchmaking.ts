import { WebSocketServer, WebSocket } from "ws";
import { Server, IncomingMessage } from "http";
import { storage } from "./storage";
import { calculateRankPointChange, calculatePlacementRank, getRankFromPoints, calculateXpFromGame, getLevelFromXp } from "@shared/rank-utils";
import { AIGameSimulator, AIDifficulty } from "./game-ai";
import { parse } from "url";

// Types for matchmaking messages
interface MatchmakingMessage {
  type: string;
  payload?: any;
}

interface QueuedPlayer {
  odws: WebSocket;
  userId: string;
  userName: string;
  userProfileImage: string | null;
  rankPoints: number;
  queuedAt: number;
  isPlacement: boolean;
}

interface ActiveMatch {
  id: string;
  playerA: MatchPlayer;
  playerB: MatchPlayer;
  isAiOpponent: boolean;
  startedAt: number;
  gameSeed: string;  // Shared seed for synchronized piece generation
  aiSimulator?: AIGameSimulator;
  aiInterval?: NodeJS.Timeout;
  gameState: {
    playerALines: number;
    playerBLines: number;
    playerAScore: number;
    playerBScore: number;
    playerABoard: number[][];
    playerBBoard: number[][];
    targetLines: number;
  };
}

interface MatchPlayer {
  odws: WebSocket | null;
  userId: string;
  userName: string;
  userProfileImage: string | null;
  rankPoints: number;
  isPlacement: boolean;
  isAi: boolean;
}

// Constants
const MATCH_TIMEOUT = 30000; // 30 seconds to find opponent
const TARGET_LINES = 40; // Sprint mode - first to 40 lines

// Global state
const matchQueue: Map<string, QueuedPlayer> = new Map();
const activeMatches: Map<string, ActiveMatch> = new Map();
const playerMatches: Map<string, string> = new Map(); // userId -> matchId
const pendingDisconnects: Map<string, NodeJS.Timeout> = new Map();

export function setupMatchmaking(server: Server): WebSocketServer {
  // Use noServer mode and handle upgrade manually to avoid conflicts
  const wss = new WebSocketServer({ noServer: true });

  console.log("[matchmaking] WebSocket server initialized");

  // Handle upgrade event
  server.on("upgrade", (request: IncomingMessage, socket, head) => {
    const { pathname } = parse(request.url || "");
    
    if (pathname === "/ws/matchmaking") {
      console.log("[matchmaking] Upgrade request received for /ws/matchmaking");
      wss.handleUpgrade(request, socket, head, (ws) => {
        console.log("[matchmaking] Connection upgraded successfully");
        wss.emit("connection", ws, request);
      });
    }
    // Don't close socket for other paths - let other handlers deal with them
  });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    console.log("[matchmaking] New connection established");
    let currentUserId: string | null = null;

    ws.on("message", async (data) => {
      try {
        const message: MatchmakingMessage = JSON.parse(data.toString());
        
        switch (message.type) {
          case "join_queue":
            currentUserId = await handleJoinQueue(ws, message.payload);
            break;
          case "leave_queue":
            handleLeaveQueue(currentUserId);
            break;
          case "game_update":
            handleGameUpdate(currentUserId, message.payload);
            break;
          case "game_over":
            await handleGameOver(currentUserId, message.payload);
            break;
          case "forfeit":
            await handleForfeit(currentUserId);
            break;
          case "request_ai_match":
            currentUserId = await handleRequestAiMatch(ws, message.payload);
            break;
          case "rejoin_match":
            currentUserId = handleRejoinMatch(ws, message.payload);
            break;
          case "ping":
            ws.send(JSON.stringify({ type: "pong" }));
            break;
        }
      } catch (error) {
        console.error("[matchmaking] Error handling message:", error);
        ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid message" } }));
      }
    });

    ws.on("close", () => {
      if (currentUserId) {
        handlePlayerDisconnect(currentUserId);
      }
    });
  });

  // Check for timeouts and match players periodically
  setInterval(() => {
    processMatchQueue();
  }, 1000);

  return wss;
}

async function handleJoinQueue(ws: WebSocket, payload: any): Promise<string | null> {
  const { userId, userName, userProfileImage } = payload;
  
  if (!userId) {
    console.log('[matchmaking] handleJoinQueue: Missing userId in payload');
    ws.send(JSON.stringify({ type: "error", payload: { message: "Missing userId" } }));
    return null;
  }

  // Check if already in a match
  if (playerMatches.has(userId)) {
    console.log('[matchmaking] handleJoinQueue: User already in a match:', userId);
    ws.send(JSON.stringify({ type: "error", payload: { message: "Already in a match" } }));
    return null;
  }

  // Get player progression
  let progression = await storage.getPlayerProgression(userId);
  if (!progression) {
    progression = await storage.createPlayerProgression(userId);
  }

  // Check level requirement
  if (progression.level < 30) {
    ws.send(JSON.stringify({ 
      type: "error", 
      payload: { message: "Level 30 required for ranked play", currentLevel: progression.level } 
    }));
    return null;
  }

  const queuedPlayer: QueuedPlayer = {
    odws: ws,
    userId,
    userName: userName || "Player",
    userProfileImage: userProfileImage || null,
    rankPoints: progression.rankPoints,
    queuedAt: Date.now(),
    isPlacement: !progression.isPlacementComplete,
  };

  matchQueue.set(userId, queuedPlayer);
  
  ws.send(JSON.stringify({ 
    type: "queue_joined", 
    payload: { 
      position: matchQueue.size,
      isPlacement: queuedPlayer.isPlacement,
      placementGamesPlayed: progression.placementMatchesPlayed,
    } 
  }));

  console.log(`[matchmaking] Player ${userId} joined queue. Queue size: ${matchQueue.size}`);
  
  // Immediately try to find a match
  processMatchQueue();
  
  return userId;
}

function handleLeaveQueue(userId: string | null): void {
  if (userId && matchQueue.has(userId)) {
    matchQueue.delete(userId);
    console.log(`[matchmaking] Player ${userId} left queue`);
  }
}

async function handleRequestAiMatch(ws: WebSocket, payload: any): Promise<string | null> {
  console.log(`[matchmaking] handleRequestAiMatch called with payload:`, JSON.stringify(payload));
  const { userId, userName, userProfileImage, rankPoints, isPlacement } = payload;
  
  if (!userId) {
    console.log(`[matchmaking] handleRequestAiMatch: Missing userId`);
    ws.send(JSON.stringify({ type: "error", payload: { message: "Missing userId" } }));
    return null;
  }

  // Check if already in a match
  if (playerMatches.has(userId)) {
    console.log(`[matchmaking] handleRequestAiMatch: User already in a match: ${userId}`);
    ws.send(JSON.stringify({ type: "error", payload: { message: "Already in a match" } }));
    return null;
  }

  // Remove from queue if in queue
  if (matchQueue.has(userId)) {
    matchQueue.delete(userId);
  }

  // Create the player object
  const player: QueuedPlayer = {
    odws: ws,
    userId,
    userName: userName || "Player",
    userProfileImage: userProfileImage || null,
    rankPoints: rankPoints || 0,
    queuedAt: Date.now(),
    isPlacement: isPlacement || false,
  };

  // Immediately create AI match
  createAiMatch(player);
  
  console.log(`[matchmaking] Instant AI match requested by ${userId}`);
  return userId;
}

function handleRejoinMatch(ws: WebSocket, payload: any): string | null {
  const { matchId, userId } = payload;
  
  if (!matchId || !userId) {
    ws.send(JSON.stringify({ type: "error", payload: { message: "Missing matchId or userId" } }));
    return null;
  }
  
  const match = activeMatches.get(matchId);
  if (!match) {
    ws.send(JSON.stringify({ type: "error", payload: { message: "Match not found" } }));
    return null;
  }
  
  const isPlayerA = match.playerA.userId === userId;
  const isPlayerB = match.playerB.userId === userId;
  
  if (!isPlayerA && !isPlayerB) {
    ws.send(JSON.stringify({ type: "error", payload: { message: "User not part of this match" } }));
    return null;
  }
  
  // Cancel any pending disconnect timeout
  if (pendingDisconnects.has(userId)) {
    clearTimeout(pendingDisconnects.get(userId)!);
    pendingDisconnects.delete(userId);
    console.log(`[matchmaking] Cancelled pending disconnect for ${userId}`);
  }
  
  // Rebind WebSocket to the match
  if (isPlayerA) {
    match.playerA.odws = ws;
  } else {
    match.playerB.odws = ws;
  }
  
  // Update player match mapping
  playerMatches.set(userId, matchId);
  
  // Send match info and current state
  ws.send(JSON.stringify({
    type: "match_rejoined",
    payload: {
      matchId,
      targetLines: TARGET_LINES,
      gameSeed: match.gameSeed,  // Shared seed for synchronized piece generation
      opponent: {
        userId: isPlayerA ? match.playerB.userId : match.playerA.userId,
        userName: isPlayerA ? match.playerB.userName : match.playerA.userName,
        userProfileImage: isPlayerA ? match.playerB.userProfileImage : match.playerA.userProfileImage,
        rankPoints: isPlayerA ? match.playerB.rankPoints : match.playerA.rankPoints,
        isAi: isPlayerA ? match.playerB.isAi : match.playerA.isAi,
      },
      isPlayerA,
      gameState: match.gameState,
    },
  }));
  
  console.log(`[matchmaking] Player ${userId} rejoined match ${matchId}`);
  return userId;
}

function processMatchQueue(): void {
  const now = Date.now();
  const queuedPlayers = Array.from(matchQueue.values());
  
  // Try to match players with similar rank points
  for (let i = 0; i < queuedPlayers.length; i++) {
    const playerA = queuedPlayers[i];
    if (!matchQueue.has(playerA.userId)) continue; // Already matched
    
    // Look for a suitable opponent
    let bestMatch: QueuedPlayer | null = null;
    let bestPointDiff = Infinity;
    
    for (let j = i + 1; j < queuedPlayers.length; j++) {
      const playerB = queuedPlayers[j];
      if (!matchQueue.has(playerB.userId)) continue;
      
      const pointDiff = Math.abs(playerA.rankPoints - playerB.rankPoints);
      const waitTime = Math.min(now - playerA.queuedAt, now - playerB.queuedAt);
      
      // Expand acceptable range based on wait time
      const acceptableRange = 100 + (waitTime / 1000) * 50; // +50 points per second waited
      
      if (pointDiff < acceptableRange && pointDiff < bestPointDiff) {
        bestMatch = playerB;
        bestPointDiff = pointDiff;
      }
    }
    
    if (bestMatch) {
      createMatch(playerA, bestMatch);
    } else if (now - playerA.queuedAt >= MATCH_TIMEOUT) {
      // No match found within timeout, create AI match
      createAiMatch(playerA);
    }
  }
}

function createMatch(playerA: QueuedPlayer, playerB: QueuedPlayer): void {
  const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  // Generate shared seed for synchronized piece generation
  const gameSeed = `seed_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  
  matchQueue.delete(playerA.userId);
  matchQueue.delete(playerB.userId);
  
  const match: ActiveMatch = {
    id: matchId,
    playerA: {
      odws: playerA.odws,
      userId: playerA.userId,
      userName: playerA.userName,
      userProfileImage: playerA.userProfileImage,
      rankPoints: playerA.rankPoints,
      isPlacement: playerA.isPlacement,
      isAi: false,
    },
    playerB: {
      odws: playerB.odws,
      userId: playerB.userId,
      userName: playerB.userName,
      userProfileImage: playerB.userProfileImage,
      rankPoints: playerB.rankPoints,
      isPlacement: playerB.isPlacement,
      isAi: false,
    },
    isAiOpponent: false,
    startedAt: Date.now(),
    gameSeed,
    gameState: {
      playerALines: 0,
      playerBLines: 0,
      playerAScore: 0,
      playerBScore: 0,
      playerABoard: [],
      playerBBoard: [],
      targetLines: TARGET_LINES,
    },
  };
  
  activeMatches.set(matchId, match);
  playerMatches.set(playerA.userId, matchId);
  playerMatches.set(playerB.userId, matchId);
  
  // Notify both players with shared seed for synchronized pieces
  const matchFoundPayload = {
    matchId,
    targetLines: TARGET_LINES,
    startDelay: 3000, // 3 second countdown
    gameSeed, // Shared seed for synchronized piece generation
  };
  
  playerA.odws.send(JSON.stringify({
    type: "match_found",
    payload: {
      ...matchFoundPayload,
      opponent: {
        userId: playerB.userId,
        userName: playerB.userName,
        userProfileImage: playerB.userProfileImage,
        rankPoints: playerB.rankPoints,
        isAi: false,
      },
      isPlayerA: true,
    },
  }));
  
  playerB.odws.send(JSON.stringify({
    type: "match_found",
    payload: {
      ...matchFoundPayload,
      opponent: {
        userId: playerA.userId,
        userName: playerA.userName,
        userProfileImage: playerA.userProfileImage,
        rankPoints: playerA.rankPoints,
        isAi: false,
      },
      isPlayerA: false,
    },
  }));
  
  console.log(`[matchmaking] Match created: ${matchId} (${playerA.userName} vs ${playerB.userName})`);
}

function createAiMatch(player: QueuedPlayer): void {
  console.log(`[AI] createAiMatch called for player: ${player.userId}`);
  const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  // Generate shared seed for synchronized piece generation
  const gameSeed = `seed_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  
  matchQueue.delete(player.userId);
  
  // AI difficulty based on player rank
  let aiDifficulty: AIDifficulty = "normal";
  if (player.rankPoints < 500) aiDifficulty = "easy";
  else if (player.rankPoints < 1000) aiDifficulty = "normal";
  else if (player.rankPoints < 1500) aiDifficulty = "hard";
  else aiDifficulty = "expert";
  
  // Create AI simulator with shared game seed for synchronized piece generation
  const aiSimulator = new AIGameSimulator(aiDifficulty, gameSeed);
  
  const match: ActiveMatch = {
    id: matchId,
    playerA: {
      odws: player.odws,
      userId: player.userId,
      userName: player.userName,
      userProfileImage: player.userProfileImage,
      rankPoints: player.rankPoints,
      isPlacement: player.isPlacement,
      isAi: false,
    },
    playerB: {
      odws: null,
      userId: "AI",
      userName: `AI (${aiDifficulty})`,
      userProfileImage: null,
      rankPoints: player.rankPoints, // AI matches player's rank
      isPlacement: false,
      isAi: true,
    },
    isAiOpponent: true,
    startedAt: Date.now(),
    gameSeed,
    aiSimulator,
    gameState: {
      playerALines: 0,
      playerBLines: 0,
      playerAScore: 0,
      playerBScore: 0,
      playerABoard: [],
      playerBBoard: [],
      targetLines: TARGET_LINES,
    },
  };
  
  activeMatches.set(matchId, match);
  playerMatches.set(player.userId, matchId);
  
  player.odws.send(JSON.stringify({
    type: "match_found",
    payload: {
      matchId,
      targetLines: TARGET_LINES,
      startDelay: 3000,
      gameSeed, // Shared seed for synchronized piece generation
      opponent: {
        userId: "AI",
        userName: match.playerB.userName,
        userProfileImage: null,
        rankPoints: player.rankPoints,
        isAi: true,
        aiDifficulty,
      },
      isPlayerA: true,
    },
  }));
  
  // Start AI game loop after countdown
  console.log(`[AI] Setting up AI game loop timeout for match ${matchId}`);
  setTimeout(() => {
    console.log(`[AI] Timeout fired for match ${matchId}, calling startAiGameLoop`);
    startAiGameLoop(matchId);
  }, 3500); // Start after 3.5s (3s countdown + 0.5s buffer)
  
  console.log(`[matchmaking] AI Match created: ${matchId} (${player.userName} vs AI-${aiDifficulty})`);
}

// AI game loop - makes moves at regular intervals
function startAiGameLoop(matchId: string): void {
  const match = activeMatches.get(matchId);
  if (!match || !match.aiSimulator) {
    console.log(`[AI] startAiGameLoop: No match or aiSimulator for ${matchId}`);
    return;
  }
  
  console.log(`[AI] Starting AI game loop for match ${matchId}`);
  const moveDelay = match.aiSimulator.getMoveDelay();
  
  match.aiInterval = setInterval(() => {
    const currentMatch = activeMatches.get(matchId);
    if (!currentMatch || !currentMatch.aiSimulator) {
      console.log(`[AI] Loop tick: No match or simulator for ${matchId}`);
      clearInterval(match.aiInterval);
      return;
    }
    
    const result = currentMatch.aiSimulator.makeMove();
    console.log(`[AI] Tick: lines=${result.linesCleared}, score=${result.score}, gameOver=${result.gameOver}`);
    
    // Update game state
    currentMatch.gameState.playerBLines = result.linesCleared;
    currentMatch.gameState.playerBScore = result.score;
    currentMatch.gameState.playerBBoard = result.board;
    
    // Send AI update to player
    if (currentMatch.playerA.odws) {
      const ws = currentMatch.playerA.odws;
      const readyState = ws.readyState;
      console.log(`[AI] Sending opponent_update to player, ws.readyState=${readyState}`);
      if (readyState === 1) { // WebSocket.OPEN = 1
        ws.send(JSON.stringify({
          type: "opponent_update",
          payload: {
            lines: result.linesCleared,
            score: result.score,
            board: result.board,
          },
        }));
      } else {
        console.log(`[AI] WebSocket not OPEN (state=${readyState}), skipping send`);
      }
    } else {
      console.log(`[AI] No WebSocket connection for playerA`);
    }
    
    // Check if AI won
    if (result.linesCleared >= TARGET_LINES) {
      clearInterval(currentMatch.aiInterval);
      endMatch(matchId, "AI", "lines_cleared");
    }
    
    // Check if AI lost (game over)
    if (result.gameOver) {
      clearInterval(currentMatch.aiInterval);
      endMatch(matchId, currentMatch.playerA.userId, "opponent_topped_out");
    }
  }, moveDelay);
}

function handleGameUpdate(userId: string | null, payload: any): void {
  if (!userId) return;
  
  const matchId = playerMatches.get(userId);
  if (!matchId) return;
  
  const match = activeMatches.get(matchId);
  if (!match) return;
  
  const { lines, score, board, gameOver } = payload;
  const isPlayerA = match.playerA.userId === userId;
  
  // Update game state
  if (isPlayerA) {
    match.gameState.playerALines = lines || 0;
    match.gameState.playerAScore = score || 0;
    match.gameState.playerABoard = board || [];
  } else {
    match.gameState.playerBLines = lines || 0;
    match.gameState.playerBScore = score || 0;
    match.gameState.playerBBoard = board || [];
  }
  
  // Send update to opponent
  const opponentWs = isPlayerA ? match.playerB.odws : match.playerA.odws;
  if (opponentWs) {
    opponentWs.send(JSON.stringify({
      type: "opponent_update",
      payload: {
        lines: isPlayerA ? match.gameState.playerALines : match.gameState.playerBLines,
        score: isPlayerA ? match.gameState.playerAScore : match.gameState.playerBScore,
        board: isPlayerA ? match.gameState.playerABoard : match.gameState.playerBBoard,
      },
    }));
  }
  
  // Check for win condition (reached target lines)
  if (lines >= TARGET_LINES) {
    endMatch(matchId, userId, "lines_cleared");
    return;
  }
  
  // Check if player topped out (game over)
  if (gameOver) {
    const winnerId = isPlayerA ? match.playerB.userId : match.playerA.userId;
    endMatch(matchId, winnerId, "opponent_topped_out");
  }
}

async function handleGameOver(userId: string | null, payload: any): Promise<void> {
  if (!userId) return;
  
  const matchId = playerMatches.get(userId);
  if (!matchId) return;
  
  const match = activeMatches.get(matchId);
  if (!match) return;
  
  const { reason } = payload; // topped_out, disconnected
  const isPlayerA = match.playerA.userId === userId;
  
  // The player who sent game_over lost (topped out)
  const winnerId = isPlayerA ? match.playerB.userId : match.playerA.userId;
  
  await endMatch(matchId, winnerId, reason || "opponent_topped_out");
}

async function handleForfeit(userId: string | null): Promise<void> {
  if (!userId) return;
  
  const matchId = playerMatches.get(userId);
  if (!matchId) return;
  
  const match = activeMatches.get(matchId);
  if (!match) return;
  
  const isPlayerA = match.playerA.userId === userId;
  
  // The player who forfeited loses
  const winnerId = isPlayerA ? match.playerB.userId : match.playerA.userId;
  
  await endMatch(matchId, winnerId, "forfeit");
}

async function endMatch(matchId: string, winnerId: string, reason: string): Promise<void> {
  const match = activeMatches.get(matchId);
  if (!match) return;
  
  // Cleanup AI interval if exists
  if (match.aiInterval) {
    clearInterval(match.aiInterval);
    match.aiInterval = undefined;
  }
  
  const endTime = Date.now();
  const playTime = endTime - match.startedAt;
  
  const playerAWon = winnerId === match.playerA.userId;
  
  // Calculate rank point changes
  let playerARankChange = 0;
  let playerBRankChange = 0;
  
  if (!match.isAiOpponent) {
    // Get current win streaks
    const playerAProg = await storage.getPlayerProgression(match.playerA.userId);
    const playerBProg = await storage.getPlayerProgression(match.playerB.userId);
    
    playerARankChange = calculateRankPointChange({
      playerPoints: match.playerA.rankPoints,
      opponentPoints: match.playerB.rankPoints,
      won: playerAWon,
      isAiOpponent: false,
      winStreak: playerAProg?.winStreak || 0,
    });
    
    playerBRankChange = calculateRankPointChange({
      playerPoints: match.playerB.rankPoints,
      opponentPoints: match.playerA.rankPoints,
      won: !playerAWon,
      isAiOpponent: false,
      winStreak: playerBProg?.winStreak || 0,
    });
  } else {
    // AI opponent - reduced rank point changes
    const playerAProg = await storage.getPlayerProgression(match.playerA.userId);
    playerARankChange = calculateRankPointChange({
      playerPoints: match.playerA.rankPoints,
      opponentPoints: match.playerB.rankPoints,
      won: playerAWon,
      isAiOpponent: true,
      winStreak: playerAProg?.winStreak || 0,
    });
  }
  
  // Save match to database
  await storage.createRankedMatch({
    playerAId: match.playerA.userId,
    playerBId: match.isAiOpponent ? null : match.playerB.userId,
    isAiOpponent: match.isAiOpponent,
    aiDifficulty: match.isAiOpponent ? match.playerB.userName.replace("AI (", "").replace(")", "") : null,
    winnerId,
    winReason: reason,
    playerALines: match.gameState.playerALines,
    playerAScore: match.gameState.playerAScore,
    playerATime: playTime,
    playerBLines: match.gameState.playerBLines,
    playerBScore: match.gameState.playerBScore,
    playerBTime: playTime,
    playerARankChange,
    playerBRankChange,
    isPlacementMatch: match.playerA.isPlacement || match.playerB.isPlacement,
    endedAt: new Date(),
  });
  
  // Calculate XP earned
  const playerAXp = calculateXpFromGame({
    score: match.gameState.playerAScore,
    linesCleared: match.gameState.playerALines,
    playTimeMs: playTime,
    gameMode: "ranked",
    isRankedMatch: true,
    won: playerAWon,
  });
  
  const playerBXp = !match.isAiOpponent ? calculateXpFromGame({
    score: match.gameState.playerBScore,
    linesCleared: match.gameState.playerBLines,
    playTimeMs: playTime,
    gameMode: "ranked",
    isRankedMatch: true,
    won: !playerAWon,
  }) : 0;
  
  // Update player ranks and XP
  const playerANewStats = await updatePlayerRankAfterMatch(
    match.playerA.userId, 
    playerAWon, 
    playerARankChange, 
    match.playerA.isPlacement,
    playerAXp
  );
  
  let playerBNewStats = null;
  if (!match.isAiOpponent) {
    playerBNewStats = await updatePlayerRankAfterMatch(
      match.playerB.userId, 
      !playerAWon, 
      playerBRankChange, 
      match.playerB.isPlacement,
      playerBXp
    );
  }
  
  // Notify players
  if (match.playerA.odws) {
    match.playerA.odws.send(JSON.stringify({
      type: "match_end",
      payload: {
        won: playerAWon,
        reason,
        rankPointChange: playerARankChange,
        newRankPoints: playerANewStats?.rankPoints || (match.playerA.rankPoints + playerARankChange),
        xpEarned: playerAXp,
        newLevel: playerANewStats?.level || 1,
        opponentStats: {
          lines: match.gameState.playerBLines,
          score: match.gameState.playerBScore,
        },
      },
    }));
  }
  
  if (match.playerB.odws) {
    match.playerB.odws.send(JSON.stringify({
      type: "match_end",
      payload: {
        won: !playerAWon,
        reason,
        rankPointChange: playerBRankChange,
        newRankPoints: playerBNewStats?.rankPoints || (match.playerB.rankPoints + playerBRankChange),
        xpEarned: playerBXp,
        newLevel: playerBNewStats?.level || 1,
        opponentStats: {
          lines: match.gameState.playerALines,
          score: match.gameState.playerAScore,
        },
      },
    }));
  }
  
  // Cleanup
  activeMatches.delete(matchId);
  playerMatches.delete(match.playerA.userId);
  if (!match.isAiOpponent) {
    playerMatches.delete(match.playerB.userId);
  }
  
  console.log(`[matchmaking] Match ${matchId} ended. Winner: ${winnerId}, Reason: ${reason}`);
}

async function updatePlayerRankAfterMatch(
  userId: string,
  won: boolean,
  rankChange: number,
  isPlacement: boolean,
  xpEarned: number
): Promise<{ rankPoints: number; level: number } | null> {
  const progression = await storage.getPlayerProgression(userId);
  if (!progression) return null;
  
  const newRankPoints = Math.max(0, progression.rankPoints + rankChange);
  const { tier, division } = getRankFromPoints(newRankPoints);
  
  const newWinStreak = won ? progression.winStreak + 1 : 0;
  const newBestWinStreak = Math.max(progression.bestWinStreak, newWinStreak);
  
  const newTotalXp = progression.xp + xpEarned;
  const newLevel = getLevelFromXp(newTotalXp);
  
  if (isPlacement && !progression.isPlacementComplete) {
    const newPlacementPlayed = progression.placementMatchesPlayed + 1;
    const newPlacementWins = won ? progression.placementWins + 1 : progression.placementWins;
    
    if (newPlacementPlayed >= 10) {
      const { tier: placementTier, division: placementDivision, points } = calculatePlacementRank(newPlacementWins);
      
      await storage.updatePlayerRank(userId, {
        rankTier: placementTier,
        rankDivision: placementDivision,
        rankPoints: points,
        placementMatchesPlayed: newPlacementPlayed,
        placementWins: newPlacementWins,
        isPlacementComplete: true,
        rankedWins: won ? progression.rankedWins + 1 : progression.rankedWins,
        rankedLosses: won ? progression.rankedLosses : progression.rankedLosses + 1,
        winStreak: newWinStreak,
        bestWinStreak: newBestWinStreak,
        level: newLevel,
        totalXp: newTotalXp,
      });
      
      return { rankPoints: points, level: newLevel };
    } else {
      await storage.updatePlayerRank(userId, {
        placementMatchesPlayed: newPlacementPlayed,
        placementWins: newPlacementWins,
        rankedWins: won ? progression.rankedWins + 1 : progression.rankedWins,
        rankedLosses: won ? progression.rankedLosses : progression.rankedLosses + 1,
        winStreak: newWinStreak,
        bestWinStreak: newBestWinStreak,
        level: newLevel,
        totalXp: newTotalXp,
      });
      
      return { rankPoints: progression.rankPoints, level: newLevel };
    }
  } else {
    await storage.updatePlayerRank(userId, {
      rankTier: tier,
      rankDivision: division,
      rankPoints: newRankPoints,
      rankedWins: won ? progression.rankedWins + 1 : progression.rankedWins,
      rankedLosses: won ? progression.rankedLosses : progression.rankedLosses + 1,
      winStreak: newWinStreak,
      bestWinStreak: newBestWinStreak,
      level: newLevel,
      totalXp: newTotalXp,
    });
    
    return { rankPoints: newRankPoints, level: newLevel };
  }
}

function handlePlayerDisconnect(userId: string): void {
  // Remove from queue
  if (matchQueue.has(userId)) {
    matchQueue.delete(userId);
    console.log(`[matchmaking] Player ${userId} disconnected from queue`);
  }
  
  // Handle active match - give 5 seconds grace period for rejoin
  const matchId = playerMatches.get(userId);
  if (matchId) {
    const match = activeMatches.get(matchId);
    if (match) {
      // Clear existing pending disconnect if any
      if (pendingDisconnects.has(userId)) {
        clearTimeout(pendingDisconnects.get(userId)!);
      }
      
      // Set websocket to null but don't end match yet
      const isPlayerA = match.playerA.userId === userId;
      if (isPlayerA) {
        match.playerA.odws = null;
      } else {
        match.playerB.odws = null;
      }
      
      console.log(`[matchmaking] Player ${userId} disconnected, waiting 5s for rejoin`);
      
      // Wait 5 seconds before ending match
      const timeout = setTimeout(() => {
        pendingDisconnects.delete(userId);
        const currentMatch = activeMatches.get(matchId);
        if (currentMatch) {
          const currentIsPlayerA = currentMatch.playerA.userId === userId;
          const currentWs = currentIsPlayerA ? currentMatch.playerA.odws : currentMatch.playerB.odws;
          
          // Only end match if player hasn't rejoined
          if (currentWs === null) {
            const winnerId = currentIsPlayerA ? currentMatch.playerB.userId : currentMatch.playerA.userId;
            console.log(`[matchmaking] Player ${userId} did not rejoin, ending match`);
            endMatch(matchId, winnerId, "opponent_disconnected");
          }
        }
      }, 5000);
      
      pendingDisconnects.set(userId, timeout);
    }
  }
}
