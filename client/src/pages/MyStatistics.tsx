import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@/contexts/NavigationContext";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Trophy, Clock, Gamepad2, Target, Zap, Flame, Infinity, Star, TrendingUp } from "lucide-react";
import type { UserProfile } from "@shared/schema";

interface ModeHighScore {
  mode: string;
  highScore: number;
  bestTime: number | null;
  bestLines: number | null;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatTimeShort(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getModeIcon(mode: string) {
  switch (mode) {
    case 'marathon':
      return <Target className="w-4 h-4 text-blue-500" />;
    case 'sprint':
      return <Zap className="w-4 h-4 text-yellow-500" />;
    case 'ultra':
      return <Flame className="w-4 h-4 text-orange-500" />;
    case 'zen':
      return <Infinity className="w-4 h-4 text-purple-500" />;
    default:
      return <Star className="w-4 h-4 text-gray-500" />;
  }
}

export default function MyStatistics() {
  const { t } = useTranslation();
  const { navigateTo } = useNavigation();
  const { user, isAuthenticated } = useAuth();

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ['/api/profile'],
    enabled: isAuthenticated,
  });

  const { data: highScoresData, isLoading: highScoresLoading } = useQuery<{ highScores: ModeHighScore[] }>({
    queryKey: ['/api/profile/high-scores'],
    enabled: isAuthenticated,
  });

  const mainModes = ['marathon', 'sprint', 'ultra', 'zen'];
  const highScores = highScoresData?.highScores?.filter(hs => mainModes.includes(hs.mode)) || [];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">{t('common.loginRequired', 'Please log in to view your statistics')}</p>
          <Button className="mt-4" onClick={() => navigateTo('landing')}>
            {t('common.goToHome', 'Go to Home')}
          </Button>
        </div>
      </div>
    );
  }

  const isLoading = profileLoading || highScoresLoading;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigateTo('account')}
            data-testid="button-back-statistics"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">{t('account.stats', 'Statistics')}</h1>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  {t('stats.overview', 'Overview')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{((profile?.highScore || 0) / 1000).toFixed(0)}K</p>
                    <p className="text-sm text-muted-foreground">{t('account.highScore', 'High Score')}</p>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <Gamepad2 className="w-8 h-8 text-cyan-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{profile?.totalGamesPlayed || 0}</p>
                    <p className="text-sm text-muted-foreground">{t('account.games', 'Games')}</p>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <Clock className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{formatTime(profile?.totalPlayTime || 0)}</p>
                    <p className="text-sm text-muted-foreground">{t('account.time', 'Play Time')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  {t('account.modeHighScores', 'Mode High Scores')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {highScores.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Gamepad2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{t('stats.noGames', 'No games played yet')}</p>
                    <p className="text-sm mt-2">{t('stats.playToRecord', 'Play games to record your high scores')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {highScores.map(hs => (
                      <div 
                        key={hs.mode} 
                        className="p-4 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between"
                        data-testid={`highscore-${hs.mode}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                            {getModeIcon(hs.mode)}
                          </div>
                          <div>
                            <p className="font-medium capitalize">{t(`modes.${hs.mode}`, hs.mode)}</p>
                            {hs.bestLines && (
                              <p className="text-xs text-muted-foreground">{hs.bestLines} {t('game.lines', 'lines')}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{hs.highScore.toLocaleString()}</p>
                          {hs.bestTime && (
                            <p className="text-xs text-muted-foreground">{formatTimeShort(hs.bestTime)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  {t('stats.gameDetails', 'Game Details')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-sm text-muted-foreground mb-1">{t('stats.totalLines', 'Total Lines')}</p>
                    <p className="text-xl font-bold">{(profile?.totalLinesCleared || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-sm text-muted-foreground mb-1">{t('stats.avgScore', 'Avg Score')}</p>
                    <p className="text-xl font-bold">
                      {profile?.totalGamesPlayed && profile.totalGamesPlayed > 0 
                        ? Math.round((profile.highScore || 0) / profile.totalGamesPlayed).toLocaleString()
                        : 0}
                    </p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-sm text-muted-foreground mb-1">{t('stats.avgPlayTime', 'Avg Play Time')}</p>
                    <p className="text-xl font-bold">
                      {profile?.totalGamesPlayed && profile.totalGamesPlayed > 0 
                        ? formatTime(Math.round((profile.totalPlayTime || 0) / profile.totalGamesPlayed))
                        : '0m'}
                    </p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-sm text-muted-foreground mb-1">{t('stats.linesPerGame', 'Lines/Game')}</p>
                    <p className="text-xl font-bold">
                      {profile?.totalGamesPlayed && profile.totalGamesPlayed > 0 
                        ? Math.round((profile.totalLinesCleared || 0) / profile.totalGamesPlayed)
                        : 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
