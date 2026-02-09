import { useState, useEffect, useRef } from 'react';
import { useNavigation } from '@/contexts/NavigationContext';
import { useGame } from '@/contexts/GameContext';
import { useBlockGame } from '@/hooks/use-game';
import { GameRenderer3D } from '@/components/game/GameRenderer3D';
import { useGPUSand } from '@/hooks/use-gpu-sand';
import { PiecePreview } from '@/components/game/PiecePreview';
import { GameStats } from '@/components/game/GameStats';
import { GameOverModal } from '@/components/game/GameOverModal';
import { PauseOverlay } from '@/components/game/PauseOverlay';
import { RewardSelection } from '@/components/game/RewardSelection';
import { AdBanner } from '@/components/AdBanner';
import { Header } from '@/components/Header';
import { SettingsModal } from '@/components/SettingsModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useSidebar } from '@/contexts/SidebarContext';
import { Home, Loader2, Settings, Play, Pause, Trophy, Zap, ArrowLeft, Swords, Hand, Droplets, Mountain } from 'lucide-react';
import { BlockTexture, PlacedDecorations } from '@shared/schema';
import { soundManager } from '@/lib/sound-manager';
import { GameMode, GameEngine, GAME_MODE_CONFIGS } from '@/lib/game-engine';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTranslation } from 'react-i18next';

type WildMatchMode = 'marathon' | 'sprint';
type WildMatchEngine = 'gravity' | 'sand';

