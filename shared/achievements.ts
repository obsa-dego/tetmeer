import type { TitleId } from "./schema";

export type AchievementCategory = "gameplay" | "progress" | "rank" | "social" | "special";

export interface AchievementReward {
  xp?: number;
  titleId?: TitleId;
}

export interface AchievementDefinition {
  id: string;
  nameKey: string;
  descriptionKey: string;
  category: AchievementCategory;
  icon: string;
  reward: AchievementReward;
  secret?: boolean;
}

export const achievements: Record<string, AchievementDefinition> = {
  first_game: {
    id: "first_game",
    nameKey: "achievements.first_game",
    descriptionKey: "achievements.first_game_desc",
    category: "gameplay",
    icon: "Gamepad2",
    reward: { xp: 100 },
  },
  
  clear_100_lines: {
    id: "clear_100_lines",
    nameKey: "achievements.clear_100_lines",
    descriptionKey: "achievements.clear_100_lines_desc",
    category: "gameplay",
    icon: "Layers",
    reward: { xp: 500 },
  },
  
  clear_1000_lines: {
    id: "clear_1000_lines",
    nameKey: "achievements.clear_1000_lines",
    descriptionKey: "achievements.clear_1000_lines_desc",
    category: "gameplay",
    icon: "Layers",
    reward: { xp: 2000 },
  },
  
  clear_10000_lines: {
    id: "clear_10000_lines",
    nameKey: "achievements.clear_10000_lines",
    descriptionKey: "achievements.clear_10000_lines_desc",
    category: "gameplay",
    icon: "Layers",
    reward: { xp: 10000 },
  },
  
  reach_level_10: {
    id: "reach_level_10",
    nameKey: "achievements.reach_level_10",
    descriptionKey: "achievements.reach_level_10_desc",
    category: "progress",
    icon: "TrendingUp",
    reward: { xp: 1000 },
  },
  
  reach_level_30: {
    id: "reach_level_30",
    nameKey: "achievements.reach_level_30",
    descriptionKey: "achievements.reach_level_30_desc",
    category: "progress",
    icon: "TrendingUp",
    reward: { xp: 5000 },
  },
  
  reach_level_50: {
    id: "reach_level_50",
    nameKey: "achievements.reach_level_50",
    descriptionKey: "achievements.reach_level_50_desc",
    category: "progress",
    icon: "Star",
    reward: { xp: 10000 },
  },
  
  play_10_games: {
    id: "play_10_games",
    nameKey: "achievements.play_10_games",
    descriptionKey: "achievements.play_10_games_desc",
    category: "gameplay",
    icon: "Repeat",
    reward: { xp: 300 },
  },
  
  play_100_games: {
    id: "play_100_games",
    nameKey: "achievements.play_100_games",
    descriptionKey: "achievements.play_100_games_desc",
    category: "gameplay",
    icon: "Repeat",
    reward: { xp: 3000 },
  },
  
  score_10000: {
    id: "score_10000",
    nameKey: "achievements.score_10000",
    descriptionKey: "achievements.score_10000_desc",
    category: "gameplay",
    icon: "Target",
    reward: { xp: 500 },
  },
  
  score_100000: {
    id: "score_100000",
    nameKey: "achievements.score_100000",
    descriptionKey: "achievements.score_100000_desc",
    category: "gameplay",
    icon: "Target",
    reward: { xp: 2000 },
  },
  
  first_ranked_win: {
    id: "first_ranked_win",
    nameKey: "achievements.first_ranked_win",
    descriptionKey: "achievements.first_ranked_win_desc",
    category: "rank",
    icon: "Swords",
    reward: { xp: 500 },
  },
  
  win_10_ranked: {
    id: "win_10_ranked",
    nameKey: "achievements.win_10_ranked",
    descriptionKey: "achievements.win_10_ranked_desc",
    category: "rank",
    icon: "Swords",
    reward: { xp: 2000 },
  },
  
  reach_gold: {
    id: "reach_gold",
    nameKey: "achievements.reach_gold",
    descriptionKey: "achievements.reach_gold_desc",
    category: "rank",
    icon: "Medal",
    reward: { xp: 3000 },
  },
  
  reach_diamond: {
    id: "reach_diamond",
    nameKey: "achievements.reach_diamond",
    descriptionKey: "achievements.reach_diamond_desc",
    category: "rank",
    icon: "Gem",
    reward: { xp: 10000 },
  },
  
  reach_challenger: {
    id: "reach_challenger",
    nameKey: "achievements.reach_challenger",
    descriptionKey: "achievements.reach_challenger_desc",
    category: "rank",
    icon: "Crown",
    reward: { xp: 50000, titleId: "challenger" },
  },
  
  play_all_modes: {
    id: "play_all_modes",
    nameKey: "achievements.play_all_modes",
    descriptionKey: "achievements.play_all_modes_desc",
    category: "gameplay",
    icon: "LayoutGrid",
    reward: { xp: 1500 },
  },
  
  marathon_master: {
    id: "marathon_master",
    nameKey: "achievements.marathon_master",
    descriptionKey: "achievements.marathon_master_desc",
    category: "gameplay",
    icon: "Timer",
    reward: { xp: 2000 },
  },
  
  sprint_master: {
    id: "sprint_master",
    nameKey: "achievements.sprint_master",
    descriptionKey: "achievements.sprint_master_desc",
    category: "gameplay",
    icon: "Zap",
    reward: { xp: 2000 },
  },
  
  add_friend: {
    id: "add_friend",
    nameKey: "achievements.add_friend",
    descriptionKey: "achievements.add_friend_desc",
    category: "social",
    icon: "Users",
    reward: { xp: 200 },
  },
  
  premium_member: {
    id: "premium_member",
    nameKey: "achievements.premium_member",
    descriptionKey: "achievements.premium_member_desc",
    category: "special",
    icon: "Crown",
    reward: { xp: 1000 },
  },
  
  win_streak_5: {
    id: "win_streak_5",
    nameKey: "achievements.win_streak_5",
    descriptionKey: "achievements.win_streak_5_desc",
    category: "rank",
    icon: "Flame",
    reward: { xp: 2000 },
  },
  
  win_streak_10: {
    id: "win_streak_10",
    nameKey: "achievements.win_streak_10",
    descriptionKey: "achievements.win_streak_10_desc",
    category: "rank",
    icon: "Flame",
    reward: { xp: 5000 },
  },
};

export function getAchievement(id: string): AchievementDefinition | undefined {
  return achievements[id];
}

export function getAllAchievements(): AchievementDefinition[] {
  return Object.values(achievements);
}

export function getAchievementsByCategory(category: AchievementCategory): AchievementDefinition[] {
  return Object.values(achievements).filter(a => a.category === category);
}

export const achievementCategories: AchievementCategory[] = ["gameplay", "progress", "rank", "social", "special"];
