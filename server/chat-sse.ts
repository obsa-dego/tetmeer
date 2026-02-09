import { Response } from "express";

interface SSEClient {
  response: Response;
  odUserId: string;
  conversationIds: Set<string>;
}

const connectedClients: Map<string, SSEClient> = new Map();
const conversationSubscribers: Map<string, Set<string>> = new Map();

export function addSSEClient(userId: string, res: Response) {
  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);

  // Store client
  connectedClients.set(userId, {
    response: res,
    odUserId: userId,
    conversationIds: new Set(),
  });

  console.log("[chat-sse] Client connected:", userId);

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 30000);

  // Handle client disconnect
  res.on('close', () => {
    clearInterval(heartbeat);
    const client = connectedClients.get(userId);
    if (client) {
      client.conversationIds.forEach((convId) => {
        conversationSubscribers.get(convId)?.delete(userId);
      });
    }
    connectedClients.delete(userId);
    console.log("[chat-sse] Client disconnected:", userId);
  });
}

export function subscribeToConversation(userId: string, conversationId: string) {
  const client = connectedClients.get(userId);
  if (client) {
    client.conversationIds.add(conversationId);
    if (!conversationSubscribers.has(conversationId)) {
      conversationSubscribers.set(conversationId, new Set());
    }
    conversationSubscribers.get(conversationId)!.add(userId);
    console.log("[chat-sse] User", userId, "subscribed to", conversationId);
    
    // Send acknowledgment
    client.response.write(`event: subscribed\ndata: ${JSON.stringify({ conversationId })}\n\n`);
  }
}

export function unsubscribeFromConversation(userId: string, conversationId: string) {
  const client = connectedClients.get(userId);
  if (client) {
    client.conversationIds.delete(conversationId);
    conversationSubscribers.get(conversationId)?.delete(userId);
  }
}

export function broadcastNewMessage(conversationId: string, message: any) {
  const subscribers = conversationSubscribers.get(conversationId);
  if (!subscribers) {
    console.log("[chat-sse] No subscribers for conversation:", conversationId);
    return;
  }

  const eventData = JSON.stringify({
    type: 'new_message',
    conversationId,
    message,
  });

  console.log("[chat-sse] Broadcasting message to", subscribers.size, "subscribers");
  
  subscribers.forEach((userId) => {
    const client = connectedClients.get(userId);
    if (client) {
      try {
        client.response.write(`event: message\ndata: ${eventData}\n\n`);
      } catch (error) {
        console.error("[chat-sse] Error sending to client:", userId, error);
      }
    }
  });
}

export function broadcastTyping(conversationId: string, userId: string, isTyping: boolean) {
  const subscribers = conversationSubscribers.get(conversationId);
  if (!subscribers) return;

  const eventData = JSON.stringify({
    type: 'user_typing',
    conversationId,
    userId,
    isTyping,
  });

  subscribers.forEach((subscriberId) => {
    if (subscriberId === userId) return; // Don't send typing to self
    const client = connectedClients.get(subscriberId);
    if (client) {
      try {
        client.response.write(`event: typing\ndata: ${eventData}\n\n`);
      } catch (error) {
        console.error("[chat-sse] Error sending typing to client:", subscriberId, error);
      }
    }
  });
}

export function isClientConnected(userId: string): boolean {
  return connectedClients.has(userId);
}