export default function WildMatch() {
  const [isRotating, setIsRotating] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRewardSelection, setShowRewardSelection] = useState(false);
  const [rewardsClaimed, setRewardsClaimed] = useState(false);
  const [selectedMode, setSelectedMode] = useState<WildMatchMode | null>(null);
  const [selectedEngine, setSelectedEngine] = useState<WildMatchEngine | null>(null);
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

  const { data: settings } = useQuery<{ blockTexture: BlockTexture; backgroundColor: string; gridColor: string; invertX: boolean; invertY: boolean; mouseSensitivity: number; wheelSensitivity: number; gameEngine: GameEngine; gridMaterial: string; boardMaterial: string; viewMode: '2d' | '3d'; equippedDecorations: string; placedDecorations: string }>({
    queryKey: ["/api/settings"],
    enabled: isAuthenticated,
  });

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
  } = useBlockGame(selectedEngine || 'gravity');

  const isSandMode = selectedEngine === 'sand';
  const { sandPoints, addPieceToSand, clearAllSand, isSettled, particleCount, update: updateSand, setRenderer } = useGPUSand(isSandMode && hasStarted);

  const blockTexture: BlockTexture = settings?.blockTexture || 'default';
  const backgroundColor: string = settings?.backgroundColor || '#000000';
  const gridColor: string = settings?.gridColor || '#ffffff';
  const invertX: boolean = settings?.invertX ?? false;
  const invertY: boolean = settings?.invertY ?? false;
  const mouseSensitivity: number = settings?.mouseSensitivity ?? 50;
  const wheelSensitivity: number = settings?.wheelSensitivity ?? 50;
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

  const initAudioOnInteraction = () => {
    if (!audioInitializedRef.current) {
      soundManager.initialize();
      audioInitializedRef.current = true;
    }
  };

  // Reset isPlaying when component unmounts
  useEffect(() => {
    return () => {
      setIsPlaying(false);
      setGamePieces({ holdPiece: null, nextPiece: null, pieceQueue: [] });
    };
  }, [setIsPlaying, setGamePieces]);

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

  useEffect(() => {
    const currentLines = gameState.linesCleared;
    if (currentLines > prevLinesRef.current && hasStarted) {
      soundManager.playLineClear(blockTexture);
    }
    prevLinesRef.current = currentLines;
  }, [gameState.linesCleared, hasStarted, blockTexture]);

  useEffect(() => {
    if (hasStarted && gameState.board && !gameState.isGameOver) {
      const boardStr = JSON.stringify(gameState.board);
      const blocksAdded = prevBoardRef.current !== null && prevBoardRef.current !== boardStr;
      prevBoardRef.current = boardStr;
      
      if (blocksAdded && gameState.lastClearedLines.length === 0) {
        soundManager.playBlockPlace(blockTexture);
      }
    }
  }, [gameState.board, gameState.isGameOver, hasStarted, blockTexture, gameState.lastClearedLines]);

  // Track landed pieces for sand physics
  const prevLandedPieceRef = useRef<typeof gameState.lastLandedPiece | null>(null);
  
  useEffect(() => {
    if (isSandMode && hasStarted && !gameState.isGameOver && gameState.lastLandedPiece) {
      // Check if this is a new landed piece
      const prevPiece = prevLandedPieceRef.current;
      const newPiece = gameState.lastLandedPiece;
      const isNewPiece = !prevPiece || 
        prevPiece.position.x !== newPiece.position.x || 
        prevPiece.position.y !== newPiece.position.y ||
        prevPiece.type !== newPiece.type;
      
      if (isNewPiece && gameState.lastClearedLines.length === 0) {
        console.log('[Sand Physics] Adding piece to physics world:', newPiece.type, 'at', newPiece.position);
        addPieceToSand(newPiece);
      }
      prevLandedPieceRef.current = newPiece;
    }
  }, [gameState.lastLandedPiece, gameState.lastClearedLines, isSandMode, hasStarted, gameState.isGameOver, addPieceToSand]);

  // Score submission mutation
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

  // Handle game over - save score and show rewards
  useEffect(() => {
    if (gameState.isGameOver && hasStarted && !scoreSaved) {
      // Save score if player scored anything
      if (gameState.score > 0) {
        if (isAuthenticated) {
          saveScoreMutation.mutate({
            score: gameState.score,
            level: gameState.level,
            linesCleared: gameState.linesCleared,
            playTime: Math.floor(playTimeRef.current / 1000),  // Convert ms to seconds
            gameMode: selectedMode || 'marathon',
          });
        } else {
          setScoreSaved(true);
        }
      } else {
        setScoreSaved(true);
      }
      // Always show reward selection when game ends
      if (!rewardsClaimed) {
        setShowRewardSelection(true);
      }
    }
  }, [gameState.isGameOver, hasStarted, scoreSaved, gameState.score, selectedMode, gameState.linesCleared, gameState.level, rewardsClaimed, isAuthenticated]);

  const handleRewardComplete = () => {
    setShowRewardSelection(false);
    setRewardsClaimed(true);
  };

  const handleSelectEngine = (engine: WildMatchEngine) => {
    initAudioOnInteraction();
    setSelectedEngine(engine);
  };

  const handleStartGame = (mode: WildMatchMode) => {
    initAudioOnInteraction();
    setSelectedMode(mode);
    setHasStarted(true);
    setIsPlaying(true);
    setScoreSaved(false);
    prevLinesRef.current = 0;
    prevBoardRef.current = null;
    prevLandedPieceRef.current = null;
    if (isSandMode) {
      clearAllSand();
    }
    startGame(mode);
  };

  const handleRestart = () => {
    if (selectedMode) {
      initAudioOnInteraction();
      setScoreSaved(false);
      setShowRewardSelection(false);
      setRewardsClaimed(false);
      prevLinesRef.current = 0;
      prevBoardRef.current = null;
      prevLandedPieceRef.current = null;
      if (isSandMode) {
        clearAllSand();
      }
      resetGame();
      startGame(selectedMode);
    }
  };

  const handleBackToModeSelection = () => {
    setHasStarted(false);
    setIsPlaying(false);
    setSelectedMode(null);
    setScoreSaved(false);
    resetGame();
  };

  const handleBackToEngineSelection = () => {
    setSelectedEngine(null);
    setSelectedMode(null);
    setHasStarted(false);
    setIsPlaying(false);
    setScoreSaved(false);
    resetGame();
  };

  const handleMobileAction = (action: () => void) => {
    if (!gameState.isPaused && !gameState.isGameOver && !isAnimating) {
      action();
    }
  };

  // Engine selection screen
  if (!selectedEngine) {
    return (
      <div className="min-h-screen bg-background text-foreground overflow-y-auto">
        <Header />
        <main className={`pt-20 pb-24 transition-all duration-300 ${expanded && !anyPanelOpen ? 'pl-64' : 'pl-20'} ${anyPanelOpen ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="flex items-center gap-4 mb-8">
              <Button 
                variant="ghost" 
                size="icon" 
                data-testid="button-back-home"
                onClick={() => navigateTo('landing')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <Swords className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-display font-bold">{t('modes.wildMatch', 'Wild Match')}</h1>
                  <p className="text-sm text-muted-foreground">{t('landing.wildMatchDesc', 'Battle random players')}</p>
                </div>
              </div>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-xl font-bold mb-2">{t('wildMatch.selectEngine', 'Select Game Engine')}</h2>
              <p className="text-muted-foreground">{t('wildMatch.selectEngineDesc', 'Choose your physics engine for unique gameplay')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <Card 
                className="cursor-pointer hover:scale-105 transition-all duration-200 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border-purple-500/30"
                onClick={() => handleSelectEngine('gravity')}
                data-testid="wild-match-gravity-engine"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 rounded-xl bg-black/30 flex items-center justify-center mx-auto mb-4">
                    <Mountain className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t('wildMatch.gravityMode', 'Gravity Mode')}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('wildMatch.gravityModeDesc', 'Blocks fall naturally after line clears. Chain reactions possible!')}
                  </p>
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                    {t('wildMatch.gravityEngine', 'Gravity Engine')}
                  </Badge>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:scale-105 transition-all duration-200 bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border-amber-500/30"
                onClick={() => handleSelectEngine('sand')}
                data-testid="wild-match-sand-engine"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 rounded-xl bg-black/30 flex items-center justify-center mx-auto mb-4">
                    <Droplets className="w-8 h-8 text-amber-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t('wildMatch.sandMode', 'Sand Mode')}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('wildMatch.sandModeDesc', 'Blocks break into particles! Clear lines with matching colors.')}
                  </p>
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                    {t('wildMatch.sandEngine', 'Sand Engine')}
                  </Badge>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Game mode selection screen (after engine is selected)
  if (!hasStarted || !selectedMode) {
    const engineBadgeColor = selectedEngine === 'gravity' 
      ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' 
      : 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    const engineLabel = selectedEngine === 'gravity' 
      ? t('wildMatch.gravityEngine', 'Gravity Engine') 
      : t('wildMatch.sandEngine', 'Sand Engine');

    return (
      <div className="min-h-screen bg-background text-foreground overflow-y-auto">
        <Header />
        <main className={`pt-20 pb-24 transition-all duration-300 ${expanded && !anyPanelOpen ? 'pl-64' : 'pl-20'} ${anyPanelOpen ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="flex items-center gap-4 mb-8">
              <Button 
                variant="ghost" 
                size="icon" 
                data-testid="button-back-engine"
                onClick={handleBackToEngineSelection}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <Swords className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-display font-bold">{t('modes.wildMatch', 'Wild Match')}</h1>
                  <Badge className={engineBadgeColor}>{engineLabel}</Badge>
                </div>
              </div>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-xl font-bold mb-2">{t('wildMatch.selectMode', 'Select Game Mode')}</h2>
              <p className="text-muted-foreground">{t('wildMatch.selectModeDesc', 'Choose your game mode')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <Card 
                className="cursor-pointer hover:scale-105 transition-all duration-200 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30"
                onClick={() => handleStartGame('marathon')}
                data-testid="wild-match-marathon"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 rounded-xl bg-black/30 flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t('modes.marathon', 'Marathon')}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('modes.marathonDesc', 'Survive to level 15 as speed increases. Aim for the highest score!')}
                  </p>
                  <Badge className={engineBadgeColor}>
                    {engineLabel}
                  </Badge>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:scale-105 transition-all duration-200 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/30"
                onClick={() => handleStartGame('sprint')}
                data-testid="wild-match-sprint"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 rounded-xl bg-black/30 flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-8 h-8 text-yellow-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t('modes.sprint', 'Sprint')}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('modes.sprintDesc', 'Clear 40 lines as fast as you can! Time is your only metric')}
                  </p>
                  <Badge className={engineBadgeColor}>
                    {engineLabel}
                  </Badge>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="md:hidden flex-shrink-0">
        <AdBanner />
      </div>
      
      <header className="h-12 flex-shrink-0 backdrop-blur-xl bg-background/80 border-b border-white/10 z-40">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleBackToModeSelection} data-testid="button-back-to-selection">
              <Home className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center">
                <Swords className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="font-display font-bold text-lg tracking-tight hidden sm:block">{t('modes.wildMatch', 'Wild Match')}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-xs">
              {t(`modes.${currentMode}`)}
            </Badge>
            {currentMode === 'sprint' && (
              <div className="text-sm flex items-center gap-1">
                <span className="text-muted-foreground">{t('game.lines')}:</span>
                <span className="font-mono font-bold text-primary">{gameState.linesCleared}/40</span>
              </div>
            )}
            {currentMode === 'marathon' && (
              <div className="text-sm flex items-center gap-1">
                <span className="text-muted-foreground">{t('game.lines')}:</span>
                <span className="font-mono font-bold">{gameState.linesCleared}/150</span>
              </div>
            )}
            <div className="text-sm">
              <span className="text-muted-foreground mr-2">{t('game.score')}:</span>
              <span className="font-mono font-bold text-primary">{gameState.score.toLocaleString()}</span>
            </div>
            <div className="text-sm hidden sm:block">
              <span className="text-muted-foreground mr-2">{t('game.level')}:</span>
              <span className="font-mono font-bold">{gameState.level}</span>
            </div>
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
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <div 
          className={`
            hidden md:flex absolute top-0 z-30 transition-all duration-300 flex-col
            ${isRotating ? 'opacity-30' : 'opacity-100'}
          `}
          style={{ 
            left: expanded ? '256px' : '104px',
            top: '16px',
            bottom: '16px'
          }}
        >
          <div className="bg-card/90 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden h-full flex flex-col">
            <div className="p-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                {t('game.hold')}
              </span>
              <div className="mt-2 flex justify-center">
                <PiecePreview piece={gameState.holdPiece} />
              </div>
            </div>
            <div className="h-px bg-white/10" />
            <div className="p-3 flex-1 overflow-y-auto">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                {t('game.next')}
              </span>
              <div className="mt-2 flex flex-col items-center gap-2">
                <PiecePreview piece={gameState.nextPiece} />
                {gameState.pieceQueue.slice(1).map((piece, index) => (
                  <div key={index}>
                    <div className="h-px w-12 bg-white/5 my-1" />
                    <PiecePreview piece={piece} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 relative">
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
            sandPoints={sandPoints ?? undefined}
            useSandPhysics={isSandMode}
            gridMaterial={gridMaterial as any}
            boardMaterial={boardMaterial as any}
            viewMode={viewMode}
            equippedDecorations={equippedDecorations}
            placedDecorations={placedDecorations}
            onRendererReady={setRenderer}
            onFrame={isSandMode ? updateSand : undefined}
          />
        </div>

        <div 
          className={`
            hidden md:flex absolute right-4 top-4 z-30 w-48 flex-col gap-4 transition-opacity duration-300
            ${isRotating ? 'opacity-30' : 'opacity-100'}
          `}
        >
          <GameStats gameState={gameState} startTime={startTime} isPaused={gameState.isPaused} />
        </div>

        <div className="md:hidden absolute top-2 left-2 right-2 z-30 flex justify-between items-start gap-2">
          <div className="flex flex-col gap-1">
            <PiecePreview piece={gameState.holdPiece} label={t('game.hold').toUpperCase()} compact />
            <PiecePreview piece={gameState.nextPiece} label={t('game.next').toUpperCase()} compact />
          </div>
          <div className="flex flex-col gap-1">
            <div className="backdrop-blur-md bg-card/80 rounded-lg p-2 border border-white/10 text-xs">
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
      </main>

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

      <div className="hidden md:block flex-shrink-0">
        <AdBanner />
      </div>

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

      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}
