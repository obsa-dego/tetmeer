import { useRef, useEffect, useMemo } from 'react';

interface GameState {
  board: (string | null)[][];
  currentPiece?: {
    type: string;
    shape: (boolean | string | null)[][];
    position: { x: number; y: number };
  } | null;
  isGameOver?: boolean;
}

interface OpponentBoard2DProps {
  gameState: GameState;
  width?: number;
  height?: number;
}

const PIECE_COLORS: Record<string, { main: string; light: string; dark: string }> = {
  I: { main: '#00f5ff', light: '#7fffff', dark: '#00a0aa' },
  O: { main: '#ffd700', light: '#ffed4a', dark: '#b89b00' },
  T: { main: '#9400d3', light: '#c44dff', dark: '#5a008a' },
  S: { main: '#00ff00', light: '#7fff7f', dark: '#00a000' },
  Z: { main: '#ff0000', light: '#ff7f7f', dark: '#a00000' },
  J: { main: '#0066ff', light: '#6699ff', dark: '#0044aa' },
  L: { main: '#ff8c00', light: '#ffb84d', dark: '#b86200' },
};

export default function OpponentBoard2D({ 
  gameState, 
  width = 240, 
  height = 480 
}: OpponentBoard2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const boardStr = useMemo(() => JSON.stringify(gameState?.board), [gameState?.board]);
  const pieceStr = useMemo(() => JSON.stringify(gameState?.currentPiece), [gameState?.currentPiece]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const board = gameState?.board || [];
    const currentPiece = gameState?.currentPiece;
    
    const rows = board.length || 20;
    const cols = board[0]?.length || 10;
    const cellWidth = width / cols;
    const cellHeight = height / rows;
    
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0a0a15');
    gradient.addColorStop(0.5, '#0f0f1a');
    gradient.addColorStop(1, '#0a0a15');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellWidth, 0);
      ctx.lineTo(x * cellWidth, height);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellHeight);
      ctx.lineTo(width, y * cellHeight);
      ctx.stroke();
    }
    
    const drawBlock = (x: number, y: number, type: string, alpha: number = 1) => {
      const colors = PIECE_COLORS[type] || { main: '#888888', light: '#aaaaaa', dark: '#555555' };
      const px = x * cellWidth;
      const py = y * cellHeight;
      const bw = cellWidth - 2;
      const bh = cellHeight - 2;
      
      ctx.globalAlpha = alpha;
      
      ctx.fillStyle = colors.main;
      ctx.fillRect(px + 1, py + 1, bw, bh);
      
      ctx.fillStyle = colors.light;
      ctx.beginPath();
      ctx.moveTo(px + 1, py + 1);
      ctx.lineTo(px + 1 + bw, py + 1);
      ctx.lineTo(px + 1 + bw - 3, py + 1 + 3);
      ctx.lineTo(px + 1 + 3, py + 1 + 3);
      ctx.lineTo(px + 1 + 3, py + 1 + bh - 3);
      ctx.lineTo(px + 1, py + 1 + bh);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = colors.dark;
      ctx.beginPath();
      ctx.moveTo(px + 1 + bw, py + 1);
      ctx.lineTo(px + 1 + bw, py + 1 + bh);
      ctx.lineTo(px + 1, py + 1 + bh);
      ctx.lineTo(px + 1 + 3, py + 1 + bh - 3);
      ctx.lineTo(px + 1 + bw - 3, py + 1 + bh - 3);
      ctx.lineTo(px + 1 + bw - 3, py + 1 + 3);
      ctx.closePath();
      ctx.fill();
      
      ctx.globalAlpha = 1;
    };
    
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = board[y]?.[x];
        if (cell) {
          drawBlock(x, y, cell);
        }
      }
    }
    
    if (currentPiece?.shape && currentPiece.position) {
      const { shape, position, type } = currentPiece;
      
      for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[py].length; px++) {
          if (shape[py][px]) {
            const x = position.x + px;
            const y = position.y + py;
            
            if (x >= 0 && x < cols && y >= 0 && y < rows) {
              drawBlock(x, y, type);
            }
          }
        }
      }
    }
    
    if (gameState?.isGameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, 0, width, height);
      
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 18px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', width / 2, height / 2);
    }
  }, [boardStr, pieceStr, gameState?.isGameOver, width, height]);
  
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-zinc-900 to-black p-2">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        style={{ 
          imageRendering: 'auto',
          boxShadow: '0 0 30px rgba(0, 200, 255, 0.2), inset 0 0 20px rgba(0, 0, 0, 0.5)'
        }}
      />
    </div>
  );
}
