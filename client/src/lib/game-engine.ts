export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export interface Position {
  x: number;
  y: number;
}

// SRS Wall Kick Data
// From Hard Drop Wiki: https://harddrop.com/wiki/SRS
// Each entry is [dx, dy] where dy+ is up in SRS (but our grid is dy+ down, so we invert)
export type RotationState = 0 | 1 | 2 | 3; // 0: Spawn, 1: 90 deg (CW), 2: 180 deg, 3: 270 deg (CCW)

const SRS_KICK_DATA: Record<string, Position[][]> = {
  // J, L, S, T, Z pieces
  'COMMON': [
    // 0 -> 1
    [{x: 0, y: 0}, {x: -1, y: 0}, {x: -1, y: -1}, {x: 0, y: 2}, {x: -1, y: 2}],
    // 1 -> 0
    [{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1}, {x: 0, y: -2}, {x: 1, y: -2}],
    // 1 -> 2
    [{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1}, {x: 0, y: -2}, {x: 1, y: -2}],
    // 2 -> 1
    [{x: 0, y: 0}, {x: -1, y: 0}, {x: -1, y: -1}, {x: 0, y: 2}, {x: -1, y: 2}],
    // 2 -> 3
    [{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: -1}, {x: 0, y: 2}, {x: 1, y: 2}],
    // 3 -> 2
    [{x: 0, y: 0}, {x: -1, y: 0}, {x: -1, y: 1}, {x: 0, y: -2}, {x: -1, y: -2}],
    // 3 -> 0
    [{x: 0, y: 0}, {x: -1, y: 0}, {x: -1, y: 1}, {x: 0, y: -2}, {x: -1, y: -2}],
    // 0 -> 3
    [{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: -1}, {x: 0, y: 2}, {x: 1, y: 2}],
  ],
  // I piece
  'I': [
    // 0 -> 1
    [{x: 0, y: 0}, {x: -2, y: 0}, {x: 1, y: 0}, {x: -2, y: 1}, {x: 1, y: -2}],
    // 1 -> 0
    [{x: 0, y: 0}, {x: 2, y: 0}, {x: -1, y: 0}, {x: 2, y: -1}, {x: -1, y: 2}],
    // 1 -> 2
    [{x: 0, y: 0}, {x: -1, y: 0}, {x: 2, y: 0}, {x: -1, y: -2}, {x: 2, y: 1}],
    // 2 -> 1
    [{x: 0, y: 0}, {x: 1, y: 0}, {x: -2, y: 0}, {x: 1, y: 2}, {x: -2, y: -1}],
    // 2 -> 3
    [{x: 0, y: 0}, {x: 2, y: 0}, {x: -1, y: 0}, {x: 2, y: -1}, {x: -1, y: 2}],
    // 3 -> 2
    [{x: 0, y: 0}, {x: -2, y: 0}, {x: 1, y: 0}, {x: -2, y: 1}, {x: 1, y: -2}],
    // 3 -> 0
    [{x: 0, y: 0}, {x: 1, y: 0}, {x: -2, y: 0}, {x: 1, y: 2}, {x: -2, y: -1}],
    // 0 -> 3
    [{x: 0, y: 0}, {x: -1, y: 0}, {x: 2, y: 0}, {x: -1, y: -2}, {x: 2, y: 1}],
  ]
};

export function getWallKicks(type: TetrominoType, fromState: number, toState: number): Position[] {
  if (type === 'O') return [{x: 0, y: 0}];
  
  const key = type === 'I' ? 'I' : 'COMMON';
  const stateTransitions: Record<string, number> = {
    '0-1': 0, '1-0': 1, '1-2': 2, '2-1': 3, '2-3': 4, '3-2': 5, '3-0': 6, '0-3': 7
  };
  
  const transitionKey = `${fromState}-${toState}`;
  const index = stateTransitions[transitionKey];
  
  // Return inverted Y kicks because our grid Y increases downwards
  return SRS_KICK_DATA[key][index].map(kick => ({ x: kick.x, y: -kick.y }));
}

export interface Tetromino {
  type: TetrominoType;
  shape: number[][];
  position: Position;
  color: string;
  rotationState: RotationState;
}

export const TETROMINO_SHAPES: Record<TetrominoType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

export const TETROMINO_COLORS: Record<TetrominoType, string> = {
  I: '#00f5ff',
  O: '#ffeb3b',
  T: '#9c27b0',
  S: '#4caf50',
  Z: '#f44336',
  J: '#2196f3',
  L: '#ff9800',
};

export interface ClearedLine {
  row: number;
  cells: { x: number; y: number; color: string }[];
}

// Tracks where each block moved from during a line clear
export interface BlockDisplacement {
  x: number;
  oldY: number;  // Original row index before clearing
  newY: number;  // New row index after clearing and gravity
  color: string;
}

