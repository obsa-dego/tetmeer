import * as THREE from 'three';

const MAX_PARTICLES = 100000;
const PARTICLES_PER_CELL = 200;
const PARTICLE_SIZE = 0.025;

export interface FastSandSystem {
  positions: Float32Array;
  velocities: Float32Array;
  colors: Float32Array;
  alive: Uint8Array;
  particleCount: number;
  activeCount: number;
  nextIndex: number;
  freeList: number[];
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
  points: THREE.Points;
  floorY: number;
  boardMinX: number;
  boardMaxX: number;
  boardMinZ: number;
  boardMaxZ: number;
  gravity: number;
  damping: number;
  friction: number;
  settledThreshold: number;
}

export function createFastSandSystem(): FastSandSystem {
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const velocities = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  const alive = new Uint8Array(MAX_PARTICLES);
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  geometry.setDrawRange(0, 0);
  
  const material = new THREE.PointsMaterial({
    size: PARTICLE_SIZE,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: false,
  });
  
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  
  return {
    positions,
    velocities,
    colors,
    alive,
    particleCount: 0,
    activeCount: 0,
    nextIndex: 0,
    freeList: [],
    geometry,
    material,
    points,
    floorY: 0.0,
    boardMinX: -5.0,
    boardMaxX: 5.0,
    boardMinZ: -0.4,
    boardMaxZ: 0.4,
    gravity: -35.0,
    damping: 0.98,
    friction: 0.7,
    settledThreshold: 0.01,
  };
}

export function addBlockAsSand(
  system: FastSandSystem,
  cellX: number,
  cellY: number,
  color: THREE.Color,
  explode: boolean = false
): void {
  const centerX = cellX - 4.5;
  const centerY = cellY + 0.5;
  const centerZ = 0;
  
  for (let i = 0; i < PARTICLES_PER_CELL; i++) {
    let idx: number;
    
    if (system.freeList.length > 0) {
      idx = system.freeList.pop()!;
    } else if (system.nextIndex < MAX_PARTICLES) {
      idx = system.nextIndex++;
      system.particleCount++;
    } else {
      break;
    }
    
    const idx3 = idx * 3;
    
    const jitterX = (Math.random() - 0.5) * 0.9;
    const jitterY = (Math.random() - 0.5) * 0.9;
    const jitterZ = (Math.random() - 0.5) * 0.8;
    
    system.positions[idx3] = centerX + jitterX;
    system.positions[idx3 + 1] = centerY + jitterY;
    system.positions[idx3 + 2] = centerZ + jitterZ;
    
    if (explode) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      system.velocities[idx3] = Math.cos(angle) * speed * 0.3;
      system.velocities[idx3 + 1] = Math.random() * speed * 0.5;
      system.velocities[idx3 + 2] = Math.sin(angle) * speed * 0.2;
    } else {
      system.velocities[idx3] = (Math.random() - 0.5) * 0.5;
      system.velocities[idx3 + 1] = -Math.random() * 2;
      system.velocities[idx3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    
    system.colors[idx3] = color.r;
    system.colors[idx3 + 1] = color.g;
    system.colors[idx3 + 2] = color.b;
    
    system.alive[idx] = 1;
    system.activeCount++;
  }
}

export function addTetrominoAsSand(
  system: FastSandSystem,
  shape: number[][],
  baseX: number,
  baseY: number,
  colorHex: string,
  explode: boolean = true
): void {
  const color = new THREE.Color(colorHex);
  
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col] === 1) {
        const cellX = baseX + col;
        const cellY = baseY + (shape.length - 1 - row);
        addBlockAsSand(system, cellX, cellY, color, explode);
      }
    }
  }
}

