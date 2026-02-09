import { gameScores, type GameScore, type InsertGameScore } from "@shared/schema";
import { users } from "@shared/models/auth";
import { db } from "../../db";
import { eq, desc, sql, and, gte } from "drizzle-orm";

export class ScoreStorage {
  async createGameScore(score: InsertGameScore): Promise<GameScore> {
    const [newScore] = await db.insert(gameScores).values(score).returning();
    return newScore;
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

    const allScores = await db
      .select({
        gameMode: gameScores.gameMode,
        maxScore: sql<number>`MAX(${gameScores.score})`.as("max_score"),
        minPlayTime: sql<number>`MIN(${gameScores.playTime})`.as("min_play_time"),
        totalGames: sql<number>`COUNT(*)`.as("total_games"),
      })
      .from(gameScores)
      .where(eq(gameScores.userId, userId))
      .groupBy(gameScores.gameMode);

    const scoreMap = new Map(allScores.map(s => [s.gameMode, s]));

    return modes.map(mode => {
      const data = scoreMap.get(mode);
      return {
        mode,
        highScore: data ? Number(data.maxScore) : 0,
        bestTime: mode === 'sprint' && data ? Number(data.minPlayTime) : null,
        totalGames: data ? Number(data.totalGames) : 0,
      };
    });
  }
}
