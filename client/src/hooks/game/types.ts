import type { GameState, GameMode, GameDifficulty, GameEngine } from '@/lib/game-engine';

export interface UseGameOptions {
  disableKeyHandlers?: boolean;
  disableAutoFall?: boolean;
}

export interface UseBlockGameReturn {
  gameState: GameState;
  startTime: number | null;
  playTimeRef: React.MutableRefObject<number>;
  currentMode: GameMode;
  currentDifficulty: GameDifficulty | undefined;
  isAnimating: boolean;
  startGame: (mode?: GameMode, difficulty?: GameDifficulty) => void;
  startSeededGame: (seed: string, mode?: GameMode, difficulty?: GameDifficulty) => void;
  resetGame: () => void;
  moveLeft: () => void;
  moveRight: () => void;
  moveDown: () => void;
  rotate: () => void;
  rotateLeft: () => void;
  rotateRight: () => void;
  hardDrop: () => void;
  holdPiece: () => void;
  togglePause: () => void;
  removeBottomRow: () => void;
  activateZone: () => void;
}