export interface ClearResult {
  board: (string | null)[][];
  clearedLines: ClearedLine[];
  displacements: BlockDisplacement[];  // Movement data for all blocks
  preClearBoard: (string | null)[][];  // Board state before clearing
}

// Physics-based falling block for constant speed falling
export interface PhysicsFallingBlock {
  x: number;
  currentY: number;  // Current visual Y position (can be fractional)
  targetY: number;   // Final Y position (integer board row)
  color: string;
  landed: boolean;   // True when block has reached target
}

// Animation phase for line clear sequence
export type AnimationPhase = 'idle' | 'shaking' | 'exploding' | 'falling';

// Pending line clear for cascade support
export interface PendingClear {
  lines: ClearedLine[];
  explosionCenterX: number;
  startTime: number;
}

// Fall animation constants
export const FALL_SPEED = 15; // cells per second

export type GameMode = 'marathon' | 'sprint' | 'ultra' | 'zen' | 'dig' | 'survival' | 'invisible' | 'zone' | 'master';

export type GameDifficulty = 'easy' | 'normal' | 'hard' | 'expert' | 'ultimate' | 'slow' | 'fast' | 'instant' | 'no_ghost';

export interface GameModeConfig {
  name: string;
  description: string;
  iconName: 'trophy' | 'zap' | 'flame' | 'infinity' | 'shovel' | 'heart' | 'eye-off' | 'target' | 'crown';
  targetLines?: number;
  targetTime?: number;
  maxLevel?: number;
  isTimeAttack?: boolean;
  isCountdown?: boolean;
  hasDifficulty?: boolean;
  difficulties?: GameDifficulty[];
  category?: 'classic' | 'advanced';
  hasGarbage?: boolean;
  hasZone?: boolean;
  hasInvisibility?: boolean;
}

export const GAME_MODE_CONFIGS: Record<GameMode, GameModeConfig> = {
  marathon: {
    name: 'Marathon',
    description: 'Survive to level 15 as speed increases. Aim for the highest score!',
    iconName: 'trophy',
    targetLines: 150,
    maxLevel: 15,
    category: 'classic',
  },
  sprint: {
    name: 'Sprint',
    description: 'Clear 40 lines as fast as you can! Time is your only metric',
    iconName: 'zap',
    targetLines: 40,
    isTimeAttack: true,
    category: 'classic',
  },
  ultra: {
    name: 'Ultra',
    description: 'Get the highest score in 3 minutes',
    iconName: 'flame',
    targetTime: 180,
    isCountdown: true,
    category: 'classic',
  },
  zen: {
    name: 'Zen',
    description: 'Free play mode - no time limit, no game over, practice at your own pace',
    iconName: 'infinity',
    category: 'classic',
  },
  dig: {
    name: 'Dig',
    description: 'Clear garbage blocks falling from above',
    iconName: 'shovel',
    hasDifficulty: true,
    difficulties: ['easy', 'normal', 'hard', 'expert', 'ultimate'],
    hasGarbage: true,
    category: 'advanced',
  },
  survival: {
    name: 'Survival',
    description: 'Survive escalating garbage attacks',
    iconName: 'heart',
    hasDifficulty: true,
    difficulties: ['easy', 'normal', 'hard', 'expert', 'ultimate'],
    hasGarbage: true,
    category: 'advanced',
  },
  invisible: {
    name: 'Invisible',
    description: 'Play with disappearing blocks',
    iconName: 'eye-off',
    hasDifficulty: true,
    difficulties: ['slow', 'fast', 'instant', 'no_ghost'],
    hasInvisibility: true,
    category: 'advanced',
  },
  zone: {
    name: 'Zone',
    description: 'Build zone power to freeze time',
    iconName: 'target',
    hasZone: true,
    category: 'advanced',
  },
  master: {
    name: 'Master',
    description: '20G instant drop gravity - extreme speed challenge',
    iconName: 'crown',
    maxLevel: 1000,
    category: 'advanced',
  },
};

export interface DifficultyConfig {
  name: string;
  garbageInterval: number;
  garbageLines: number;
  speedMultiplier: number;
  visibilityDelay: number;
}

export const DIFFICULTY_CONFIGS: Record<GameDifficulty, DifficultyConfig> = {
  easy: { name: 'Easy', garbageInterval: 15000, garbageLines: 1, speedMultiplier: 0.8, visibilityDelay: 5000 },
  normal: { name: 'Normal', garbageInterval: 12000, garbageLines: 2, speedMultiplier: 1.0, visibilityDelay: 3000 },
  hard: { name: 'Hard', garbageInterval: 8000, garbageLines: 3, speedMultiplier: 1.2, visibilityDelay: 1500 },
  expert: { name: 'Expert', garbageInterval: 5000, garbageLines: 4, speedMultiplier: 1.5, visibilityDelay: 500 },
  ultimate: { name: 'Ultimate', garbageInterval: 3000, garbageLines: 5, speedMultiplier: 2.0, visibilityDelay: 0 },
  slow: { name: 'Slow', garbageInterval: 0, garbageLines: 0, speedMultiplier: 1.0, visibilityDelay: 5000 },
  fast: { name: 'Fast', garbageInterval: 0, garbageLines: 0, speedMultiplier: 1.0, visibilityDelay: 500 },
  instant: { name: 'Instant', garbageInterval: 0, garbageLines: 0, speedMultiplier: 1.0, visibilityDelay: 0 },
  no_ghost: { name: 'No Ghost', garbageInterval: 0, garbageLines: 0, speedMultiplier: 1.0, visibilityDelay: 0 },
};

