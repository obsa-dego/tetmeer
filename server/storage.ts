import { 
  gameScores, 
  userProfiles,
  itemPurchases,
  userInventory,
  playerProgression,
  rankedMatches,
  conversations,
  messages,
  friendships,
  blocks,
  userAchievements,
  type GameScore, 
  type InsertGameScore,
  type UserProfile,
  type InsertUserProfile,
  type ItemPurchase,
  type InsertItemPurchase,
  type UserInventory,
  type BlockTexture,
  type PlayerProgression,
  type InsertPlayerProgression,
  type RankedMatch,
  type InsertRankedMatch,
  type RankTier,
  type RankDivision,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type Friendship,
  type UserAchievement,
  type Block,
} from "@shared/schema";
import { users, type User } from "@shared/models/auth";
import { db } from "./db";
import { eq, desc, sql, and, gte } from "drizzle-orm";

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
  
  // Player progression
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
  
  // Ranked matches
  createRankedMatch(match: InsertRankedMatch): Promise<RankedMatch>;
  updateRankedMatch(matchId: string, updates: Partial<RankedMatch>): Promise<RankedMatch | undefined>;
  getRankedMatch(matchId: string): Promise<RankedMatch | undefined>;
  getUserRankedMatches(userId: string, limit?: number): Promise<RankedMatch[]>;
  getRankedLeaderboard(limit?: number): Promise<{ progression: PlayerProgression; user: User | null }[]>;
  
  // Direct Messages - Conversations
  getUserConversations(userId: string): Promise<{ conversation: Conversation; otherUser: User | null; lastMessage: Message | null; unreadCount: number }[]>;
  getOrCreateConversation(participantAId: string, participantBId: string): Promise<Conversation>;
  getConversation(conversationId: string): Promise<Conversation | undefined>;
  
  // Direct Messages - Messages
  getConversationMessages(conversationId: string, limit?: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessagesAsRead(conversationId: string, userId: string): Promise<void>;
  searchUsers(query: string, excludeUserId: string, limit?: number): Promise<User[]>;
  
  // Friends
  addFriend(userId: string, friendId: string): Promise<Friendship>;
  removeFriend(userId: string, friendId: string): Promise<void>;
  getFriends(userId: string): Promise<User[]>;
  isFriend(userId: string, friendId: string): Promise<boolean>;
  
  // Blocks
  blockUser(userId: string, blockedId: string): Promise<Block>;
  
  // Titles
  getOwnedTitles(userId: string): Promise<string[]>;
  setSelectedTitle(userId: string, titleId: string | null): Promise<UserProfile | undefined>;
  grantTitle(userId: string, titleId: string): Promise<UserProfile | undefined>;
  revokeTitle(userId: string, titleId: string): Promise<UserProfile | undefined>;
  
  // Achievements
  getUserAchievements(userId: string): Promise<UserAchievement[]>;
  unlockAchievement(userId: string, achievementId: string): Promise<UserAchievement | undefined>;
  hasAchievement(userId: string, achievementId: string): Promise<boolean>;
  claimAchievementReward(userId: string, achievementId: string): Promise<UserAchievement | undefined>;
  
  unblockUser(userId: string, blockedId: string): Promise<void>;
  getBlockedUsers(userId: string): Promise<User[]>;
  isBlocked(userId: string, blockedId: string): Promise<boolean>;
  isBlockedBy(userId: string, blockedId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async updateUserNickname(userId: string, nickname: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ nickname, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserProfileImage(userId: string, profileImageUrl: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ profileImageUrl, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async createGameScore(score: InsertGameScore): Promise<GameScore> {
    const [newScore] = await db.insert(gameScores).values(score).returning();
    return newScore;
  }

  async getRankedLeaderboard(limit = 100): Promise<any[]> {
    const results = await db
      .select({
        progression: playerProgression,
        user: users,
      })
      .from(playerProgression)
      .leftJoin(users, eq(playerProgression.userId, users.id))
      .where(eq(playerProgression.isPlacementComplete, true))
      .orderBy(desc(playerProgression.rankPoints))
      .limit(limit);

    return results.map((row, index) => ({
      rank: index + 1,
      id: row.progression.id,
      userId: row.progression.userId,
      score: row.progression.rankPoints,
      level: row.progression.level,
      linesCleared: 0,
      playTime: 0,
      createdAt: row.progression.createdAt?.toISOString(),
      user: row.user,
    }));
  }

  async getLeaderboard(filter: 'daily' | 'weekly' | 'allTime', gameMode: string = 'marathon', limit = 50): Promise<any[]> {
    let dateFilter: Date | null = null;
    
    if (filter === 'daily') {
      dateFilter = new Date();
      dateFilter.setHours(0, 0, 0, 0);
    } else if (filter === 'weekly') {
      dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - 7);
    }

    const selectFields = {
      id: gameScores.id,
      oduserId: gameScores.userId,
      score: gameScores.score,
      level: gameScores.level,
      linesCleared: gameScores.linesCleared,
      playTime: gameScores.playTime,
      gameMode: gameScores.gameMode,
      createdAt: gameScores.createdAt,
      userEmail: users.email,
      userNickname: users.nickname,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userProfileImageUrl: users.profileImageUrl,
    };

    const mapResult = (row: any, index: number) => ({
      rank: index + 1,
      id: row.id,
      userId: row.oduserId,
      score: row.score,
      level: row.level,
      linesCleared: row.linesCleared,
      playTime: row.playTime,
      gameMode: row.gameMode,
      createdAt: row.createdAt,
      user: row.userEmail ? {
        id: row.oduserId,
        email: row.userEmail,
        nickname: row.userNickname,
        firstName: row.userFirstName,
        lastName: row.userLastName,
        profileImageUrl: row.userProfileImageUrl,
      } : null,
    });

    const orderByField = gameMode === 'sprint' ? gameScores.playTime : gameScores.score;
    const orderDirection = gameMode === 'sprint' ? gameScores.playTime : desc(gameScores.score);

    if (dateFilter) {
      const results = await db
        .select(selectFields)
        .from(gameScores)
        .leftJoin(users, eq(gameScores.userId, users.id))
        .where(and(
          gte(gameScores.createdAt, dateFilter),
          eq(gameScores.gameMode, gameMode)
        ))
        .orderBy(gameMode === 'sprint' ? gameScores.playTime : desc(gameScores.score))
        .limit(limit);
      
      return results.map(mapResult);
    }

    const results = await db
      .select(selectFields)
      .from(gameScores)
      .leftJoin(users, eq(gameScores.userId, users.id))
      .where(eq(gameScores.gameMode, gameMode))
      .orderBy(gameMode === 'sprint' ? gameScores.playTime : desc(gameScores.score))
      .limit(limit);
    
    return results.map(mapResult);
  }

  async getUserHighScores(userId: string): Promise<{ mode: string; highScore: number; bestTime: number | null; totalGames: number }[]> {
    const modes = ['marathon', 'sprint', 'ultra', 'zen'];
    const results: { mode: string; highScore: number; bestTime: number | null; totalGames: number }[] = [];

    for (const mode of modes) {
      const scores = await db
        .select({
          score: gameScores.score,
          playTime: gameScores.playTime,
        })
        .from(gameScores)
        .where(and(
          eq(gameScores.userId, userId),
          eq(gameScores.gameMode, mode)
        ));

      if (scores.length > 0) {
        const highScore = Math.max(...scores.map(s => s.score));
        const bestTime = mode === 'sprint' ? Math.min(...scores.map(s => s.playTime)) : null;
        results.push({
          mode,
          highScore,
          bestTime,
          totalGames: scores.length,
        });
      } else {
        results.push({
          mode,
          highScore: 0,
          bestTime: null,
          totalGames: 0,
        });
      }
    }

    return results;
  }

  async getProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return profile;
  }

  async upsertProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const [result] = await db
      .insert(userProfiles)
      .values(profile)
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          ...profile,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async updateProfileStats(userId: string, score: number, linesCleared: number, playTime: number): Promise<void> {
    const existing = await this.getProfile(userId);
    
    if (existing) {
      await db
        .update(userProfiles)
        .set({
          highScore: score > existing.highScore! ? score : existing.highScore,
          totalGamesPlayed: (existing.totalGamesPlayed || 0) + 1,
          totalLinesCleared: (existing.totalLinesCleared || 0) + linesCleared,
          totalPlayTime: (existing.totalPlayTime || 0) + playTime,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, userId));
    } else {
      await this.upsertProfile({
        userId,
        highScore: score,
        totalGamesPlayed: 1,
        totalLinesCleared: linesCleared,
        totalPlayTime: playTime,
      });
    }
  }

  async recordItemPurchase(purchase: InsertItemPurchase): Promise<ItemPurchase | null> {
    const [result] = await db
      .insert(itemPurchases)
      .values(purchase)
      .onConflictDoNothing({ target: itemPurchases.paymentId })
      .returning();
    return result || null;
  }

  async isPaymentIdUsed(paymentId: string): Promise<boolean> {
    const [existing] = await db
      .select({ id: itemPurchases.id })
      .from(itemPurchases)
      .where(eq(itemPurchases.paymentId, paymentId))
      .limit(1);
    return !!existing;
  }

  async updateBlockTexture(userId: string, texture: BlockTexture): Promise<UserProfile | undefined> {
    const existing = await this.getProfile(userId);
    
    if (existing) {
      const [result] = await db
        .update(userProfiles)
        .set({
          blockTexture: texture,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, userId))
        .returning();
      return result;
    } else {
      return await this.upsertProfile({
        userId,
        blockTexture: texture,
      });
    }
  }

  async updateSettings(userId: string, updates: { blockTexture?: string; backgroundColor?: string; gridColor?: string; backgroundImage?: string | null }): Promise<UserProfile | undefined> {
    const existing = await this.getProfile(userId);
    
    if (existing) {
      const [result] = await db
        .update(userProfiles)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, userId))
        .returning();
      return result;
    } else {
      return await this.upsertProfile({
        userId,
        ...updates,
      });
    }
  }

  async setPremiumStatus(userId: string, isPremium: boolean): Promise<void> {
    const existing = await this.getProfile(userId);
    
    if (existing) {
      await db
        .update(userProfiles)
        .set({
          isPremium,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, userId));
    } else {
      await this.upsertProfile({
        userId,
        isPremium,
      });
    }
  }


  async getInventory(userId: string): Promise<UserInventory[]> {
    const items = await db
      .select()
      .from(userInventory)
      .where(eq(userInventory.userId, userId));
    
    // Check for expired items with pending duration and apply them
    const now = new Date();
    for (const item of items) {
      if (item.pendingDuration && item.expiresAt && new Date(item.expiresAt) < now) {
        // Current item expired and has pending duration - apply it
        await db
          .update(userInventory)
          .set({
            duration: item.pendingDuration,
            expiresAt: item.pendingExpiresAt,
            purchasedAt: item.pendingPurchasedAt,
            pendingDuration: null,
            pendingExpiresAt: null,
            pendingPurchasedAt: null,
            quantity: 1,
            updatedAt: now,
          })
          .where(eq(userInventory.id, item.id));
        
        // Update item in-memory
        item.duration = item.pendingDuration;
        item.expiresAt = item.pendingExpiresAt;
        item.purchasedAt = item.pendingPurchasedAt;
        item.pendingDuration = null;
        item.pendingExpiresAt = null;
        item.pendingPurchasedAt = null;
        item.quantity = 1;
      }
    }
    
    return items;
  }

  async getInventoryItem(userId: string, itemType: string): Promise<UserInventory | undefined> {
    const [item] = await db
      .select()
      .from(userInventory)
      .where(and(eq(userInventory.userId, userId), eq(userInventory.itemType, itemType)));
    return item;
  }

  async addInventoryItem(userId: string, itemType: string, quantity: number, expiresAt?: Date | null, duration?: string): Promise<UserInventory> {
    const existing = await this.getInventoryItem(userId, itemType);
    
    if (existing) {
      // If item exists but is expired, reset it with new expiry
      const now = new Date();
      const isExpired = existing.expiresAt && new Date(existing.expiresAt) < now;
      
      const [updated] = await db
        .update(userInventory)
        .set({
          quantity: isExpired ? quantity : existing.quantity + quantity,
          purchasedAt: isExpired ? now : existing.purchasedAt,
          expiresAt: expiresAt,
          duration: duration || existing.duration,
          updatedAt: now,
        })
        .where(eq(userInventory.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(userInventory)
        .values({
          userId,
          itemType,
          quantity,
          purchasedAt: new Date(),
          expiresAt: expiresAt,
          duration: duration || 'one_week',
        })
        .returning();
      return created;
    }
  }

  async useInventoryItem(userId: string, itemType: string): Promise<boolean> {
    const existing = await this.getInventoryItem(userId, itemType);
    
    if (!existing || existing.quantity <= 0) {
      return false;
    }
    
    await db
      .update(userInventory)
      .set({
        quantity: existing.quantity - 1,
        updatedAt: new Date(),
      })
      .where(eq(userInventory.id, existing.id));
    
    return true;
  }

  async setPendingDuration(userId: string, itemType: string, pendingDuration: string, pendingExpiresAt: Date | null, pendingPurchasedAt: Date): Promise<UserInventory | undefined> {
    const existing = await this.getInventoryItem(userId, itemType);
    if (!existing) {
      return undefined;
    }
    
    const [updated] = await db
      .update(userInventory)
      .set({
        pendingDuration,
        pendingExpiresAt,
        pendingPurchasedAt,
        updatedAt: new Date(),
      })
      .where(eq(userInventory.id, existing.id))
      .returning();
    
    return updated;
  }

  // Player Progression Methods
  async getPlayerProgression(userId: string): Promise<PlayerProgression | undefined> {
    const [progression] = await db
      .select()
      .from(playerProgression)
      .where(eq(playerProgression.userId, userId));
    return progression;
  }

  async createPlayerProgression(userId: string): Promise<PlayerProgression> {
    const [newProgression] = await db
      .insert(playerProgression)
      .values({ userId })
      .returning();
    return newProgression;
  }

  async updatePlayerXp(userId: string, xpToAdd: number): Promise<PlayerProgression | undefined> {
    const existing = await this.getPlayerProgression(userId);
    if (!existing) {
      const newProg = await this.createPlayerProgression(userId);
      return this.updatePlayerXp(userId, xpToAdd);
    }

    const newXp = existing.xp + xpToAdd;
    const newLevel = Math.max(1, Math.floor(Math.sqrt(newXp / 100)));

    const [updated] = await db
      .update(playerProgression)
      .set({
        xp: newXp,
        level: newLevel,
        updatedAt: new Date(),
      })
      .where(eq(playerProgression.userId, userId))
      .returning();

    return updated;
  }

  async updatePlayerGem(userId: string, gemToAdd: number): Promise<PlayerProgression | undefined> {
    const existing = await this.getPlayerProgression(userId);
    if (!existing) {
      const newProg = await this.createPlayerProgression(userId);
      return this.updatePlayerGem(userId, gemToAdd);
    }

    const newGem = Math.max(0, existing.gemBalance + gemToAdd);

    const [updated] = await db
      .update(playerProgression)
      .set({
        gemBalance: newGem,
        updatedAt: new Date(),
      })
      .where(eq(playerProgression.userId, userId))
      .returning();

    return updated;
  }

  async updatePlayerRank(userId: string, updates: {
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
  }): Promise<PlayerProgression | undefined> {
    const existing = await this.getPlayerProgression(userId);
    if (!existing) {
      await this.createPlayerProgression(userId);
    }

    // Map totalXp to xp column
    const { totalXp, ...restUpdates } = updates;
    const dbUpdates: any = { ...restUpdates, updatedAt: new Date() };
    if (totalXp !== undefined) {
      dbUpdates.xp = totalXp;
    }

    const [updated] = await db
      .update(playerProgression)
      .set(dbUpdates)
      .where(eq(playerProgression.userId, userId))
      .returning();

    return updated;
  }

  // Ranked Match Methods
  async createRankedMatch(match: InsertRankedMatch): Promise<RankedMatch> {
    const [newMatch] = await db
      .insert(rankedMatches)
      .values(match)
      .returning();
    return newMatch;
  }

  async updateRankedMatch(matchId: string, updates: Partial<RankedMatch>): Promise<RankedMatch | undefined> {
    const [updated] = await db
      .update(rankedMatches)
      .set(updates)
      .where(eq(rankedMatches.id, matchId))
      .returning();
    return updated;
  }

  async getRankedMatch(matchId: string): Promise<RankedMatch | undefined> {
    const [match] = await db
      .select()
      .from(rankedMatches)
      .where(eq(rankedMatches.id, matchId));
    return match;
  }

  async getUserRankedMatches(userId: string, limit: number = 20): Promise<RankedMatch[]> {
    const matches = await db
      .select()
      .from(rankedMatches)
      .where(
        sql`${rankedMatches.playerAId} = ${userId} OR ${rankedMatches.playerBId} = ${userId}`
      )
      .orderBy(desc(rankedMatches.startedAt))
      .limit(limit);
    return matches;
  }

  // Direct Messages - Conversations
  async getUserConversations(userId: string): Promise<{ conversation: Conversation; otherUser: User | null; lastMessage: Message | null; unreadCount: number }[]> {
    const userConversations = await db
      .select()
      .from(conversations)
      .where(
        sql`${conversations.participantAId} = ${userId} OR ${conversations.participantBId} = ${userId}`
      )
      .orderBy(desc(conversations.lastMessageAt));

    const results = await Promise.all(
      userConversations.map(async (conv) => {
        const otherUserId = conv.participantAId === userId ? conv.participantBId : conv.participantAId;
        const otherUser = await this.getUser(otherUserId);
        
        const [lastMessage] = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conv.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        const unreadMessages = await db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, conv.id),
              eq(messages.isRead, false),
              sql`${messages.senderId} != ${userId}`
            )
          );

        return {
          conversation: conv,
          otherUser: otherUser || null,
          lastMessage: lastMessage || null,
          unreadCount: Number(unreadMessages[0]?.count || 0),
        };
      })
    );

    return results;
  }

  async getOrCreateConversation(participantAId: string, participantBId: string): Promise<Conversation> {
    const [existing] = await db
      .select()
      .from(conversations)
      .where(
        sql`(${conversations.participantAId} = ${participantAId} AND ${conversations.participantBId} = ${participantBId})
            OR (${conversations.participantAId} = ${participantBId} AND ${conversations.participantBId} = ${participantAId})`
      );

    if (existing) {
      return existing;
    }

    const [newConversation] = await db
      .insert(conversations)
      .values({
        participantAId,
        participantBId,
        lastMessageAt: new Date(),
      })
      .returning();

    return newConversation;
  }

  async getConversation(conversationId: string): Promise<Conversation | undefined> {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    return conv;
  }

  // Direct Messages - Messages
  async getConversationMessages(conversationId: string, limit: number = 50): Promise<Message[]> {
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
    
    return msgs.reverse();
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db
      .insert(messages)
      .values(message)
      .returning();

    await db
      .update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, message.conversationId));

    return newMessage;
  }

  async markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          sql`${messages.senderId} != ${userId}`
        )
      );
  }

  async searchUsers(query: string, excludeUserId: string, limit: number = 10): Promise<User[]> {
    const searchPattern = `%${query.toLowerCase()}%`;
    const results = await db
      .select()
      .from(users)
      .where(
        and(
          sql`${users.id} != ${excludeUserId}`,
          sql`(LOWER(${users.nickname}) LIKE ${searchPattern} 
               OR LOWER(${users.firstName}) LIKE ${searchPattern}
               OR LOWER(${users.lastName}) LIKE ${searchPattern}
               OR LOWER(${users.email}) LIKE ${searchPattern})`
        )
      )
      .limit(limit);
    return results;
  }

  // Friends
  async addFriend(userId: string, friendId: string): Promise<Friendship> {
    const existing = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.userId, userId),
          eq(friendships.friendId, friendId)
        )
      );
    
    if (existing.length > 0) {
      return existing[0];
    }

    const [friendship] = await db
      .insert(friendships)
      .values({ userId, friendId })
      .returning();
    return friendship;
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    await db
      .delete(friendships)
      .where(
        and(
          eq(friendships.userId, userId),
          eq(friendships.friendId, friendId)
        )
      );
  }

  async getFriends(userId: string): Promise<User[]> {
    const friendRecords = await db
      .select({ friendId: friendships.friendId })
      .from(friendships)
      .where(eq(friendships.userId, userId));
    
    if (friendRecords.length === 0) return [];
    
    const friendIds = friendRecords.map(f => f.friendId);
    const friendUsers = await db
      .select()
      .from(users)
      .where(sql`${users.id} IN (${sql.join(friendIds.map(id => sql`${id}`), sql`, `)})`);
    
    return friendUsers;
  }

  async isFriend(userId: string, friendId: string): Promise<boolean> {
    const [friendship] = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.userId, userId),
          eq(friendships.friendId, friendId)
        )
      );
    return !!friendship;
  }

  // Blocks
  async blockUser(userId: string, blockedId: string): Promise<Block> {
    const existing = await db
      .select()
      .from(blocks)
      .where(
        and(
          eq(blocks.userId, userId),
          eq(blocks.blockedId, blockedId)
        )
      );
    
    if (existing.length > 0) {
      return existing[0];
    }

    // Also remove from friends if exists
    await this.removeFriend(userId, blockedId);

    const [block] = await db
      .insert(blocks)
      .values({ userId, blockedId })
      .returning();
    return block;
  }

  async unblockUser(userId: string, blockedId: string): Promise<void> {
    await db
      .delete(blocks)
      .where(
        and(
          eq(blocks.userId, userId),
          eq(blocks.blockedId, blockedId)
        )
      );
  }

  async getBlockedUsers(userId: string): Promise<User[]> {
    const blockRecords = await db
      .select({ blockedId: blocks.blockedId })
      .from(blocks)
      .where(eq(blocks.userId, userId));
    
    if (blockRecords.length === 0) return [];
    
    const blockedIds = blockRecords.map(b => b.blockedId);
    const blockedUsers = await db
      .select()
      .from(users)
      .where(sql`${users.id} IN (${sql.join(blockedIds.map(id => sql`${id}`), sql`, `)})`);
    
    return blockedUsers;
  }

  async isBlocked(userId: string, blockedId: string): Promise<boolean> {
    const [block] = await db
      .select()
      .from(blocks)
      .where(
        and(
          eq(blocks.userId, userId),
          eq(blocks.blockedId, blockedId)
        )
      );
    return !!block;
  }

  async isBlockedBy(userId: string, blockedId: string): Promise<boolean> {
    const [block] = await db
      .select()
      .from(blocks)
      .where(
        and(
          eq(blocks.userId, blockedId),
          eq(blocks.blockedId, userId)
        )
      );
    return !!block;
  }

  // Titles
  async getOwnedTitles(userId: string): Promise<string[]> {
    const profile = await this.getProfile(userId);
    return profile?.ownedTitles || [];
  }

  async setSelectedTitle(userId: string, titleId: string | null): Promise<UserProfile | undefined> {
    const profile = await this.getProfile(userId);
    if (!profile) return undefined;

    if (titleId !== null) {
      const ownedTitles = profile.ownedTitles || [];
      if (!ownedTitles.includes(titleId)) {
        return undefined;
      }
    }

    const [updated] = await db
      .update(userProfiles)
      .set({
        selectedTitle: titleId,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, userId))
      .returning();
    return updated;
  }

  async grantTitle(userId: string, titleId: string): Promise<UserProfile | undefined> {
    const profile = await this.getProfile(userId);
    if (!profile) {
      await this.upsertProfile({ userId, ownedTitles: [titleId] });
      return this.getProfile(userId);
    }

    const ownedTitles = profile.ownedTitles || [];
    if (ownedTitles.includes(titleId)) {
      return profile;
    }

    const [updated] = await db
      .update(userProfiles)
      .set({
        ownedTitles: [...ownedTitles, titleId],
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, userId))
      .returning();
    return updated;
  }

  async revokeTitle(userId: string, titleId: string): Promise<UserProfile | undefined> {
    const profile = await this.getProfile(userId);
    if (!profile) return undefined;

    const ownedTitles = profile.ownedTitles || [];
    const newTitles = ownedTitles.filter(t => t !== titleId);

    const updates: any = {
      ownedTitles: newTitles,
      updatedAt: new Date(),
    };
    
    if (profile.selectedTitle === titleId) {
      updates.selectedTitle = null;
    }

    const [updated] = await db
      .update(userProfiles)
      .set(updates)
      .where(eq(userProfiles.userId, userId))
      .returning();
    return updated;
  }

  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    return db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId));
  }

  async unlockAchievement(userId: string, achievementId: string): Promise<UserAchievement | undefined> {
    const existing = await db
      .select()
      .from(userAchievements)
      .where(and(
        eq(userAchievements.userId, userId),
        eq(userAchievements.achievementId, achievementId)
      ));
    
    if (existing.length > 0) return existing[0];

    const [achievement] = await db
      .insert(userAchievements)
      .values({
        userId,
        achievementId,
        rewardClaimed: false,
      })
      .returning();
    return achievement;
  }

  async hasAchievement(userId: string, achievementId: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(userAchievements)
      .where(and(
        eq(userAchievements.userId, userId),
        eq(userAchievements.achievementId, achievementId)
      ));
    return !!existing;
  }

  async claimAchievementReward(userId: string, achievementId: string): Promise<UserAchievement | undefined> {
    const [existing] = await db
      .select()
      .from(userAchievements)
      .where(and(
        eq(userAchievements.userId, userId),
        eq(userAchievements.achievementId, achievementId)
      ));
    
    if (!existing || existing.rewardClaimed) return undefined;

    const [updated] = await db
      .update(userAchievements)
      .set({
        rewardClaimed: true,
        claimedAt: new Date(),
      })
      .where(eq(userAchievements.id, existing.id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
