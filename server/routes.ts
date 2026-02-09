import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./auth";
import { createPolarCheckout, verifyPolarCheckout, listPolarProducts, isPolarAvailable, getCustomerSubscriptions, cancelSubscription, reactivateSubscription, createCustomerPortalSession, getCustomerIdByEmail } from "./polar";
import { blockTextureEnum, gameEngineEnum, viewModeEnum, type BlockTexture, type GameEngine, type ViewMode, adminGifts, playerProgression, userInventory, OPERATOR_ID, shopItemPriceOptions } from "@shared/schema";
import { calculateExpiryDate, type ShopItemDuration } from "@shared/shop";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { addSSEClient, subscribeToConversation, unsubscribeFromConversation, broadcastNewMessage, broadcastTyping } from "./chat-sse";
import { registerObjectStorageRoutes, ObjectStorageService } from "./object-storage";
import { isAdmin, isSuperAdmin } from "./middleware/admin";
import { registerAdminRoutes } from "./admin-routes";

// Rate limiting for chat image uploads - prevent abuse
const chatImageRateLimits = new Map<string, { count: number; resetAt: number }>();
const CHAT_IMAGE_RATE_LIMIT = 10; // max uploads per window
const CHAT_IMAGE_RATE_WINDOW = 60 * 1000; // 1 minute window

function checkChatImageRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const userLimit = chatImageRateLimits.get(userId);
  
  if (!userLimit || now >= userLimit.resetAt) {
    chatImageRateLimits.set(userId, { count: 1, resetAt: now + CHAT_IMAGE_RATE_WINDOW });
    return { allowed: true, remaining: CHAT_IMAGE_RATE_LIMIT - 1, resetIn: CHAT_IMAGE_RATE_WINDOW };
  }
  
  if (userLimit.count >= CHAT_IMAGE_RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetIn: userLimit.resetAt - now };
  }
  
  userLimit.count++;
  return { allowed: true, remaining: CHAT_IMAGE_RATE_LIMIT - userLimit.count, resetIn: userLimit.resetAt - now };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

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

  app.post("/api/scores", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { score, level, linesCleared, playTime, gameMode } = req.body;

      // Validate input types and ranges to prevent exploitation
      const validatedScore = Math.max(0, Math.min(Number(score) || 0, 10000000)); // Cap at 10M
      const validatedLevel = Math.max(1, Math.min(Number(level) || 1, 1000));
      const validatedLines = Math.max(0, Math.min(Number(linesCleared) || 0, 10000));
      const validatedPlayTime = Math.max(0, Math.min(Number(playTime) || 0, 86400000)); // Max 24 hours

      // Sanity check: score should be reasonable relative to lines cleared and play time
      // Rough estimate: max ~1000 points per line (including bonuses)
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
      
      // Award Gems based on score (1/10 of score = Gems earned, capped at 1000 Gems per game)
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

  // Get user's player progression (level, rank, RP)
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

  // Get user's ranked match history
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

  app.get("/api/polar/setup", async (req, res) => {
    res.json({ configured: isPolarAvailable() });
  });

  app.get("/api/polar/products", async (req, res) => {
    try {
      const products = await listPolarProducts();
      res.json({ products });
    } catch (error) {
      console.error("Error fetching Polar products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.post("/api/polar/checkout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const { productId, itemType } = req.body;
      
      if (!productId) {
        return res.status(400).json({ error: "Product ID is required" });
      }
      
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const successUrl = `${baseUrl}/payment/success?checkout_id={CHECKOUT_ID}&item_type=${itemType || 'item'}`;
      
      const result = await createPolarCheckout(
        productId,
        successUrl,
        userId,
        user?.email || undefined
      );
      
      if (!result) {
        return res.status(500).json({ error: "Failed to create checkout session" });
      }
      
      res.json({ 
        checkoutUrl: result.checkoutUrl,
        checkoutId: result.checkoutId
      });
    } catch (error) {
      console.error("Error creating Polar checkout:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.post("/api/polar/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { checkoutId, itemType } = req.body;
      
      if (!checkoutId) {
        return res.status(400).json({ success: false, message: "Checkout ID is required" });
      }
      
      const isUsed = await storage.isPaymentIdUsed(checkoutId);
      if (isUsed) {
        console.warn(`Duplicate payment attempt detected: ${checkoutId} by user ${userId}`);
        return res.status(400).json({ 
          success: false, 
          message: "This payment has already been processed." 
        });
      }
      
      const verification = await verifyPolarCheckout(checkoutId);
      
      if (!verification.verified) {
        console.error("Polar verification failed:", verification);
        return res.status(400).json({ 
          success: false,
          message: "Payment verification failed.", 
          details: verification.error 
        });
      }
      
      if (verification.userId !== userId) {
        console.warn(`User mismatch for checkout ${checkoutId}: expected ${userId}, got ${verification.userId}`);
        return res.status(400).json({
          success: false,
          message: "This payment was created for a different user account"
        });
      }
      
      const resolvedItemType = itemType || 'remove_bottom_row';
      
      const purchase = await storage.recordItemPurchase({
        userId,
        itemType: resolvedItemType,
        amount: 99,
        currency: 'USD',
        paymentProvider: 'polar',
        paymentId: checkoutId,
      });
      
      if (!purchase) {
        console.warn(`Race condition: payment ${checkoutId} already recorded`);
        return res.status(400).json({ 
          success: false, 
          message: "This payment has already been processed." 
        });
      }
      
      if (resolvedItemType === 'premium' || resolvedItemType === 'premium_lifetime') {
        await storage.setPremiumStatus(userId, true);
        res.json({ success: true, message: 'Premium purchased successfully', type: 'premium' });
      } else {
        await storage.addInventoryItem(userId, resolvedItemType, 1);
        const inventory = await storage.getInventoryItem(userId, resolvedItemType);
        res.json({ 
          success: true, 
          message: 'Item purchased and added to inventory',
          quantity: inventory?.quantity || 1,
          type: 'item'
        });
      }
    } catch (error) {
      console.error("Error verifying Polar checkout:", error);
      res.status(500).json({ success: false, message: "Failed to verify payment" });
    }
  });

  app.get("/api/subscription/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.email) {
        return res.json({ subscriptions: [], hasActiveSubscription: false });
      }
      
      const subscriptions = await getCustomerSubscriptions(user.email);
      
      res.json({
        subscriptions: subscriptions.map((sub: any) => ({
          id: sub.id,
          status: sub.status,
          productId: sub.productId,
          productName: sub.product?.name || 'Premium',
          amount: sub.amount,
          currency: sub.currency,
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        })),
        hasActiveSubscription: subscriptions.length > 0,
      });
    } catch (error) {
      console.error("Error fetching subscription status:", error);
      res.status(500).json({ message: "Failed to fetch subscription status" });
    }
  });

  app.post("/api/subscription/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { subscriptionId } = req.body;
      
      if (!subscriptionId) {
        return res.status(400).json({ success: false, message: "Subscription ID is required" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.email) {
        return res.status(400).json({ success: false, message: "User not found" });
      }
      
      const subscriptions = await getCustomerSubscriptions(user.email);
      const subscription = subscriptions.find((sub: any) => sub.id === subscriptionId);
      
      if (!subscription) {
        return res.status(403).json({ success: false, message: "Subscription not found or not owned by user" });
      }
      
      const result = await cancelSubscription(subscriptionId);
      
      if (result.success) {
        res.json({ success: true, message: "Subscription will be cancelled at the end of the billing period" });
      } else {
        res.status(500).json({ success: false, message: result.error || "Failed to cancel subscription" });
      }
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ success: false, message: "Failed to cancel subscription" });
    }
  });

  app.post("/api/subscription/reactivate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { subscriptionId } = req.body;
      
      if (!subscriptionId) {
        return res.status(400).json({ success: false, message: "Subscription ID is required" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.email) {
        return res.status(400).json({ success: false, message: "User not found" });
      }
      
      const subscriptions = await getCustomerSubscriptions(user.email);
      const subscription = subscriptions.find((sub: any) => sub.id === subscriptionId);
      
      if (!subscription) {
        return res.status(403).json({ success: false, message: "Subscription not found or not owned by user" });
      }
      
      const result = await reactivateSubscription(subscriptionId);
      
      if (result.success) {
        res.json({ success: true, message: "Subscription reactivated successfully" });
      } else {
        res.status(500).json({ success: false, message: result.error || "Failed to reactivate subscription" });
      }
    } catch (error) {
      console.error("Error reactivating subscription:", error);
      res.status(500).json({ success: false, message: "Failed to reactivate subscription" });
    }
  });

  app.get("/api/billing/portal", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.email) {
        return res.status(400).json({ success: false, message: "User not found" });
      }
      
      const customerId = await getCustomerIdByEmail(user.email);
      
      if (!customerId) {
        return res.status(404).json({ success: false, message: "No billing account found" });
      }
      
      const portalUrl = await createCustomerPortalSession(customerId);
      
      if (portalUrl) {
        res.json({ success: true, url: portalUrl });
      } else {
        res.status(500).json({ success: false, message: "Failed to create billing portal session" });
      }
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      res.status(500).json({ success: false, message: "Failed to access billing portal" });
    }
  });

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


  app.get("/api/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let profile = await storage.getProfile(userId);
      
      if (!profile) {
        profile = await storage.upsertProfile({ userId });
      }
      
      res.json({
        blockTexture: profile.blockTexture || 'default',
        backgroundColor: profile.backgroundColor || '#000000',
        gridColor: profile.gridColor || '#ffffff',
        invertX: profile.invertX ?? false,
        invertY: profile.invertY ?? false,
        mouseSensitivity: profile.mouseSensitivity ?? 50,
        wheelSensitivity: profile.wheelSensitivity ?? 50,
        gameEngine: profile.gameEngine || 'gravity',
        showPet: profile.showPet ?? false,
        selectedPets: profile.selectedPets || ['pet_puppy'],
        gridMaterial: profile.gridMaterial || 'default',
        boardMaterial: profile.boardMaterial || 'default',
        viewMode: profile.viewMode || '3d',
        equippedDecorations: profile.equippedDecorations || '{}',
        placedDecorations: profile.placedDecorations || '[]',
      });
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { blockTexture, backgroundColor, gridColor, invertX, invertY, mouseSensitivity, wheelSensitivity, gameEngine, showPet, selectedPets, gridMaterial, boardMaterial, viewMode, equippedDecorations, placedDecorations } = req.body;
      
      if (blockTexture && !blockTextureEnum.includes(blockTexture)) {
        return res.status(400).json({ message: "Invalid block texture" });
      }
      
      if (gameEngine && !gameEngineEnum.includes(gameEngine)) {
        return res.status(400).json({ message: "Invalid game engine" });
      }
      
      if (viewMode && !viewModeEnum.includes(viewMode)) {
        return res.status(400).json({ message: "Invalid view mode" });
      }
      
      const updates: any = {};
      if (blockTexture) updates.blockTexture = blockTexture;
      if (backgroundColor) updates.backgroundColor = backgroundColor;
      if (gridColor) updates.gridColor = gridColor;
      if (typeof invertX === 'boolean') updates.invertX = invertX;
      if (typeof invertY === 'boolean') updates.invertY = invertY;
      if (typeof mouseSensitivity === 'number') updates.mouseSensitivity = Math.max(1, Math.min(100, mouseSensitivity));
      if (typeof wheelSensitivity === 'number') updates.wheelSensitivity = Math.max(1, Math.min(100, wheelSensitivity));
      if (gameEngine) updates.gameEngine = gameEngine;
      if (typeof showPet === 'boolean') updates.showPet = showPet;
      if (Array.isArray(selectedPets)) updates.selectedPets = selectedPets.slice(0, 3);
      if (gridMaterial) updates.gridMaterial = gridMaterial;
      if (boardMaterial) updates.boardMaterial = boardMaterial;
      if (viewMode) updates.viewMode = viewMode;
      if (typeof equippedDecorations === 'string') updates.equippedDecorations = equippedDecorations;
      if (typeof placedDecorations === 'string') {
        if (placedDecorations.length > 50000) {
          return res.status(400).json({ message: "Placed decorations data too large" });
        }
        try {
          const parsed = JSON.parse(placedDecorations);
          if (!Array.isArray(parsed)) {
            return res.status(400).json({ message: "Invalid placed decorations format" });
          }
          if (parsed.length > 100) {
            return res.status(400).json({ message: "Too many placed decorations (max 100)" });
          }
          for (const item of parsed) {
            if (typeof item.x !== 'number' || typeof item.z !== 'number' ||
                item.x < -50 || item.x > 50 || item.z < -50 || item.z > 50) {
              return res.status(400).json({ message: "Invalid decoration coordinates" });
            }
          }
          updates.placedDecorations = placedDecorations;
        } catch (e) {
          return res.status(400).json({ message: "Invalid placed decorations JSON" });
        }
      }
      
      if (Object.keys(updates).length > 0) {
        await storage.updateSettings(userId, updates);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
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

  // Player Progression Endpoints
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

  // Claim game rewards (XP bonus from post-game reward selection)
  // Server-side validation: only accept rewardId, lookup value from pool
  app.post("/api/rewards/claim", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { rewardId } = req.body;
      
      if (!rewardId || typeof rewardId !== 'string') {
        return res.status(400).json({ message: "Invalid reward ID" });
      }
      
      // Import reward pool for server-side validation
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

  // Shop: Get all items
  app.get("/api/shop/items", async (req, res) => {
    try {
      const { SHOP_ITEMS } = await import("@shared/shop");
      res.json({ items: SHOP_ITEMS });
    } catch (error) {
      console.error("Error fetching shop items:", error);
      res.status(500).json({ message: "Failed to fetch shop items" });
    }
  });

  // Shop: Get price options for an item (public endpoint)
  app.get("/api/shop/price-options/:itemId", async (req, res) => {
    try {
      const { itemId } = req.params;
      const isCustom = req.query.isCustom === 'true';
      
      // Check database for price options
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

  // Shop: Purchase item with RP
  app.post("/api/shop/purchase", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { itemId, duration: selectedDuration, isCustomItem } = req.body;
      
      if (!itemId || typeof itemId !== 'string') {
        return res.status(400).json({ message: "Invalid item ID" });
      }
      
      const { getShopItem, calculateExpiryDate, DURATION_CONFIGS } = await import("@shared/shop");
      
      let itemPrice: number;
      let itemDuration: string;
      let itemName: string;
      
      if (isCustomItem) {
        // Fetch custom item from database
        const { customShopItems } = await import("@shared/schema");
        const [customItem] = await db.select().from(customShopItems).where(eq(customShopItems.id, itemId));
        if (!customItem || !customItem.isActive) {
          return res.status(400).json({ message: "Item not found" });
        }
        itemName = customItem.nameKey; // Use nameKey as name
        
        // Get price from price options if duration specified
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
          // Get default price option
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
        
        // Check for price option override in database
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
            // Fall back to item default
            itemPrice = item.price;
            itemDuration = item.duration;
          }
        } else {
          itemPrice = item.price;
          itemDuration = item.duration;
        }
      }
      
      // Check if user has enough Gems
      const progression = await storage.getPlayerProgression(userId);
      if (!progression || progression.gemBalance < itemPrice) {
        return res.status(400).json({ message: "Insufficient Gem balance" });
      }
      
      // Check if user already owns this item (and it's not expired)
      const existingItem = await storage.getInventoryItem(userId, itemId);
      const now = new Date();
      const isOwned = existingItem && existingItem.quantity > 0 && (!existingItem.expiresAt || new Date(existingItem.expiresAt) > now);
      
      // Import compareDurations for upgrade/downgrade check
      const { compareDurations } = await import("@shared/shop");
      
      if (isOwned) {
        // Check if this is an upgrade/downgrade scenario
        const currentDuration = existingItem.duration as any;
        const comparison = compareDurations(currentDuration, itemDuration as any);
        
        if (comparison === 'same') {
          return res.status(400).json({ message: "You already own this item with this duration" });
        }
        
        // Block upgrade/downgrade for permanent items (they never expire)
        if (!existingItem.expiresAt) {
          return res.status(400).json({ message: "Cannot change duration of a permanent item" });
        }
        
        // Check if there's already a pending duration change
        if (existingItem.pendingDuration) {
          return res.status(400).json({ message: "You already have a pending duration change for this item. Wait for current item to expire first." });
        }
        
        // This is an upgrade or downgrade - schedule it for after current expiry
        const pendingExpiresAt = calculateExpiryDate(itemDuration as any, existingItem.expiresAt);
        
        // Deduct Gems and set pending upgrade/downgrade
        await storage.updatePlayerGem(userId, -itemPrice);
        await storage.setPendingDuration(userId, itemId, itemDuration, pendingExpiresAt, new Date());
        
        // Get updated progression
        const updatedProgression = await storage.getPlayerProgression(userId);
        
        return res.json({ 
          success: true, 
          itemId,
          itemName,
          gemSpent: itemPrice,
          duration: itemDuration,
          type: comparison, // 'upgrade' or 'downgrade'
          newGemBalance: updatedProgression?.gemBalance || 0,
          effectiveAfter: existingItem.expiresAt.toISOString(),
          pendingExpiresAt: pendingExpiresAt?.toISOString() || null
        });
      }
      
      // New purchase - calculate expiry date based on item duration
      const purchaseDate = new Date();
      const expiresAt = calculateExpiryDate(itemDuration as any, purchaseDate);
      
      // Deduct Gems and add item to inventory with duration info
      await storage.updatePlayerGem(userId, -itemPrice);
      await storage.addInventoryItem(userId, itemId, 1, expiresAt, itemDuration);
      
      // Get updated progression
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

  // Shop: Get user's owned items
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

  // Ranked Leaderboard
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

  // User's ranked match history
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

  // Check if user can play ranked (level 30+ requirement)
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

  // ========== DIRECT MESSAGES ==========
  
  // Get user's conversations
  app.get("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getUserConversations(userId);
      res.json({ conversations });
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // Create or get existing conversation with another user
  app.post("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { otherUserId } = req.body;

      if (!otherUserId) {
        return res.status(400).json({ message: "Other user ID is required" });
      }

      if (otherUserId === userId) {
        return res.status(400).json({ message: "Cannot create conversation with yourself" });
      }

      const conversation = await storage.getOrCreateConversation(userId, otherUserId);
      res.json({ conversation });
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Get messages for a conversation
  app.get("/api/conversations/:conversationId/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { conversationId } = req.params;

      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // User must be a participant to access conversation
      // For operator conversations, the user is always one of the participants (OPERATOR is the other)
      const isParticipant = conversation.participantAId === userId || conversation.participantBId === userId;
      
      if (!isParticipant) {
        return res.status(403).json({ message: "Not authorized to view this conversation" });
      }

      const msgs = await storage.getConversationMessages(conversationId);
      await storage.markMessagesAsRead(conversationId, userId);
      
      // Enrich messages with gift claimed status and gift details
      const enrichedMessages = await Promise.all(msgs.map(async (msg: any) => {
        if (msg.giftId) {
          const [gift] = await db.select({
            claimedAt: adminGifts.claimedAt,
            giftType: adminGifts.giftType,
            itemId: adminGifts.itemId,
            gemAmount: adminGifts.gemAmount,
          }).from(adminGifts).where(eq(adminGifts.id, msg.giftId));
          return { 
            ...msg, 
            giftClaimed: gift?.claimedAt ? true : false,
            giftClaimedAt: gift?.claimedAt || null,
            giftType: gift?.giftType || null,
            giftItemId: gift?.itemId || null,
            giftGemAmount: gift?.gemAmount || 0,
          };
        }
        return { ...msg, giftClaimed: false, giftClaimedAt: null, giftType: null, giftItemId: null, giftGemAmount: 0 };
      }));
      
      res.json({ messages: enrichedMessages });
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Send a message
  app.post("/api/conversations/:conversationId/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { conversationId } = req.params;
      const { content, imageUrl } = req.body;

      const hasContent = content && typeof content === 'string' && content.trim().length > 0;
      const hasImage = imageUrl && typeof imageUrl === 'string' && imageUrl.length > 0;

      if (!hasContent && !hasImage) {
        return res.status(400).json({ message: "Message content or image is required" });
      }

      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      if (conversation.participantAId !== userId && conversation.participantBId !== userId) {
        return res.status(403).json({ message: "Not authorized to send messages in this conversation" });
      }

      const message = await storage.createMessage({
        conversationId,
        senderId: userId,
        content: hasContent ? content.trim() : '',
        imageUrl: hasImage ? imageUrl : undefined,
      });

      // Broadcast message via SSE to all subscribers
      broadcastNewMessage(conversationId, message);

      res.json({ message });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // SSE endpoint for real-time chat updates
  app.get("/api/chat/events", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    console.log("[chat-sse] SSE connection from user:", userId);
    addSSEClient(userId, res);
  });

  // Subscribe to a conversation for SSE updates
  app.post("/api/chat/subscribe/:conversationId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { conversationId } = req.params;

      // Verify user is part of the conversation
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      if (conversation.participantAId !== userId && conversation.participantBId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      subscribeToConversation(userId, conversationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error subscribing to conversation:", error);
      res.status(500).json({ message: "Failed to subscribe" });
    }
  });

  // Unsubscribe from a conversation
  app.post("/api/chat/unsubscribe/:conversationId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { conversationId } = req.params;
      unsubscribeFromConversation(userId, conversationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unsubscribing from conversation:", error);
      res.status(500).json({ message: "Failed to unsubscribe" });
    }
  });

  // Send typing indicator
  app.post("/api/chat/typing/:conversationId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { conversationId } = req.params;
      const { isTyping } = req.body;
      broadcastTyping(conversationId, userId, isTyping);
      res.json({ success: true });
    } catch (error) {
      console.error("Error sending typing indicator:", error);
      res.status(500).json({ message: "Failed to send typing indicator" });
    }
  });

  // Claim a gift from operator message
  app.post("/api/gifts/:giftId/claim", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { giftId } = req.params;

      // Get the gift
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

      // Process gem rewards
      if (gift.gemAmount && gift.gemAmount > 0) {
        const [progression] = await db.select().from(playerProgression).where(eq(playerProgression.userId, userId));
        if (progression) {
          await db.update(playerProgression)
            .set({ gemBalance: (progression.gemBalance || 0) + gift.gemAmount })
            .where(eq(playerProgression.userId, userId));
        }
      }

      // Process item rewards
      if (gift.itemId) {
        // Calculate expiry date based on gift duration
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

      // Mark gift as claimed
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

  // Get gift info for a message
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

  // Search for users to start a conversation with
  app.get("/api/users/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const query = req.query.q as string;

      if (!query || query.length < 2) {
        return res.json({ users: [] });
      }

      const users = await storage.searchUsers(query, userId);
      res.json({ users });
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });

  // Get user by ID (for profile pages)
  app.get("/api/users/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const targetUserId = req.params.userId;
      const currentUserId = req.user.claims.sub;
      
      const user = await storage.getUser(targetUserId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const profile = await storage.getProfile(targetUserId);
      const progression = await storage.getPlayerProgression(targetUserId);
      const isFriend = await storage.isFriend(currentUserId, targetUserId);
      const isBlocked = await storage.isBlocked(currentUserId, targetUserId);
      const isBlockedBy = await storage.isBlockedBy(currentUserId, targetUserId);

      res.json({
        user,
        profile,
        progression,
        isFriend,
        isBlocked,
        isBlockedBy,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Friends API
  app.get("/api/friends", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const friends = await storage.getFriends(userId);
      res.json({ friends });
    } catch (error) {
      console.error("Error fetching friends:", error);
      res.status(500).json({ message: "Failed to fetch friends" });
    }
  });

  app.post("/api/friends/:friendId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const friendId = req.params.friendId;

      if (userId === friendId) {
        return res.status(400).json({ message: "Cannot add yourself as friend" });
      }

      // Check if blocked
      const isBlockedBy = await storage.isBlockedBy(userId, friendId);
      if (isBlockedBy) {
        return res.status(403).json({ message: "Cannot add this user as friend" });
      }

      const friendship = await storage.addFriend(userId, friendId);
      res.json({ friendship });
    } catch (error) {
      console.error("Error adding friend:", error);
      res.status(500).json({ message: "Failed to add friend" });
    }
  });

  app.delete("/api/friends/:friendId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const friendId = req.params.friendId;

      await storage.removeFriend(userId, friendId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing friend:", error);
      res.status(500).json({ message: "Failed to remove friend" });
    }
  });

  // Blocks API
  app.get("/api/blocks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const blockedUsers = await storage.getBlockedUsers(userId);
      res.json({ blockedUsers });
    } catch (error) {
      console.error("Error fetching blocked users:", error);
      res.status(500).json({ message: "Failed to fetch blocked users" });
    }
  });

  app.post("/api/blocks/:blockedId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const blockedId = req.params.blockedId;

      if (userId === blockedId) {
        return res.status(400).json({ message: "Cannot block yourself" });
      }

      const block = await storage.blockUser(userId, blockedId);
      res.json({ block });
    } catch (error) {
      console.error("Error blocking user:", error);
      res.status(500).json({ message: "Failed to block user" });
    }
  });

  app.delete("/api/blocks/:blockedId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const blockedId = req.params.blockedId;

      await storage.unblockUser(userId, blockedId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unblocking user:", error);
      res.status(500).json({ message: "Failed to unblock user" });
    }
  });

  // Register object storage routes
  registerObjectStorageRoutes(app);

  // Chat image upload with rate limiting and validation
  const objectStorageService = new ObjectStorageService();
  const MAX_CHAT_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  app.post("/api/chat/upload-image", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Rate limit check
      const rateCheck = checkChatImageRateLimit(userId);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          message: "Too many image uploads. Please wait before uploading again.",
          resetIn: Math.ceil(rateCheck.resetIn / 1000),
        });
      }

      const { name, size, contentType } = req.body;

      // Validate file metadata
      if (!name || !size || !contentType) {
        return res.status(400).json({ message: "Missing file metadata" });
      }

      // Validate file size (check before upload)
      if (size > MAX_CHAT_IMAGE_SIZE) {
        return res.status(400).json({
          message: "Image too large. Maximum size is 10MB.",
          maxSize: MAX_CHAT_IMAGE_SIZE,
        });
      }

      // Validate content type
      if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
        return res.status(400).json({
          message: "Invalid image type. Allowed: JPEG, PNG, GIF, WebP",
          allowedTypes: ALLOWED_IMAGE_TYPES,
        });
      }

      // Validate file extension matches content type
      const ext = name.split('.').pop()?.toLowerCase();
      const validExtensions: Record<string, string[]> = {
        'image/jpeg': ['jpg', 'jpeg'],
        'image/png': ['png'],
        'image/gif': ['gif'],
        'image/webp': ['webp'],
      };
      if (!ext || !validExtensions[contentType]?.includes(ext)) {
        return res.status(400).json({ message: "File extension does not match content type" });
      }

      // Get presigned upload URL
      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL();

      res.json({
        uploadURL,
        objectPath,
        remaining: rateCheck.remaining,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating chat image upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // Register admin routes
  registerAdminRoutes(app);

  return httpServer;
}