export type BumpDirection = 'left' | 'right' | 'down' | 'rotate' | null;

// Score action types for UI feedback
export type ScoreActionType = 'single' | 'double' | 'triple' | 'tetris' | 'tspin' | 'tspin_mini' | 'tspin_single' | 'tspin_double' | 'tspin_triple' | null;

export interface GameState {
  board: (string | null)[][];
  currentPiece: Tetromino | null;
  nextPiece: Tetromino | null;
  pieceQueue: Tetromino[];
  pieceBag: TetrominoType[];  // 7-bag randomizer: remaining pieces in current bag
  holdPiece: Tetromino | null;
  canHold: boolean;
  score: number;
  level: number;
  linesCleared: number;
  piecesPlaced: number;  // Total pieces placed for BPS calculation
  isGameOver: boolean;
  isVictory: boolean;
  isPaused: boolean;
  combo: number;
  backToBack: number;  // B2B counter (0 = no B2B, 1+ = consecutive difficult clears)
  wasB2BApplied: boolean;  // True if B2B bonus was applied to the last score
  lastActionType: ScoreActionType;  // For UI feedback display
  lastScoreGain: number;  // Points gained from last action
  isPerfectClear: boolean;  // True if board is empty after clear
  lastClearedLines: ClearedLine[];
  blockDisplacements: BlockDisplacement[];  // Movement data for animation (legacy)
  preClearBoard: (string | null)[][] | null;  // Board state before clearing
  landingX: number | null;  // X position where piece landed (for explosion center)
  isLastMoveRotation: boolean;
  isTSpin: boolean;
  isTSpinMini: boolean;
  // Physics-based animation state
  animationPhase: AnimationPhase;
  physicsFallingBlocks: PhysicsFallingBlock[];
  pendingClears: PendingClear[];
  cascadeCount: number;  // Number of chain reactions in current sequence
  fallStartTime: number;  // Timestamp when falling phase started
  gameMode: GameMode;
  timeRemaining: number;
  difficulty?: GameDifficulty;
  garbageCleared: number;
  garbageQueue: number;
  zoneEnergy: number;
  zoneMaxEnergy: number;
  isZoneActive: boolean;
  zoneTimeRemaining: number;
  zoneActivations: number;
  visibilityBoard: number[][];
  showGhost: boolean;
  attackIntensity: number;
  // Wall bump effect for impact feedback
  bumpDirection: BumpDirection;
  bumpTimestamp: number;
  // Last landed piece for sand physics
  lastLandedPiece: Tetromino | null;
}

export function createEmptyBoard(): (string | null)[][] {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array.from({ length: BOARD_WIDTH }, () => null)
  );
}

export function getRandomTetrominoType(): TetrominoType {
  const types: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  return types[Math.floor(Math.random() * types.length)];
}

// 7-bag randomizer: shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Seeded shuffle using Fisher-Yates algorithm with a PRNG
function shuffleArraySeeded<T>(array: T[], rng: () => number): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Generate a new shuffled bag of all 7 tetromino types
export function generateBag(): TetrominoType[] {
  const types: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  return shuffleArray(types);
}

// Generate a new shuffled bag using seeded RNG
export function generateBagSeeded(rng: () => number): TetrominoType[] {
  const types: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  return shuffleArraySeeded(types, rng);
}

// Generate initial queue using 7-bag system (2 bags = 14 pieces)
export function generateInitialQueue(): Tetromino[] {
  const bag1 = generateBag();
  const bag2 = generateBag();
  const allTypes = [...bag1, ...bag2];
  return allTypes.slice(0, 5).map(type => createTetromino(type));
}

// Get next piece from bag, refill bag if empty
export function getNextFromBag(currentBag: TetrominoType[]): { piece: TetrominoType; newBag: TetrominoType[] } {
  if (currentBag.length === 0) {
    const newBag = generateBag();
    return { piece: newBag[0], newBag: newBag.slice(1) };
  }
  return { piece: currentBag[0], newBag: currentBag.slice(1) };
}

export function createTetromino(type: TetrominoType): Tetromino {
  const shape = TETROMINO_SHAPES[type].map(row => [...row]);
  return {
    type,
    shape,
    position: {
      x: Math.floor((BOARD_WIDTH - shape[0].length) / 2),
      y: 0,
    },
    color: TETROMINO_COLORS[type],
    rotationState: 0,
  };
}

