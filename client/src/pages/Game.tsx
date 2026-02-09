import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigation } from '@/contexts/NavigationContext';
import { useGame } from '@/contexts/GameContext';
import { useBlockGame } from '@/hooks/use-game';
import { GameRenderer3D } from '@/components/game/GameRenderer3D';
import { ScoreFeedback } from '@/components/game/ScoreFeedback';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PiecePreview } from '@/components/game/PiecePreview';
import { GameStats } from '@/components/game/GameStats';
import { GameOverModal } from '@/components/game/GameOverModal';
import { RewardSelection } from '@/components/game/RewardSelection';
import { PauseOverlay } from '@/components/game/PauseOverlay';
import { GameModeSelection } from '@/components/game/GameModeSelection';
import { AdBanner } from '@/components/AdBanner';
import { Header } from '@/components/Header';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SettingsModal } from '@/components/SettingsModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useSidebar } from '@/contexts/SidebarContext';
import { Home, Gamepad2, Loader2, Settings, Timer, Target, Shovel, Heart, Hand, Play, Pause, Box } from 'lucide-react';
import { BlockTexture, PlacedDecorations } from '@shared/schema';
import { soundManager } from '@/lib/sound-manager';
import { GameMode, GameDifficulty, GameEngine, GAME_MODE_CONFIGS, DIFFICULTY_CONFIGS } from '@/lib/game-engine';
import { Progress } from '@/components/ui/progress';
import { useTranslation } from 'react-i18next';
import { useCasualMatchmaking, CasualGameMode } from '@/hooks/use-casual-matchmaking';

