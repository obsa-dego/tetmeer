export type ShopItemType = 'block' | 'badge' | 'pet' | 'floor' | 'board' | 'decoration';

// ========================================
// DURATION SYSTEM
// Centralized configuration for shop item durations
// Easy to modify or add new duration types
// ========================================

export type ShopItemDuration = 'one_day' | 'three_days' | 'one_week' | 'two_weeks' | 'one_month' | 'permanent';

export interface DurationConfig {
  key: ShopItemDuration;
  milliseconds: number;  // 0 for permanent
  labelKey: string;      // i18n key for display
  shortLabelKey: string; // i18n key for short display (e.g., badges)
}

// Duration configurations - modify values here to change all items using that duration
export const DURATION_CONFIGS: Record<ShopItemDuration, DurationConfig> = {
  one_day: {
    key: 'one_day',
    milliseconds: 24 * 60 * 60 * 1000, // 1 day
    labelKey: 'shop.duration.oneDay',
    shortLabelKey: 'shop.duration.oneDayShort',
  },
  three_days: {
    key: 'three_days',
    milliseconds: 3 * 24 * 60 * 60 * 1000, // 3 days
    labelKey: 'shop.duration.threeDays',
    shortLabelKey: 'shop.duration.threeDaysShort',
  },
  one_week: {
    key: 'one_week',
    milliseconds: 7 * 24 * 60 * 60 * 1000, // 7 days
    labelKey: 'shop.duration.oneWeek',
    shortLabelKey: 'shop.duration.oneWeekShort',
  },
  two_weeks: {
    key: 'two_weeks',
    milliseconds: 14 * 24 * 60 * 60 * 1000, // 14 days
    labelKey: 'shop.duration.twoWeeks',
    shortLabelKey: 'shop.duration.twoWeeksShort',
  },
  one_month: {
    key: 'one_month',
    milliseconds: 30 * 24 * 60 * 60 * 1000, // 30 days
    labelKey: 'shop.duration.oneMonth',
    shortLabelKey: 'shop.duration.oneMonthShort',
  },
  permanent: {
    key: 'permanent',
    milliseconds: 0, // Never expires
    labelKey: 'shop.duration.permanent',
    shortLabelKey: 'shop.duration.permanentShort',
  },
};

// Default duration for all shop items (change this to update all items at once)
export const DEFAULT_SHOP_DURATION: ShopItemDuration = 'one_week';

// Helper functions
export function getDurationConfig(duration: ShopItemDuration): DurationConfig {
  return DURATION_CONFIGS[duration];
}

export function getDurationMs(duration: ShopItemDuration): number {
  return DURATION_CONFIGS[duration].milliseconds;
}

export function calculateExpiryDate(duration: ShopItemDuration, purchaseDate: Date = new Date()): Date | null {
  const ms = getDurationMs(duration);
  if (ms === 0) return null; // Permanent - no expiry
  return new Date(purchaseDate.getTime() + ms);
}

export function isItemExpired(expiryDate: Date | null): boolean {
  if (expiryDate === null) return false; // Permanent items never expire
  return new Date() > expiryDate;
}

export function getRemainingTime(expiryDate: Date | null): number {
  if (expiryDate === null) return Infinity; // Permanent
  return Math.max(0, expiryDate.getTime() - Date.now());
}

// Duration ranking for upgrade/downgrade comparison
// Higher number = longer duration = upgrade
export const DURATION_RANK: Record<ShopItemDuration, number> = {
  one_day: 1,
  three_days: 2,
  one_week: 3,
  two_weeks: 4,
  one_month: 5,
  permanent: 6,
};

// Compare two durations: returns 'upgrade' | 'downgrade' | 'same'
export function compareDurations(currentDuration: ShopItemDuration, newDuration: ShopItemDuration): 'upgrade' | 'downgrade' | 'same' {
  const currentRank = DURATION_RANK[currentDuration];
  const newRank = DURATION_RANK[newDuration];
  if (newRank > currentRank) return 'upgrade';
  if (newRank < currentRank) return 'downgrade';
  return 'same';
}

// ========================================

