import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@/contexts/NavigationContext';
import { useAuth } from '@/hooks/use-auth';
import { useMatchmaking, MatchEndResult } from '@/hooks/use-matchmaking';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Header } from '@/components/Header';
import { useSidebar } from '@/contexts/SidebarContext';
import { 
  Trophy, Swords, Users, Clock, Loader2, 
  Crown, Shield, Star, Lock,
  Zap, Target, Bot
} from 'lucide-react';
import { getRankFromPoints, getRankDisplayInfo, calculateXpForLevel, RANK_THRESHOLDS } from '@shared/rank-utils';
import { useTranslation } from 'react-i18next';

interface PlayerProgression {
  level: number;
  xp: number;
  rankPoints: number;
  placementMatchesPlayed: number;
  placementWins: number;
  rankedWins: number;
  rankedLosses: number;
  winStreak: number;
}

interface RankedEligibility {
  eligible: boolean;
  reason?: string;
  currentLevel?: number;
  requiredLevel?: number;
  placementMatchesPlayed?: number;
  placementMatchesRequired?: number;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  score: number;
  level: number;
  userName?: string;
  profileImageUrl?: string;
  rankTier?: string;
  rankDivision?: string;
}

const RANK_ICONS: Record<string, typeof Shield> = {
  iron: Shield,
  bronze: Shield,
  silver: Star,
  gold: Crown,
  platinum: Crown,
  diamond: Crown,
  master: Trophy,
  grandmaster: Trophy,
  challenger: Trophy,
};

const RANK_COLORS: Record<string, string> = {
  iron: 'text-gray-400',
  bronze: 'text-amber-700',
  silver: 'text-gray-300',
  gold: 'text-yellow-400',
  platinum: 'text-cyan-300',
  diamond: 'text-blue-400',
  master: 'text-purple-400',
  grandmaster: 'text-red-400',
  challenger: 'text-yellow-300',
};

const RANK_BG_COLORS: Record<string, string> = {
  iron: 'bg-gray-500/20',
  bronze: 'bg-amber-700/20',
  silver: 'bg-gray-400/20',
  gold: 'bg-yellow-500/20',
  platinum: 'bg-cyan-400/20',
  diamond: 'bg-blue-500/20',
  master: 'bg-purple-500/20',
  grandmaster: 'bg-red-500/20',
  challenger: 'bg-yellow-400/20',
};

