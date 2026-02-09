import { db } from "./db";
import { scheduledShopActions, customShopItems, shopItemPriceOptions, adminAuditLogs } from "@shared/schema";
import { eq, and, lte, ne } from "drizzle-orm";

const POLL_INTERVAL = 60000;
const SYSTEM_USER_ID = "system";

interface ActionData {
  type?: string;
  nameKey?: string;
  descriptionKey?: string;
  modelUrl?: string;
  thumbnailUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
  priceOptions?: Array<{ duration: string; price: number; isDefault: boolean }>;
  priceOverride?: number;
  isDisabled?: boolean;
  discountPercent?: number;
  discountEndsAt?: string;
  customName?: string;
  customDescription?: string;
  materialSettings?: string;
}

async function executeCreateAction(actionData: ActionData, createdBy: string): Promise<void> {
  if (!actionData.type || !actionData.nameKey || !actionData.descriptionKey) {
    throw new Error("Missing required fields for create action");
  }

  const [newItem] = await db.insert(customShopItems).values({
    type: actionData.type,
    nameKey: actionData.nameKey,
    descriptionKey: actionData.descriptionKey,
    modelUrl: actionData.modelUrl || null,
    thumbnailUrl: actionData.thumbnailUrl || null,
    isActive: actionData.isActive ?? true,
    sortOrder: actionData.sortOrder ?? 0,
    createdBy,
  }).returning();

  if (actionData.priceOptions && actionData.priceOptions.length > 0) {
    await db.insert(shopItemPriceOptions).values(
      actionData.priceOptions.map((opt, index) => ({
        itemId: newItem.id,
        isCustomItem: true,
        duration: opt.duration || "one_week",
        price: opt.price || 100,
        isDefault: opt.isDefault || index === 0,
        isActive: true,
        sortOrder: index,
      }))
    );
  }

  console.log(`[Scheduled Actions] Created custom item: ${newItem.id}`);
}

async function executeUpdateAction(targetItemId: string, isCustomItem: boolean, actionData: ActionData): Promise<void> {
  if (isCustomItem) {
    const [existing] = await db.select().from(customShopItems).where(eq(customShopItems.id, targetItemId));
    if (!existing) {
      throw new Error(`Custom item ${targetItemId} not found`);
    }

    await db.update(customShopItems).set({
      type: actionData.type ?? existing.type,
      nameKey: actionData.nameKey ?? existing.nameKey,
      descriptionKey: actionData.descriptionKey ?? existing.descriptionKey,
      modelUrl: actionData.modelUrl ?? existing.modelUrl,
      thumbnailUrl: actionData.thumbnailUrl ?? existing.thumbnailUrl,
      isActive: actionData.isActive ?? existing.isActive,
      sortOrder: actionData.sortOrder ?? existing.sortOrder,
      updatedAt: new Date(),
    }).where(eq(customShopItems.id, targetItemId));

    if (actionData.priceOptions) {
      await db.delete(shopItemPriceOptions).where(
        and(eq(shopItemPriceOptions.itemId, targetItemId), eq(shopItemPriceOptions.isCustomItem, true))
      );
      
      if (actionData.priceOptions.length > 0) {
        await db.insert(shopItemPriceOptions).values(
          actionData.priceOptions.map((opt, index) => ({
            itemId: targetItemId,
            isCustomItem: true,
            duration: opt.duration || "one_week",
            price: opt.price || 100,
            isDefault: opt.isDefault || index === 0,
            isActive: true,
            sortOrder: index,
          }))
        );
      }
    }

    console.log(`[Scheduled Actions] Updated custom item: ${targetItemId}`);
  } else {
    const { shopItemOverrides } = await import("@shared/schema");
    
    const [existing] = await db.select().from(shopItemOverrides).where(eq(shopItemOverrides.itemId, targetItemId));
    
    if (existing) {
      await db.update(shopItemOverrides).set({
        priceOverride: actionData.priceOverride ?? existing.priceOverride,
        isDisabled: actionData.isDisabled ?? existing.isDisabled,
        discountPercent: actionData.discountPercent ?? existing.discountPercent,
        discountEndsAt: actionData.discountEndsAt ? new Date(actionData.discountEndsAt) : existing.discountEndsAt,
        customName: actionData.customName ?? existing.customName,
        customDescription: actionData.customDescription ?? existing.customDescription,
        materialSettings: actionData.materialSettings ?? existing.materialSettings,
        updatedBy: "system",
        updatedAt: new Date(),
      }).where(eq(shopItemOverrides.itemId, targetItemId));
    } else {
      await db.insert(shopItemOverrides).values({
        itemId: targetItemId,
        priceOverride: actionData.priceOverride ?? null,
        isDisabled: actionData.isDisabled ?? false,
        discountPercent: actionData.discountPercent ?? null,
        discountEndsAt: actionData.discountEndsAt ? new Date(actionData.discountEndsAt) : null,
        customName: actionData.customName ?? null,
        customDescription: actionData.customDescription ?? null,
        materialSettings: actionData.materialSettings ?? null,
        updatedBy: "system",
      });
    }

    console.log(`[Scheduled Actions] Updated shop item override: ${targetItemId}`);
  }
}

