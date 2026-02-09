import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, RotateCcw, Home, PartyPopper, Shovel, Heart, Crown } from 'lucide-react';
import { GameState } from '@/lib/game-engine';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@/contexts/NavigationContext';

interface GameOverModalProps {
  gameState: GameState;
  playTimeMs: number;  // playTime in milliseconds
  onRestart: () => void;
  isNewHighScore?: boolean;
}

export function GameOverModal({ gameState, playTimeMs, onRestart, isNewHighScore }: GameOverModalProps) {
  const { t } = useTranslation();
  const { navigateTo } = useNavigation();
  
  // Convert ms to seconds for display
  const playTime = Math.floor(playTimeMs / 1000);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const isVictory = gameState.isVictory;
  const mode = gameState.gameMode;

  const getMainStat = () => {
    switch (mode) {
      case 'sprint':
        return { label: t('stats.clearTime'), value: formatTime(playTime), primary: true };
      case 'survival':
        return { label: t('stats.survivalTime'), value: formatTime(playTime), primary: true };
      case 'master':
        return { label: t('stats.levelReached'), value: gameState.level.toString(), primary: true };
      default:
        return { label: t('stats.finalScore'), value: gameState.score.toLocaleString(), primary: true };
    }
  };

  const getIcon = () => {
    if (isVictory) {
      return <PartyPopper className="w-8 h-8 text-green-500" />;
    }
    switch (mode) {
      case 'master':
        return <Crown className="w-8 h-8 text-yellow-400" />;
      case 'dig':
        return <Shovel className="w-8 h-8 text-amber-400" />;
      case 'survival':
        return <Heart className="w-8 h-8 text-rose-400" />;
      default:
        return <Trophy className="w-8 h-8 text-primary" />;
    }
  };

  const getSecondaryStats = () => {
    const stats: Array<{ label: string; value: string }> = [];

    if (mode === 'sprint') {
      stats.push({ label: t('stats.finalScore'), value: gameState.score.toLocaleString() });
      stats.push({ label: t('stats.linesCleared'), value: gameState.linesCleared.toString() });
      stats.push({ label: t('stats.levelReached'), value: gameState.level.toString() });
    } else if (mode === 'survival') {
      stats.push({ label: t('stats.finalScore'), value: gameState.score.toLocaleString() });
      stats.push({ label: t('stats.garbageCleared'), value: gameState.garbageCleared.toString() });
      stats.push({ label: t('stats.linesCleared'), value: gameState.linesCleared.toString() });
    } else if (mode === 'dig') {
      stats.push({ label: t('stats.garbageCleared'), value: gameState.garbageCleared.toString() });
      stats.push({ label: t('stats.linesCleared'), value: gameState.linesCleared.toString() });
      stats.push({ label: t('stats.playTime'), value: formatTime(playTime) });
    } else if (mode === 'zone') {
      stats.push({ label: t('stats.zoneActivations'), value: gameState.zoneActivations?.toString() || '0' });
      stats.push({ label: t('stats.linesCleared'), value: gameState.linesCleared.toString() });
      stats.push({ label: t('stats.playTime'), value: formatTime(playTime) });
    } else if (mode === 'master') {
      stats.push({ label: t('stats.finalScore'), value: gameState.score.toLocaleString() });
      stats.push({ label: t('stats.linesCleared'), value: gameState.linesCleared.toString() });
      stats.push({ label: t('stats.playTime'), value: formatTime(playTime) });
    } else if (mode === 'invisible') {
      stats.push({ label: t('stats.finalScore'), value: gameState.score.toLocaleString() });
      stats.push({ label: t('stats.linesCleared'), value: gameState.linesCleared.toString() });
      stats.push({ label: t('stats.playTime'), value: formatTime(playTime) });
    } else {
      stats.push({ label: t('stats.levelReached'), value: gameState.level.toString() });
      stats.push({ label: t('stats.linesCleared'), value: gameState.linesCleared.toString() });
      stats.push({ label: t('stats.playTime'), value: formatTime(playTime) });
    }

    return stats;
  };

  const mainStat = getMainStat();
  const secondaryStats = getSecondaryStats();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative max-w-md w-full mx-4 rounded-2xl bg-card/95 backdrop-blur-xl border border-white/10 p-8 shadow-2xl animate-slide-up">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isVictory ? 'bg-green-500/20' : 'bg-primary/20'}`}>
              {getIcon()}
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-2">
            <Badge variant="secondary">{t(`modes.${gameState.gameMode}`)}</Badge>
            {gameState.difficulty && (
              <Badge variant="outline">{t(`difficulty.${gameState.difficulty}`)}</Badge>
            )}
          </div>
          
          <h2 className={`text-3xl font-display font-bold mb-2 ${isVictory ? 'text-green-500' : ''}`}>
            {isVictory ? t('game.victory') : t('game.gameOver')}
          </h2>
          
          {isNewHighScore && (
            <div className="inline-block px-4 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium mb-4">
              {t('game.newHighScore')}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4 my-8">
            <div className="col-span-2">
              <StatCard label={mainStat.label} value={mainStat.value} primary />
            </div>
            {secondaryStats.map((stat, index) => (
              <StatCard key={index} label={stat.label} value={stat.value} />
            ))}
          </div>
          
          <div className="flex flex-col gap-3">
            <Button 
              size="lg" 
              onClick={onRestart}
              className="w-full"
              data-testid="button-play-again"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {t('game.playAgain')}
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="w-full"
              data-testid="button-back-to-menu"
              onClick={() => navigateTo('landing')}
            >
              <Home className="w-4 h-4 mr-2" />
              {t('game.backToMenu')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, primary = false }: { label: string; value: string; primary?: boolean }) {
  return (
    <div className="rounded-xl bg-black/20 p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`font-mono font-bold ${primary ? 'text-2xl text-primary' : 'text-xl'}`}>
        {value}
      </div>
    </div>
  );
}
