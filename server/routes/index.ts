import type { Express } from "express";
import type { Server } from "http";
import { setupAuth, registerAuthRoutes } from "../auth";
import { registerObjectStorageRoutes } from "../object-storage";
import { registerAdminRoutes } from "../admin-routes";

import { registerLeaderboardRoutes } from "./leaderboard.routes";
import { registerScoresRoutes } from "./scores.routes";
import { registerProfileRoutes } from "./profile.routes";
import { registerSettingsRoutes } from "./settings.routes";
import { registerProgressionRoutes } from "./progression.routes";
import { registerPaymentRoutes } from "./payment.routes";
import { registerInventoryRoutes } from "./inventory.routes";
import { registerShopRoutes } from "./shop.routes";
import { registerRankedRoutes } from "./ranked.routes";
import { registerChatRoutes } from "./chat.routes";
import { registerGiftsRoutes } from "./gifts.routes";
import { registerSocialRoutes } from "./social.routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  registerLeaderboardRoutes(app);
  registerScoresRoutes(app);
  registerProfileRoutes(app);
  registerSettingsRoutes(app);
  registerProgressionRoutes(app);
  registerPaymentRoutes(app);
  registerInventoryRoutes(app);
  registerShopRoutes(app);
  registerRankedRoutes(app);
  registerChatRoutes(app);
  registerGiftsRoutes(app);
  registerSocialRoutes(app);

  registerObjectStorageRoutes(app);
  registerAdminRoutes(app);

  return httpServer;
}
