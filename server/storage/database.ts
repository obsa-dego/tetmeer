import type { IStorage } from "./interface";
import { UserStorage } from "./domains/user.storage";
import { ScoreStorage } from "./domains/score.storage";
import { ProfileStorage } from "./domains/profile.storage";
import { InventoryStorage } from "./domains/inventory.storage";
import { ProgressionStorage } from "./domains/progression.storage";
import { RankedStorage } from "./domains/ranked.storage";
import { ChatStorage } from "./domains/chat.storage";
import { SocialStorage } from "./domains/social.storage";
import { AchievementStorage } from "./domains/achievement.storage";

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
  RankedMatch,
  InsertRankedMatch,
  RankTier,
  RankDivision,
  Conversation,
  Message,
  InsertMessage,
  Friendship,
  UserAchievement,
  Block,
} from "@shared/schema";
import type { User } from "@shared/models/auth";

export class DatabaseStorage implements IStorage {
  private userStorage = new UserStorage();
  private scoreStorage = new ScoreStorage();
  private profileStorage = new ProfileStorage();
  private inventoryStorage = new InventoryStorage();
  private progressionStorage = new ProgressionStorage();
  private rankedStorage = new RankedStorage();
  private chatStorage = new ChatStorage();
  private socialStorage = new SocialStorage();
  private achievementStorage = new AchievementStorage();

  // User
  getUser = (id: string) => this.userStorage.getUser(id);
  updateUserNickname = (userId: string, nickname: string) => this.userStorage.updateUserNickname(userId, nickname);
  updateUserProfileImage = (userId: string, profileImageUrl: string) => this.userStorage.updateUserProfileImage(userId, profileImageUrl);
  searchUsers = (query: string, excludeUserId: string, limit?: number) => this.userStorage.searchUsers(query, excludeUserId, limit);

  // Score
  createGameScore = (score: InsertGameScore) => this.scoreStorage.createGameScore(score);
  getLeaderboard = (filter: 'daily' | 'weekly' | 'allTime', gameMode?: string, limit?: number) => this.scoreStorage.getLeaderboard(filter, gameMode, limit);
  getUserHighScores = (userId: string) => this.scoreStorage.getUserHighScores(userId);

  // Profile
  getProfile = (userId: string) => this.profileStorage.getProfile(userId);
  upsertProfile = (profile: InsertUserProfile) => this.profileStorage.upsertProfile(profile);
  updateProfileStats = (userId: string, score: number, linesCleared: number, playTime: number) => this.profileStorage.updateProfileStats(userId, score, linesCleared, playTime);
  updateBlockTexture = (userId: string, texture: BlockTexture) => this.profileStorage.updateBlockTexture(userId, texture);
  updateSettings = (userId: string, updates: { blockTexture?: string; backgroundColor?: string; gridColor?: string; backgroundImage?: string | null }) => this.profileStorage.updateSettings(userId, updates);
  setPremiumStatus = (userId: string, isPremium: boolean) => this.profileStorage.setPremiumStatus(userId, isPremium);
  getOwnedTitles = (userId: string) => this.profileStorage.getOwnedTitles(userId);
  setSelectedTitle = (userId: string, titleId: string | null) => this.profileStorage.setSelectedTitle(userId, titleId);
  grantTitle = (userId: string, titleId: string) => this.profileStorage.grantTitle(userId, titleId);
  revokeTitle = (userId: string, titleId: string) => this.profileStorage.revokeTitle(userId, titleId);

