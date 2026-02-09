import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useWebRTCPeer, WebRTCPeerState } from './use-webrtc-peer';

export type CasualGameMode = 'marathon' | 'sprint' | 'ultra' | 'zen';

export interface CasualMatchmakingState {
  status: 'idle' | 'connecting' | 'queuing' | 'match_found' | 'in_match' | 'error';
  queueTime: number;
  match: CasualMatchData | null;
  error: string | null;
  gameMode: CasualGameMode | null;
  p2pStatus: 'inactive' | 'connecting' | 'connected' | 'failed';
  p2pLatency: number | null;
}

export interface CasualMatchData {
  matchId: string;
  gameMode: CasualGameMode;
  targetLines: number;
  timeLimit: number;
  startDelay: number;
  gameSeed: string;
  opponent: {
    userId: string;
    userName: string;
    userProfileImage: string | null;
  };
  isPlayerA: boolean;
}

export interface CameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

export interface OpponentSettings {
  blockTexture: string;
  gridMaterial: string;
  boardMaterial: string;
  backgroundColor: string;
  gridColor: string;
  equippedDecorations: Record<string, string>;
  placedDecorations: any[];
}

export interface CasualOpponentUpdate {
  lines: number;
  score: number;
  board: number[][];
  time?: number;
  camera?: CameraState;
  settings?: OpponentSettings;
  currentPiece?: {
    type: string;
    x: number;
    y: number;
    rotation: number;
    shape: boolean[][];
  } | null;
}

// Optimized update types for split messages
export interface OpponentPieceUpdate {
  type: string;
  x: number;
  y: number;
  rotation: number;
  shape?: number[][];  // Optional - only sent on type/rotation change
}

export interface OpponentBoardUpdate {
  lines: number;
  score: number;
  board: number[][];
}

export interface OpponentMetaUpdate {
  camera?: CameraState;
  settings?: OpponentSettings;
  time?: number;
}

// Input action types for low-latency input-based sync
export type InputActionType = 
  | 'moveLeft' 
  | 'moveRight' 
  | 'moveDown' 
  | 'rotate' 
  | 'rotateLeft' 
  | 'rotateRight' 
  | 'hardDrop' 
  | 'holdPiece';

export interface InputAction {
  action: InputActionType;
  timestamp: number;
}

interface UseCasualMatchmakingOptions {
  onOpponentInputAction?: (action: InputAction) => void;
  onOpponentUpdate?: (update: CasualOpponentUpdate) => void;
  onOpponentPieceUpdate?: (update: OpponentPieceUpdate) => void;
  onOpponentBoardUpdate?: (update: OpponentBoardUpdate) => void;
  onOpponentMetaUpdate?: (update: OpponentMetaUpdate) => void;
  onMatchEnd?: (result: CasualMatchEndResult) => void;
  onTimerUpdate?: (timeRemaining: number) => void;
}

export interface CasualMatchEndResult {
  won: boolean;
  isDraw: boolean;
  reason: string;
  xpEarned: number;
  yourStats: {
    lines: number;
    score: number;
  };
  opponentStats: {
    lines: number;
    score: number;
  };
}

export const MODE_DISPLAY_INFO: Record<CasualGameMode, { name: string; description: string }> = {
  marathon: {
    name: 'Marathon',
    description: 'First to 150 lines wins',
  },
  sprint: {
    name: 'Sprint',
    description: 'First to 40 lines wins',
  },
  ultra: {
    name: 'Ultra',
    description: '2 minutes - highest score wins',
  },
  zen: {
    name: 'Zen',
    description: 'No win condition - just play together',
  },
};

