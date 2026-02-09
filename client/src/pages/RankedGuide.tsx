import { useTranslation } from 'react-i18next';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSidebar } from '@/contexts/SidebarContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { 
  ArrowLeft, Trophy, Swords, Shield, Star, Crown,
  TrendingUp, TrendingDown, Target, Zap, Award
} from 'lucide-react';

const RANK_TIERS = [
  { name: 'Iron', icon: Shield, color: 'text-gray-400', bg: 'bg-gray-500/20', points: '0-99' },
  { name: 'Bronze', icon: Shield, color: 'text-amber-700', bg: 'bg-amber-700/20', points: '100-299' },
  { name: 'Silver', icon: Star, color: 'text-gray-300', bg: 'bg-gray-400/20', points: '300-599' },
  { name: 'Gold', icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-500/20', points: '600-999' },
  { name: 'Platinum', icon: Crown, color: 'text-cyan-300', bg: 'bg-cyan-400/20', points: '1000-1499' },
  { name: 'Diamond', icon: Crown, color: 'text-blue-400', bg: 'bg-blue-500/20', points: '1500-1999' },
  { name: 'Master', icon: Trophy, color: 'text-purple-400', bg: 'bg-purple-500/20', points: '2000-2499' },
  { name: 'Grandmaster', icon: Trophy, color: 'text-red-400', bg: 'bg-red-500/20', points: '2500-2999' },
  { name: 'Challenger', icon: Trophy, color: 'text-yellow-300', bg: 'bg-yellow-400/20', points: '3000+' },
];

export default function RankedGuide() {
  const { t } = useTranslation();
  const { expanded } = useSidebar();
  const { navigateTo } = useNavigation();

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden">
      <Header />
      <main 
        className="flex-1 overflow-auto"
        style={{ 
          paddingLeft: expanded ? '240px' : '88px',
          paddingTop: '2rem',
          paddingRight: '2rem',
          paddingBottom: '2rem'
        }}
      >
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4 mb-6">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigateTo('ranked')}
              data-testid="button-back-to-ranked"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <Trophy className="w-8 h-8 text-primary" />
                {t('rankedGuide.title', '랭크 시스템 가이드')}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t('rankedGuide.subtitle', '랭크 매치의 모든 것을 알아보세요')}
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                {t('rankedGuide.howItWorks', '랭크 시스템 작동 방식')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                {t('rankedGuide.howItWorksDesc', '랭크 매치는 1:1 대전 모드로, 상대방보다 높은 점수를 기록하면 승리합니다. 승패에 따라 RP(Rank Points)가 변동되며, RP에 따라 랭크 티어가 결정됩니다.')}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <TrendingUp className="w-5 h-5 text-green-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-400">{t('rankedGuide.onWin', '승리 시')}</p>
                    <p className="text-sm text-muted-foreground">{t('rankedGuide.onWinDesc', '+15~25 RP 획득 (상대 랭크에 따라 변동)')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <TrendingDown className="w-5 h-5 text-red-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-400">{t('rankedGuide.onLoss', '패배 시')}</p>
                    <p className="text-sm text-muted-foreground">{t('rankedGuide.onLossDesc', '-10~20 RP 감소 (상대 랭크에 따라 변동)')}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-primary" />
                {t('rankedGuide.placement', '배치 경기')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                {t('rankedGuide.placementDesc', '랭크 매치를 처음 시작하면 10판의 배치 경기를 진행합니다. 배치 경기 결과에 따라 초기 랭크가 결정됩니다.')}
              </p>
              <div className="flex items-center gap-2 p-4 rounded-lg bg-primary/10 border border-primary/30">
                <Award className="w-5 h-5 text-primary" />
                <p className="text-sm">{t('rankedGuide.placementNote', '배치 경기 10판 완료 후 정식 랭크가 부여됩니다.')}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" />
                {t('rankedGuide.rankTiers', '랭크 티어')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {RANK_TIERS.map((tier) => {
                  const Icon = tier.icon;
                  return (
                    <div 
                      key={tier.name}
                      className={`flex items-center gap-3 p-3 rounded-lg ${tier.bg} border border-white/10`}
                    >
                      <Icon className={`w-6 h-6 ${tier.color}`} />
                      <div>
                        <p className={`font-medium ${tier.color}`}>{tier.name}</p>
                        <p className="text-xs text-muted-foreground">{tier.points} RP</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                {t('rankedGuide.divisionNote', '각 티어는 IV, III, II, I 디비전으로 나뉘며, I이 가장 높습니다. (Master 이상 제외)')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                {t('rankedGuide.winStreak', '연승 보너스')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                {t('rankedGuide.winStreakDesc', '연속으로 승리하면 추가 RP 보너스를 받습니다.')}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                  3연승: +5 RP
                </Badge>
                <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30">
                  5연승: +10 RP
                </Badge>
                <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                  10연승+: +15 RP
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                {t('rankedGuide.requirements', '참가 조건')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {t('rankedGuide.req1', '계정 레벨 30 이상')}
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {t('rankedGuide.req2', '로그인 상태 필수')}
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {t('rankedGuide.req3', '안정적인 인터넷 연결 권장')}
                </li>
              </ul>
            </CardContent>
          </Card>

          <div className="flex justify-center pt-4">
            <Button 
              onClick={() => navigateTo('ranked')}
              className="gap-2"
              data-testid="button-go-to-ranked"
            >
              <Swords className="w-4 h-4" />
              {t('rankedGuide.goToRanked', '랭크 매치 시작하기')}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
