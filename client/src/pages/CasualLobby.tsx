import { useState, useEffect } from 'react';
import { useNavigation } from '@/contexts/NavigationContext';
import { useAuth } from '@/hooks/use-auth';
import { useCasualMatchmaking, CasualGameMode, MODE_DISPLAY_INFO, CasualMatchEndResult } from '@/hooks/use-casual-matchmaking';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/Header';
import { useSidebar } from '@/contexts/SidebarContext';
import { 
  Users, Clock, Loader2, 
  Lock, Target, Timer, FastForward,
  Infinity as InfinityIcon, Play, ArrowLeft, Activity
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MODE_ICONS: Record<CasualGameMode, typeof Target> = {
  marathon: Target,
  sprint: FastForward,
  ultra: Timer,
  zen: InfinityIcon,
};

const MODE_COLORS: Record<CasualGameMode, string> = {
  marathon: 'text-primary border-primary/30',
  sprint: 'text-yellow-400 border-yellow-400/30',
  ultra: 'text-orange-400 border-orange-400/30',
  zen: 'text-purple-400 border-purple-400/30',
};

const MODE_BG_COLORS: Record<CasualGameMode, string> = {
  marathon: 'bg-primary/10 hover:bg-primary/20',
  sprint: 'bg-yellow-400/10 hover:bg-yellow-400/20',
  ultra: 'bg-orange-400/10 hover:bg-orange-400/20',
  zen: 'bg-purple-400/10 hover:bg-purple-400/20',
};

export default function CasualLobby() {
  const { t } = useTranslation();
  const { navigateTo } = useNavigation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { expanded, notificationOpen, languageOpen, profileOpen } = useSidebar();
  const anyPanelOpen = notificationOpen || languageOpen || profileOpen;
  const [selectedMode, setSelectedMode] = useState<CasualGameMode | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const handleMatchEnd = (result: CasualMatchEndResult) => {
  };

  const {
    status,
    queueTime,
    match,
    gameMode,
    error,
    joinQueue,
    leaveQueue,
    disconnect,
  } = useCasualMatchmaking({
    onMatchEnd: handleMatchEnd,
  });

  useEffect(() => {
    if (match && (status === 'match_found' || status === 'in_match')) {
      const startTime = match.startDelay;
      let remaining = Math.ceil(startTime / 1000);
      setCountdown(remaining);

      const interval = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          // Store match data in sessionStorage before navigating
          sessionStorage.setItem('casualMatchData', JSON.stringify(match));
          // Disconnect WebSocket before navigating to prevent connection conflicts
          disconnect();
          navigateTo('casual-match', { matchId: match.matchId });
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [match, status, navigateTo]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const handleModeSelect = (mode: CasualGameMode) => {
    setSelectedMode(mode);
  };

  const handleFindMatch = () => {
    if (selectedMode) {
      joinQueue(selectedMode);
    }
  };

  const handleCancelQueue = () => {
    leaveQueue();
    setSelectedMode(null);
  };

  const handleBack = () => {
    if (status === 'queuing' || status === 'match_found') {
      disconnect();
    }
    navigateTo('landing');
  };

  const formatQueueTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (authLoading) {
    return (
      <div className="h-screen w-full flex flex-col overflow-hidden">
        <Header />
        <main 
          className={`flex-1 flex items-center justify-center transition-all duration-300 ease-out ${anyPanelOpen ? 'blur-md pointer-events-none' : ''}`}
          style={{ paddingLeft: expanded ? '240px' : '88px' }}
        >
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="h-screen w-full flex flex-col overflow-hidden">
        <Header />
        <main 
          className={`flex-1 flex items-center justify-center transition-all duration-300 ease-out ${anyPanelOpen ? 'blur-md pointer-events-none' : ''}`}
          style={{ paddingLeft: expanded ? '240px' : '88px' }}
        >
          <Card className="p-8 max-w-md w-full text-center space-y-4 bg-black/80 border-zinc-700">
            <Lock className="w-16 h-16 mx-auto text-muted-foreground" />
            <h1 className="text-2xl font-bold">{t('casual.loginRequired', 'Login Required')}</h1>
            <p className="text-muted-foreground">
              {t('casual.loginDescription', 'You must be logged in to play multiplayer matches.')}
            </p>
          </Card>
        </main>
      </div>
    );
  }

  const isInQueue = status === 'queuing' || status === 'match_found';

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden">
      <Header />
      
      <main 
        className={`flex-1 flex flex-col items-center justify-center transition-all duration-300 ease-out ${anyPanelOpen ? 'blur-md pointer-events-none' : ''}`}
        style={{ paddingLeft: expanded ? '240px' : '88px' }}
      >
        <div className="w-full max-w-4xl px-6 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleBack}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Users className="w-8 h-8 text-primary" />
                {t('casual.title', 'Casual Multiplayer')}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t('casual.subtitle', 'Play with others in a friendly environment - no rank, just fun!')}
              </p>
            </div>
          </div>

          {status === 'queuing' && (
            <Card className="mb-6 bg-primary/10 border-primary/30">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <div>
                      <h3 className="font-semibold">{t('casual.searching', 'Searching for opponent...')}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{formatQueueTime(queueTime)}</span>
                        <span>-</span>
                        <Badge variant="outline">
                          {MODE_DISPLAY_INFO[gameMode || 'marathon'].name}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" onClick={handleCancelQueue} data-testid="button-cancel-queue">
                    {t('casual.cancelQueue', 'Cancel')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {status === 'match_found' && match && (
            <Card className="mb-6 bg-green-500/10 border-green-500/30">
              <CardContent className="p-6 text-center">
                <h3 className="text-2xl font-bold text-green-500 mb-2">
                  {t('casual.matchFound', 'Match Found!')}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {t('casual.vsOpponent', 'vs {{opponent}}', { opponent: match.opponent.userName })}
                </p>
                {countdown !== null && (
                  <div className="text-4xl font-bold text-primary animate-pulse">
                    {countdown}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="mb-6 bg-destructive/10 border-destructive/30">
              <CardContent className="p-4">
                <p className="text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          <h2 className="text-xl font-semibold mb-4">{t('casual.selectMode', 'Select Game Mode')}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {(Object.keys(MODE_DISPLAY_INFO) as CasualGameMode[]).map((mode) => {
              const info = MODE_DISPLAY_INFO[mode];
              const Icon = MODE_ICONS[mode];
              const isSelected = selectedMode === mode;
              
              return (
                <Card 
                  key={mode}
                  className={`cursor-pointer transition-all ${MODE_BG_COLORS[mode]} ${
                    isSelected ? `ring-2 ring-offset-2 ring-offset-background ${MODE_COLORS[mode].replace('text-', 'ring-')}` : ''
                  } ${isInQueue ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={() => !isInQueue && handleModeSelect(mode)}
                  data-testid={`card-mode-${mode}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${MODE_COLORS[mode].replace('text-', 'bg-').replace('/30', '/20')}`}>
                        <Icon className={`w-8 h-8 ${MODE_COLORS[mode].split(' ')[0]}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className={`text-xl font-bold ${MODE_COLORS[mode].split(' ')[0]}`}>
                          {info.name}
                        </h3>
                        <p className="text-muted-foreground mt-1">
                          {info.description}
                        </p>
                      </div>
                      {isSelected && (
                        <Badge className={`${MODE_COLORS[mode].split(' ')[0].replace('text-', 'bg-')} text-white`}>
                          {t('casual.selected', 'Selected')}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-center">
            <Button
              size="lg"
              className="px-12 py-6 text-lg"
              disabled={!selectedMode || isInQueue}
              onClick={handleFindMatch}
              data-testid="button-find-match"
            >
              {isInQueue ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {t('casual.searching', 'Searching...')}
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  {t('casual.findMatch', 'Find Match')}
                </>
              )}
            </Button>
          </div>

          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateTo('test-match')}
              className="text-cyan-400 border-cyan-400/30"
              data-testid="button-test-match"
            >
              <Activity className="w-4 h-4 mr-2" />
              Dual Renderer Test
            </Button>
          </div>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            <p>{t('casual.noRankAffect', 'Casual matches do not affect your rank, but you still earn XP!')}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
