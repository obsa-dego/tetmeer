import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';
import { GameState, BOARD_WIDTH, BOARD_HEIGHT } from '@/lib/game-engine';
import { BlockTexture } from '@shared/schema';

interface ViewConfig {
  gameState: GameState;
  blockTexture: BlockTexture;
  backgroundColor: string;
  gridColor: string;
  isPlayer: boolean;
}

interface DualViewRendererProps {
  playerView: ViewConfig;
  opponentView: ViewConfig | null;
  className?: string;
}

const PIECE_COLORS: Record<string, number> = {
  I: 0x00f0f0,
  O: 0xf0f000,
  T: 0xa000f0,
  S: 0x00f000,
  Z: 0xf00000,
  J: 0x0000f0,
  L: 0xf0a000,
};

export function DualViewRenderer({ playerView, opponentView, className }: DualViewRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerSceneRef = useRef<THREE.Scene | null>(null);
  const opponentSceneRef = useRef<THREE.Scene | null>(null);
  const playerCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const opponentCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isAnimatingRef = useRef(false);
  
  const playerBlocksRef = useRef<THREE.Group | null>(null);
  const opponentBlocksRef = useRef<THREE.Group | null>(null);
  const playerCurrentPieceRef = useRef<THREE.Group | null>(null);
  const opponentCurrentPieceRef = useRef<THREE.Group | null>(null);
  
  const [isReady, setIsReady] = useState(false);
  const instanceId = useMemo(() => Math.random().toString(36).substring(7), []);
  
  const createBlockMesh = useCallback((color: number, x: number, y: number, opacity = 1) => {
    const geometry = new THREE.BoxGeometry(0.95, 0.95, 0.95);
    const material = new THREE.MeshPhongMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      shininess: 30,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x + 0.5, BOARD_HEIGHT - y - 0.5, 0);
    return mesh;
  }, []);
  
  const updateSceneBlocks = useCallback((
    scene: THREE.Scene,
    blocksGroup: THREE.Group,
    currentPieceGroup: THREE.Group,
    gameState: GameState
  ) => {
    while (blocksGroup.children.length > 0) {
      blocksGroup.remove(blocksGroup.children[0]);
    }
    while (currentPieceGroup.children.length > 0) {
      currentPieceGroup.remove(currentPieceGroup.children[0]);
    }
    
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const cell = gameState.board[y]?.[x];
        if (cell) {
          const color = PIECE_COLORS[cell] || 0x888888;
          const block = createBlockMesh(color, x, y);
          blocksGroup.add(block);
        }
      }
    }
    
    if (gameState.currentPiece && !gameState.isGameOver) {
      const piece = gameState.currentPiece;
      const color = PIECE_COLORS[piece.type] || 0x888888;
      
      piece.shape.forEach((row, dy) => {
        row.forEach((cell, dx) => {
          if (cell) {
            const x = piece.position.x + dx;
            const y = piece.position.y + dy;
            if (x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT) {
              const block = createBlockMesh(color, x, y);
              currentPieceGroup.add(block);
            }
          }
        });
      });
    }
  }, [createBlockMesh]);
  
  const createScene = useCallback((isPlayer: boolean) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a15);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 10);
    scene.add(directionalLight);
    
    const gridGeometry = new THREE.PlaneGeometry(BOARD_WIDTH, BOARD_HEIGHT);
    const gridMaterial = new THREE.MeshBasicMaterial({
      color: 0x1a1a2e,
      transparent: true,
      opacity: 0.8,
    });
    const gridPlane = new THREE.Mesh(gridGeometry, gridMaterial);
    gridPlane.position.set(BOARD_WIDTH / 2, BOARD_HEIGHT / 2, -0.5);
    scene.add(gridPlane);
    
    const borderMaterial = new THREE.LineBasicMaterial({ color: 0x4a4a6a });
    const borderGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(BOARD_WIDTH, 0, 0),
      new THREE.Vector3(BOARD_WIDTH, BOARD_HEIGHT, 0),
      new THREE.Vector3(0, BOARD_HEIGHT, 0),
      new THREE.Vector3(0, 0, 0),
    ]);
    const border = new THREE.Line(borderGeometry, borderMaterial);
    scene.add(border);
    
    const blocksGroup = new THREE.Group();
    scene.add(blocksGroup);
    
    const currentPieceGroup = new THREE.Group();
    scene.add(currentPieceGroup);
    
    return { scene, blocksGroup, currentPieceGroup };
  }, []);
  
  useEffect(() => {
    console.log(`[DualViewRenderer:${instanceId}] INIT START`);
    
    if (!containerRef.current) {
      console.log(`[DualViewRenderer:${instanceId}] INIT ABORT - no container`);
      return;
    }
    
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    console.log(`[DualViewRenderer:${instanceId}] Container size: ${width}x${height}`);
    
    const canvas = document.createElement('canvas');
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    container.appendChild(canvas);
    canvasRef.current = canvas;
    
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(width, height);
      console.log(`[DualViewRenderer:${instanceId}] WebGLRenderer created`);
    } catch (e) {
      console.error(`[DualViewRenderer:${instanceId}] WebGLRenderer failed:`, e);
      return;
    }
    rendererRef.current = renderer;
    
    const playerSetup = createScene(true);
    playerSceneRef.current = playerSetup.scene;
    playerBlocksRef.current = playerSetup.blocksGroup;
    playerCurrentPieceRef.current = playerSetup.currentPieceGroup;
    
    const playerCamera = new THREE.PerspectiveCamera(45, (width / 2) / height, 0.1, 1000);
    playerCamera.position.set(BOARD_WIDTH / 2, BOARD_HEIGHT / 2, 25);
    playerCamera.lookAt(BOARD_WIDTH / 2, BOARD_HEIGHT / 2, 0);
    playerCameraRef.current = playerCamera;
    
    if (opponentView) {
      const opponentSetup = createScene(false);
      opponentSceneRef.current = opponentSetup.scene;
      opponentBlocksRef.current = opponentSetup.blocksGroup;
      opponentCurrentPieceRef.current = opponentSetup.currentPieceGroup;
      
      const opponentCamera = new THREE.PerspectiveCamera(45, (width / 2) / height, 0.1, 1000);
      opponentCamera.position.set(BOARD_WIDTH / 2, BOARD_HEIGHT / 2, 25);
      opponentCamera.lookAt(BOARD_WIDTH / 2, BOARD_HEIGHT / 2, 0);
      opponentCameraRef.current = opponentCamera;
    }
    
    setIsReady(true);
    isAnimatingRef.current = true;
    
    let frameCount = 0;
    const animate = () => {
      if (!isAnimatingRef.current) {
        console.log(`[DualViewRenderer:${instanceId}] Animation stopped`);
        return;
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
      frameCount++;
      
      if (frameCount % 300 === 0) {
        console.log(`[DualViewRenderer:${instanceId}] Frame ${frameCount}`);
      }
      
      const w = container.clientWidth;
      const h = container.clientHeight;
      const halfWidth = w / 2;
      
      renderer.setScissorTest(true);
      
      renderer.setViewport(0, 0, halfWidth, h);
      renderer.setScissor(0, 0, halfWidth, h);
      if (playerSceneRef.current && playerCameraRef.current) {
        renderer.render(playerSceneRef.current, playerCameraRef.current);
      }
      
      if (opponentSceneRef.current && opponentCameraRef.current) {
        renderer.setViewport(halfWidth, 0, halfWidth, h);
        renderer.setScissor(halfWidth, 0, halfWidth, h);
        renderer.render(opponentSceneRef.current, opponentCameraRef.current);
      }
      
      renderer.setScissorTest(false);
    };
    
    console.log(`[DualViewRenderer:${instanceId}] Animation loop starting`);
    animate();
    
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      
      canvas.width = w * window.devicePixelRatio;
      canvas.height = h * window.devicePixelRatio;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      
      renderer.setSize(w, h);
      
      const halfWidth = w / 2;
      if (playerCameraRef.current) {
        playerCameraRef.current.aspect = halfWidth / h;
        playerCameraRef.current.updateProjectionMatrix();
      }
      if (opponentCameraRef.current) {
        opponentCameraRef.current.aspect = halfWidth / h;
        opponentCameraRef.current.updateProjectionMatrix();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      console.log(`[DualViewRenderer:${instanceId}] CLEANUP`);
      isAnimatingRef.current = false;
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      window.removeEventListener('resize', handleResize);
      
      renderer.dispose();
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    };
  }, [instanceId, createScene, opponentView]);
  
  useEffect(() => {
    if (!isReady) return;
    
    if (playerSceneRef.current && playerBlocksRef.current && playerCurrentPieceRef.current) {
      updateSceneBlocks(
        playerSceneRef.current,
        playerBlocksRef.current,
        playerCurrentPieceRef.current,
        playerView.gameState
      );
    }
  }, [isReady, playerView.gameState, updateSceneBlocks]);
  
  useEffect(() => {
    if (!isReady || !opponentView) return;
    
    if (opponentSceneRef.current && opponentBlocksRef.current && opponentCurrentPieceRef.current) {
      updateSceneBlocks(
        opponentSceneRef.current,
        opponentBlocksRef.current,
        opponentCurrentPieceRef.current,
        opponentView.gameState
      );
    }
  }, [isReady, opponentView, updateSceneBlocks]);
  
  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%' }}
      data-testid="dual-view-renderer"
    />
  );
}
