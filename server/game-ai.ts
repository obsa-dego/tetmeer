// Block Game AI using heuristic-based evaluation
// Evaluates all possible placements and chooses the best one
import seedrandom from 'seedrandom';

export interface GameBoard {
  grid: number[][]; // 0 = empty, 1+ = filled
  width: number;
  height: number;
}

export interface GamePiece {
  shape: number[][];
  x: number;
  y: number;
}

export interface AIMove {
  rotation: number; // 0-3
  x: number;        // target column
  hardDrop: boolean;
}

export type AIDifficulty = "easy" | "normal" | "hard" | "expert";

// Piece shapes (all 7 tetrominos)
const TETROMINOS: { [key: string]: number[][][] } = {
  I: [
    [[1,1,1,1]],
    [[1],[1],[1],[1]],
    [[1,1,1,1]],
    [[1],[1],[1],[1]],
  ],
  O: [
    [[1,1],[1,1]],
    [[1,1],[1,1]],
    [[1,1],[1,1]],
    [[1,1],[1,1]],
  ],
  T: [
    [[0,1,0],[1,1,1]],
    [[1,0],[1,1],[1,0]],
    [[1,1,1],[0,1,0]],
    [[0,1],[1,1],[0,1]],
  ],
  S: [
    [[0,1,1],[1,1,0]],
    [[1,0],[1,1],[0,1]],
    [[0,1,1],[1,1,0]],
    [[1,0],[1,1],[0,1]],
  ],
  Z: [
    [[1,1,0],[0,1,1]],
    [[0,1],[1,1],[1,0]],
    [[1,1,0],[0,1,1]],
    [[0,1],[1,1],[1,0]],
  ],
  J: [
    [[1,0,0],[1,1,1]],
    [[1,1],[1,0],[1,0]],
    [[1,1,1],[0,0,1]],
    [[0,1],[0,1],[1,1]],
  ],
  L: [
    [[0,0,1],[1,1,1]],
    [[1,0],[1,0],[1,1]],
    [[1,1,1],[1,0,0]],
    [[1,1],[0,1],[0,1]],
  ],
};

// Difficulty settings
const DIFFICULTY_CONFIG: Record<AIDifficulty, {
  mistakeRate: number;      // 0-1, probability of making suboptimal move
  evaluationDepth: number;  // How many pieces ahead to consider
  moveDelay: number;        // ms between moves
  targetLinesPerMinute: number;
}> = {
  easy: { mistakeRate: 0.3, evaluationDepth: 1, moveDelay: 500, targetLinesPerMinute: 15 },
  normal: { mistakeRate: 0.15, evaluationDepth: 1, moveDelay: 350, targetLinesPerMinute: 25 },
  hard: { mistakeRate: 0.05, evaluationDepth: 2, moveDelay: 200, targetLinesPerMinute: 40 },
  expert: { mistakeRate: 0.01, evaluationDepth: 2, moveDelay: 100, targetLinesPerMinute: 60 },
};

// Heuristic weights for board evaluation
interface HeuristicWeights {
  aggregateHeight: number;
  completeLines: number;
  holes: number;
  bumpiness: number;
  wellDepth: number;
}

const WEIGHTS: HeuristicWeights = {
  aggregateHeight: -0.510066,
  completeLines: 0.760666,
  holes: -0.35663,
  bumpiness: -0.184483,
  wellDepth: -0.1,
};

export class GameAI {
  private difficulty: AIDifficulty;
  private config: typeof DIFFICULTY_CONFIG["normal"];
  
  constructor(difficulty: AIDifficulty = "normal") {
    this.difficulty = difficulty;
    this.config = DIFFICULTY_CONFIG[difficulty];
  }

  // Get the best move for a given board state and piece
  getBestMove(board: GameBoard, pieceType: string): AIMove {
    const rotations = TETROMINOS[pieceType];
    if (!rotations) {
      return { rotation: 0, x: Math.floor(board.width / 2), hardDrop: true };
    }

    let bestMove: AIMove = { rotation: 0, x: 0, hardDrop: true };
    let bestScore = -Infinity;
    const allMoves: { move: AIMove; score: number }[] = [];

    // Try all rotations and positions
    for (let rotation = 0; rotation < rotations.length; rotation++) {
      const shape = rotations[rotation];
      const pieceWidth = shape[0].length;
      
      for (let x = 0; x <= board.width - pieceWidth; x++) {
        const move: AIMove = { rotation, x, hardDrop: true };
        const score = this.evaluateMove(board, shape, x);
        
        allMoves.push({ move, score });
        
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }
    }

    // Apply mistake rate - sometimes choose a suboptimal move
    if (Math.random() < this.config.mistakeRate && allMoves.length > 1) {
      // Sort by score and pick from the worse moves
      allMoves.sort((a, b) => b.score - a.score);
      const randomIndex = Math.floor(Math.random() * Math.min(5, allMoves.length));
      bestMove = allMoves[randomIndex].move;
    }

    return bestMove;
  }

