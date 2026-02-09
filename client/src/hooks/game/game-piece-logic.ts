import {
  GameState,
  GameEngine,
  GAME_MODE_CONFIGS,
  DIFFICULTY_CONFIGS,
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
  clearSandLines as clearSandLinesEngine,
  calculateScore,
  isBoardEmpty,
  placeSandParticles,
  Tetromino,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  AnimationPhase,
} from '@/lib/game-engine';

export function spawnNewPiece(
  state: GameState,
  seededRng: (() => number) | null,
): GameState {
  const newPiece = state.pieceQueue[0] || state.nextPiece || createTetromino(getRandomTetrominoType());

  let currentBag = state.pieceBag || [];
  if (currentBag.length === 0) {
    currentBag = seededRng ? generateBagSeeded(seededRng) : generateBag();
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
    piecesPlaced: state.piecesPlaced + 1,
  };
}

export function checkModeVictory(state: GameState): { isVictory: boolean; isGameOver: boolean } {
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
    case 'zen':
    case 'dig':
    case 'survival':
    case 'invisible':
    case 'zone':
      break;
    case 'master':
      if (state.level >= (config.maxLevel || 1000)) {
        return { isVictory: true, isGameOver: true };
      }
      break;
  }
  return { isVictory: false, isGameOver: false };
}

export function lockPiece(
  state: GameState,
  engine: GameEngine,
  updateVisibilityFn: (state: GameState, tetromino: Tetromino) => number[][],
  spawnFn: (state: GameState) => GameState,
): GameState {
  if (!state.currentPiece) return state;

  let newBoard: (string | null)[][];

  if (engine === 'sand') {
    newBoard = placeSandParticles(state.board, state.currentPiece);
  } else {
    newBoard = placeTetromino(state.board, state.currentPiece);
  }

  const updatedVisibility = updateVisibilityFn(state, state.currentPiece);

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
    const isPerfectClear = isBoardEmpty(clearedBoard);

    const scoreResult = calculateScore(
      linesToClear.length,
      state.level,
      newCombo,
      state.isTSpin,
      state.isTSpinMini,
      state.backToBack,
      isPerfectClear
    );

    let newBackToBack = state.backToBack;
    if (scoreResult.isB2BEligible) {
      newBackToBack = state.backToBack + 1;
    } else if (linesToClear.length > 0) {
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
      animationPhase: engine === 'classic' ? 'idle' : 'shaking',
      physicsFallingBlocks: [],
      cascadeCount: state.cascadeCount,
      lastLandedPiece: state.currentPiece,
    };

    const victoryCheck = checkModeVictory(stateWithClearedLines);
    if (victoryCheck.isVictory) {
      return { ...stateWithClearedLines, isVictory: true, isGameOver: true, animationPhase: 'idle' };
    }

    if (engine === 'classic') {
      return spawnFn(stateWithClearedLines);
    }

    return stateWithClearedLines;
  }

  return spawnFn({
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
}
