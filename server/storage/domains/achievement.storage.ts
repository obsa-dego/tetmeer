import { userAchievements, type UserAchievement } from "@shared/schema";
import { db } from "../../db";
import { eq, and } from "drizzle-orm";

export class AchievementStorage {
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