export default function Game() {
  const [gameType, setGameType] = useState<'single' | 'multi'>('single');
  const [isRotating, setIsRotating] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRewardSelection, setShowRewardSelection] = useState(false);
  const [rewardsClaimed, setRewardsClaimed] = useState(false);
  const selectedEngine: GameEngine = 'classic';
  const prevLinesRef = useRef(0);
  const prevBoardRef = useRef<string | null>(null);
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { navigateTo } = useNavigation();
  const { isPlaying, setIsPlaying, setGamePieces } = useGame();
  const { expanded, notificationOpen, languageOpen, profileOpen } = useSidebar();
  const anyPanelOpen = notificationOpen || languageOpen || profileOpen;

  const { data: settings } = useQuery<{ blockTexture: BlockTexture; backgroundColor: string; gridColor: string; invertX: boolean; invertY: boolean; mouseSensitivity: number; wheelSensitivity: number; gameEngine: GameEngine; showPet: boolean; selectedPets: string[]; gridMaterial: string; boardMaterial: string; viewMode: '2d' | '3d'; equippedDecorations: string; placedDecorations: string }>({
    queryKey: ["/api/settings"],
    enabled: isAuthenticated,
  });

  // Check premium status for ad display
  const { data: profile } = useQuery<{ isPremium: boolean }>({
    queryKey: ["/api/profile"],
    enabled: isAuthenticated,
  });
  const isPremium = profile?.isPremium ?? false;
  const showAdBanner = hasStarted && !isPremium;

  // Casual matchmaking for multiplayer - memoize options to prevent infinite re-renders
  const casualMatchmakingOptions = useMemo(() => ({
    onMatchEnd: (result: any) => {
      console.log('[casual] Match ended:', result);
    },
  }), []);
  const casualMatchmaking = useCasualMatchmaking(casualMatchmakingOptions);

  // Handle match found - show match UI
  const isInCasualMatch = casualMatchmaking.status === 'in_match' && casualMatchmaking.match;

  const {
    gameState,
    startTime,
    playTimeRef,
    currentMode,
    currentDifficulty,
    isAnimating,
    startGame,
    resetGame,
    moveLeft,
    moveRight,
    moveDown,
    rotate,
    hardDrop,
    holdPiece,
    togglePause,
    activateZone,
  } = useBlockGame(selectedEngine);

  const blockTexture: BlockTexture = settings?.blockTexture || 'default';
  const backgroundColor: string = settings?.backgroundColor || '#000000';
  const gridColor: string = settings?.gridColor || '#ffffff';
  const invertX: boolean = settings?.invertX ?? false;
  const invertY: boolean = settings?.invertY ?? false;
  const mouseSensitivity: number = settings?.mouseSensitivity ?? 50;
  const wheelSensitivity: number = settings?.wheelSensitivity ?? 50;
  const showPet: boolean = settings?.showPet ?? false;
  const selectedPets: string[] = settings?.selectedPets ?? ['pet_puppy'];
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
  const audioInitializedRef = useRef(false);

  // Initialize audio on first user interaction (required for mobile)
  const initAudioOnInteraction = () => {
    if (!audioInitializedRef.current) {
      soundManager.initialize();
      audioInitializedRef.current = true;
    }
  };

  // Sync isPlaying with hasStarted on mount/unmount
  useEffect(() => {
    // Sync isPlaying state with hasStarted
    setIsPlaying(hasStarted);
    
    return () => {
      setIsPlaying(false);
      setGamePieces({ holdPiece: null, nextPiece: null, pieceQueue: [] });
    };
  }, [hasStarted, setIsPlaying, setGamePieces]);

  // Update game pieces in context for sidebar display
  useEffect(() => {
    if (hasStarted) {
      setGamePieces({
        holdPiece: gameState.holdPiece,
        nextPiece: gameState.nextPiece,
        pieceQueue: gameState.pieceQueue
      });
    }
  }, [hasStarted, gameState.holdPiece, gameState.nextPiece, gameState.pieceQueue, setGamePieces]);

  // Wrap mobile control handlers to initialize audio
  const handleMobileAction = (action: () => void) => {
    initAudioOnInteraction();
    action();
  };

  useEffect(() => {
    const currentLines = gameState.linesCleared;
    if (currentLines > prevLinesRef.current && hasStarted) {
      soundManager.playLineClear(blockTexture);
    }
    prevLinesRef.current = currentLines;
  }, [gameState.linesCleared, blockTexture, hasStarted]);

  useEffect(() => {
    if (!hasStarted || gameState.isPaused || gameState.isGameOver) return;
    
    const boardHash = JSON.stringify(gameState.board);
    
    if (prevBoardRef.current && prevBoardRef.current !== boardHash) {
      const prevBoard = JSON.parse(prevBoardRef.current);
      let blocksAdded = false;
      
      for (let y = 0; y < gameState.board.length; y++) {
        for (let x = 0; x < gameState.board[y].length; x++) {
          if (gameState.board[y][x] && !prevBoard[y][x]) {
            blocksAdded = true;
            break;
          }
        }
        if (blocksAdded) break;
      }
      
      if (blocksAdded && gameState.lastClearedLines.length === 0) {
        soundManager.playBlockPlace(blockTexture);
      }
    }
    
    prevBoardRef.current = boardHash;
  }, [gameState.board, blockTexture, hasStarted, gameState.isPaused, gameState.isGameOver, gameState.lastClearedLines]);

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

  useEffect(() => {
    if (gameState.isGameOver && !scoreSaved) {
      // Save score if player scored anything
      if (gameState.score > 0) {
        if (isAuthenticated) {
          saveScoreMutation.mutate({
            score: gameState.score,
            level: gameState.level,
            linesCleared: gameState.linesCleared,
            playTime: Math.floor(playTimeRef.current / 1000),  // Convert ms to seconds
            gameMode: currentMode,
          });
        } else {
          setScoreSaved(true);
        }
      } else {
        setScoreSaved(true);
      }
      // Always show reward selection when game ends (regardless of score)
      if (!rewardsClaimed) {
        setShowRewardSelection(true);
      }
    }
  }, [gameState.isGameOver, isAuthenticated, scoreSaved, gameState.score, currentMode, gameState.linesCleared, gameState.level, rewardsClaimed]);

  const handleStart = (mode: GameMode, difficulty?: GameDifficulty) => {
    initAudioOnInteraction(); // Initialize audio on game start for mobile
    setHasStarted(true);
    setIsPlaying(true);
    setScoreSaved(false);
    startGame(mode, difficulty);
  };

  const handleRestart = () => {
    initAudioOnInteraction(); // Initialize audio on restart for mobile
    setScoreSaved(false);
    setShowRewardSelection(false);
    setRewardsClaimed(false);
    resetGame();
  };

  const handleRewardComplete = () => {
    setShowRewardSelection(false);
    setRewardsClaimed(true);
  };

  // Navigate to CasualMatch page when match is found
  useEffect(() => {
    // Check for in_match status (match_found immediately becomes in_match)
    if ((casualMatchmaking.status === 'match_found' || casualMatchmaking.status === 'in_match') && casualMatchmaking.match) {
      // Store match info in sessionStorage for CasualMatch to pick up
      sessionStorage.setItem('casualMatchData', JSON.stringify(casualMatchmaking.match));
      // Disconnect WebSocket before navigating to prevent connection conflicts
      casualMatchmaking.disconnect();
      navigateTo('casual-match');
    }
  }, [casualMatchmaking.status, casualMatchmaking.match, casualMatchmaking.disconnect, navigateTo]);

  if (!hasStarted) {
    return (
      <div className="h-screen w-full flex flex-col overflow-hidden">
        <Header />
        
        <main 
          className={`flex-1 overflow-auto transition-all duration-300 ease-out flex gap-2.5 ${anyPanelOpen ? 'blur-md pointer-events-none' : ''}`}
          style={{ 
            paddingTop: '0.8rem',
            paddingRight: '1rem',
            paddingBottom: '0.8rem',
            paddingLeft: '1rem'
          }}
        >
          {/* Desktop sidebar spacing */}
          <div 
            className="hidden md:block flex-shrink-0 transition-all duration-300 ease-out" 
            style={{ width: expanded ? `${240 - 16}px` : `${88 - 16}px` }}
          />
          {/* Content area */}
          <div className="flex-1 flex flex-col gap-2.5 min-w-0">
          {/* Header Card */}
          <Card className="flex-shrink-0 bg-black/80 border-zinc-700">
            <CardContent className="p-3.5 px-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Gamepad2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold">{t('game.title', 'Game')}</h1>
                    <p className="text-sm text-muted-foreground">{t('game.controls')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Single/Multi Tabs */}
                  <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-white/5">
                    <button
                      onClick={() => {
                        if (gameType === 'multi') {
                          casualMatchmaking.leaveQueue();
                        }
                        setGameType('single');
                      }}
                      className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        gameType === 'single'
                          ? 'bg-primary text-primary-foreground shadow-lg'
                          : 'text-muted-foreground hover:text-white'
                      }`}
                    >
                      {t('game.single', '싱글')}
                    </button>
                    <button
                      onClick={() => setGameType('multi')}
                      className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        gameType === 'multi'
                          ? 'bg-primary text-primary-foreground shadow-lg'
                          : 'text-muted-foreground hover:text-white'
                      }`}
                      data-testid="button-multi"
                    >
                      {t('game.multi', '멀티')}
                    </button>
                  </div>
                  
                  {isAuthenticated && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSettings(true)}
                      className="gap-2"
                      data-testid="button-settings-pregame"
                    >
                      <Settings className="w-4 h-4" />
                      {t('settings.title', 'Settings')}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Game Selection Card */}
          <Card className="flex-1 min-h-0 bg-black/80 border-zinc-700 overflow-hidden">
            <CardContent className="p-4 h-full flex flex-col">
              {/* Game Mode Selection */}
              <div className="flex-1">
                <GameModeSelection 
                  onSelectMode={handleStart}
                  gameType={gameType}
                  matchmakingStatus={casualMatchmaking.status}
                  matchmakingQueueTime={casualMatchmaking.queueTime}
                  onJoinQueue={(mode) => casualMatchmaking.joinQueue(mode as CasualGameMode)}
                  onLeaveQueue={() => casualMatchmaking.leaveQueue()}
                />
              </div>
            </CardContent>
          </Card>
          </div>
        </main>

        <SettingsModal 
          open={showSettings} 
          onOpenChange={setShowSettings} 
        />
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
        {/* Game Panel - Left */}
        <Card className="flex-1 min-w-0 bg-black/80 border-zinc-700 flex flex-col overflow-hidden">
          <CardContent className="flex-1 p-0 relative">
            <ErrorBoundary componentName="GameRenderer3D">
              <GameRenderer3D 
                gameState={gameState} 
                onRotatingChange={setIsRotating}
                blockTexture={blockTexture}
                backgroundColor={backgroundColor}
                gridColor={gridColor}
                invertX={invertX}
                invertY={invertY}
                mouseSensitivity={mouseSensitivity}
                wheelSensitivity={wheelSensitivity}
                engine={selectedEngine}
                showPet={showPet}
                selectedPets={selectedPets}
                gridMaterial={gridMaterial as any}
                boardMaterial={boardMaterial as any}
                viewMode={viewMode}
                equippedDecorations={equippedDecorations}
                placedDecorations={placedDecorations}
              />
            </ErrorBoundary>
            
            {/* Score Feedback Overlay */}
            <ScoreFeedback
              actionType={gameState.lastActionType}
              scoreGain={gameState.lastScoreGain}
              combo={gameState.combo}
              wasB2BApplied={gameState.wasB2BApplied}
              backToBack={gameState.backToBack}
              isPerfectClear={gameState.isPerfectClear}
            />
          </CardContent>
        </Card>

        {/* Info Panel - Right (Desktop only) */}
        <div className="hidden md:flex w-64 flex-col gap-3 flex-shrink-0">
          {/* Mode & Controls Header */}
          <Card className="bg-black/80 border-zinc-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Badge variant="secondary" className="text-xs">
                  {t(`modes.${currentMode}`)}
                  {currentDifficulty && (
                    <span className="ml-1">({t(`difficulty.${currentDifficulty}`)})</span>
                  )}
                </Badge>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSettings(true)}
                    data-testid="button-settings"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <ThemeToggle />
                </div>
              </div>
              
              {/* Mode-specific info */}
              <div className="space-y-2 text-sm">
                {currentMode === 'ultra' && (
                  <div className="flex items-center gap-2">
                    <Timer className={`w-4 h-4 ${gameState.timeRemaining <= 30 ? 'text-red-500' : 'text-muted-foreground'}`} />
                    <span className={`font-mono font-bold ${gameState.timeRemaining <= 30 ? 'text-red-500' : ''}`}>
                      {Math.floor(gameState.timeRemaining / 60)}:{(gameState.timeRemaining % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                )}
                {currentMode === 'sprint' && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{t('game.lines')}:</span>
                    <span className="font-mono font-bold text-primary">{gameState.linesCleared}/40</span>
                  </div>
                )}
                {currentMode === 'marathon' && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{t('game.lines')}:</span>
                    <span className="font-mono font-bold">{gameState.linesCleared}/150</span>
                  </div>
                )}
                {(currentMode === 'dig' || currentMode === 'survival') && (
                  <div className="flex items-center gap-2">
                    <Shovel className="w-4 h-4 text-amber-400" />
                    <span className="font-mono font-bold text-amber-400">{gameState.garbageCleared}</span>
                  </div>
                )}
                {currentMode === 'survival' && (
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-rose-400" />
                    <span className="font-mono font-bold">
                      {Math.floor(playTimeRef.current / 60000)}:{(Math.floor(playTimeRef.current / 1000) % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                )}
                {currentMode === 'zone' && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Target className={`w-4 h-4 ${gameState.isZoneActive ? 'text-cyan-400 animate-pulse' : 'text-muted-foreground'}`} />
                      <div className="flex-1">
                        <Progress 
                          value={(gameState.zoneEnergy / gameState.zoneMaxEnergy) * 100} 
                          className="h-2"
                        />
                      </div>
                    </div>
                    {gameState.isZoneActive && (
                      <span className="font-mono font-bold text-cyan-400">{gameState.zoneTimeRemaining}s</span>
                    )}
                    {!gameState.isZoneActive && gameState.zoneEnergy >= gameState.zoneMaxEnergy && (
                      <span className="text-xs text-cyan-400">{t('game.pressZ')}</span>
                    )}
                  </div>
                )}
                {currentMode === 'master' && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{t('game.level')}:</span>
                    <span className="font-mono font-bold text-yellow-400">{gameState.level}/1000</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Game Stats Panel */}
          <Card className="flex-1 bg-black/80 border-zinc-700 overflow-auto">
            <CardContent className="p-4">
              <GameStats gameState={gameState} startTime={startTime} isPaused={gameState.isPaused} />
            </CardContent>
          </Card>

          {/* Pause/Resume Button */}
          <Card className="bg-black/80 border-zinc-700">
            <CardContent className="p-3">
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={togglePause}
                data-testid="button-pause"
              >
                {gameState.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {gameState.isPaused ? t('game.resume', 'Resume') : t('game.pause', 'Pause')}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Mobile Overlay Info */}
        <div className="md:hidden absolute top-2 left-2 right-2 z-30 flex justify-between items-start gap-2 pointer-events-none">
          <div className="flex flex-col gap-1 pointer-events-auto">
            <PiecePreview piece={gameState.holdPiece} label={t('game.hold').toUpperCase()} compact />
            <PiecePreview piece={gameState.nextPiece} label={t('game.next').toUpperCase()} compact />
            {gameState.pieceQueue.slice(1, 3).map((piece, index) => (
              <PiecePreview key={index} piece={piece} size="sm" compact />
            ))}
          </div>
          <div className="flex flex-col gap-1 pointer-events-auto">
            <div className="backdrop-blur-md bg-card/80 rounded-lg p-2 border border-white/10 text-xs">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t('game.score').toUpperCase()}</span>
                  <span className="font-mono font-bold text-primary">{gameState.score.toLocaleString()}</span>
                </div>
                <div className="flex gap-4">
                  <div>
                    <span className="text-muted-foreground">{t('game.level').substring(0, 2).toUpperCase()}</span>
                    <span className="font-mono font-bold ml-1">{gameState.level}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('game.lines').toUpperCase()}</span>
                    <span className="font-mono font-bold ml-1">{gameState.linesCleared}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile bottom nav controls */}
      <div className="md:hidden flex-shrink-0 bg-background/95 backdrop-blur-md border-t border-white/10 py-3 px-4 z-40">
        <div className="flex justify-center items-center gap-3">
          <Button 
            variant="outline" 
            size="icon" 
            className={`w-12 h-12 transition-opacity ${isAnimating ? 'opacity-40' : ''}`}
            onClick={() => handleMobileAction(moveLeft)} 
            disabled={isAnimating}
            data-testid="mobile-left"
          >
            <span className="sr-only">{t('game.left', 'Left')}</span>
            <span className="text-xl">←</span>
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className={`w-12 h-12 transition-opacity ${isAnimating ? 'opacity-40' : ''}`}
            onClick={() => handleMobileAction(moveDown)} 
            disabled={isAnimating}
            data-testid="mobile-down"
          >
            <span className="sr-only">{t('game.down', 'Down')}</span>
            <span className="text-xl">↓</span>
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className={`w-12 h-12 transition-opacity ${isAnimating ? 'opacity-40' : ''}`}
            onClick={() => handleMobileAction(moveRight)} 
            disabled={isAnimating}
            data-testid="mobile-right"
          >
            <span className="sr-only">{t('game.right', 'Right')}</span>
            <span className="text-xl">→</span>
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className={`w-12 h-12 transition-opacity ${isAnimating ? 'opacity-40' : ''}`}
            onClick={() => handleMobileAction(rotate)} 
            disabled={isAnimating}
            data-testid="mobile-rotate"
          >
            <span className="sr-only">{t('game.rotate', 'Rotate')}</span>
            <span className="text-xl">↻</span>
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className={`w-12 h-12 transition-opacity ${isAnimating ? 'opacity-40' : ''}`}
            onClick={() => handleMobileAction(hardDrop)} 
            disabled={isAnimating}
            data-testid="mobile-drop"
          >
            <span className="sr-only">{t('game.drop', 'Drop')}</span>
            <span className="text-xl">⬇</span>
          </Button>
          
          <div className="w-px h-10 bg-white/20 mx-1" />
          
          <Button 
            variant="outline" 
            size="icon" 
            className={`w-12 h-12 transition-opacity ${isAnimating ? 'opacity-40' : ''}`}
            onClick={() => handleMobileAction(holdPiece)} 
            disabled={isAnimating}
            data-testid="mobile-hold"
          >
            <span className="sr-only">{t('game.hold', 'Hold')}</span>
            <Hand className="w-5 h-5" />
          </Button>
          <Button variant="outline" size="icon" className="w-12 h-12" onClick={() => handleMobileAction(togglePause)} data-testid="mobile-pause">
            <span className="sr-only">{t('game.pause', 'Pause')}</span>
            {gameState.isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Ad Banner at bottom - only show during game for non-premium users */}
      {showAdBanner && (
        <div className="flex-shrink-0">
          <AdBanner />
        </div>
      )}

      {gameState.isPaused && !gameState.isGameOver && (
        <PauseOverlay onResume={togglePause} />
      )}

      {gameState.isGameOver && showRewardSelection && (
        <RewardSelection 
          onComplete={handleRewardComplete} 
          score={gameState.score}
          linesCleared={gameState.linesCleared}
        />
      )}

      {gameState.isGameOver && !showRewardSelection && (
        <GameOverModal
          gameState={gameState}
          playTimeMs={playTimeRef.current}
          onRestart={handleRestart}
        />
      )}

      <SettingsModal 
        open={showSettings} 
        onOpenChange={setShowSettings} 
      />
    </div>
  );
}
