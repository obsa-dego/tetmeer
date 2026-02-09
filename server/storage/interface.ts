import type {
  GameScore,
  InsertGameScore,
  UserProfile,
  InsertUserProfile,
  ItemPurchase,
  InsertItemPurchase,
  UserInventory,
  BlockTexture,
  PlayerProgression,
  InsertPlayerProgression,
  RankedMatch,
  InsertRankedMatch,
  RankTier,
  RankDivision,
  Conversation,
  InsertConversation,
  Message,
  InsertMessage,
  Friendship,
  UserAchievement,
  Block,
} from "@shared/schema";
import type { User } from "@shared/models/auth";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  updateUserNickname(userId: string, nickname: string): Promise<User | undefined>;
  updateUserProfileImage(userId: string, profileImageUrl: string): Promise<User | undefined>;

  createGameScore(score: InsertGameScore): Promise<GameScore>;
  getLeaderboard(filter: 'daily' | 'weekly' | 'allTime', gameMode?: string, limit?: number): Promise<any[]>;
  getUserHighScores(userId: string): Promise<{ mode: string; highScore: number; bestTime: number | null; totalGames: number }[]>;

  getProfile(userId: string): Promise<UserProfile | undefined>;
  upsertProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateProfileStats(userId: string, score: number, linesCleared: number, playTime: number): Promise<void>;
  updateBlockTexture(userId: string, texture: BlockTexture): Promise<UserProfile | undefined>;
  updateSettings(userId: string, updates: { blockTexture?: string; backgroundColor?: string; gridColor?: string; backgroundImage?: string | null }): Promise<UserProfile | undefined>;

  recordItemPurchase(purchase: InsertItemPurchase): Promise<ItemPurchase | null>;
  isPaymentIdUsed(paymentId: string): Promise<boolean>;
  setPremiumStatus(userId: string, isPremium: boolean): Promise<void>;
  getInventory(userId: string): Promise<UserInventory[]>;
  getInventoryItem(userId: string, itemType: string): Promise<UserInventory | undefined>;
  addInventoryItem(userId: string, itemType: string, quantity: number, expiresAt?: Date | null, duration?: string): Promise<UserInventory>;
  useInventoryItem(userId: string, itemType: string): Promise<boolean>;
  setPendingDuration(userId: string, itemType: string, pendingDuration: string, pendingExpiresAt: Date | null, pendingPurchasedAt: Date): Promise<UserInventory | undefined>;

  getPlayerProgression(userId: string): Promise<PlayerProgression | undefined>;
  createPlayerProgression(userId: string): Promise<PlayerProgression>;
  updatePlayerXp(userId: string, xpToAdd: number): Promise<PlayerProgression | undefined>;
  updatePlayerGem(userId: string, gemToAdd: number): Promise<PlayerProgression | undefined>;
  updatePlayerRank(userId: string, updates: {
    rankTier?: RankTier;
    rankDivision?: RankDivision;
    rankPoints?: number;
    rankedWins?: number;
    rankedLosses?: number;
    winStreak?: number;
    bestWinStreak?: number;
    placementMatchesPlayed?: number;
    placementWins?: number;
    isPlacementComplete?: boolean;
    level?: number;
    totalXp?: number;
  }): Promise<PlayerProgression | undefined>;

  createRankedMatch(match: InsertRankedMatch): Promise<RankedMatch>;
  updateRankedMatch(matchId: string, updates: Partial<RankedMatch>): Promise<RankedMatch | undefined>;
  getRankedMatch(matchId: string): Promise<RankedMatch | undefined>;
  getUserRankedMatches(userId: string, limit?: number): Promise<RankedMatch[]>;
  getRankedLeaderboard(limit?: number): Promise<{ progression: PlayerProgression; user: User | null }[]>;

  getUserConversations(userId: string): Promise<{ conversation: Conversation; otherUser: User | null; lastMessage: Message | null; unreadCount: number }[]>;
  getOrCreateConversation(participantAId: string, participantBId: string): Promise<Conversation>;
  getConversation(conversationId: string): Promise<Conversation | undefined>;

  getConversationMessages(conversationId: string, limit?: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessagesAsRead(conversationId: string, userId: string): Promise<void>;
  searchUsers(query: string, excludeUserId: string, limit?: number): Promise<User[]>;

  addFriend(userId: string, friendId: string): Promise<Friendship>;
  removeFriend(userId: string, friendId: string): Promise<void>;
  getFriends(userId: string): Promise<User[]>;
  isFriend(userId: string, friendId: string): Promise<boolean>;

  blockUser(userId: string, blockedId: string): Promise<Block>;
  unblockUser(userId: string, blockedId: string): Promise<void>;
  getBlockedUsers(userId: string): Promise<User[]>;
  isBlocked(userId: string, blockedId: string): Promise<boolean>;
  isBlockedBy(userId: string, blockedId: string): Promise<boolean>;

  getOwnedTitles(userId: string): Promise<string[]>;
  setSelectedTitle(userId: string, titleId: string | null): Promise<UserProfile | undefined>;
  grantTitle(userId: string, titleId: string): Promise<UserProfile | undefined>;
  revokeTitle(userId: string, titleId: string): Promise<UserProfile | undefined>;

  getUserAchievements(userId: string): Promise<UserAchievement[]>;
  unlockAchievement(userId: string, achievementId: string): Promise<UserAchievement | undefined>;
  hasAchievement(userId: string, achievementId: string): Promise<boolean>;
  claimAchievementReward(userId: string, achievementId: string): Promise<UserAchievement | undefined>;
}
