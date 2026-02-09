import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export interface WebRTCPeerState {
  connectionState: 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';
  dataChannelState: 'connecting' | 'open' | 'closing' | 'closed' | null;
  isP2PActive: boolean;
  latency: number | null;
}

interface UseWebRTCPeerOptions {
  onMessage?: (data: any) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onDataChannelOpen?: () => void;
  onDataChannelClose?: () => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onConnectionFailed?: () => void;
}

const P2P_CONNECTION_TIMEOUT = 15000; // 15 seconds to establish P2P

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export function useWebRTCPeer(options: UseWebRTCPeerOptions = {}) {
  const [state, setState] = useState<WebRTCPeerState>({
    connectionState: 'new',
    dataChannelState: null,
    isP2PActive: false,
    latency: null,
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const optionsRef = useRef(options);
  const pendingIceCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const latencyCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPingTimeRef = useRef<number>(0);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const updateState = useCallback((updates: Partial<WebRTCPeerState>) => {
    if (!mountedRef.current) return;
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const clearConnectionTimeout = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  }, []);

  const setupDataChannel = useCallback((channel: RTCDataChannel) => {
    dataChannelRef.current = channel;

    channel.onopen = () => {
      console.log('[WebRTC] DataChannel opened');
      clearConnectionTimeout();
      updateState({ dataChannelState: 'open', isP2PActive: true, connectionState: 'connected' });
      optionsRef.current.onDataChannelOpen?.();
      
      latencyCheckIntervalRef.current = setInterval(() => {
        if (!mountedRef.current) {
          if (latencyCheckIntervalRef.current) {
            clearInterval(latencyCheckIntervalRef.current);
            latencyCheckIntervalRef.current = null;
          }
          return;
        }
        if (channel.readyState === 'open') {
          try {
            lastPingTimeRef.current = performance.now();
            channel.send(JSON.stringify({ type: '__ping__', t: lastPingTimeRef.current }));
          } catch (e) {
            console.warn('[WebRTC] Failed to send ping:', e);
          }
        }
      }, 5000);
    };

    channel.onclose = () => {
      console.log('[WebRTC] DataChannel closed');
      updateState({ dataChannelState: 'closed', isP2PActive: false });
      optionsRef.current.onDataChannelClose?.();
      if (latencyCheckIntervalRef.current) {
        clearInterval(latencyCheckIntervalRef.current);
        latencyCheckIntervalRef.current = null;
      }
    };

    channel.onerror = (error) => {
      console.error('[WebRTC] DataChannel error:', error);
    };

    channel.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === '__ping__') {
          if (channel.readyState === 'open') {
            channel.send(JSON.stringify({ type: '__pong__', t: data.t }));
          }
          return;
        }
        
        if (data.type === '__pong__') {
          const latency = Math.round((performance.now() - data.t) / 2);
          updateState({ latency });
          return;
        }
        
        // Use setTimeout to break potential synchronous execution chains (helps Firefox)
        setTimeout(() => {
          if (mountedRef.current) {
            optionsRef.current.onMessage?.(data);
          }
        }, 0);
      } catch (e) {
        console.error('[WebRTC] Failed to parse message:', e);
      }
    };

    updateState({ dataChannelState: channel.readyState as any });
  }, [updateState, clearConnectionTimeout]);

  const handleConnectionFailed = useCallback(() => {
    console.log('[WebRTC] Connection failed - cleaning up');
    clearConnectionTimeout();
    
    // Close resources to allow retry
    if (latencyCheckIntervalRef.current) {
      clearInterval(latencyCheckIntervalRef.current);
      latencyCheckIntervalRef.current = null;
    }
    
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    pendingIceCandidatesRef.current = [];
    
    updateState({ connectionState: 'failed', isP2PActive: false, dataChannelState: null, latency: null });
    optionsRef.current.onConnectionFailed?.();
  }, [updateState, clearConnectionTimeout]);

  const createPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    // ICE trickle - send candidates as they are discovered
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] ICE candidate discovered');
        optionsRef.current.onIceCandidate?.(event.candidate);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        handleConnectionFailed();
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      updateState({ connectionState: pc.connectionState as any });
      optionsRef.current.onConnectionStateChange?.(pc.connectionState);
      
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        handleConnectionFailed();
      }
    };

    pc.ondatachannel = (event) => {
      console.log('[WebRTC] Received data channel');
      setupDataChannel(event.channel);
    };

    // Set connection timeout
    clearConnectionTimeout();
    connectionTimeoutRef.current = setTimeout(() => {
      if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
        console.log('[WebRTC] Connection timeout - P2P failed to establish');
        handleConnectionFailed();
      }
    }, P2P_CONNECTION_TIMEOUT);

    return pc;
  }, [setupDataChannel, updateState, handleConnectionFailed, clearConnectionTimeout]);

  const createOffer = useCallback(async (): Promise<{ offer: RTCSessionDescriptionInit; iceCandidates: RTCIceCandidate[] }> => {
    const pc = createPeerConnection();
    
    const channel = pc.createDataChannel('game', {
      ordered: false,
      maxRetransmits: 0,
    });
    setupDataChannel(channel);

    // Collect initial candidates using addEventListener (doesn't override onicecandidate)
    // This allows trickle ICE to continue working via the handler set in createPeerConnection
    const iceCandidates: RTCIceCandidate[] = [];
    let gatheringComplete = false;
    
    const iceCandidatePromise = new Promise<void>((resolve) => {
      const handleCandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          iceCandidates.push(event.candidate);
        } else {
          // null candidate means gathering complete
          gatheringComplete = true;
          pc.removeEventListener('icecandidate', handleCandidate);
          resolve();
        }
      };
      
      pc.addEventListener('icecandidate', handleCandidate);
      
      // Timeout for initial collection, but trickle continues via onicecandidate
      setTimeout(() => {
        if (!gatheringComplete) {
          pc.removeEventListener('icecandidate', handleCandidate);
          resolve();
        }
      }, 3000);
    });

    updateState({ connectionState: 'connecting' });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await iceCandidatePromise;

    console.log('[WebRTC] Created offer with', iceCandidates.length, 'ICE candidates');
    return { offer, iceCandidates };
  }, [createPeerConnection, setupDataChannel, updateState]);

  const handleOffer = useCallback(async (
    offer: RTCSessionDescriptionInit,
    iceCandidates: RTCIceCandidateInit[]
  ): Promise<{ answer: RTCSessionDescriptionInit; iceCandidates: RTCIceCandidate[] }> => {
    const pc = createPeerConnection();

    updateState({ connectionState: 'connecting' });

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    for (const candidate of iceCandidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[WebRTC] Failed to add ICE candidate:', e);
      }
    }

    // Collect initial candidates using addEventListener (doesn't override onicecandidate)
    // This allows trickle ICE to continue working via the handler set in createPeerConnection
    const localIceCandidates: RTCIceCandidate[] = [];
    let gatheringComplete = false;
    
    const iceCandidatePromise = new Promise<void>((resolve) => {
      const handleCandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          localIceCandidates.push(event.candidate);
        } else {
          // null candidate means gathering complete
          gatheringComplete = true;
          pc.removeEventListener('icecandidate', handleCandidate);
          resolve();
        }
      };
      
      pc.addEventListener('icecandidate', handleCandidate);
      
      // Timeout for initial collection, but trickle continues via onicecandidate
      setTimeout(() => {
        if (!gatheringComplete) {
          pc.removeEventListener('icecandidate', handleCandidate);
          resolve();
        }
      }, 3000);
    });

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await iceCandidatePromise;

    console.log('[WebRTC] Created answer with', localIceCandidates.length, 'ICE candidates');
    return { answer, iceCandidates: localIceCandidates };
  }, [createPeerConnection, updateState]);

  const handleAnswer = useCallback(async (
    answer: RTCSessionDescriptionInit,
    iceCandidates: RTCIceCandidateInit[]
  ) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('[WebRTC] No peer connection for answer');
      return;
    }

    await pc.setRemoteDescription(new RTCSessionDescription(answer));

    for (const candidate of iceCandidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[WebRTC] Failed to add ICE candidate:', e);
      }
    }

    for (const candidate of pendingIceCandidatesRef.current) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (e) {
        console.warn('[WebRTC] Failed to add pending ICE candidate:', e);
      }
    }
    pendingIceCandidatesRef.current = [];

    console.log('[WebRTC] Answer processed, added', iceCandidates.length, 'ICE candidates');
  }, []);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      pendingIceCandidatesRef.current.push(new RTCIceCandidate(candidate));
      return;
    }

    if (pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[WebRTC] Failed to add ICE candidate:', e);
      }
    } else {
      pendingIceCandidatesRef.current.push(new RTCIceCandidate(candidate));
    }
  }, []);

  const send = useCallback((data: any): boolean => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== 'open') {
      return false;
    }

    try {
      channel.send(JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('[WebRTC] Failed to send:', e);
      return false;
    }
  }, []);

  const close = useCallback(() => {
    clearConnectionTimeout();
    
    if (latencyCheckIntervalRef.current) {
      clearInterval(latencyCheckIntervalRef.current);
      latencyCheckIntervalRef.current = null;
    }

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    pendingIceCandidatesRef.current = [];
    
    updateState({
      connectionState: 'closed',
      dataChannelState: null,
      isP2PActive: false,
      latency: null,
    });
  }, [updateState, clearConnectionTimeout]);

  useEffect(() => {
    return () => {
      close();
    };
  }, [close]);

  // Memoize the return object to prevent new reference on every render
  return useMemo(() => ({
    ...state,
    createOffer,
    handleOffer,
    handleAnswer,
    addIceCandidate,
    send,
    close,
  }), [state, createOffer, handleOffer, handleAnswer, addIceCandidate, send, close]);
}