export function rotateTetromino(tetromino: Tetromino, clockwise: boolean = true): Tetromino {
  const { shape } = tetromino;
  const n = shape.length;
  const rotated = Array.from({ length: n }, () => Array(n).fill(0));
  
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (clockwise) {
        rotated[x][n - 1 - y] = shape[y][x];
      } else {
        rotated[n - 1 - x][y] = shape[y][x];
      }
    }
  }
  
  return { ...tetromino, shape: rotated };
}

export function isValidPosition(
  board: (string | null)[][],
  tetromino: Tetromino
): boolean {
  const { shape, position } = tetromino;
  
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) {
        const boardX = position.x + x;
        const boardY = position.y + y;
        
        if (
          boardX < 0 ||
          boardX >= BOARD_WIDTH ||
          boardY >= BOARD_HEIGHT ||
          (boardY >= 0 && board[boardY][boardX])
        ) {
          return false;
        }
      }
    }
  }
  
  return true;
}

export function placeTetromino(
  board: (string | null)[][],
  tetromino: Tetromino
): (string | null)[][] {
  const newBoard = board.map(row => [...row]);
  const { shape, position, color } = tetromino;
  
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) {
        const boardY = position.y + y;
        const boardX = position.x + x;
        if (boardY >= 0 && boardY < BOARD_HEIGHT) {
          newBoard[boardY][boardX] = color;
        }
      }
    }
  }
  
  return newBoard;
}

export function findCompletedLines(board: (string | null)[][]): number[] {
  const completedLines: number[] = [];
  
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    if (board[y].every(cell => cell !== null)) {
      completedLines.push(y);
    }
  }
  
  return completedLines;
}

export type GameEngine = 'gravity' | 'classic' | 'sand';

export function clearLines(
  board: (string | null)[][],
  lines: number[],
  engine: GameEngine = 'gravity'
): ClearResult {
  const clearedLines: ClearedLine[] = [];
  const preClearBoard = board.map(row => [...row]);
  
  // Record cleared lines info
  for (const row of lines) {
    clearedLines.push({
      row,
      cells: board[row].map((color, x) => ({
        x,
        y: row,
        color: color || '#fff',
      })),
    });
  }
  
  // Step 1: Create a map of where each block was before clearing
  // Key: column (x), Value: array of { oldY, color } sorted from bottom to top
  const columnBlocks: Map<number, { oldY: number; color: string }[]> = new Map();
  
  for (let x = 0; x < BOARD_WIDTH; x++) {
    const blocks: { oldY: number; color: string }[] = [];
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
      // Skip blocks in cleared lines
      if (lines.includes(y)) continue;
      
      const color = board[y][x];
      if (color) {
        blocks.push({ oldY: y, color });
      }
    }
    columnBlocks.set(x, blocks);
  }
  
  // Step 2: Filter out cleared lines and add empty rows at top
  // This is the traditional block game behavior - rows shift down as a unit
  const newBoard = board.filter((_, index) => !lines.includes(index));
  while (newBoard.length < BOARD_HEIGHT) {
    newBoard.unshift(Array(BOARD_WIDTH).fill(null));
  }
  
  // Step 3: Apply gravity based on engine type
  // Classic: rows shift down as a unit (already done by filter+unshift) - traditional style
  // Gravity: individual blocks fall to fill gaps - Puyo Puyo style
  const finalBoard = engine === 'gravity' ? applyGravity(newBoard) : newBoard;
  
  // Step 4: Calculate displacements by matching blocks in each column
  const displacements: BlockDisplacement[] = [];
  
  // Only calculate displacements for gravity engine (classic has instant row shifts)
  if (engine === 'gravity') {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const originalBlocks = columnBlocks.get(x) || [];
      
      // Get new positions for blocks in this column (bottom to top)
      const newPositions: number[] = [];
      for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
        if (finalBoard[y][x]) {
          newPositions.push(y);
        }
      }
      
      // Match original blocks to new positions
      // Since blocks maintain relative order within columns, we can match by index
      for (let i = 0; i < originalBlocks.length && i < newPositions.length; i++) {
        const block = originalBlocks[i];
        const newY = newPositions[i];
        
        if (block.oldY !== newY) {
          displacements.push({
            x,
            oldY: block.oldY,
            newY,
            color: block.color,
          });
        }
      }
    }
  }
  
  return { board: finalBoard, clearedLines, displacements, preClearBoard };
}

// Apply gravity - blocks fall down to fill empty spaces below them
export function applyGravity(board: (string | null)[][]): (string | null)[][] {
  const newBoard = board.map(row => [...row]);
  
  // Process each column independently
  for (let x = 0; x < BOARD_WIDTH; x++) {
    // Collect all blocks in this column from bottom to top
    const blocks: (string | null)[] = [];
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
      if (newBoard[y][x] !== null) {
        blocks.push(newBoard[y][x]);
      }
    }
    
    // Clear the column
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      newBoard[y][x] = null;
    }
    
    // Place blocks at the bottom of the column
    for (let i = 0; i < blocks.length; i++) {
      newBoard[BOARD_HEIGHT - 1 - i][x] = blocks[i];
    }
  }
  
  return newBoard;
}

