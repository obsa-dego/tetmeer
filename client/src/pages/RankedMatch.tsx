import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigation } from '@/contexts/NavigationContext';
import { useGame } from '@/contexts/GameContext';
import { useBlockGame } from '@/hooks/use-game';
import { useMatchmaking, OpponentUpdate, MatchEndResult } from '@/hooks/use-matchmaking';
import { GameRenderer3D } from '@/components/game/GameRenderer3D';
import { RewardSelection } from '@/components/game/RewardSelection';
import { ScoreFeedback } from '@/components/game/ScoreFeedback';
import { PiecePreview } from '@/components/game/PiecePreview';
import { Header } from '@/components/Header';
import { AdBanner } from '@/components/AdBanner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import { useSidebar } from '@/contexts/SidebarContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Trophy, Shield, Crown, Loader2, 
  ArrowLeft, Target, Bot, User,
  Flag, Zap
} from 'lucide-react';
import { getRankFromPoints, getRankDisplayInfo } from '@shared/rank-utils';
import { BlockTexture, PlacedDecorations } from '@shared/schema';
import { soundManager } from '@/lib/sound-manager';
import { useTranslation } from 'react-i18next';

const TARGET_LINES = 40;

interface OpponentState {
  lines: number;
  score: number;
  board: (string | null)[][];
}

// Convert numeric board (0=empty, 1=locked, 2=falling) to color board for GameRenderer3D
function convertNumericBoardToColorBoard(numericBoard: number[][]): (string | null)[][] {
  return numericBoard.map(row => 
    row.map(cell => {
      if (cell === 0) return null;
      if (cell === 2) return 'amber';  // Falling piece
      return 'indigo';  // Locked piece
    })
  );
}

// Create a minimal game state for rendering opponent board with GameRenderer3D
function createOpponentGameState(board: (string | null)[][] | number[][], score: number, lines: number): any {
  // Convert numeric board to color board if needed
  const colorBoard = Array.isArray(board) && board.length > 0 && typeof board[0][0] === 'number'
    ? convertNumericBoardToColorBoard(board as number[][])
    : board as (string | null)[][];
  
  return {
    board: colorBoard,
    currentPiece: null,
    nextPiece: null,
    holdPiece: null,
    canHold: false,
    score,
    level: Math.floor(lines / 10) + 1,
    linesCleared: lines,
    isGameOver: false,
    isVictory: false,
    isPaused: false,
    combo: 0,
    lastClearedLines: [],
    blockDisplacements: [],
    preClearBoard: null,
    landingX: null,
    animationPhase: 'playing',
    physicsFallingBlocks: [],
    pendingClears: [],
    cascadeCount: 0,
    fallStartTime: 0,
    gameMode: 'ranked',
    timeRemaining: 0,
    garbageCleared: 0,
    garbageQueue: 0,
    zoneEnergy: 0,
    zoneMaxEnergy: 100,
    isZoneActive: false,
    zoneTimeRemaining: 0,
    zoneActivations: 0,
    visibilityBoard: [],
    showGhost: false,
    attackIntensity: 0,
    bumpDirection: null,
    bumpTimestamp: 0,
    lastLandedPiece: null,
  };
}

