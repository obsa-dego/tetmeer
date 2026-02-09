import type { Express } from "express";
import { storage } from "../storage";

export function registerLeaderboardRoutes(app: Express): void {
  app.get("/api/leaderboard/ranked", async (req, res) => {
    try {
      const entries = await storage.getRankedLeaderboard();
      res.json({ entries });
    } catch (error) {
      console.error("Error fetching ranked leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch ranked leaderboard" });
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    try {
      let filter: 'daily' | 'weekly' | 'allTime' = 'allTime';
      const queryFilter = req.query.filter;
      if (queryFilter === 'daily' || queryFilter === 'weekly' || queryFilter === 'allTime') {
        filter = queryFilter;
      }

      let gameMode: string = 'marathon';
      const queryMode = req.query.mode;
      if (queryMode === 'marathon' || queryMode === 'sprint' || queryMode === 'ultra' || queryMode === 'zen') {
        gameMode = queryMode;
      }

      const entries = await storage.getLeaderboard(filter, gameMode);
      res.json({ entries });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });
}
