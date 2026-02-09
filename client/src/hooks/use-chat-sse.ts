import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface SSEMessage {
  type: string;
  conversationId?: string;
  message?: any;
  userId?: string;
  isTyping?: boolean;
}

interface UseChatSSEOptions {
  userId?: string;
  onNewMessage?: (conversationId: string, message: any) => void;
  onTyping?: (conversationId: string, userId: string, isTyping: boolean) => void;
  enabled?: boolean;
}

export function useChatSSE({ userId, onNewMessage, onTyping, enabled = true }: UseChatSSEOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const queryClient = useQueryClient();
  const subscribedConversationsRef = useRef<Set<string>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectedRef = useRef(false);

  const connect = useCallback(() => {
    if (!userId || !enabled) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    console.log('[chat-sse] Connecting...');
    const eventSource = new EventSource('/api/chat/events', { withCredentials: true });
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[chat-sse] Connected');
      isConnectedRef.current = true;
      
      // Resubscribe to all conversations
      subscribedConversationsRef.current.forEach((conversationId) => {
        apiRequest('POST', `/api/chat/subscribe/${conversationId}`).catch(console.error);
      });
    };

    eventSource.addEventListener('connected', (event) => {
      console.log('[chat-sse] Received connected event:', event.data);
    });

    eventSource.addEventListener('subscribed', (event) => {
      console.log('[chat-sse] Subscribed to conversation:', event.data);
    });

    eventSource.addEventListener('message', (event) => {
      try {
        const data: SSEMessage = JSON.parse(event.data);
        console.log('[chat-sse] Received message event:', data);

        if (data.type === 'new_message' && data.conversationId && data.message) {
          // Invalidate messages query
          queryClient.invalidateQueries({ 
            queryKey: ['/api/conversations', data.conversationId, 'messages'] 
          });
          
          // Invalidate conversations list for unread count
          queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
          
          // Call callback
          onNewMessage?.(data.conversationId, data.message);
        }
      } catch (error) {
        console.error('[chat-sse] Error parsing message:', error);
      }
    });

    eventSource.addEventListener('typing', (event) => {
      try {
        const data: SSEMessage = JSON.parse(event.data);
        if (data.type === 'user_typing' && data.conversationId && data.userId !== undefined && data.isTyping !== undefined) {
          onTyping?.(data.conversationId, data.userId, data.isTyping);
        }
      } catch (error) {
        console.error('[chat-sse] Error parsing typing:', error);
      }
    });

    eventSource.onerror = (error) => {
      console.error('[chat-sse] Connection error:', error);
      isConnectedRef.current = false;
      eventSource.close();

      // Attempt reconnection after delay
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('[chat-sse] Attempting reconnection...');
        connect();
      }, 3000);
    };
  }, [userId, enabled, onNewMessage, onTyping, queryClient]);

  useEffect(() => {
    if (userId && enabled) {
      connect();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      isConnectedRef.current = false;
    };
  }, [userId, enabled, connect]);

  const subscribeToConversation = useCallback(async (conversationId: string) => {
    subscribedConversationsRef.current.add(conversationId);
    
    if (isConnectedRef.current) {
      try {
        await apiRequest('POST', `/api/chat/subscribe/${conversationId}`);
        console.log('[chat-sse] Subscribed to:', conversationId);
      } catch (error) {
        console.error('[chat-sse] Error subscribing:', error);
      }
    }
  }, []);

  const unsubscribeFromConversation = useCallback(async (conversationId: string) => {
    subscribedConversationsRef.current.delete(conversationId);
    
    try {
      await apiRequest('POST', `/api/chat/unsubscribe/${conversationId}`);
      console.log('[chat-sse] Unsubscribed from:', conversationId);
    } catch (error) {
      console.error('[chat-sse] Error unsubscribing:', error);
    }
  }, []);

  const sendTypingIndicator = useCallback(async (conversationId: string, isTyping: boolean) => {
    try {
      await apiRequest('POST', `/api/chat/typing/${conversationId}`, { isTyping });
    } catch (error) {
      console.error('[chat-sse] Error sending typing indicator:', error);
    }
  }, []);

  return {
    isConnected: isConnectedRef.current,
    subscribeToConversation,
    unsubscribeFromConversation,
    sendTypingIndicator,
  };
}
