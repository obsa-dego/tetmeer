import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigation } from '@/contexts/NavigationContext';
import { useGame } from '@/contexts/GameContext';
import { useBlockGame } from '@/hooks/use-game';
import { GameRenderer3D } from '@/components/game/GameRenderer3D';
import { PiecePreview } from '@/components/game/PiecePreview';
import { ScoreFeedback } from '@/components/game/ScoreFeedback';
import { Header } from '@/components/Header';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { useSidebar } from '@/contexts/SidebarContext';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Monitor, MonitorSmartphone, Activity } from 'lucide-react';
import { BlockTexture, PlacedDecorations } from '@shared/schema';
import { soundManager } from '@/lib/sound-manager';
import { useTranslation } from 'react-i18next';

export default function TestMatch() {
  const { navigateTo } = useNavigation();
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { expanded, notificationOpen, languageOpen, profileOpen } = useSidebar();
  const { setIsPlaying } = useGame();
  const anyPanelOpen = notificationOpen || languageOpen || profileOpen;

  const [matchStarted, setMatchStarted] = useState(false);
  const [opponentRendererReady, setOpponentRendererReady] = useState(false);
  const [fps, setFps] = useState(0);

  const fpsCounterRef = useRef({ frames: 0, lastTime: performance.now() });
  const animFrameRef = useRef<number>(0);

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

  const {
    gameState,
    startGame,
    moveLeft,
    moveRight,
    moveDown,
    rotate,
    rotateLeft,
    rotateRight,
    hardDrop,
    holdPiece,
  } = useBlockGame('classic', { disableKeyHandlers: true });

  useEffect(() => {
    if (matchStarted) {
      setIsPlaying(true);
      return () => setIsPlaying(false);
    }
  }, [matchStarted, setIsPlaying]);

  useEffect(() => {
    if (!matchStarted) {
      setOpponentRendererReady(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      console.log('[TestMatch] Enabling opponent 3D renderer (delayed mount - 2000ms)');
      setOpponentRendererReady(true);
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [matchStarted]);

  useEffect(() => {
    if (!matchStarted) return;

    const countFrame = () => {
      fpsCounterRef.current.frames++;
      const now = performance.now();
      const elapsed = now - fpsCounterRef.current.lastTime;

      if (elapsed >= 1000) {
        const currentFps = Math.round((fpsCounterRef.current.frames * 1000) / elapsed);
        setFps(currentFps);
        fpsCounterRef.current.frames = 0;
        fpsCounterRef.current.lastTime = now;
      }

      animFrameRef.current = requestAnimationFrame(countFrame);
    };

    animFrameRef.current = requestAnimationFrame(countFrame);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [matchStarted]);

  const handleStartTest = () => {
    setMatchStarted(true);
    startGame('marathon', 'normal');
    soundManager.initialize();
  };

  const handleBack = () => {
    navigateTo('casual-lobby');
  };

  useEffect(() => {
    if (!matchStarted || !gameState || gameState.isGameOver) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [matchStarted, gameState, moveLeft, moveRight, moveDown, rotate, rotateLeft, rotateRight, hardDrop, holdPiece]);

  if (!matchStarted) {
    return (
      <div className="h-screen w-full flex flex-col overflow-hidden">
        <Header />
        <main
          className={`flex-1 flex items-center justify-center transition-all duration-300 ease-out ${anyPanelOpen ? 'blur-md pointer-events-none' : ''}`}
          style={{ paddingLeft: expanded ? '240px' : '88px' }}
        >
          <Card className="p-8 max-w-lg w-full space-y-6 bg-black/80 border-zinc-700">
            <div className="flex items-center gap-3 mb-2">
              <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Activity className="w-6 h-6 text-cyan-400" />
                  Dual Renderer Test
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Browser freeze diagnostic tool
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <Monitor className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-foreground">Player View (Left)</span>
                  <p>Full 3D renderer with all effects</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <MonitorSmartphone className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-foreground">Mirror View (Right)</span>
                  <p>liteMode 3D renderer (same as opponent view in multiplayer)</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <Activity className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-foreground">FPS Monitor</span>
                  <p>Real-time frame rate tracking to detect performance drops</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Both renderers show the same game. No network involved. This isolates whether dual 3D rendering causes browser freeze.
            </p>

            <Button
              size="lg"
              className="w-full text-lg"
              onClick={handleStartTest}
              data-testid="button-start-test"
            >
              Start Dual Renderer Test
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden">
      <Header />

      <main
        className={`flex-1 min-h-0 relative transition-all duration-300 ease-out flex gap-2 ${anyPanelOpen ? 'blur-md pointer-events-none' : ''}`}
        style={{
          paddingTop: '0.5rem',
          paddingRight: '0.5rem',
          paddingBottom: '0.5rem',
          paddingLeft: '0.5rem',
        }}
      >
        <div
          className="hidden md:block flex-shrink-0 transition-all duration-300 ease-out"
          style={{ width: expanded ? `${240 - 16}px` : `${128 - 16}px` }}
        />

        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30">
          <div className="backdrop-blur-md bg-card/80 rounded-b-lg px-4 py-1.5 border border-t-0 border-white/10 flex items-center gap-3">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-sm">Dual Renderer Test</span>
            <Badge variant="outline" className="text-green-400 border-green-400/50 font-mono text-xs" data-testid="text-fps">
              {fps} FPS
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              data-testid="button-exit-test"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Exit
            </Button>
          </div>
        </div>

        <div className="hidden md:flex w-36 flex-col gap-2 flex-shrink-0">
          <Card className="bg-black/80 border-zinc-700">
            <CardContent className="p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Score</span>
                <span className="font-bold" data-testid="text-score">{gameState?.score?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Level</span>
                <span className="font-bold" data-testid="text-level">{gameState?.level || 1}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Lines</span>
                <span className="font-bold" data-testid="text-lines">{gameState?.linesCleared || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Combo</span>
                <span className="font-bold" data-testid="text-combo">{gameState?.combo || 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/80 border-zinc-700">
            <CardContent className="p-3 space-y-2">
              <PiecePreview piece={gameState?.holdPiece} label="HOLD" compact />
              <PiecePreview piece={gameState?.nextPiece} label="NEXT" compact />
            </CardContent>
          </Card>
        </div>

        <Card className="flex-1 min-w-0 bg-black/80 border-zinc-700 flex flex-col overflow-hidden">
          <div className="px-3 py-1 border-b border-zinc-700/50 flex items-center gap-2">
            <Monitor className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-primary">Player View</span>
            <span className="text-xs text-muted-foreground">(Full 3D)</span>
          </div>
          <CardContent className="flex-1 p-0 relative">
            <ErrorBoundary componentName="GameRenderer3D-Player">
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
          <div className="px-3 py-1 border-b border-zinc-700/50 flex items-center gap-2">
            <MonitorSmartphone className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium text-amber-400">Mirror View</span>
            <span className="text-xs text-muted-foreground">(liteMode - opponent sim)</span>
            {!opponentRendererReady && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Loading...
              </Badge>
            )}
          </div>
          <CardContent className="flex-1 p-0 relative">
            {opponentRendererReady && gameState ? (
              <ErrorBoundary componentName="GameRenderer3D-Mirror">
                <GameRenderer3D
                  gameState={gameState}
                  blockTexture={blockTexture}
                  backgroundColor={backgroundColor}
                  gridColor={gridColor}
                  spectatorMode
                  engine="classic"
                  gridMaterial={gridMaterial as any}
                  boardMaterial={boardMaterial as any}
                  viewMode={viewMode}
                  liteMode
                />
              </ErrorBoundary>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-black/50">
                <div className="text-center text-muted-foreground">
                  <div className="animate-pulse text-sm">Mounting mirror renderer in 2s...</div>
                  <div className="text-xs mt-1 text-zinc-500">Simulating delayed opponent mount</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