  // Inventory
  recordItemPurchase = (purchase: InsertItemPurchase) => this.inventoryStorage.recordItemPurchase(purchase);
  isPaymentIdUsed = (paymentId: string) => this.inventoryStorage.isPaymentIdUsed(paymentId);
  getInventory = (userId: string) => this.inventoryStorage.getInventory(userId);
  getInventoryItem = (userId: string, itemType: string) => this.inventoryStorage.getInventoryItem(userId, itemType);
  addInventoryItem = (userId: string, itemType: string, quantity: number, expiresAt?: Date | null, duration?: string) => this.inventoryStorage.addInventoryItem(userId, itemType, quantity, expiresAt, duration);
  useInventoryItem = (userId: string, itemType: string) => this.inventoryStorage.useInventoryItem(userId, itemType);
  setPendingDuration = (userId: string, itemType: string, pendingDuration: string, pendingExpiresAt: Date | null, pendingPurchasedAt: Date) => this.inventoryStorage.setPendingDuration(userId, itemType, pendingDuration, pendingExpiresAt, pendingPurchasedAt);

  // Progression
  getPlayerProgression = (userId: string) => this.progressionStorage.getPlayerProgression(userId);
  createPlayerProgression = (userId: string) => this.progressionStorage.createPlayerProgression(userId);
  updatePlayerXp = (userId: string, xpToAdd: number) => this.progressionStorage.updatePlayerXp(userId, xpToAdd);
  updatePlayerGem = (userId: string, gemToAdd: number) => this.progressionStorage.updatePlayerGem(userId, gemToAdd);
  updatePlayerRank = (userId: string, updates: {
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
  }) => this.progressionStorage.updatePlayerRank(userId, updates);
  getRankedLeaderboard = (limit?: number) => this.progressionStorage.getRankedLeaderboard(limit);

  // Ranked
  createRankedMatch = (match: InsertRankedMatch) => this.rankedStorage.createRankedMatch(match);
  updateRankedMatch = (matchId: string, updates: Partial<RankedMatch>) => this.rankedStorage.updateRankedMatch(matchId, updates);
  getRankedMatch = (matchId: string) => this.rankedStorage.getRankedMatch(matchId);
  getUserRankedMatches = (userId: string, limit?: number) => this.rankedStorage.getUserRankedMatches(userId, limit);

  // Chat
  getUserConversations = (userId: string) => this.chatStorage.getUserConversations(userId);
  getOrCreateConversation = (participantAId: string, participantBId: string) => this.chatStorage.getOrCreateConversation(participantAId, participantBId);
  getConversation = (conversationId: string) => this.chatStorage.getConversation(conversationId);
  getConversationMessages = (conversationId: string, limit?: number) => this.chatStorage.getConversationMessages(conversationId, limit);
  createMessage = (message: InsertMessage) => this.chatStorage.createMessage(message);
  markMessagesAsRead = (conversationId: string, userId: string) => this.chatStorage.markMessagesAsRead(conversationId, userId);

  // Social
  addFriend = (userId: string, friendId: string) => this.socialStorage.addFriend(userId, friendId);
  removeFriend = (userId: string, friendId: string) => this.socialStorage.removeFriend(userId, friendId);
  getFriends = (userId: string) => this.socialStorage.getFriends(userId);
  isFriend = (userId: string, friendId: string) => this.socialStorage.isFriend(userId, friendId);
  blockUser = (userId: string, blockedId: string) => this.socialStorage.blockUser(userId, blockedId);
  unblockUser = (userId: string, blockedId: string) => this.socialStorage.unblockUser(userId, blockedId);
  getBlockedUsers = (userId: string) => this.socialStorage.getBlockedUsers(userId);
  isBlocked = (userId: string, blockedId: string) => this.socialStorage.isBlocked(userId, blockedId);
  isBlockedBy = (userId: string, blockedId: string) => this.socialStorage.isBlockedBy(userId, blockedId);

  // Achievements
  getUserAchievements = (userId: string) => this.achievementStorage.getUserAchievements(userId);
  unlockAchievement = (userId: string, achievementId: string) => this.achievementStorage.unlockAchievement(userId, achievementId);
  hasAchievement = (userId: string, achievementId: string) => this.achievementStorage.hasAchievement(userId, achievementId);
  claimAchievementReward = (userId: string, achievementId: string) => this.achievementStorage.claimAchievementReward(userId, achievementId);
}
