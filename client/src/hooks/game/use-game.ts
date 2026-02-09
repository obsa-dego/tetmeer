import { useState, useCallback, useEffect, useRef } from 'react';
import seedrandom from 'seedrandom';
import {
  GameState,
  GameMode,
  GameDifficulty,
  GameEngine,
  DIFFICULTY_CONFIGS,
  createInitialGameState,
  createSeededGameState,
  createTetromino,
  isValidPosition,
  findCompletedLines,
  findSameColorLines,
  clearLines,
  clearSandLines,
  calculateScore,
  getDropSpeed,
  getMasterModeSpeed,
  getZoneDropSpeed,
  addGarbageLines,
  createVisibilityBoard,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  PhysicsFallingBlock,
  AnimationPhase,
  ClearedLine,
  FALL_SPEED,
  applySandPhysicsSteps,
  Tetromino,
} from '@/lib/game-engine';

import {
  spawnNewPiece as spawnNewPieceLogic,
  checkModeVictory,
  lockPiece as lockPieceLogic,
} from './game-piece-logic';
import {
  moveDownState,
  moveLeftState,
  moveRightState,
  rotateState,
  hardDropState,
  holdPieceState,
  removeBottomRowState,
} from './game-movement-logic';
import type { UseGameOptions, UseBlockGameReturn } from './types';

let useBlockGameInstanceCounter = 0;

