import type { Express, Request, Response } from "express";
import { db } from "./db";
import { users, userProfiles, gameScores, playerProgression, rankedMatches, userInventory, itemPurchases, userAchievements, conversations, messages, friendships, blocks, adminAuditLogs, announcements, shopItemOverrides, adminGifts, OPERATOR_ID, customShopItems, shopItemPriceOptions, scheduledShopActions, shopItems, shopItemTranslations, SUPPORTED_LOCALES } from "@shared/schema";
import { broadcastNewMessage } from "./chat-sse";
import { eq, desc, asc, sql, like, ilike, or, and, isNull, isNotNull } from "drizzle-orm";
import { isAdmin, isSuperAdmin } from "./middleware/admin";
import { isAuthenticated } from "./auth";
import { createAuditLog } from "./middleware/audit";
import { adminRateLimit, strictRateLimit } from "./middleware/rateLimit";
import { z } from "zod";

const updateUserSchema = z.object({
  nickname: z.string().min(1).max(50).optional(),
  role: z.enum(["user", "admin", "super_admin"]).optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

export function registerAdminRoutes(app: Express) {
  app.get("/api/admin/check", isAuthenticated, adminRateLimit, async (req: any, res: Response) => {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.json({ isAdmin: false, role: null });
    }

    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.json({ isAdmin: false, role: null });
      }

      const isAdminUser = user.role === "admin" || user.role === "super_admin";
      return res.json({ isAdmin: isAdminUser, role: user.role });
    } catch (error) {
      console.error("Admin check error:", error);
      return res.json({ isAdmin: false, role: null });
    }
  });

  app.get("/api/admin/stats", isAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
      const [profileCount] = await db.select({ count: sql<number>`count(*)` }).from(userProfiles);
      const [scoreCount] = await db.select({ count: sql<number>`count(*)` }).from(gameScores);
      const [matchCount] = await db.select({ count: sql<number>`count(*)` }).from(rankedMatches);
      const [premiumCount] = await db.select({ count: sql<number>`count(*)` }).from(userProfiles).where(eq(userProfiles.isPremium, true));

      res.json({
        users: Number(userCount.count),
        profiles: Number(profileCount.count),
        gameScores: Number(scoreCount.count),
        rankedMatches: Number(matchCount.count),
        premiumUsers: Number(premiumCount.count),
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/users", isAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      const search = (req.query.search as string) || "";
      const includeDeleted = req.query.includeDeleted === "true";

      const baseCondition = includeDeleted ? undefined : isNull(users.deletedAt);
      
      const baseQuery = db.select({
        id: users.id,
        email: users.email,
        nickname: users.nickname,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        deletedAt: users.deletedAt,
        profileImageUrl: users.profileImageUrl,
        gemBalance: playerProgression.gemBalance,
      })
        .from(users)
        .leftJoin(playerProgression, eq(users.id, playerProgression.userId));

      let userList;
      
      if (search) {
        const searchCondition = or(
          like(users.email, `%${search}%`),
          like(users.nickname, `%${search}%`),
          like(users.firstName, `%${search}%`),
          like(users.lastName, `%${search}%`)
        );
        const whereCondition = baseCondition ? and(baseCondition, searchCondition) : searchCondition;
        userList = await baseQuery
          .where(whereCondition)
          .orderBy(desc(users.createdAt))
          .limit(limit)
          .offset(offset);
      } else {
        userList = baseCondition 
          ? await baseQuery.where(baseCondition).orderBy(desc(users.createdAt)).limit(limit).offset(offset)
          : await baseQuery.orderBy(desc(users.createdAt)).limit(limit).offset(offset);
      }
      
      const [totalResult] = includeDeleted 
        ? await db.select({ count: sql<number>`count(*)` }).from(users)
        : await db.select({ count: sql<number>`count(*)` }).from(users).where(isNull(users.deletedAt));
      const total = Number(totalResult.count);

      res.json({
        users: userList,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/users/:id", isAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
      const [progression] = await db.select().from(playerProgression).where(eq(playerProgression.userId, userId));
      const inventory = await db.select().from(userInventory).where(eq(userInventory.userId, userId));
      const scores = await db.select().from(gameScores).where(eq(gameScores.userId, userId)).orderBy(desc(gameScores.createdAt)).limit(10);
      const matches = await db.select().from(rankedMatches)
        .where(or(eq(rankedMatches.playerAId, userId), eq(rankedMatches.playerBId, userId)))
        .orderBy(desc(rankedMatches.startedAt))
        .limit(10);

      res.json({
        user,
        profile,
        progression,
        inventory,
        recentScores: scores,
        recentMatches: matches,
      });
    } catch (error) {
      console.error("Error fetching user details:", error);
      res.status(500).json({ error: "Failed to fetch user details" });
    }
  });

  app.patch("/api/admin/users/:id", isAdmin, strictRateLimit, async (req: any, res: Response) => {
    try {
      const userId = req.params.id;
      const adminUser = req.adminUser;
      
      const parseResult = updateUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid input", details: parseResult.error.errors });
      }
      
      const { nickname, role } = parseResult.data;

      const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (role !== undefined) {
        if (adminUser.role !== "super_admin") {
          return res.status(403).json({ error: "Only super admin can change roles" });
        }
        if (targetUser.role === "super_admin" && adminUser.id !== targetUser.id) {
          return res.status(403).json({ error: "Cannot modify another super admin" });
        }
      }

      const updates: any = { updatedAt: new Date() };
      if (nickname !== undefined) updates.nickname = nickname;
      if (role !== undefined) updates.role = role;

      const previousValue = { nickname: targetUser.nickname, role: targetUser.role };
      await db.update(users).set(updates).where(eq(users.id, userId));
      const [updatedUser] = await db.select().from(users).where(eq(users.id, userId));

      await createAuditLog(req, {
        action: role !== undefined ? "role_change" : "user_update",
        targetType: "user",
        targetId: userId,
        previousValue,
        newValue: { nickname: updatedUser.nickname, role: updatedUser.role },
      });

      res.json({ user: updatedUser, message: "User updated successfully" });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.patch("/api/admin/users/:id/profile", isAdmin, strictRateLimit, async (req: any, res: Response) => {
    try {
      const userId = req.params.id;
      const updates = req.body;

      const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const profileFields = [
        "highScore", "totalGamesPlayed", "totalLinesCleared", "totalPlayTime",
        "isPremium", "blockTexture", "gameEngine", "gridMaterial", "boardMaterial"
      ];
      
      const filteredUpdates: any = { updatedAt: new Date() };
      const previousValue: Record<string, unknown> = {};
      for (const field of profileFields) {
        if (updates[field] !== undefined) {
          previousValue[field] = (profile as any)[field];
          filteredUpdates[field] = updates[field];
        }
      }

      // Update userProfiles if there are profile field updates
      if (Object.keys(filteredUpdates).length > 1) {
        await db.update(userProfiles).set(filteredUpdates).where(eq(userProfiles.userId, userId));
      }

      // Handle gemBalance separately (stored in playerProgression)
      if (updates.gemBalance !== undefined) {
        const [progression] = await db.select().from(playerProgression).where(eq(playerProgression.userId, userId));
        if (progression) {
          previousValue.gemBalance = progression.gemBalance;
          await db.update(playerProgression)
            .set({ gemBalance: updates.gemBalance })
            .where(eq(playerProgression.userId, userId));
        }
      }

      const [updatedProfile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));

      const isPremiumChange = updates.isPremium !== undefined && updates.isPremium !== profile.isPremium;
      const isGemChange = updates.gemBalance !== undefined;
      await createAuditLog(req, {
        action: isPremiumChange ? (updates.isPremium ? "premium_grant" : "premium_revoke") : isGemChange ? "user_update" : "user_update",
        targetType: "user_profile",
        targetId: userId,
        previousValue,
        newValue: { ...filteredUpdates, ...(updates.gemBalance !== undefined ? { gemBalance: updates.gemBalance } : {}) },
      });

      res.json({ profile: updatedProfile, gemBalance: updates.gemBalance, message: "Profile updated successfully" });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.patch("/api/admin/users/:id/progression", isAdmin, strictRateLimit, async (req: any, res: Response) => {
    try {
      const userId = req.params.id;
      const updates = req.body;

      const [progression] = await db.select().from(playerProgression).where(eq(playerProgression.userId, userId));
      if (!progression) {
        return res.status(404).json({ error: "Progression not found" });
      }

      const allowedFields = [
        "xp", "level", "gemBalance", "rankTier", "rankDivision", "rankPoints",
        "rankedWins", "rankedLosses", "winStreak", "bestWinStreak"
      ];
      
      const filteredUpdates: any = { updatedAt: new Date() };
      const previousValue: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          previousValue[field] = (progression as any)[field];
          filteredUpdates[field] = updates[field];
        }
      }

      await db.update(playerProgression).set(filteredUpdates).where(eq(playerProgression.userId, userId));
      const [updatedProgression] = await db.select().from(playerProgression).where(eq(playerProgression.userId, userId));

      await createAuditLog(req, {
        action: "user_update",
        targetType: "player_progression",
        targetId: userId,
        previousValue,
        newValue: filteredUpdates,
      });

      res.json({ progression: updatedProgression, message: "Progression updated successfully" });
    } catch (error) {
      console.error("Error updating progression:", error);
      res.status(500).json({ error: "Failed to update progression" });
    }
  });

  app.get("/api/admin/game-scores", isAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;

      const scores = await db.select().from(gameScores).orderBy(desc(gameScores.createdAt)).limit(limit).offset(offset);
      const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(gameScores);
      const total = Number(totalResult.count);

      res.json({
        scores,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching game scores:", error);
      res.status(500).json({ error: "Failed to fetch game scores" });
    }
  });

  app.get("/api/admin/ranked-matches", isAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;

      const matches = await db.select().from(rankedMatches).orderBy(desc(rankedMatches.startedAt)).limit(limit).offset(offset);
      const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(rankedMatches);
      const total = Number(totalResult.count);

      res.json({
        matches,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching ranked matches:", error);
      res.status(500).json({ error: "Failed to fetch ranked matches" });
    }
  });

  app.get("/api/admin/purchases", isAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;

      const purchases = await db.select().from(itemPurchases).orderBy(desc(itemPurchases.createdAt)).limit(limit).offset(offset);
      const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(itemPurchases);
      const total = Number(totalResult.count);

      res.json({
        purchases,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching purchases:", error);
      res.status(500).json({ error: "Failed to fetch purchases" });
    }
  });

  app.delete("/api/admin/users/:id", isSuperAdmin, strictRateLimit, async (req: any, res: Response) => {
    try {
      const userId = req.params.id;
      const adminUser = req.adminUser;

      if (userId === adminUser.id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }

      const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (targetUser.role === "super_admin") {
        return res.status(403).json({ error: "Cannot delete super admin accounts" });
      }

      if (targetUser.deletedAt) {
        return res.status(400).json({ error: "User is already deleted" });
      }

      const deletedAt = new Date();
      await db.update(users).set({ deletedAt, updatedAt: deletedAt }).where(eq(users.id, userId));
      await db.update(userProfiles).set({ deletedAt, updatedAt: deletedAt }).where(eq(userProfiles.userId, userId));

      await createAuditLog(req, {
        action: "user_delete",
        targetType: "user",
        targetId: userId,
        previousValue: { email: targetUser.email, nickname: targetUser.nickname, deletedAt: null },
        newValue: { deletedAt: deletedAt.toISOString() },
      });

      res.json({ message: "User soft-deleted successfully. Can be restored later." });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.post("/api/admin/users/:id/restore", isSuperAdmin, strictRateLimit, async (req: any, res: Response) => {
    try {
      const userId = req.params.id;

      const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!targetUser.deletedAt) {
        return res.status(400).json({ error: "User is not deleted" });
      }

      const updatedAt = new Date();
      await db.update(users).set({ deletedAt: null, updatedAt }).where(eq(users.id, userId));
      await db.update(userProfiles).set({ deletedAt: null, updatedAt }).where(eq(userProfiles.userId, userId));

      await createAuditLog(req, {
        action: "user_restore",
        targetType: "user",
        targetId: userId,
        previousValue: { deletedAt: targetUser.deletedAt?.toISOString() },
        newValue: { deletedAt: null },
      });

      res.json({ message: "User restored successfully" });
    } catch (error) {
      console.error("Error restoring user:", error);
      res.status(500).json({ error: "Failed to restore user" });
    }
  });

  app.get("/api/admin/audit-logs", isSuperAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      const action = req.query.action as string | undefined;
      const adminId = req.query.adminId as string | undefined;

      const conditions = [];
      if (action) {
        conditions.push(eq(adminAuditLogs.action, action));
      }
      if (adminId) {
        conditions.push(eq(adminAuditLogs.adminId, adminId));
      }
      
      let logs;
      if (conditions.length > 0) {
        logs = await db.select().from(adminAuditLogs)
          .where(conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`)
          .orderBy(desc(adminAuditLogs.createdAt))
          .limit(limit)
          .offset(offset);
      } else {
        logs = await db.select().from(adminAuditLogs)
          .orderBy(desc(adminAuditLogs.createdAt))
          .limit(limit)
          .offset(offset);
      }
      
      const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(adminAuditLogs);
      const total = Number(totalResult.count);

      res.json({
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // ==================== SHOP ITEMS MANAGEMENT ====================
  app.get("/api/admin/shop/items", isAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const { SHOP_ITEMS } = await import("@shared/shop");
      const type = req.query.type as string | undefined;
      const search = req.query.search as string | undefined;
      
      // Get all overrides from database
      const overrides = await db.select().from(shopItemOverrides);
      const overrideMap = new Map(overrides.map(o => [o.itemId, o]));
      
      let items = SHOP_ITEMS.map(item => {
        const override = overrideMap.get(item.id);
        return {
          ...item,
          originalPrice: item.price,
          price: override?.priceOverride ?? item.price,
          isDisabled: override?.isDisabled ?? false,
          discountPercent: override?.discountPercent ?? null,
          discountEndsAt: override?.discountEndsAt ?? null,
          customName: override?.customName ?? null,
          customDescription: override?.customDescription ?? null,
          materialSettings: override?.materialSettings ?? null,
          hasOverride: !!override,
        };
      });
      
      if (type && type !== 'all') items = items.filter(item => item.type === type);
      
      // Filter by search query (name or ID)
      if (search) {
        const searchLower = search.toLowerCase();
        items = items.filter(item => 
          item.id.toLowerCase().includes(searchLower) ||
          item.nameKey.toLowerCase().includes(searchLower)
        );
      }
      
      res.json({
        items,
        total: items.length,
        types: ["all", "block", "badge", "pet", "floor", "board", "decoration"],
      });
    } catch (error) {
      console.error("Error fetching shop items:", error);
      res.status(500).json({ error: "Failed to fetch shop items" });
    }
  });

  // Update shop item (create or update override)
  app.put("/api/admin/shop/items/:itemId", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const userId = req.user?.claims?.sub;
      const { priceOverride, isDisabled, discountPercent, discountEndsAt, customName, customDescription, materialSettings } = req.body;

      // Verify item exists in SHOP_ITEMS
      const { SHOP_ITEMS } = await import("@shared/shop");
      const baseItem = SHOP_ITEMS.find(item => item.id === itemId);
      if (!baseItem) {
        return res.status(404).json({ error: "Shop item not found" });
      }

      // Check if override already exists
      const [existing] = await db.select().from(shopItemOverrides).where(eq(shopItemOverrides.itemId, itemId));

      let result;
      if (existing) {
        [result] = await db.update(shopItemOverrides).set({
          priceOverride: priceOverride !== undefined ? priceOverride : existing.priceOverride,
          isDisabled: isDisabled !== undefined ? isDisabled : existing.isDisabled,
          discountPercent: discountPercent !== undefined ? discountPercent : existing.discountPercent,
          discountEndsAt: discountEndsAt !== undefined ? (discountEndsAt ? new Date(discountEndsAt) : null) : existing.discountEndsAt,
          customName: customName !== undefined ? customName : existing.customName,
          customDescription: customDescription !== undefined ? customDescription : existing.customDescription,
          materialSettings: materialSettings !== undefined ? materialSettings : existing.materialSettings,
          updatedBy: userId,
          updatedAt: new Date(),
        }).where(eq(shopItemOverrides.itemId, itemId)).returning();
        
        await createAuditLog(req, { action: "settings_change", targetType: "shop_item", targetId: itemId, previousValue: existing, newValue: result });
      } else {
        [result] = await db.insert(shopItemOverrides).values({
          itemId,
          priceOverride,
          isDisabled: isDisabled ?? false,
          discountPercent,
          discountEndsAt: discountEndsAt ? new Date(discountEndsAt) : null,
          customName,
          customDescription,
          materialSettings,
          updatedBy: userId,
        }).returning();
        
        await createAuditLog(req, { action: "settings_change", targetType: "shop_item", targetId: itemId, newValue: result });
      }

      res.json({ success: true, override: result });
    } catch (error) {
      console.error("Error updating shop item:", error);
      res.status(500).json({ error: "Failed to update shop item" });
    }
  });

  // Reset shop item to default (remove override)
  app.delete("/api/admin/shop/items/:itemId", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;

      const [existing] = await db.select().from(shopItemOverrides).where(eq(shopItemOverrides.itemId, itemId));
      if (!existing) {
        return res.status(404).json({ error: "No override exists for this item" });
      }

      await db.delete(shopItemOverrides).where(eq(shopItemOverrides.itemId, itemId));
      await createAuditLog(req, { action: "settings_change", targetType: "shop_item", targetId: itemId, previousValue: existing });

      res.json({ success: true });
    } catch (error) {
      console.error("Error resetting shop item:", error);
      res.status(500).json({ error: "Failed to reset shop item" });
    }
  });

  // ==================== CUSTOM SHOP ITEMS MANAGEMENT ====================
  
  // Get all custom shop items
  app.get("/api/admin/shop/custom-items", isAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const type = req.query.type as string | undefined;
      const includeInactive = req.query.includeInactive === "true";
      
      let conditions = [];
      if (type && type !== "all") conditions.push(eq(customShopItems.type, type));
      if (!includeInactive) conditions.push(eq(customShopItems.isActive, true));
      
      const items = conditions.length > 0
        ? await db.select().from(customShopItems).where(and(...conditions)).orderBy(asc(customShopItems.sortOrder), desc(customShopItems.createdAt))
        : await db.select().from(customShopItems).orderBy(asc(customShopItems.sortOrder), desc(customShopItems.createdAt));
      
      // Get price options for each item
      const itemsWithOptions = await Promise.all(items.map(async (item) => {
        const options = await db.select().from(shopItemPriceOptions)
          .where(and(eq(shopItemPriceOptions.itemId, item.id), eq(shopItemPriceOptions.isCustomItem, true)))
          .orderBy(asc(shopItemPriceOptions.sortOrder));
        return { ...item, priceOptions: options };
      }));
      
      res.json({ items: itemsWithOptions, total: items.length });
    } catch (error) {
      console.error("Error fetching custom shop items:", error);
      res.status(500).json({ error: "Failed to fetch custom shop items" });
    }
  });
  
  // Create custom shop item
  app.post("/api/admin/shop/custom-items", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { type, nameKey, descriptionKey, modelUrl, thumbnailUrl, isActive, sortOrder, priceOptions } = req.body;
      
      if (!type || !nameKey || !descriptionKey) {
        return res.status(400).json({ error: "type, nameKey, and descriptionKey are required" });
      }
      
      const userId = (req as any).user?.claims?.sub;
      
      const [newItem] = await db.insert(customShopItems).values({
        type,
        nameKey,
        descriptionKey,
        modelUrl: modelUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
        createdBy: userId || "admin",
      }).returning();
      
      // Create price options if provided
      if (priceOptions && Array.isArray(priceOptions) && priceOptions.length > 0) {
        await db.insert(shopItemPriceOptions).values(
          priceOptions.map((opt: any, index: number) => ({
            itemId: newItem.id,
            isCustomItem: true,
            duration: opt.duration || "one_week",
            price: opt.price || 100,
            isDefault: opt.isDefault || index === 0,
            isActive: opt.isActive ?? true,
            sortOrder: opt.sortOrder ?? index,
          }))
        );
      }
      
      await createAuditLog(req, { action: "settings_change", targetType: "custom_shop_item", targetId: newItem.id, newValue: newItem });
      
      res.json({ success: true, item: newItem });
    } catch (error) {
      console.error("Error creating custom shop item:", error);
      res.status(500).json({ error: "Failed to create custom shop item" });
    }
  });
  
  // Update custom shop item
  app.put("/api/admin/shop/custom-items/:itemId", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const { type, nameKey, descriptionKey, modelUrl, thumbnailUrl, isActive, sortOrder } = req.body;
      
      const [existing] = await db.select().from(customShopItems).where(eq(customShopItems.id, itemId));
      if (!existing) {
        return res.status(404).json({ error: "Custom shop item not found" });
      }
      
      const [updated] = await db.update(customShopItems).set({
        type: type ?? existing.type,
        nameKey: nameKey ?? existing.nameKey,
        descriptionKey: descriptionKey ?? existing.descriptionKey,
        modelUrl: modelUrl !== undefined ? modelUrl : existing.modelUrl,
        thumbnailUrl: thumbnailUrl !== undefined ? thumbnailUrl : existing.thumbnailUrl,
        isActive: isActive ?? existing.isActive,
        sortOrder: sortOrder ?? existing.sortOrder,
        updatedAt: new Date(),
      }).where(eq(customShopItems.id, itemId)).returning();
      
      await createAuditLog(req, { action: "settings_change", targetType: "custom_shop_item", targetId: itemId, previousValue: existing, newValue: updated });
      
      res.json({ success: true, item: updated });
    } catch (error) {
      console.error("Error updating custom shop item:", error);
      res.status(500).json({ error: "Failed to update custom shop item" });
    }
  });
  
  // Delete custom shop item
  app.delete("/api/admin/shop/custom-items/:itemId", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      
      const [existing] = await db.select().from(customShopItems).where(eq(customShopItems.id, itemId));
      if (!existing) {
        return res.status(404).json({ error: "Custom shop item not found" });
      }
      
      // Delete associated price options first
      await db.delete(shopItemPriceOptions).where(and(eq(shopItemPriceOptions.itemId, itemId), eq(shopItemPriceOptions.isCustomItem, true)));
      
      // Delete the item
      await db.delete(customShopItems).where(eq(customShopItems.id, itemId));
      
      await createAuditLog(req, { action: "settings_change", targetType: "custom_shop_item", targetId: itemId, previousValue: existing });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting custom shop item:", error);
      res.status(500).json({ error: "Failed to delete custom shop item" });
    }
  });
  
  // ==================== PRICE OPTIONS MANAGEMENT ====================
  
  // Get price options for an item
  app.get("/api/admin/shop/price-options/:itemId", isAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const isCustom = req.query.isCustom === "true";
      
      const options = await db.select().from(shopItemPriceOptions)
        .where(and(eq(shopItemPriceOptions.itemId, itemId), eq(shopItemPriceOptions.isCustomItem, isCustom)))
        .orderBy(asc(shopItemPriceOptions.sortOrder));
      
      res.json({ options });
    } catch (error) {
      console.error("Error fetching price options:", error);
      res.status(500).json({ error: "Failed to fetch price options" });
    }
  });
  
  // Create/update price options for an item (replaces all options)
  app.put("/api/admin/shop/price-options/:itemId", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const { isCustomItem, options } = req.body;
      
      if (!Array.isArray(options)) {
        return res.status(400).json({ error: "options must be an array" });
      }
      
      // Check for duplicate durations
      const durations = options.map((opt: any) => opt.duration);
      const uniqueDurations = new Set(durations);
      if (durations.length !== uniqueDurations.size) {
        return res.status(400).json({ error: "Duplicate durations are not allowed" });
      }
      
      // Get existing options for audit log
      const existing = await db.select().from(shopItemPriceOptions)
        .where(and(eq(shopItemPriceOptions.itemId, itemId), eq(shopItemPriceOptions.isCustomItem, isCustomItem ?? false)));
      
      // Delete existing options
      await db.delete(shopItemPriceOptions)
        .where(and(eq(shopItemPriceOptions.itemId, itemId), eq(shopItemPriceOptions.isCustomItem, isCustomItem ?? false)));
      
      // Insert new options
      if (options.length > 0) {
        const newOptions = await db.insert(shopItemPriceOptions).values(
          options.map((opt: any, index: number) => ({
            itemId,
            isCustomItem: isCustomItem ?? false,
            duration: opt.duration || "one_week",
            price: opt.price || 100,
            isDefault: opt.isDefault || index === 0,
            isActive: opt.isActive ?? true,
            sortOrder: opt.sortOrder ?? index,
          }))
        ).returning();
        
        await createAuditLog(req, { action: "settings_change", targetType: "price_options", targetId: itemId, previousValue: { options: existing }, newValue: { options: newOptions } });
        
        res.json({ success: true, options: newOptions });
      } else {
        await createAuditLog(req, { action: "settings_change", targetType: "price_options", targetId: itemId, previousValue: { options: existing }, newValue: { options: [] } });
        res.json({ success: true, options: [] });
      }
    } catch (error) {
      console.error("Error updating price options:", error);
      res.status(500).json({ error: "Failed to update price options" });
    }
  });
  
  // Get upload URL for 3D model
  app.post("/api/admin/shop/upload-model-url", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { ObjectStorageService } = await import("./object-storage/objectStorage");
      const objectStorageService = new ObjectStorageService();

      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL();

      res.json({ uploadURL, objectPath });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // ==================== SCHEDULED SHOP ACTIONS MANAGEMENT ====================
  
  // Get all scheduled actions with optional filters
  app.get("/api/admin/shop/scheduled-actions", isAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      
      let conditions = [];
      if (status && status !== "all") {
        conditions.push(eq(scheduledShopActions.status, status));
      }
      
      const baseQuery = conditions.length > 0 
        ? db.select().from(scheduledShopActions).where(and(...conditions))
        : db.select().from(scheduledShopActions);
      
      const actions = await baseQuery.orderBy(desc(scheduledShopActions.scheduledAt)).limit(limit).offset(offset);
      
      const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(scheduledShopActions)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      
      // Parse actionData JSON for each action
      const parsedActions = actions.map(action => ({
        ...action,
        actionData: JSON.parse(action.actionData || "{}"),
      }));
      
      res.json({
        actions: parsedActions,
        total: totalResult?.count || 0,
        page,
        limit,
      });
    } catch (error) {
      console.error("Error fetching scheduled actions:", error);
      res.status(500).json({ error: "Failed to fetch scheduled actions" });
    }
  });
  
  // Create a new scheduled action
  app.post("/api/admin/shop/scheduled-actions", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { actionType, targetItemId, isCustomItem, actionData, scheduledAt } = req.body;
      
      if (!["create", "update", "delete"].includes(actionType)) {
        return res.status(400).json({ error: "Invalid action type" });
      }
      
      if (!scheduledAt) {
        return res.status(400).json({ error: "scheduledAt is required" });
      }
      
      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate <= new Date()) {
        return res.status(400).json({ error: "Scheduled time must be in the future" });
      }
      
      const [newAction] = await db.insert(scheduledShopActions).values({
        actionType,
        targetItemId: targetItemId || null,
        isCustomItem: isCustomItem || false,
        actionData: JSON.stringify(actionData || {}),
        scheduledAt: scheduledDate,
        status: "pending",
        createdBy: userId,
      }).returning();
      
      await createAuditLog(req, { action: "settings_change", targetType: "scheduled_shop_action", targetId: String(newAction.id), newValue: newAction });
      
      res.json({ success: true, action: { ...newAction, actionData: JSON.parse(newAction.actionData) } });
    } catch (error) {
      console.error("Error creating scheduled action:", error);
      res.status(500).json({ error: "Failed to create scheduled action" });
    }
  });
  
  // Cancel a scheduled action
  app.post("/api/admin/shop/scheduled-actions/:actionId/cancel", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { actionId } = req.params;
      const userId = (req as any).user?.claims?.sub;
      
      const [existing] = await db.select().from(scheduledShopActions).where(eq(scheduledShopActions.id, Number(actionId)));
      if (!existing) {
        return res.status(404).json({ error: "Scheduled action not found" });
      }
      
      if (existing.status !== "pending" && existing.status !== "failed") {
        return res.status(400).json({ error: "Only pending or failed actions can be cancelled" });
      }
      
      const [updated] = await db.update(scheduledShopActions).set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: userId,
      }).where(eq(scheduledShopActions.id, Number(actionId))).returning();
      
      await createAuditLog(req, { action: "settings_change", targetType: "scheduled_shop_action", targetId: actionId, previousValue: existing, newValue: updated });
      
      res.json({ success: true, action: { ...updated, actionData: JSON.parse(updated.actionData) } });
    } catch (error) {
      console.error("Error cancelling scheduled action:", error);
      res.status(500).json({ error: "Failed to cancel scheduled action" });
    }
  });
  
  // Delete a scheduled action (only cancelled or executed)
  app.delete("/api/admin/shop/scheduled-actions/:actionId", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { actionId } = req.params;
      
      const [existing] = await db.select().from(scheduledShopActions).where(eq(scheduledShopActions.id, Number(actionId)));
      if (!existing) {
        return res.status(404).json({ error: "Scheduled action not found" });
      }
      
      if (existing.status === "pending" || existing.status === "processing") {
        return res.status(400).json({ error: "Cannot delete pending or processing actions. Cancel them first." });
      }
      
      await db.delete(scheduledShopActions).where(eq(scheduledShopActions.id, Number(actionId)));
      
      await createAuditLog(req, { action: "settings_change", targetType: "scheduled_shop_action", targetId: actionId, previousValue: existing });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting scheduled action:", error);
      res.status(500).json({ error: "Failed to delete scheduled action" });
    }
  });

  // ==================== INVENTORY MANAGEMENT ====================
  app.get("/api/admin/inventory", isAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      const userId = req.query.userId as string | undefined;
      const itemType = req.query.itemType as string | undefined;
      const username = req.query.username as string | undefined;

      let conditions = [];
      if (userId) conditions.push(eq(userInventory.userId, userId));
      if (itemType) conditions.push(eq(userInventory.itemType, itemType));
      if (username) conditions.push(ilike(users.nickname, `%${username}%`));

      const baseQuery = db.select({
        id: userInventory.id,
        userId: userInventory.userId,
        itemType: userInventory.itemType,
        quantity: userInventory.quantity,
        duration: userInventory.duration,
        expiresAt: userInventory.expiresAt,
        purchasedAt: userInventory.purchasedAt,
        username: users.nickname,
        userProfileImage: users.profileImageUrl,
      })
        .from(userInventory)
        .leftJoin(users, eq(userInventory.userId, users.id));

      let inventoryList;
      let countQuery;
      
      if (conditions.length > 0) {
        const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
        inventoryList = await baseQuery
          .where(whereClause)
          .orderBy(desc(userInventory.purchasedAt))
          .limit(limit)
          .offset(offset);
        countQuery = await db.select({ count: sql<number>`count(*)` })
          .from(userInventory)
          .leftJoin(users, eq(userInventory.userId, users.id))
          .where(whereClause);
      } else {
        inventoryList = await baseQuery
          .orderBy(desc(userInventory.purchasedAt))
          .limit(limit)
          .offset(offset);
        countQuery = await db.select({ count: sql<number>`count(*)` }).from(userInventory);
      }

      const total = Number(countQuery[0].count);

      res.json({
        inventory: inventoryList,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ error: "Failed to fetch inventory" });
    }
  });

  app.post("/api/admin/inventory/grant", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { userId, itemType, quantity = 1, duration = "permanent" } = req.body;
      if (!userId || !itemType) {
        return res.status(400).json({ error: "userId and itemType required" });
      }

      const { calculateExpiryDate } = await import("@shared/shop");
      const expiryDate = calculateExpiryDate(duration);

      const [existing] = await db.select().from(userInventory)
        .where(and(eq(userInventory.userId, userId), eq(userInventory.itemType, itemType)));

      let result;
      if (existing) {
        [result] = await db.update(userInventory)
          .set({ quantity: existing.quantity + quantity, updatedAt: new Date() })
          .where(eq(userInventory.id, existing.id))
          .returning();
      } else {
        [result] = await db.insert(userInventory).values({
          userId,
          itemType,
          quantity,
          duration,
          expiresAt: expiryDate,
        }).returning();
      }

      await createAuditLog(req, { action: "item_grant", targetType: "inventory", targetId: String(result.id), newValue: { userId, itemType, quantity } });
      res.json({ success: true, inventory: result });
    } catch (error) {
      console.error("Error granting item:", error);
      res.status(500).json({ error: "Failed to grant item" });
    }
  });

  app.post("/api/admin/inventory/revoke", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { inventoryId } = req.body;
      if (!inventoryId) return res.status(400).json({ error: "inventoryId required" });

      const [existing] = await db.select().from(userInventory).where(eq(userInventory.id, inventoryId));
      if (!existing) return res.status(404).json({ error: "Inventory item not found" });

      await db.delete(userInventory).where(eq(userInventory.id, inventoryId));
      await createAuditLog(req, { action: "item_revoke", targetType: "inventory", targetId: String(inventoryId), previousValue: existing });
      res.json({ success: true });
    } catch (error) {
      console.error("Error revoking item:", error);
      res.status(500).json({ error: "Failed to revoke item" });
    }
  });

  // ==================== ANNOUNCEMENTS MANAGEMENT ====================
  app.get("/api/admin/announcements", isAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      const includeInactive = req.query.includeInactive === "true";

      let announcementList;
      if (includeInactive) {
        announcementList = await db.select().from(announcements)
          .orderBy(desc(announcements.priority), desc(announcements.createdAt))
          .limit(limit)
          .offset(offset);
      } else {
        announcementList = await db.select().from(announcements)
          .where(eq(announcements.isActive, true))
          .orderBy(desc(announcements.priority), desc(announcements.createdAt))
          .limit(limit)
          .offset(offset);
      }

      const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(announcements);
      const total = Number(totalResult.count);

      res.json({
        announcements: announcementList,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      console.error("Error fetching announcements:", error);
      res.status(500).json({ error: "Failed to fetch announcements" });
    }
  });

  app.post("/api/admin/announcements", isAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Authentication required" });
      
      const { title, titleKo, content, contentKo, type = "info", priority = 0, isPinned = false, startsAt, endsAt } = req.body;
      
      if (!title || !content) return res.status(400).json({ error: "title and content required" });

      const [announcement] = await db.insert(announcements).values({
        title,
        titleKo,
        content,
        contentKo,
        type,
        priority,
        isPinned,
        startsAt: startsAt ? new Date(startsAt) : new Date(),
        endsAt: endsAt ? new Date(endsAt) : null,
        createdBy: userId,
      }).returning();

      await createAuditLog(req, { action: "announcement_create", targetType: "announcement", targetId: announcement.id, newValue: announcement });
      res.json({ success: true, announcement });
    } catch (error) {
      console.error("Error creating announcement:", error);
      res.status(500).json({ error: "Failed to create announcement" });
    }
  });

  app.put("/api/admin/announcements/:id", isAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [existing] = await db.select().from(announcements).where(eq(announcements.id, id));
      if (!existing) return res.status(404).json({ error: "Announcement not found" });

      const { title, titleKo, content, contentKo, type, priority, isActive, isPinned, startsAt, endsAt } = req.body;

      const [updated] = await db.update(announcements).set({
        ...(title !== undefined && { title }),
        ...(titleKo !== undefined && { titleKo }),
        ...(content !== undefined && { content }),
        ...(contentKo !== undefined && { contentKo }),
        ...(type !== undefined && { type }),
        ...(priority !== undefined && { priority }),
        ...(isActive !== undefined && { isActive }),
        ...(isPinned !== undefined && { isPinned }),
        ...(startsAt !== undefined && { startsAt: new Date(startsAt) }),
        ...(endsAt !== undefined && { endsAt: endsAt ? new Date(endsAt) : null }),
        updatedAt: new Date(),
      }).where(eq(announcements.id, id)).returning();

      await createAuditLog(req, { action: "announcement_update", targetType: "announcement", targetId: id, previousValue: existing, newValue: updated });
      res.json({ success: true, announcement: updated });
    } catch (error) {
      console.error("Error updating announcement:", error);
      res.status(500).json({ error: "Failed to update announcement" });
    }
  });

  app.delete("/api/admin/announcements/:id", isAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [existing] = await db.select().from(announcements).where(eq(announcements.id, id));
      if (!existing) return res.status(404).json({ error: "Announcement not found" });

      await db.delete(announcements).where(eq(announcements.id, id));
      await createAuditLog(req, { action: "announcement_delete", targetType: "announcement", targetId: id, previousValue: existing });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting announcement:", error);
      res.status(500).json({ error: "Failed to delete announcement" });
    }
  });

  // ==================== ACHIEVEMENTS MANAGEMENT ====================
  app.get("/api/admin/achievements", isAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      const userId = req.query.userId as string | undefined;

      let achievementList;
      if (userId) {
        achievementList = await db.select().from(userAchievements)
          .where(eq(userAchievements.userId, userId))
          .orderBy(desc(userAchievements.unlockedAt))
          .limit(limit)
          .offset(offset);
      } else {
        achievementList = await db.select().from(userAchievements)
          .orderBy(desc(userAchievements.unlockedAt))
          .limit(limit)
          .offset(offset);
      }

      const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(userAchievements);
      const total = Number(totalResult.count);

      res.json({
        achievements: achievementList,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ error: "Failed to fetch achievements" });
    }
  });

  app.post("/api/admin/achievements/grant", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { userId, achievementId } = req.body;
      if (!userId || !achievementId) return res.status(400).json({ error: "userId and achievementId required" });

      const [existing] = await db.select().from(userAchievements)
        .where(and(eq(userAchievements.userId, userId), eq(userAchievements.achievementId, achievementId)));
      if (existing) return res.status(400).json({ error: "User already has this achievement" });

      const [achievement] = await db.insert(userAchievements).values({
        userId,
        achievementId,
      }).returning();

      await createAuditLog(req, { action: "item_grant", targetType: "achievement", targetId: String(achievement.id), newValue: { userId, achievementId } });
      res.json({ success: true, achievement });
    } catch (error) {
      console.error("Error granting achievement:", error);
      res.status(500).json({ error: "Failed to grant achievement" });
    }
  });

  app.delete("/api/admin/achievements/:id", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [existing] = await db.select().from(userAchievements).where(eq(userAchievements.id, id));
      if (!existing) return res.status(404).json({ error: "Achievement not found" });

      await db.delete(userAchievements).where(eq(userAchievements.id, id));
      await createAuditLog(req, { action: "item_revoke", targetType: "achievement", targetId: id, previousValue: existing });
      res.json({ success: true });
    } catch (error) {
      console.error("Error revoking achievement:", error);
      res.status(500).json({ error: "Failed to revoke achievement" });
    }
  });

  // ==================== PROGRESSION MANAGEMENT ====================
  app.get("/api/admin/progression", isAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      const userId = req.query.userId as string | undefined;
      const rankTier = req.query.rankTier as string | undefined;

      let conditions = [];
      if (userId) conditions.push(eq(playerProgression.userId, userId));
      if (rankTier) conditions.push(eq(playerProgression.rankTier, rankTier));

      let progressionList;
      if (conditions.length > 0) {
        progressionList = await db.select().from(playerProgression)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(playerProgression.level), desc(playerProgression.xp))
          .limit(limit)
          .offset(offset);
      } else {
        progressionList = await db.select().from(playerProgression)
          .orderBy(desc(playerProgression.level), desc(playerProgression.xp))
          .limit(limit)
          .offset(offset);
      }

      const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(playerProgression);
      const total = Number(totalResult.count);

      res.json({
        progression: progressionList,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      console.error("Error fetching progression:", error);
      res.status(500).json({ error: "Failed to fetch progression" });
    }
  });

  app.put("/api/admin/progression/:userId", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const [existing] = await db.select().from(playerProgression).where(eq(playerProgression.userId, userId));
      if (!existing) return res.status(404).json({ error: "Progression not found" });

      const { xp, level, gemBalance, rankTier, rankDivision, rankPoints, rankedWins, rankedLosses } = req.body;

      const [updated] = await db.update(playerProgression).set({
        ...(xp !== undefined && { xp }),
        ...(level !== undefined && { level }),
        ...(gemBalance !== undefined && { gemBalance }),
        ...(rankTier !== undefined && { rankTier }),
        ...(rankDivision !== undefined && { rankDivision }),
        ...(rankPoints !== undefined && { rankPoints }),
        ...(rankedWins !== undefined && { rankedWins }),
        ...(rankedLosses !== undefined && { rankedLosses }),
        updatedAt: new Date(),
      }).where(eq(playerProgression.userId, userId)).returning();

      await createAuditLog(req, { action: "user_update", targetType: "progression", targetId: String(existing.id), previousValue: existing, newValue: updated });
      res.json({ success: true, progression: updated });
    } catch (error) {
      console.error("Error updating progression:", error);
      res.status(500).json({ error: "Failed to update progression" });
    }
  });

  // ==================== PAYMENTS / PURCHASES ====================
  app.get("/api/admin/purchases", isAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      const userId = req.query.userId as string | undefined;
      const paymentProvider = req.query.paymentProvider as string | undefined;

      let conditions = [];
      if (userId) conditions.push(eq(itemPurchases.userId, userId));
      if (paymentProvider) conditions.push(eq(itemPurchases.paymentProvider, paymentProvider));

      let purchaseList;
      if (conditions.length > 0) {
        purchaseList = await db.select().from(itemPurchases)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(itemPurchases.createdAt))
          .limit(limit)
          .offset(offset);
      } else {
        purchaseList = await db.select().from(itemPurchases)
          .orderBy(desc(itemPurchases.createdAt))
          .limit(limit)
          .offset(offset);
      }

      const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(itemPurchases);
      const total = Number(totalResult.count);

      // Get summary stats
      const [stats] = await db.select({
        totalAmount: sql<number>`COALESCE(SUM(amount), 0)`,
        totalPurchases: sql<number>`count(*)`,
      }).from(itemPurchases);

      res.json({
        purchases: purchaseList,
        stats: {
          totalAmount: Number(stats.totalAmount),
          totalPurchases: Number(stats.totalPurchases),
        },
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      console.error("Error fetching purchases:", error);
      res.status(500).json({ error: "Failed to fetch purchases" });
    }
  });

  // ==================== GAME SCORE MANAGEMENT ====================
  app.delete("/api/admin/scores/:id", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [existing] = await db.select().from(gameScores).where(eq(gameScores.id, id));
      if (!existing) return res.status(404).json({ error: "Score not found" });

      await db.delete(gameScores).where(eq(gameScores.id, id));
      await createAuditLog(req, { action: "user_delete", targetType: "game_score", targetId: id, previousValue: existing });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting score:", error);
      res.status(500).json({ error: "Failed to delete score" });
    }
  });

  // ==================== RANKED MATCH MANAGEMENT ====================
  app.delete("/api/admin/matches/:id", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [existing] = await db.select().from(rankedMatches).where(eq(rankedMatches.id, id));
      if (!existing) return res.status(404).json({ error: "Match not found" });

      await db.delete(rankedMatches).where(eq(rankedMatches.id, id));
      await createAuditLog(req, { action: "user_delete", targetType: "ranked_match", targetId: id, previousValue: existing });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting match:", error);
      res.status(500).json({ error: "Failed to delete match" });
    }
  });

  // ==================== OPERATOR MESSAGE/GIFT SYSTEM ====================
  
  // Get or create operator conversation for a user
  async function getOrCreateOperatorConversation(userId: string): Promise<string> {
    // Check if operator conversation already exists
    const [existing] = await db.select().from(conversations).where(
      and(
        or(
          and(eq(conversations.participantAId, OPERATOR_ID), eq(conversations.participantBId, userId)),
          and(eq(conversations.participantAId, userId), eq(conversations.participantBId, OPERATOR_ID))
        )
      )
    );
    
    if (existing) return existing.id;
    
    // Create new operator conversation
    const [newConv] = await db.insert(conversations).values({
      participantAId: OPERATOR_ID,
      participantBId: userId,
    }).returning();
    
    return newConv.id;
  }

  // Send operator message/gift to user
  app.post("/api/admin/send-gift", isAdmin, strictRateLimit, async (req: any, res: Response) => {
    try {
      const { userId, message, itemId, itemDuration, gemAmount } = req.body;
      const adminId = req.user?.claims?.sub;
      
      if (!userId || !message) {
        return res.status(400).json({ error: "userId and message are required" });
      }
      
      // Verify target user exists
      const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Validate itemDuration if provided
      const validDurations = ['one_day', 'three_days', 'one_week', 'two_weeks', 'one_month', 'permanent'];
      const validatedDuration = itemDuration && validDurations.includes(itemDuration) ? itemDuration : 'permanent';
      
      // Determine gift type
      let giftType: string | null = null;
      if (itemId && gemAmount && gemAmount > 0) {
        giftType = "both";
      } else if (itemId) {
        giftType = "item";
      } else if (gemAmount && gemAmount > 0) {
        giftType = "gem";
      }
      
      // Get or create operator conversation
      const conversationId = await getOrCreateOperatorConversation(userId);
      
      let giftId: string | null = null;
      
      // Create gift record if there's something to claim
      if (giftType) {
        const [gift] = await db.insert(adminGifts).values({
          userId,
          giftType,
          itemId: itemId || null,
          itemDuration: itemId ? validatedDuration : null,
          gemAmount: gemAmount || 0,
          sentBy: adminId,
        }).returning();
        giftId = gift.id;
      }
      
      // Create the message
      const [newMessage] = await db.insert(messages).values({
        conversationId,
        senderId: OPERATOR_ID,
        content: message,
        giftId,
        isRead: false,
      }).returning();
      
      // Update gift with message ID
      if (giftId) {
        await db.update(adminGifts).set({ messageId: newMessage.id }).where(eq(adminGifts.id, giftId));
      }
      
      // Update conversation last message time
      await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, conversationId));
      
      // Broadcast to user via SSE
      try {
        broadcastNewMessage(conversationId, newMessage);
      } catch (e) {
        console.error("SSE broadcast error:", e);
      }
      
      // Audit log
      await createAuditLog(req, {
        action: "user_update",
        targetType: "operator_gift",
        targetId: userId,
        newValue: { message, itemId, gemAmount, giftId },
      });
      
      res.json({ success: true, messageId: newMessage.id, giftId });
    } catch (error) {
      console.error("Error sending operator gift:", error);
      res.status(500).json({ error: "Failed to send gift" });
    }
  });

  // Get pending gifts for admin view
  app.get("/api/admin/gifts", isAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const gifts = await db.select().from(adminGifts).orderBy(desc(adminGifts.createdAt)).limit(100);
      res.json({ gifts });
    } catch (error) {
      console.error("Error fetching gifts:", error);
      res.status(500).json({ error: "Failed to fetch gifts" });
    }
  });

  // ==================== UNIFIED SHOP ITEMS MANAGEMENT ====================

  // Get all unified shop items with translations
  app.get("/api/admin/shop/unified-items", isAdmin, adminRateLimit, async (req: Request, res: Response) => {
    try {
      const locale = (req.query.locale as string) || "en";
      const typeFilter = req.query.type as string | undefined;
      const search = req.query.search as string | undefined;
      
      const items = await db.select().from(shopItems)
        .orderBy(asc(shopItems.sortOrder), asc(shopItems.id));
      
      const translations = await db.select().from(shopItemTranslations);
      
      const translationMap = new Map<string, Map<string, { name: string; description: string | null }>>();
      for (const t of translations) {
        if (!translationMap.has(t.itemId)) {
          translationMap.set(t.itemId, new Map());
        }
        translationMap.get(t.itemId)!.set(t.locale, { name: t.name, description: t.description });
      }
      
      let result = items.map(item => {
        const itemTranslations = translationMap.get(item.id) || new Map();
        const currentTranslation = itemTranslations.get(locale) || itemTranslations.get("en");
        
        const completeness: Record<string, boolean> = {};
        for (const loc of SUPPORTED_LOCALES) {
          completeness[loc] = itemTranslations.has(loc);
        }
        
        return {
          ...item,
          name: currentTranslation?.name || item.id,
          description: currentTranslation?.description || "",
          translations: Object.fromEntries(itemTranslations),
          translationCompleteness: completeness,
        };
      });
      
      if (typeFilter) {
        result = result.filter(item => item.type === typeFilter);
      }
      
      if (search) {
        const searchLower = search.toLowerCase();
        result = result.filter(item => 
          item.id.toLowerCase().includes(searchLower) ||
          item.name.toLowerCase().includes(searchLower)
        );
      }
      
      res.json({ items: result, supportedLocales: SUPPORTED_LOCALES });
    } catch (error) {
      console.error("Error fetching unified shop items:", error);
      res.status(500).json({ error: "Failed to fetch unified shop items" });
    }
  });

  // Create new unified shop item
  app.post("/api/admin/shop/unified-items", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { id, type, basePrice, modelUrl, thumbnailUrl, isActive, isPremiumOnly, sortOrder, translations } = req.body;
      
      if (!id || !type) {
        return res.status(400).json({ error: "id and type are required" });
      }
      
      const [existing] = await db.select().from(shopItems).where(eq(shopItems.id, id));
      if (existing) {
        return res.status(400).json({ error: "Item with this ID already exists" });
      }
      
      const userId = (req as any).user?.claims?.sub;
      
      const [newItem] = await db.insert(shopItems).values({
        id,
        type,
        basePrice: basePrice || 100,
        modelUrl: modelUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        isActive: isActive ?? true,
        isPremiumOnly: isPremiumOnly ?? false,
        sortOrder: sortOrder ?? 0,
        createdBy: userId,
      }).returning();
      
      if (translations && typeof translations === "object") {
        for (const [locale, data] of Object.entries(translations)) {
          if (SUPPORTED_LOCALES.includes(locale as any) && (data as any).name) {
            await db.insert(shopItemTranslations).values({
              itemId: id,
              locale,
              name: (data as any).name,
              description: (data as any).description || null,
            });
          }
        }
      }
      
      await createAuditLog(req, { action: "settings_change", targetType: "unified_shop_item", targetId: id, newValue: newItem });
      
      res.json({ success: true, item: newItem });
    } catch (error) {
      console.error("Error creating unified shop item:", error);
      res.status(500).json({ error: "Failed to create unified shop item" });
    }
  });

  // Update unified shop item
  app.put("/api/admin/shop/unified-items/:itemId", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const { type, basePrice, modelUrl, thumbnailUrl, isActive, isPremiumOnly, sortOrder, translations } = req.body;
      
      const [existing] = await db.select().from(shopItems).where(eq(shopItems.id, itemId));
      if (!existing) {
        return res.status(404).json({ error: "Shop item not found" });
      }
      
      const [updated] = await db.update(shopItems).set({
        type: type ?? existing.type,
        basePrice: basePrice ?? existing.basePrice,
        modelUrl: modelUrl !== undefined ? modelUrl : existing.modelUrl,
        thumbnailUrl: thumbnailUrl !== undefined ? thumbnailUrl : existing.thumbnailUrl,
        isActive: isActive ?? existing.isActive,
        isPremiumOnly: isPremiumOnly ?? existing.isPremiumOnly,
        sortOrder: sortOrder ?? existing.sortOrder,
        updatedAt: new Date(),
      }).where(eq(shopItems.id, itemId)).returning();
      
      if (translations && typeof translations === "object") {
        for (const [locale, data] of Object.entries(translations)) {
          if (SUPPORTED_LOCALES.includes(locale as any) && (data as any).name) {
            const [existingTrans] = await db.select().from(shopItemTranslations)
              .where(and(eq(shopItemTranslations.itemId, itemId), eq(shopItemTranslations.locale, locale)));
            
            if (existingTrans) {
              await db.update(shopItemTranslations).set({
                name: (data as any).name,
                description: (data as any).description || null,
                updatedAt: new Date(),
              }).where(and(eq(shopItemTranslations.itemId, itemId), eq(shopItemTranslations.locale, locale)));
            } else {
              await db.insert(shopItemTranslations).values({
                itemId,
                locale,
                name: (data as any).name,
                description: (data as any).description || null,
              });
            }
          }
        }
      }
      
      await createAuditLog(req, { action: "settings_change", targetType: "unified_shop_item", targetId: itemId, previousValue: existing, newValue: updated });
      
      res.json({ success: true, item: updated });
    } catch (error) {
      console.error("Error updating unified shop item:", error);
      res.status(500).json({ error: "Failed to update unified shop item" });
    }
  });

  // Delete unified shop item
  app.delete("/api/admin/shop/unified-items/:itemId", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      
      const [existing] = await db.select().from(shopItems).where(eq(shopItems.id, itemId));
      if (!existing) {
        return res.status(404).json({ error: "Shop item not found" });
      }
      
      await db.delete(shopItems).where(eq(shopItems.id, itemId));
      
      await createAuditLog(req, { action: "settings_change", targetType: "unified_shop_item", targetId: itemId, previousValue: existing });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting unified shop item:", error);
      res.status(500).json({ error: "Failed to delete unified shop item" });
    }
  });

  // Update item translations for a specific locale
  app.put("/api/admin/shop/unified-items/:itemId/translations/:locale", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { itemId, locale } = req.params;
      const { name, description } = req.body;
      
      if (!SUPPORTED_LOCALES.includes(locale as any)) {
        return res.status(400).json({ error: "Unsupported locale" });
      }
      
      const [existing] = await db.select().from(shopItems).where(eq(shopItems.id, itemId));
      if (!existing) {
        return res.status(404).json({ error: "Shop item not found" });
      }
      
      const [existingTrans] = await db.select().from(shopItemTranslations)
        .where(and(eq(shopItemTranslations.itemId, itemId), eq(shopItemTranslations.locale, locale)));
      
      if (existingTrans) {
        await db.update(shopItemTranslations).set({
          name: name || existingTrans.name,
          description: description !== undefined ? description : existingTrans.description,
          updatedAt: new Date(),
        }).where(and(eq(shopItemTranslations.itemId, itemId), eq(shopItemTranslations.locale, locale)));
      } else {
        if (!name) {
          return res.status(400).json({ error: "name is required for new translation" });
        }
        await db.insert(shopItemTranslations).values({
          itemId,
          locale,
          name,
          description: description || null,
        });
      }
      
      await createAuditLog(req, { action: "settings_change", targetType: "shop_item_translation", targetId: `${itemId}_${locale}` });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating translation:", error);
      res.status(500).json({ error: "Failed to update translation" });
    }
  });

  // Copy translations from one locale to another (helper for admins)
  app.post("/api/admin/shop/unified-items/:itemId/copy-translation", isSuperAdmin, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const { fromLocale, toLocale } = req.body;
      
      if (!SUPPORTED_LOCALES.includes(fromLocale) || !SUPPORTED_LOCALES.includes(toLocale)) {
        return res.status(400).json({ error: "Invalid locale" });
      }
      
      const [source] = await db.select().from(shopItemTranslations)
        .where(and(eq(shopItemTranslations.itemId, itemId), eq(shopItemTranslations.locale, fromLocale)));
      
      if (!source) {
        return res.status(404).json({ error: "Source translation not found" });
      }
      
      const [existingTarget] = await db.select().from(shopItemTranslations)
        .where(and(eq(shopItemTranslations.itemId, itemId), eq(shopItemTranslations.locale, toLocale)));
      
      if (existingTarget) {
        await db.update(shopItemTranslations).set({
          name: source.name,
          description: source.description,
          updatedAt: new Date(),
        }).where(and(eq(shopItemTranslations.itemId, itemId), eq(shopItemTranslations.locale, toLocale)));
      } else {
        await db.insert(shopItemTranslations).values({
          itemId,
          locale: toLocale,
          name: source.name,
          description: source.description,
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error copying translation:", error);
      res.status(500).json({ error: "Failed to copy translation" });
    }
  });

  console.log("[ADMIN] Admin routes registered");
}
