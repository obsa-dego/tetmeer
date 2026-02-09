import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, index, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export * from "./models/auth";

export const gameModeEnum = [
  "marathon", "sprint", "ultra", "zen",
  "dig", "survival", "invisible", "zone", "master"
] as const;
export type GameMode = typeof gameModeEnum[number];

export const gameDifficultyEnum = [
  "easy", "normal", "hard", "expert", "ultimate",
  "slow", "fast", "instant", "no_ghost"
] as const;
export type GameDifficulty = typeof gameDifficultyEnum[number];

export const gameScores = pgTable("game_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  score: integer("score").notNull(),
  level: integer("level").notNull(),
  linesCleared: integer("lines_cleared").notNull(),
  playTime: integer("play_time").notNull(),
  gameMode: varchar("game_mode").notNull().default("marathon"),
  difficulty: varchar("difficulty"),
  garbageCleared: integer("garbage_cleared"),
  zoneActivations: integer("zone_activations"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("game_scores_user_id_idx").on(table.userId),
  index("game_scores_game_mode_score_idx").on(table.gameMode, table.score),
  index("game_scores_created_at_idx").on(table.createdAt),
]);

export const insertGameScoreSchema = createInsertSchema(gameScores).omit({
  id: true,
  createdAt: true,
});

export type InsertGameScore = z.infer<typeof insertGameScoreSchema>;
export type GameScore = typeof gameScores.$inferSelect;

export const blockTextureEnum = ["default", "metallic", "wood", "block_neon_crystal", "block_obsidian_matte", "block_hologram", "block_retro_pixel", "model_cube", "model_cloth"] as const;
export type BlockTexture = typeof blockTextureEnum[number];

export const gameEngineEnum = ["gravity", "classic", "sand"] as const;
export type GameEngine = typeof gameEngineEnum[number];

// Grid floor material types
export const gridMaterialEnum = ["default", "glass", "metal", "neon", "hologram", "matrix", "lava", "ice"] as const;
export type GridMaterial = typeof gridMaterialEnum[number];

// Board background material types (the panel behind falling blocks)
export const boardMaterialEnum = ["default", "glass", "metal", "neon", "hologram", "matrix", "carbon", "galaxy"] as const;
export type BoardMaterial = typeof boardMaterialEnum[number];

// View mode for 2D/3D rendering
export const viewModeEnum = ["3d", "2d"] as const;
export type ViewMode = typeof viewModeEnum[number];

// Decoration item types for grid floor placement
export const decorationItemEnum = [
  // Natural theme
  "deco_stone", "deco_pond", "deco_tree", "deco_flower", "deco_mushroom", 
  "deco_grass", "deco_bush", "deco_leaves",
  // Fantasy theme
  "deco_treasure", "deco_crystal", "deco_star", "deco_heart",
  // Game theme
  "deco_mini_tetro", "deco_trophy", "deco_crown", "deco_flag",
  // Ambiance theme
  "deco_lantern", "deco_campfire", "deco_candle",
  // Special items
  "deco_glass_cup", "deco_cartoon_pond"
] as const;
export type DecorationItem = typeof decorationItemEnum[number];

// Decoration placement slots (8 positions around the grid) - legacy
export const decorationSlotEnum = [
  "top_left", "top", "top_right", 
  "left", "right", 
  "bottom_left", "bottom", "bottom_right"
] as const;
export type DecorationSlot = typeof decorationSlotEnum[number];

// Equipped decorations type (slot -> item mapping) - legacy
export type EquippedDecorations = Partial<Record<DecorationSlot, DecorationItem>>;

// Free-form decoration placement (new system)
export interface PlacedDecoration {
  id: string;
  itemId: DecorationItem;
  x: number;
  z: number;
}
export type PlacedDecorations = PlacedDecoration[];

// Title system enum
export const titleIdEnum = ["admin", "challenger"] as const;
export type TitleId = typeof titleIdEnum[number];

