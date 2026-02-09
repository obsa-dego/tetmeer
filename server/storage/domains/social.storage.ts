import { friendships, blocks, type Friendship, type Block } from "@shared/schema";
import { users, type User } from "@shared/models/auth";
import { db } from "../../db";
import { eq, sql, and } from "drizzle-orm";

export class SocialStorage {
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
}
