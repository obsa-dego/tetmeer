import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  ArrowRight, 
  ArrowDown, 
  RotateCw, 
  ChevronsDown,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface GameControlsProps {
  isPaused: boolean;
  isGameOver: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onMoveDown: () => void;
  onRotate: () => void;
  onHardDrop: () => void;
  onHold: () => void;
  onTogglePause: () => void;
  onRestart: () => void;
}

export function GameControls({
  isPaused,
  isGameOver,
  onMoveLeft,
  onMoveRight,
  onMoveDown,
  onRotate,
  onHardDrop,
  onHold,
  onTogglePause,
  onRestart,
}: GameControlsProps) {
  const { t } = useTranslation();
  
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-4 shadow-2xl">
        <div className="flex flex-col gap-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{t('game.controlsTitle')}</div>
          
          <div className="grid grid-cols-3 gap-2">
            <div />
            <ControlButton 
              icon={<RotateCw className="w-4 h-4" />} 
              onClick={onRotate}
              label={t('game.rotate')}
              disabled={isPaused || isGameOver}
              data-testid="button-rotate"
            />
            <div />
            
            <ControlButton 
              icon={<ArrowLeft className="w-4 h-4" />} 
              onClick={onMoveLeft}
              label={t('game.left')}
              disabled={isPaused || isGameOver}
              data-testid="button-move-left"
            />
            <ControlButton 
              icon={<ArrowDown className="w-4 h-4" />} 
              onClick={onMoveDown}
              label={t('game.down')}
              disabled={isPaused || isGameOver}
              data-testid="button-move-down"
            />
            <ControlButton 
              icon={<ArrowRight className="w-4 h-4" />} 
              onClick={onMoveRight}
              label={t('game.right')}
              disabled={isPaused || isGameOver}
              data-testid="button-move-right"
            />
          </div>
          
          <div className="flex gap-2 mt-2">
            <ControlButton 
              icon={<ChevronsDown className="w-4 h-4" />} 
              onClick={onHardDrop}
              label={t('game.drop')}
              className="flex-1"
              disabled={isPaused || isGameOver}
              data-testid="button-hard-drop"
            />
            <ControlButton 
              icon={<RotateCcw className="w-4 h-4" />} 
              onClick={onHold}
              label={t('game.hold')}
              className="flex-1"
              disabled={isPaused || isGameOver}
              data-testid="button-hold"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="lg"
          onClick={onTogglePause}
          className="flex-1 backdrop-blur-sm bg-black/30 border-white/20"
          disabled={isGameOver}
          data-testid="button-pause"
        >
          {isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
          {isPaused ? t('game.resume') : t('game.pause')}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={onRestart}
          className="flex-1 backdrop-blur-sm"
          data-testid="button-restart"
        >
          {t('game.restart')}
        </Button>
      </div>

      <div className="text-xs text-muted-foreground/70 text-center space-y-1">
        <p>{t('game.controlsShort1')}</p>
        <p>{t('game.controlsShort2')}</p>
        <p>{t('game.controlsShort3')}</p>
      </div>
    </div>
  );
}

interface ControlButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  label: string;
  className?: string;
  disabled?: boolean;
  "data-testid"?: string;
}

function ControlButton({ icon, onClick, label, className = '', disabled, "data-testid": testId }: ControlButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center justify-center gap-2 p-3 rounded-lg
        bg-white/5 border border-white/10
        hover:bg-white/10 hover:border-white/20
        active:scale-95 transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      title={label}
      data-testid={testId}
    >
      {icon}
    </button>
  );
}
