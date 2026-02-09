import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";

export function registerProgressionRoutes(app: Express): void {
  app.get("/api/user/progression", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let progression = await storage.getPlayerProgression(userId);

      if (!progression) {
        progression = await storage.createPlayerProgression(userId);
      }

      res.json(progression);
    } catch (error) {
      console.error("Error fetching progression:", error);
      res.status(500).json({ message: "Failed to fetch progression" });
    }
  });

  app.get("/api/user/ranked-matches", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 50;
      const matches = await storage.getUserRankedMatches(userId, limit);
      res.json({ matches });
    } catch (error) {
      console.error("Error fetching ranked matches:", error);
      res.status(500).json({ message: "Failed to fetch ranked matches" });
    }
  });

  app.post("/api/progression/xp", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { xp } = req.body;

      if (typeof xp !== 'number' || xp < 0) {
        return res.status(400).json({ message: "Invalid XP value" });
      }

      const updated = await storage.updatePlayerXp(userId, xp);
      res.json(updated);
    } catch (error) {
      console.error("Error updating XP:", error);
      res.status(500).json({ message: "Failed to update XP" });
    }
  });

  app.post("/api/rewards/claim", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { rewardId } = req.body;

      if (!rewardId || typeof rewardId !== 'string') {
        return res.status(400).json({ message: "Invalid reward ID" });
      }

      const { REWARD_POOL } = await import("@shared/rewards");
      const reward = REWARD_POOL.find(r => r.id === rewardId);

      if (!reward) {
        return res.status(400).json({ message: "Invalid reward ID" });
      }

      if (reward.type === 'xp') {
        const updated = await storage.updatePlayerXp(userId, reward.value);
        res.json({ success: true, xpGained: reward.value, progression: updated });
      } else if (reward.type === 'gem') {
        const updated = await storage.updatePlayerGem(userId, reward.value);
        res.json({ success: true, gemGained: reward.value, progression: updated });
      } else {
        res.status(400).json({ message: "Unknown reward type" });
      }
    } catch (error) {
      console.error("Error claiming reward:", error);
      res.status(500).json({ message: "Failed to claim reward" });
    }
  });
}