  // Evaluate a placement by simulating the drop
  private evaluateMove(board: GameBoard, shape: number[][], targetX: number): number {
    // Simulate dropping the piece
    const simulatedBoard = this.simulateDrop(board, shape, targetX);
    if (!simulatedBoard) return -Infinity;

    // Calculate heuristics
    const aggregateHeight = this.getAggregateHeight(simulatedBoard);
    const completeLines = this.getCompleteLines(simulatedBoard);
    const holes = this.getHoles(simulatedBoard);
    const bumpiness = this.getBumpiness(simulatedBoard);
    const wellDepth = this.getWellDepth(simulatedBoard);

    // Calculate weighted score
    return (
      WEIGHTS.aggregateHeight * aggregateHeight +
      WEIGHTS.completeLines * completeLines +
      WEIGHTS.holes * holes +
      WEIGHTS.bumpiness * bumpiness +
      WEIGHTS.wellDepth * wellDepth
    );
  }

  // Simulate dropping a piece and return the resulting board
  private simulateDrop(board: GameBoard, shape: number[][], targetX: number): GameBoard | null {
    const newGrid = board.grid.map(row => [...row]);
    const pieceHeight = shape.length;
    const pieceWidth = shape[0].length;

    // Find landing position
    let landingY = 0;
    for (let y = 0; y <= board.height - pieceHeight; y++) {
      if (!this.canPlace(newGrid, shape, targetX, y)) {
        landingY = y - 1;
        break;
      }
      landingY = y;
    }

    if (landingY < 0) return null;

    // Place the piece
    for (let py = 0; py < pieceHeight; py++) {
      for (let px = 0; px < pieceWidth; px++) {
        if (shape[py][px]) {
          if (landingY + py >= 0 && landingY + py < board.height) {
            newGrid[landingY + py][targetX + px] = 1;
          }
        }
      }
    }

    return { grid: newGrid, width: board.width, height: board.height };
  }

  // Check if piece can be placed at position
  private canPlace(grid: number[][], shape: number[][], x: number, y: number): boolean {
    for (let py = 0; py < shape.length; py++) {
      for (let px = 0; px < shape[py].length; px++) {
        if (shape[py][px]) {
          const boardX = x + px;
          const boardY = y + py;
          
          if (boardX < 0 || boardX >= grid[0].length) return false;
          if (boardY >= grid.length) return false;
          if (boardY >= 0 && grid[boardY][boardX]) return false;
        }
      }
    }
    return true;
  }

  // Heuristic: Sum of column heights
  private getAggregateHeight(board: GameBoard): number {
    let total = 0;
    for (let x = 0; x < board.width; x++) {
      total += this.getColumnHeight(board, x);
    }
    return total;
  }

  // Get height of a single column
  private getColumnHeight(board: GameBoard, x: number): number {
    for (let y = 0; y < board.height; y++) {
      if (board.grid[y][x]) {
        return board.height - y;
      }
    }
    return 0;
  }

  // Heuristic: Number of complete lines
  private getCompleteLines(board: GameBoard): number {
    let count = 0;
    for (let y = 0; y < board.height; y++) {
      if (board.grid[y].every(cell => cell !== 0)) {
        count++;
      }
    }
    return count;
  }

  // Heuristic: Number of holes (empty cells with filled cells above)
  private getHoles(board: GameBoard): number {
    let holes = 0;
    for (let x = 0; x < board.width; x++) {
      let foundBlock = false;
      for (let y = 0; y < board.height; y++) {
        if (board.grid[y][x]) {
          foundBlock = true;
        } else if (foundBlock) {
          holes++;
        }
      }
    }
    return holes;
  }

  // Heuristic: Sum of absolute differences between adjacent column heights
  private getBumpiness(board: GameBoard): number {
    let bumpiness = 0;
    for (let x = 0; x < board.width - 1; x++) {
      const h1 = this.getColumnHeight(board, x);
      const h2 = this.getColumnHeight(board, x + 1);
      bumpiness += Math.abs(h1 - h2);
    }
    return bumpiness;
  }

