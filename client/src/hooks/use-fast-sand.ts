import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  FastSandSystem,
  createFastSandSystem,
  addTetrominoAsSand,
  stepFastSandSystem,
  clearFastSandSystem,
  checkAndClearSandLines,
  disposeFastSandSystem,
  areAllParticlesSettled,
} from '@/lib/fast-sand-system';
import { Tetromino } from '@/lib/game-engine';

interface UseFastSandReturn {
  sandSystem: FastSandSystem | null;
  addPieceToSand: (piece: Tetromino) => void;
  clearAllSand: () => void;
  isSettled: boolean;
  checkAndClearLines: () => number;
  particleCount: number;
}

export function useFastSand(enabled: boolean): UseFastSandReturn {
  const sandSystemRef = useRef<FastSandSystem | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isSettledRef = useRef(true);
  const particleCountRef = useRef(0);
  const [isSettled, setIsSettled] = useState(true);
  const [particleCount, setParticleCount] = useState(0);
  const lastStateUpdateRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      if (sandSystemRef.current) {
        disposeFastSandSystem(sandSystemRef.current);
        sandSystemRef.current = null;
      }
      setIsSettled(true);
      setParticleCount(0);
      return;
    }

    sandSystemRef.current = createFastSandSystem();

    let lastTime = performance.now();
    
    const step = () => {
      if (!sandSystemRef.current) return;
      
      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      stepFastSandSystem(sandSystemRef.current, deltaTime);
      
      const settled = areAllParticlesSettled(sandSystemRef.current);
      const count = sandSystemRef.current.particleCount;
      
      if (currentTime - lastStateUpdateRef.current > 100 || 
          settled !== isSettledRef.current) {
        if (settled !== isSettledRef.current) {
          isSettledRef.current = settled;
          setIsSettled(settled);
        }
        if (count !== particleCountRef.current) {
          particleCountRef.current = count;
          setParticleCount(count);
        }
        lastStateUpdateRef.current = currentTime;
      }

      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (sandSystemRef.current) {
        disposeFastSandSystem(sandSystemRef.current);
        sandSystemRef.current = null;
      }
    };
  }, [enabled]);

  const addPieceToSand = useCallback((piece: Tetromino) => {
    if (!sandSystemRef.current) return;

    addTetrominoAsSand(
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
    clearFastSandSystem(sandSystemRef.current);
    setParticleCount(0);
  }, []);

  const checkAndClearLines = useCallback(() => {
    if (!sandSystemRef.current) return 0;
    return checkAndClearSandLines(sandSystemRef.current);
  }, []);

  return {
    sandSystem: sandSystemRef.current,
    addPieceToSand,
    clearAllSand,
    isSettled,
    checkAndClearLines,
    particleCount,
  };
}
