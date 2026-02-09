import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { BOARD_WIDTH } from './game-engine';

export interface GridConfig {
  gridSize: number;
  cellSize: number;
  offsetX: number;
  offsetZ: number;
  boardCenterX: number;
}

export const DEFAULT_GRID_CONFIG: GridConfig = {
  gridSize: 10,
  cellSize: 1,
  offsetX: -5,
  offsetZ: -5,
  boardCenterX: BOARD_WIDTH / 2,
};

export interface FloorModelConfig {
  id: string;
  name: string;
  modelPath: string;
  targetSize: number;
}

export const FLOOR_MODELS: Record<string, FloorModelConfig> = {
  'floor_default': {
    id: 'floor_default',
    name: 'Default Floor',
    modelPath: '',
    targetSize: 10,
  },
};

const floorLoader = new GLTFLoader();
const floorModelCache = new Map<string, THREE.Group>();
const floorLoadingPromises = new Map<string, Promise<THREE.Group>>();

export async function loadFloorModel(modelPath: string): Promise<THREE.Group> {
  if (floorModelCache.has(modelPath)) {
    return floorModelCache.get(modelPath)!.clone();
  }

  if (floorLoadingPromises.has(modelPath)) {
    const cached = await floorLoadingPromises.get(modelPath)!;
    return cached.clone();
  }

  const loadPromise = new Promise<THREE.Group>((resolve, reject) => {
    floorLoader.load(
      modelPath,
      (gltf: GLTF) => {
        const model = gltf.scene;
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.receiveShadow = true;
            child.castShadow = false;
          }
        });
        floorModelCache.set(modelPath, model);
        resolve(model.clone());
      },
      undefined,
      (error) => {
        console.error(`Failed to load floor model: ${modelPath}`, error);
        reject(error);
      }
    );
  });

  floorLoadingPromises.set(modelPath, loadPromise);
  return loadPromise;
}

export function calculateModelBoundingBox(model: THREE.Group): THREE.Box3 {
  const box = new THREE.Box3();
  box.setFromObject(model);
  return box;
}

export function normalizeFloorModel(model: THREE.Group, targetSize: number): THREE.Group {
  const box = calculateModelBoundingBox(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  
  const maxDimension = Math.max(size.x, size.z);
  const scale = targetSize / maxDimension;
  
  model.scale.set(scale, scale, scale);
  
  const newBox = calculateModelBoundingBox(model);
  const center = new THREE.Vector3();
  newBox.getCenter(center);
  
  model.position.x = -center.x;
  model.position.z = -center.z;
  model.position.y = -newBox.min.y;
  
  return model;
}

export async function loadAndNormalizeFloorModel(
  modelPath: string,
  targetSize: number = DEFAULT_GRID_CONFIG.gridSize
): Promise<THREE.Group> {
  const model = await loadFloorModel(modelPath);
  return normalizeFloorModel(model, targetSize);
}

export function worldToGridCoord(
  worldX: number,
  worldZ: number,
  config: GridConfig = DEFAULT_GRID_CONFIG
): { gridX: number; gridZ: number } {
  const gridOriginX = config.boardCenterX + config.offsetX;
  const gridOriginZ = config.offsetZ;
  
  const localX = worldX - gridOriginX;
  const localZ = worldZ - gridOriginZ;
  
  const gridX = Math.floor(localX / config.cellSize);
  const gridZ = Math.floor(localZ / config.cellSize);
  
  return {
    gridX: Math.max(0, Math.min(config.gridSize - 1, gridX)),
    gridZ: Math.max(0, Math.min(config.gridSize - 1, gridZ)),
  };
}

export function gridToWorldCoord(
  gridX: number,
  gridZ: number,
  config: GridConfig = DEFAULT_GRID_CONFIG
): { worldX: number; worldZ: number } {
  const gridOriginX = config.boardCenterX + config.offsetX;
  const gridOriginZ = config.offsetZ;
  
  const worldX = gridOriginX + (gridX + 0.5) * config.cellSize;
  const worldZ = gridOriginZ + (gridZ + 0.5) * config.cellSize;
  
  return { worldX, worldZ };
}

export function snapToGrid(
  worldX: number,
  worldZ: number,
  config: GridConfig = DEFAULT_GRID_CONFIG
): { worldX: number; worldZ: number } {
  const { gridX, gridZ } = worldToGridCoord(worldX, worldZ, config);
  return gridToWorldCoord(gridX, gridZ, config);
}

export function isValidGridPosition(
  gridX: number,
  gridZ: number,
  config: GridConfig = DEFAULT_GRID_CONFIG
): boolean {
  return gridX >= 0 && gridX < config.gridSize && gridZ >= 0 && gridZ < config.gridSize;
}

export function createGridHelper(config: GridConfig = DEFAULT_GRID_CONFIG): THREE.GridHelper {
  const totalSize = config.gridSize * config.cellSize;
  const divisions = config.gridSize;
  
  const gridHelper = new THREE.GridHelper(totalSize, divisions, 0x444444, 0x222222);
  
  const gridCenterX = config.boardCenterX + config.offsetX + totalSize / 2;
  const gridCenterZ = config.offsetZ + totalSize / 2;
  gridHelper.position.set(gridCenterX, 0.01, gridCenterZ);
  
  return gridHelper;
}

export function clearFloorModelCache(): void {
  floorModelCache.forEach((model) => {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  });
  floorModelCache.clear();
  floorLoadingPromises.clear();
}

export interface PlacedGridItem {
  id: string;
  itemType: string;
  gridX: number;
  gridZ: number;
  rotation?: number;
}

export function canPlaceItem(
  gridX: number,
  gridZ: number,
  placedItems: PlacedGridItem[],
  config: GridConfig = DEFAULT_GRID_CONFIG
): boolean {
  if (!isValidGridPosition(gridX, gridZ, config)) {
    return false;
  }
  
  return !placedItems.some(item => item.gridX === gridX && item.gridZ === gridZ);
}