async function executeDeleteAction(targetItemId: string, isCustomItem: boolean): Promise<void> {
  if (isCustomItem) {
    await db.delete(shopItemPriceOptions).where(
      and(eq(shopItemPriceOptions.itemId, targetItemId), eq(shopItemPriceOptions.isCustomItem, true))
    );
    await db.delete(customShopItems).where(eq(customShopItems.id, targetItemId));
    console.log(`[Scheduled Actions] Deleted custom item: ${targetItemId}`);
  } else {
    const { shopItemOverrides } = await import("@shared/schema");
    await db.delete(shopItemOverrides).where(eq(shopItemOverrides.itemId, targetItemId));
    console.log(`[Scheduled Actions] Deleted shop item override: ${targetItemId}`);
  }
}

async function createSystemAuditLog(action: string, targetType: string, targetId: string, previousValue?: any, newValue?: any): Promise<void> {
  try {
    await db.insert(adminAuditLogs).values({
      adminId: SYSTEM_USER_ID,
      action,
      targetType,
      targetId,
      previousValue: previousValue ? JSON.stringify(previousValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
      ipAddress: "127.0.0.1",
      userAgent: "ScheduledActionsProcessor",
    });
  } catch (error) {
    console.error("[Scheduled Actions] Failed to create audit log:", error);
  }
}

async function processScheduledActions(): Promise<void> {
  try {
    const now = new Date();
    
    const pendingActions = await db.select().from(scheduledShopActions)
      .where(and(
        eq(scheduledShopActions.status, "pending"),
        lte(scheduledShopActions.scheduledAt, now)
      ));
    
    for (const action of pendingActions) {
      const [claimed] = await db.update(scheduledShopActions)
        .set({ status: "processing" })
        .where(and(
          eq(scheduledShopActions.id, action.id),
          eq(scheduledShopActions.status, "pending")
        ))
        .returning();
      
      if (!claimed) {
        console.log(`[Scheduled Actions] Action ${action.id} already claimed by another process`);
        continue;
      }
      
      try {
        const actionData = JSON.parse(action.actionData || "{}") as ActionData;
        
        switch (action.actionType) {
          case "create":
            await executeCreateAction(actionData, action.createdBy);
            await createSystemAuditLog("scheduled_create", "custom_shop_item", "new", null, actionData);
            break;
          case "update":
            if (!action.targetItemId) {
              throw new Error("targetItemId required for update action");
            }
            await executeUpdateAction(action.targetItemId, action.isCustomItem, actionData);
            await createSystemAuditLog("scheduled_update", action.isCustomItem ? "custom_shop_item" : "shop_item", action.targetItemId, null, actionData);
            break;
          case "delete":
            if (!action.targetItemId) {
              throw new Error("targetItemId required for delete action");
            }
            await executeDeleteAction(action.targetItemId, action.isCustomItem);
            await createSystemAuditLog("scheduled_delete", action.isCustomItem ? "custom_shop_item" : "shop_item", action.targetItemId);
            break;
          default:
            throw new Error(`Unknown action type: ${action.actionType}`);
        }
        
        await db.update(scheduledShopActions).set({
          status: "executed",
          executedAt: new Date(),
          errorMessage: null,
        }).where(eq(scheduledShopActions.id, action.id));
        
        console.log(`[Scheduled Actions] Executed action ${action.id} (${action.actionType})`);
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        console.error(`[Scheduled Actions] Failed to execute action ${action.id}:`, errorMessage);
        await db.update(scheduledShopActions).set({
          status: "failed",
          errorMessage: errorMessage.slice(0, 500),
          retryCount: (action.retryCount || 0) + 1,
        }).where(eq(scheduledShopActions.id, action.id));
      }
    }
  } catch (error) {
    console.error("[Scheduled Actions] Error processing scheduled actions:", error);
  }
}

let intervalId: NodeJS.Timeout | null = null;

export function startScheduledActionsProcessor(): void {
  if (intervalId) {
    console.log("[Scheduled Actions] Processor already running");
    return;
  }
  
  console.log(`[Scheduled Actions] Starting processor (interval: ${POLL_INTERVAL}ms)`);
  
  processScheduledActions();
  
  intervalId = setInterval(processScheduledActions, POLL_INTERVAL);
}

export function stopScheduledActionsProcessor(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[Scheduled Actions] Processor stopped");
  }
}
