import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";

export function registerSocialRoutes(app: Express): void {
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
}
