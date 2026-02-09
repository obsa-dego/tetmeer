import { createContext, useContext, useState, ReactNode } from 'react';
import { Tetromino } from '@/lib/game-engine';

interface GamePieces {
  holdPiece: Tetromino | null;
  nextPiece: Tetromino | null;
  pieceQueue: Tetromino[];
}

interface GameContextType {
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  gamePieces: GamePieces;
  setGamePieces: (pieces: GamePieces) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [gamePieces, setGamePieces] = useState<GamePieces>({
    holdPiece: null,
    nextPiece: null,
    pieceQueue: []
  });

  return (
    <GameContext.Provider value={{ isPlaying, setIsPlaying, gamePieces, setGamePieces }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
