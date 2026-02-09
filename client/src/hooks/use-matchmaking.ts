import { useState, useEffect, useRef, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';

export interface MatchmakingState {
  status: 'idle' | 'connecting' | 'queuing' | 'match_found' | 'in_match' | 'error';
  queueTime: number;
  match: MatchData | null;
  error: string | null;
}

export interface MatchData {
  matchId: string;
  targetLines: number;
  startDelay: number;
  gameSeed: string;  // Shared seed for synchronized piece generation
  opponent: {
    userId: string;
    userName: string;
    userProfileImage: string | null;
    rankPoints: number;
    isAi: boolean;
    aiDifficulty?: string;
  };
  isPlayerA: boolean;
}

export interface OpponentUpdate {
  lines: number;
  score: number;
  board: number[][];
}

interface UseMatchmakingOptions {
  onOpponentUpdate?: (update: OpponentUpdate) => void;
  onMatchEnd?: (result: MatchEndResult) => void;
}

export interface MatchEndResult {
  won: boolean;
  reason: string;
  rankPointChange: number;
  newRankPoints: number;
  xpEarned: number;
  newLevel: number;
  opponentStats: {
    lines: number;
    score: number;
  };
}

export function useMatchmaking(options: UseMatchmakingOptions = {}) {
  const [state, setState] = useState<MatchmakingState>({
    status: 'idle',
    queueTime: 0,
    match: null,
    error: null,
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const queueTimerRef = useRef<NodeJS.Timeout | null>(null);
  const queueStartRef = useRef<number>(0);
  const optionsRef = useRef(options);
  
  
  // Keep optionsRef updated with latest callbacks
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const connect = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/matchmaking`);
      wsRef.current = ws;

      setState(prev => ({ ...prev, status: 'connecting' }));

      ws.onopen = () => {
        setState(prev => ({ ...prev, status: 'idle', error: null }));
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch (e) {
          console.error('[matchmaking] Failed to parse message:', e);
        }
      };

      ws.onerror = () => {
        setState(prev => ({ ...prev, status: 'error', error: 'Connection error' }));
        reject(new Error('Connection error'));
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (queueTimerRef.current) {
          clearInterval(queueTimerRef.current);
          queueTimerRef.current = null;
        }
        setState(prev => {
          if (prev.status === 'queuing') {
            return { ...prev, status: 'error', error: 'Connection lost' };
          }
          return prev;
        });
      };
    });
  }, []);

  const handleMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'queue_joined':
        queueStartRef.current = Date.now();
        queueTimerRef.current = setInterval(() => {
          setState(prev => ({
            ...prev,
            queueTime: Math.floor((Date.now() - queueStartRef.current) / 1000),
          }));
        }, 1000);
        setState(prev => ({ ...prev, status: 'queuing', queueTime: 0 }));
        break;

      case 'queue_left':
        if (queueTimerRef.current) {
          clearInterval(queueTimerRef.current);
          queueTimerRef.current = null;
        }
        setState(prev => ({ ...prev, status: 'idle', queueTime: 0 }));
        break;

      case 'match_found':
        if (queueTimerRef.current) {
          clearInterval(queueTimerRef.current);
          queueTimerRef.current = null;
        }
        setState(prev => ({
          ...prev,
          status: 'match_found',
          match: data.payload,
          queueTime: 0,
        }));
        break;

      case 'match_start':
        setState(prev => ({ ...prev, status: 'in_match' }));
        break;

      case 'opponent_update':
        console.log('[matchmaking] opponent_update received:', data.payload);
        console.log('[matchmaking] onOpponentUpdate callback exists:', !!optionsRef.current.onOpponentUpdate);
        if (optionsRef.current.onOpponentUpdate) {
          optionsRef.current.onOpponentUpdate(data.payload);
        }
        break;

      case 'match_end':
        setState(prev => ({ ...prev, status: 'idle', match: null }));
        optionsRef.current.onMatchEnd?.(data.payload);
        break;

      case 'match_rejoined':
        setState(prev => ({
          ...prev,
          status: 'in_match',
          match: {
            matchId: data.payload.matchId,
            targetLines: data.payload.targetLines,
            startDelay: 0,
            gameSeed: data.payload.gameSeed || '',  // Seed for synchronized pieces
            opponent: data.payload.opponent,
            isPlayerA: data.payload.isPlayerA,
          },
        }));
        // Immediately apply opponent state from gameState if available
        if (data.payload.gameState && optionsRef.current.onOpponentUpdate) {
          const gs = data.payload.gameState;
          const isPlayerA = data.payload.isPlayerA;
          optionsRef.current.onOpponentUpdate({
            lines: isPlayerA ? gs.playerBLines : gs.playerALines,
            score: isPlayerA ? gs.playerBScore : gs.playerAScore,
            board: isPlayerA ? gs.playerBBoard : gs.playerABoard,
          });
        }
        break;

      case 'error':
        console.log('[matchmaking] Error received:', data.payload);
        setState(prev => ({ ...prev, status: 'error', error: data.payload?.message || 'Unknown error' }));
        break;
    }
  }, []); // optionsRef is used instead of options to avoid stale closure issues

  const joinQueue = useCallback(async () => {
    try {
      await connect();
      
      const response = await fetch('/api/auth/user', { credentials: 'include' });
      if (!response.ok) {
        setState(prev => ({ ...prev, status: 'error', error: 'Not authenticated' }));
        return;
      }
      const user = await response.json();
      
      const progressionResponse = await fetch('/api/ranked/progression', { credentials: 'include' });
      const progression = progressionResponse.ok ? await progressionResponse.json() : null;
      
      sendMessage({ 
        type: 'join_queue',
        payload: {
          userId: user.id,
          userName: user.firstName || user.nickname || 'Player',
          userProfileImage: user.profileImageUrl,
          rankPoints: progression?.rankPoints || 0,
          isPlacement: progression ? progression.placementMatchesPlayed < 10 : true,
        }
      });
    } catch (err) {
      setState(prev => ({ ...prev, status: 'error', error: 'Failed to connect' }));
    }
  }, [connect, sendMessage]);

  const leaveQueue = useCallback(() => {
    sendMessage({ type: 'leave_queue' });
    if (queueTimerRef.current) {
      clearInterval(queueTimerRef.current);
      queueTimerRef.current = null;
    }
    setState(prev => ({ ...prev, status: 'idle', queueTime: 0 }));
  }, [sendMessage]);

  const requestAiMatch = useCallback(async () => {
    try {
      await connect();
      
      const response = await fetch('/api/auth/user', { credentials: 'include' });
      if (!response.ok) {
        setState(prev => ({ ...prev, status: 'error', error: 'Not authenticated' }));
        return;
      }
      const user = await response.json();
      
      const progressionResponse = await fetch('/api/ranked/progression', { credentials: 'include' });
      const progression = progressionResponse.ok ? await progressionResponse.json() : null;
      
      sendMessage({ 
        type: 'request_ai_match',
        payload: {
          userId: user.id,
          userName: user.firstName || user.nickname || 'Player',
          userProfileImage: user.profileImageUrl,
          rankPoints: progression?.rankPoints || 0,
          isPlacement: progression ? progression.placementMatchesPlayed < 10 : true,
        }
      });
    } catch (err) {
      setState(prev => ({ ...prev, status: 'error', error: 'Failed to connect' }));
    }
  }, [connect, sendMessage]);

  const rejoinMatch = useCallback(async (matchId: string) => {
    try {
      await connect();
      
      const response = await fetch('/api/auth/user', { credentials: 'include' });
      if (!response.ok) {
        setState(prev => ({ ...prev, status: 'error', error: 'Not authenticated' }));
        return;
      }
      const user = await response.json();
      
      sendMessage({ 
        type: 'rejoin_match',
        payload: {
          matchId,
          userId: user.id,
        }
      });
    } catch (err) {
      setState(prev => ({ ...prev, status: 'error', error: 'Failed to rejoin match' }));
    }
  }, [connect, sendMessage]);

  const sendGameUpdate = useCallback((update: {
    lines: number;
    score: number;
    board: number[][];
    gameOver?: boolean;
  }) => {
    sendMessage({
      type: 'game_update',
      payload: update,
    });
  }, [sendMessage]);

  const forfeit = useCallback(() => {
    sendMessage({ type: 'forfeit' });
  }, [sendMessage]);

  const disconnect = useCallback(() => {
    if (queueTimerRef.current) {
      clearInterval(queueTimerRef.current);
      queueTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState({
      status: 'idle',
      queueTime: 0,
      match: null,
      error: null,
    });
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    joinQueue,
    leaveQueue,
    requestAiMatch,
    rejoinMatch,
    sendGameUpdate,
    forfeit,
    disconnect,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
}
