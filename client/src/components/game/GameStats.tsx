import { GameState } from '@/lib/game-engine';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef, memo } from 'react';

interface GameStatsProps {
  gameState: GameState;
  startTime: number | null;
  isPaused?: boolean;
}

export const GameStats = memo(function GameStats({ gameState, startTime, isPaused = false }: GameStatsProps) {
  const { t } = useTranslation();
  const [displayTime, setDisplayTime] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const accumulatedTimeRef = useRef(0);  // Time accumulated before current running session
  const sessionStartRef = useRef<number | null>(null);  // When the current running session started
  const wasRunningRef = useRef(false);  // Track if timer was running in previous render
  
  // Determine if timer should be running
  const shouldRun = startTime !== null && !gameState.isGameOver && !isPaused && !gameState.isZoneActive;
  
  // Use requestAnimationFrame for smooth timer updates without causing parent re-renders
  useEffect(() => {
    // Handle state transitions
    if (shouldRun) {
      // Starting or resuming
      if (!wasRunningRef.current) {
        // Timer just started running - set session start to now
        sessionStartRef.current = Date.now();
        wasRunningRef.current = true;
      }
      
      const updateTimer = () => {
        if (sessionStartRef.current !== null) {
          const sessionElapsed = Date.now() - sessionStartRef.current;
          setDisplayTime(accumulatedTimeRef.current + sessionElapsed);
        }
        animationFrameRef.current = requestAnimationFrame(updateTimer);
      };
      
      animationFrameRef.current = requestAnimationFrame(updateTimer);
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    } else {
      // Pausing or stopping
      if (wasRunningRef.current && sessionStartRef.current !== null) {
        // Timer just stopped - save accumulated time
        const sessionElapsed = Date.now() - sessionStartRef.current;
        accumulatedTimeRef.current += sessionElapsed;
        sessionStartRef.current = null;
        wasRunningRef.current = false;
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  }, [shouldRun]);

  // Reset on new game (when startTime changes to a new value)
  useEffect(() => {
    if (startTime !== null) {
      accumulatedTimeRef.current = 0;
      sessionStartRef.current = Date.now();
      wasRunningRef.current = true;
      setDisplayTime(0);
    }
  }, [startTime]);

  // Format time as MM:SS.XX (0.01s precision for display)
  const formatTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
  };

  // Calculate BPS with 4 decimal precision (using ms for accuracy)
  const playTimeSeconds = displayTime / 1000;
  const bps = playTimeSeconds > 0 ? (gameState.piecesPlaced / playTimeSeconds).toFixed(4) : '0.0000';

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-4 shadow-2xl">
        <div className="flex flex-col gap-3">
          <StatRow label={t('game.score')} value={gameState.score.toLocaleString()} highlight />
          <StatRow label={t('game.level')} value={gameState.level.toString()} />
          <StatRow label={t('game.lines')} value={gameState.linesCleared.toString()} />
          <StatRow label={t('game.time')} value={formatTime(displayTime)} />
          <StatRow label={t('game.bps', 'BPS')} value={bps} />
          {gameState.combo > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{t('game.combo')}</span>
              <span className="text-lg font-bold text-primary animate-score-pop">
                x{gameState.combo}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const StatRow = memo(function StatRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`font-mono font-bold ${highlight ? 'text-2xl text-primary' : 'text-lg'}`}>
        {value}
      </span>
    </div>
  );
});
