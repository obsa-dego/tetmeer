import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { shopItemPriceOptions } from "@shared/schema";
import { db } from "../db";
import { eq, and } from "drizzle-orm";

export function registerShopRoutes(app: Express): void {
  app.get("/api/shop/items", async (_req, res) => {
    try {
      const { SHOP_ITEMS } = await import("@shared/shop");
      res.json({ items: SHOP_ITEMS });
    } catch (error) {
      console.error("Error fetching shop items:", error);
      res.status(500).json({ message: "Failed to fetch shop items" });
    }
  });

  app.get("/api/shop/price-options/:itemId", async (req, res) => {
    try {
      const { itemId } = req.params;
      const isCustom = req.query.isCustom === 'true';

      const options = await db.select()
        .from(shopItemPriceOptions)
        .where(and(
          eq(shopItemPriceOptions.itemId, itemId),
          eq(shopItemPriceOptions.isCustomItem, isCustom)
        ))
        .orderBy(shopItemPriceOptions.sortOrder);

      res.json({ options });
    } catch (error) {
      console.error("Error fetching price options:", error);
      res.status(500).json({ message: "Failed to fetch price options" });
    }
  });

  app.post("/api/shop/purchase", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { itemId, duration: selectedDuration, isCustomItem } = req.body;

      if (!itemId || typeof itemId !== 'string') {
        return res.status(400).json({ message: "Invalid item ID" });
      }

      const { getShopItem, calculateExpiryDate } = await import("@shared/shop");

      let itemPrice: number;
      let itemDuration: string;
      let itemName: string;

      if (isCustomItem) {
        const { customShopItems } = await import("@shared/schema");
        const [customItem] = await db.select().from(customShopItems).where(eq(customShopItems.id, itemId));
        if (!customItem || !customItem.isActive) {
          return res.status(400).json({ message: "Item not found" });
        }
        itemName = customItem.nameKey;

        if (selectedDuration) {
          const [priceOption] = await db.select()
            .from(shopItemPriceOptions)
            .where(and(
              eq(shopItemPriceOptions.itemId, itemId),
              eq(shopItemPriceOptions.isCustomItem, true),
              eq(shopItemPriceOptions.duration, selectedDuration)
            ));
          if (!priceOption) {
            return res.status(400).json({ message: "Invalid price option" });
          }
          itemPrice = priceOption.price;
          itemDuration = priceOption.duration;
        } else {
          const [defaultOption] = await db.select()
            .from(shopItemPriceOptions)
            .where(and(
              eq(shopItemPriceOptions.itemId, itemId),
              eq(shopItemPriceOptions.isCustomItem, true),
              eq(shopItemPriceOptions.isDefault, true)
            ));
          if (!defaultOption) {
            return res.status(400).json({ message: "No price option found" });
          }
          itemPrice = defaultOption.price;
          itemDuration = defaultOption.duration;
        }
      } else {
        const item = getShopItem(itemId);
        if (!item) {
          return res.status(400).json({ message: "Item not found" });
        }
        itemName = item.id;

        if (selectedDuration) {
          const [priceOption] = await db.select()
            .from(shopItemPriceOptions)
            .where(and(
              eq(shopItemPriceOptions.itemId, itemId),
              eq(shopItemPriceOptions.isCustomItem, false),
              eq(shopItemPriceOptions.duration, selectedDuration)
            ));
          if (priceOption) {
            itemPrice = priceOption.price;
            itemDuration = priceOption.duration;
          } else {
            itemPrice = item.price;
            itemDuration = item.duration;
          }
        } else {
          itemPrice = item.price;
          itemDuration = item.duration;
        }
      }

      const progression = await storage.getPlayerProgression(userId);
      if (!progression || progression.gemBalance < itemPrice) {
        return res.status(400).json({ message: "Insufficient Gem balance" });
      }

      const existingItem = await storage.getInventoryItem(userId, itemId);
      const now = new Date();
      const isOwned = existingItem && existingItem.quantity > 0 && (!existingItem.expiresAt || new Date(existingItem.expiresAt) > now);

      const { compareDurations } = await import("@shared/shop");

      if (isOwned) {
        const currentDuration = existingItem.duration as any;
        const comparison = compareDurations(currentDuration, itemDuration as any);

        if (comparison === 'same') {
          return res.status(400).json({ message: "You already own this item with this duration" });
        }

        if (!existingItem.expiresAt) {
          return res.status(400).json({ message: "Cannot change duration of a permanent item" });
        }

        if (existingItem.pendingDuration) {
          return res.status(400).json({ message: "You already have a pending duration change for this item. Wait for current item to expire first." });
        }

        const pendingExpiresAt = calculateExpiryDate(itemDuration as any, existingItem.expiresAt);

        await storage.updatePlayerGem(userId, -itemPrice);
        await storage.setPendingDuration(userId, itemId, itemDuration, pendingExpiresAt, new Date());

        const updatedProgression = await storage.getPlayerProgression(userId);

        return res.json({
          success: true,
          itemId,
          itemName,
          gemSpent: itemPrice,
          duration: itemDuration,
          type: comparison,
          newGemBalance: updatedProgression?.gemBalance || 0,
          effectiveAfter: existingItem.expiresAt.toISOString(),
          pendingExpiresAt: pendingExpiresAt?.toISOString() || null
        });
      }

      const purchaseDate = new Date();
      const expiresAt = calculateExpiryDate(itemDuration as any, purchaseDate);

      await storage.updatePlayerGem(userId, -itemPrice);
      await storage.addInventoryItem(userId, itemId, 1, expiresAt, itemDuration);

      const updatedProgression = await storage.getPlayerProgression(userId);

      res.json({
        success: true,
        itemId,
        itemName,
        gemSpent: itemPrice,
        duration: itemDuration,
        type: 'new',
        newGemBalance: updatedProgression?.gemBalance || 0,
        expiresAt: expiresAt?.toISOString() || null
      });
    } catch (error) {
      console.error("Error purchasing item:", error);
      res.status(500).json({ message: "Failed to purchase item" });
    }
  });

  app.get("/api/shop/inventory", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const inventory = await storage.getInventory(userId);
      res.json({ inventory });
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ message: "Failed to fetch inventory" });
    }
  });
}
