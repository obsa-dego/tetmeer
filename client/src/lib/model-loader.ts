import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const modelCache = new Map<string, THREE.Group>();
const loadingPromises = new Map<string, Promise<THREE.Group>>();
const geometryCache = new Map<string, THREE.BufferGeometry>();
const materialCache = new Map<string, THREE.Material | THREE.Material[]>();

export interface BlockModelConfig {
  modelPath: string;
  scale?: number;
  rotation?: { x: number; y: number; z: number };
}

export const BLOCK_MODELS: Record<string, BlockModelConfig> = {
  'model_cube': {
    modelPath: '/models/blocks/cube.glb',
    scale: 0.5,
  },
  'model_cloth': {
    modelPath: '/models/blocks/cloth_block.glb',
    scale: 1.0,
  },
};

export const DECORATION_MODELS: Record<string, BlockModelConfig> = {
  'deco_glass_cup': {
    modelPath: '/models/decorations/glass_cup.glb',
    scale: 7.5,
  },
  'deco_cartoon_pond': {
    modelPath: '/models/decorations/cartoon_pond.glb',
    scale: 0.5,
  },
};

const decorationModelCache = new Map<string, THREE.Group>();
const decorationLoadingPromises = new Map<string, Promise<THREE.Group>>();

export function isDecorationWithModel(decorationId: string): boolean {
  return decorationId in DECORATION_MODELS;
}

export async function loadDecorationModel(decorationId: string): Promise<THREE.Group | null> {
  const config = DECORATION_MODELS[decorationId];
  if (!config) return null;

  if (decorationModelCache.has(decorationId)) {
    return decorationModelCache.get(decorationId)!.clone();
  }

  if (decorationLoadingPromises.has(decorationId)) {
    const cached = await decorationLoadingPromises.get(decorationId)!;
    return cached.clone();
  }

  const loadPromise = new Promise<THREE.Group>((resolve, reject) => {
    loader.load(
      config.modelPath,
      (gltf) => {
        const model = gltf.scene;
        const scale = config.scale ?? 1;
        model.scale.set(scale, scale, scale);
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        decorationModelCache.set(decorationId, model);
        resolve(model.clone());
      },
      undefined,
      (error) => {
        console.error(`Failed to load decoration model: ${decorationId}`, error);
        reject(error);
      }
    );
  });

  decorationLoadingPromises.set(decorationId, loadPromise);
  return loadPromise;
}

export function getCachedDecorationModel(decorationId: string): THREE.Group | null {
  const cached = decorationModelCache.get(decorationId);
  return cached ? cached.clone() : null;
}

export function isModelTexture(texture: string): boolean {
  return texture.startsWith('model_');
}

export async function loadBlockModel(modelPath: string): Promise<THREE.Group> {
  if (modelCache.has(modelPath)) {
    return modelCache.get(modelPath)!.clone();
  }

  if (loadingPromises.has(modelPath)) {
    const cached = await loadingPromises.get(modelPath)!;
    return cached.clone();
  }

  console.log(`[MODEL-LOADER] Loading block model: ${modelPath}`);
  const loadPromise = new Promise<THREE.Group>((resolve, reject) => {
    loader.load(
      modelPath,
      (gltf: GLTF) => {
        const model = gltf.scene;
        console.log(`[MODEL-LOADER] Model loaded successfully: ${modelPath}`);
        let meshCount = 0;
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            meshCount++;
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        console.log(`[MODEL-LOADER] Model has ${meshCount} meshes`);
        modelCache.set(modelPath, model);
        resolve(model.clone());
      },
      undefined,
      (error) => {
        console.error(`[MODEL-LOADER] Failed to load model: ${modelPath}`, error);
        reject(error);
      }
    );
  });

  loadingPromises.set(modelPath, loadPromise);
  return loadPromise;
}

export function applyColorToModel(model: THREE.Group, color: string, opacity = 1): void {
  const threeColor = new THREE.Color(color);
  
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const material = child.material as THREE.MeshStandardMaterial;
      if (material && material.color) {
        const newMaterial = material.clone();
        newMaterial.color = threeColor;
        if (opacity < 1) {
          newMaterial.transparent = true;
          newMaterial.opacity = opacity;
        }
        child.material = newMaterial;
      }
    }
  });
}

