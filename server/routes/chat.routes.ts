import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { adminGifts } from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { addSSEClient, subscribeToConversation, unsubscribeFromConversation, broadcastNewMessage, broadcastTyping } from "../chat-sse";
import { ObjectStorageService } from "../object-storage";

// Rate limiting for chat image uploads
const chatImageRateLimits = new Map<string, { count: number; resetAt: number }>();
const CHAT_IMAGE_RATE_LIMIT = 10;
const CHAT_IMAGE_RATE_WINDOW = 60 * 1000;

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

const MAX_CHAT_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export function registerChatRoutes(app: Express): void {
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

  app.get("/api/conversations/:conversationId/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { conversationId } = req.params;

      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const isParticipant = conversation.participantAId === userId || conversation.participantBId === userId;

      if (!isParticipant) {
        return res.status(403).json({ message: "Not authorized to view this conversation" });
      }

      const msgs = await storage.getConversationMessages(conversationId);
      await storage.markMessagesAsRead(conversationId, userId);

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

      broadcastNewMessage(conversationId, message);

      res.json({ message });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.get("/api/chat/events", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    console.log("[chat-sse] SSE connection from user:", userId);
    addSSEClient(userId, res);
  });

  app.post("/api/chat/subscribe/:conversationId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { conversationId } = req.params;

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

  // Chat image upload with rate limiting
  const objectStorageService = new ObjectStorageService();

  app.post("/api/chat/upload-image", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const rateCheck = checkChatImageRateLimit(userId);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          message: "Too many image uploads. Please wait before uploading again.",
          resetIn: Math.ceil(rateCheck.resetIn / 1000),
        });
      }

      const { name, size, contentType } = req.body;

      if (!name || !size || !contentType) {
        return res.status(400).json({ message: "Missing file metadata" });
      }

      if (size > MAX_CHAT_IMAGE_SIZE) {
        return res.status(400).json({
          message: "Image too large. Maximum size is 10MB.",
          maxSize: MAX_CHAT_IMAGE_SIZE,
        });
      }

      if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
        return res.status(400).json({
          message: "Invalid image type. Allowed: JPEG, PNG, GIF, WebP",
          allowedTypes: ALLOWED_IMAGE_TYPES,
        });
      }

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
}