export function stepFastSandSystem(system: FastSandSystem, deltaTime: number): void {
  const dt = Math.min(deltaTime, 0.033);
  const gravity = system.gravity;
  const damping = system.damping;
  const floorY = system.floorY;
  const minX = system.boardMinX;
  const maxX = system.boardMaxX;
  const minZ = system.boardMinZ;
  const maxZ = system.boardMaxZ;
  
  const positions = system.positions;
  const velocities = system.velocities;
  const colors = system.colors;
  const alive = system.alive;
  
  const posAttr = system.geometry.attributes.position.array as Float32Array;
  const colAttr = system.geometry.attributes.color.array as Float32Array;
  
  let writeIdx = 0;
  
  for (let i = 0; i < system.particleCount; i++) {
    if (!alive[i]) continue;
    
    const idx3 = i * 3;
    
    velocities[idx3 + 1] += gravity * dt;
    
    velocities[idx3] *= damping;
    velocities[idx3 + 1] *= damping;
    velocities[idx3 + 2] *= damping;
    
    positions[idx3] += velocities[idx3] * dt;
    positions[idx3 + 1] += velocities[idx3 + 1] * dt;
    positions[idx3 + 2] += velocities[idx3 + 2] * dt;
    
    if (positions[idx3 + 1] < floorY) {
      positions[idx3 + 1] = floorY;
      velocities[idx3 + 1] *= -0.1;
      velocities[idx3] *= system.friction;
      velocities[idx3 + 2] *= system.friction;
      
      if (Math.abs(velocities[idx3 + 1]) < 0.1) {
        velocities[idx3 + 1] = 0;
      }
    }
    
    if (positions[idx3] < minX) {
      positions[idx3] = minX;
      velocities[idx3] *= -0.3;
    } else if (positions[idx3] > maxX) {
      positions[idx3] = maxX;
      velocities[idx3] *= -0.3;
    }
    
    if (positions[idx3 + 2] < minZ) {
      positions[idx3 + 2] = minZ;
      velocities[idx3 + 2] *= -0.3;
    } else if (positions[idx3 + 2] > maxZ) {
      positions[idx3 + 2] = maxZ;
      velocities[idx3 + 2] *= -0.3;
    }
    
    const writeIdx3 = writeIdx * 3;
    posAttr[writeIdx3] = positions[idx3];
    posAttr[writeIdx3 + 1] = positions[idx3 + 1];
    posAttr[writeIdx3 + 2] = positions[idx3 + 2];
    
    colAttr[writeIdx3] = colors[idx3];
    colAttr[writeIdx3 + 1] = colors[idx3 + 1];
    colAttr[writeIdx3 + 2] = colors[idx3 + 2];
    
    writeIdx++;
  }
  
  system.activeCount = writeIdx;
  system.geometry.attributes.position.needsUpdate = true;
  system.geometry.attributes.color.needsUpdate = true;
  system.geometry.setDrawRange(0, writeIdx);
}

export function clearFastSandSystem(system: FastSandSystem): void {
  system.alive.fill(0);
  system.positions.fill(0);
  system.velocities.fill(0);
  system.colors.fill(0);
  system.particleCount = 0;
  system.activeCount = 0;
  system.nextIndex = 0;
  system.freeList.length = 0;
  system.geometry.setDrawRange(0, 0);
  system.geometry.attributes.position.needsUpdate = true;
  system.geometry.attributes.color.needsUpdate = true;
}

export function checkAndClearSandLines(
  system: FastSandSystem,
  boardWidth: number = 10,
  boardHeight: number = 20,
  threshold: number = 0.7
): number {
  const rowCounts = new Array(boardHeight).fill(0);
  const rowTotals = new Array(boardHeight).fill(0);
  
  for (let i = 0; i < system.particleCount; i++) {
    if (!system.alive[i]) continue;
    
    const y = system.positions[i * 3 + 1];
    const row = Math.floor(y);
    
    if (row >= 0 && row < boardHeight) {
      rowCounts[row]++;
      rowTotals[row]++;
    }
  }
  
  const particlesPerRow = PARTICLES_PER_CELL * boardWidth;
  const rowsToClear: number[] = [];
  
  for (let row = 0; row < boardHeight; row++) {
    if (rowCounts[row] >= particlesPerRow * threshold) {
      rowsToClear.push(row);
    }
  }
  
  if (rowsToClear.length === 0) return 0;
  
  const rowSet = new Set(rowsToClear);
  
  for (let i = 0; i < system.particleCount; i++) {
    if (!system.alive[i]) continue;
    
    const y = system.positions[i * 3 + 1];
    const row = Math.floor(y);
    
    if (rowSet.has(row)) {
      system.alive[i] = 0;
      system.positions[i * 3 + 1] = -100;
      system.freeList.push(i);
      system.activeCount--;
    }
  }
  
  system.geometry.attributes.position.needsUpdate = true;
  
  return rowsToClear.length;
}

export function disposeFastSandSystem(system: FastSandSystem): void {
  system.geometry.dispose();
  system.material.dispose();
}

export function areAllParticlesSettled(system: FastSandSystem): boolean {
  const threshold = system.settledThreshold;
  
  for (let i = 0; i < system.particleCount; i++) {
    if (!system.alive[i]) continue;
    
    const idx3 = i * 3;
    const speed = Math.abs(system.velocities[idx3]) + 
                  Math.abs(system.velocities[idx3 + 1]) + 
                  Math.abs(system.velocities[idx3 + 2]);
    
    if (speed > threshold) return false;
  }
  
  return true;
}

export { MAX_PARTICLES, PARTICLES_PER_CELL, PARTICLE_SIZE };
