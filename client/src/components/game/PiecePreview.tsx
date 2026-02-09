import { Tetromino, TETROMINO_SHAPES, TETROMINO_COLORS, TetrominoType } from '@/lib/game-engine';

interface PiecePreviewProps {
  piece: Tetromino | null;
  label?: string;
  size?: 'sm' | 'md';
  compact?: boolean;
}

export function PiecePreview({ piece, label, size = 'md', compact = false }: PiecePreviewProps) {
  const blockSize = compact ? 8 : size === 'sm' ? 12 : 16;
  const shape = piece ? piece.shape : null;
  const color = piece ? piece.color : null;

  const gridSize = 4;
  const previewSize = gridSize * blockSize;

  if (compact) {
    return (
      <div className="flex items-center gap-2 backdrop-blur-md bg-card/80 rounded-lg px-2 py-1 border border-white/10">
        {label && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-8">
            {label}
          </span>
        )}
        <div 
          className="flex items-center justify-center"
          style={{ width: previewSize, height: previewSize }}
        >
          {shape ? (
            <div 
              className="grid gap-px"
              style={{
                gridTemplateColumns: `repeat(${shape[0].length}, ${blockSize}px)`,
              }}
            >
              {shape.map((row, y) =>
                row.map((cell, x) => (
                  <div
                    key={`${y}-${x}`}
                    className="rounded-sm"
                    style={{
                      width: blockSize,
                      height: blockSize,
                      backgroundColor: cell ? color || '#fff' : 'transparent',
                    }}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="text-muted-foreground/50 text-[10px]">-</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </span>
      )}
      <div 
        className="flex items-center justify-center"
        style={{ width: previewSize, height: previewSize }}
      >
        {shape ? (
          <div 
            className="grid gap-px"
            style={{
              gridTemplateColumns: `repeat(${shape[0].length}, ${blockSize}px)`,
            }}
          >
            {shape.map((row, y) =>
              row.map((cell, x) => (
                <div
                  key={`${y}-${x}`}
                  className="rounded-sm transition-all duration-150"
                  style={{
                    width: blockSize,
                    height: blockSize,
                    backgroundColor: cell ? color || '#fff' : 'transparent',
                    boxShadow: cell ? `0 0 8px ${color}40` : 'none',
                  }}
                />
              ))
            )}
          </div>
        ) : (
          <div className="text-muted-foreground/50 text-xs">-</div>
        )}
      </div>
    </div>
  );
}
