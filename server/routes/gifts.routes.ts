import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { adminGifts, playerProgression, userInventory } from "@shared/schema";
import { calculateExpiryDate, type ShopItemDuration } from "@shared/shop";
import { db } from "../db";
import { eq, and } from "drizzle-orm";

export function registerGiftsRoutes(app: Express): void {
  app.post("/api/gifts/:giftId/claim", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { giftId } = req.params;

      const [gift] = await db.select().from(adminGifts).where(
        and(
          eq(adminGifts.id, giftId),
          eq(adminGifts.userId, userId)
        )
      );

      if (!gift) {
        return res.status(404).json({ message: "Gift not found" });
      }

      if (gift.claimedAt) {
        return res.status(400).json({ message: "Gift already claimed" });
      }

      if (gift.gemAmount && gift.gemAmount > 0) {
        const [progression] = await db.select().from(playerProgression).where(eq(playerProgression.userId, userId));
        if (progression) {
          await db.update(playerProgression)
            .set({ gemBalance: (progression.gemBalance || 0) + gift.gemAmount })
            .where(eq(playerProgression.userId, userId));
        }
      }

      if (gift.itemId) {
        const duration = (gift.itemDuration || 'permanent') as ShopItemDuration;
        const expiresAt = calculateExpiryDate(duration, new Date());

        await db.insert(userInventory).values({
          userId,
          itemType: gift.itemId,
          quantity: 1,
          duration: duration,
          expiresAt: expiresAt,
          acquisitionSource: 'admin_gift',
        }).onConflictDoNothing();
      }

      await db.update(adminGifts)
        .set({ claimedAt: new Date() })
        .where(eq(adminGifts.id, giftId));

      res.json({
        success: true,
        message: "Gift claimed successfully",
        gemsReceived: gift.gemAmount || 0,
        itemReceived: gift.itemId
      });
    } catch (error) {
      console.error("Error claiming gift:", error);
      res.status(500).json({ message: "Failed to claim gift" });
    }
  });

  app.get("/api/gifts/:giftId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { giftId } = req.params;

      const [gift] = await db.select().from(adminGifts).where(
        and(
          eq(adminGifts.id, giftId),
          eq(adminGifts.userId, userId)
        )
      );

      if (!gift) {
        return res.status(404).json({ message: "Gift not found" });
      }

      res.json({ gift });
    } catch (error) {
      console.error("Error fetching gift:", error);
      res.status(500).json({ message: "Failed to fetch gift" });
    }
  });
}
