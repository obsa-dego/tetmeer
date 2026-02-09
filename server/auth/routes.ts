import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { supabase } from "../supabase";

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let user = await authStorage.getUser(userId);

      // Auto-upsert user if not found in DB (first login after OAuth)
      if (!user) {
        const token = req.headers.authorization?.slice(7);
        const { data: { user: supaUser } } = await supabase.auth.getUser(token);
        if (supaUser) {
          user = await authStorage.upsertUser({
            id: supaUser.id,
            email: supaUser.email || undefined,
            firstName: supaUser.user_metadata?.full_name || supaUser.user_metadata?.given_name || undefined,
            lastName: supaUser.user_metadata?.family_name || undefined,
            profileImageUrl: supaUser.user_metadata?.avatar_url || undefined,
          });
        }
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