export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  highScore: integer("high_score").default(0),
  totalGamesPlayed: integer("total_games_played").default(0),
  totalLinesCleared: integer("total_lines_cleared").default(0),
  totalPlayTime: integer("total_play_time").default(0),
  isPremium: boolean("is_premium").default(false),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  paypalSubscriptionId: varchar("paypal_subscription_id"),
  blockTexture: varchar("block_texture").default("default"),
  backgroundColor: varchar("background_color").default("#000000"),
  gridColor: varchar("grid_color").default("#ffffff"),
  invertX: boolean("invert_x").default(false),
  invertY: boolean("invert_y").default(false),
  mouseSensitivity: integer("mouse_sensitivity").default(50),
  wheelSensitivity: integer("wheel_sensitivity").default(50),
  backgroundImage: text("background_image"),
  gameEngine: varchar("game_engine").default("gravity"),
  ownedTitles: text("owned_titles").array().default(sql`ARRAY[]::text[]`),
  selectedTitle: varchar("selected_title"),
  showPet: boolean("show_pet").default(false),
  selectedPets: text("selected_pets").array().default(sql`ARRAY['pet_puppy']::text[]`),
  gridMaterial: varchar("grid_material").default("default"),
  boardMaterial: varchar("board_material").default("default"),
  viewMode: varchar("view_mode").default("3d"),
  equippedDecorations: text("equipped_decorations").default("{}"),
  placedDecorations: text("placed_decorations").default("[]"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // Soft delete support
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;

export const itemPurchases = pgTable("item_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  itemType: varchar("item_type").notNull(),
  amount: integer("amount").notNull(),
  currency: varchar("currency").notNull(),
  paymentProvider: varchar("payment_provider").notNull(),
  paymentId: varchar("payment_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertItemPurchaseSchema = createInsertSchema(itemPurchases).omit({
  id: true,
  createdAt: true,
});

export type InsertItemPurchase = z.infer<typeof insertItemPurchaseSchema>;
export type ItemPurchase = typeof itemPurchases.$inferSelect;

// Acquisition source enum for tracking how items were obtained
export const acquisitionSourceEnum = ['shop', 'admin_gift', 'event', 'achievement', 'unknown'] as const;
export type AcquisitionSource = typeof acquisitionSourceEnum[number];

export const userInventory = pgTable("user_inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  itemType: varchar("item_type").notNull(),
  quantity: integer("quantity").notNull().default(0),
  purchasedAt: timestamp("purchased_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // null means permanent
  duration: varchar("duration").default("one_week"), // duration type used for purchase
  acquisitionSource: varchar("acquisition_source").default("unknown"), // how item was obtained
  pendingDuration: varchar("pending_duration"), // scheduled upgrade/downgrade duration
  pendingExpiresAt: timestamp("pending_expires_at"), // when pending duration expires
  pendingPurchasedAt: timestamp("pending_purchased_at"), // when pending was purchased
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("user_inventory_user_id_idx").on(table.userId),
  index("user_inventory_expires_at_idx").on(table.expiresAt),
]);

export const insertUserInventorySchema = createInsertSchema(userInventory).omit({
  id: true,
  updatedAt: true,
});

export type InsertUserInventory = z.infer<typeof insertUserInventorySchema>;
export type UserInventory = typeof userInventory.$inferSelect;

// Rank tier system (like League of Legends)
export const rankTierEnum = [
  "unranked", "iron", "bronze", "silver", "gold", 
  "platinum", "diamond", "master", "grandmaster", "challenger"
] as const;
export type RankTier = typeof rankTierEnum[number];

// Rank divisions within each tier (IV to I)
export const rankDivisionEnum = ["IV", "III", "II", "I"] as const;
export type RankDivision = typeof rankDivisionEnum[number];

// Player progression table for level/XP and rank
export const playerProgression = pgTable("player_progression", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  
  // Level/XP system
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  
  // Gem (currency) system - DB column remains rp_balance for backward compatibility
  gemBalance: integer("rp_balance").notNull().default(0),
  
  // Rank system
  rankTier: varchar("rank_tier").notNull().default("unranked"),
  rankDivision: varchar("rank_division").default("IV"),
  rankPoints: integer("rank_points").notNull().default(0),
  
  // Placement matches (10 games for initial rank)
  placementMatchesPlayed: integer("placement_matches_played").notNull().default(0),
  placementWins: integer("placement_wins").notNull().default(0),
  isPlacementComplete: boolean("is_placement_complete").notNull().default(false),
  
  // Stats
  rankedWins: integer("ranked_wins").notNull().default(0),
  rankedLosses: integer("ranked_losses").notNull().default(0),
  winStreak: integer("win_streak").notNull().default(0),
  bestWinStreak: integer("best_win_streak").notNull().default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("player_progression_rank_idx").on(table.rankTier, table.rankPoints),
  index("player_progression_level_idx").on(table.level),
]);

