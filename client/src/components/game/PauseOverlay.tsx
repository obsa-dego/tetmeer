import { Button } from '@/components/ui/button';
import { Play, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@/contexts/NavigationContext';

interface PauseOverlayProps {
  onResume: () => void;
}

export function PauseOverlay({ onResume }: PauseOverlayProps) {
  const { t } = useTranslation();
  const { navigateTo } = useNavigation();
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative max-w-sm w-full mx-4 rounded-2xl bg-card/95 backdrop-blur-xl border border-white/10 p-8 shadow-2xl text-center animate-slide-up">
        <h2 className="text-3xl font-display font-bold mb-6">{t('game.paused')}</h2>
        
        <div className="flex flex-col gap-3">
          <Button 
            size="lg" 
            onClick={onResume}
            className="w-full"
            data-testid="button-resume"
          >
            <Play className="w-4 h-4 mr-2" />
            {t('game.resumeGame')}
          </Button>
          <Button 
            variant="outline" 
            size="lg"
            className="w-full"
            data-testid="button-exit-to-menu"
            onClick={() => navigateTo('landing')}
          >
            <Home className="w-4 h-4 mr-2" />
            {t('game.exitToMenu')}
          </Button>
        </div>
        
        <p className="text-sm text-muted-foreground mt-4">
          {t('game.pressToResume')}
        </p>
      </div>
    </div>
  );
}
