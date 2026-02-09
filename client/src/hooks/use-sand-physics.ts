import { useRef, useEffect, useState, useCallback } from 'react';
import {
  SandPhysicsWorld,
  createSandPhysicsWorld,
  addTetrominoAsSandBlocks,
  stepPhysicsWorld,
  getBlockPositions,
  areAllBlocksSettled,
  clearPhysicsWorld,
  checkCompletedLines,
  removeBlocksInLines,
} from '@/lib/sand-physics-world';
import { PhysicsBlockPosition } from '@/components/game/GameRenderer3D';
import { Tetromino, BOARD_HEIGHT } from '@/lib/game-engine';

interface UseSandPhysicsReturn {
  blockPositions: PhysicsBlockPosition[];
  addPieceToPhysics: (piece: Tetromino) => void;
  clearAllBlocks: () => void;
  isSettled: boolean;
  checkAndClearLines: () => number;
}

export function useSandPhysics(enabled: boolean): UseSandPhysicsReturn {
  const physicsWorldRef = useRef<SandPhysicsWorld | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [blockPositions, setBlockPositions] = useState<PhysicsBlockPosition[]>([]);
  const [isSettled, setIsSettled] = useState(true);

  useEffect(() => {
    if (!enabled) {
      if (physicsWorldRef.current) {
        clearPhysicsWorld(physicsWorldRef.current);
        physicsWorldRef.current = null;
      }
      setBlockPositions([]);
      return;
    }

    physicsWorldRef.current = createSandPhysicsWorld();

    let lastTime = performance.now();
    
    const step = () => {
      if (!physicsWorldRef.current) return;
      
      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      stepPhysicsWorld(physicsWorldRef.current, deltaTime);

      const positions = getBlockPositions(physicsWorldRef.current);
      setBlockPositions(positions.map(p => ({
        id: p.id,
        x: p.x,
        y: p.y,
        z: p.z,
        rotationX: p.rotation.x,
        rotationY: p.rotation.y,
        rotationZ: p.rotation.z,
        rotationW: p.rotation.w,
        color: p.color,
        size: p.size,
      })));

      setIsSettled(areAllBlocksSettled(physicsWorldRef.current));

      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (physicsWorldRef.current) {
        clearPhysicsWorld(physicsWorldRef.current);
      }
    };
  }, [enabled]);

  const addPieceToPhysics = useCallback((piece: Tetromino) => {
    if (!physicsWorldRef.current) return;

    addTetrominoAsSandBlocks(
      physicsWorldRef.current,
      piece.shape,
      piece.position.x,
      piece.position.y,
      piece.color
    );
    
    setIsSettled(false);
  }, []);

  const clearAllBlocks = useCallback(() => {
    if (!physicsWorldRef.current) return;
    clearPhysicsWorld(physicsWorldRef.current);
    setBlockPositions([]);
    setIsSettled(true);
  }, []);

  const checkAndClearLines = useCallback((): number => {
    if (!physicsWorldRef.current) return 0;

    const completedLines = checkCompletedLines(physicsWorldRef.current);
    if (completedLines.length > 0) {
      removeBlocksInLines(physicsWorldRef.current, completedLines);
      setIsSettled(false);
    }
    return completedLines.length;
  }, []);

  return {
    blockPositions,
    addPieceToPhysics,
    clearAllBlocks,
    isSettled,
    checkAndClearLines,
  };
}