// ============= FALLING SAND PHYSICS ENGINE =============
// Simulates sand-like particle physics where blocks can:
// 1. Fall straight down if empty below
// 2. Slide diagonally down-left or down-right if blocked below
// 3. Form natural slopes/piles

// Check if a cell is empty (within bounds)
function isCellEmpty(board: (string | null)[][], x: number, y: number): boolean {
  if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) {
    return false; // Out of bounds = not empty (acts as wall)
  }
  return board[y][x] === null;
}

// Simulate one step of sand physics for a single particle
// Returns true if the particle moved
function simulateSandParticle(board: (string | null)[][], x: number, y: number): boolean {
  const color = board[y][x];
  if (color === null) return false;
  
  // Already at bottom
  if (y >= BOARD_HEIGHT - 1) return false;
  
  // Rule 1: Fall straight down if empty below
  if (isCellEmpty(board, x, y + 1)) {
    board[y][x] = null;
    board[y + 1][x] = color;
    return true;
  }
  
  // Rule 2: Try to slide diagonally if blocked below
  // Randomly choose left or right first for natural randomness
  const goLeftFirst = Math.random() < 0.5;
  
  const leftEmpty = isCellEmpty(board, x - 1, y + 1);
  const rightEmpty = isCellEmpty(board, x + 1, y + 1);
  
  if (goLeftFirst) {
    if (leftEmpty) {
      board[y][x] = null;
      board[y + 1][x - 1] = color;
      return true;
    }
    if (rightEmpty) {
      board[y][x] = null;
      board[y + 1][x + 1] = color;
      return true;
    }
  } else {
    if (rightEmpty) {
      board[y][x] = null;
      board[y + 1][x + 1] = color;
      return true;
    }
    if (leftEmpty) {
      board[y][x] = null;
      board[y + 1][x - 1] = color;
      return true;
    }
  }
  
  // No movement possible - particle is settled
  return false;
}

// Run one full pass of sand simulation (bottom-up for proper settling)
// Returns true if any particle moved
function runSandSimulationStep(board: (string | null)[][]): boolean {
  let anyMoved = false;
  
  // Process from bottom to top, so falling particles don't interfere
  for (let y = BOARD_HEIGHT - 2; y >= 0; y--) {
    // Randomize horizontal order for more natural spread
    const xOrder = Array.from({ length: BOARD_WIDTH }, (_, i) => i);
    for (let i = xOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [xOrder[i], xOrder[j]] = [xOrder[j], xOrder[i]];
    }
    
    for (const x of xOrder) {
      if (board[y][x] !== null) {
        if (simulateSandParticle(board, x, y)) {
          anyMoved = true;
        }
      }
    }
  }
  
  return anyMoved;
}

// Apply full sand physics simulation until all particles settle
// maxIterations prevents infinite loops
export function applySandPhysics(board: (string | null)[][], maxIterations: number = 100): (string | null)[][] {
  const newBoard = board.map(row => [...row]);
  
  let iterations = 0;
  while (iterations < maxIterations) {
    const moved = runSandSimulationStep(newBoard);
    if (!moved) break;
    iterations++;
  }
  
  return newBoard;
}

// Place tetromino cells as individual sand particles
// For now, use simple column-based dropping until 3D physics is implemented
export function placeSandParticles(board: (string | null)[][], piece: Tetromino): (string | null)[][] {
  const newBoard = board.map(row => [...row]);
  
  // Extract all cells from the tetromino with their absolute positions
  const cells: { x: number; color: string }[] = [];
  for (let py = 0; py < piece.shape.length; py++) {
    for (let px = 0; px < piece.shape[py].length; px++) {
      if (piece.shape[py][px]) {
        const x = piece.position.x + px;
        if (x >= 0 && x < BOARD_WIDTH) {
          cells.push({ x, color: piece.color });
        }
      }
    }
  }
  
  // Drop each cell to the lowest empty position in its column
  for (const cell of cells) {
    const x = cell.x;
    
    // Find lowest empty position in this column
    let targetY = -1;
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
      if (newBoard[y][x] === null) {
        targetY = y;
        break;
      }
    }
    
    // Place the cell if we found an empty spot
    if (targetY >= 0) {
      newBoard[targetY][x] = cell.color;
    }
  }
  
  // Apply sand physics to spread out the cells
  let iterations = 0;
  while (iterations < 100) {
    if (!runSandSimulationStep(newBoard)) break;
    iterations++;
  }
  
  return newBoard;
}