export interface ShopItem {
  id: string;
  type: ShopItemType;
  nameKey: string;
  descriptionKey: string;
  price: number;
  duration: ShopItemDuration;
  icon?: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  // Block Skins
  {
    id: 'block_neon_crystal',
    type: 'block',
    nameKey: 'shop.neonCrystal',
    descriptionKey: 'shop.neonCrystalDesc',
    price: 1200,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'block_obsidian_matte',
    type: 'block',
    nameKey: 'shop.obsidianMatte',
    descriptionKey: 'shop.obsidianMatteDesc',
    price: 800,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'block_hologram',
    type: 'block',
    nameKey: 'shop.hologram',
    descriptionKey: 'shop.hologramDesc',
    price: 2500,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'block_retro_pixel',
    type: 'block',
    nameKey: 'shop.retroPixel',
    descriptionKey: 'shop.retroPixelDesc',
    price: 300,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'model_cloth',
    type: 'block',
    nameKey: 'shop.clothBlock',
    descriptionKey: 'shop.clothBlockDesc',
    price: 500,
    duration: DEFAULT_SHOP_DURATION,
  },
  // Badges
  {
    id: 'badge_beta_tester',
    type: 'badge',
    nameKey: 'shop.betaTester',
    descriptionKey: 'shop.betaTesterDesc',
    price: 500,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'badge_early_bird',
    type: 'badge',
    nameKey: 'shop.earlyBird',
    descriptionKey: 'shop.earlyBirdDesc',
    price: 1000,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'badge_champion',
    type: 'badge',
    nameKey: 'shop.champion',
    descriptionKey: 'shop.championDesc',
    price: 1500,
    duration: DEFAULT_SHOP_DURATION,
  },
  // Pets
  {
    id: 'pet_puppy',
    type: 'pet',
    nameKey: 'shop.puppyPet',
    descriptionKey: 'shop.puppyPetDesc',
    price: 3000,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'pet_cat',
    type: 'pet',
    nameKey: 'shop.catPet',
    descriptionKey: 'shop.catPetDesc',
    price: 2500,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'pet_lion',
    type: 'pet',
    nameKey: 'shop.lionPet',
    descriptionKey: 'shop.lionPetDesc',
    price: 5000,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'pet_gecko',
    type: 'pet',
    nameKey: 'shop.geckoPet',
    descriptionKey: 'shop.geckoPetDesc',
    price: 1500,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'pet_dragon',
    type: 'pet',
    nameKey: 'shop.dragonPet',
    descriptionKey: 'shop.dragonPetDesc',
    price: 8000,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'pet_turtle',
    type: 'pet',
    nameKey: 'shop.turtlePet',
    descriptionKey: 'shop.turtlePetDesc',
    price: 800,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'pet_crab',
    type: 'pet',
    nameKey: 'shop.crabPet',
    descriptionKey: 'shop.crabPetDesc',
    price: 1200,
    duration: DEFAULT_SHOP_DURATION,
  },
  // Grid Floor Materials
  {
    id: 'floor_glass',
    type: 'floor',
    nameKey: 'shop.glassFloor',
    descriptionKey: 'shop.glassFloorDesc',
    price: 500,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'floor_metal',
    type: 'floor',
    nameKey: 'shop.metalFloor',
    descriptionKey: 'shop.metalFloorDesc',
    price: 1000,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'floor_neon',
    type: 'floor',
    nameKey: 'shop.neonFloor',
    descriptionKey: 'shop.neonFloorDesc',
    price: 1800,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'floor_hologram',
    type: 'floor',
    nameKey: 'shop.hologramFloor',
    descriptionKey: 'shop.hologramFloorDesc',
    price: 3500,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'floor_matrix',
    type: 'floor',
    nameKey: 'shop.matrixFloor',
    descriptionKey: 'shop.matrixFloorDesc',
    price: 2200,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'floor_lava',
    type: 'floor',
    nameKey: 'shop.lavaFloor',
    descriptionKey: 'shop.lavaFloorDesc',
    price: 4000,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'floor_ice',
    type: 'floor',
    nameKey: 'shop.iceFloor',
    descriptionKey: 'shop.iceFloorDesc',
    price: 1200,
    duration: DEFAULT_SHOP_DURATION,
  },
  // Board Materials (game board background)
  {
    id: 'board_glass',
    type: 'board',
    nameKey: 'shop.glassBoard',
    descriptionKey: 'shop.glassBoardDesc',
    price: 600,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'board_metal',
    type: 'board',
    nameKey: 'shop.metalBoard',
    descriptionKey: 'shop.metalBoardDesc',
    price: 1000,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'board_neon',
    type: 'board',
    nameKey: 'shop.neonBoard',
    descriptionKey: 'shop.neonBoardDesc',
    price: 1800,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'board_hologram',
    type: 'board',
    nameKey: 'shop.hologramBoard',
    descriptionKey: 'shop.hologramBoardDesc',
    price: 3500,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'board_matrix',
    type: 'board',
    nameKey: 'shop.matrixBoard',
    descriptionKey: 'shop.matrixBoardDesc',
    price: 2200,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'board_carbon',
    type: 'board',
    nameKey: 'shop.carbonBoard',
    descriptionKey: 'shop.carbonBoardDesc',
    price: 1200,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'board_galaxy',
    type: 'board',
    nameKey: 'shop.galaxyBoard',
    descriptionKey: 'shop.galaxyBoardDesc',
    price: 4000,
    duration: DEFAULT_SHOP_DURATION,
  },
  // Decoration Items - Natural Theme
  {
    id: 'deco_stone',
    type: 'decoration',
    nameKey: 'shop.decoStone',
    descriptionKey: 'shop.decoStoneDesc',
    price: 100,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'deco_pond',
    type: 'decoration',
    nameKey: 'shop.decoPond',
    descriptionKey: 'shop.decoPondDesc',
    price: 500,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'deco_tree',
    type: 'decoration',
    nameKey: 'shop.decoTree',
    descriptionKey: 'shop.decoTreeDesc',
    price: 400,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'deco_flower',
    type: 'decoration',
    nameKey: 'shop.decoFlower',
    descriptionKey: 'shop.decoFlowerDesc',
    price: 150,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'deco_mushroom',
    type: 'decoration',
    nameKey: 'shop.decoMushroom',
    descriptionKey: 'shop.decoMushroomDesc',
    price: 200,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'deco_grass',
    type: 'decoration',
    nameKey: 'shop.decoGrass',
    descriptionKey: 'shop.decoGrassDesc',
    price: 120,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'deco_bush',
    type: 'decoration',
    nameKey: 'shop.decoBush',
    descriptionKey: 'shop.decoBushDesc',
    price: 180,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'deco_leaves',
    type: 'decoration',
    nameKey: 'shop.decoLeaves',
    descriptionKey: 'shop.decoLeavesDesc',
    price: 160,
    duration: DEFAULT_SHOP_DURATION,
  },
  // Decoration Items - Fantasy Theme
  {
    id: 'deco_treasure',
    type: 'decoration',
    nameKey: 'shop.decoTreasure',
    descriptionKey: 'shop.decoTreasureDesc',
    price: 600,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'deco_crystal',
    type: 'decoration',
    nameKey: 'shop.decoCrystal',
    descriptionKey: 'shop.decoCrystalDesc',
    price: 450,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'deco_star',
    type: 'decoration',
    nameKey: 'shop.decoStar',
    descriptionKey: 'shop.decoStarDesc',
    price: 300,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'deco_heart',
    type: 'decoration',
    nameKey: 'shop.decoHeart',
    descriptionKey: 'shop.decoHeartDesc',
    price: 250,
    duration: DEFAULT_SHOP_DURATION,
  },
  // Decoration Items - Game Theme
  {
    id: 'deco_mini_tetro',
    type: 'decoration',
    nameKey: 'shop.decoMiniTetro',
    descriptionKey: 'shop.decoMiniTetroDesc',
    price: 350,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'deco_trophy',
    type: 'decoration',
    nameKey: 'shop.decoTrophy',
    descriptionKey: 'shop.decoTrophyDesc',
    price: 700,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'deco_crown',
    type: 'decoration',
    nameKey: 'shop.decoCrown',
    descriptionKey: 'shop.decoCrownDesc',
    price: 800,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'deco_flag',
    type: 'decoration',
    nameKey: 'shop.decoFlag',
    descriptionKey: 'shop.decoFlagDesc',
    price: 280,
    duration: DEFAULT_SHOP_DURATION,
  },
  // Decoration Items - Ambiance Theme
  {
    id: 'deco_lantern',
    type: 'decoration',
    nameKey: 'shop.decoLantern',
    descriptionKey: 'shop.decoLanternDesc',
    price: 380,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'deco_campfire',
    type: 'decoration',
    nameKey: 'shop.decoCampfire',
    descriptionKey: 'shop.decoCampfireDesc',
    price: 550,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'deco_candle',
    type: 'decoration',
    nameKey: 'shop.decoCandle',
    descriptionKey: 'shop.decoCandleDesc',
    price: 220,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'deco_glass_cup',
    type: 'decoration',
    nameKey: 'shop.decoGlassCup',
    descriptionKey: 'shop.decoGlassCupDesc',
    price: 350,
    duration: DEFAULT_SHOP_DURATION,
  },
  {
    id: 'deco_cartoon_pond',
    type: 'decoration',
    nameKey: 'shop.decoCartoonPond',
    descriptionKey: 'shop.decoCartoonPondDesc',
    price: 450,
    duration: DEFAULT_SHOP_DURATION,
  },
];


export function getShopItem(itemId: string): ShopItem | undefined {
  return SHOP_ITEMS.find(item => item.id === itemId);
}
