import { useState, useCallback, useEffect, useRef } from 'react';
import seedrandom from 'seedrandom';
import {
  GameState,
  GameMode,
  GameDifficulty,
  GameEngine,
  GAME_MODE_CONFIGS,
  DIFFICULTY_CONFIGS,
  createInitialGameState,
  createSeededGameState,
  createTetromino,
  getRandomTetrominoType,
  generateBag,
  generateBagSeeded,
  isValidPosition,
  placeTetromino,
  findCompletedLines,
  findSameColorLines,
  clearLines,
  clearSandLines,
  calculateScore,
  isBoardEmpty,
  getDropSpeed,
  getMasterModeSpeed,
  getZoneDropSpeed,
  rotateTetromino,
  getWallKicks,
  removeBottomRow as removeBottomRowEngine,
  Tetromino,
  RotationState,
  ScoreActionType,
  addGarbageLines,
  addGarbageLinesFromTop,
  createVisibilityBoard,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  PhysicsFallingBlock,
  AnimationPhase,
  ClearedLine,
  FALL_SPEED,
  applyGravity,
  applySandPhysics,
  applySandPhysicsSteps,
  placeSandParticles,
} from '@/lib/game-engine';

interface UseGameOptions {
  disableKeyHandlers?: boolean;
  disableAutoFall?: boolean;  // For opponent game - only manual input moves pieces
}

// Global counter to track instances
let useBlockGameInstanceCounter = 0;

