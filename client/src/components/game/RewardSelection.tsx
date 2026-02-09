import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { RewardDefinition, RARITY_COLORS, selectRandomRewards, getRarityLabel } from '@shared/rewards';
import { Sparkles, Zap, Crown, Gift, HelpCircle, Coins, Trophy, Star, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';

interface RewardSelectionProps {
  onComplete: () => void;
  score?: number;
  linesCleared?: number;
}

const ICON_MAP: Record<string, typeof Sparkles> = {
  Sparkles,
  Zap,
  Crown,
  Coins,
};

type Phase = 'base-rewards' | 'selecting' | 'reveal-others' | 'reveal-selected' | 'final-summary';

function calculateBaseRewards(score: number, linesCleared: number) {
  const baseXp = Math.floor(score / 100) + (linesCleared * 10);
  const baseRp = Math.min(1000, Math.floor(score / 10));
  return { baseXp, baseRp };
}

export function RewardSelection({ onComplete, score = 0, linesCleared = 0 }: RewardSelectionProps) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [rewards, setRewards] = useState<RewardDefinition[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('base-rewards');
  const [showBaseAnimation, setShowBaseAnimation] = useState(false);

  const { baseXp, baseRp } = calculateBaseRewards(score, linesCleared);

  useEffect(() => {
    const generated = selectRandomRewards(3);
    setRewards(generated);
    setTimeout(() => setShowBaseAnimation(true), 300);
  }, []);

  const claimMutation = useMutation({
    mutationFn: async (reward: RewardDefinition) => {
      if (!isAuthenticated) return null;
      return apiRequest('POST', '/api/rewards/claim', { rewardId: reward.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/progression'] });
    },
  });

  const handleContinueToBonus = () => {
    setPhase('selecting');
  };

  const handleSelectReward = (index: number) => {
    if (phase !== 'selecting') return;
    
    setSelectedIndex(index);
    const reward = rewards[index];
    claimMutation.mutate(reward);
    
    setPhase('reveal-others');
    
    setTimeout(() => {
      setPhase('reveal-selected');
    }, 1000);
    
    setTimeout(() => {
      setPhase('final-summary');
    }, 2500);
  };

  const handleSkipBonus = () => {
    if (phase !== 'selecting') return;
    setPhase('final-summary');
  };

  const handleComplete = () => {
    onComplete();
  };

  const isCardRevealed = (index: number) => {
    if (phase === 'base-rewards' || phase === 'selecting') return false;
    if (phase === 'reveal-others') return index !== selectedIndex;
    return true;
  };

  const selectedReward = selectedIndex !== null ? rewards[selectedIndex] : null;
  const bonusXp = selectedReward?.type === 'xp' ? selectedReward.value : 0;
  const bonusRp = selectedReward?.type === 'rp' ? selectedReward.value : 0;
  const totalXp = baseXp + bonusXp;
  const totalRp = baseRp + bonusRp;

  if (phase === 'base-rewards') {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
        <div className="max-w-md w-full mx-4">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20 mb-4">
              <Trophy className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{t('rewards.gameComplete', 'Game Complete!')}</h2>
            <p className="text-white/60">{t('rewards.earnedRewards', 'You earned rewards based on your performance')}</p>
          </div>

          <div className={`bg-zinc-900/80 rounded-2xl p-6 border border-zinc-700 mb-6 ${showBaseAnimation ? 'animate-scale-in' : 'opacity-0'}`}>
            <div className="text-center mb-4">
              <div className="text-sm text-white/50 mb-1">{t('game.score', 'Score')}</div>
              <div className="text-3xl font-bold text-white">{score.toLocaleString()}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={`bg-blue-500/20 rounded-xl p-4 text-center border border-blue-500/30 transition-all duration-500 ${showBaseAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '200ms' }}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Star className="w-5 h-5 text-blue-400" />
                  <span className="text-sm text-blue-400">{t('rewards.baseXp', 'Base XP')}</span>
                </div>
                <div className="text-2xl font-bold text-white">+{baseXp.toLocaleString()}</div>
              </div>

              <div className={`bg-amber-500/20 rounded-xl p-4 text-center border border-amber-500/30 transition-all duration-500 ${showBaseAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '400ms' }}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <span className="text-sm text-amber-400">{t('rewards.baseRp', 'Base RP')}</span>
                </div>
                <div className="text-2xl font-bold text-white">+{baseRp.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className={`text-center transition-all duration-500 ${showBaseAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '600ms' }}>
            <Button
              onClick={handleContinueToBonus}
              className="bg-primary hover:bg-primary/90 text-white px-8 py-3 text-lg"
              data-testid="button-continue-bonus"
            >
              {t('rewards.selectBonus', 'Select Bonus Reward')}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'final-summary') {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
        <div className="max-w-md w-full mx-4">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
              <Gift className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{t('rewards.totalRewards', 'Total Rewards')}</h2>
            <p className="text-white/60">{t('rewards.rewardsSummary', 'Here are all the rewards you earned')}</p>
          </div>

          <div className="bg-zinc-900/80 rounded-2xl p-6 border border-zinc-700 mb-6 animate-scale-in">
            <div className="space-y-4">
              <div className="flex items-center justify-between text-white/60 text-sm">
                <span>{t('rewards.base', 'Base')}</span>
                <span>{t('rewards.bonus', 'Bonus')}</span>
                <span>{t('rewards.total', 'Total')}</span>
              </div>

              <div className="bg-blue-500/20 rounded-xl p-4 border border-blue-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-blue-400" />
                    <span className="text-white">{baseXp.toLocaleString()}</span>
                  </div>
                  <span className="text-green-400">+{bonusXp.toLocaleString()}</span>
                  <div className="text-xl font-bold text-blue-400">
                    {totalXp.toLocaleString()} XP
                  </div>
                </div>
              </div>

              <div className="bg-amber-500/20 rounded-xl p-4 border border-amber-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-400" />
                    <span className="text-white">{baseRp.toLocaleString()}</span>
                  </div>
                  <span className="text-green-400">+{bonusRp.toLocaleString()}</span>
                  <div className="text-xl font-bold text-amber-400">
                    {totalRp.toLocaleString()} RP
                  </div>
                </div>
              </div>

              {selectedReward && (
                <div className="text-center text-white/50 text-sm mt-2">
                  {t('rewards.bonusFrom', 'Bonus from')}: {getRarityLabel(selectedReward.rarity)} {selectedReward.type === 'xp' ? 'XP' : 'RP'} {t('rewards.reward', 'Reward')}
                </div>
              )}
            </div>
          </div>

          <div className="text-center">
            <Button
              onClick={handleComplete}
              className="bg-primary hover:bg-primary/90 text-white px-8 py-3 text-lg"
              data-testid="button-complete-rewards"
            >
              {t('rewards.continue', 'Continue')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="max-w-2xl w-full mx-4">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-4">
            <Gift className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{t('rewards.selectReward')}</h2>
          <p className="text-white/60">{t('rewards.selectOne')}</p>
        </div>

        <div className="bg-zinc-900/50 rounded-xl p-4 mb-6 flex justify-center gap-8 border border-zinc-700/50">
          <div className="text-center">
            <div className="text-xs text-white/50">{t('rewards.currentXp', 'Current XP')}</div>
            <div className="text-lg font-bold text-blue-400">+{baseXp.toLocaleString()}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-white/50">{t('rewards.currentRp', 'Current RP')}</div>
            <div className="text-lg font-bold text-amber-400">+{baseRp.toLocaleString()}</div>
          </div>
        </div>

        <div className="flex gap-4 justify-center mb-8" style={{ perspective: '1000px' }}>
          {rewards.map((reward, index) => {
            const colors = RARITY_COLORS[reward.rarity];
            const IconComponent = ICON_MAP[reward.icon] || Sparkles;
            const isSelected = selectedIndex === index;
            const revealed = isCardRevealed(index);

            return (
              <div
                key={reward.id}
                className={`
                  relative flex-1 max-w-[180px] h-[220px]
                  opacity-100 translate-y-0
                  transition-all duration-500
                `}
                style={{ 
                  transitionDelay: `${index * 100}ms`,
                  transformStyle: 'preserve-3d',
                }}
              >
                <div
                  className={`
                    relative w-full h-full transition-transform duration-700
                    ${revealed ? '[transform:rotateY(180deg)]' : ''}
                  `}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <button
                    onClick={() => handleSelectReward(index)}
                    disabled={phase !== 'selecting'}
                    className={`
                      absolute inset-0 w-full h-full p-5 rounded-xl border-2
                      bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-600
                      flex flex-col items-center justify-center gap-3
                      transition-all duration-300
                      ${phase === 'selecting' ? 'hover:scale-105 hover:border-white/40 hover:shadow-lg cursor-pointer' : ''}
                      disabled:cursor-default
                      [backface-visibility:hidden]
                    `}
                    data-testid={`reward-card-${index}`}
                  >
                    <div className="w-16 h-16 rounded-full bg-zinc-700/50 flex items-center justify-center">
                      <HelpCircle className="w-10 h-10 text-zinc-400" />
                    </div>
                    <div className="text-lg font-bold text-zinc-400">???</div>
                    <div className="text-xs text-zinc-500">{t('rewards.mystery')}</div>
                  </button>

                  <div
                    className={`
                      absolute inset-0 w-full h-full p-5 rounded-xl border-2
                      ${colors.bg} ${colors.border}
                      flex flex-col items-center justify-center gap-3
                      [backface-visibility:hidden] [transform:rotateY(180deg)]
                      ${isSelected && phase === 'reveal-selected' ? `scale-110 ${colors.glow} shadow-xl` : ''}
                      ${!isSelected && phase !== 'selecting' ? 'opacity-60 scale-95' : ''}
                      transition-all duration-500
                    `}
                  >
                    <div className={`w-12 h-12 rounded-full ${colors.bg} flex items-center justify-center`}>
                      <IconComponent className={`w-6 h-6 ${colors.text}`} />
                    </div>
                    
                    <div className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>
                      {getRarityLabel(reward.rarity)}
                    </div>
                    
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">
                        +{reward.value} {reward.type === 'rp' ? 'RP' : 'XP'}
                      </div>
                      <div className="text-xs text-white/50 mt-1">
                        {t(reward.descriptionKey)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!isAuthenticated && phase === 'selecting' && (
          <p className="text-center text-white/40 text-sm mb-4">
            {t('rewards.loginRequired')}
          </p>
        )}

        {phase === 'selecting' && (
          <div className="text-center">
            <button
              onClick={handleSkipBonus}
              className="text-white/40 hover:text-white/60 text-sm transition-colors"
              data-testid="button-skip-reward"
            >
              {t('rewards.skip')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
