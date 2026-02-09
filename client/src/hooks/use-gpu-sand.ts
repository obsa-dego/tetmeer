import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import {
  GPUSandSystem,
  createGPUSandSystem,
  stepGPUSandSystem,
  addTetrominoAsGPUSand,
  clearGPUSandSystem,
  disposeGPUSandSystem,
} from '../lib/gpu-sand-system';

interface Tetromino {
  shape: number[][];
  position: { x: number; y: number };
  color: string;
}

interface UseGPUSandReturn {
  sandPoints: THREE.Points | null;
  addPieceToSand: (piece: Tetromino) => void;
  clearAllSand: () => void;
  isSettled: boolean;
  particleCount: number;
  update: (deltaTime: number) => void;
  setRenderer: (renderer: THREE.WebGLRenderer) => void;
}

export function useGPUSand(enabled: boolean = true): UseGPUSandReturn {
  const sandSystemRef = useRef<GPUSandSystem | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [sandPoints, setSandPoints] = useState<THREE.Points | null>(null);
  const [particleCount, setParticleCount] = useState(0);
  const [isSettled, setIsSettled] = useState(true);
  
  const lastUpdateRef = useRef(0);
  const isSettledRef = useRef(true);
  const particleCountRef = useRef(0);

  const setRenderer = useCallback((renderer: THREE.WebGLRenderer) => {
    if (rendererRef.current === renderer) return;
    rendererRef.current = renderer;
    
    if (enabled && renderer && !sandSystemRef.current) {
      const system = createGPUSandSystem(renderer);
      if (system) {
        sandSystemRef.current = system;
        setSandPoints(system.points);
      }
    }
  }, [enabled]);

  useEffect(() => {
    return () => {
      if (sandSystemRef.current) {
        disposeGPUSandSystem(sandSystemRef.current);
        sandSystemRef.current = null;
      }
    };
  }, []);

  const update = useCallback((deltaTime: number) => {
    if (!sandSystemRef.current || !enabled) return;
    
    stepGPUSandSystem(sandSystemRef.current, deltaTime);
    
    const now = performance.now();
    if (now - lastUpdateRef.current > 100) {
      lastUpdateRef.current = now;
      
      const count = sandSystemRef.current.particleCount;
      if (count !== particleCountRef.current) {
        particleCountRef.current = count;
        setParticleCount(count);
      }
      
      const settled = count === 0;
      if (settled !== isSettledRef.current) {
        isSettledRef.current = settled;
        setIsSettled(settled);
      }
    }
  }, [enabled]);

  const addPieceToSand = useCallback((piece: Tetromino) => {
    if (!sandSystemRef.current) return;

    addTetrominoAsGPUSand(
      sandSystemRef.current,
      piece.shape,
      piece.position.x,
      piece.position.y,
      piece.color,
      true
    );
    
    if (isSettledRef.current) {
      isSettledRef.current = false;
      setIsSettled(false);
    }
  }, []);

  const clearAllSand = useCallback(() => {
    if (!sandSystemRef.current) return;
    clearGPUSandSystem(sandSystemRef.current);
    setParticleCount(0);
    setIsSettled(true);
    isSettledRef.current = true;
    particleCountRef.current = 0;
  }, []);

  return {
    sandPoints,
    addPieceToSand,
    clearAllSand,
    isSettled,
    particleCount,
    update,
    setRenderer,
  };
}
