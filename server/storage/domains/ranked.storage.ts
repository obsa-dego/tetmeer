import { rankedMatches, type RankedMatch, type InsertRankedMatch } from "@shared/schema";
import { db } from "../../db";
import { eq, desc, sql } from "drizzle-orm";

export class RankedStorage {
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
}
