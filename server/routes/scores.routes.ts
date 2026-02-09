import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";

export function registerScoresRoutes(app: Express): void {
  app.post("/api/scores", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { score, level, linesCleared, playTime, gameMode } = req.body;

      const validatedScore = Math.max(0, Math.min(Number(score) || 0, 10000000));
      const validatedLevel = Math.max(1, Math.min(Number(level) || 1, 1000));
      const validatedLines = Math.max(0, Math.min(Number(linesCleared) || 0, 10000));
      const validatedPlayTime = Math.max(0, Math.min(Number(playTime) || 0, 86400000));

      const maxReasonableScore = Math.max(validatedLines * 1500, 10000);
      const sanitizedScore = Math.min(validatedScore, maxReasonableScore);

      const validModes = ['marathon', 'sprint', 'ultra', 'zen'];
      const validatedMode = validModes.includes(gameMode) ? gameMode : 'marathon';

      const newScore = await storage.createGameScore({
        userId,
        score: sanitizedScore,
        level: validatedLevel,
        linesCleared: validatedLines,
        playTime: validatedPlayTime,
        gameMode: validatedMode,
      });

      await storage.updateProfileStats(userId, sanitizedScore, validatedLines, validatedPlayTime);

      const gemsEarned = Math.min(1000, Math.floor(sanitizedScore / 10));
      if (gemsEarned > 0) {
        await storage.updatePlayerGem(userId, gemsEarned);
      }

      res.json({ ...newScore, gemsEarned });
    } catch (error) {
      console.error("Error saving score:", error);
      res.status(500).json({ message: "Failed to save score" });
    }
  });
}