export default function RankedMatch() {
  const { params, navigateTo } = useNavigation();
  const matchId = params.matchId;
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { expanded, notificationOpen, languageOpen, profileOpen } = useSidebar();
  const { setIsPlaying } = useGame();
  const anyPanelOpen = notificationOpen || languageOpen || profileOpen;
  const [countdown, setCountdown] = useState<number | null>(null);  // Wait for match data
  const [matchStarted, setMatchStarted] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchEndResult | null>(null);
  const [showRewardSelection, setShowRewardSelection] = useState(false);
  const [rewardsClaimed, setRewardsClaimed] = useState(false);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [opponentState, setOpponentState] = useState<OpponentState>({
    lines: 0,
    score: 0,
    board: Array(20).fill(null).map(() => Array(10).fill(0)),
  });

  // Check premium status for ad display
  const { data: profile } = useQuery<{ isPremium: boolean }>({
    queryKey: ["/api/profile"],
    enabled: isAuthenticated,
  });
  const isPremium = profile?.isPremium ?? false;
  const showAdBanner = matchStarted && !isPremium;

  const { data: settings } = useQuery<{ 
    blockTexture: BlockTexture; 
    backgroundColor: string; 
    gridColor: string; 
    invertX: boolean; 
    invertY: boolean; 
    mouseSensitivity: number; 
    wheelSensitivity: number;
    gridMaterial: string;
    boardMaterial: string;
    viewMode: '2d' | '3d';
    equippedDecorations: string;
    placedDecorations: string;
  }>({
    queryKey: ["/api/settings"],
    enabled: isAuthenticated,
  });

  const blockTexture: BlockTexture = settings?.blockTexture || 'default';
  const backgroundColor: string = settings?.backgroundColor || '#000000';
  const gridColor: string = settings?.gridColor || '#ffffff';
  const gridMaterial: string = settings?.gridMaterial ?? 'default';
  const boardMaterial: string = settings?.boardMaterial ?? 'default';
  const viewMode: '2d' | '3d' = settings?.viewMode ?? '3d';
  const equippedDecorations: Record<string, string> = (() => {
    try {
      return settings?.equippedDecorations ? JSON.parse(settings.equippedDecorations) : {};
    } catch {
      return {};
    }
  })();
  const placedDecorations: PlacedDecorations = (() => {
    try {
      const parsed = settings?.placedDecorations ? JSON.parse(settings.placedDecorations) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const handleOpponentUpdate = useCallback((update: OpponentUpdate) => {
    const LOCKED_BLOCK_COLOR = '#6366f1';    // Indigo for locked pieces
    const FALLING_BLOCK_COLOR = '#f59e0b';   // Amber for falling piece
    const convertedBoard: (string | null)[][] = update.board.map(row => 
      row.map(cell => {
        if (cell === 0) return null;
        if (cell === 2) return FALLING_BLOCK_COLOR;  // Current falling piece
        return LOCKED_BLOCK_COLOR;  // Locked pieces
      })
    );
    setOpponentState({
      lines: update.lines,
      score: update.score,
      board: convertedBoard,
    });
  }, []);

  const handleMatchEnd = useCallback((result: MatchEndResult) => {
    setMatchResult(result);
  }, []);

  // Score submission mutation for ranked matches
  const saveScoreMutation = useMutation({
    mutationFn: async (data: { score: number; level: number; linesCleared: number; playTime: number; gameMode: string }) => {
      const response = await apiRequest('POST', '/api/scores', data);
      return response.json();
    },
    onSuccess: () => {
      setScoreSaved(true);
      queryClient.invalidateQueries({ queryKey: ['/api/leaderboard'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
    },
  });

  const {
    status,
    match,
    error,
    sendGameUpdate,
    forfeit,
    disconnect,
    rejoinMatch,
  } = useMatchmaking({
    onOpponentUpdate: handleOpponentUpdate,
    onMatchEnd: handleMatchEnd,
  });

  // Rejoin match when component mounts
  useEffect(() => {
    if (matchId) {
      rejoinMatch(matchId);
    }
  }, [matchId, rejoinMatch]);

  // Handle rejoin failure - redirect to ranked lobby
  useEffect(() => {
    if (status === 'error' && error === 'Match not found' && matchId) {
      console.log('[RankedMatch] Match not found, redirecting to ranked lobby');
      navigateTo('ranked');
    }
  }, [status, error, matchId, navigateTo]);

  const {
    gameState,
    startGame,
    startSeededGame,
    resetGame,
    moveLeft,
    moveRight,
    moveDown,
    rotate,
    rotateLeft,
    rotateRight,
    hardDrop,
    holdPiece,
  } = useBlockGame('classic', { disableKeyHandlers: true });

  const prevLinesRef = useRef(0);
  const prevBoardRef = useRef<string | null>(null);

  // When rejoined (status becomes 'in_match' with match data), skip countdown
  useEffect(() => {
    if (status === 'in_match' && match && !matchStarted) {
      setCountdown(null);
      setMatchStarted(true);
      // Use seeded game start for synchronized piece generation
      console.log('[RankedMatch] Starting game with gameSeed:', match.gameSeed);
      if (match.gameSeed) {
        startSeededGame(match.gameSeed, 'sprint', 'normal');
      } else {
        console.warn('[RankedMatch] No gameSeed provided, using unseeded game!');
        startGame('sprint', 'normal');
      }
      soundManager.initialize();
    }
  }, [status, match, matchStarted, startGame, startSeededGame]);

  // Sync isPlaying state with matchStarted
  useEffect(() => {
    const isPlayingNow = matchStarted && !matchResult;
    setIsPlaying(isPlayingNow);
    return () => setIsPlaying(false);
  }, [matchStarted, matchResult, setIsPlaying]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setMatchStarted(true);
      // Use seeded game start for synchronized piece generation
      if (match?.gameSeed) {
        startSeededGame(match.gameSeed, 'sprint', 'normal');
      } else {
        startGame('sprint', 'normal');
      }
      soundManager.initialize();
    }
  }, [countdown, match, startGame, startSeededGame]);

  // Handle match end - save score and show rewards
  useEffect(() => {
    if (matchResult && !scoreSaved) {
      // Save score for ranked matches
      if (gameState.score > 0 && isAuthenticated) {
        saveScoreMutation.mutate({
          score: gameState.score,
          level: gameState.level,
          linesCleared: gameState.linesCleared,
          playTime: 0, // Ranked matches don't track play time
          gameMode: 'ranked',
        });
      } else {
        setScoreSaved(true);
      }
      // Show reward selection when match ends
      if (!rewardsClaimed) {
        setShowRewardSelection(true);
      }
    }
  }, [matchResult, scoreSaved, gameState.score, gameState.level, gameState.linesCleared, rewardsClaimed, isAuthenticated]);

  const handleRewardComplete = () => {
    setShowRewardSelection(false);
    setRewardsClaimed(true);
  };

  useEffect(() => {
    if (!matchStarted || !gameState) return;

    const currentBoard = JSON.stringify(gameState.board);
    const boardChanged = currentBoard !== prevBoardRef.current;
    const linesChanged = gameState.linesCleared !== prevLinesRef.current;

    if (boardChanged || linesChanged) {
      const boardForServer = gameState.board.map(row => 
        row.map(cell => cell ? 1 : 0)
      );
      sendGameUpdate({
        lines: gameState.linesCleared,
        score: gameState.score,
        board: boardForServer,
        gameOver: gameState.isGameOver,
      });

      prevLinesRef.current = gameState.linesCleared;
      prevBoardRef.current = currentBoard;
    }
  }, [gameState, matchStarted, sendGameUpdate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!matchStarted || matchResult || !gameState || gameState.isGameOver) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          moveLeft();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          moveRight();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          moveDown();
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          rotate();
          break;
        case 'z':
        case 'Z':
          e.preventDefault();
          rotateLeft();
          break;
        case 'x':
        case 'X':
          e.preventDefault();
          rotateRight();
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          break;
        case 'Shift':
        case 'c':
        case 'C':
          e.preventDefault();
          holdPiece();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [matchStarted, matchResult, gameState, moveLeft, moveRight, moveDown, rotate, rotateLeft, rotateRight, hardDrop, holdPiece]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const handleForfeit = () => {
    forfeit();
  };

  const handlePlayAgain = () => {
    disconnect();
    navigateTo('ranked');
  };

  const handleGoHome = () => {
    disconnect();
    navigateTo('landing');
  };

  const playerProgress = (gameState?.linesCleared || 0) / TARGET_LINES * 100;
  const opponentProgress = opponentState.lines / TARGET_LINES * 100;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">{t('ranked.loginRequired', 'Login required')}</p>
          <Button className="mt-4" onClick={() => navigateTo('landing')}>
            {t('nav.home', 'Home')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden">
      <Header />

      <main 
        className={`flex-1 min-h-0 relative transition-all duration-300 ease-out flex gap-4 ${anyPanelOpen ? 'blur-md pointer-events-none' : ''}`}
        style={{ 
          paddingTop: '1rem',
          paddingRight: '1rem',
          paddingBottom: '0.5rem',
          paddingLeft: '1rem'
        }}
      >
        {/* Desktop sidebar spacing */}
        <div 
          className="hidden md:block flex-shrink-0 transition-all duration-300 ease-out" 
          style={{ width: expanded ? `${240 - 16}px` : `${128 - 16}px` }}
        />

        {/* Countdown overlay */}
        {countdown !== null && countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/60">
            <div className="text-center">
              <div className="text-8xl font-bold text-primary animate-pulse mb-4">
                {countdown}
              </div>
              <div className="text-xl text-muted-foreground">
                {t('ranked.getReady', 'Get Ready!')}
              </div>
            </div>
          </div>
        )}

        {/* Match Header - Top Center */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30">
          <div className="backdrop-blur-md bg-card/80 rounded-b-lg px-6 py-2 border border-t-0 border-white/10 flex items-center gap-4">
            <Target className="w-5 h-5 text-primary" />
            <span className="font-semibold">{t('ranked.raceToLines', 'Race to {{lines}} Lines', { lines: TARGET_LINES })}</span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleForfeit}
              disabled={!!matchResult}
              data-testid="button-forfeit"
            >
              <Flag className="w-4 h-4 mr-1" />
              {t('ranked.forfeit', 'Forfeit')}
            </Button>
          </div>
        </div>

        {/* Left Panel - My Stats */}
        <div className="hidden md:flex w-48 flex-col gap-3 flex-shrink-0">
          {/* My Profile & Progress */}
          <Card className="bg-black/80 border-zinc-700">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback><User className="w-4 h-4" /></AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{user?.firstName || 'You'}</div>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                    {t('ranked.you', 'You')}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t('ranked.lines', 'Lines')}</span>
                <span className="text-xl font-bold text-primary">{gameState?.linesCleared || 0}/{TARGET_LINES}</span>
              </div>
              <Progress value={playerProgress} className="h-2" />
            </CardContent>
          </Card>

          {/* My Stats */}
          <Card className="bg-black/80 border-zinc-700">
            <CardContent className="p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('game.score', 'Score')}</span>
                <span className="font-bold">{gameState?.score?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('game.level', 'Level')}</span>
                <span className="font-bold">{gameState?.level || 1}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('game.combo', 'Combo')}</span>
                <span className="font-bold">{gameState?.combo || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* Hold/Next Pieces */}
          <Card className="bg-black/80 border-zinc-700">
            <CardContent className="p-3 space-y-2">
              <PiecePreview piece={gameState?.holdPiece} label={t('game.hold', 'Hold').toUpperCase()} compact />
              <PiecePreview piece={gameState?.nextPiece} label={t('game.next', 'Next').toUpperCase()} compact />
            </CardContent>
          </Card>
        </div>

        {/* My Game Board */}
        <Card className="flex-1 min-w-0 bg-black/80 border-zinc-700 flex flex-col overflow-hidden">
          <CardContent className="flex-1 p-0 relative">
            <ErrorBoundary componentName="GameRenderer3D">
              {gameState && (
                <GameRenderer3D
                  gameState={gameState}
                  blockTexture={blockTexture}
                  backgroundColor={backgroundColor}
                  gridColor={gridColor}
                  invertX={settings?.invertX ?? false}
                  invertY={settings?.invertY ?? false}
                  mouseSensitivity={settings?.mouseSensitivity ?? 50}
                  wheelSensitivity={settings?.wheelSensitivity ?? 50}
                  engine="classic"
                  gridMaterial={gridMaterial as any}
                  boardMaterial={boardMaterial as any}
                  viewMode={viewMode}
                  equippedDecorations={equippedDecorations}
                  placedDecorations={placedDecorations}
                />
              )}
            </ErrorBoundary>
            
            {/* Score Feedback Overlay */}
            {gameState && (
              <ScoreFeedback
                actionType={gameState.lastActionType}
                scoreGain={gameState.lastScoreGain}
                combo={gameState.combo}
                wasB2BApplied={gameState.wasB2BApplied}
                backToBack={gameState.backToBack}
                isPerfectClear={gameState.isPerfectClear}
              />
            )}
          </CardContent>
        </Card>

        {/* Opponent Game Board */}
        <Card className="flex-1 min-w-0 bg-black/80 border-zinc-700 flex flex-col overflow-hidden">
          <CardContent className="flex-1 p-0 relative">
            <ErrorBoundary componentName="OpponentGameRenderer3D">
              {(match?.opponent?.isAi || match?.opponent?.userName?.startsWith('AI')) ? (
                <GameRenderer3D
                  gameState={createOpponentGameState(opponentState.board, opponentState.score, opponentState.lines)}
                  blockTexture={blockTexture}
                  backgroundColor={backgroundColor}
                  gridColor={gridColor}
                  invertX={false}
                  invertY={false}
                  mouseSensitivity={0}
                  wheelSensitivity={0}
                  engine="classic"
                  gridMaterial={gridMaterial as any}
                  boardMaterial={boardMaterial as any}
                  viewMode={viewMode}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <OpponentBoardPreview board={opponentState.board} />
                </div>
              )}
            </ErrorBoundary>
          </CardContent>
        </Card>

        {/* Right Panel - Opponent Stats */}
        <div className="hidden md:flex w-48 flex-col gap-3 flex-shrink-0">
          {/* Opponent Profile & Progress */}
          <Card className="bg-black/80 border-zinc-700">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  {match?.opponent?.isAi ? (
                    <AvatarFallback><Bot className="w-4 h-4" /></AvatarFallback>
                  ) : (
                    <>
                      <AvatarImage src={match?.opponent?.userProfileImage || undefined} />
                      <AvatarFallback>{match?.opponent?.userName?.[0] || 'O'}</AvatarFallback>
                    </>
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{match?.opponent?.userName || t('ranked.opponent', 'Opponent')}</div>
                  {match?.opponent?.isAi && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">{t('ranked.ai', 'AI')}</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t('ranked.lines', 'Lines')}</span>
                <span className="text-xl font-bold text-amber-400">{opponentState.lines}/{TARGET_LINES}</span>
              </div>
              <Progress value={opponentProgress} className="h-2" />
            </CardContent>
          </Card>

          {/* Opponent Stats */}
          <Card className="bg-black/80 border-zinc-700">
            <CardContent className="p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('game.score', 'Score')}</span>
                <span className="font-bold">{opponentState.score.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('ranked.points', 'RP')}</span>
                <span className="font-bold">{match?.opponent?.rankPoints || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mobile Overlay Info */}
        <div className="md:hidden absolute top-2 left-2 right-2 z-30 flex justify-between items-start gap-2 pointer-events-none">
          <div className="flex flex-col gap-1 pointer-events-auto">
            <PiecePreview piece={gameState?.holdPiece} label={t('game.hold', 'Hold').toUpperCase()} compact />
            <PiecePreview piece={gameState?.nextPiece} label={t('game.next', 'Next').toUpperCase()} compact />
          </div>
          <div className="flex flex-col gap-1 pointer-events-auto">
            <div className="backdrop-blur-md bg-card/80 rounded-lg p-2 border border-white/10 text-xs">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t('ranked.you', 'You')}</span>
                  <span className="font-mono font-bold text-primary">{gameState?.linesCleared || 0}/{TARGET_LINES}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t('ranked.opponent', 'Opp')}</span>
                  <span className="font-mono font-bold text-amber-400">{opponentState.lines}/{TARGET_LINES}</span>
                </div>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleForfeit}
              disabled={!!matchResult}
              data-testid="button-forfeit-mobile"
            >
              <Flag className="w-4 h-4 mr-1" />
              {t('ranked.forfeit', 'Forfeit')}
            </Button>
          </div>
        </div>
      </main>

      {/* Ad Banner */}
      {showAdBanner && <AdBanner data-testid="ad-banner" />}

      {matchResult && showRewardSelection && (
        <RewardSelection 
          onComplete={handleRewardComplete}
          score={gameState.score}
          linesCleared={gameState.linesCleared}
        />
      )}

      {matchResult && !showRewardSelection && (
        <MatchResultModal 
          result={matchResult} 
          onPlayAgain={handlePlayAgain}
          onGoHome={handleGoHome}
        />
      )}
    </div>
  );
}

function OpponentBoardPreview({ board }: { board: (string | null)[][] }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-black/20 rounded-lg p-2">
      <div 
        className="grid gap-[1px]"
        style={{
          gridTemplateColumns: `repeat(10, 1fr)`,
          gridTemplateRows: `repeat(${board.length}, 1fr)`,
          width: '100%',
          height: '100%',
        }}
      >
        {board.map((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${y}-${x}`}
              className="rounded-[2px] w-full h-full"
              style={{
                backgroundColor: cell || 'rgba(255,255,255,0.05)',
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function MatchResultModal({ 
  result, 
  onPlayAgain, 
  onGoHome 
}: { 
  result: MatchEndResult; 
  onPlayAgain: () => void;
  onGoHome: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="p-8 max-w-md w-full space-y-6 animate-in zoom-in-95">
        <div className="text-center">
          {result.won ? (
            <>
              <Trophy className="w-20 h-20 mx-auto text-yellow-500 mb-4" />
              <h2 className="text-3xl font-bold text-green-500">{t('ranked.victory', 'Victory!')}</h2>
            </>
          ) : (
            <>
              <Shield className="w-20 h-20 mx-auto text-gray-400 mb-4" />
              <h2 className="text-3xl font-bold text-red-500">{t('ranked.defeat', 'Defeat')}</h2>
            </>
          )}
          <p className="text-muted-foreground mt-2">{result.reason}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <div className={`text-2xl font-bold ${result.rankPointChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {result.rankPointChange >= 0 ? '+' : ''}{result.rankPointChange}
            </div>
            <div className="text-sm text-muted-foreground">{t('ranked.rpChange', 'RP Change')}</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-cyan-500">+{result.xpEarned}</div>
            <div className="text-sm text-muted-foreground">{t('ranked.xpEarned', 'XP Earned')}</div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('ranked.newRank', 'New RP')}</span>
            <span className="font-bold text-lg">{result.newRankPoints}</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-muted-foreground">{t('ranked.level', 'Level')}</span>
            <span className="font-bold text-lg">{result.newLevel}</span>
          </div>
        </div>

        <div className="flex gap-4">
          <Button className="flex-1" variant="outline" onClick={onGoHome} data-testid="button-go-home">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('nav.home', 'Home')}
          </Button>
          <Button className="flex-1" onClick={onPlayAgain} data-testid="button-play-again">
            <Zap className="w-4 h-4 mr-2" />
            {t('ranked.playAgain', 'Play Again')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