export function useCasualMatchmaking(options: UseCasualMatchmakingOptions = {}) {
  const [state, setState] = useState<CasualMatchmakingState>({
    status: 'idle',
    queueTime: 0,
    match: null,
    error: null,
    gameMode: null,
    p2pStatus: 'inactive',
    p2pLatency: null,
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const queueTimerRef = useRef<NodeJS.Timeout | null>(null);
  const queueStartRef = useRef<number>(0);
  const optionsRef = useRef(options);
  const isInitiatorRef = useRef<boolean>(false);
  const p2pConnectionAttemptedRef = useRef<boolean>(false);
  const webrtcCloseRef = useRef<(() => void) | null>(null);
  const webrtcSendRef = useRef<((data: any) => boolean) | null>(null);
  
  // Send ICE candidates via WebSocket signaling
  const sendIceCandidate = useCallback((candidate: RTCIceCandidate) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'rtc_ice_candidate',
        payload: candidate.toJSON(),
      }));
    }
  }, []);

  // Memoized WebRTC callbacks to prevent infinite re-renders
  const webrtcCallbacks = useMemo(() => ({
    onMessage: (data: any) => {
      // Handle P2P messages
      if (data.messageType === 'piece') {
        optionsRef.current.onOpponentPieceUpdate?.(data.payload);
      } else if (data.messageType === 'board') {
        optionsRef.current.onOpponentBoardUpdate?.(data.payload);
      } else if (data.messageType === 'meta') {
        optionsRef.current.onOpponentMetaUpdate?.(data.payload);
      } else if (data.messageType === 'full') {
        optionsRef.current.onOpponentUpdate?.(data.payload);
      } else if (data.messageType === 'input') {
        // Input-based sync for low-latency opponent updates
        optionsRef.current.onOpponentInputAction?.(data.payload);
      }
    },
    onDataChannelOpen: () => {
      console.log('[P2P] DataChannel connected - switching to P2P mode');
      setState(prev => ({ ...prev, p2pStatus: 'connected' }));
    },
    onDataChannelClose: () => {
      console.log('[P2P] DataChannel closed - falling back to WebSocket');
      setState(prev => ({ ...prev, p2pStatus: 'failed', p2pLatency: null }));
    },
    onIceCandidate: (candidate: RTCIceCandidate) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'rtc_ice_candidate',
          payload: candidate.toJSON(),
        }));
      }
    },
    onConnectionFailed: () => {
      console.log('[P2P] Connection failed - using WebSocket fallback');
      setState(prev => ({ ...prev, p2pStatus: 'failed', p2pLatency: null }));
    },
  }), []);

  // WebRTC P2P is temporarily disabled due to browser compatibility issues
  // TODO: Fix WebRTC for Firefox/Edge and re-enable
  const isWebRTCDisabled = true;

  // WebRTC peer connection for P2P game data (disabled for Firefox/Edge)
  const webrtc = useWebRTCPeer(isWebRTCDisabled ? {} : webrtcCallbacks);
  
  // Keep webrtc functions in refs to avoid dependency issues
  useEffect(() => {
    webrtcCloseRef.current = webrtc.close;
    webrtcSendRef.current = webrtc.send;
  }, [webrtc.close, webrtc.send]);
  
  // Track P2P latency
  useEffect(() => {
    if (webrtc.latency !== null) {
      setState(prev => ({ ...prev, p2pLatency: webrtc.latency }));
    }
  }, [webrtc.latency]);
  
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const connect = useCallback((retryCount = 0): Promise<void> => {
    const maxRetries = 3;
    const retryDelay = 1000;
    
    return new Promise((resolve, reject) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      
      // Close any existing connection that might be in a bad state
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {
          // Ignore close errors
        }
        wsRef.current = null;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/casual`;
      console.log(`[casual] Connecting to WebSocket: ${wsUrl} (attempt ${retryCount + 1}/${maxRetries + 1})`);
      
      setState(prev => ({ ...prev, status: 'connecting', error: null }));
      
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (e) {
        console.error('[casual] Failed to create WebSocket:', e);
        if (retryCount < maxRetries) {
          console.log(`[casual] Retrying in ${retryDelay}ms...`);
          setTimeout(() => {
            connect(retryCount + 1).then(resolve).catch(reject);
          }, retryDelay);
          return;
        }
        setState(prev => ({ ...prev, status: 'error', error: 'Failed to connect' }));
        reject(new Error('Failed to connect'));
        return;
      }
      
      wsRef.current = ws;
      
      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.error('[casual] Connection timeout');
          ws.close();
          if (retryCount < maxRetries) {
            console.log(`[casual] Retrying in ${retryDelay}ms...`);
            setTimeout(() => {
              connect(retryCount + 1).then(resolve).catch(reject);
            }, retryDelay);
          } else {
            setState(prev => ({ ...prev, status: 'error', error: 'Connection timeout' }));
            reject(new Error('Connection timeout'));
          }
        }
      }, 10000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('[casual] WebSocket connected successfully');
        setState(prev => ({ ...prev, status: 'idle', error: null }));
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch (e) {
          console.error('[casual] Failed to parse message:', e);
        }
      };

      ws.onerror = (event) => {
        clearTimeout(connectionTimeout);
        console.error('[casual] WebSocket error:', event);
        if (retryCount < maxRetries) {
          console.log(`[casual] Retrying in ${retryDelay}ms...`);
          wsRef.current = null;
          setTimeout(() => {
            connect(retryCount + 1).then(resolve).catch(reject);
          }, retryDelay);
        } else {
          setState(prev => ({ ...prev, status: 'error', error: 'Failed to connect' }));
          reject(new Error('Failed to connect'));
        }
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log('[casual] WebSocket closed:', event.code, event.reason);
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
        setState(prev => ({ 
          ...prev, 
          status: 'queuing', 
          queueTime: 0,
          gameMode: data.payload?.gameMode || prev.gameMode,
        }));
        break;

      case 'queue_left':
        if (queueTimerRef.current) {
          clearInterval(queueTimerRef.current);
          queueTimerRef.current = null;
        }
        setState(prev => ({ ...prev, status: 'idle', queueTime: 0, gameMode: null }));
        break;

      case 'match_found':
        if (queueTimerRef.current) {
          clearInterval(queueTimerRef.current);
          queueTimerRef.current = null;
        }
        setState(prev => ({
          ...prev,
          status: 'in_match',
          match: data.payload,
          gameMode: data.payload.gameMode,
          queueTime: 0,
          p2pStatus: 'inactive',
        }));
        // Signal ready for WebRTC P2P connection (skip if disabled)
        if (!isWebRTCDisabled) {
          p2pConnectionAttemptedRef.current = false;
          setTimeout(() => {
            sendMessage({ type: 'rtc_ready' });
            console.log('[P2P] Sent rtc_ready signal');
          }, 500);
        }
        break;

      case 'match_start':
        setState(prev => ({ ...prev, status: 'in_match' }));
        break;

      case 'opponent_update':
        if (optionsRef.current.onOpponentUpdate) {
          optionsRef.current.onOpponentUpdate(data.payload);
        }
        break;

      // Optimized split updates for lower latency
      case 'opponent_piece':
        if (optionsRef.current.onOpponentPieceUpdate) {
          optionsRef.current.onOpponentPieceUpdate(data.payload);
        }
        break;

      case 'opponent_board':
        if (optionsRef.current.onOpponentBoardUpdate) {
          optionsRef.current.onOpponentBoardUpdate(data.payload);
        }
        break;

      case 'opponent_meta':
        if (optionsRef.current.onOpponentMetaUpdate) {
          optionsRef.current.onOpponentMetaUpdate(data.payload);
        }
        break;

      // Input-based sync for low-latency opponent updates
      case 'opponent_input':
        if (optionsRef.current.onOpponentInputAction) {
          optionsRef.current.onOpponentInputAction(data.payload);
        }
        break;

      case 'timer_update':
        if (optionsRef.current.onTimerUpdate) {
          optionsRef.current.onTimerUpdate(data.payload.timeRemaining);
        }
        break;

      case 'match_end':
        webrtc.close();
        setState(prev => ({ ...prev, status: 'idle', match: null, gameMode: null, p2pStatus: 'inactive', p2pLatency: null }));
        optionsRef.current.onMatchEnd?.(data.payload);
        break;

      case 'match_rejoined':
        // Reset P2P state on rejoin
        webrtc.close();
        p2pConnectionAttemptedRef.current = false;
        isInitiatorRef.current = data.payload.isPlayerA;
        
        setState(prev => ({
          ...prev,
          status: 'in_match',
          gameMode: data.payload.gameMode,
          p2pStatus: 'connecting',
          p2pLatency: null,
          match: {
            matchId: data.payload.matchId,
            gameMode: data.payload.gameMode,
            targetLines: data.payload.targetLines,
            timeLimit: data.payload.timeLimit,
            startDelay: 0,
            gameSeed: data.payload.gameSeed || '',
            opponent: data.payload.opponent,
            isPlayerA: data.payload.isPlayerA,
          },
        }));
        
        // Re-initiate P2P after rejoin (skip if disabled)
        if (!isWebRTCDisabled && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'rtc_ready' }));
        }
        if (data.payload.gameState && optionsRef.current.onOpponentUpdate) {
          const gs = data.payload.gameState;
          const isPlayerA = data.payload.isPlayerA;
          optionsRef.current.onOpponentUpdate({
            lines: isPlayerA ? gs.playerBLines : gs.playerALines,
            score: isPlayerA ? gs.playerBScore : gs.playerAScore,
            board: isPlayerA ? gs.playerBBoard : gs.playerABoard,
            time: isPlayerA ? gs.playerBTime : gs.playerATime,
          });
        }
        break;

      case 'error':
        console.log('[casual] Error received:', data.payload);
        setState(prev => ({ ...prev, status: 'error', error: data.payload?.message || 'Unknown error' }));
        break;

      // WebRTC signaling messages (skip if WebRTC is disabled)
      case 'rtc_initiate':
        if (!isWebRTCDisabled) {
          handleRTCInitiate(data.payload.isInitiator);
        }
        break;

      case 'rtc_offer':
        if (!isWebRTCDisabled) {
          handleRTCOffer(data.payload);
        }
        break;

      case 'rtc_answer':
        if (!isWebRTCDisabled) {
          handleRTCAnswer(data.payload);
        }
        break;

      case 'rtc_ice_candidate':
        if (!isWebRTCDisabled) {
          webrtc.addIceCandidate(data.payload);
        }
        break;
    }
  }, [webrtc]);

  // WebRTC P2P connection handlers
  const handleRTCInitiate = useCallback(async (isInitiator: boolean) => {
    console.log('[P2P] Initiating WebRTC connection, isInitiator:', isInitiator);
    isInitiatorRef.current = isInitiator;
    p2pConnectionAttemptedRef.current = true;
    setState(prev => ({ ...prev, p2pStatus: 'connecting' }));

    if (isInitiator) {
      try {
        const { offer, iceCandidates } = await webrtc.createOffer();
        sendMessage({
          type: 'rtc_offer',
          payload: { offer, iceCandidates },
        });
        console.log('[P2P] Sent offer to peer');
      } catch (err) {
        console.error('[P2P] Failed to create offer:', err);
        setState(prev => ({ ...prev, p2pStatus: 'failed' }));
      }
    }
  }, [webrtc, sendMessage]);

  const handleRTCOffer = useCallback(async (payload: { offer: RTCSessionDescriptionInit; iceCandidates: RTCIceCandidateInit[] }) => {
    console.log('[P2P] Received offer from peer');
    try {
      const { answer, iceCandidates } = await webrtc.handleOffer(payload.offer, payload.iceCandidates);
      sendMessage({
        type: 'rtc_answer',
        payload: { answer, iceCandidates },
      });
      console.log('[P2P] Sent answer to peer');
    } catch (err) {
      console.error('[P2P] Failed to handle offer:', err);
      setState(prev => ({ ...prev, p2pStatus: 'failed' }));
    }
  }, [webrtc, sendMessage]);

  const handleRTCAnswer = useCallback(async (payload: { answer: RTCSessionDescriptionInit; iceCandidates: RTCIceCandidateInit[] }) => {
    console.log('[P2P] Received answer from peer');
    try {
      await webrtc.handleAnswer(payload.answer, payload.iceCandidates);
      console.log('[P2P] Connection established');
    } catch (err) {
      console.error('[P2P] Failed to handle answer:', err);
      setState(prev => ({ ...prev, p2pStatus: 'failed' }));
    }
  }, [webrtc]);

  const joinQueue = useCallback(async (gameMode: CasualGameMode) => {
    try {
      await connect();
      
      const response = await fetch('/api/auth/user', { credentials: 'include' });
      let userId: string;
      let userName: string;
      let userProfileImage: string | undefined;
      
      if (response.ok) {
        const user = await response.json();
        userId = user.id;
        userName = user.firstName || user.nickname || 'Player';
        userProfileImage = user.profileImageUrl;
      } else {
        // Use stored guest ID or create new one
        let storedGuestId = sessionStorage.getItem('casualGuestId');
        if (!storedGuestId) {
          storedGuestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          sessionStorage.setItem('casualGuestId', storedGuestId);
        }
        userId = storedGuestId;
        userName = 'Guest';
        userProfileImage = undefined;
      }
      
      setState(prev => ({ ...prev, gameMode }));
      
      sendMessage({ 
        type: 'join_queue',
        payload: {
          userId,
          userName,
          userProfileImage,
          gameMode,
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
    setState(prev => ({ ...prev, status: 'idle', queueTime: 0, gameMode: null }));
  }, [sendMessage]);

  const rejoinMatch = useCallback(async (matchId: string, guestUserId?: string) => {
    try {
      await connect();
      
      const response = await fetch('/api/auth/user', { credentials: 'include' });
      let userId: string;
      
      if (response.ok) {
        const user = await response.json();
        userId = user.id;
      } else {
        // Use stored guest ID or provided one
        const storedGuestId = sessionStorage.getItem('casualGuestId');
        if (guestUserId) {
          userId = guestUserId;
        } else if (storedGuestId) {
          userId = storedGuestId;
        } else {
          setState(prev => ({ ...prev, status: 'error', error: 'Cannot rejoin without user ID' }));
          return;
        }
      }
      
      sendMessage({ 
        type: 'rejoin_match',
        payload: {
          matchId,
          userId,
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
    time?: number;
    camera?: CameraState;
    settings?: OpponentSettings;
    currentPiece?: {
      type: string;
      x: number;
      y: number;
      rotation: number;
      shape: boolean[][];
    } | null;
  }) => {
    // Try P2P first, fall back to WebSocket (using ref to avoid dependency loop)
    const sent = webrtcSendRef.current?.({ messageType: 'full', payload: update }) ?? false;
    if (!sent) {
      sendMessage({
        type: 'game_update',
        payload: update,
      });
    }
  }, [sendMessage]);

  // Optimized split update functions for lower latency - P2P first, WebSocket fallback
  // Use refs for webrtc.send to avoid dependencies that would cause re-renders
  const sendPieceUpdate = useCallback((piece: {
    type: string;
    x: number;
    y: number;
    rotation: number;
    shape?: number[][];  // Optional - only sent on type/rotation change
  }) => {
    // Try P2P first for lowest latency (using ref to avoid dependency loop)
    const sent = webrtcSendRef.current?.({ messageType: 'piece', payload: piece }) ?? false;
    if (!sent) {
      sendMessage({
        type: 'piece_update',
        payload: piece,
      });
    }
  }, [sendMessage]);

  const sendBoardUpdate = useCallback((update: {
    lines: number;
    score: number;
    board: number[][];
    gameOver?: boolean;
  }) => {
    // Try P2P first, fall back to WebSocket (using ref to avoid dependency loop)
    const sent = webrtcSendRef.current?.({ messageType: 'board', payload: update }) ?? false;
    if (!sent) {
      sendMessage({
        type: 'board_update',
        payload: update,
      });
    }
  }, [sendMessage]);

  const sendMetaUpdate = useCallback((meta: {
    camera?: CameraState;
    settings?: OpponentSettings;
    time?: number;
  }) => {
    // Try P2P first, fall back to WebSocket (using ref to avoid dependency loop)
    const sent = webrtcSendRef.current?.({ messageType: 'meta', payload: meta }) ?? false;
    if (!sent) {
      sendMessage({
        type: 'meta_update',
        payload: meta,
      });
    }
  }, [sendMessage]);

  // Input-based sync: send player input actions for low-latency opponent rendering
  const sendInputAction = useCallback((action: InputActionType) => {
    const payload: InputAction = {
      action,
      timestamp: Date.now(),
    };
    // Try P2P first for lowest latency
    const sent = webrtcSendRef.current?.({ messageType: 'input', payload }) ?? false;
    if (!sent) {
      sendMessage({
        type: 'input_action',
        payload,
      });
    }
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
    // Close WebRTC connection using ref to avoid dependency loop
    webrtcCloseRef.current?.();
    p2pConnectionAttemptedRef.current = false;
    
    setState({
      status: 'idle',
      queueTime: 0,
      match: null,
      error: null,
      gameMode: null,
      p2pStatus: 'inactive',
      p2pLatency: null,
    });
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Send debug log to server for diagnostics when browser might freeze
  const sendDebugLog = useCallback((source: string, message: string, data?: any) => {
    sendMessage({
      type: 'client_debug',
      payload: { source, message, data },
    });
  }, [sendMessage]);

  return {
    ...state,
    joinQueue,
    leaveQueue,
    rejoinMatch,
    sendGameUpdate,
    sendPieceUpdate,
    sendBoardUpdate,
    sendMetaUpdate,
    sendInputAction,
    sendDebugLog,
    forfeit,
    disconnect,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    isP2PConnected: state.p2pStatus === 'connected',
  };
}
