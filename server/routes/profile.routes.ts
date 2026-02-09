import type { Express } from "express";
import multer from "multer";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export function registerProfileRoutes(app: Express): void {
  app.get("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let profile = await storage.getProfile(userId);

      if (!profile) {
        profile = await storage.upsertProfile({
          userId,
          highScore: 0,
          totalGamesPlayed: 0,
          totalLinesCleared: 0,
          totalPlayTime: 0,
        });
      }

      res.json(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.get("/api/profile/high-scores", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const highScores = await storage.getUserHighScores(userId);
      res.json({ highScores });
    } catch (error) {
      console.error("Error fetching high scores:", error);
      res.status(500).json({ message: "Failed to fetch high scores" });
    }
  });

  app.patch("/api/profile/nickname", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { nickname } = req.body;

      if (!nickname || typeof nickname !== 'string') {
        return res.status(400).json({ message: "Nickname is required" });
      }

      if (nickname.length < 2 || nickname.length > 20) {
        return res.status(400).json({ message: "Nickname must be 2-20 characters" });
      }

      const user = await storage.updateUserNickname(userId, nickname.trim());
      res.json({ success: true, user });
    } catch (error) {
      console.error("Error updating nickname:", error);
      res.status(500).json({ message: "Failed to update nickname" });
    }
  });

  app.patch("/api/profile/image", isAuthenticated, upload.single('image'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "Image file is required" });
      }

      const profile = await storage.getProfile(userId);
      if (!profile?.isPremium) {
        return res.status(403).json({ message: "Profile image upload is a premium feature" });
      }

      if (file.size > 10 * 1024 * 1024) {
        return res.status(400).json({ message: "Image must be less than 10MB" });
      }

      const base64Image = file.buffer.toString('base64');
      const dataUrl = `data:${file.mimetype};base64,${base64Image}`;
      const user = await storage.updateUserProfileImage(userId, dataUrl);

      res.json({ success: true, user });
    } catch (error) {
      console.error("Error updating profile image:", error);
      res.status(500).json({ message: "Failed to update profile image" });
    }
  });

  app.get("/api/profile/titles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getProfile(userId);

      res.json({
        ownedTitles: profile?.ownedTitles || [],
        selectedTitle: profile?.selectedTitle || null,
      });
    } catch (error) {
      console.error("Error fetching titles:", error);
      res.status(500).json({ message: "Failed to fetch titles" });
    }
  });

  app.patch("/api/profile/title", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { titleId } = req.body;

      if (titleId !== null && typeof titleId !== 'string') {
        return res.status(400).json({ message: "Invalid title ID" });
      }

      const profile = await storage.setSelectedTitle(userId, titleId);

      if (!profile && titleId !== null) {
        return res.status(400).json({ message: "You do not own this title" });
      }

      res.json({ success: true, selectedTitle: profile?.selectedTitle || null });
    } catch (error) {
      console.error("Error updating title:", error);
      res.status(500).json({ message: "Failed to update title" });
    }
  });

  app.patch("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { backgroundImage } = req.body;

      if (backgroundImage !== undefined) {
        if (backgroundImage !== null && typeof backgroundImage === 'string') {
          const base64Size = (backgroundImage.length * 3) / 4;
          if (base64Size > 10 * 1024 * 1024) {
            return res.status(400).json({ message: "Image must be less than 10MB" });
          }
        }
        await storage.updateSettings(userId, { backgroundImage });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.get("/api/achievements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userAchievements = await storage.getUserAchievements(userId);

      res.json({
        unlocked: userAchievements,
      });
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  app.post("/api/achievements/:achievementId/claim", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { achievementId } = req.params;

      const hasIt = await storage.hasAchievement(userId, achievementId);
      if (!hasIt) {
        return res.status(400).json({ message: "Achievement not unlocked" });
      }

      const achievement = await storage.claimAchievementReward(userId, achievementId);
      if (!achievement) {
        return res.status(400).json({ message: "Reward already claimed" });
      }

      const { getAchievement } = await import("@shared/achievements");
      const def = getAchievement(achievementId);

      if (def?.reward.xp) {
        await storage.updatePlayerXp(userId, def.reward.xp);
      }

      if (def?.reward.titleId) {
        await storage.grantTitle(userId, def.reward.titleId);
      }

      res.json({ success: true, achievement, reward: def?.reward });
    } catch (error) {
      console.error("Error claiming achievement reward:", error);
      res.status(500).json({ message: "Failed to claim reward" });
    }
  });
}