// Apply just a few steps of sand physics (for animation purposes)
export function applySandPhysicsSteps(board: (string | null)[][], steps: number): { board: (string | null)[][], settled: boolean } {
  const newBoard = board.map(row => [...row]);
  
  let settled = false;
  for (let i = 0; i < steps; i++) {
    const moved = runSandSimulationStep(newBoard);
    if (!moved) {
      settled = true;
      break;
    }
  }
  
  return { board: newBoard, settled };
}

export interface ScoreResult {
  score: number;
  actionType: ScoreActionType;
  isB2BEligible: boolean;  // T-Spin or Tetris
  wasB2BApplied: boolean;  // True if B2B bonus was actually applied to this score
}

export function calculateScore(
  linesCleared: number, 
  level: number, 
  combo: number, 
  isTSpin: boolean = false, 
  isTSpinMini: boolean = false,
  backToBack: number = 0,
  isPerfectClear: boolean = false
): ScoreResult {
  // Standard Tetris combo formula: (combo-1) * 50 * level
  const comboBonus = combo > 1 ? (combo - 1) * 50 * level : 0;
  let base = 0;
  let actionType: ScoreActionType = null;
  let isB2BEligible = false;
  let wasB2BApplied = false;
  
  // T-Spin scoring (most valuable)
  if (isTSpin) {
    const tspinScores = [400, 800, 1200, 1600]; // 0, 1, 2, 3 lines
    base = tspinScores[linesCleared] || 0;
    isB2BEligible = linesCleared > 0;
    if (linesCleared === 0) actionType = 'tspin';
    else if (linesCleared === 1) actionType = 'tspin_single';
    else if (linesCleared === 2) actionType = 'tspin_double';
    else if (linesCleared === 3) actionType = 'tspin_triple';
  }
  // Mini T-Spin scoring
  else if (isTSpinMini) {
    const miniScores = [100, 200, 400]; // 0, 1, 2 lines
    base = miniScores[linesCleared] || 0;
    isB2BEligible = linesCleared > 0;
    actionType = 'tspin_mini';
  }
  // Normal line clear scoring
  else if (linesCleared > 0) {
    const baseScores = [0, 100, 300, 500, 800];
    base = baseScores[linesCleared] || 0;
    // Tetris (4 lines) is B2B eligible
    if (linesCleared === 4) {
      isB2BEligible = true;
      actionType = 'tetris';
    } else if (linesCleared === 1) actionType = 'single';
    else if (linesCleared === 2) actionType = 'double';
    else if (linesCleared === 3) actionType = 'triple';
  }
  
  // Apply Back-to-Back bonus (1.5x for consecutive difficult clears)
  // B2B only applies if we already had a B2B chain (backToBack > 0)
  if (isB2BEligible && backToBack > 0) {
    base = Math.floor(base * 1.5);
    wasB2BApplied = true;
  }
  
  // Level multiplier
  let totalScore = base * level + comboBonus;
  
  // Perfect Clear bonus (board completely empty) - don't override actionType
  if (isPerfectClear && linesCleared > 0) {
    const perfectClearBonus = 3500 * level;
    totalScore += perfectClearBonus;
    // Keep the original action type, UI will show Perfect Clear separately
  }
  
  return { score: totalScore, actionType, isB2BEligible, wasB2BApplied };
}

// Check if board is completely empty (for Perfect Clear)
export function isBoardEmpty(board: (string | null)[][]): boolean {
  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < board[y].length; x++) {
      if (board[y][x] !== null) return false;
    }
  }
  return true;
}

export function getDropSpeed(level: number): number {
  return Math.max(100, 1000 - (level - 1) * 100);
}

export function getGhostPosition(
  board: (string | null)[][],
  tetromino: Tetromino
): Tetromino {
  let ghost = { ...tetromino, position: { ...tetromino.position } };
  
  while (isValidPosition(board, { ...ghost, position: { ...ghost.position, y: ghost.position.y + 1 } })) {
    ghost.position.y++;
  }
  
  return ghost;
}

export function createVisibilityBoard(): number[][] {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array.from({ length: BOARD_WIDTH }, () => 1)
  );
}

