import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@/contexts/NavigationContext";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Trophy, Target, Clock, Swords, Crown, TrendingUp, TrendingDown, Minus, Bot, User } from "lucide-react";
import type { PlayerProgression, RankedMatch } from "@shared/schema";

const RANK_COLORS: Record<string, string> = {
  unranked: "text-gray-400",
  iron: "text-gray-500",
  bronze: "text-amber-700",
  silver: "text-gray-300",
  gold: "text-yellow-500",
  platinum: "text-cyan-400",
  diamond: "text-blue-400",
  master: "text-purple-500",
  grandmaster: "text-red-500",
  challenger: "text-orange-500",
};

const RANK_LABELS: Record<string, string> = {
  unranked: "Unranked",
  iron: "Iron",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Diamond",
  master: "Master",
  grandmaster: "Grandmaster",
  challenger: "Challenger",
};

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function MyRanking() {
  const { t } = useTranslation();
  const { navigateTo } = useNavigation();
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id;

  const { data: progression, isLoading: progressionLoading } = useQuery<PlayerProgression>({
    queryKey: ['/api/user/progression'],
    enabled: isAuthenticated,
  });

  const { data: matchesData, isLoading: matchesLoading } = useQuery<{ matches: RankedMatch[] }>({
    queryKey: ['/api/user/ranked-matches'],
    enabled: isAuthenticated,
  });

  const matches = matchesData?.matches || [];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">{t('common.loginRequired', 'Please log in to view your ranking')}</p>
          <Button className="mt-4" onClick={() => navigateTo('landing')}>
            {t('common.goToHome', 'Go to Home')}
          </Button>
        </div>
      </div>
    );
  }
  
  const rankTier = progression?.rankTier || "unranked";
  const rankDivision = progression?.rankDivision || "IV";
  const rankPoints = progression?.rankPoints || 0;
  const rankedWins = progression?.rankedWins || 0;
  const rankedLosses = progression?.rankedLosses || 0;
  const winRate = rankedWins + rankedLosses > 0 
    ? Math.round((rankedWins / (rankedWins + rankedLosses)) * 100) 
    : 0;
  const isPlacementComplete = progression?.isPlacementComplete || false;
  const placementMatchesPlayed = progression?.placementMatchesPlayed || 0;
  const placementWins = progression?.placementWins || 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigateTo('account')}
            data-testid="button-back-to-account"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">{t('ranking.myRanking', 'My Ranking')}</h1>
        </div>

        {progressionLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <Skeleton className="w-24 h-24 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-8 w-40" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="flex flex-col items-center">
                  <div className={`w-24 h-24 rounded-full bg-muted flex items-center justify-center ${RANK_COLORS[rankTier]}`}>
                    <Crown className="w-12 h-12" />
                  </div>
                  <p className={`text-xl font-bold mt-2 ${RANK_COLORS[rankTier]}`}>
                    {RANK_LABELS[rankTier]} {rankTier !== 'unranked' && rankDivision}
                  </p>
                  {rankTier !== 'unranked' && (
                    <p className="text-sm text-muted-foreground">{rankPoints} RP</p>
                  )}
                </div>

                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-500">{rankedWins}</p>
                    <p className="text-xs text-muted-foreground">{t('ranking.wins', 'Wins')}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-500">{rankedLosses}</p>
                    <p className="text-xs text-muted-foreground">{t('ranking.losses', 'Losses')}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{winRate}%</p>
                    <p className="text-xs text-muted-foreground">{t('ranking.winRate', 'Win Rate')}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{progression?.winStreak || 0}</p>
                    <p className="text-xs text-muted-foreground">{t('ranking.winStreak', 'Win Streak')}</p>
                  </div>
                </div>
              </div>

              {!isPlacementComplete && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium mb-2">{t('ranking.placementProgress', 'Placement Matches')}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${(placementMatchesPlayed / 10) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{placementMatchesPlayed}/10</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('ranking.placementWins', 'Placement Wins')}: {placementWins}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="w-5 h-5" />
              {t('ranking.matchHistory', 'Match History')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {matchesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : matches.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Swords className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t('ranking.noMatches', 'No ranked matches yet')}</p>
                <p className="text-sm mt-2">{t('ranking.playRanked', 'Play ranked games to see your match history')}</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {matches.map((match) => {
                    const isPlayerA = match.playerAId === userId;
                    const myPlayerId = isPlayerA ? match.playerAId : match.playerBId;
                    const playerStats = {
                      lines: isPlayerA ? match.playerALines : match.playerBLines,
                      score: isPlayerA ? match.playerAScore : match.playerBScore,
                      time: isPlayerA ? match.playerATime : match.playerBTime,
                    };
                    const rankChange = isPlayerA ? match.playerARankChange : match.playerBRankChange;
                    const isWin = match.winnerId === myPlayerId;
                    const isPlacement = match.isPlacementMatch;

                    return (
                      <div 
                        key={match.id}
                        className={`p-4 rounded-lg border ${isWin ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}
                        data-testid={`match-item-${match.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isWin ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                              {isWin ? <Trophy className="w-5 h-5" /> : <Target className="w-5 h-5" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-bold ${isWin ? 'text-green-500' : 'text-red-500'}`}>
                                  {isWin ? t('ranking.victory', 'Victory') : t('ranking.defeat', 'Defeat')}
                                </span>
                                {isPlacement && (
                                  <Badge variant="secondary" className="text-xs">
                                    {t('ranking.placement', 'Placement')}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {match.isAiOpponent ? (
                                  <span className="flex items-center gap-1">
                                    <Bot className="w-3 h-3" />
                                    AI ({match.aiDifficulty})
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {t('ranking.player', 'Player')}
                                  </span>
                                )}
                                <span>•</span>
                                <span>{formatDate(match.startedAt)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="flex items-center gap-3 text-sm">
                                <span className="text-muted-foreground">
                                  <Target className="w-3 h-3 inline mr-1" />
                                  {playerStats.lines} {t('ranking.lines', 'lines')}
                                </span>
                                <span className="text-muted-foreground">
                                  <Clock className="w-3 h-3 inline mr-1" />
                                  {formatDuration(playerStats.time)}
                                </span>
                              </div>
                              <p className="font-bold">{playerStats.score.toLocaleString()} pts</p>
                            </div>

                            {!isPlacement && rankChange !== null && (
                              <div className={`flex items-center gap-1 min-w-[60px] justify-end ${(rankChange || 0) > 0 ? 'text-green-500' : (rankChange || 0) < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                {(rankChange || 0) > 0 ? (
                                  <TrendingUp className="w-4 h-4" />
                                ) : (rankChange || 0) < 0 ? (
                                  <TrendingDown className="w-4 h-4" />
                                ) : (
                                  <Minus className="w-4 h-4" />
                                )}
                                <span className="font-bold">
                                  {(rankChange || 0) > 0 ? '+' : ''}{rankChange || 0} RP
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
