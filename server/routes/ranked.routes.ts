import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";

export function registerRankedRoutes(app: Express): void {
  app.get("/api/ranked/progression", isAuthenticated, async (req: any, res) => {
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

  app.get("/api/ranked/leaderboard", async (req, res) => {
    try {
      const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
      const leaderboard = await storage.getRankedLeaderboard(limit);
      res.json({ entries: leaderboard });
    } catch (error) {
      console.error("Error fetching ranked leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch ranked leaderboard" });
    }
  });

  app.get("/api/ranked/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
      const matches = await storage.getUserRankedMatches(userId, limit);
      res.json({ matches });
    } catch (error) {
      console.error("Error fetching ranked history:", error);
      res.status(500).json({ message: "Failed to fetch ranked history" });
    }
  });

  app.get("/api/ranked/eligibility", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let progression = await storage.getPlayerProgression(userId);

      if (!progression) {
        progression = await storage.createPlayerProgression(userId);
      }

      const RANKED_UNLOCK_LEVEL = 30;
      const canPlayRanked = progression.level >= RANKED_UNLOCK_LEVEL;
      const levelsNeeded = canPlayRanked ? 0 : RANKED_UNLOCK_LEVEL - progression.level;

      res.json({
        eligible: canPlayRanked,
        currentLevel: progression.level,
        requiredLevel: RANKED_UNLOCK_LEVEL,
        levelsNeeded,
        isPlacementComplete: progression.isPlacementComplete,
        placementMatchesPlayed: progression.placementMatchesPlayed,
        placementWins: progression.placementWins,
      });
    } catch (error) {
      console.error("Error checking ranked eligibility:", error);
      res.status(500).json({ message: "Failed to check ranked eligibility" });
    }
  });
}
