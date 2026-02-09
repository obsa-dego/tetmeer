import {
  userInventory,
  itemPurchases,
  type UserInventory,
  type ItemPurchase,
  type InsertItemPurchase,
} from "@shared/schema";
import { db } from "../../db";
import { eq, and } from "drizzle-orm";

export class InventoryStorage {
  async recordItemPurchase(purchase: InsertItemPurchase): Promise<ItemPurchase | null> {
    const [result] = await db
      .insert(itemPurchases)
      .values(purchase)
      .onConflictDoNothing({ target: itemPurchases.paymentId })
      .returning();
    return result || null;
  }

  async isPaymentIdUsed(paymentId: string): Promise<boolean> {
    const [existing] = await db
      .select({ id: itemPurchases.id })
      .from(itemPurchases)
      .where(eq(itemPurchases.paymentId, paymentId))
      .limit(1);
    return !!existing;
  }

  async getInventory(userId: string): Promise<UserInventory[]> {
    const items = await db
      .select()
      .from(userInventory)
      .where(eq(userInventory.userId, userId));

    await this.applyExpiredPendingDurations(items);

    return items;
  }

  async getInventoryItem(userId: string, itemType: string): Promise<UserInventory | undefined> {
    const [item] = await db
      .select()
      .from(userInventory)
      .where(and(eq(userInventory.userId, userId), eq(userInventory.itemType, itemType)));
    return item;
  }

  async addInventoryItem(userId: string, itemType: string, quantity: number, expiresAt?: Date | null, duration?: string): Promise<UserInventory> {
    const existing = await this.getInventoryItem(userId, itemType);

    if (existing) {
      const now = new Date();
      const isExpired = existing.expiresAt && new Date(existing.expiresAt) < now;

      const [updated] = await db
        .update(userInventory)
        .set({
          quantity: isExpired ? quantity : existing.quantity + quantity,
          purchasedAt: isExpired ? now : existing.purchasedAt,
          expiresAt: expiresAt,
          duration: duration || existing.duration,
          updatedAt: now,
        })
        .where(eq(userInventory.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(userInventory)
        .values({
          userId,
          itemType,
          quantity,
          purchasedAt: new Date(),
          expiresAt: expiresAt,
          duration: duration || 'one_week',
        })
        .returning();
      return created;
    }
  }

  async useInventoryItem(userId: string, itemType: string): Promise<boolean> {
    const existing = await this.getInventoryItem(userId, itemType);

    if (!existing || existing.quantity <= 0) {
      return false;
    }

    await db
      .update(userInventory)
      .set({
        quantity: existing.quantity - 1,
        updatedAt: new Date(),
      })
      .where(eq(userInventory.id, existing.id));

    return true;
  }

  async setPendingDuration(userId: string, itemType: string, pendingDuration: string, pendingExpiresAt: Date | null, pendingPurchasedAt: Date): Promise<UserInventory | undefined> {
    const existing = await this.getInventoryItem(userId, itemType);
    if (!existing) {
      return undefined;
    }

    const [updated] = await db
      .update(userInventory)
      .set({
        pendingDuration,
        pendingExpiresAt,
        pendingPurchasedAt,
        updatedAt: new Date(),
      })
      .where(eq(userInventory.id, existing.id))
      .returning();

    return updated;
  }

  private async applyExpiredPendingDurations(items: UserInventory[]): Promise<void> {
    const now = new Date();
    for (const item of items) {
      if (item.pendingDuration && item.expiresAt && new Date(item.expiresAt) < now) {
        await db
          .update(userInventory)
          .set({
            duration: item.pendingDuration,
            expiresAt: item.pendingExpiresAt,
            purchasedAt: item.pendingPurchasedAt,
            pendingDuration: null,
            pendingExpiresAt: null,
            pendingPurchasedAt: null,
            quantity: 1,
            updatedAt: now,
          })
          .where(eq(userInventory.id, item.id));

        item.duration = item.pendingDuration;
        item.expiresAt = item.pendingExpiresAt;
        item.purchasedAt = item.pendingPurchasedAt;
        item.pendingDuration = null;
        item.pendingExpiresAt = null;
        item.pendingPurchasedAt = null;
        item.quantity = 1;
      }
    }
  }
}
