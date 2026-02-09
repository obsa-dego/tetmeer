import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useNavigation } from '@/contexts/NavigationContext';
import { useGame } from '@/contexts/GameContext';
import { useBlockGame } from '@/hooks/use-game';
import { useCasualMatchmaking, CasualOpponentUpdate, CasualMatchEndResult, CasualGameMode, MODE_DISPLAY_INFO, InputAction, InputActionType } from '@/hooks/use-casual-matchmaking';
import { GameRenderer3D } from '@/components/game/GameRenderer3D';
import OpponentBoard2D from '@/components/game/OpponentBoard2D';
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
  Trophy, Shield, Loader2, 
  ArrowLeft, Target, User,
  Flag, Zap, Timer, Infinity as InfinityIcon,
  FastForward
} from 'lucide-react';
import { BlockTexture, PlacedDecorations } from '@shared/schema';
import { soundManager } from '@/lib/sound-manager';
import { useTranslation } from 'react-i18next';

interface CameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

interface OpponentSettings {
  blockTexture: string;
  gridMaterial: string;
  boardMaterial: string;
  backgroundColor: string;
  gridColor: string;
  equippedDecorations: Record<string, string>;
  placedDecorations: any[];
}

interface CurrentPieceData {
  type: string;
  x: number;
  y: number;
  rotation: number;
  shape: boolean[][];
}

// Lerp utility for smooth position interpolation
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

// Interpolated piece data for smooth opponent rendering
interface InterpolatedPieceData extends CurrentPieceData {
  displayX: number;
  displayY: number;
}

interface OpponentState {
  lines: number;
  score: number;
  board: (string | null)[][];
  time?: number;
  camera?: CameraState;
  settings?: OpponentSettings;
  currentPiece?: CurrentPieceData | null;
}

const PIECE_COLORS: Record<string, string> = {
  'I': '#00f0f0',
  'O': '#f0f000',
  'T': '#a000f0',
  'S': '#00f000',
  'Z': '#f00000',
  'J': '#0000f0',
  'L': '#f0a000',
};

interface MemoizedOpponentRendererProps {
  gameState: any;
  blockTexture: BlockTexture;
  backgroundColor: string;
  gridMaterial: string;
  boardMaterial: string;
  onContextLost?: () => void;
}

