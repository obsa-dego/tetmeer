import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from './use-auth';

interface ChatMessage {
  type: string;
  payload?: any;
}

interface ReceivedMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface UseChatWebSocketOptions {
  conversationId?: string | null;
  onNewMessage?: (message: ReceivedMessage) => void;
  onTyping?: (userId: string, isTyping: boolean) => void;
}

export function useChatWebSocket({ conversationId, onNewMessage, onTyping }: UseChatWebSocketOptions) {
  const { user, isAuthenticated } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const subscribedConvRef = useRef<string | null>(null);
  
  // Store callbacks in refs to avoid recreation issues
  const onNewMessageRef = useRef(onNewMessage);
  const onTypingRef = useRef(onTyping);
  const userIdRef = useRef(user?.id);
  
  // Update refs when callbacks change
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);
  
  useEffect(() => {
    onTypingRef.current = onTyping;
  }, [onTyping]);
  
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  const connect = useCallback(() => {
    if (!isAuthenticated || !userIdRef.current) {
      console.log('[chat-ws] Not authenticated, skipping connection');
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[chat-ws] Already connected');
      return;
    }
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('[chat-ws] Already connecting');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/chat`;
    
    console.log('[chat-ws] Connecting to:', wsUrl);
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[chat-ws] Connected successfully');
        setIsConnected(true);
        ws.send(JSON.stringify({
          type: 'auth',
          payload: { userId: userIdRef.current },
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message: ChatMessage = JSON.parse(event.data);
          console.log('[chat-ws] Received message:', message.type);
          
          switch (message.type) {
            case 'new_message':
              if (message.payload?.message) {
                onNewMessageRef.current?.(message.payload.message);
              }
              break;
            case 'user_typing':
              if (message.payload?.userId && message.payload?.isTyping !== undefined) {
                onTypingRef.current?.(message.payload.userId, message.payload.isTyping);
              }
              break;
            case 'auth_success':
              console.log('[chat-ws] Auth successful');
              break;
          }
        } catch (error) {
          console.error('[chat-ws] Error parsing message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('[chat-ws] Connection closed:', event.code, event.reason);
        setIsConnected(false);
        subscribedConvRef.current = null;
        
        // Only reconnect if not intentionally closed
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[chat-ws] Attempting reconnection...');
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('[chat-ws] WebSocket error:', error);
      };
    } catch (error) {
      console.error('[chat-ws] Failed to create WebSocket:', error);
    }
  }, [isAuthenticated]); // Only depend on isAuthenticated

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Intentional disconnect');
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const subscribeToConversation = useCallback((convId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && subscribedConvRef.current !== convId) {
      if (subscribedConvRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'unsubscribe_conversation',
          payload: { conversationId: subscribedConvRef.current },
        }));
      }
      console.log('[chat-ws] Subscribing to conversation:', convId);
      wsRef.current.send(JSON.stringify({
        type: 'subscribe_conversation',
        payload: { conversationId: convId },
      }));
      subscribedConvRef.current = convId;
    }
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && subscribedConvRef.current) {
      console.log('[chat-ws] Sending message via WebSocket');
      wsRef.current.send(JSON.stringify({
        type: 'send_message',
        payload: {
          conversationId: subscribedConvRef.current,
          content,
        },
      }));
      return true;
    }
    console.log('[chat-ws] WebSocket not ready, using HTTP fallback');
    return false;
  }, []);

  const sendTyping = useCallback((convId: string, isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        payload: {
          conversationId: convId,
          isTyping,
        },
      }));
    }
  }, []);

  // Connect when authenticated
  useEffect(() => {
    if (isAuthenticated && userIdRef.current) {
      connect();
    }
    return () => disconnect();
  }, [isAuthenticated, connect, disconnect]);

  // Subscribe to conversation when connected and conversation changes
  useEffect(() => {
    if (conversationId && isConnected) {
      subscribeToConversation(conversationId);
    }
  }, [conversationId, isConnected, subscribeToConversation]);

  return {
    isConnected,
    sendMessage,
    sendTyping,
    subscribeToConversation,
  };
}
