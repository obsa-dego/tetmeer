import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Lock, Check, Gift, Gamepad2, TrendingUp, Swords, Users, Crown, Layers, Target, Repeat, Timer, Zap, Medal, Gem, Flame, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useNavigation } from "@/contexts/NavigationContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { useAuth } from "@/hooks/use-auth";
import { getAllAchievements, type AchievementDefinition, type AchievementCategory, achievementCategories } from "@shared/achievements";

const iconMap: Record<string, any> = {
  Gamepad2,
  Layers,
  TrendingUp,
  Star: Trophy,
  Repeat,
  Target,
  Swords,
  Medal,
  Gem,
  Crown,
  LayoutGrid,
  Timer,
  Zap,
  Users,
  Flame,
};

function getIcon(iconName: string) {
  return iconMap[iconName] || Trophy;
}

function getCategoryIcon(category: AchievementCategory) {
  switch (category) {
    case "gameplay": return Gamepad2;
    case "progress": return TrendingUp;
    case "rank": return Swords;
    case "social": return Users;
    case "special": return Crown;
    default: return Trophy;
  }
}

export default function Achievements() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { navigateTo } = useNavigation();
  const { expanded, notificationOpen, languageOpen, profileOpen } = useSidebar();
  const anyPanelOpen = notificationOpen || languageOpen || profileOpen;
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | "all">("all");
  
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigateTo('landing');
    }
  }, [authLoading, isAuthenticated, navigateTo]);

  const { data: userAchievements, isLoading } = useQuery<{ unlocked: any[] }>({
    queryKey: ["/api/achievements"],
    enabled: isAuthenticated,
  });

  const claimMutation = useMutation({
    mutationFn: async (achievementId: string) => {
      const res = await apiRequest("POST", `/api/achievements/${achievementId}/claim`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/achievements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progression"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/titles"] });
      
      const reward = data.reward;
      let rewardText = "";
      if (reward?.xp) rewardText += `+${reward.xp} XP`;
      if (reward?.titleId) rewardText += (rewardText ? " & " : "") + t(`titles.${reward.titleId}`);
      
      toast({
        title: t("achievements.claimed"),
        description: rewardText,
      });
    },
  });

  const allAchievements = getAllAchievements();
  const unlockedMap = new Map(
    (userAchievements?.unlocked || []).map((a: any) => [a.achievementId, a])
  );

  const filteredAchievements = selectedCategory === "all" 
    ? allAchievements 
    : allAchievements.filter(a => a.category === selectedCategory);

  const unlockedCount = userAchievements?.unlocked?.length || 0;
  const totalCount = allAchievements.length;

  if (authLoading) {
    return (
      <div className="h-screen w-full flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">{t('account.loading')}</p>
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
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-700">
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-primary" />
                <div>
                  <h1 className="text-xl font-bold">{t("achievements.title")}</h1>
                  <p className="text-sm text-zinc-400">
                    {unlockedCount} / {totalCount} {t("achievements.unlocked")}
                  </p>
                </div>
              </div>
              
              {/* Category Filters */}
              <div className="flex gap-2">
                <Button
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory("all")}
                  data-testid="button-category-all"
                >
                  {t("social.all")}
                </Button>
                {achievementCategories.map((cat) => {
                  const Icon = getCategoryIcon(cat);
                  return (
                    <Button
                      key={cat}
                      variant={selectedCategory === cat ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(cat)}
                      className="flex items-center gap-1.5"
                      data-testid={`button-category-${cat}`}
                    >
                      <Icon className="w-4 h-4" />
                      {t(`achievements.categories.${cat}`)}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Achievement List */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(9)].map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAchievements.map((achievement) => {
                    const userAchievement = unlockedMap.get(achievement.id);
                    const isUnlocked = !!userAchievement;
                    const isClaimed = userAchievement?.rewardClaimed;
                    const Icon = getIcon(achievement.icon);
                    
                    return (
                      <div
                        key={achievement.id}
                        className={`p-4 rounded-lg border transition-colors ${
                          isUnlocked
                            ? "bg-zinc-800/70 border-primary/30"
                            : "bg-zinc-900/50 border-zinc-700/50 opacity-60"
                        }`}
                        data-testid={`achievement-${achievement.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2.5 rounded-lg flex-shrink-0 ${isUnlocked ? "bg-primary/20" : "bg-zinc-800"}`}>
                            {isUnlocked ? (
                              <Icon className="w-5 h-5 text-primary" />
                            ) : (
                              <Lock className="w-5 h-5 text-zinc-500" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className={`font-semibold text-sm ${isUnlocked ? "text-white" : "text-zinc-400"}`}>
                                {t(achievement.nameKey)}
                              </h3>
                              {isUnlocked && (
                                <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-zinc-400 mb-2 line-clamp-2">
                              {t(achievement.descriptionKey)}
                            </p>
                            
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {achievement.reward.xp && (
                                <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                                  <Gift className="w-3 h-3 mr-1" />
                                  +{achievement.reward.xp} XP
                                </Badge>
                              )}
                              {achievement.reward.titleId && (
                                <Badge variant="secondary" className="text-xs px-1.5 py-0.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20">
                                  <Crown className="w-3 h-3 mr-1" />
                                  {t(`titles.${achievement.reward.titleId}`)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Claim Button */}
                        {isUnlocked && !isClaimed && (
                          <Button
                            size="sm"
                            onClick={() => claimMutation.mutate(achievement.id)}
                            disabled={claimMutation.isPending}
                            className="w-full mt-3 bg-gradient-to-r from-yellow-500 to-amber-500"
                            data-testid={`button-claim-${achievement.id}`}
                          >
                            <Gift className="w-4 h-4 mr-1" />
                            {t("achievements.claimReward")}
                          </Button>
                        )}
                        {isClaimed && (
                          <div className="mt-3 flex justify-center">
                            <Badge variant="outline" className="text-green-500 border-green-500/30">
                              <Check className="w-3 h-3 mr-1" />
                              {t("achievements.claimed")}
                            </Badge>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
