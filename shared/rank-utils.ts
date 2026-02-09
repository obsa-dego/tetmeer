import { RankTier, RankDivision } from "./schema";

// XP required for each level (cumulative)
// Uses a quadratic formula: XP = level^2 * 100
// Level 1: 100 XP, Level 2: 400 XP, Level 30: 90,000 XP
export function getXpForLevel(level: number): number {
  return level * level * 100;
}

// Calculate level from total XP
export function getLevelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) || 1;
}

// Calculate XP needed for next level
export function getXpToNextLevel(currentXp: number): { current: number; required: number; progress: number } {
  const currentLevel = getLevelFromXp(currentXp);
  const currentLevelXp = getXpForLevel(currentLevel);
  const nextLevelXp = getXpForLevel(currentLevel + 1);
  const xpInCurrentLevel = currentXp - currentLevelXp;
  const xpNeeded = nextLevelXp - currentLevelXp;
  
  return {
    current: xpInCurrentLevel,
    required: xpNeeded,
    progress: xpInCurrentLevel / xpNeeded,
  };
}

// Convert game score to XP
// Base: score * 0.1, with bonuses for speed and lines
export function calculateXpFromGame(params: {
  score: number;
  linesCleared: number;
  playTimeMs: number;
  gameMode: string;
  isRankedMatch?: boolean;
  won?: boolean;
}): number {
  const { score, linesCleared, playTimeMs, gameMode, isRankedMatch, won } = params;
  
  // Base XP from score (10% of score)
  let xp = Math.floor(score * 0.1);
  
  // Bonus for lines cleared (5 XP per line)
  xp += linesCleared * 5;
  
  // Speed bonus for sprint mode
  if (gameMode === "sprint" && linesCleared >= 40) {
    const timeInSeconds = playTimeMs / 1000;
    if (timeInSeconds < 60) xp *= 2;
    else if (timeInSeconds < 90) xp *= 1.5;
    else if (timeInSeconds < 120) xp *= 1.25;
  }
  
  // Ranked match bonus
  if (isRankedMatch) {
    xp *= 1.5;
    if (won) xp *= 1.25; // Extra bonus for winning
  }
  
  return Math.floor(xp);
}

// Rank tier thresholds (rank points)
export const RANK_THRESHOLDS: Record<RankTier, { min: number; max: number }> = {
  unranked: { min: 0, max: 0 },
  iron: { min: 0, max: 399 },
  bronze: { min: 400, max: 799 },
  silver: { min: 800, max: 1199 },
  gold: { min: 1200, max: 1599 },
  platinum: { min: 1600, max: 1999 },
  diamond: { min: 2000, max: 2399 },
  master: { min: 2400, max: 2799 },
  grandmaster: { min: 2800, max: 3199 },
  challenger: { min: 3200, max: Infinity },
};

// Division points within a tier (100 points per division)
export const DIVISION_POINTS = 100;

// Get tier and division from rank points
export function getRankFromPoints(points: number): { tier: RankTier; division: RankDivision; pointsInDivision: number } {
  const tiers: RankTier[] = ["iron", "bronze", "silver", "gold", "platinum", "diamond", "master", "grandmaster", "challenger"];
  
  for (const tier of tiers) {
    const threshold = RANK_THRESHOLDS[tier];
    if (points >= threshold.min && points <= threshold.max) {
      const pointsInTier = points - threshold.min;
      const tierRange = threshold.max - threshold.min + 1;
      const divisionSize = tierRange / 4;
      
      let division: RankDivision;
      let pointsInDivision: number;
      
      if (tier === "master" || tier === "grandmaster" || tier === "challenger") {
        // These tiers don't have divisions
        division = "I";
        pointsInDivision = pointsInTier;
      } else {
        const divisionIndex = Math.min(3, Math.floor(pointsInTier / divisionSize));
        const divisions: RankDivision[] = ["IV", "III", "II", "I"];
        division = divisions[divisionIndex];
        pointsInDivision = pointsInTier % divisionSize;
      }
      
      return { tier, division, pointsInDivision };
    }
  }
  
  return { tier: "iron", division: "IV", pointsInDivision: 0 };
}