export const insertPlayerProgressionSchema = createInsertSchema(playerProgression).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlayerProgression = z.infer<typeof insertPlayerProgressionSchema>;
export type PlayerProgression = typeof playerProgression.$inferSelect;

// Ranked match history
export const rankedMatches = pgTable("ranked_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Players
  playerAId: varchar("player_a_id").notNull().references(() => users.id),
  playerBId: varchar("player_b_id").references(() => users.id), // null if AI opponent
  isAiOpponent: boolean("is_ai_opponent").notNull().default(false),
  aiDifficulty: varchar("ai_difficulty"), // easy, normal, hard, expert based on rank
  
  // Match result
  winnerId: varchar("winner_id"),
  winReason: varchar("win_reason"), // lines_cleared, opponent_topped_out, opponent_disconnected
  
  // Player A stats
  playerALines: integer("player_a_lines").notNull().default(0),
  playerAScore: integer("player_a_score").notNull().default(0),
  playerATime: integer("player_a_time").notNull().default(0), // milliseconds
  
  // Player B stats
  playerBLines: integer("player_b_lines").notNull().default(0),
  playerBScore: integer("player_b_score").notNull().default(0),
  playerBTime: integer("player_b_time").notNull().default(0),
  
  // Rank point changes
  playerARankChange: integer("player_a_rank_change").default(0),
  playerBRankChange: integer("player_b_rank_change").default(0),
  
  // Placement match tracking
  isPlacementMatch: boolean("is_placement_match").notNull().default(false),
  
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
}, (table) => [
  index("ranked_matches_player_a_idx").on(table.playerAId),
  index("ranked_matches_player_b_idx").on(table.playerBId),
  index("ranked_matches_winner_idx").on(table.winnerId),
  index("ranked_matches_started_at_idx").on(table.startedAt),
]);

export const insertRankedMatchSchema = createInsertSchema(rankedMatches).omit({
  id: true,
  startedAt: true,
});

export type InsertRankedMatch = z.infer<typeof insertRankedMatchSchema>;
export type RankedMatch = typeof rankedMatches.$inferSelect;

// Direct Messages - Conversations
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  participantAId: varchar("participant_a_id").notNull(), // No FK: OPERATOR_ID is not a real user
  participantBId: varchar("participant_b_id").notNull(), // No FK: OPERATOR_ID is not a real user
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("conversations_participant_a_idx").on(table.participantAId),
  index("conversations_participant_b_idx").on(table.participantBId),
]);

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Direct Messages - Messages
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  senderId: varchar("sender_id").notNull(), // No FK: OPERATOR_ID is not a real user
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  isRead: boolean("is_read").default(false),
  giftId: varchar("gift_id"), // Links to admin_gifts for claimable gifts
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("messages_conversation_id_idx").on(table.conversationId),
  index("messages_sender_created_idx").on(table.senderId, table.createdAt),
  index("messages_gift_id_idx").on(table.giftId),
]);

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Friend relationships
export const friendships = pgTable("friendships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  friendId: varchar("friend_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("friendships_user_id_idx").on(table.userId),
  index("friendships_friend_id_idx").on(table.friendId),
]);

export const insertFriendshipSchema = createInsertSchema(friendships).omit({
  id: true,
  createdAt: true,
});

export type InsertFriendship = z.infer<typeof insertFriendshipSchema>;
export type Friendship = typeof friendships.$inferSelect;

// Block relationships
export const blocks = pgTable("blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  blockedId: varchar("blocked_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("blocks_user_id_idx").on(table.userId),
  index("blocks_blocked_id_idx").on(table.blockedId),
]);

export const insertBlockSchema = createInsertSchema(blocks).omit({
  id: true,
  createdAt: true,
});

export type InsertBlock = z.infer<typeof insertBlockSchema>;
export type Block = typeof blocks.$inferSelect;

// Achievement system - tracks user achievement progress
export const userAchievements = pgTable("user_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  achievementId: varchar("achievement_id").notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
  rewardClaimed: boolean("reward_claimed").default(false),
  claimedAt: timestamp("claimed_at"),
}, (table) => [
  index("user_achievements_user_id_idx").on(table.userId),
  index("user_achievements_user_achievement_idx").on(table.userId, table.achievementId),
]);

export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({
  id: true,
  unlockedAt: true,
});

export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;
export type UserAchievement = typeof userAchievements.$inferSelect;