export function useBlockGame(engine: GameEngine = 'gravity', options: UseGameOptions = {}) {
  const { disableKeyHandlers = false, disableAutoFall = false } = options;
  
  // Instance ID for debugging
  const instanceIdRef = useRef<string | null>(null);
  if (!instanceIdRef.current) {
    useBlockGameInstanceCounter++;
    instanceIdRef.current = `game-${useBlockGameInstanceCounter}-${Math.random().toString(36).substring(7)}`;
    console.log(`[useBlockGame:${instanceIdRef.current}] CREATED - engine=${engine}, disableKeyHandlers=${disableKeyHandlers}, disableAutoFall=${disableAutoFall}`);
  }
  const instanceId = instanceIdRef.current;
  
  const [gameState, setGameState] = useState<GameState>(createInitialGameState());
  const [startTime, setStartTime] = useState<number | null>(null);
  const playTimeRef = useRef(0);  // Use ref to avoid re-renders on time updates
  const playTimeAccumulatedRef = useRef(0);  // Accumulated time before current session
  const playTimeSessionStartRef = useRef<number | null>(null);  // Current session start
  const playTimeWasRunningRef = useRef(false);  // Track if timer was running
  const [gameId, setGameId] = useState(0);
  const [currentMode, setCurrentMode] = useState<GameMode>('marathon');
  const [currentDifficulty, setCurrentDifficulty] = useState<GameDifficulty | undefined>(undefined);
  const dropIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const garbageIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const visibilityTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const zoneTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sandPhysicsRef = useRef<NodeJS.Timeout | null>(null);
  const fallingAnimationRef = useRef<{ active: boolean; frameId: number | null }>({ active: false, frameId: null });
  // Seeded RNG for synchronized multiplayer piece generation
  const seededRngRef = useRef<(() => number) | null>(null);

  const clearIntervals = useCallback(() => {
    if (dropIntervalRef.current) {
      clearInterval(dropIntervalRef.current);
      dropIntervalRef.current = null;
    }
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (garbageIntervalRef.current) {
      clearInterval(garbageIntervalRef.current);
      garbageIntervalRef.current = null;
    }
    if (sandPhysicsRef.current) {
      clearInterval(sandPhysicsRef.current);
      sandPhysicsRef.current = null;
    }
    if (zoneTimerRef.current) {
      clearInterval(zoneTimerRef.current);
      zoneTimerRef.current = null;
    }
    visibilityTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    visibilityTimeoutsRef.current.clear();
  }, []);

  const spawnNewPiece = useCallback((state: GameState): GameState => {
    const newPiece = state.pieceQueue[0] || state.nextPiece || createTetromino(getRandomTetrominoType());
    
    // 7-bag randomizer: get next piece from bag, refill if empty
    // Use seeded RNG if available (for synchronized multiplayer)
    let currentBag = state.pieceBag || [];
    if (currentBag.length === 0) {
      currentBag = seededRngRef.current ? generateBagSeeded(seededRngRef.current) : generateBag();
    }
    const nextType = currentBag[0];
    const remainingBag = currentBag.slice(1);
    
    const newQueue = [...state.pieceQueue.slice(1), createTetromino(nextType)];

    if (!isValidPosition(state.board, newPiece)) {
      return { ...state, isGameOver: true, currentPiece: null };
    }

    return {
      ...state,
      currentPiece: newPiece,
      nextPiece: newQueue[0],
      pieceQueue: newQueue,
      pieceBag: remainingBag,
      canHold: true,
      piecesPlaced: state.piecesPlaced + 1,  // Increment pieces placed counter
    };
  }, []);

  const checkModeVictory = useCallback((state: GameState): { isVictory: boolean; isGameOver: boolean } => {
    const config = GAME_MODE_CONFIGS[state.gameMode];
    
    switch (state.gameMode) {
      case 'marathon':
        if (state.linesCleared >= (config.targetLines || 150) || state.level >= (config.maxLevel || 15)) {
          return { isVictory: true, isGameOver: true };
        }
        break;
      case 'sprint':
        if (state.linesCleared >= (config.targetLines || 40)) {
          return { isVictory: true, isGameOver: true };
        }
        break;
      case 'ultra':
        break;
      case 'zen':
        break;
      case 'dig':
        break;
      case 'survival':
        break;
      case 'invisible':
        break;
      case 'zone':
        break;
      case 'master':
        if (state.level >= (config.maxLevel || 1000)) {
          return { isVictory: true, isGameOver: true };
        }
        break;
    }
    return { isVictory: false, isGameOver: false };
  }, []);

  const activateZone = useCallback(() => {
    setGameState(state => {
      if (state.gameMode !== 'zone' || state.isZoneActive || state.zoneEnergy < state.zoneMaxEnergy) {
        return state;
      }
      return {
        ...state,
        isZoneActive: true,
        zoneTimeRemaining: 10,
        zoneEnergy: 0,
        zoneActivations: state.zoneActivations + 1,
      };
    });
  }, []);

  const updateVisibilityForPlacedPiece = useCallback((state: GameState, tetromino: Tetromino): number[][] => {
    if (state.gameMode !== 'invisible') return state.visibilityBoard;
    
    const newVisibility = state.visibilityBoard.map(row => [...row]);
    const difficulty = state.difficulty || 'slow';
    const config = DIFFICULTY_CONFIGS[difficulty];
    const delay = config.visibilityDelay;
    
    const { shape, position } = tetromino;
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const boardY = position.y + y;
          const boardX = position.x + x;
          if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
            const key = `${boardX}-${boardY}`;
            if (delay === 0) {
              newVisibility[boardY][boardX] = 0;
            } else {
              const existingTimeout = visibilityTimeoutsRef.current.get(key);
              if (existingTimeout) clearTimeout(existingTimeout);
              
              const timeout = setTimeout(() => {
                setGameState(prev => {
                  const updatedVisibility = prev.visibilityBoard.map(row => [...row]);
                  updatedVisibility[boardY][boardX] = 0;
                  return { ...prev, visibilityBoard: updatedVisibility };
                });
                visibilityTimeoutsRef.current.delete(key);
              }, delay);
              visibilityTimeoutsRef.current.set(key, timeout);
            }
          }
        }
      }
    }
    return newVisibility;
  }, []);

  const lockPiece = useCallback((state: GameState): GameState => {
    if (!state.currentPiece) return state;
    
    let newBoard: (string | null)[][];
    
    // For sand mode, drop each tetromino cell as individual particles
    if (engine === 'sand') {
      newBoard = placeSandParticles(state.board, state.currentPiece);
    } else {
      newBoard = placeTetromino(state.board, state.currentPiece);
    }
    
    const updatedVisibility = updateVisibilityForPlacedPiece(state, state.currentPiece);
    
    // For sand mode, check for same-color lines; for other modes, check for completed lines
    let linesToClear: number[] = [];
    let sameColorLineData: { row: number; color: string }[] = [];
    
    if (engine === 'sand') {
      sameColorLineData = findSameColorLines(newBoard);
      linesToClear = sameColorLineData.map(l => l.row);
    } else {
      linesToClear = findCompletedLines(newBoard);
    }

    if (linesToClear.length > 0) {
      let clearResult;
      if (engine === 'sand') {
        clearResult = clearSandLines(newBoard, sameColorLineData);
      } else {
        clearResult = clearLines(newBoard, linesToClear, engine);
      }
      const { board: clearedBoard, clearedLines, displacements, preClearBoard } = clearResult;
      const newLinesCleared = state.linesCleared + linesToClear.length;
      
      // Calculate landing X position (center of the landed piece)
      const piece = state.currentPiece;
      let minX = BOARD_WIDTH, maxX = 0;
      for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
          if (piece.shape[y][x]) {
            const boardX = piece.position.x + x;
            minX = Math.min(minX, boardX);
            maxX = Math.max(maxX, boardX);
          }
        }
      }
      const landingX = (minX + maxX) / 2;
      
      let newLevel = state.level;
      if (state.gameMode === 'sprint') {
        newLevel = 1;
      } else if (state.gameMode === 'ultra') {
        newLevel = Math.floor(newLinesCleared / 20) + 1;
      } else if (state.gameMode === 'master') {
        newLevel = Math.floor(newLinesCleared / 10) + 1;
      } else {
        newLevel = Math.floor(newLinesCleared / 10) + 1;
      }
      
      const newCombo = state.combo + 1;
      
      // Check for Perfect Clear (board empty after clearing)
      const isPerfectClear = isBoardEmpty(clearedBoard);
      
      // Calculate score with Back-to-Back and Perfect Clear support
      const scoreResult = calculateScore(
        linesToClear.length, 
        state.level, 
        newCombo, 
        state.isTSpin, 
        state.isTSpinMini,
        state.backToBack,
        isPerfectClear
      );
      
      // Update Back-to-Back counter
      let newBackToBack = state.backToBack;
      if (scoreResult.isB2BEligible) {
        // Increment B2B for next eligible clear
        newBackToBack = state.backToBack + 1;
      } else if (linesToClear.length > 0) {
        // Regular line clear breaks B2B chain
        newBackToBack = 0;
      }
      
      let newZoneEnergy = state.zoneEnergy;
      if (state.gameMode === 'zone' && !state.isZoneActive) {
        newZoneEnergy = Math.min(state.zoneMaxEnergy, state.zoneEnergy + linesToClear.length * 25);
      }
      
      let newGarbageCleared = state.garbageCleared;
      if (state.gameMode === 'dig' || state.gameMode === 'survival') {
        const garbageColor = '#666666';
        linesToClear.forEach(lineIdx => {
          if (newBoard[lineIdx].some(cell => cell === garbageColor)) {
            newGarbageCleared++;
          }
        });
      }

      let stateWithClearedLines: GameState = {
        ...state,
        board: clearedBoard,
        score: state.score + scoreResult.score,
        linesCleared: newLinesCleared,
        level: newLevel,
        combo: newCombo,
        backToBack: newBackToBack,
        wasB2BApplied: scoreResult.wasB2BApplied,
        lastActionType: scoreResult.actionType,
        lastScoreGain: scoreResult.score,
        isPerfectClear: isPerfectClear,
        lastClearedLines: clearedLines,
        blockDisplacements: displacements,
        preClearBoard: preClearBoard,
        landingX: landingX,
        currentPiece: null,
        zoneEnergy: newZoneEnergy,
        garbageCleared: newGarbageCleared,
        visibilityBoard: updatedVisibility,
        // Classic engine: no animation, instant clear
        // Other engines: physics-based animation with shaking phase
        animationPhase: engine === 'classic' ? 'idle' : 'shaking',
        physicsFallingBlocks: [],
        cascadeCount: state.cascadeCount,
        lastLandedPiece: state.currentPiece,
      };

      const victoryCheck = checkModeVictory(stateWithClearedLines);
      if (victoryCheck.isVictory) {
        return { ...stateWithClearedLines, isVictory: true, isGameOver: true, animationPhase: 'idle' };
      }

      // Classic engine: spawn new piece immediately (no animation)
      if (engine === 'classic') {
        return spawnNewPiece(stateWithClearedLines);
      }

      // DON'T spawn new piece yet - wait for animation to complete
      // The piece will be spawned after animation phases finish
      return stateWithClearedLines;
    }

    // Piece placed without line clear - trigger lock bump effect
    // Back-to-Back is preserved (only breaks on non-difficult line clear)
    return spawnNewPiece({
      ...state,
      board: newBoard,
      combo: 0,
      wasB2BApplied: false,
      lastActionType: null,
      lastScoreGain: 0,
      isPerfectClear: false,
      lastClearedLines: [],
      blockDisplacements: [],
      preClearBoard: null,
      currentPiece: null,
      visibilityBoard: updatedVisibility,
      bumpDirection: 'down' as const,
      bumpTimestamp: Date.now(),
      isLastMoveRotation: false,
      isTSpin: false,
      isTSpinMini: false,
      lastLandedPiece: state.currentPiece,
    });
  }, [engine, spawnNewPiece, checkModeVictory, updateVisibilityForPlacedPiece]);

  // Block moves during line clear animation
  const isAnimating = gameState.animationPhase !== 'idle';

  // Animation phase timing constants
  const SHAKE_DURATION = 500;
  const EXPLODE_DURATION = 1100; // 250ms delay + 800ms destroy

  // Helper to create physics falling blocks from displacements
  const createFallingBlocks = useCallback((displacements: typeof gameState.blockDisplacements): PhysicsFallingBlock[] => {
    return displacements.map(d => ({
      x: d.x,
      currentY: d.oldY,
      targetY: d.newY,
      color: d.color,
      landed: d.oldY === d.newY,
    }));
  }, []);

  // Helper to check for new completed lines after falling
  const checkForChainReaction = useCallback((board: (string | null)[][]): number[] => {
    return findCompletedLines(board);
  }, []);

  // Animation phase state machine driven by useEffect
  useEffect(() => {
    if (gameState.animationPhase === 'idle') return;
    if (gameState.isGameOver || gameState.isVictory) return;
    
    const needsNewPiece = !gameState.currentPiece;

    if (gameState.animationPhase === 'shaking') {
      const timer = setTimeout(() => {
        setGameState(state => {
          if (state.animationPhase !== 'shaking') return state;
          return { ...state, animationPhase: 'exploding' };
        });
      }, SHAKE_DURATION);
      return () => clearTimeout(timer);
    }

    if (gameState.animationPhase === 'exploding') {
      const timer = setTimeout(() => {
        setGameState(state => {
          if (state.animationPhase !== 'exploding') return state;
          
          // For classic engine: skip falling phase entirely (no gravity)
          if (engine === 'classic') {
            const clearedState: GameState = {
              ...state,
              lastClearedLines: [],
              blockDisplacements: [],
              preClearBoard: null,
              landingX: null,
              animationPhase: 'idle' as AnimationPhase,
              physicsFallingBlocks: [],
              cascadeCount: 0,
            };
            
            if (needsNewPiece && !state.currentPiece) {
              return spawnNewPiece(clearedState);
            }
            return clearedState;
          }
          
          // For gravity engine: proceed to falling phase
          const fallingBlocks = createFallingBlocks(state.blockDisplacements);
          return {
            ...state,
            animationPhase: 'falling',
            physicsFallingBlocks: fallingBlocks,
            fallStartTime: Date.now(),
          };
        });
      }, EXPLODE_DURATION);
      return () => clearTimeout(timer);
    }

    if (gameState.animationPhase === 'falling') {
      // Calculate max fall distance to determine fall duration
      const maxDistance = gameState.physicsFallingBlocks.reduce((max, block) => {
        return Math.max(max, block.targetY - block.currentY);
      }, 0);
      
      // Fall duration based on distance (15 cells/second)
      const fallDuration = Math.max(100, (maxDistance / FALL_SPEED) * 1000);
      
      const timer = setTimeout(() => {
        setGameState(state => {
          if (state.animationPhase !== 'falling') return state;
          
          // Check for chain reactions in the settled board
          // For sand mode, check same-color lines; for others, check completed lines
          let linesToClear: number[] = [];
          let sameColorLineData: { row: number; color: string }[] = [];
          
          if (engine === 'sand') {
            sameColorLineData = findSameColorLines(state.board);
            linesToClear = sameColorLineData.map(l => l.row);
          } else {
            linesToClear = checkForChainReaction(state.board);
          }
          
          if (linesToClear.length > 0) {
            let clearResult;
            if (engine === 'sand') {
              clearResult = clearSandLines(state.board, sameColorLineData);
            } else {
              clearResult = clearLines(state.board, linesToClear, engine);
            }
            
            const clearedLines: ClearedLine[] = linesToClear.map(row => ({
              row,
              cells: state.board[row].map((color, x) => ({
                x,
                y: row,
                color: color || '#ffffff',
              })).filter(cell => cell.color !== '#ffffff'),
            }));
            
            let totalX = 0, count = 0;
            clearedLines.forEach(line => line.cells.forEach(cell => { totalX += cell.x; count++; }));
            const landingX = count > 0 ? totalX / count : BOARD_WIDTH / 2;

            // Cascade scoring (no T-Spin for chain reactions)
            const cascadeScoreResult = calculateScore(linesToClear.length, state.level, state.combo + 1, false, false, 0, false);
            
            const newState = {
              ...state,
              board: clearResult.board,
              lastClearedLines: clearedLines,
              blockDisplacements: clearResult.displacements,
              preClearBoard: clearResult.preClearBoard,
              landingX: landingX,
              animationPhase: (engine === 'classic' ? 'idle' : 'shaking') as AnimationPhase,
              physicsFallingBlocks: [],
              cascadeCount: state.cascadeCount + 1,
              score: state.score + cascadeScoreResult.score,
              linesCleared: state.linesCleared + linesToClear.length,
              combo: state.combo + 1,
            };
            
            // Classic engine: spawn new piece immediately
            if (engine === 'classic') {
              return spawnNewPiece(newState);
            }
            
            return newState;
          }

          // No chain reaction - animation complete
          const clearedState: GameState = {
            ...state,
            lastClearedLines: [],
            blockDisplacements: [],
            preClearBoard: null,
            landingX: null,
            animationPhase: 'idle' as AnimationPhase,
            physicsFallingBlocks: [],
            cascadeCount: 0,
          };
          
          if (needsNewPiece && !state.currentPiece) {
            return spawnNewPiece(clearedState);
          }
          return clearedState;
        });
      }, fallDuration);
      
      return () => clearTimeout(timer);
    }
  }, [gameState.animationPhase, gameState.currentPiece, gameState.isGameOver, gameState.isVictory, createFallingBlocks, checkForChainReaction, spawnNewPiece, engine]);

  const moveDown = useCallback(() => {
    setGameState(state => {
      if (state.isGameOver || state.isPaused || !state.currentPiece || state.animationPhase !== 'idle') return state;

      const newPosition = {
        ...state.currentPiece.position,
        y: state.currentPiece.position.y + 1,
      };

      const movedPiece = { ...state.currentPiece, position: newPosition };

      if (isValidPosition(state.board, movedPiece)) {
        // Soft drop: +1 point per row descended
        return { 
          ...state, 
          currentPiece: movedPiece,
          score: state.score + 1,
          isLastMoveRotation: false,
          isTSpin: false,
          isTSpinMini: false
        };
      }

      return lockPiece(state);
    });
  }, [lockPiece]);

  const moveLeft = useCallback(() => {
    setGameState(state => {
      if (state.isGameOver || state.isPaused || !state.currentPiece || state.animationPhase !== 'idle') return state;

      const newPosition = {
        ...state.currentPiece.position,
        x: state.currentPiece.position.x - 1,
      };

      const movedPiece = { ...state.currentPiece, position: newPosition };

      if (isValidPosition(state.board, movedPiece)) {
        return { 
          ...state, 
          currentPiece: movedPiece,
          isLastMoveRotation: false,
          isTSpin: false,
          isTSpinMini: false
        };
      }

      // Hit wall - trigger bump effect
      return { ...state, bumpDirection: 'left' as const, bumpTimestamp: Date.now() };
    });
  }, []);

  const moveRight = useCallback(() => {
    setGameState(state => {
      if (state.isGameOver || state.isPaused || !state.currentPiece || state.animationPhase !== 'idle') return state;

      const newPosition = {
        ...state.currentPiece.position,
        x: state.currentPiece.position.x + 1,
      };

      const movedPiece = { ...state.currentPiece, position: newPosition };

      if (isValidPosition(state.board, movedPiece)) {
        return { 
          ...state, 
          currentPiece: movedPiece,
          isLastMoveRotation: false,
          isTSpin: false,
          isTSpinMini: false
        };
      }

      // Hit wall - trigger bump effect
      return { ...state, bumpDirection: 'right' as const, bumpTimestamp: Date.now() };
    });
  }, []);

  const rotateWithDirection = useCallback((clockwise: boolean) => {
    setGameState(state => {
      if (state.isGameOver || state.isPaused || !state.currentPiece || state.animationPhase !== 'idle') return state;

      const fromState = state.currentPiece.rotationState;
      const toState = (clockwise ? (fromState + 1) % 4 : (fromState + 3) % 4) as RotationState;
      const rotated = rotateTetromino(state.currentPiece, clockwise);
      const rotatedWithState = { ...rotated, rotationState: toState };

      const kicks = getWallKicks(state.currentPiece.type, fromState, toState);
      
      for (let i = 0; i < kicks.length; i++) {
        const kick = kicks[i];
        const kickedPiece = {
          ...rotatedWithState,
          position: { 
            x: rotatedWithState.position.x + kick.x, 
            y: rotatedWithState.position.y + kick.y 
          },
        };
        
        if (isValidPosition(state.board, kickedPiece)) {
          // Check for T-Spin
          let isTSpin = false;
          let isTSpinMini = false;
          if (state.currentPiece?.type === 'T') {
            const { x, y } = kickedPiece.position;
            // SRS T-Spin detection: 3 or more corners occupied
            const corners = [
              { x: x, y: y },
              { x: x + 2, y: y },
              { x: x, y: y + 2 },
              { x: x + 2, y: y + 2 }
            ];
            
            let occupiedCount = 0;
            corners.forEach(corner => {
              if (
                corner.x < 0 || corner.x >= BOARD_WIDTH || 
                corner.y >= BOARD_HEIGHT || 
                (corner.y >= 0 && state.board[corner.y][corner.x])
              ) {
                occupiedCount++;
              }
            });
            
            if (occupiedCount >= 3) {
              // Distinction between T-Spin and T-Spin Mini
              // Simple heuristic: if it was kicked with the last SRS kick (index 4), it's usually a full T-Spin
              // or if the two "front" corners (facing the T-point) are occupied.
              isTSpin = true;
              if (i < 4 && occupiedCount === 3) {
                // Check if it's a "Mini" based on which corners are occupied relative to rotation
                // For simplicity, we'll count it as full T-Spin for now as per SRS standard unless 
                // very specific conditions are met. 
              }
            }
          }

          return { 
            ...state, 
            currentPiece: kickedPiece,
            isLastMoveRotation: true,
            isTSpin: isTSpin,
            isTSpinMini: isTSpinMini
          };
        }
      }

      return { ...state, bumpDirection: 'rotate' as const, bumpTimestamp: Date.now() };
    });
  }, []);

  const rotate = useCallback(() => rotateWithDirection(true), [rotateWithDirection]);
  const rotateLeft = useCallback(() => rotateWithDirection(false), [rotateWithDirection]);
  const rotateRight = useCallback(() => rotateWithDirection(true), [rotateWithDirection]);

  const hardDrop = useCallback(() => {
    setGameState(state => {
      if (state.isGameOver || state.isPaused || !state.currentPiece || state.animationPhase !== 'idle') return state;

      let droppedPiece = { ...state.currentPiece };
      let dropDistance = 0;

      while (
        isValidPosition(state.board, {
          ...droppedPiece,
          position: { ...droppedPiece.position, y: droppedPiece.position.y + 1 },
        })
      ) {
        droppedPiece.position.y++;
        dropDistance++;
      }

      const stateWithDrop = {
        ...state,
        currentPiece: droppedPiece,
        score: state.score + dropDistance * 2,
        isLastMoveRotation: false, // Hard drop is not a rotation
      };

      return lockPiece(stateWithDrop);
    });
  }, [lockPiece]);

  const holdPiece = useCallback(() => {
    setGameState(state => {
      if (state.isGameOver || state.isPaused || !state.currentPiece || !state.canHold || state.animationPhase !== 'idle') {
        return state;
      }

      const currentType = state.currentPiece.type;

      if (state.holdPiece) {
        const swapped = createTetromino(state.holdPiece.type);
        return {
          ...state,
          currentPiece: swapped,
          holdPiece: createTetromino(currentType),
          canHold: false,
        };
      }

      return spawnNewPiece({
        ...state,
        holdPiece: createTetromino(currentType),
        canHold: false,
        currentPiece: null,
      });
    });
  }, [spawnNewPiece]);

  const togglePause = useCallback(() => {
    setGameState(state => {
      if (state.isGameOver) return state;
      return { ...state, isPaused: !state.isPaused };
    });
  }, []);

  const removeBottomRow = useCallback(() => {
    setGameState(state => {
      if (state.isGameOver) return state;
      
      const result = removeBottomRowEngine(state.board, engine);
      if (!result.clearedLine) return state;
      
      return {
        ...state,
        board: result.board,
        lastClearedLines: [result.clearedLine],
        blockDisplacements: result.displacements,
        preClearBoard: result.preClearBoard,
      };
    });
  }, [engine]);

  const startGame = useCallback((mode?: GameMode, difficulty?: GameDifficulty) => {
    clearIntervals();
    // Clear seeded RNG when starting normal game
    seededRngRef.current = null;
    const selectedMode = mode || currentMode;
    const selectedDifficulty = difficulty || currentDifficulty;
    setCurrentMode(selectedMode);
    setCurrentDifficulty(selectedDifficulty);
    
    let newState = createInitialGameState(selectedMode, selectedDifficulty);
    
    if (selectedMode === 'dig' && selectedDifficulty) {
      const config = DIFFICULTY_CONFIGS[selectedDifficulty];
      newState = {
        ...newState,
        board: addGarbageLines(newState.board, config.garbageLines),
      };
    }
    
    setGameState(newState);
    setStartTime(Date.now());
    playTimeRef.current = 0;
    playTimeAccumulatedRef.current = 0;
    playTimeSessionStartRef.current = Date.now();
    playTimeWasRunningRef.current = true;
    setGameId(id => id + 1);
  }, [clearIntervals, currentMode, currentDifficulty]);

  // Start game with seeded RNG for synchronized multiplayer
  const startSeededGame = useCallback((seed: string, mode?: GameMode, difficulty?: GameDifficulty) => {
    clearIntervals();
    // Initialize seeded RNG for synchronized piece generation
    const rng = seedrandom(seed);
    seededRngRef.current = rng;
    
    const selectedMode = mode || currentMode;
    const selectedDifficulty = difficulty || currentDifficulty;
    setCurrentMode(selectedMode);
    setCurrentDifficulty(selectedDifficulty);
    
    // Create initial game state with seeded RNG
    let newState = createSeededGameState(rng, selectedMode, selectedDifficulty);
    
    if (selectedMode === 'dig' && selectedDifficulty) {
      const config = DIFFICULTY_CONFIGS[selectedDifficulty];
      newState = {
        ...newState,
        board: addGarbageLines(newState.board, config.garbageLines),
      };
    }
    
    setGameState(newState);
    setStartTime(Date.now());
    playTimeRef.current = 0;
    playTimeAccumulatedRef.current = 0;
    playTimeSessionStartRef.current = Date.now();
    playTimeWasRunningRef.current = true;
    setGameId(id => id + 1);
  }, [clearIntervals, currentMode, currentDifficulty]);

  const resetGame = useCallback(() => {
    startGame(currentMode, currentDifficulty);
  }, [startGame, currentMode, currentDifficulty]);

  useEffect(() => {
    if (gameId === 0) return;
    
    // Disable auto-fall for opponent game (input-based sync)
    if (disableAutoFall) {
      if (dropIntervalRef.current) {
        clearInterval(dropIntervalRef.current);
        dropIntervalRef.current = null;
      }
      return;
    }
    
    // Stop timer during game over, pause, or line clear animation
    if (gameState.isGameOver || gameState.isPaused || gameState.animationPhase !== 'idle') {
      if (dropIntervalRef.current) {
        clearInterval(dropIntervalRef.current);
        dropIntervalRef.current = null;
      }
      return;
    }

    let speed: number;
    
    if (gameState.isZoneActive) {
      speed = getZoneDropSpeed();
    } else if (gameState.gameMode === 'master') {
      speed = getMasterModeSpeed(gameState.level);
    } else {
      speed = getDropSpeed(gameState.level);
      
      if (gameState.difficulty && DIFFICULTY_CONFIGS[gameState.difficulty]) {
        const multiplier = DIFFICULTY_CONFIGS[gameState.difficulty].speedMultiplier;
        speed = Math.max(50, Math.floor(speed / multiplier));
      }
    }
    
    dropIntervalRef.current = setInterval(moveDown, speed);

    return () => {
      if (dropIntervalRef.current) {
        clearInterval(dropIntervalRef.current);
      }
    };
  }, [gameId, gameState.isGameOver, gameState.isPaused, gameState.level, gameState.gameMode, gameState.difficulty, gameState.isZoneActive, gameState.animationPhase, moveDown, disableAutoFall]);

  // Update playTimeRef silently (no re-renders) with proper pause handling
  const shouldTimerRun = startTime !== null && !gameState.isGameOver && !gameState.isPaused && !gameState.isZoneActive;
  
  useEffect(() => {
    if (shouldTimerRun) {
      // Starting or resuming
      if (!playTimeWasRunningRef.current) {
        playTimeSessionStartRef.current = Date.now();
        playTimeWasRunningRef.current = true;
      }
      
      const updateTime = () => {
        if (playTimeSessionStartRef.current !== null) {
          const sessionElapsed = Date.now() - playTimeSessionStartRef.current;
          playTimeRef.current = playTimeAccumulatedRef.current + sessionElapsed;
        }
        gameLoopRef.current = requestAnimationFrame(updateTime) as unknown as NodeJS.Timeout;
      };
      gameLoopRef.current = requestAnimationFrame(updateTime) as unknown as NodeJS.Timeout;

      return () => {
        if (gameLoopRef.current) {
          cancelAnimationFrame(gameLoopRef.current as unknown as number);
        }
      };
    } else {
      // Pausing or stopping - save accumulated time
      if (playTimeWasRunningRef.current && playTimeSessionStartRef.current !== null) {
        const sessionElapsed = Date.now() - playTimeSessionStartRef.current;
        playTimeAccumulatedRef.current += sessionElapsed;
        playTimeSessionStartRef.current = null;
        playTimeWasRunningRef.current = false;
      }
      
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current as unknown as number);
      }
    }
  }, [shouldTimerRun]);

  useEffect(() => {
    if (gameState.gameMode !== 'ultra' || gameState.isGameOver || gameState.isPaused || gameState.isZoneActive || gameId === 0) {
      return;
    }

    timerRef.current = setInterval(() => {
      setGameState(prev => {
        if (prev.timeRemaining <= 1) {
          return { ...prev, timeRemaining: 0, isGameOver: true };
        }
        return { ...prev, timeRemaining: prev.timeRemaining - 1 };
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gameId, gameState.gameMode, gameState.isGameOver, gameState.isPaused, gameState.isZoneActive]);

  useEffect(() => {
    const mode = gameState.gameMode;
    const difficulty = gameState.difficulty;
    
    // Stop garbage timer during animation
    if ((mode !== 'dig' && mode !== 'survival') || !difficulty || gameState.isGameOver || gameState.isPaused || gameState.isZoneActive || gameState.animationPhase !== 'idle' || gameId === 0) {
      if (garbageIntervalRef.current) {
        clearInterval(garbageIntervalRef.current);
        garbageIntervalRef.current = null;
      }
      return;
    }

    const config = DIFFICULTY_CONFIGS[difficulty];
    const interval = mode === 'survival' 
      ? Math.max(2000, config.garbageInterval - ((playTimeRef.current / 1000) * 100))  // playTime is in ms
      : config.garbageInterval;

    garbageIntervalRef.current = setInterval(() => {
      setGameState(prev => {
        // Don't add garbage during animation
        if (prev.isGameOver || prev.isPaused || prev.isZoneActive || prev.animationPhase !== 'idle') return prev;
        
        const linesCount = mode === 'survival' 
          ? Math.min(5, Math.floor((playTimeRef.current / 1000) / 30) + 1)  // playTime is in ms
          : config.garbageLines;
        
        const newBoard = addGarbageLines(prev.board, linesCount);
        
        if (newBoard[0].some(cell => cell !== null)) {
          return { ...prev, board: newBoard, isGameOver: true };
        }
        
        return { ...prev, board: newBoard, attackIntensity: prev.attackIntensity + 0.1 };
      });
    }, interval);

    return () => {
      if (garbageIntervalRef.current) {
        clearInterval(garbageIntervalRef.current);
      }
    };
  }, [gameId, gameState.gameMode, gameState.difficulty, gameState.isGameOver, gameState.isPaused, gameState.isZoneActive, gameState.animationPhase]);

  useEffect(() => {
    if (gameState.gameMode !== 'zone' || !gameState.isZoneActive || gameState.isGameOver || gameState.isPaused || gameId === 0) {
      return;
    }

    zoneTimerRef.current = setInterval(() => {
      setGameState(prev => {
        if (prev.zoneTimeRemaining <= 1) {
          return { ...prev, zoneTimeRemaining: 0, isZoneActive: false };
        }
        return { ...prev, zoneTimeRemaining: prev.zoneTimeRemaining - 1 };
      });
    }, 1000);

    return () => {
      if (zoneTimerRef.current) {
        clearInterval(zoneTimerRef.current);
      }
    };
  }, [gameId, gameState.gameMode, gameState.isZoneActive, gameState.isGameOver, gameState.isPaused]);

  // Continuous sand physics simulation for Sand Mode
  useEffect(() => {
    if (engine !== 'sand' || gameState.isGameOver || gameState.isPaused || gameState.animationPhase !== 'idle' || gameId === 0) {
      if (sandPhysicsRef.current) {
        clearInterval(sandPhysicsRef.current);
        sandPhysicsRef.current = null;
      }
      return;
    }

    // Run sand physics every 50ms for smooth settling animation
    sandPhysicsRef.current = setInterval(() => {
      setGameState(prev => {
        if (prev.animationPhase !== 'idle' || prev.isGameOver || prev.isPaused) return prev;
        
        // Run one step of sand physics
        const { board: newBoard, settled } = applySandPhysicsSteps(prev.board, 1);
        
        // If nothing moved, no state change needed
        if (settled) return prev;
        
        // Check for same-color lines after physics
        const sameColorLines = findSameColorLines(newBoard);
        if (sameColorLines.length > 0) {
          const preClearBoard = prev.board.map(row => [...row]);
          const { board: clearedBoard, displacements, clearedLines } = clearSandLines(newBoard, sameColorLines);
          
          const linesCount = sameColorLines.length;
          const sandScoreResult = calculateScore(linesCount, prev.level, prev.combo, false, false, 0, false);
          const newLinesCleared = prev.linesCleared + linesCount;
          const newLevel = Math.min(20, Math.floor(newLinesCleared / 10) + 1);
          
          return {
            ...prev,
            board: clearedBoard,
            score: prev.score + sandScoreResult.score,
            linesCleared: newLinesCleared,
            level: newLevel,
            combo: prev.combo + 1,
            lastClearedLines: clearedLines,
            blockDisplacements: displacements,
            preClearBoard: preClearBoard,
            animationPhase: 'shaking',
            cascadeCount: prev.cascadeCount + 1,
          };
        }
        
        return { ...prev, board: newBoard };
      });
    }, 50);

    return () => {
      if (sandPhysicsRef.current) {
        clearInterval(sandPhysicsRef.current);
      }
    };
  }, [engine, gameId, gameState.isGameOver, gameState.isPaused, gameState.animationPhase]);

  useEffect(() => {
    if (disableKeyHandlers) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.isGameOver) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          moveLeft();
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveRight();
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveDown();
          break;
        case 'ArrowUp':
          e.preventDefault();
          rotate();
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          holdPiece();
          break;
        case 'p':
        case 'P':
        case 'Escape':
          e.preventDefault();
          togglePause();
          break;
        case 'z':
        case 'Z':
          e.preventDefault();
          rotateLeft();
          break;
        case 'x':
        case 'X':
          e.preventDefault();
          rotateRight();
          break;
        case 'v':
        case 'V':
          e.preventDefault();
          activateZone();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disableKeyHandlers, gameState.isGameOver, moveLeft, moveRight, moveDown, rotate, rotateLeft, rotateRight, hardDrop, holdPiece, togglePause, activateZone]);

  return {
    gameState,
    startTime,  // Pass startTime so GameStats can calculate time with requestAnimationFrame
    playTimeRef,  // Ref for current playTime value
    currentMode,
    currentDifficulty,
    isAnimating,
    startGame,
    startSeededGame,
    resetGame,
    moveLeft,
    moveRight,
    moveDown,
    rotate,
    rotateLeft,
    rotateRight,
    hardDrop,
    holdPiece,
    togglePause,
    removeBottomRow,
    activateZone,
  };
}