// Calculate initial rank from placement matches
export function calculatePlacementRank(wins: number, totalGames: number = 10): { tier: RankTier; division: RankDivision; points: number } {
  // Win rate determines starting rank
  // 0-2 wins: Iron
  // 3-4 wins: Bronze
  // 5-6 wins: Silver
  // 7-8 wins: Gold
  // 9-10 wins: Platinum
  
  let basePoints: number;
  
  if (wins <= 2) {
    basePoints = wins * 50; // 0-100 (Iron IV-III)
  } else if (wins <= 4) {
    basePoints = 200 + (wins - 2) * 100; // 200-400 (Iron I - Bronze III)
  } else if (wins <= 6) {
    basePoints = 500 + (wins - 4) * 150; // 500-800 (Bronze II - Silver IV)
  } else if (wins <= 8) {
    basePoints = 900 + (wins - 6) * 150; // 900-1200 (Silver III - Gold IV)
  } else {
    basePoints = 1300 + (wins - 8) * 150; // 1300-1600 (Gold III - Platinum IV)
  }
  
  const { tier, division } = getRankFromPoints(basePoints);
  return { tier, division, points: basePoints };
}

// Calculate rank point change after a match (Elo-like system)
export function calculateRankPointChange(params: {
  playerPoints: number;
  opponentPoints: number;
  won: boolean;
  isAiOpponent: boolean;
  winStreak: number;
}): number {
  const { playerPoints, opponentPoints, won, isAiOpponent, winStreak } = params;
  
  // Base K-factor (how much points change)
  let kFactor = 32;
  
  // Reduce K-factor against AI (50% of normal)
  if (isAiOpponent) {
    kFactor *= 0.5;
  }
  
  // Expected win probability (Elo formula)
  const expectedWin = 1 / (1 + Math.pow(10, (opponentPoints - playerPoints) / 400));
  
  // Actual result (1 for win, 0 for loss)
  const actual = won ? 1 : 0;
  
  // Base point change
  let change = Math.round(kFactor * (actual - expectedWin));
  
  // Win streak bonus (up to 50% extra for 5+ streak)
  if (won && winStreak >= 2) {
    const streakBonus = Math.min(winStreak * 0.1, 0.5);
    change = Math.round(change * (1 + streakBonus));
  }
  
  // Minimum change of 5 points for a win, -5 for a loss
  if (won && change < 5) change = 5;
  if (!won && change > -5) change = -5;
  
  return change;
}

// Level required for ranked play
export const RANKED_UNLOCK_LEVEL = 30;

// Check if player can play ranked
export function canPlayRanked(level: number): boolean {
  return level >= RANKED_UNLOCK_LEVEL;
}

// Get rank display name
export function getRankDisplayName(tier: RankTier, division: RankDivision): string {
  if (tier === "unranked") return "Unranked";
  
  const tierNames: Record<RankTier, string> = {
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
  
  // Master+ tiers don't show division
  if (tier === "master" || tier === "grandmaster" || tier === "challenger") {
    return tierNames[tier];
  }
  
  return `${tierNames[tier]} ${division}`;
}

// Get rank color for UI
export function getRankColor(tier: RankTier): string {
  const colors: Record<RankTier, string> = {
    unranked: "#6b7280",
    iron: "#5c5c5c",
    bronze: "#cd7f32",
    silver: "#c0c0c0",
    gold: "#ffd700",
    platinum: "#00cec9",
    diamond: "#74b9ff",
    master: "#9b59b6",
    grandmaster: "#e74c3c",
    challenger: "#f39c12",
  };
  return colors[tier];
}

// Aliases for frontend compatibility
export const calculateXpForLevel = getXpForLevel;
export const calculateLevelFromXp = getLevelFromXp;

// Get rank display info (combined info for UI)
export function getRankDisplayInfo(rank: { tier: RankTier; division: RankDivision }): { name: string; color: string } {
  return {
    name: getRankDisplayName(rank.tier, rank.division),
    color: getRankColor(rank.tier),
  };
}
