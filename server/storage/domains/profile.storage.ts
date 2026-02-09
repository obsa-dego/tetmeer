import { userProfiles, type UserProfile, type InsertUserProfile, type BlockTexture } from "@shared/schema";
import { db } from "../../db";
import { eq } from "drizzle-orm";

export class ProfileStorage {
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
}