export function createInitialGameState(mode: GameMode = 'marathon', difficulty?: GameDifficulty): GameState {
  const config = GAME_MODE_CONFIGS[mode];
  // 7-bag randomizer: generate 2 bags (14 pieces) to ensure enough variety
  const bag1 = generateBag();
  const bag2 = generateBag();
  const allPieces = [...bag1, ...bag2];
  // Use first 6 pieces: 1 for current, 5 for queue
  const currentType = allPieces[0];
  const queueTypes = allPieces.slice(1, 6);
  const remainingBag = allPieces.slice(6);  // Remaining pieces in bag
  
  const initialQueue = queueTypes.map(type => createTetromino(type));
  return {
    board: createEmptyBoard(),
    currentPiece: createTetromino(currentType),
    nextPiece: initialQueue[0],
    pieceQueue: initialQueue,
    pieceBag: remainingBag,
    holdPiece: null,
    canHold: true,
    score: 0,
    level: 1,
    linesCleared: 0,
    piecesPlaced: 0,
    isGameOver: false,
    isVictory: false,
    isPaused: false,
    combo: 0,
    backToBack: 0,
    wasB2BApplied: false,
    lastActionType: null,
    lastScoreGain: 0,
    isPerfectClear: false,
    lastClearedLines: [],
    blockDisplacements: [],
    preClearBoard: null,
    landingX: null,
    isLastMoveRotation: false,
    isTSpin: false,
    isTSpinMini: false,
    animationPhase: 'idle',
    physicsFallingBlocks: [],
    pendingClears: [],
    cascadeCount: 0,
    fallStartTime: 0,
    gameMode: mode,
    timeRemaining: config.targetTime || 0,
    difficulty,
    garbageCleared: 0,
    garbageQueue: 0,
    zoneEnergy: 0,
    zoneMaxEnergy: 100,
    isZoneActive: false,
    zoneTimeRemaining: 0,
    zoneActivations: 0,
    visibilityBoard: createVisibilityBoard(),
    showGhost: difficulty !== 'no_ghost',
    attackIntensity: 1,
    bumpDirection: null,
    bumpTimestamp: 0,
    lastLandedPiece: null,
  };
}

// Create initial game state with seeded RNG for synchronized multiplayer
export function createSeededGameState(rng: () => number, mode: GameMode = 'marathon', difficulty?: GameDifficulty): GameState {
  const config = GAME_MODE_CONFIGS[mode];
  // 7-bag randomizer with seeded RNG: generate 2 bags (14 pieces) to ensure enough variety
  const bag1 = generateBagSeeded(rng);
  const bag2 = generateBagSeeded(rng);
  const allPieces = [...bag1, ...bag2];
  // Use first 6 pieces: 1 for current, 5 for queue
  const currentType = allPieces[0];
  const queueTypes = allPieces.slice(1, 6);
  const remainingBag = allPieces.slice(6);  // Remaining pieces in bag
  
  const initialQueue = queueTypes.map(type => createTetromino(type));
  return {
    board: createEmptyBoard(),
    currentPiece: createTetromino(currentType),
    nextPiece: initialQueue[0],
    pieceQueue: initialQueue,
    pieceBag: remainingBag,
    holdPiece: null,
    canHold: true,
    score: 0,
    level: 1,
    linesCleared: 0,
    piecesPlaced: 0,
    isGameOver: false,
    isVictory: false,
    isPaused: false,
    combo: 0,
    backToBack: 0,
    wasB2BApplied: false,
    lastActionType: null,
    lastScoreGain: 0,
    isPerfectClear: false,
    lastClearedLines: [],
    blockDisplacements: [],
    preClearBoard: null,
    landingX: null,
    isLastMoveRotation: false,
    isTSpin: false,
    isTSpinMini: false,
    animationPhase: 'idle',
    physicsFallingBlocks: [],
    pendingClears: [],
    cascadeCount: 0,
    fallStartTime: 0,
    gameMode: mode,
    timeRemaining: config.targetTime || 0,
    difficulty,
    garbageCleared: 0,
    garbageQueue: 0,
    zoneEnergy: 0,
    zoneMaxEnergy: 100,
    isZoneActive: false,
    zoneTimeRemaining: 0,
    zoneActivations: 0,
    visibilityBoard: createVisibilityBoard(),
    showGhost: difficulty !== 'no_ghost',
    attackIntensity: 1,
    bumpDirection: null,
    bumpTimestamp: 0,
    lastLandedPiece: null,
  };
}

export function generateGarbageLine(): (string | null)[] {
  const garbageColor = '#666666';
  const gap = Math.floor(Math.random() * BOARD_WIDTH);
  return Array.from({ length: BOARD_WIDTH }, (_, x) => 
    x === gap ? null : garbageColor
  );
}

export function addGarbageLines(board: (string | null)[][], count: number): (string | null)[][] {
  const newBoard = [...board];
  for (let i = 0; i < count; i++) {
    newBoard.shift();
    newBoard.push(generateGarbageLine());
  }
  return newBoard;
}

export function addGarbageLinesFromTop(board: (string | null)[][], count: number): (string | null)[][] {
  const newBoard = [...board];
  for (let i = 0; i < count; i++) {
    newBoard.pop();
    newBoard.unshift(generateGarbageLine());
  }
  return newBoard;
}

export function getMasterModeSpeed(level: number): number {
  if (level >= 1) return 16;
  return 16;
}

export function getZoneDropSpeed(): number {
  return 10000;
}