  // Heuristic: Depth of wells (columns significantly lower than neighbors)
  private getWellDepth(board: GameBoard): number {
    let wellDepth = 0;
    for (let x = 0; x < board.width; x++) {
      const height = this.getColumnHeight(board, x);
      const leftHeight = x > 0 ? this.getColumnHeight(board, x - 1) : board.height;
      const rightHeight = x < board.width - 1 ? this.getColumnHeight(board, x + 1) : board.height;
      
      const wellLeft = leftHeight - height;
      const wellRight = rightHeight - height;
      
      if (wellLeft > 0 && wellRight > 0) {
        wellDepth += Math.min(wellLeft, wellRight);
      }
    }
    return wellDepth;
  }

  // Get move delay based on difficulty
  getMoveDelay(): number {
    return this.config.moveDelay;
  }

  // Get target lines per minute based on difficulty
  getTargetLinesPerMinute(): number {
    return this.config.targetLinesPerMinute;
  }
}

// Movement phase for human-like animation
type MovementPhase = 'thinking' | 'rotating' | 'moving' | 'dropping' | 'locking';

// AI Game Simulator for server-side ranked matches
// Animates piece movement step-by-step like a human player
export class AIGameSimulator {
  private ai: GameAI;
  private board: GameBoard;
  private linesCleared: number = 0;
  private score: number = 0;
  private currentPiece: string = "";
  private nextPieces: string[] = [];
  private gameOver: boolean = false;
  private startTime: number = 0;
  private rng: () => number;  // Seeded RNG for synchronized piece generation
  
  // Animation state
  private phase: MovementPhase = 'thinking';
  private currentX: number = 3;
  private currentY: number = 0;
  private currentRotation: number = 0;
  private targetX: number = 0;
  private targetRotation: number = 0;
  private thinkingTicks: number = 0;
  private maxThinkingTicks: number = 3;
  
  private static readonly PIECE_TYPES = ["I", "O", "T", "S", "Z", "J", "L"];
  
  constructor(difficulty: AIDifficulty = "normal", gameSeed?: string) {
    this.ai = new GameAI(difficulty);
    this.board = {
      grid: Array(20).fill(null).map(() => Array(10).fill(0)),
      width: 10,
      height: 20,
    };
    // Initialize seeded RNG for synchronized piece generation
    this.rng = gameSeed ? seedrandom(gameSeed) : Math.random;
    // Set thinking time based on difficulty
    this.maxThinkingTicks = difficulty === 'easy' ? 5 : difficulty === 'normal' ? 3 : difficulty === 'hard' ? 2 : 1;
    this.refillBag();
    this.spawnNewPiece();
    this.startTime = Date.now();
  }

  // Refill the piece bag using 7-bag randomizer with seeded RNG
  private refillBag(): void {
    const bag = [...AIGameSimulator.PIECE_TYPES];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    this.nextPieces.push(...bag);
  }

  // Spawn a new piece and reset animation state
  private spawnNewPiece(): void {
    if (this.nextPieces.length < 7) {
      this.refillBag();
    }
    this.currentPiece = this.nextPieces.shift()!;
    this.currentX = 3;
    this.currentY = 0;
    this.currentRotation = 0;
    this.phase = 'thinking';
    this.thinkingTicks = 0;
    
    // Calculate target position
    const move = this.ai.getBestMove(this.board, this.currentPiece);
    this.targetX = move.x;
    this.targetRotation = move.rotation;
  }