export default function RankedLobby() {
  const { t } = useTranslation();
  const { navigateTo } = useNavigation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { expanded, notificationOpen, languageOpen, profileOpen } = useSidebar();
  const anyPanelOpen = notificationOpen || languageOpen || profileOpen;
  const [countdown, setCountdown] = useState<number | null>(null);
  const [matchResult, setMatchResult] = useState<MatchEndResult | null>(null);
  const currentUserRef = useRef<HTMLDivElement>(null);

  const { data: progression, isLoading: progressionLoading } = useQuery<PlayerProgression>({
    queryKey: ['/api/ranked/progression'],
    enabled: isAuthenticated,
  });

  const { data: eligibility } = useQuery<RankedEligibility>({
    queryKey: ['/api/ranked/eligibility'],
    enabled: isAuthenticated,
  });

  const { data: leaderboardData } = useQuery<{ entries: LeaderboardEntry[] }>({
    queryKey: ['/api/ranked/leaderboard?limit=200'],
    enabled: isAuthenticated,
  });

  const handleMatchEnd = (result: MatchEndResult) => {
    setMatchResult(result);
  };

  const {
    status,
    queueTime,
    match,
    error,
    joinQueue,
    leaveQueue,
    requestAiMatch,
    disconnect,
  } = useMatchmaking({
    onMatchEnd: handleMatchEnd,
  });

  useEffect(() => {
    if (match && status === 'match_found') {
      const startTime = match.startDelay;
      let remaining = Math.ceil(startTime / 1000);
      setCountdown(remaining);

      const interval = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          navigateTo('ranked-match', { matchId: match.matchId });
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

  useEffect(() => {
    if (currentUserRef.current && leaderboardData?.entries) {
      setTimeout(() => {
        currentUserRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [leaderboardData]);

  if (authLoading || progressionLoading) {
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
            <h1 className="text-2xl font-bold">{t('ranked.loginRequired', 'Login Required')}</h1>
            <p className="text-muted-foreground">
              {t('ranked.loginDescription', 'You must be logged in to play ranked matches.')}
            </p>
          </Card>
        </main>
      </div>
    );
  }

  if (eligibility && !eligibility.eligible) {
    return (
      <div className="h-screen w-full flex flex-col overflow-hidden">
        <Header />
        <main 
          className={`flex-1 flex items-center justify-center transition-all duration-300 ease-out ${anyPanelOpen ? 'blur-md pointer-events-none' : ''}`}
          style={{ paddingLeft: expanded ? '240px' : '88px' }}
        >
          <Card className="p-8 max-w-md w-full text-center space-y-4 bg-black/80 border-zinc-700">
            <Lock className="w-16 h-16 mx-auto text-muted-foreground" />
            <h1 className="text-2xl font-bold">{t('ranked.locked', 'Ranked Mode Locked')}</h1>
            <p className="text-muted-foreground">
              {eligibility.reason || t('ranked.reachLevel', 'Reach level 30 to unlock ranked mode.')}
            </p>
            {eligibility.currentLevel !== undefined && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('ranked.currentLevel', 'Current Level')}: {eligibility.currentLevel}</span>
                  <span>{t('ranked.required', 'Required')}: {eligibility.requiredLevel}</span>
                </div>
                <Progress 
                  value={(eligibility.currentLevel / (eligibility.requiredLevel || 30)) * 100} 
                  className="h-2"
                />
              </div>
            )}
            <div className="flex gap-4 justify-center">
              <Button data-testid="button-play-classic" onClick={() => navigateTo('game')}>
                <Zap className="w-4 h-4 mr-2" />
                {t('ranked.playClassic', 'Play Classic Modes')}
              </Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  const rank = progression ? getRankFromPoints(progression.rankPoints) : null;
  const rankInfo = rank ? getRankDisplayInfo(rank) : null;
  const isPlacement = progression ? progression.placementMatchesPlayed < 10 : true;
  const currentLevelXp = progression ? calculateXpForLevel(progression.level) : 0;
  const nextLevelXp = progression ? calculateXpForLevel(progression.level + 1) : 100;
  const xpProgress = progression ? ((progression.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100 : 0;

  const RankIcon = rank ? RANK_ICONS[rank.tier] || Shield : Shield;
  const rankColor = rank ? RANK_COLORS[rank.tier] || 'text-gray-400' : 'text-gray-400';

  const leaderboardEntries = leaderboardData?.entries || [];
  const userRankIndex = leaderboardEntries.findIndex(entry => entry.userId === user?.id);

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
        <div className="h-full flex gap-4">
          {/* Left Panel - Player Info */}
          <div className="w-80 flex-shrink-0 flex flex-col gap-4">
            {/* Player Card */}
            <Card className="bg-black/80 border-zinc-700">
              <CardContent className="p-5">
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="w-14 h-14 ring-2 ring-primary/30">
                    <AvatarImage src={user?.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary">{user?.firstName?.[0] || 'P'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold">{user?.firstName || 'Player'}</h2>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{t('ranked.level', 'Level')} {progression?.level || 1}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 mb-4">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t('ranked.levelProgress', 'Level Progress')}</span>
                    <span>{Math.round(xpProgress)}%</span>
                  </div>
                  <Progress value={xpProgress} className="h-1.5" />
                </div>

                {isPlacement ? (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold">{t('ranked.placementMatches', 'Placement Matches')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={(progression?.placementMatchesPlayed || 0) * 10} 
                        className="h-2 flex-1"
                      />
                      <span className="text-xs font-medium">
                        {progression?.placementMatchesPlayed || 0}/10
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RankIcon className={`w-8 h-8 ${rankColor}`} />
                        <div>
                          <div className="font-bold">{rankInfo?.name || 'Unranked'}</div>
                          <div className="text-xs text-muted-foreground">
                            {progression?.rankPoints || 0} {t('ranked.points', 'RP')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card className="bg-black/80 border-zinc-700">
              <CardContent className="p-5">
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  {t('ranked.stats', 'Your Stats')}
                </h4>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2 rounded-lg bg-zinc-800/50">
                    <div className="text-xl font-bold">{(progression?.rankedWins || 0) + (progression?.rankedLosses || 0)}</div>
                    <div className="text-xs text-muted-foreground">{t('ranked.played', 'Played')}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-800/50">
                    <div className="text-xl font-bold text-green-500">{progression?.rankedWins || 0}</div>
                    <div className="text-xs text-muted-foreground">{t('ranked.won', 'Won')}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-800/50">
                    <div className="text-xl font-bold text-yellow-500">{progression?.winStreak || 0}</div>
                    <div className="text-xs text-muted-foreground">{t('ranked.streak', 'Streak')}</div>
                  </div>
                </div>
                <div className="mt-3 p-2 rounded-lg bg-zinc-800/50 text-center">
                  <div className="text-xs text-muted-foreground mb-1">{t('ranked.winRate', 'Win Rate')}</div>
                  <div className="text-lg font-bold">
                    {(progression?.rankedWins || 0) + (progression?.rankedLosses || 0) > 0
                      ? Math.round(((progression?.rankedWins || 0) / ((progression?.rankedWins || 0) + (progression?.rankedLosses || 0))) * 100)
                      : 0}%
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Matchmaking Status */}
            {(status === 'connecting' || status === 'queuing' || status === 'match_found') && (
              <Card className="bg-black/80 border-zinc-700">
                <CardContent className="p-5">
                  {status === 'connecting' && (
                    <div className="flex flex-col items-center py-4 gap-3">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">{t('ranked.connecting', 'Connecting...')}</span>
                    </div>
                  )}

                  {status === 'queuing' && (
                    <div className="flex flex-col items-center py-4 gap-3">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Clock className="w-6 h-6 text-primary" />
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-semibold">{t('ranked.searching', 'Searching...')}</div>
                        <div className="text-lg font-mono text-primary">
                          {Math.floor(queueTime / 60)}:{(queueTime % 60).toString().padStart(2, '0')}
                        </div>
                      </div>
                      <div className="flex gap-2 w-full">
                        <Button variant="outline" size="sm" className="flex-1" onClick={leaveQueue} data-testid="button-cancel-queue">
                          {t('ranked.cancel', 'Cancel')}
                        </Button>
                        <Button variant="secondary" size="sm" className="flex-1" onClick={requestAiMatch} data-testid="button-match-ai">
                          <Bot className="w-3 h-3 mr-1" />
                          AI
                        </Button>
                      </div>
                    </div>
                  )}

                  {status === 'match_found' && match && (
                    <div className="flex flex-col items-center py-4 gap-3">
                      <div className="text-5xl font-bold text-primary animate-pulse">
                        {countdown}
                      </div>
                      <div className="text-sm font-semibold">{t('ranked.matchFound', 'Match Found!')}</div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 w-full">
                        <Avatar className="w-10 h-10">
                          {match.opponent.userProfileImage ? (
                            <AvatarImage src={match.opponent.userProfileImage} />
                          ) : (
                            <AvatarFallback>
                              {match.opponent.isAi ? <Bot className="w-5 h-5" /> : match.opponent.userName?.[0] || 'O'}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-semibold text-sm flex items-center gap-2">
                            {match.opponent.userName}
                            {match.opponent.isAi && (
                              <Badge variant="secondary" className="text-xs">AI</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {match.opponent.rankPoints} RP
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Panel - Leaderboard */}
          <Card className="flex-1 bg-black/80 border-zinc-700 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <h2 className="font-bold">{t('ranked.leaderboard', 'Ranked Leaderboard')}</h2>
                  <p className="text-xs text-muted-foreground">
                    {userRankIndex >= 0 ? `${t('ranked.yourRank', 'Your Rank')}: #${userRankIndex + 1}` : t('ranked.notRanked', 'Complete placement to rank')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigateTo('ranked-guide')}
                  className="text-sm text-primary hover:underline"
                  data-testid="link-ranked-guide"
                >
                  {t('ranked.viewGuide', '랭크 시스템 자세히 보기')}
                </button>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{leaderboardEntries.length} {t('ranked.players', 'players')}</span>
                </div>
              </div>
            </div>

            {/* Leaderboard List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-2">
                {leaderboardEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Trophy className="w-12 h-12 mb-3 opacity-30" />
                    <p>{t('ranked.noPlayers', 'No ranked players yet')}</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {leaderboardEntries.map((entry, index) => {
                      const entryRank = getRankFromPoints(entry.score);
                      const EntryRankIcon = RANK_ICONS[entryRank.tier] || Shield;
                      const entryRankColor = RANK_COLORS[entryRank.tier] || 'text-gray-400';
                      const entryBgColor = RANK_BG_COLORS[entryRank.tier] || 'bg-zinc-800/50';
                      const isCurrentUser = entry.userId === user?.id;
                      const isTop3 = index < 3;

                      return (
                        <div
                          key={entry.userId}
                          ref={isCurrentUser ? currentUserRef : undefined}
                          className={`
                            flex items-center gap-3 p-3 rounded-lg transition-all
                            ${isCurrentUser 
                              ? 'bg-primary/20 border-2 border-primary ring-2 ring-primary/30' 
                              : `${entryBgColor} border border-transparent hover:border-zinc-600`
                            }
                          `}
                          data-testid={`leaderboard-entry-${entry.rank}`}
                        >
                          {/* Rank Number */}
                          <div className={`
                            w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm
                            ${isTop3 
                              ? index === 0 
                                ? 'bg-yellow-500/30 text-yellow-400' 
                                : index === 1 
                                  ? 'bg-gray-400/30 text-gray-300'
                                  : 'bg-amber-700/30 text-amber-600'
                              : 'bg-zinc-700/50 text-zinc-400'
                            }
                          `}>
                            {isTop3 ? (
                              <Crown className={`w-5 h-5 ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : 'text-amber-600'}`} />
                            ) : (
                              `#${entry.rank}`
                            )}
                          </div>

                          {/* Player Info */}
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={entry.profileImageUrl || undefined} />
                            <AvatarFallback className={entryBgColor}>
                              {entry.userName?.[0] || 'P'}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className={`font-semibold text-sm truncate ${isCurrentUser ? 'text-primary' : ''}`}>
                              {entry.userName || 'Player'}
                              {isCurrentUser && <span className="ml-2 text-xs text-primary">({t('ranked.you', 'You')})</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t('ranked.level', 'Level')} {entry.level}
                            </div>
                          </div>

                          {/* Rank Badge */}
                          <div className="flex items-center gap-2">
                            <EntryRankIcon className={`w-5 h-5 ${entryRankColor}`} />
                            <div className="text-right">
                              <div className={`text-sm font-bold ${entryRankColor}`}>
                                {getRankDisplayInfo(entryRank).name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {entry.score.toLocaleString()} RP
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Find Match Button - Bottom Right */}
            <div className="p-4 border-t border-zinc-700">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-3">
                  {error}
                </div>
              )}
              
              {status === 'idle' && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground max-w-md">
                    {t('ranked.matchDescription', 'Race to clear 40 lines before your opponent. First to reach the goal wins!')}
                  </p>
                  <Button 
                    size="lg"
                    className="px-8 h-12 text-lg gap-2"
                    onClick={joinQueue}
                    data-testid="button-find-match"
                  >
                    <Swords className="w-5 h-5" />
                    {t('ranked.findMatch', 'Find Match')}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </main>

      {matchResult && (
        <MatchResultModal 
          result={matchResult} 
          onClose={() => setMatchResult(null)} 
        />
      )}
    </div>
  );
}

function MatchResultModal({ result, onClose }: { result: MatchEndResult; onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="p-6 max-w-md w-full space-y-4 animate-in zoom-in-95">
        <div className="text-center">
          {result.won ? (
            <>
              <Trophy className="w-16 h-16 mx-auto text-yellow-500 mb-2" />
              <h2 className="text-2xl font-bold text-green-500">{t('ranked.victory', 'Victory!')}</h2>
            </>
          ) : (
            <>
              <Shield className="w-16 h-16 mx-auto text-gray-400 mb-2" />
              <h2 className="text-2xl font-bold text-red-500">{t('ranked.defeat', 'Defeat')}</h2>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className={`text-xl font-bold ${result.rankPointChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {result.rankPointChange >= 0 ? '+' : ''}{result.rankPointChange}
            </div>
            <div className="text-xs text-muted-foreground">{t('ranked.rpChange', 'RP Change')}</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-xl font-bold text-cyan-500">+{result.xpEarned}</div>
            <div className="text-xs text-muted-foreground">{t('ranked.xpEarned', 'XP Earned')}</div>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          {t('ranked.newRank', 'New RP')}: {result.newRankPoints} • {t('ranked.level', 'Level')} {result.newLevel}
        </div>

        <Button className="w-full" onClick={onClose} data-testid="button-close-result">
          {t('common.continue', 'Continue')}
        </Button>
      </Card>
    </div>
  );
}