// System announcements
export const announcementTypeEnum = ["info", "warning", "maintenance", "event", "update"] as const;
export type AnnouncementType = typeof announcementTypeEnum[number];

export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  titleKo: varchar("title_ko"),
  content: text("content").notNull(),
  contentKo: text("content_ko"),
  type: varchar("type").notNull().default("info"),
  priority: integer("priority").notNull().default(0), // Higher = more important
  isActive: boolean("is_active").notNull().default(true),
  isPinned: boolean("is_pinned").notNull().default(false),
  startsAt: timestamp("starts_at").defaultNow(),
  endsAt: timestamp("ends_at"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("announcements_active_idx").on(table.isActive),
  index("announcements_starts_at_idx").on(table.startsAt),
]);

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcements.$inferSelect;

// Shop item overrides - allows admin to override prices and availability
export const shopItemOverrides = pgTable("shop_item_overrides", {
  id: serial("id").primaryKey(),
  itemId: varchar("item_id").notNull().unique(), // References SHOP_ITEMS constant id
  priceOverride: integer("price_override"), // null = use default price
  isDisabled: boolean("is_disabled").notNull().default(false), // Hide from shop
  discountPercent: integer("discount_percent"), // 0-100, null = no discount
  discountEndsAt: timestamp("discount_ends_at"), // When discount expires
  customName: varchar("custom_name"), // Override display name
  customDescription: text("custom_description"), // Override description
  materialSettings: text("material_settings"), // JSON: {color, metalness, roughness, opacity, emissive}
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("shop_overrides_item_idx").on(table.itemId),
]);

export const insertShopItemOverrideSchema = createInsertSchema(shopItemOverrides).omit({
  id: true,
  updatedAt: true,
});

export type InsertShopItemOverride = z.infer<typeof insertShopItemOverrideSchema>;
export type ShopItemOverride = typeof shopItemOverrides.$inferSelect;

// Admin Gifts - Claimable items/gems sent by operators
export const OPERATOR_ID = "OPERATOR"; // Special ID for operator conversations

export const adminGifts = pgTable("admin_gifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Recipient user ID
  messageId: varchar("message_id"), // Associated message ID
  giftType: varchar("gift_type", { length: 20 }).notNull(), // 'item' | 'gem' | 'both'
  itemId: varchar("item_id"), // Shop item ID if giftType includes item
  itemDuration: varchar("item_duration").default("permanent"), // Duration for gifted item
  gemAmount: integer("gem_amount").default(0), // Gems to give
  sentBy: varchar("sent_by").notNull(), // Admin who sent it
  claimedAt: timestamp("claimed_at"), // null = not claimed
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("admin_gifts_user_idx").on(table.userId),
  index("admin_gifts_message_idx").on(table.messageId),
  index("admin_gifts_claimed_idx").on(table.claimedAt),
]);

export const insertAdminGiftSchema = createInsertSchema(adminGifts).omit({
  id: true,
  createdAt: true,
  claimedAt: true,
});

export type InsertAdminGift = z.infer<typeof insertAdminGiftSchema>;
export type AdminGift = typeof adminGifts.$inferSelect;

// Custom Shop Items - Admin-created items stored in DB
export const customShopItems = pgTable("custom_shop_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { length: 50 }).notNull(), // block, badge, pet, floor, board, decoration
  nameKey: varchar("name_key").notNull(), // i18n key or direct name
  descriptionKey: text("description_key").notNull(), // i18n key or direct description
  modelUrl: varchar("model_url"), // URL to 3D model in object storage
  thumbnailUrl: varchar("thumbnail_url"), // URL to thumbnail image
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("custom_shop_items_type_idx").on(table.type),
  index("custom_shop_items_active_idx").on(table.isActive),
]);