const MemoizedOpponentRenderer = memo(function MemoizedOpponentRenderer({
  gameState,
  blockTexture,
  backgroundColor,
  gridMaterial,
  boardMaterial,
  onContextLost,
}: MemoizedOpponentRendererProps) {
  const [initialized, setInitialized] = useState(false);
  const [frozenState, setFrozenState] = useState<any>(null);
  const mountTimeRef = useRef(Date.now());
  const INIT_GRACE_MS = 600;

  useEffect(() => {
    mountTimeRef.current = Date.now();
    const timer = setTimeout(() => {
      console.log('[MemoizedOpponentRenderer] Init grace period ended, accepting updates');
      setInitialized(true);
    }, INIT_GRACE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    setFrozenState(gameState);
  }, [initialized, gameState]);

  const stableState = frozenState || gameState;

  return (
    <GameRenderer3D
      gameState={stableState}
      blockTexture={blockTexture}
      backgroundColor={backgroundColor}
      gridColor="#ffffff"
      spectatorMode
      engine="classic"
      gridMaterial={gridMaterial as any}
      boardMaterial={boardMaterial as any}
      viewMode="3d"
      liteMode
      onContextLost={onContextLost}
    />
  );
}, (prevProps, nextProps) => {
  if (prevProps.blockTexture !== nextProps.blockTexture) return false;
  if (prevProps.backgroundColor !== nextProps.backgroundColor) return false;
  if (prevProps.gridMaterial !== nextProps.gridMaterial) return false;
  if (prevProps.boardMaterial !== nextProps.boardMaterial) return false;
  if (prevProps.gameState !== nextProps.gameState) return false;
  return true;
});

function createOpponentGameState(
  board: (string | null)[][] | number[][], 
  score: number, 
  lines: number,
  currentPiece?: CurrentPieceData | null
): any {
  // Validate board has proper dimensions (20 rows x 10 columns)
  if (!Array.isArray(board) || board.length === 0 || !Array.isArray(board[0]) || board[0].length === 0) {
    // Return a valid empty board if invalid
    const emptyBoard = Array(20).fill(null).map(() => Array(10).fill(null));
    return {
      board: emptyBoard,
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
      gameMode: 'marathon',
      timeRemaining: 0,
      garbageCleared: 0,
      garbageQueue: 0,
      zoneEnergy: 0,
      zoneMaxEnergy: 100,
      isZoneActive: false,
      zoneTimeRemaining: 0,
      zoneActivations: 0,
      visibilityBoard: [],
      showGhost: true,
      attackIntensity: 0,
      bumpDirection: null,
      bumpTimestamp: 0,
      lastLandedPiece: null,
    };
  }
  
  const colorBoard = typeof board[0][0] === 'number'
    ? (board as number[][]).map(row => 
        row.map(cell => {
          if (cell === 0) return null;
          if (cell === 2) return '#f59e0b';
          return '#6366f1';
        })
      )
    : board as (string | null)[][];
  
  // Build currentPiece object for rendering - must match GameRenderer3D's expected structure
  const gamePiece = currentPiece ? {
    type: currentPiece.type,
    position: { x: currentPiece.x, y: currentPiece.y },
    rotation: currentPiece.rotation,
    shape: currentPiece.shape,
    color: PIECE_COLORS[currentPiece.type] || '#6366f1',
  } : null;
  
  return {
    board: colorBoard,
    currentPiece: gamePiece,
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
    gameMode: 'marathon',
    timeRemaining: 0,
    garbageCleared: 0,
    garbageQueue: 0,
    zoneEnergy: 0,
    zoneMaxEnergy: 100,
    isZoneActive: false,
    zoneTimeRemaining: 0,
    zoneActivations: 0,
    visibilityBoard: [],
    showGhost: true,
    attackIntensity: 0,
    bumpDirection: null,
    bumpTimestamp: 0,
    lastLandedPiece: null,
  };
}

export default function CasualMatch() {
  const { params, navigateTo } = useNavigation();
  const matchId = params.matchId;
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { expanded, notificationOpen, languageOpen, profileOpen } = useSidebar();
  const { setIsPlaying } = useGame();
  const anyPanelOpen = notificationOpen || languageOpen || profileOpen;
  const [countdown, setCountdown] = useState<number | null>(null);
  const [matchStarted, setMatchStarted] = useState(false);
  const [matchResult, setMatchResult] = useState<CasualMatchEndResult | null>(null);
  const [showRewardSelection, setShowRewardSelection] = useState(false);
  const [rewardsClaimed, setRewardsClaimed] = useState(false);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [opponentRendererReady, setOpponentRendererReady] = useState(false);
  const [throttledOpponentGameState, setThrottledOpponentGameState] = useState<any>(null);
  const [isTabActive, setIsTabActive] = useState(true);
  const [opponent3DFailed, setOpponent3DFailed] = useState(false);
  const opponent3DRetryCountRef = useRef(0);
  const MAX_3D_RETRIES = 1;
  const lastOpponentUpdateRef = useRef<number>(0);
  const fpsBeforeOpponentMountRef = useRef<number>(60);
  const opponentMountTimeRef = useRef<number>(0);
  const [opponentState, setOpponentState] = useState<OpponentState>({
    lines: 0,
    score: 0,
    board: Array(20).fill(null).map(() => Array(10).fill(0)),
  });
  
  // Interpolation state for smooth opponent piece rendering
  const [interpolatedPiece, setInterpolatedPiece] = useState<InterpolatedPieceData | null>(null);
  const pieceTargetRef = useRef<{ x: number; y: number; type: string; rotation: number; shape: boolean[][] } | null>(null);
  const pieceDisplayRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const interpolatedPieceRef = useRef<InterpolatedPieceData | null>(null);
  const animFrameRef = useRef<number>(0);
  
  // Camera state ref for syncing with opponent
  const currentCameraRef = useRef<CameraState | undefined>(undefined);
  
  // GameState ref to avoid re-creating intervals on every state change
  const gameStateRef = useRef<any>(null);

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

  const updateCounterRef = useRef({ opponent: 0, piece: 0, board: 0, meta: 0, render: 0, input: 0 });
  const debugLogFnRef = useRef<((source: string, msg: string, data?: any) => void) | null>(null);
  const diagStartRef = useRef(performance.now());
  const diagIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  useEffect(() => {
    if (!matchStarted) return;
    diagStartRef.current = performance.now();
    updateCounterRef.current = { opponent: 0, piece: 0, board: 0, meta: 0, render: 0, input: 0 };
    return () => {};
  }, [matchStarted]);
  
  const handleOpponentUpdate = useCallback((update: CasualOpponentUpdate) => {
    updateCounterRef.current.opponent++;
    
    const LOCKED_BLOCK_COLOR = '#6366f1';
    const FALLING_BLOCK_COLOR = '#f59e0b';
    const convertedBoard: (string | null)[][] = update.board.map(row => 
      row.map(cell => {
        if (cell === 0) return null;
        if (cell === 2) return FALLING_BLOCK_COLOR;
        return LOCKED_BLOCK_COLOR;
      })
    );
    setOpponentState(prev => ({
      lines: update.lines,
      score: update.score,
      board: convertedBoard,
      time: update.time,
      camera: update.camera ?? prev.camera,
      settings: update.settings ?? prev.settings,
      currentPiece: update.currentPiece ?? null,
    }));
    
    // Also update interpolatedPiece from full updates as fallback
    if (update.currentPiece) {
      const piece = update.currentPiece;
      pieceTargetRef.current = {
        x: piece.x,
        y: piece.y,
        type: piece.type,
        rotation: piece.rotation,
        shape: piece.shape,
      };
      pieceDisplayRef.current = { x: piece.x, y: piece.y };
      setInterpolatedPiece({
        type: piece.type,
        x: piece.x,
        y: piece.y,
        displayX: piece.x,
        displayY: piece.y,
        rotation: piece.rotation,
        shape: piece.shape,
      });
    }
  }, []);

  // Optimized split update handlers for lower latency - direct update without interpolation
  // Reduced throttle for smoother opponent movement (60fps target)
  const lastPieceUpdateRef = useRef<number>(0);
  const PIECE_UPDATE_THROTTLE = 16; // 60fps for smoother updates
  
  const handleOpponentPieceUpdate = useCallback((update: { type: string; x: number; y: number; rotation: number; shape?: number[][] }) => {
    updateCounterRef.current.piece++;
    const now = Date.now();
    
    // Throttle updates to prevent browser freeze from excessive re-renders
    if (now - lastPieceUpdateRef.current < PIECE_UPDATE_THROTTLE) {
      // Still update refs for latest position, just skip React state update
      pieceTargetRef.current = {
        x: update.x,
        y: update.y,
        type: update.type,
        rotation: update.rotation,
        shape: update.shape 
          ? update.shape.map(row => row.map(cell => cell === 1))
          : (pieceTargetRef.current?.shape || []),
      };
      return;
    }
    lastPieceUpdateRef.current = now;
    
    // Use provided shape or keep existing (shape only changes with type/rotation)
    const shape = update.shape 
      ? update.shape.map(row => row.map(cell => cell === 1))
      : (pieceTargetRef.current?.shape || []);
    
    pieceTargetRef.current = {
      x: update.x,
      y: update.y,
      type: update.type,
      rotation: update.rotation,
      shape: shape,
    };
    
    // Direct update without interpolation to reduce complexity
    const newPieceState = {
      type: update.type,
      x: update.x,
      y: update.y,
      displayX: update.x,
      displayY: update.y,
      rotation: update.rotation,
      shape: shape,
    };
    interpolatedPieceRef.current = newPieceState;
    setInterpolatedPiece(newPieceState);
  }, []);

  const handleOpponentBoardUpdate = useCallback((update: { lines: number; score: number; board: number[][] }) => {
    updateCounterRef.current.board++;
    const LOCKED_BLOCK_COLOR = '#6366f1';
    const FALLING_BLOCK_COLOR = '#f59e0b';
    const convertedBoard: (string | null)[][] = update.board.map(row => 
      row.map(cell => {
        if (cell === 0) return null;
        if (cell === 2) return FALLING_BLOCK_COLOR;
        return LOCKED_BLOCK_COLOR;
      })
    );
    setOpponentState(prev => ({
      ...prev,
      lines: update.lines,
      score: update.score,
      board: convertedBoard,
    }));
  }, []);

  const handleOpponentMetaUpdate = useCallback((update: { camera?: CameraState; settings?: OpponentSettings; time?: number }) => {
    updateCounterRef.current.meta++;
    setOpponentState(prev => ({
      ...prev,
      camera: update.camera ?? prev.camera,
      settings: update.settings ?? prev.settings,
      time: update.time ?? prev.time,
    }));
  }, []);

  const handleMatchEnd = useCallback((result: CasualMatchEndResult) => {
    setMatchResult(result);
  }, []);

  const handleTimerUpdate = useCallback((remaining: number) => {
    setTimeRemaining(remaining);
  }, []);
  
  // Handle camera changes from player's GameRenderer3D
  const handleCameraChange = useCallback((camera: CameraState) => {
    currentCameraRef.current = camera;
  }, []);

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

  // Opponent game instance for input-based sync (must be defined before useCasualMatchmaking)
  // Auto-fall enabled so opponent pieces drop at same rate (same level = same speed)
  // Input actions handle movement/rotation, periodic board_update handles resync
  const {
    gameState: opponentLocalGameState,
    startGame: startOpponentGame,
    startSeededGame: startOpponentSeededGame,
    moveLeft: opponentMoveLeft,
    moveRight: opponentMoveRight,
    moveDown: opponentMoveDown,
    rotate: opponentRotate,
    rotateLeft: opponentRotateLeft,
    rotateRight: opponentRotateRight,
    hardDrop: opponentHardDrop,
    holdPiece: opponentHoldPiece,
  } = useBlockGame('classic', { disableKeyHandlers: true, disableAutoFall: true });

  // Map of input action types to opponent game functions
  const opponentActionMap = useMemo(() => ({
    moveLeft: opponentMoveLeft,
    moveRight: opponentMoveRight,
    moveDown: opponentMoveDown,
    rotate: opponentRotate,
    rotateLeft: opponentRotateLeft,
    rotateRight: opponentRotateRight,
    hardDrop: opponentHardDrop,
    holdPiece: opponentHoldPiece,
  }), [opponentMoveLeft, opponentMoveRight, opponentMoveDown, opponentRotate, opponentRotateLeft, opponentRotateRight, opponentHardDrop, opponentHoldPiece]);

  // Handle opponent input actions for low-latency sync
  const handleOpponentInputAction = useCallback((inputAction: InputAction) => {
    updateCounterRef.current.input++;
    const actionFn = opponentActionMap[inputAction.action];
    if (actionFn) {
      actionFn();
    }
  }, [opponentActionMap]);

  const {
    status,
    match,
    error,
    gameMode,
    sendGameUpdate,
    sendPieceUpdate,
    sendBoardUpdate,
    sendMetaUpdate,
    sendDebugLog,
    forfeit,
    disconnect,
    rejoinMatch,
    sendInputAction,
  } = useCasualMatchmaking({
    onOpponentUpdate: handleOpponentUpdate,
    onOpponentPieceUpdate: handleOpponentPieceUpdate,
    onOpponentBoardUpdate: handleOpponentBoardUpdate,
    onOpponentMetaUpdate: handleOpponentMetaUpdate,
    onMatchEnd: handleMatchEnd,
    onTimerUpdate: handleTimerUpdate,
    onOpponentInputAction: handleOpponentInputAction,
  });

  // Rejoin match from params or sessionStorage
  useEffect(() => {
    let targetMatchId = matchId;
    
    // Check sessionStorage for match data from Game page
    if (!targetMatchId) {
      const storedMatchData = sessionStorage.getItem('casualMatchData');
      if (storedMatchData) {
        try {
          const parsed = JSON.parse(storedMatchData);
          targetMatchId = parsed.matchId;
          sessionStorage.removeItem('casualMatchData'); // Clear after reading
        } catch (e) {
          console.error('[casual] Failed to parse stored match data:', e);
        }
      }
    }
    
    if (targetMatchId) {
      console.log('[casual] Rejoining match:', targetMatchId);
      rejoinMatch(targetMatchId);
    }
  }, [matchId, rejoinMatch]);

  useEffect(() => {
    if (status === 'error' && error === 'Match not found') {
      navigateTo('game');
    }
  }, [status, error, navigateTo]);

  useEffect(() => {
    debugLogFnRef.current = sendDebugLog;
    (window as any).__sendDebugLog = sendDebugLog;
    return () => { (window as any).__sendDebugLog = null; };
  }, [sendDebugLog]);

  // Retry mechanism: separate effect so retry timer works regardless of tab/match state
  useEffect(() => {
    if (!opponent3DFailed) return;
    if (opponent3DRetryCountRef.current >= MAX_3D_RETRIES) return;
    
    const retryTimer = setTimeout(() => {
      console.log(`[CasualMatch] Retrying 3D opponent view (attempt ${opponent3DRetryCountRef.current + 1}/${MAX_3D_RETRIES})`);
      opponent3DRetryCountRef.current++;
      fpsBeforeOpponentMountRef.current = 60;
      opponentMountTimeRef.current = 0;
      setOpponent3DFailed(false);
    }, 15000);
    return () => clearTimeout(retryTimer);
  }, [opponent3DFailed]);

  // Delay opponent 3D renderer mount to prevent dual WebGL initialization freeze
  // Using 3000ms delay to ensure player's renderer is fully stable first
  useEffect(() => {
    if (!matchStarted) {
      setOpponentRendererReady(false);
      setThrottledOpponentGameState(null);
      return;
    }
    
    if (opponent3DFailed) {
      console.log('[CasualMatch] 3D opponent view disabled (auto-fallback active)');
      setOpponentRendererReady(false);
      return;
    }
    
    if (!isTabActive) {
      console.log('[CasualMatch] Tab is inactive, skipping 3D renderer mount');
      setOpponentRendererReady(false);
      fpsBeforeOpponentMountRef.current = 60;
      opponentMountTimeRef.current = 0;
      return;
    }
    
    fpsBeforeOpponentMountRef.current = 60;
    opponentMountTimeRef.current = 0;
    
    const timeoutId = setTimeout(() => {
      console.log('[CasualMatch] Enabling opponent 3D renderer (delayed mount - 3000ms)');
      opponentMountTimeRef.current = performance.now();
      setOpponentRendererReady(true);
    }, 3000);
    
    return () => clearTimeout(timeoutId);
  }, [matchStarted, isTabActive, opponent3DFailed]);

  // Track tab visibility with debounce to prevent rapid mount/unmount cycles
  const tabDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const handleVisibilityChange = () => {
      const active = document.visibilityState === 'visible';
      console.log('[CasualMatch] Tab visibility changed:', active ? 'active' : 'hidden');
      
      if (tabDebounceRef.current) {
        clearTimeout(tabDebounceRef.current);
      }
      
      if (!active) {
        tabDebounceRef.current = setTimeout(() => {
          setIsTabActive(false);
        }, 500);
      } else {
        setIsTabActive(true);
      }
    };
    
    // Set initial state
    setIsTabActive(document.visibilityState === 'visible');
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (tabDebounceRef.current) clearTimeout(tabDebounceRef.current);
    };
  }, []);

  const opponentRendererReadyRef = useRef(false);
  useEffect(() => { opponentRendererReadyRef.current = opponentRendererReady; }, [opponentRendererReady]);
  
  useEffect(() => {
    if (!matchStarted) return;
    
    const DIAG_INTERVAL = 2000;
    let frameCounter = 0;
    let lastDiagTime = performance.now();
    
    let rafId: number;
    const countFrame = () => {
      frameCounter++;
      rafId = requestAnimationFrame(countFrame);
    };
    rafId = requestAnimationFrame(countFrame);
    
    sendDebugLog('CasualMatch', 'match_started', { matchId: match?.matchId });
    
    const intervalId = setInterval(() => {
      const now = performance.now();
      const elapsed = (now - lastDiagTime) / 1000;
      const c = updateCounterRef.current;
      const stats = {
        interval_s: elapsed.toFixed(1),
        ws_per_s: {
          opponent: (c.opponent / elapsed).toFixed(1),
          piece: (c.piece / elapsed).toFixed(1),
          board: (c.board / elapsed).toFixed(1),
          meta: (c.meta / elapsed).toFixed(1),
          input: (c.input / elapsed).toFixed(1),
        },
        render_count: c.render,
        fps: Math.round(frameCounter / elapsed),
        gameOver: gameStateRef.current?.isGameOver,
        opponentRendererReady: opponentRendererReadyRef.current,
        memoryMB: (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1048576) : 'N/A',
      };
      
      console.log(`[CasualMatch DIAG] fps=${stats.fps} | WS/s: opp=${stats.ws_per_s.opponent} piece=${stats.ws_per_s.piece} board=${stats.ws_per_s.board} | renders=${c.render} | mem=${stats.memoryMB}MB`);
      sendDebugLog('CasualMatch', 'diag', stats);
      
      const currentFps = stats.fps as number;
      if (!opponentRendererReadyRef.current) {
        fpsBeforeOpponentMountRef.current = currentFps > 0 ? currentFps : 60;
      } else if (opponentMountTimeRef.current > 0) {
        const timeSinceMount = now - opponentMountTimeRef.current;
        if (timeSinceMount > 3000 && timeSinceMount < 10000 && currentFps > 0) {
          const fpsDrop = fpsBeforeOpponentMountRef.current - currentFps;
          const dropRatio = fpsDrop / Math.max(fpsBeforeOpponentMountRef.current, 1);
          if (currentFps < 20 || dropRatio > 0.5) {
            console.log(`[CasualMatch] Auto-fallback to 2D: fps dropped from ${fpsBeforeOpponentMountRef.current} to ${currentFps}`);
            sendDebugLog('CasualMatch', 'auto_fallback_2d', { before: fpsBeforeOpponentMountRef.current, after: currentFps, dropRatio: dropRatio.toFixed(2) });
            setOpponent3DFailed(true);
            setOpponentRendererReady(false);
          }
        }
      }
      
      updateCounterRef.current = { opponent: 0, piece: 0, board: 0, meta: 0, render: 0, input: 0 };
      frameCounter = 0;
      lastDiagTime = now;
    }, DIAG_INTERVAL);
    
    return () => {
      clearInterval(intervalId);
      cancelAnimationFrame(rafId);
    };
  }, [matchStarted, sendDebugLog, match?.matchId]);

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

  // Keep gameState in ref to avoid interval recreation
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (status === 'in_match' && match && !matchStarted) {
      setCountdown(null);
      setMatchStarted(true);
      if (match.timeLimit > 0) {
        setTimeRemaining(match.timeLimit);
      }
      if (match.gameSeed) {
        startSeededGame(match.gameSeed, 'marathon', 'normal');
        startOpponentSeededGame(match.gameSeed, 'marathon', 'normal'); // Start opponent game with same seed
      } else {
        startGame('marathon', 'normal');
        startOpponentGame('marathon', 'normal'); // Start opponent game without seed
      }
      soundManager.initialize();
    }
  }, [status, match, matchStarted, startGame, startSeededGame, startOpponentSeededGame, startOpponentGame]);

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
      if (match?.timeLimit && match.timeLimit > 0) {
        setTimeRemaining(match.timeLimit);
      }
      if (match?.gameSeed) {
        startSeededGame(match.gameSeed, 'marathon', 'normal');
        startOpponentSeededGame(match.gameSeed, 'marathon', 'normal'); // Start opponent game with same seed
      } else {
        startGame('marathon', 'normal');
        startOpponentGame('marathon', 'normal'); // Start opponent game without seed
      }
      soundManager.initialize();
    }
  }, [countdown, match, startGame, startSeededGame, startOpponentSeededGame, startOpponentGame]);

  useEffect(() => {
    if (matchResult && !scoreSaved) {
      if (gameState.score > 0 && isAuthenticated) {
        saveScoreMutation.mutate({
          score: gameState.score,
          level: gameState.level,
          linesCleared: gameState.linesCleared,
          playTime: 0,
          gameMode: match?.gameMode || 'marathon',
        });
      } else {
        setScoreSaved(true);
      }
      if (!rewardsClaimed) {
        setShowRewardSelection(true);
      }
    }
  }, [matchResult, scoreSaved, gameState.score, gameState.level, gameState.linesCleared, rewardsClaimed, isAuthenticated, match?.gameMode]);

  const handleRewardComplete = () => {
    setShowRewardSelection(false);
    setRewardsClaimed(true);
  };

  // Smooth interpolation animation loop for opponent piece
  // NOTE: Removed continuous RAF loop to prevent performance issues
  // Interpolation now happens instantly when piece updates are received
  // This is a simpler, more performant approach

  // Track previous board state for change detection
  const prevBoardRef = useRef<string>('');
  const prevPieceRef = useRef<{ x: number; y: number; rotation: number; type: string } | null>(null);

  // Piece updates - IMMEDIATE on change for minimal latency
  // Triggers whenever currentPiece changes instead of polling
  useEffect(() => {
    if (!matchStarted || !gameState || gameState.isGameOver) return;
    
    const piece = gameState.currentPiece;
    if (!piece) return;

    // Only send if piece position/rotation changed
    const prev = prevPieceRef.current;
    if (prev && 
        prev.x === piece.position.x && 
        prev.y === piece.position.y && 
        prev.rotation === piece.rotationState && 
        prev.type === piece.type) {
      return;
    }

    // Check if shape needs to be sent (only on type/rotation change)
    const shapeChanged = !prev || prev.type !== piece.type || prev.rotation !== piece.rotationState;

    prevPieceRef.current = {
      x: piece.position.x,
      y: piece.position.y,
      rotation: piece.rotationState,
      type: piece.type,
    };

    // Send minimal update - only include shape when it changes
    const update: { type: string; x: number; y: number; rotation: number; shape?: number[][] } = {
      type: piece.type,
      x: piece.position.x,
      y: piece.position.y,
      rotation: piece.rotationState,
    };
    
    if (shapeChanged) {
      update.shape = (piece.shape as (boolean | string | null | number)[][]).map(row => row.map(cell => cell ? 1 : 0));
    }

    sendPieceUpdate(update);
  }, [matchStarted, gameState?.currentPiece?.position.x, gameState?.currentPiece?.position.y, 
      gameState?.currentPiece?.rotationState, gameState?.currentPiece?.type, sendPieceUpdate]);

  // MEDIUM PRIORITY: Board updates only when board changes (on line clear/lock)
  useEffect(() => {
    if (!matchStarted || !gameState || gameState.isGameOver) return;

    // Convert board to string for comparison
    const boardString = gameState.board.map(row => row.map(cell => cell ? '1' : '0').join('')).join('');
    
    // Only send if board actually changed
    if (boardString === prevBoardRef.current) return;
    prevBoardRef.current = boardString;

    const boardForServer = gameState.board.map(row => 
      row.map(cell => cell ? 1 : 0)
    );

    sendBoardUpdate({
      lines: gameState.linesCleared,
      score: gameState.score,
      board: boardForServer,
      gameOver: gameState.isGameOver,
    });
  }, [matchStarted, gameState?.board, gameState?.linesCleared, gameState?.score, gameState?.isGameOver, sendBoardUpdate]);

  // LOW PRIORITY: Meta updates at 10fps (100ms) - camera, settings, time
  // Uses refs to avoid interval recreation on every state change
  const timeRemainingRef = useRef(timeRemaining);
  const settingsRef = useRef(settings);
  const equippedDecorationsRef = useRef(equippedDecorations);
  const placedDecorationsRef = useRef(placedDecorations);
  
  useEffect(() => { timeRemainingRef.current = timeRemaining; }, [timeRemaining]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { equippedDecorationsRef.current = equippedDecorations; }, [equippedDecorations]);
  useEffect(() => { placedDecorationsRef.current = placedDecorations; }, [placedDecorations]);
  
  // Ref to track last sent camera state for change detection
  const lastSentCameraRef = useRef<string>('');
  const lastSentSettingsRef = useRef<string>('');
  
  useEffect(() => {
    if (!matchStarted) return;

    const META_INTERVAL = 500; // 2fps for meta data (reduced from 10fps to prevent overload)
    
    const intervalId = setInterval(() => {
      const gs = gameStateRef.current;
      if (!gs || gs.isGameOver) return;
      
      const currentCamera = currentCameraRef.current;
      const currentSettings = settingsRef.current;
      
      // Build camera string for comparison
      const cameraStr = currentCamera 
        ? `${currentCamera.position.x.toFixed(1)},${currentCamera.position.y.toFixed(1)},${currentCamera.position.z.toFixed(1)}`
        : '';
      
      // Build settings string for comparison
      const settingsStr = currentSettings 
        ? `${currentSettings.blockTexture}|${currentSettings.gridMaterial}|${currentSettings.boardMaterial}`
        : '';
      
      // Only send if camera or settings actually changed
      const cameraChanged = cameraStr !== lastSentCameraRef.current;
      const settingsChanged = settingsStr !== lastSentSettingsRef.current;
      
      if (!cameraChanged && !settingsChanged) {
        return; // Skip sending if nothing changed
      }
      
      lastSentCameraRef.current = cameraStr;
      lastSentSettingsRef.current = settingsStr;
      
      const mySettings = currentSettings ? {
        blockTexture: currentSettings.blockTexture || 'default',
        gridMaterial: currentSettings.gridMaterial || 'default',
        boardMaterial: currentSettings.boardMaterial || 'default',
        backgroundColor: currentSettings.backgroundColor || '#000000',
        gridColor: currentSettings.gridColor || '#ffffff',
        equippedDecorations: equippedDecorationsRef.current,
        placedDecorations: placedDecorationsRef.current,
      } : undefined;

      sendMetaUpdate({
        camera: currentCameraRef.current,
        settings: mySettings,
        time: timeRemainingRef.current,
      });
    }, META_INTERVAL);

    return () => clearInterval(intervalId);
  }, [matchStarted, sendMetaUpdate]);

  // Fallback: Full update for game over state
  useEffect(() => {
    if (!matchStarted || !gameState) return;
    
    if (gameState.isGameOver) {
      const boardForServer = gameState.board.map(row => 
        row.map(cell => cell ? 1 : 0)
      );
      sendGameUpdate({
        lines: gameState.linesCleared,
        score: gameState.score,
        board: boardForServer,
        gameOver: true,
        time: timeRemaining,
      });
    }
  }, [matchStarted, gameState?.isGameOver, sendGameUpdate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!matchStarted || matchResult || !gameState || gameState.isGameOver) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          moveLeft();
          sendInputAction('moveLeft');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          moveRight();
          sendInputAction('moveRight');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          moveDown();
          sendInputAction('moveDown');
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          rotate();
          sendInputAction('rotate');
          break;
        case 'z':
        case 'Z':
          e.preventDefault();
          rotateLeft();
          sendInputAction('rotateLeft');
          break;
        case 'x':
        case 'X':
          e.preventDefault();
          rotateRight();
          sendInputAction('rotateRight');
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          sendInputAction('hardDrop');
          break;
        case 'Shift':
        case 'c':
        case 'C':
          e.preventDefault();
          holdPiece();
          sendInputAction('holdPiece');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [matchStarted, matchResult, gameState, moveLeft, moveRight, moveDown, rotate, rotateLeft, rotateRight, hardDrop, holdPiece, sendInputAction]);

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
    navigateTo('casual-lobby');
  };

  const handleGoHome = () => {
    disconnect();
    navigateTo('landing');
  };

  const currentMode = match?.gameMode || gameMode || 'marathon';
  const modeInfo = MODE_DISPLAY_INFO[currentMode];
  const targetLines = match?.targetLines || 0;
  const playerProgress = targetLines > 0 ? (gameState?.linesCleared || 0) / targetLines * 100 : 0;
  const opponentProgress = targetLines > 0 ? opponentState.lines / targetLines * 100 : 0;

  const getModeIcon = (mode: CasualGameMode) => {
    switch (mode) {
      case 'marathon': return <Target className="w-5 h-5 text-primary" />;
      case 'sprint': return <FastForward className="w-5 h-5 text-yellow-400" />;
      case 'ultra': return <Timer className="w-5 h-5 text-orange-400" />;
      case 'zen': return <InfinityIcon className="w-5 h-5 text-purple-400" />;
    }
  };

  const getModeGoalText = () => {
    switch (currentMode) {
      case 'marathon':
        return t('casual.raceToLines', 'Race to {{lines}} Lines', { lines: targetLines });
      case 'sprint':
        return t('casual.raceToLines', 'Race to {{lines}} Lines', { lines: targetLines });
      case 'ultra':
        return t('casual.highestScore', 'Highest Score in {{time}}s', { time: match?.timeLimit || 120 });
      case 'zen':
        return t('casual.zenMode', 'Play Together - No Win Condition');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Memoize opponent game state to prevent creating new objects on every render
  const opponentGameState = useMemo(() => {
    const pieceData = interpolatedPiece ? {
      type: interpolatedPiece.type,
      x: Math.round(interpolatedPiece.displayX),
      y: Math.round(interpolatedPiece.displayY),
      rotation: interpolatedPiece.rotation,
      shape: interpolatedPiece.shape,
    } : opponentState.currentPiece;
    
    return createOpponentGameState(
      opponentState.board, 
      opponentState.score, 
      opponentState.lines, 
      pieceData
    );
  }, [opponentState.board, opponentState.score, opponentState.lines, opponentState.currentPiece, interpolatedPiece]);

  const pendingOpponentStateRef = useRef<any>(null);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rendererMountTimeRef = useRef<number>(0);
  const RENDERER_INIT_GRACE_MS = 500;
  
  useEffect(() => {
    if (opponentRendererReady) {
      rendererMountTimeRef.current = Date.now();
    }
  }, [opponentRendererReady]);
  
  useEffect(() => {
    if (!opponentRendererReady || !opponentGameState) return;
    
    const timeSinceMount = Date.now() - rendererMountTimeRef.current;
    if (timeSinceMount < RENDERER_INIT_GRACE_MS) {
      return;
    }
    
    pendingOpponentStateRef.current = opponentGameState;
    
    if (throttleTimerRef.current !== null) return;
    
    const now = Date.now();
    const elapsed = now - lastOpponentUpdateRef.current;
    const THROTTLE_MS = 100;
    
    if (elapsed >= THROTTLE_MS) {
      lastOpponentUpdateRef.current = now;
      updateCounterRef.current.render++;
      setThrottledOpponentGameState(opponentGameState);
    } else {
      throttleTimerRef.current = setTimeout(() => {
        throttleTimerRef.current = null;
        if (pendingOpponentStateRef.current) {
          lastOpponentUpdateRef.current = Date.now();
          updateCounterRef.current.render++;
          setThrottledOpponentGameState(pendingOpponentStateRef.current);
        }
      }, THROTTLE_MS - elapsed);
    }
  }, [opponentGameState, opponentRendererReady]);

  // Memoize camera to prevent infinite re-renders in GameRenderer3D
  // Only create new object when camera values actually change
  const memoizedCamera = useMemo(() => {
    const cam = opponentState.camera;
    if (!cam) return undefined;
    return cam;
  }, [
    opponentState.camera?.position.x,
    opponentState.camera?.position.y,
    opponentState.camera?.position.z,
    opponentState.camera?.target.x,
    opponentState.camera?.target.y,
    opponentState.camera?.target.z,
  ]);

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
        <div 
          className="hidden md:block flex-shrink-0 transition-all duration-300 ease-out" 
          style={{ width: expanded ? `${240 - 16}px` : `${128 - 16}px` }}
        />

        {countdown !== null && countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/60">
            <div className="text-center">
              <div className="text-8xl font-bold text-primary animate-pulse mb-4">
                {countdown}
              </div>
              <div className="text-xl text-muted-foreground">
                {t('casual.getReady', 'Get Ready!')}
              </div>
            </div>
          </div>
        )}

        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30">
          <div className="backdrop-blur-md bg-card/80 rounded-b-lg px-6 py-2 border border-t-0 border-white/10 flex items-center gap-4">
            {getModeIcon(currentMode)}
            <span className="font-semibold">{getModeGoalText()}</span>
            {currentMode === 'ultra' && (
              <Badge variant="outline" className="text-orange-400 border-orange-400/50">
                <Timer className="w-3 h-3 mr-1" />
                {formatTime(timeRemaining)}
              </Badge>
            )}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleForfeit}
              disabled={!!matchResult}
              data-testid="button-forfeit"
            >
              <Flag className="w-4 h-4 mr-1" />
              {t('casual.forfeit', 'Forfeit')}
            </Button>
          </div>
        </div>

        <div className="hidden md:flex w-48 flex-col gap-3 flex-shrink-0">
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
                    {t('casual.you', 'You')}
                  </Badge>
                </div>
              </div>
              {currentMode !== 'zen' && targetLines > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{t('casual.lines', 'Lines')}</span>
                    <span className="text-xl font-bold text-primary">{gameState?.linesCleared || 0}/{targetLines}</span>
                  </div>
                  <Progress value={playerProgress} className="h-2" />
                </>
              )}
              {currentMode === 'ultra' && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('casual.score', 'Score')}</span>
                  <span className="text-xl font-bold text-primary">{gameState?.score?.toLocaleString() || 0}</span>
                </div>
              )}
              {currentMode === 'zen' && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('casual.lines', 'Lines')}</span>
                  <span className="text-xl font-bold text-primary">{gameState?.linesCleared || 0}</span>
                </div>
              )}
            </CardContent>
          </Card>

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

          <Card className="bg-black/80 border-zinc-700">
            <CardContent className="p-3 space-y-2">
              <PiecePreview piece={gameState?.holdPiece} label={t('game.hold', 'Hold').toUpperCase()} compact />
              <PiecePreview piece={gameState?.nextPiece} label={t('game.next', 'Next').toUpperCase()} compact />
            </CardContent>
          </Card>
        </div>

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
                  onCameraChange={handleCameraChange}
                  onDebugLog={sendDebugLog}
                />
              )}
            </ErrorBoundary>
            
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

        <Card className="flex-1 min-w-0 bg-black/80 border-zinc-700 flex flex-col overflow-hidden">
          <CardContent className="flex-1 p-0 relative">
            <div className="absolute top-2 left-2 z-10 bg-black/70 px-3 py-1.5 rounded-lg text-sm backdrop-blur-sm">
              <span className="font-bold text-white">{match?.opponent?.userName || t('casual.opponent', 'Opponent')}</span>
              <span className="ml-3 text-amber-400 font-mono">{opponentState.lines} Lines</span>
              <span className="ml-2 text-zinc-400 font-mono">{opponentState.score.toLocaleString()} pts</span>
            </div>
            {/* Opponent view - 3D with liteMode (auto-fallback to 2D on performance issues or context loss) */}
            {opponentRendererReady && throttledOpponentGameState && !opponent3DFailed ? (
              <ErrorBoundary componentName="OpponentGameRenderer3D">
                <MemoizedOpponentRenderer
                  gameState={throttledOpponentGameState}
                  blockTexture={(opponentState.settings?.blockTexture as BlockTexture) || 'default'}
                  backgroundColor={opponentState.settings?.backgroundColor || '#000000'}
                  gridMaterial={(opponentState.settings?.gridMaterial as any) || 'default'}
                  boardMaterial={(opponentState.settings?.boardMaterial as any) || 'default'}
                  onContextLost={() => {
                    console.log('[CasualMatch] Opponent WebGL context lost, falling back to 2D');
                    sendDebugLog('CasualMatch', 'context_lost_fallback', {});
                    setOpponent3DFailed(true);
                    setOpponentRendererReady(false);
                  }}
                />
              </ErrorBoundary>
            ) : opponentGameState ? (
              <div className="w-full h-full bg-gradient-to-b from-zinc-900 to-black p-3 flex items-center justify-center rounded-lg">
                <OpponentBoard2D gameState={opponentGameState} />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-black/50">
                <div className="text-center text-muted-foreground">
                  <div className="animate-pulse">{t('casual.loadingOpponent', 'Loading opponent view...')}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="hidden md:flex w-48 flex-col gap-3 flex-shrink-0">
          <Card className="bg-black/80 border-zinc-700">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={match?.opponent?.userProfileImage || undefined} />
                  <AvatarFallback>{match?.opponent?.userName?.[0] || 'O'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{match?.opponent?.userName || t('casual.opponent', 'Opponent')}</div>
                </div>
              </div>
              {currentMode !== 'zen' && targetLines > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{t('casual.lines', 'Lines')}</span>
                    <span className="text-xl font-bold text-amber-400">{opponentState.lines}/{targetLines}</span>
                  </div>
                  <Progress value={opponentProgress} className="h-2" />
                </>
              )}
              {currentMode === 'ultra' && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('casual.score', 'Score')}</span>
                  <span className="text-xl font-bold text-amber-400">{opponentState.score.toLocaleString()}</span>
                </div>
              )}
              {currentMode === 'zen' && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('casual.lines', 'Lines')}</span>
                  <span className="text-xl font-bold text-amber-400">{opponentState.lines}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-black/80 border-zinc-700">
            <CardContent className="p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('game.score', 'Score')}</span>
                <span className="font-bold">{opponentState.score.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:hidden absolute top-2 left-2 right-2 z-30 flex justify-between items-start gap-2 pointer-events-none">
          <div className="flex flex-col gap-1 pointer-events-auto">
            <PiecePreview piece={gameState?.holdPiece} label={t('game.hold', 'Hold').toUpperCase()} compact />
            <PiecePreview piece={gameState?.nextPiece} label={t('game.next', 'Next').toUpperCase()} compact />
          </div>
          <div className="flex flex-col gap-1 pointer-events-auto">
            <div className="backdrop-blur-md bg-card/80 rounded-lg p-2 border border-white/10 text-xs">
              <div className="flex flex-col gap-1">
                {currentMode === 'ultra' && (
                  <div className="flex justify-center gap-1 text-orange-400 font-bold">
                    <Timer className="w-3 h-3" />
                    {formatTime(timeRemaining)}
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t('casual.you', 'You')}</span>
                  <span className="font-mono font-bold text-primary">
                    {currentMode === 'ultra' ? gameState?.score?.toLocaleString() || 0 : gameState?.linesCleared || 0}
                    {targetLines > 0 && currentMode !== 'ultra' && `/${targetLines}`}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t('casual.opponent', 'Opp')}</span>
                  <span className="font-mono font-bold text-amber-400">
                    {currentMode === 'ultra' ? opponentState.score.toLocaleString() : opponentState.lines}
                    {targetLines > 0 && currentMode !== 'ultra' && `/${targetLines}`}
                  </span>
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
              {t('casual.forfeit', 'Forfeit')}
            </Button>
          </div>
        </div>
      </main>

      {showAdBanner && <AdBanner data-testid="ad-banner" />}

      {matchResult && showRewardSelection && (
        <RewardSelection 
          onComplete={handleRewardComplete}
          score={gameState.score}
          linesCleared={gameState.linesCleared}
        />
      )}

      {matchResult && !showRewardSelection && (
        <CasualMatchResultModal 
          result={matchResult}
          gameMode={currentMode}
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

function CasualMatchResultModal({ 
  result, 
  gameMode,
  onPlayAgain, 
  onGoHome 
}: { 
  result: CasualMatchEndResult;
  gameMode: CasualGameMode;
  onPlayAgain: () => void;
  onGoHome: () => void;
}) {
  const { t } = useTranslation();

  const getResultIcon = () => {
    if (result.isDraw) return <Shield className="w-20 h-20 mx-auto text-blue-400 mb-4" />;
    if (result.won) return <Trophy className="w-20 h-20 mx-auto text-yellow-500 mb-4" />;
    return <Shield className="w-20 h-20 mx-auto text-gray-400 mb-4" />;
  };

  const getResultTitle = () => {
    if (result.isDraw) return t('casual.draw', 'Draw!');
    if (result.won) return t('casual.victory', 'Victory!');
    return t('casual.defeat', 'Defeat');
  };

  const getResultColor = () => {
    if (result.isDraw) return 'text-blue-400';
    if (result.won) return 'text-green-500';
    return 'text-red-500';
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="p-8 max-w-md w-full space-y-6 animate-in zoom-in-95">
        <div className="text-center">
          {getResultIcon()}
          <h2 className={`text-3xl font-bold ${getResultColor()}`}>{getResultTitle()}</h2>
          <Badge variant="secondary" className="mt-2">
            {MODE_DISPLAY_INFO[gameMode].name}
          </Badge>
          <p className="text-muted-foreground mt-2">{result.reason}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-primary">{result.yourStats.lines}</div>
            <div className="text-sm text-muted-foreground">{t('casual.yourLines', 'Your Lines')}</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-amber-400">{result.opponentStats.lines}</div>
            <div className="text-sm text-muted-foreground">{t('casual.oppLines', 'Opp Lines')}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-primary">{result.yourStats.score.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">{t('casual.yourScore', 'Your Score')}</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-amber-400">{result.opponentStats.score.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">{t('casual.oppScore', 'Opp Score')}</div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-center justify-center">
            <span className="text-2xl font-bold text-cyan-500">+{result.xpEarned} XP</span>
          </div>
        </div>

        <div className="flex gap-4">
          <Button className="flex-1" variant="outline" onClick={onGoHome} data-testid="button-go-home">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('nav.home', 'Home')}
          </Button>
          <Button className="flex-1" onClick={onPlayAgain} data-testid="button-play-again">
            <Zap className="w-4 h-4 mr-2" />
            {t('casual.playAgain', 'Play Again')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
