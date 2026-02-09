import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";

export function registerInventoryRoutes(app: Express): void {
  app.get("/api/inventory", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const inventory = await storage.getInventory(userId);
      res.json({ inventory });
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ message: "Failed to fetch inventory" });
    }
  });

  app.post("/api/items/use", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { itemType } = req.body;

      if (!itemType) {
        return res.status(400).json({ success: false, message: "Item type is required" });
      }

      const used = await storage.useInventoryItem(userId, itemType);

      if (!used) {
        return res.status(400).json({
          success: false,
          message: "You don't have this item in your inventory"
        });
      }

      const inventory = await storage.getInventoryItem(userId, itemType);

      res.json({
        success: true,
        message: 'Item used successfully',
        remainingQuantity: inventory?.quantity || 0
      });
    } catch (error) {
      console.error("Error using item:", error);
      res.status(500).json({ success: false, message: "Failed to use item" });
    }
  });
}
