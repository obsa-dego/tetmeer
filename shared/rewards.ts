export type RewardRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type RewardType = 'xp' | 'rp' | 'gem' | 'title' | 'coins';

export interface RewardDefinition {
  id: string;
  type: RewardType;
  rarity: RewardRarity;
  value: number;
  nameKey: string;
  descriptionKey: string;
  icon: string;
}

export const RARITY_WEIGHTS: Record<RewardRarity, number> = {
  common: 50,
  uncommon: 30,
  rare: 15,
  epic: 4,
  legendary: 1,
};

export const RARITY_COLORS: Record<RewardRarity, { bg: string; border: string; text: string; glow: string }> = {
  common: {
    bg: 'bg-zinc-700/50',
    border: 'border-zinc-500',
    text: 'text-zinc-300',
    glow: '',
  },
  uncommon: {
    bg: 'bg-green-900/50',
    border: 'border-green-500',
    text: 'text-green-400',
    glow: 'shadow-green-500/20',
  },
  rare: {
    bg: 'bg-blue-900/50',
    border: 'border-blue-500',
    text: 'text-blue-400',
    glow: 'shadow-blue-500/30',
  },
  epic: {
    bg: 'bg-purple-900/50',
    border: 'border-purple-500',
    text: 'text-purple-400',
    glow: 'shadow-purple-500/40',
  },
  legendary: {
    bg: 'bg-yellow-900/50',
    border: 'border-yellow-500',
    text: 'text-yellow-400',
    glow: 'shadow-yellow-500/50',
  },
};

export const REWARD_POOL: RewardDefinition[] = [
  // XP Rewards
  { id: 'xp_small', type: 'xp', rarity: 'common', value: 50, nameKey: 'rewards.xpSmall', descriptionKey: 'rewards.xpSmallDesc', icon: 'Sparkles' },
  { id: 'xp_medium', type: 'xp', rarity: 'uncommon', value: 150, nameKey: 'rewards.xpMedium', descriptionKey: 'rewards.xpMediumDesc', icon: 'Sparkles' },
  { id: 'xp_large', type: 'xp', rarity: 'rare', value: 350, nameKey: 'rewards.xpLarge', descriptionKey: 'rewards.xpLargeDesc', icon: 'Sparkles' },
  { id: 'xp_huge', type: 'xp', rarity: 'epic', value: 750, nameKey: 'rewards.xpHuge', descriptionKey: 'rewards.xpHugeDesc', icon: 'Zap' },
  { id: 'xp_massive', type: 'xp', rarity: 'legendary', value: 1500, nameKey: 'rewards.xpMassive', descriptionKey: 'rewards.xpMassiveDesc', icon: 'Crown' },
  // Gem Rewards
  { id: 'gem_small', type: 'gem', rarity: 'common', value: 25, nameKey: 'rewards.gemSmall', descriptionKey: 'rewards.gemSmallDesc', icon: 'Gem' },
  { id: 'gem_medium', type: 'gem', rarity: 'uncommon', value: 75, nameKey: 'rewards.gemMedium', descriptionKey: 'rewards.gemMediumDesc', icon: 'Gem' },
  { id: 'gem_large', type: 'gem', rarity: 'rare', value: 200, nameKey: 'rewards.gemLarge', descriptionKey: 'rewards.gemLargeDesc', icon: 'Gem' },
  { id: 'gem_huge', type: 'gem', rarity: 'epic', value: 500, nameKey: 'rewards.gemHuge', descriptionKey: 'rewards.gemHugeDesc', icon: 'Gem' },
  { id: 'gem_massive', type: 'gem', rarity: 'legendary', value: 1000, nameKey: 'rewards.gemMassive', descriptionKey: 'rewards.gemMassiveDesc', icon: 'Gem' },
];

export function selectRandomRewards(count: number = 3): RewardDefinition[] {
  const totalWeight = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  const rewards: RewardDefinition[] = [];
  const usedIds = new Set<string>();

  while (rewards.length < count) {
    let random = Math.random() * totalWeight;
    let selectedRarity: RewardRarity = 'common';

    for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS) as [RewardRarity, number][]) {
      random -= weight;
      if (random <= 0) {
        selectedRarity = rarity;
        break;
      }
    }

    const eligibleRewards = REWARD_POOL.filter(r => r.rarity === selectedRarity && !usedIds.has(r.id));
    
    if (eligibleRewards.length > 0) {
      const reward = eligibleRewards[Math.floor(Math.random() * eligibleRewards.length)];
      rewards.push(reward);
      usedIds.add(reward.id);
    } else {
      const fallbackRewards = REWARD_POOL.filter(r => !usedIds.has(r.id));
      if (fallbackRewards.length > 0) {
        const reward = fallbackRewards[Math.floor(Math.random() * fallbackRewards.length)];
        rewards.push(reward);
        usedIds.add(reward.id);
      }
    }
  }

  return rewards;
}

export function getRarityLabel(rarity: RewardRarity): string {
  const labels: Record<RewardRarity, string> = {
    common: '일반',
    uncommon: '고급',
    rare: '희귀',
    epic: '영웅',
    legendary: '전설',
  };
  return labels[rarity];
}