export const insertCustomShopItemSchema = createInsertSchema(customShopItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomShopItem = z.infer<typeof insertCustomShopItemSchema>;
export type CustomShopItem = typeof customShopItems.$inferSelect;

// Shop Item Price Options - Multiple price/duration options per item
export const shopItemPriceOptions = pgTable("shop_item_price_options", {
  id: serial("id").primaryKey(),
  itemId: varchar("item_id").notNull(), // References custom_shop_items.id or SHOP_ITEMS constant id
  isCustomItem: boolean("is_custom_item").notNull().default(false), // true = custom item, false = code-defined
  duration: varchar("duration", { length: 50 }).notNull(), // ShopItemDuration key
  price: integer("price").notNull(),
  isDefault: boolean("is_default").notNull().default(false), // Default option for this item
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("price_options_item_idx").on(table.itemId),
  index("price_options_active_idx").on(table.isActive),
]);

export const insertShopItemPriceOptionSchema = createInsertSchema(shopItemPriceOptions).omit({
  id: true,
  createdAt: true,
});

export type InsertShopItemPriceOption = z.infer<typeof insertShopItemPriceOptionSchema>;
export type ShopItemPriceOption = typeof shopItemPriceOptions.$inferSelect;

// Scheduled Shop Actions - For scheduling item add/update/delete at future time
export const scheduledShopActionTypeEnum = ["create", "update", "delete"] as const;
export type ScheduledShopActionType = typeof scheduledShopActionTypeEnum[number];

export const scheduledShopActions = pgTable("scheduled_shop_actions", {
  id: serial("id").primaryKey(),
  actionType: varchar("action_type", { length: 20 }).notNull(), // create, update, delete
  targetItemId: varchar("target_item_id"), // null for create, item id for update/delete
  isCustomItem: boolean("is_custom_item").notNull().default(false),
  actionData: text("action_data").notNull(), // JSON string with the action payload
  scheduledAt: timestamp("scheduled_at").notNull(), // When to execute
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, processing, executed, failed, cancelled
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  executedAt: timestamp("executed_at"), // When actually executed
  cancelledAt: timestamp("cancelled_at"), // When cancelled
  cancelledBy: varchar("cancelled_by"), // Who cancelled
  errorMessage: text("error_message"), // Error details if failed
  retryCount: integer("retry_count").default(0), // Number of retry attempts
}, (table) => [
  index("scheduled_actions_status_idx").on(table.status),
  index("scheduled_actions_scheduled_at_idx").on(table.scheduledAt),
]);

export const insertScheduledShopActionSchema = createInsertSchema(scheduledShopActions).omit({
  id: true,
  createdAt: true,
  executedAt: true,
  cancelledAt: true,
  cancelledBy: true,
});

export type InsertScheduledShopAction = z.infer<typeof insertScheduledShopActionSchema>;
export type ScheduledShopAction = typeof scheduledShopActions.$inferSelect;

// ==================== UNIFIED SHOP ITEMS ====================
// All shop items (both previously code-defined and admin-created) stored in DB

export const SUPPORTED_LOCALES = ["en", "ko", "ja", "de", "es", "fr"] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export const shopItems = pgTable("shop_items", {
  id: varchar("id").primaryKey(), // Use meaningful IDs like "block_neon_crystal"
  type: varchar("type", { length: 50 }).notNull(), // block, badge, pet, floor, board, decoration
  basePrice: integer("base_price").notNull().default(100), // Default price in gems
  modelUrl: varchar("model_url"), // URL to 3D model
  thumbnailUrl: varchar("thumbnail_url"), // URL to thumbnail
  previewData: text("preview_data"), // JSON for preview settings (colors, etc.)
  isActive: boolean("is_active").notNull().default(true),
  isPremiumOnly: boolean("is_premium_only").notNull().default(false),
  sortOrder: integer("sort_order").default(0),
  createdBy: varchar("created_by"), // null for migrated items
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("shop_items_type_idx").on(table.type),
  index("shop_items_active_idx").on(table.isActive),
  index("shop_items_sort_idx").on(table.sortOrder),
]);

export const insertShopItemSchema = createInsertSchema(shopItems).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertShopItem = z.infer<typeof insertShopItemSchema>;
export type ShopItem = typeof shopItems.$inferSelect;

// Shop Item Translations - i18n support for item names and descriptions
export const shopItemTranslations = pgTable("shop_item_translations", {
  id: serial("id").primaryKey(),
  itemId: varchar("item_id").notNull().references(() => shopItems.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 10 }).notNull(), // en, ko, ja, de, es, fr
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("translations_item_idx").on(table.itemId),
  index("translations_locale_idx").on(table.locale),
  index("translations_item_locale_idx").on(table.itemId, table.locale),
]);

export const insertShopItemTranslationSchema = createInsertSchema(shopItemTranslations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertShopItemTranslation = z.infer<typeof insertShopItemTranslationSchema>;
export type ShopItemTranslation = typeof shopItemTranslations.$inferSelect;