export function createBlockFromModel(
  model: THREE.Group,
  color: string,
  position: { x: number; y: number; z: number },
  config: BlockModelConfig
): THREE.Group {
  const block = model.clone();
  
  applyColorToModel(block, color);
  
  const scale = config.scale ?? 1;
  block.scale.set(scale, scale, scale);
  
  if (config.rotation) {
    block.rotation.set(
      config.rotation.x * Math.PI / 180,
      config.rotation.y * Math.PI / 180,
      config.rotation.z * Math.PI / 180
    );
  }
  
  block.position.set(position.x, position.y, position.z);
  
  return block;
}

export function getCachedModel(modelPath: string): THREE.Group | null {
  const cached = modelCache.get(modelPath);
  return cached ? cached.clone() : null;
}

export function isModelLoaded(texture: string): boolean {
  const config = BLOCK_MODELS[texture];
  if (!config) return false;
  return modelCache.has(config.modelPath);
}

const MAX_BLOCK_VERTICES = 5000;

function simplifyGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const vertexCount = geometry.attributes.position?.count || 0;
  
  if (vertexCount <= MAX_BLOCK_VERTICES) {
    return geometry;
  }
  
  console.warn(`[MODEL-LOADER] Geometry has ${vertexCount} vertices, exceeds limit of ${MAX_BLOCK_VERTICES}. Using fallback box geometry.`);
  const boxGeom = new THREE.BoxGeometry(1, 1, 1);
  return boxGeom;
}

export function getModelGeometry(texture: string): THREE.BufferGeometry | null {
  const config = BLOCK_MODELS[texture];
  if (!config) {
    return null;
  }
  
  if (geometryCache.has(texture)) {
    return geometryCache.get(texture)!;
  }
  
  const model = modelCache.get(config.modelPath);
  if (!model) {
    return null;
  }
  
  let foundGeometry: THREE.BufferGeometry | null = null;
  let foundMaterial: THREE.Material | THREE.Material[] | null = null;
  
  model.traverse((child) => {
    if (child instanceof THREE.Mesh && !foundGeometry) {
      const geom = child.geometry.clone();
      
      if (child.material) {
        if (Array.isArray(child.material)) {
          foundMaterial = child.material.map(m => m.clone());
        } else {
          foundMaterial = child.material.clone();
        }
      }
      
      geom.computeBoundingBox();
      const bbox = geom.boundingBox;
      if (bbox) {
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        
        if (maxDim > 0) {
          const normalizeScale = 1 / maxDim;
          geom.scale(normalizeScale, normalizeScale, normalizeScale);
        }
        
        geom.computeBoundingBox();
        const newBbox = geom.boundingBox!;
        const center = new THREE.Vector3();
        newBbox.getCenter(center);
        geom.translate(-center.x, -center.y, -center.z);
      }
      
      const scale = config.scale ?? 1;
      geom.scale(scale, scale, scale);
      
      const simplifiedGeom = simplifyGeometry(geom);
      if (simplifiedGeom !== geom) {
        geom.dispose();
      }
      
      foundGeometry = simplifiedGeom;
      console.log(`[MODEL-LOADER] Loaded geometry with ${foundGeometry.attributes.position?.count || 0} vertices for: ${texture}`);
    }
  });
  
  if (foundGeometry) {
    geometryCache.set(texture, foundGeometry);
    if (foundMaterial) {
      materialCache.set(texture, foundMaterial);
    }
  }
  
  return foundGeometry;
}

export function getModelMaterial(texture: string): THREE.Material | THREE.Material[] | null {
  if (materialCache.has(texture)) {
    const cached = materialCache.get(texture)!;
    if (Array.isArray(cached)) {
      return cached.map(m => m.clone());
    }
    return cached.clone();
  }
  return null;
}

export function clearModelCache(): void {
  modelCache.forEach((model) => {
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
  geometryCache.forEach((geometry) => {
    geometry.dispose();
  });
  modelCache.clear();
  loadingPromises.clear();
  geometryCache.clear();
}

export async function preloadBlockModels(textures: string[]): Promise<void> {
  const modelTextures = textures.filter(isModelTexture);
  
  await Promise.all(
    modelTextures.map(async (texture) => {
      const config = BLOCK_MODELS[texture];
      if (config) {
        try {
          await loadBlockModel(config.modelPath);
        } catch (error) {
          console.warn(`Failed to preload model for ${texture}:`, error);
        }
      }
    })
  );
}

export function createFallbackBlock(
  color: string,
  position: { x: number; y: number; z: number },
  size = 1
): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(size, size, size);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.3,
    metalness: 0.2,
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position.x, position.y, position.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  return mesh;
}
