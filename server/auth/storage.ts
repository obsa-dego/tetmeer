import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../db";
import { eq } from "drizzle-orm";

// Interface for auth storage operations
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const userId = userData.id;

    // First try to find existing user by ID (primary lookup)
    if (userId) {
      const [existingById] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (existingById) {
        // User exists with this ID — safe to update
        const [user] = await db
          .update(users)
          .set({
            nickname: userData.nickname,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            email: userData.email,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId))
          .returning();
        return user;
      }
    }

    // No user with this ID — check for email collision
    if (userData.email) {
      const [existingByEmail] = await db
        .select()
        .from(users)
        .where(eq(users.email, userData.email));

      if (existingByEmail) {
        // Email already belongs to a different user ID
        // Do NOT overwrite their ID — create new user without email to avoid conflict
        console.warn(
          `Auth: email ${userData.email} already belongs to user ${existingByEmail.id}, creating new user ${userId} without email`
        );
        const [user] = await db
          .insert(users)
          .values({
            ...userData,
            email: null, // Avoid unique constraint violation
          })
          .returning();
        return user;
      }
    }

    // No collision — insert new user
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