  // Execute one animation tick (called frequently for smooth animation)
  makeMove(): { linesCleared: number; score: number; board: number[][]; gameOver: boolean } {
    if (this.gameOver) {
      return { 
        linesCleared: this.linesCleared, 
        score: this.score, 
        board: this.getBoardWithCurrentPiece(),
        gameOver: true 
      };
    }

    const shape = TETROMINOS[this.currentPiece]?.[this.currentRotation];
    if (!shape) {
      return this.getState();
    }

    switch (this.phase) {
      case 'thinking':
        // Simulate "thinking" time before moving
        this.thinkingTicks++;
        if (this.thinkingTicks >= this.maxThinkingTicks) {
          this.phase = 'rotating';
        }
        break;

      case 'rotating':
        // Rotate one step at a time
        if (this.currentRotation !== this.targetRotation) {
          this.currentRotation = (this.currentRotation + 1) % 4;
        } else {
          this.phase = 'moving';
        }
        break;

      case 'moving':
        // Move horizontally one step at a time
        if (this.currentX < this.targetX) {
          const newShape = TETROMINOS[this.currentPiece][this.currentRotation];
          if (this.canPlace(newShape, this.currentX + 1, this.currentY)) {
            this.currentX++;
          } else {
            this.phase = 'dropping';
          }
        } else if (this.currentX > this.targetX) {
          const newShape = TETROMINOS[this.currentPiece][this.currentRotation];
          if (this.canPlace(newShape, this.currentX - 1, this.currentY)) {
            this.currentX--;
          } else {
            this.phase = 'dropping';
          }
        } else {
          this.phase = 'dropping';
        }
        break;

      case 'dropping':
        // Drop one row at a time
        const currentShape = TETROMINOS[this.currentPiece][this.currentRotation];
        if (this.canPlace(currentShape, this.currentX, this.currentY + 1)) {
          this.currentY++;
        } else {
          this.phase = 'locking';
        }
        break;

      case 'locking':
        // Lock the piece in place
        this.lockPiece();
        break;
    }

    return { 
      linesCleared: this.linesCleared, 
      score: this.score, 
      board: this.getBoardWithCurrentPiece(),
      gameOver: this.gameOver 
    };
  }

  // Lock piece and clear lines
  private lockPiece(): void {
    const shape = TETROMINOS[this.currentPiece][this.currentRotation];
    
    // Check for game over
    if (this.currentY === 0 && !this.canPlace(shape, this.currentX, 0)) {
      this.gameOver = true;
      return;
    }

    // Place the piece on the board
    for (let py = 0; py < shape.length; py++) {
      for (let px = 0; px < shape[py].length; px++) {
        if (shape[py][px]) {
          const boardY = this.currentY + py;
          const boardX = this.currentX + px;
          if (boardY >= 0 && boardY < this.board.height && boardX >= 0 && boardX < this.board.width) {
            this.board.grid[boardY][boardX] = 1;
          }
        }
      }
    }

    // Clear lines
    const clearedLines = this.clearLines();
    this.linesCleared += clearedLines;
    
    // Calculate score
    const linePoints = [0, 100, 300, 500, 800];
    this.score += linePoints[clearedLines] || 0;

    // Spawn next piece
    this.spawnNewPiece();
  }

  // Get board with current falling piece rendered
  private getBoardWithCurrentPiece(): number[][] {
    const displayBoard = this.board.grid.map(row => [...row]);
    const shape = TETROMINOS[this.currentPiece]?.[this.currentRotation];
    
    if (shape && !this.gameOver) {
      for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[py].length; px++) {
          if (shape[py][px]) {
            const boardY = this.currentY + py;
            const boardX = this.currentX + px;
            if (boardY >= 0 && boardY < this.board.height && boardX >= 0 && boardX < this.board.width) {
              // Use 2 for the current falling piece to distinguish from locked pieces
              displayBoard[boardY][boardX] = 2;
            }
          }
        }
      }
    }
    
    return displayBoard;
  }

  private canPlace(shape: number[][], x: number, y: number): boolean {
    for (let py = 0; py < shape.length; py++) {
      for (let px = 0; px < shape[py].length; px++) {
        if (shape[py][px]) {
          const boardX = x + px;
          const boardY = y + py;
          
          if (boardX < 0 || boardX >= this.board.width) return false;
          if (boardY >= this.board.height) return false;
          if (boardY >= 0 && this.board.grid[boardY][boardX]) return false;
        }
      }
    }
    return true;
  }

  private clearLines(): number {
    let cleared = 0;
    for (let y = this.board.height - 1; y >= 0; y--) {
      if (this.board.grid[y].every(cell => cell !== 0)) {
        this.board.grid.splice(y, 1);
        this.board.grid.unshift(Array(this.board.width).fill(0));
        cleared++;
        y++;
      }
    }
    return cleared;
  }

  // Get current game state
  getState(): { linesCleared: number; score: number; board: number[][]; gameOver: boolean } {
    return {
      linesCleared: this.linesCleared,
      score: this.score,
      board: this.getBoardWithCurrentPiece(),
      gameOver: this.gameOver,
    };
  }

  // Get move delay - faster for smoother animation
  getMoveDelay(): number {
    // Use faster tick rate for smooth animation (100-200ms per tick)
    const baseDelay = this.ai.getMoveDelay();
    return Math.max(80, Math.floor(baseDelay / 3));
  }
}
