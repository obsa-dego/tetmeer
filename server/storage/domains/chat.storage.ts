import {
  conversations,
  messages,
  type Conversation,
  type Message,
  type InsertMessage,
} from "@shared/schema";
import { users, type User } from "@shared/models/auth";
import { db } from "../../db";
import { eq, desc, sql, and } from "drizzle-orm";

export class ChatStorage {
  async getUserConversations(userId: string): Promise<{ conversation: Conversation; otherUser: User | null; lastMessage: Message | null; unreadCount: number }[]> {
    const userConversations = await db
      .select()
      .from(conversations)
      .where(
        sql`${conversations.participantAId} = ${userId} OR ${conversations.participantBId} = ${userId}`
      )
      .orderBy(desc(conversations.lastMessageAt));

    const results = await Promise.all(
      userConversations.map(async (conv) => {
        const otherUserId = conv.participantAId === userId ? conv.participantBId : conv.participantAId;
        const [otherUser] = await db.select().from(users).where(eq(users.id, otherUserId));

        const [lastMessage] = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conv.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        const unreadMessages = await db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, conv.id),
              eq(messages.isRead, false),
              sql`${messages.senderId} != ${userId}`
            )
          );

        return {
          conversation: conv,
          otherUser: otherUser || null,
          lastMessage: lastMessage || null,
          unreadCount: Number(unreadMessages[0]?.count || 0),
        };
      })
    );

    return results;
  }

  async getOrCreateConversation(participantAId: string, participantBId: string): Promise<Conversation> {
    const [existing] = await db
      .select()
      .from(conversations)
      .where(
        sql`(${conversations.participantAId} = ${participantAId} AND ${conversations.participantBId} = ${participantBId})
            OR (${conversations.participantAId} = ${participantBId} AND ${conversations.participantBId} = ${participantAId})`
      );

    if (existing) {
      return existing;
    }

    const [newConversation] = await db
      .insert(conversations)
      .values({
        participantAId,
        participantBId,
        lastMessageAt: new Date(),
      })
      .returning();

    return newConversation;
  }

  async getConversation(conversationId: string): Promise<Conversation | undefined> {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    return conv;
  }

  async getConversationMessages(conversationId: string, limit: number = 50): Promise<Message[]> {
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    return msgs.reverse();
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db
      .insert(messages)
      .values(message)
      .returning();

    await db
      .update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, message.conversationId));

    return newMessage;
  }

  async markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          sql`${messages.senderId} != ${userId}`
        )
      );
  }
}
