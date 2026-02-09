import { WebSocketServer, WebSocket } from "ws";
import { Server, IncomingMessage } from "http";
import { storage } from "./storage";
import { parse } from "url";

interface ChatMessage {
  type: string;
  payload?: any;
}

interface ConnectedUser {
  ws: WebSocket;
  odUserId: string;
  conversationIds: Set<string>;
}

const connectedUsers: Map<string, ConnectedUser> = new Map();
const conversationSubscribers: Map<string, Set<string>> = new Map();

export function setupChatWebSocket(server: Server): WebSocketServer {
  // Use noServer mode and handle upgrade manually
  const wss = new WebSocketServer({ noServer: true });

  console.log("[chat] WebSocket server initialized");

  // Handle upgrade event
  server.on("upgrade", (request: IncomingMessage, socket, head) => {
    const { pathname } = parse(request.url || "");
    
    if (pathname === "/ws/chat") {
      console.log("[chat] Upgrade request received for /ws/chat");
      wss.handleUpgrade(request, socket, head, (ws) => {
        console.log("[chat] Connection upgraded successfully");
        wss.emit("connection", ws, request);
      });
    }
    // Don't close socket for other paths - let other handlers deal with them
  });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    console.log("[chat] New connection from:", req.socket.remoteAddress);
    let currentUserId: string | null = null;

    ws.on("message", async (data) => {
      try {
        const message: ChatMessage = JSON.parse(data.toString());
        console.log("[chat] Received message type:", message.type);

        switch (message.type) {
          case "auth":
            currentUserId = message.payload?.userId;
            if (currentUserId) {
              connectedUsers.set(currentUserId, {
                ws,
                odUserId: currentUserId,
                conversationIds: new Set(),
              });
              console.log("[chat] User authenticated:", currentUserId);
              ws.send(JSON.stringify({ type: "auth_success" }));
            }
            break;

          case "subscribe_conversation":
            if (currentUserId && message.payload?.conversationId) {
              const convId = message.payload.conversationId;
              const user = connectedUsers.get(currentUserId);
              if (user) {
                user.conversationIds.add(convId);
                if (!conversationSubscribers.has(convId)) {
                  conversationSubscribers.set(convId, new Set());
                }
                conversationSubscribers.get(convId)!.add(currentUserId);
                console.log("[chat] User", currentUserId, "subscribed to", convId);
              }
            }
            break;

          case "unsubscribe_conversation":
            if (currentUserId && message.payload?.conversationId) {
              const convId = message.payload.conversationId;
              const user = connectedUsers.get(currentUserId);
              if (user) {
                user.conversationIds.delete(convId);
                conversationSubscribers.get(convId)?.delete(currentUserId);
              }
            }
            break;

          case "send_message":
            if (currentUserId && message.payload?.conversationId && message.payload?.content) {
              const { conversationId, content } = message.payload;
              try {
                const newMessage = await storage.createMessage({
                  conversationId: String(conversationId),
                  senderId: currentUserId,
                  content,
                });
                console.log("[chat] Message created:", newMessage.id);
                broadcastToConversation(conversationId, {
                  type: "new_message",
                  payload: {
                    conversationId,
                    message: newMessage,
                  },
                });
              } catch (error) {
                console.error("[chat] Error creating message:", error);
                ws.send(JSON.stringify({
                  type: "error",
                  payload: { message: "Failed to send message" },
                }));
              }
            }
            break;

          case "typing":
            if (currentUserId && message.payload?.conversationId) {
              const { conversationId, isTyping } = message.payload;
              broadcastToConversation(conversationId, {
                type: "user_typing",
                payload: {
                  conversationId,
                  userId: currentUserId,
                  isTyping,
                },
              }, currentUserId);
            }
            break;
        }
      } catch (error) {
        console.error("[chat] Error processing message:", error);
      }
    });

    ws.on("close", () => {
      console.log("[chat] Connection closed for user:", currentUserId);
      if (currentUserId) {
        const user = connectedUsers.get(currentUserId);
        if (user) {
          user.conversationIds.forEach((convId) => {
            conversationSubscribers.get(convId)?.delete(currentUserId!);
          });
        }
        connectedUsers.delete(currentUserId);
      }
    });

    ws.on("error", (error) => {
      console.error("[chat] WebSocket error:", error);
    });
  });

  return wss;
}

function broadcastToConversation(
  conversationId: string,
  message: ChatMessage,
  excludeUserId?: string
) {
  const subscribers = conversationSubscribers.get(conversationId);
  if (!subscribers) return;

  const messageStr = JSON.stringify(message);
  subscribers.forEach((odUserId) => {
    if (excludeUserId && odUserId === excludeUserId) return;
    const user = connectedUsers.get(odUserId);
    if (user && user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(messageStr);
    }
  });
}

export function notifyNewMessage(conversationId: string, message: any, senderId: string) {
  broadcastToConversation(conversationId, {
    type: "new_message",
    payload: {
      conversationId,
      message,
    },
  });
}
