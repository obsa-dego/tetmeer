import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Medal, Award, Clock, Zap, Flame, Infinity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSidebar } from '@/contexts/SidebarContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { useAuth } from '@/hooks/use-auth';

type TimeFilter = 'daily' | 'weekly' | 'allTime';
type GameMode = 'marathon' | 'sprint' | 'ultra' | 'zen';

interface LeaderboardEntry {
  rank: number;
  id: string;
  userId: string;
  score: number;
  level: number;
  linesCleared: number;
  playTime: number;
  createdAt: string;
  user: {
    id: string;
    email?: string;
    nickname?: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  } | null;
}

export default function Leaderboard() {
  const { t } = useTranslation();
  const { expanded, notificationOpen, languageOpen, profileOpen } = useSidebar();
  const anyPanelOpen = notificationOpen || languageOpen || profileOpen;
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { navigateTo } = useNavigation();
  const [filter, setFilter] = useState<'ranked' | 'normal' | 'wild'>('ranked');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigateTo('landing');
    }
  }, [authLoading, isAuthenticated, navigateTo]);

  const filterLabels = {
    ranked: t('landing.ranked'),
    normal: t('landing.normalMatch'),
    wild: t('modes.wildMatch'),
  };

  if (filter === 'wild') {
    return (
      <div className="h-screen w-full flex flex-col overflow-hidden">
        <Header />
        <main 
          className={`flex-1 overflow-hidden transition-all duration-300 ease-out ${anyPanelOpen ? 'blur-md pointer-events-none' : ''}`}
          style={{ 
            paddingLeft: expanded ? '240px' : '88px',
            paddingTop: '1rem',
            paddingRight: '1rem',
            paddingBottom: '1rem'
          }}
        >
          <Card className="h-full bg-black/80 border-zinc-700 overflow-hidden">
            <CardContent className="p-0 h-full flex flex-col items-center justify-center gap-4">
              <div className="flex items-center justify-between gap-3 p-4 border-b border-zinc-700 w-full">
                <div className="flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-primary" />
                  <h1 className="text-xl font-bold">{t('leaderboard.title')}</h1>
                </div>
                <div className="flex rounded-lg bg-zinc-800/50 p-1 border border-zinc-700">
                  {(['ranked', 'normal', 'wild'] as const).map((f) => (
                    <Button
                      key={f}
                      variant={filter === f ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setFilter(f)}
                      className={filter === f ? '' : 'text-muted-foreground'}
                      data-testid={`filter-${f}`}
                    >
                      {filterLabels[f]}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="text-center space-y-2 flex-1 flex flex-col items-center justify-center">
                <Zap className="w-12 h-12 text-primary mx-auto animate-pulse" />
                <h2 className="text-2xl font-bold">{t('common.comingSoon')}</h2>
                <p className="text-muted-foreground">야생 모드 리더보드는 곧 출시될 예정입니다.</p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (filter === 'ranked') {
    return (
      <div className="h-screen w-full flex flex-col overflow-hidden">
        <Header />
        <main 
          className={`flex-1 overflow-hidden transition-all duration-300 ease-out ${anyPanelOpen ? 'blur-md pointer-events-none' : ''}`}
          style={{ 
            paddingLeft: expanded ? '240px' : '88px',
            paddingTop: '1rem',
            paddingRight: '1rem',
            paddingBottom: '1rem'
          }}
        >
          <Card className="h-full bg-black/80 border-zinc-700 overflow-hidden">
            <CardContent className="p-0 h-full flex flex-col">
              <div className="flex items-center justify-between gap-3 p-4 border-b border-zinc-700">
                <div className="flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-primary" />
                  <h1 className="text-xl font-bold">{t('leaderboard.title')}</h1>
                </div>
                <div className="flex rounded-lg bg-zinc-800/50 p-1 border border-zinc-700">
                  {(['ranked', 'normal', 'wild'] as const).map((f) => (
                    <Button
                      key={f}
                      variant={filter === f ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setFilter(f)}
                      className={filter === f ? '' : 'text-muted-foreground'}
                      data-testid={`filter-${f}`}
                    >
                      {filterLabels[f]}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <LeaderboardColumn mode="marathon" filter="ranked" title={t('landing.ranked')} />
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden">
      <Header />
      
      <main 
        className={`flex-1 overflow-hidden transition-all duration-300 ease-out ${anyPanelOpen ? 'blur-md pointer-events-none' : ''}`}
        style={{ 
          paddingLeft: expanded ? '240px' : '88px',
          paddingTop: '1rem',
          paddingRight: '1rem',
          paddingBottom: '1rem'
        }}
      >
        <Card className="h-full bg-black/80 border-zinc-700 overflow-hidden">
          <CardContent className="p-0 h-full flex flex-col">
            <div className="flex items-center justify-between gap-3 p-4 border-b border-zinc-700">
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-primary" />
                <h1 className="text-xl font-bold">{t('leaderboard.title')}</h1>
              </div>
              
              <div className="flex rounded-lg bg-zinc-800/50 p-1 border border-zinc-700">
                {(['ranked', 'normal', 'wild'] as const).map((f) => (
                  <Button
                    key={f}
                    variant={filter === f ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter(f)}
                    className={filter === f ? '' : 'text-muted-foreground'}
                    data-testid={`filter-${f}`}
                  >
                    {filterLabels[f]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex-1 flex divide-x divide-zinc-700 overflow-hidden">
              <LeaderboardColumn mode="marathon" filter="allTime" />
              <LeaderboardColumn mode="sprint" filter="allTime" />
              <LeaderboardColumn mode="ultra" filter="allTime" />
              <LeaderboardColumn mode="zen" filter="allTime" />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function LeaderboardColumn({ mode, filter, title }: { mode: GameMode; filter: string; title?: string }) {
  const { t } = useTranslation();
  const { navigateTo } = useNavigation();

  const handleAvatarClick = (userId: string | undefined) => {
    if (userId) {
      navigateTo('user-profile', { userId });
    }
  };

  const getDisplayName = (user: LeaderboardEntry['user']): string => {
    if (!user) return t('leaderboard.anonymous');
    if (user.nickname) {
      return user.nickname;
    }
    if (user.firstName) {
      return `${user.firstName} ${user.lastName?.[0] || ''}`.trim();
    }
    if (user.email) {
      return user.email.split('@')[0];
    }
    return t('leaderboard.player');
  };

  const { data, isLoading } = useQuery<{ entries: any[] }>({
    queryKey: ['/api/leaderboard', filter, mode],
    queryFn: async () => {
      const url = filter === 'ranked' 
        ? `/api/leaderboard/ranked`
        : `/api/leaderboard?filter=${filter}&mode=${mode}`;
      const res = await fetch(url, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      return res.json();
    },
  });

  const entries = data?.entries || [];
  const isSprintMode = mode === 'sprint' && filter !== 'ranked';
  const isRanked = filter === 'ranked';

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-4 h-4 text-yellow-500" />;
      case 2:
        return <Medal className="w-4 h-4 text-gray-400" />;
      case 3:
        return <Award className="w-4 h-4 text-amber-600" />;
      default:
        return <span className="w-4 h-4 flex items-center justify-center text-xs font-mono text-zinc-400">{rank}</span>;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const modeIcons: Record<GameMode, typeof Trophy> = {
    marathon: Trophy,
    sprint: Zap,
    ultra: Flame,
    zen: Infinity,
  };

  const modeColors: Record<GameMode, string> = {
    marathon: 'text-yellow-500',
    sprint: 'text-cyan-500',
    ultra: 'text-orange-500',
    zen: 'text-purple-500',
  };

  const Icon = modeIcons[mode];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-zinc-700/50">
        <div className={`p-1.5 rounded-lg bg-zinc-800/50`}>
          <Icon className={`w-4 h-4 ${modeColors[mode]}`} />
        </div>
        <div>
          <h3 className="font-semibold text-white text-sm">{title || (mode in modeColors ? t(`modes.${mode}`) : t(`landing.${mode}`, mode))}</h3>
          <p className="text-xs text-zinc-500">
            {isRanked ? t('ranked.points') : (isSprintMode ? t('game.time') : t('game.score'))}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 p-2">
                <Skeleton className="w-6 h-6 rounded-full" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <Icon className={`w-8 h-8 ${modeColors[mode]} opacity-30 mb-2`} />
            <p className="text-xs text-zinc-500">{t('leaderboard.noScores')}</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-700/30">
            {entries.map((entry) => (
              <div 
                key={entry.id}
                className={`
                  px-3 py-2 flex items-center gap-2 transition-colors hover:bg-white/5
                  ${entry.rank <= 3 ? 'bg-primary/5' : ''}
                `}
                data-testid={`leaderboard-entry-${mode}-${entry.rank}`}
              >
                <div className="w-6 flex items-center justify-center shrink-0">
                  {getRankIcon(entry.rank)}
                </div>
                
                <Avatar 
                  className="w-6 h-6 shrink-0 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAvatarClick(entry.user?.id);
                  }}
                  data-testid={`avatar-${entry.userId}`}
                >
                  <AvatarImage src={entry.user?.profileImageUrl || undefined} />
                  <AvatarFallback className="text-xs">
                    {getDisplayName(entry.user)?.[0]?.toUpperCase() || 'P'}
                  </AvatarFallback>
                </Avatar>
                
                <span className="flex-1 text-sm font-medium truncate">
                  {getDisplayName(entry.user)}
                </span>
                
                <span className="font-mono text-sm font-bold text-primary shrink-0">
                  {isRanked 
                    ? `${(entry.score || 0).toLocaleString()} RP` 
                    : (isSprintMode ? formatTime(entry.playTime || 0) : (entry.score || 0).toLocaleString())
                  }
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
