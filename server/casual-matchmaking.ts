import { WebSocketServer, WebSocket } from "ws";
import { Server, IncomingMessage } from "http";
import { storage } from "./storage";
import { calculateXpFromGame } from "@shared/rank-utils";
import { parse } from "url";

// Debug logging - set to true to enable verbose logging
const DEBUG_LOGGING = true;

function debugLog(category: string, message: string, data?: any) {
  if (!DEBUG_LOGGING) return;
  const timestamp = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[casual:${category}] ${timestamp} - ${message}`, JSON.stringify(data).substring(0, 200));
  } else {
    console.log(`[casual:${category}] ${timestamp} - ${message}`);
  }
}

export type CasualGameMode = 'marathon' | 'sprint' | 'ultra' | 'zen';

interface CasualMatchmakingMessage {
  type: string;
  payload?: any;
}

interface QueuedPlayer {
  ws: WebSocket;
  userId: string;
  userName: string;
  userProfileImage: string | null;
  queuedAt: number;
  gameMode: CasualGameMode;
}

interface CasualMatch {
  id: string;
  playerA: CasualMatchPlayer;
  playerB: CasualMatchPlayer;
  gameMode: CasualGameMode;
  startedAt: number;
  gameSeed: string;
  gameState: {
    playerALines: number;
    playerBLines: number;
    playerAScore: number;
    playerBScore: number;
    playerABoard: number[][];
    playerBBoard: number[][];
    targetLines: number;
    timeLimit: number;
    playerATime: number;
    playerBTime: number;
    playerAGameOver: boolean;
    playerBGameOver: boolean;
  };
  timerInterval?: NodeJS.Timeout;
}

interface CasualMatchPlayer {
  ws: WebSocket | null;
  userId: string;
  userName: string;
  userProfileImage: string | null;
}

const MATCH_TIMEOUT = 60000;

const MODE_CONFIG: Record<CasualGameMode, { targetLines: number; timeLimit: number; winCondition: 'lines' | 'score' | 'time' | 'none' }> = {
  marathon: { targetLines: 150, timeLimit: 0, winCondition: 'lines' },
  sprint: { targetLines: 40, timeLimit: 0, winCondition: 'lines' },
  ultra: { targetLines: 0, timeLimit: 120, winCondition: 'score' },
  zen: { targetLines: 0, timeLimit: 0, winCondition: 'none' },
};

const casualQueue: Map<string, QueuedPlayer> = new Map();
const casualMatches: Map<string, CasualMatch> = new Map();
const playerCasualMatches: Map<string, string> = new Map();
const pendingDisconnects: Map<string, NodeJS.Timeout> = new Map();

export function setupCasualMatchmaking(server: Server): WebSocketServer {
  // Use noServer mode and handle upgrade manually to avoid conflicts
  const wss = new WebSocketServer({ noServer: true });

  console.log("[casual] WebSocket server initialized");

  // Handle upgrade event
  server.on("upgrade", (request: IncomingMessage, socket, head) => {
    const { pathname } = parse(request.url || "");
    
    if (pathname === "/ws/casual") {
      console.log("[casual] Upgrade request received for /ws/casual");
      wss.handleUpgrade(request, socket, head, (ws) => {
        console.log("[casual] Connection upgraded successfully");
        wss.emit("connection", ws, request);
      });
    }
    // Don't close socket for other paths - let other handlers deal with them
  });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    console.log("[casual] New connection established");
    let currentUserId: string | null = null;

    ws.on("message", async (data) => {
      try {
        const message: CasualMatchmakingMessage = JSON.parse(data.toString());
        
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
          // Optimized split updates for lower latency
          case "piece_update":
            handlePieceUpdate(currentUserId, message.payload);
            break;
          case "board_update":
            handleBoardUpdate(currentUserId, message.payload);
            break;
          case "meta_update":
            handleMetaUpdate(currentUserId, message.payload);
            break;
          case "input_action":
            handleInputAction(currentUserId, message.payload);
            break;
          case "game_over":
            await handleGameOver(currentUserId, message.payload);
            break;
          case "forfeit":
            await handleForfeit(currentUserId);
            break;
          case "rejoin_match":
            currentUserId = handleRejoinMatch(ws, message.payload);
            break;
          case "ping":
            ws.send(JSON.stringify({ type: "pong" }));
            break;
          // WebRTC signaling
          case "rtc_offer":
            handleRTCSignaling(currentUserId, "rtc_offer", message.payload);
            break;
          case "rtc_answer":
            handleRTCSignaling(currentUserId, "rtc_answer", message.payload);
            break;
          case "rtc_ice_candidate":
            handleRTCSignaling(currentUserId, "rtc_ice_candidate", message.payload);
            break;
          case "rtc_ready":
            handleRTCReady(currentUserId);
            break;
          case "client_debug":
            // Log client-side debug messages to server console
            const debugPayload = message.payload as { source: string; message: string; data?: any };
            console.log(`[client:${currentUserId}:${debugPayload.source}] ${debugPayload.message}`, debugPayload.data ? JSON.stringify(debugPayload.data) : '');
            break;
        }
      } catch (error) {
        console.error("[casual] Error handling message:", error);
        ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid message" } }));
      }
    });

    ws.on("close", () => {
      if (currentUserId) {
        handlePlayerDisconnect(currentUserId);
      }
    });
  });

  setInterval(() => {
    processCasualQueue();
  }, 1000);

  return wss;
}

async function handleJoinQueue(ws: WebSocket, payload: any): Promise<string | null> {
  const { userId, userName, userProfileImage, gameMode } = payload;
  
  if (!userId || !gameMode) {
    ws.send(JSON.stringify({ type: "error", payload: { message: "Missing userId or gameMode" } }));
    return null;
  }

  if (!MODE_CONFIG[gameMode as CasualGameMode]) {
    ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid game mode" } }));
    return null;
  }

  if (playerCasualMatches.has(userId)) {
    ws.send(JSON.stringify({ type: "error", payload: { message: "Already in a match" } }));
    return null;
  }

  const queuedPlayer: QueuedPlayer = {
    ws,
    userId,
    userName: userName || "Player",
    userProfileImage: userProfileImage || null,
    queuedAt: Date.now(),
    gameMode: gameMode as CasualGameMode,
  };

  casualQueue.set(userId, queuedPlayer);
  
  const sameModePlayers = Array.from(casualQueue.values()).filter(p => p.gameMode === gameMode);
  
  ws.send(JSON.stringify({ 
    type: "queue_joined", 
    payload: { 
      position: sameModePlayers.length,
      gameMode,
    } 
  }));

  console.log(`[casual] Player ${userId} joined ${gameMode} queue. Queue size: ${casualQueue.size}`);
  
  processCasualQueue();
  
  return userId;
}

function handleLeaveQueue(userId: string | null): void {
  if (userId && casualQueue.has(userId)) {
    casualQueue.delete(userId);
    console.log(`[casual] Player ${userId} left queue`);
  }
}

function handleRejoinMatch(ws: WebSocket, payload: any): string | null {
  const { matchId, userId } = payload;
  
  if (!matchId || !userId) {
    ws.send(JSON.stringify({ type: "error", payload: { message: "Missing matchId or userId" } }));
    return null;
  }
  
  const match = casualMatches.get(matchId);
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
  
  if (pendingDisconnects.has(userId)) {
    clearTimeout(pendingDisconnects.get(userId)!);
    pendingDisconnects.delete(userId);
  }
  
  if (isPlayerA) {
    match.playerA.ws = ws;
  } else {
    match.playerB.ws = ws;
  }
  
  playerCasualMatches.set(userId, matchId);
  
  const config = MODE_CONFIG[match.gameMode];
  
  ws.send(JSON.stringify({
    type: "match_rejoined",
    payload: {
      matchId,
      gameMode: match.gameMode,
      targetLines: config.targetLines,
      timeLimit: config.timeLimit,
      gameSeed: match.gameSeed,
      opponent: {
        userId: isPlayerA ? match.playerB.userId : match.playerA.userId,
        userName: isPlayerA ? match.playerB.userName : match.playerA.userName,
        userProfileImage: isPlayerA ? match.playerB.userProfileImage : match.playerA.userProfileImage,
      },
      isPlayerA,
      gameState: match.gameState,
    },
  }));
  
  console.log(`[casual] Player ${userId} rejoined match ${matchId}`);
  return userId;
}

function processCasualQueue(): void {
  const now = Date.now();
  const queuedPlayers = Array.from(casualQueue.values());
  
  const playersByMode: Record<CasualGameMode, QueuedPlayer[]> = {
    marathon: [],
    sprint: [],
    ultra: [],
    zen: [],
  };
  
  for (const player of queuedPlayers) {
    playersByMode[player.gameMode].push(player);
  }
  
  for (const mode of Object.keys(playersByMode) as CasualGameMode[]) {
    const players = playersByMode[mode];
    
    for (let i = 0; i < players.length - 1; i += 2) {
      const playerA = players[i];
      const playerB = players[i + 1];
      
      if (casualQueue.has(playerA.userId) && casualQueue.has(playerB.userId)) {
        createCasualMatch(playerA, playerB, mode);
      }
    }
  }
}

function createCasualMatch(playerA: QueuedPlayer, playerB: QueuedPlayer, gameMode: CasualGameMode): void {
  const matchId = `casual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const gameSeed = `seed_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  
  casualQueue.delete(playerA.userId);
  casualQueue.delete(playerB.userId);
  
  const config = MODE_CONFIG[gameMode];
  
  const match: CasualMatch = {
    id: matchId,
    playerA: {
      ws: playerA.ws,
      userId: playerA.userId,
      userName: playerA.userName,
      userProfileImage: playerA.userProfileImage,
    },
    playerB: {
      ws: playerB.ws,
      userId: playerB.userId,
      userName: playerB.userName,
      userProfileImage: playerB.userProfileImage,
    },
    gameMode,
    startedAt: Date.now(),
    gameSeed,
    gameState: {
      playerALines: 0,
      playerBLines: 0,
      playerAScore: 0,
      playerBScore: 0,
      playerABoard: [],
      playerBBoard: [],
      targetLines: config.targetLines,
      timeLimit: config.timeLimit,
      playerATime: config.timeLimit,
      playerBTime: config.timeLimit,
      playerAGameOver: false,
      playerBGameOver: false,
    },
  };
  
  casualMatches.set(matchId, match);
  playerCasualMatches.set(playerA.userId, matchId);
  playerCasualMatches.set(playerB.userId, matchId);
  
  const matchFoundPayload = {
    matchId,
    gameMode,
    targetLines: config.targetLines,
    timeLimit: config.timeLimit,
    startDelay: 3000,
    gameSeed,
  };
  
  playerA.ws.send(JSON.stringify({
    type: "match_found",
    payload: {
      ...matchFoundPayload,
      opponent: {
        userId: playerB.userId,
        userName: playerB.userName,
        userProfileImage: playerB.userProfileImage,
      },
      isPlayerA: true,
    },
  }));
  
  playerB.ws.send(JSON.stringify({
    type: "match_found",
    payload: {
      ...matchFoundPayload,
      opponent: {
        userId: playerA.userId,
        userName: playerA.userName,
        userProfileImage: playerA.userProfileImage,
      },
      isPlayerA: false,
    },
  }));
  
  if (config.timeLimit > 0) {
    setTimeout(() => {
      startMatchTimer(matchId);
    }, 3500);
  }
  
  console.log(`[casual] Match created: ${matchId} (${playerA.userName} vs ${playerB.userName}) - ${gameMode}`);
}

function startMatchTimer(matchId: string): void {
  const match = casualMatches.get(matchId);
  if (!match) return;
  
  match.timerInterval = setInterval(() => {
    const currentMatch = casualMatches.get(matchId);
    if (!currentMatch) {
      clearInterval(match.timerInterval);
      return;
    }
    
    currentMatch.gameState.playerATime = Math.max(0, currentMatch.gameState.playerATime - 1);
    currentMatch.gameState.playerBTime = Math.max(0, currentMatch.gameState.playerBTime - 1);
    
    if (currentMatch.playerA.ws) {
      currentMatch.playerA.ws.send(JSON.stringify({
        type: "timer_update",
        payload: { timeRemaining: currentMatch.gameState.playerATime },
      }));
    }
    
    if (currentMatch.playerB.ws) {
      currentMatch.playerB.ws.send(JSON.stringify({
        type: "timer_update",
        payload: { timeRemaining: currentMatch.gameState.playerBTime },
      }));
    }
    
    if (currentMatch.gameState.playerATime <= 0 && currentMatch.gameState.playerBTime <= 0) {
      clearInterval(currentMatch.timerInterval);
      endCasualMatch(matchId, determineWinner(currentMatch), "time_up");
    }
  }, 1000);
}

function determineWinner(match: CasualMatch): string | null {
  const config = MODE_CONFIG[match.gameMode];
  
  if (config.winCondition === 'score') {
    if (match.gameState.playerAScore > match.gameState.playerBScore) {
      return match.playerA.userId;
    } else if (match.gameState.playerBScore > match.gameState.playerAScore) {
      return match.playerB.userId;
    }
    return null;
  }
  
  if (config.winCondition === 'lines') {
    if (match.gameState.playerALines >= config.targetLines) {
      return match.playerA.userId;
    } else if (match.gameState.playerBLines >= config.targetLines) {
      return match.playerB.userId;
    }
    
    if (match.gameState.playerAGameOver && !match.gameState.playerBGameOver) {
      return match.playerB.userId;
    } else if (match.gameState.playerBGameOver && !match.gameState.playerAGameOver) {
      return match.playerA.userId;
    }
  }
  
  return null;
}

function handleGameUpdate(userId: string | null, payload: any): void {
  if (!userId) return;
  
  const matchId = playerCasualMatches.get(userId);
  if (!matchId) return;
  
  const match = casualMatches.get(matchId);
  if (!match) return;
  
  const { lines, score, board, gameOver, time, camera, settings, currentPiece } = payload;
  const isPlayerA = match.playerA.userId === userId;
  
  if (isPlayerA) {
    match.gameState.playerALines = lines || 0;
    match.gameState.playerAScore = score || 0;
    match.gameState.playerABoard = board || [];
    if (gameOver) match.gameState.playerAGameOver = true;
    if (time !== undefined) match.gameState.playerATime = time;
  } else {
    match.gameState.playerBLines = lines || 0;
    match.gameState.playerBScore = score || 0;
    match.gameState.playerBBoard = board || [];
    if (gameOver) match.gameState.playerBGameOver = true;
    if (time !== undefined) match.gameState.playerBTime = time;
  }
  
  const opponentWs = isPlayerA ? match.playerB.ws : match.playerA.ws;
  if (opponentWs) {
    opponentWs.send(JSON.stringify({
      type: "opponent_update",
      payload: {
        lines: isPlayerA ? match.gameState.playerALines : match.gameState.playerBLines,
        score: isPlayerA ? match.gameState.playerAScore : match.gameState.playerBScore,
        board: isPlayerA ? match.gameState.playerABoard : match.gameState.playerBBoard,
        time: isPlayerA ? match.gameState.playerATime : match.gameState.playerBTime,
        camera: camera,
        settings: settings,
        currentPiece: currentPiece,
      },
    }));
  }
  
  const config = MODE_CONFIG[match.gameMode];
  
  if (config.winCondition === 'lines' && lines >= config.targetLines) {
    endCasualMatch(matchId, userId, "lines_cleared");
    return;
  }
  
  if (gameOver) {
    if (match.gameState.playerAGameOver && match.gameState.playerBGameOver) {
      endCasualMatch(matchId, determineWinner(match), "both_topped_out");
    } else {
      const winnerId = isPlayerA ? match.playerB.userId : match.playerA.userId;
      endCasualMatch(matchId, winnerId, "opponent_topped_out");
    }
  }
}

// Optimized handler for piece position updates (high frequency, minimal data)
function handlePieceUpdate(userId: string | null, payload: any): void {
  if (!userId) {
    debugLog('piece', 'No userId for piece_update');
    return;
  }
  
  const matchId = playerCasualMatches.get(userId);
  if (!matchId) {
    debugLog('piece', `No matchId for user ${userId}`);
    return;
  }
  
  const match = casualMatches.get(matchId);
  if (!match) {
    debugLog('piece', `Match not found: ${matchId}`);
    return;
  }
  
  const isPlayerA = match.playerA.userId === userId;
  const opponentWs = isPlayerA ? match.playerB.ws : match.playerA.ws;
  const opponentId = isPlayerA ? match.playerB.userId : match.playerA.userId;
  
  debugLog('piece', `User ${userId} -> opponent ${opponentId}`, { pieceType: payload?.type, x: payload?.x, y: payload?.y });
  
  if (opponentWs?.readyState === 1) {
    opponentWs.send(JSON.stringify({
      type: "opponent_piece",
      payload: payload,
    }));
    debugLog('piece', `Sent to ${opponentId} (ws state: ${opponentWs.readyState})`);
  } else {
    debugLog('piece', `Cannot send - opponent ws state: ${opponentWs?.readyState ?? 'null'}`);
  }
}

// Optimized handler for board state updates (on piece landing)
function handleBoardUpdate(userId: string | null, payload: any): void {
  if (!userId) {
    debugLog('board', 'No userId for board_update');
    return;
  }
  
  const matchId = playerCasualMatches.get(userId);
  if (!matchId) {
    debugLog('board', `No matchId for user ${userId}`);
    return;
  }
  
  const match = casualMatches.get(matchId);
  if (!match) {
    debugLog('board', `Match not found: ${matchId}`);
    return;
  }
  
  const { lines, score, board, gameOver } = payload;
  const isPlayerA = match.playerA.userId === userId;
  
  debugLog('board', `User ${userId} board update`, { lines, score, gameOver, boardRows: board?.length });
  
  // Update match state
  if (isPlayerA) {
    match.gameState.playerALines = lines || 0;
    match.gameState.playerAScore = score || 0;
    match.gameState.playerABoard = board || [];
    if (gameOver) match.gameState.playerAGameOver = true;
  } else {
    match.gameState.playerBLines = lines || 0;
    match.gameState.playerBScore = score || 0;
    match.gameState.playerBBoard = board || [];
    if (gameOver) match.gameState.playerBGameOver = true;
  }
  
  const opponentWs = isPlayerA ? match.playerB.ws : match.playerA.ws;
  if (opponentWs?.readyState === 1) {
    opponentWs.send(JSON.stringify({
      type: "opponent_board",
      payload: {
        lines: isPlayerA ? match.gameState.playerALines : match.gameState.playerBLines,
        score: isPlayerA ? match.gameState.playerAScore : match.gameState.playerBScore,
        board: board,
      },
    }));
  }
  
  // Check win conditions
  const config = MODE_CONFIG[match.gameMode];
  if (config.winCondition === 'lines' && lines >= config.targetLines) {
    endCasualMatch(matchId, userId, "lines_cleared");
    return;
  }
  
  if (gameOver) {
    if (match.gameState.playerAGameOver && match.gameState.playerBGameOver) {
      endCasualMatch(matchId, determineWinner(match), "both_topped_out");
    } else {
      const winnerId = isPlayerA ? match.playerB.userId : match.playerA.userId;
      endCasualMatch(matchId, winnerId, "opponent_topped_out");
    }
  }
}

// Input-based sync handler for low-latency opponent updates
function handleInputAction(userId: string | null, payload: any): void {
  if (!userId) {
    debugLog('input', 'No userId for input_action');
    return;
  }
  
  const matchId = playerCasualMatches.get(userId);
  if (!matchId) {
    debugLog('input', `No matchId for user ${userId}`);
    return;
  }
  
  const match = casualMatches.get(matchId);
  if (!match) {
    debugLog('input', `Match not found: ${matchId}`);
    return;
  }
  
  const isPlayerA = match.playerA.userId === userId;
  const opponentWs = isPlayerA ? match.playerB.ws : match.playerA.ws;
  
  if (opponentWs?.readyState === 1) {
    opponentWs.send(JSON.stringify({
      type: "opponent_input",
      payload: payload,
    }));
  }
}

// Optimized handler for meta updates (camera, settings - low frequency)
function handleMetaUpdate(userId: string | null, payload: any): void {
  if (!userId) {
    debugLog('meta', 'No userId for meta_update');
    return;
  }
  
  const matchId = playerCasualMatches.get(userId);
  if (!matchId) {
    debugLog('meta', `No matchId for user ${userId}`);
    return;
  }
  
  const match = casualMatches.get(matchId);
  if (!match) {
    debugLog('meta', `Match not found: ${matchId}`);
    return;
  }
  
  const isPlayerA = match.playerA.userId === userId;
  const opponentWs = isPlayerA ? match.playerB.ws : match.playerA.ws;
  const opponentId = isPlayerA ? match.playerB.userId : match.playerA.userId;
  
  debugLog('meta', `User ${userId} -> opponent ${opponentId}`, { hasCamera: !!payload?.camera, hasSettings: !!payload?.settings });
  
  if (opponentWs?.readyState === 1) {
    opponentWs.send(JSON.stringify({
      type: "opponent_meta",
      payload: payload,
    }));
    debugLog('meta', `Sent meta to ${opponentId}`);
  } else {
    debugLog('meta', `Cannot send meta - opponent ws state: ${opponentWs?.readyState ?? 'null'}`);
  }
}

async function handleGameOver(userId: string | null, payload: any): Promise<void> {
  if (!userId) return;
  
  const matchId = playerCasualMatches.get(userId);
  if (!matchId) return;
  
  const match = casualMatches.get(matchId);
  if (!match) return;
  
  const { reason } = payload;
  const isPlayerA = match.playerA.userId === userId;
  
  const winnerId = isPlayerA ? match.playerB.userId : match.playerA.userId;
  
  await endCasualMatch(matchId, winnerId, reason || "opponent_topped_out");
}

async function handleForfeit(userId: string | null): Promise<void> {
  if (!userId) return;
  
  const matchId = playerCasualMatches.get(userId);
  if (!matchId) return;
  
  const match = casualMatches.get(matchId);
  if (!match) return;
  
  const isPlayerA = match.playerA.userId === userId;
  const winnerId = isPlayerA ? match.playerB.userId : match.playerA.userId;
  
  await endCasualMatch(matchId, winnerId, "forfeit");
}

async function endCasualMatch(matchId: string, winnerId: string | null, reason: string): Promise<void> {
  const match = casualMatches.get(matchId);
  if (!match) return;
  
  if (match.timerInterval) {
    clearInterval(match.timerInterval);
    match.timerInterval = undefined;
  }
  
  const endTime = Date.now();
  const playTime = endTime - match.startedAt;
  
  const playerAWon = winnerId === match.playerA.userId;
  const isDraw = winnerId === null;
  
  const playerAXp = calculateXpFromGame({
    score: match.gameState.playerAScore,
    linesCleared: match.gameState.playerALines,
    playTimeMs: playTime,
    gameMode: match.gameMode,
    isRankedMatch: false,
    won: playerAWon,
  });
  
  const playerBXp = calculateXpFromGame({
    score: match.gameState.playerBScore,
    linesCleared: match.gameState.playerBLines,
    playTimeMs: playTime,
    gameMode: match.gameMode,
    isRankedMatch: false,
    won: !playerAWon && !isDraw,
  });
  
  await updatePlayerXp(match.playerA.userId, playerAXp);
  await updatePlayerXp(match.playerB.userId, playerBXp);
  
  if (match.playerA.ws) {
    match.playerA.ws.send(JSON.stringify({
      type: "match_end",
      payload: {
        won: playerAWon,
        isDraw,
        reason,
        xpEarned: playerAXp,
        yourStats: {
          lines: match.gameState.playerALines,
          score: match.gameState.playerAScore,
        },
        opponentStats: {
          lines: match.gameState.playerBLines,
          score: match.gameState.playerBScore,
        },
      },
    }));
  }
  
  if (match.playerB.ws) {
    match.playerB.ws.send(JSON.stringify({
      type: "match_end",
      payload: {
        won: !playerAWon && !isDraw,
        isDraw,
        reason,
        xpEarned: playerBXp,
        yourStats: {
          lines: match.gameState.playerBLines,
          score: match.gameState.playerBScore,
        },
        opponentStats: {
          lines: match.gameState.playerALines,
          score: match.gameState.playerAScore,
        },
      },
    }));
  }
  
  casualMatches.delete(matchId);
  playerCasualMatches.delete(match.playerA.userId);
  playerCasualMatches.delete(match.playerB.userId);
  
  // Clean up WebRTC ready state
  rtcReadyPlayers.delete(match.playerA.userId);
  rtcReadyPlayers.delete(match.playerB.userId);
  
  console.log(`[casual] Match ${matchId} ended. Winner: ${winnerId || 'draw'}, Reason: ${reason}`);
}

async function updatePlayerXp(userId: string, xpEarned: number): Promise<void> {
  if (xpEarned <= 0) return;
  await storage.updatePlayerXp(userId, xpEarned);
}

function handlePlayerDisconnect(userId: string): void {
  // Clean up WebRTC ready state
  rtcReadyPlayers.delete(userId);
  
  if (casualQueue.has(userId)) {
    casualQueue.delete(userId);
    console.log(`[casual] Player ${userId} disconnected from queue`);
  }
  
  const matchId = playerCasualMatches.get(userId);
  if (matchId) {
    const match = casualMatches.get(matchId);
    if (match) {
      if (pendingDisconnects.has(userId)) {
        clearTimeout(pendingDisconnects.get(userId)!);
      }
      
      const isPlayerA = match.playerA.userId === userId;
      if (isPlayerA) {
        match.playerA.ws = null;
      } else {
        match.playerB.ws = null;
      }
      
      console.log(`[casual] Player ${userId} disconnected, waiting 10s for rejoin`);
      
      const timeout = setTimeout(() => {
        pendingDisconnects.delete(userId);
        const currentMatch = casualMatches.get(matchId);
        if (currentMatch) {
          const currentIsPlayerA = currentMatch.playerA.userId === userId;
          const currentWs = currentIsPlayerA ? currentMatch.playerA.ws : currentMatch.playerB.ws;
          
          if (currentWs === null) {
            const winnerId = currentIsPlayerA ? currentMatch.playerB.userId : currentMatch.playerA.userId;
            console.log(`[casual] Player ${userId} did not rejoin, ending match`);
            endCasualMatch(matchId, winnerId, "opponent_disconnected");
          }
        }
      }, 10000);
      
      pendingDisconnects.set(userId, timeout);
    }
  }
}

// WebRTC Signaling - relay offers/answers/ICE candidates between players
const rtcReadyPlayers: Map<string, boolean> = new Map();

function handleRTCSignaling(userId: string | null, type: string, payload: any): void {
  if (!userId) return;
  
  const matchId = playerCasualMatches.get(userId);
  if (!matchId) {
    console.log(`[WebRTC] No match found for user ${userId}`);
    return;
  }
  
  const match = casualMatches.get(matchId);
  if (!match) {
    console.log(`[WebRTC] Match ${matchId} not found`);
    return;
  }
  
  const isPlayerA = match.playerA.userId === userId;
  const opponentWs = isPlayerA ? match.playerB.ws : match.playerA.ws;
  
  if (!opponentWs || opponentWs.readyState !== 1) {
    console.log(`[WebRTC] Opponent not connected for signaling`);
    return;
  }
  
  // Relay the signaling message to opponent
  opponentWs.send(JSON.stringify({
    type,
    payload,
  }));
  
  console.log(`[WebRTC] Relayed ${type} from ${userId} to opponent`);
}

function handleRTCReady(userId: string | null): void {
  if (!userId) return;
  
  const matchId = playerCasualMatches.get(userId);
  if (!matchId) return;
  
  const match = casualMatches.get(matchId);
  if (!match) return;
  
  rtcReadyPlayers.set(userId, true);
  
  const isPlayerA = match.playerA.userId === userId;
  const opponentId = isPlayerA ? match.playerB.userId : match.playerA.userId;
  
  // Check if both players are ready
  if (rtcReadyPlayers.get(match.playerA.userId) && rtcReadyPlayers.get(match.playerB.userId)) {
    // PlayerA creates the offer
    if (match.playerA.ws && match.playerA.ws.readyState === 1) {
      match.playerA.ws.send(JSON.stringify({
        type: "rtc_initiate",
        payload: { isInitiator: true },
      }));
    }
    if (match.playerB.ws && match.playerB.ws.readyState === 1) {
      match.playerB.ws.send(JSON.stringify({
        type: "rtc_initiate",
        payload: { isInitiator: false },
      }));
    }
    
    // Clean up ready state
    rtcReadyPlayers.delete(match.playerA.userId);
    rtcReadyPlayers.delete(match.playerB.userId);
    
    console.log(`[WebRTC] Both players ready, PlayerA will initiate P2P connection`);
  } else {
    console.log(`[WebRTC] Player ${userId} ready, waiting for opponent`);
  }
}