export function removeBottomRow(board: (string | null)[][], engine: GameEngine = 'gravity'): {
  board: (string | null)[][];
  clearedLine: ClearedLine | null;
  displacements: BlockDisplacement[];
  preClearBoard: (string | null)[][] | null;
} {
  const bottomRow = BOARD_HEIGHT - 1;
  const hasBlocks = board[bottomRow].some(cell => cell !== null);
  
  if (!hasBlocks) {
    return { board, clearedLine: null, displacements: [], preClearBoard: null };
  }
  
  const preClearBoard = board.map(row => [...row]);
  
  const clearedLine: ClearedLine = {
    row: bottomRow,
    cells: board[bottomRow].map((color, x) => ({
      x,
      y: bottomRow,
      color: color || '#fff',
    })),
  };
  
  // Track blocks before removal (excluding bottom row)
  const columnBlocks: Map<number, { oldY: number; color: string }[]> = new Map();
  for (let x = 0; x < BOARD_WIDTH; x++) {
    const blocks: { oldY: number; color: string }[] = [];
    for (let y = BOARD_HEIGHT - 2; y >= 0; y--) {  // Start from row above bottom
      const color = board[y][x];
      if (color) {
        blocks.push({ oldY: y, color });
      }
    }
    columnBlocks.set(x, blocks);
  }
  
  const newBoard = board.filter((_, index) => index !== bottomRow);
  newBoard.unshift(Array(BOARD_WIDTH).fill(null));
  
  // Apply gravity based on engine type
  // Classic: rows shift down as a unit (traditional style)
  // Gravity: individual blocks fall to fill gaps (Puyo Puyo style)
  const finalBoard = engine === 'gravity' ? applyGravity(newBoard) : newBoard;
  
  // Calculate displacements only for gravity engine (classic has instant row shifts)
  const displacements: BlockDisplacement[] = [];
  if (engine === 'gravity') {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const originalBlocks = columnBlocks.get(x) || [];
      const newPositions: number[] = [];
      for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
        if (finalBoard[y][x]) {
          newPositions.push(y);
        }
      }
      
      for (let i = 0; i < originalBlocks.length && i < newPositions.length; i++) {
        const block = originalBlocks[i];
        const newY = newPositions[i];
        if (block.oldY !== newY) {
          displacements.push({
            x,
            oldY: block.oldY,
            newY,
            color: block.color,
          });
        }
      }
    }
  }
  
  return { board: finalBoard, clearedLine, displacements, preClearBoard };
}

// Sand Mode specific functions

// Find rows where all cells have the same color (for sand mode)
export function findSameColorLines(board: (string | null)[][]): { row: number; color: string }[] {
  const sameColorLines: { row: number; color: string }[] = [];
  
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    const firstColor = board[y][0];
    if (firstColor !== null) {
      let allSameColor = true;
      for (let x = 1; x < BOARD_WIDTH; x++) {
        if (board[y][x] !== firstColor) {
          allSameColor = false;
          break;
        }
      }
      if (allSameColor) {
        sameColorLines.push({ row: y, color: firstColor });
      }
    }
  }
  
  return sameColorLines;
}

// Clear same-color lines in sand mode
export function clearSandLines(
  board: (string | null)[][],
  lines: { row: number; color: string }[]
): ClearResult {
  const lineRows = lines.map(l => l.row);
  const clearedLines: ClearedLine[] = [];
  const preClearBoard = board.map(row => [...row]);
  
  // Record cleared lines info
  for (const { row, color } of lines) {
    clearedLines.push({
      row,
      cells: board[row].map((_, x) => ({
        x,
        y: row,
        color: color,
      })),
    });
  }
  
  // Track blocks before clearing
  const columnBlocks: Map<number, { oldY: number; color: string }[]> = new Map();
  
  for (let x = 0; x < BOARD_WIDTH; x++) {
    const blocks: { oldY: number; color: string }[] = [];
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
      if (lineRows.includes(y)) continue;
      
      const color = board[y][x];
      if (color) {
        blocks.push({ oldY: y, color });
      }
    }
    columnBlocks.set(x, blocks);
  }
  
  // Remove cleared lines and add empty rows at top
  const newBoard = board.filter((_, index) => !lineRows.includes(index));
  while (newBoard.length < BOARD_HEIGHT) {
    newBoard.unshift(Array(BOARD_WIDTH).fill(null));
  }
  
  // Apply gravity (sand particles fall)
  const finalBoard = applyGravity(newBoard);
  
  // Calculate displacements
  const displacements: BlockDisplacement[] = [];
  for (let x = 0; x < BOARD_WIDTH; x++) {
    const originalBlocks = columnBlocks.get(x) || [];
    const newPositions: number[] = [];
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
      if (finalBoard[y][x]) {
        newPositions.push(y);
      }
    }
    
    for (let i = 0; i < originalBlocks.length && i < newPositions.length; i++) {
      const block = originalBlocks[i];
      const newY = newPositions[i];
      if (block.oldY !== newY) {
        displacements.push({
          x,
          oldY: block.oldY,
          newY,
          color: block.color,
        });
      }
    }
  }
  
  return { board: finalBoard, clearedLines, displacements, preClearBoard };
}
