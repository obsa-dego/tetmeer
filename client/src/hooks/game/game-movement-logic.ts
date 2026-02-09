import {
  GameState,
  isValidPosition,
  rotateTetromino,
  getWallKicks,
  RotationState,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  removeBottomRow as removeBottomRowEngine,
  GameEngine,
  createTetromino,
} from '@/lib/game-engine';

export function moveDownState(
  state: GameState,
  lockFn: (state: GameState) => GameState,
): GameState {
  if (state.isGameOver || state.isPaused || !state.currentPiece || state.animationPhase !== 'idle') return state;

  const newPosition = {
    ...state.currentPiece.position,
    y: state.currentPiece.position.y + 1,
  };

  const movedPiece = { ...state.currentPiece, position: newPosition };

  if (isValidPosition(state.board, movedPiece)) {
    return {
      ...state,
      currentPiece: movedPiece,
      score: state.score + 1,
      isLastMoveRotation: false,
      isTSpin: false,
      isTSpinMini: false,
    };
  }

  return lockFn(state);
}

export function moveLeftState(state: GameState): GameState {
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
      isTSpinMini: false,
    };
  }

  return { ...state, bumpDirection: 'left' as const, bumpTimestamp: Date.now() };
}

export function moveRightState(state: GameState): GameState {
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
      isTSpinMini: false,
    };
  }

  return { ...state, bumpDirection: 'right' as const, bumpTimestamp: Date.now() };
}

export function rotateState(state: GameState, clockwise: boolean): GameState {
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
        y: rotatedWithState.position.y + kick.y,
      },
    };

    if (isValidPosition(state.board, kickedPiece)) {
      let isTSpin = false;
      let isTSpinMini = false;
      if (state.currentPiece?.type === 'T') {
        const { x, y } = kickedPiece.position;
        const corners = [
          { x: x, y: y },
          { x: x + 2, y: y },
          { x: x, y: y + 2 },
          { x: x + 2, y: y + 2 },
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
          isTSpin = true;
        }
      }

      return {
        ...state,
        currentPiece: kickedPiece,
        isLastMoveRotation: true,
        isTSpin,
        isTSpinMini,
      };
    }
  }

  return { ...state, bumpDirection: 'rotate' as const, bumpTimestamp: Date.now() };
}

export function hardDropState(
  state: GameState,
  lockFn: (state: GameState) => GameState,
): GameState {
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
    isLastMoveRotation: false,
  };

  return lockFn(stateWithDrop);
}

export function holdPieceState(
  state: GameState,
  spawnFn: (state: GameState) => GameState,
): GameState {
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

  return spawnFn({
    ...state,
    holdPiece: createTetromino(currentType),
    canHold: false,
    currentPiece: null,
  });
}

export function removeBottomRowState(state: GameState, engine: GameEngine): GameState {
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
}
