import { users, type User } from "@shared/models/auth";
import { db } from "../../db";
import { eq, sql, and } from "drizzle-orm";

export class UserStorage {
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
}
