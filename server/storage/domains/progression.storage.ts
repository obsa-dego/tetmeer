import {
  playerProgression,
  type PlayerProgression,
  type RankTier,
  type RankDivision,
} from "@shared/schema";
import { users } from "@shared/models/auth";
import { db } from "../../db";
import { eq, desc } from "drizzle-orm";

export class ProgressionStorage {
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
      await this.createPlayerProgression(userId);
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
      await this.createPlayerProgression(userId);
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
}