export function useBlockGame(engine: GameEngine = 'gravity', options: UseGameOptions = {}): UseBlockGameReturn {
  const { disableKeyHandlers = false, disableAutoFall = false } = options;

  const instanceIdRef = useRef<string | null>(null);
  if (!instanceIdRef.current) {
    useBlockGameInstanceCounter++;
    instanceIdRef.current = `game-${useBlockGameInstanceCounter}-${Math.random().toString(36).substring(7)}`;
    console.log(`[useBlockGame:${instanceIdRef.current}] CREATED - engine=${engine}, disableKeyHandlers=${disableKeyHandlers}, disableAutoFall=${disableAutoFall}`);
  }

  const [gameState, setGameState] = useState<GameState>(createInitialGameState());
  const [startTime, setStartTime] = useState<number | null>(null);
  const playTimeRef = useRef(0);
  const playTimeAccumulatedRef = useRef(0);
  const playTimeSessionStartRef = useRef<number | null>(null);
  const playTimeWasRunningRef = useRef(false);
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
  const seededRngRef = useRef<(() => number) | null>(null);

  const clearIntervals = useCallback(() => {
    if (dropIntervalRef.current) { clearInterval(dropIntervalRef.current); dropIntervalRef.current = null; }
    if (gameLoopRef.current) { clearInterval(gameLoopRef.current); gameLoopRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (garbageIntervalRef.current) { clearInterval(garbageIntervalRef.current); garbageIntervalRef.current = null; }
    if (sandPhysicsRef.current) { clearInterval(sandPhysicsRef.current); sandPhysicsRef.current = null; }
    if (zoneTimerRef.current) { clearInterval(zoneTimerRef.current); zoneTimerRef.current = null; }
    visibilityTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    visibilityTimeoutsRef.current.clear();
  }, []);

  // Bound spawn function that captures seededRngRef
  const spawnNewPiece = useCallback((state: GameState): GameState => {
    return spawnNewPieceLogic(state, seededRngRef.current);
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
    return lockPieceLogic(state, engine, updateVisibilityForPlacedPiece, spawnNewPiece);
  }, [engine, updateVisibilityForPlacedPiece, spawnNewPiece]);

  const isAnimating = gameState.animationPhase !== 'idle';

  // Animation constants
  const SHAKE_DURATION = 500;
  const EXPLODE_DURATION = 1100;

  const createFallingBlocks = useCallback((displacements: typeof gameState.blockDisplacements): PhysicsFallingBlock[] => {
    return displacements.map(d => ({
      x: d.x,
      currentY: d.oldY,
      targetY: d.newY,
      color: d.color,
      landed: d.oldY === d.newY,
    }));
  }, []);

  const checkForChainReaction = useCallback((board: (string | null)[][]): number[] => {
    return findCompletedLines(board);
  }, []);

  // Animation phase state machine
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
      const maxDistance = gameState.physicsFallingBlocks.reduce((max, block) => {
        return Math.max(max, block.targetY - block.currentY);
      }, 0);

      const fallDuration = Math.max(100, (maxDistance / FALL_SPEED) * 1000);

      const timer = setTimeout(() => {
        setGameState(state => {
          if (state.animationPhase !== 'falling') return state;

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

            if (engine === 'classic') {
              return spawnNewPiece(newState);
            }

            return newState;
          }

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

  // Movement callbacks using pure logic functions
  const moveDown = useCallback(() => {
    setGameState(state => moveDownState(state, lockPiece));
  }, [lockPiece]);

  const moveLeft = useCallback(() => {
    setGameState(state => moveLeftState(state));
  }, []);

  const moveRight = useCallback(() => {
    setGameState(state => moveRightState(state));
  }, []);

  const rotateWithDirection = useCallback((clockwise: boolean) => {
    setGameState(state => rotateState(state, clockwise));
  }, []);

  const rotate = useCallback(() => rotateWithDirection(true), [rotateWithDirection]);
  const rotateLeft = useCallback(() => rotateWithDirection(false), [rotateWithDirection]);
  const rotateRight = useCallback(() => rotateWithDirection(true), [rotateWithDirection]);

  const hardDrop = useCallback(() => {
    setGameState(state => hardDropState(state, lockPiece));
  }, [lockPiece]);

  const holdPiece = useCallback(() => {
    setGameState(state => holdPieceState(state, spawnNewPiece));
  }, [spawnNewPiece]);

  const togglePause = useCallback(() => {
    setGameState(state => {
      if (state.isGameOver) return state;
      return { ...state, isPaused: !state.isPaused };
    });
  }, []);

  const removeBottomRow = useCallback(() => {
    setGameState(state => removeBottomRowState(state, engine));
  }, [engine]);

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

  const startGame = useCallback((mode?: GameMode, difficulty?: GameDifficulty) => {
    clearIntervals();
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

  const startSeededGame = useCallback((seed: string, mode?: GameMode, difficulty?: GameDifficulty) => {
    clearIntervals();
    const rng = seedrandom(seed);
    seededRngRef.current = rng;

    const selectedMode = mode || currentMode;
    const selectedDifficulty = difficulty || currentDifficulty;
    setCurrentMode(selectedMode);
    setCurrentDifficulty(selectedDifficulty);

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

  // Drop interval effect
  useEffect(() => {
    if (gameId === 0) return;

    if (disableAutoFall) {
      if (dropIntervalRef.current) { clearInterval(dropIntervalRef.current); dropIntervalRef.current = null; }
      return;
    }

    if (gameState.isGameOver || gameState.isPaused || gameState.animationPhase !== 'idle') {
      if (dropIntervalRef.current) { clearInterval(dropIntervalRef.current); dropIntervalRef.current = null; }
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
      if (dropIntervalRef.current) clearInterval(dropIntervalRef.current);
    };
  }, [gameId, gameState.isGameOver, gameState.isPaused, gameState.level, gameState.gameMode, gameState.difficulty, gameState.isZoneActive, gameState.animationPhase, moveDown, disableAutoFall]);

  // Play time tracking effect
  const shouldTimerRun = startTime !== null && !gameState.isGameOver && !gameState.isPaused && !gameState.isZoneActive;

  useEffect(() => {
    if (shouldTimerRun) {
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
        if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current as unknown as number);
      };
    } else {
      if (playTimeWasRunningRef.current && playTimeSessionStartRef.current !== null) {
        const sessionElapsed = Date.now() - playTimeSessionStartRef.current;
        playTimeAccumulatedRef.current += sessionElapsed;
        playTimeSessionStartRef.current = null;
        playTimeWasRunningRef.current = false;
      }

      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current as unknown as number);
    }
  }, [shouldTimerRun]);

  // Ultra mode countdown timer
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
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameId, gameState.gameMode, gameState.isGameOver, gameState.isPaused, gameState.isZoneActive]);

  // Garbage lines effect (dig/survival modes)
  useEffect(() => {
    const mode = gameState.gameMode;
    const difficulty = gameState.difficulty;

    if ((mode !== 'dig' && mode !== 'survival') || !difficulty || gameState.isGameOver || gameState.isPaused || gameState.isZoneActive || gameState.animationPhase !== 'idle' || gameId === 0) {
      if (garbageIntervalRef.current) { clearInterval(garbageIntervalRef.current); garbageIntervalRef.current = null; }
      return;
    }

    const config = DIFFICULTY_CONFIGS[difficulty];
    const interval = mode === 'survival'
      ? Math.max(2000, config.garbageInterval - ((playTimeRef.current / 1000) * 100))
      : config.garbageInterval;

    garbageIntervalRef.current = setInterval(() => {
      setGameState(prev => {
        if (prev.isGameOver || prev.isPaused || prev.isZoneActive || prev.animationPhase !== 'idle') return prev;

        const linesCount = mode === 'survival'
          ? Math.min(5, Math.floor((playTimeRef.current / 1000) / 30) + 1)
          : config.garbageLines;

        const newBoard = addGarbageLines(prev.board, linesCount);

        if (newBoard[0].some(cell => cell !== null)) {
          return { ...prev, board: newBoard, isGameOver: true };
        }

        return { ...prev, board: newBoard, attackIntensity: prev.attackIntensity + 0.1 };
      });
    }, interval);

    return () => {
      if (garbageIntervalRef.current) clearInterval(garbageIntervalRef.current);
    };
  }, [gameId, gameState.gameMode, gameState.difficulty, gameState.isGameOver, gameState.isPaused, gameState.isZoneActive, gameState.animationPhase]);

  // Zone timer effect
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
      if (zoneTimerRef.current) clearInterval(zoneTimerRef.current);
    };
  }, [gameId, gameState.gameMode, gameState.isZoneActive, gameState.isGameOver, gameState.isPaused]);

  // Sand physics effect
  useEffect(() => {
    if (engine !== 'sand' || gameState.isGameOver || gameState.isPaused || gameState.animationPhase !== 'idle' || gameId === 0) {
      if (sandPhysicsRef.current) { clearInterval(sandPhysicsRef.current); sandPhysicsRef.current = null; }
      return;
    }

    sandPhysicsRef.current = setInterval(() => {
      setGameState(prev => {
        if (prev.animationPhase !== 'idle' || prev.isGameOver || prev.isPaused) return prev;

        const { board: newBoard, settled } = applySandPhysicsSteps(prev.board, 1);

        if (settled) return prev;

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
      if (sandPhysicsRef.current) clearInterval(sandPhysicsRef.current);
    };
  }, [engine, gameId, gameState.isGameOver, gameState.isPaused, gameState.animationPhase]);

  // Keyboard input handler
  useEffect(() => {
    if (disableKeyHandlers) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.isGameOver) return;

      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); moveLeft(); break;
        case 'ArrowRight': e.preventDefault(); moveRight(); break;
        case 'ArrowDown': e.preventDefault(); moveDown(); break;
        case 'ArrowUp': e.preventDefault(); rotate(); break;
        case ' ': e.preventDefault(); hardDrop(); break;
        case 'c': case 'C': e.preventDefault(); holdPiece(); break;
        case 'p': case 'P': case 'Escape': e.preventDefault(); togglePause(); break;
        case 'z': case 'Z': e.preventDefault(); rotateLeft(); break;
        case 'x': case 'X': e.preventDefault(); rotateRight(); break;
        case 'v': case 'V': e.preventDefault(); activateZone(); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disableKeyHandlers, gameState.isGameOver, moveLeft, moveRight, moveDown, rotate, rotateLeft, rotateRight, hardDrop, holdPiece, togglePause, activateZone]);

  return {
    gameState,
    startTime,
    playTimeRef,
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
