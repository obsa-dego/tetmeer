import * as CANNON from 'cannon-es';

export interface SandParticle {
  id: string;
  body: CANNON.Body;
  color: string;
  settled: boolean;
  size: number;
}

export interface SandPhysicsWorld {
  world: CANNON.World;
  particles: Map<string, SandParticle>;
  groundBody: CANNON.Body;
  wallBodies: CANNON.Body[];
}

const BLOCK_SIZE = 1;
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const GRAVITY = -40;

const PARTICLES_PER_CELL = 144;
const PARTICLE_SIZE = 0.035;
const MAX_PARTICLES = 8000;

const sandMaterial = new CANNON.Material('sand');
const groundMaterial = new CANNON.Material('ground');

export function createSandPhysicsWorld(): SandPhysicsWorld {
  const world = new CANNON.World();
  world.gravity.set(0, GRAVITY, 0);
  world.broadphase = new CANNON.SAPBroadphase(world);
  (world.solver as CANNON.GSSolver).iterations = 8;
  world.allowSleep = true;
  
  const sandGroundContact = new CANNON.ContactMaterial(sandMaterial, groundMaterial, {
    friction: 0.9,
    restitution: 0.02,
  });
  world.addContactMaterial(sandGroundContact);
  
  const sandSandContact = new CANNON.ContactMaterial(sandMaterial, sandMaterial, {
    friction: 0.7,
    restitution: 0.01,
  });
  world.addContactMaterial(sandSandContact);
  
  const groundShape = new CANNON.Box(new CANNON.Vec3(BOARD_WIDTH * BLOCK_SIZE / 2 + 1, 0.5, 2));
  const groundBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(BOARD_WIDTH / 2 - 0.5, -0.5, 0),
    shape: groundShape,
    material: groundMaterial,
  });
  world.addBody(groundBody);
  
  const wallBodies: CANNON.Body[] = [];
  
  const leftWallShape = new CANNON.Box(new CANNON.Vec3(0.5, BOARD_HEIGHT * BLOCK_SIZE / 2, 2));
  const leftWall = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(-1, BOARD_HEIGHT / 2, 0),
    shape: leftWallShape,
    material: groundMaterial,
  });
  world.addBody(leftWall);
  wallBodies.push(leftWall);
  
  const rightWall = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(BOARD_WIDTH, BOARD_HEIGHT / 2, 0),
    shape: leftWallShape,
    material: groundMaterial,
  });
  world.addBody(rightWall);
  wallBodies.push(rightWall);
  
  const backWall = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(BOARD_WIDTH / 2 - 0.5, BOARD_HEIGHT / 2, -1),
    shape: new CANNON.Box(new CANNON.Vec3(BOARD_WIDTH / 2 + 1, BOARD_HEIGHT / 2, 0.5)),
    material: groundMaterial,
  });
  world.addBody(backWall);
  wallBodies.push(backWall);
  
  const frontWall = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(BOARD_WIDTH / 2 - 0.5, BOARD_HEIGHT / 2, 1),
    shape: new CANNON.Box(new CANNON.Vec3(BOARD_WIDTH / 2 + 1, BOARD_HEIGHT / 2, 0.5)),
    material: groundMaterial,
  });
  world.addBody(frontWall);
  wallBodies.push(frontWall);
  
  return {
    world,
    particles: new Map(),
    groundBody,
    wallBodies,
  };
}

export function addSandParticle(
  physicsWorld: SandPhysicsWorld,
  x: number,
  y: number,
  z: number,
  color: string,
  size: number = PARTICLE_SIZE
): SandParticle {
  const id = `particle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const shape = new CANNON.Sphere(size);
  
  const body = new CANNON.Body({
    mass: 0.3,
    position: new CANNON.Vec3(x, y, z),
    shape,
    linearDamping: 0.5,
    angularDamping: 0.9,
    material: sandMaterial,
    sleepSpeedLimit: 0.3,
    sleepTimeLimit: 0.5,
  });
  
  body.velocity.set(0, 0, 0);
  
  physicsWorld.world.addBody(body);
  
  const particle: SandParticle = {
    id,
    body,
    color,
    settled: false,
    size,
  };
  
  physicsWorld.particles.set(id, particle);
  
  return particle;
}

export function addTetrominoAsSandBlocks(
  physicsWorld: SandPhysicsWorld,
  shape: number[][],
  posX: number,
  posY: number,
  color: string,
  explode: boolean = true
): SandParticle[] {
  const particles: SandParticle[] = [];
  
  const gridSize = Math.sqrt(PARTICLES_PER_CELL);
  const spacing = BLOCK_SIZE / gridSize;
  
  for (let py = 0; py < shape.length; py++) {
    for (let px = 0; px < shape[py].length; px++) {
      if (shape[py][px]) {
        const cellX = posX + px;
        const cellY = posY + py;
        
        if (cellX >= 0 && cellX < BOARD_WIDTH) {
          const physicsBaseY = (BOARD_HEIGHT - 1 - cellY) * BLOCK_SIZE;
          
          for (let i = 0; i < PARTICLES_PER_CELL; i++) {
            const gridPosX = (i % gridSize);
            const gridPosY = Math.floor(i / gridSize);
            
            const jitterX = (Math.random() - 0.5) * spacing * 0.5;
            const jitterY = (Math.random() - 0.5) * spacing * 0.5;
            const jitterZ = (Math.random() - 0.5) * 0.4;
            
            const particleX = cellX * BLOCK_SIZE + gridPosX * spacing + spacing / 2 - BLOCK_SIZE / 2 + 0.5 + jitterX;
            const particleY = physicsBaseY + gridPosY * spacing + spacing / 2 + jitterY;
            const particleZ = jitterZ;
            
            const sizeVariation = PARTICLE_SIZE * (0.7 + Math.random() * 0.6);
            
            const particle = addSandParticle(physicsWorld, particleX, particleY, particleZ, color, sizeVariation);
            
            if (explode) {
              const explosionForce = 2 + Math.random() * 3;
              const angle = Math.random() * Math.PI * 2;
              const upwardForce = 1 + Math.random() * 2;
              particle.body.velocity.set(
                Math.cos(angle) * explosionForce,
                upwardForce,
                Math.sin(angle) * explosionForce * 0.3
              );
            }
            
            particles.push(particle);
          }
        }
      }
    }
  }
  
  return particles;
}

export function stepPhysicsWorld(physicsWorld: SandPhysicsWorld, deltaTime: number): void {
  const clampedDelta = Math.min(deltaTime, 0.05);
  physicsWorld.world.step(1 / 60, clampedDelta, 3);
  
  const particles = Array.from(physicsWorld.particles.values());
  for (const particle of particles) {
    const velocity = particle.body.velocity;
    const linearSpeed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
    
    if (linearSpeed < 0.1) {
      particle.settled = true;
      particle.body.velocity.scale(0.9, particle.body.velocity);
    } else {
      particle.settled = false;
    }
    
    if (particle.body.position.y < -2) {
      physicsWorld.world.removeBody(particle.body);
      physicsWorld.particles.delete(particle.id);
    }
  }
  
  if (physicsWorld.particles.size > MAX_PARTICLES) {
    const sortedParticles = Array.from(physicsWorld.particles.values())
      .sort((a, b) => a.body.position.y - b.body.position.y);
    
    const toRemove = sortedParticles.slice(0, physicsWorld.particles.size - MAX_PARTICLES);
    for (const particle of toRemove) {
      physicsWorld.world.removeBody(particle.body);
      physicsWorld.particles.delete(particle.id);
    }
  }
}

export function getBlockPositions(physicsWorld: SandPhysicsWorld): { 
  id: string; 
  x: number; 
  y: number; 
  z: number; 
  rotation: CANNON.Quaternion; 
  color: string;
  size: number;
}[] {
  const positions: { 
    id: string; 
    x: number; 
    y: number; 
    z: number; 
    rotation: CANNON.Quaternion; 
    color: string;
    size: number;
  }[] = [];
  
  const particles = Array.from(physicsWorld.particles.values());
  for (const particle of particles) {
    positions.push({
      id: particle.id,
      x: particle.body.position.x,
      y: particle.body.position.y,
      z: particle.body.position.z,
      rotation: particle.body.quaternion.clone(),
      color: particle.color,
      size: particle.size,
    });
  }
  
  return positions;
}

export function areAllBlocksSettled(physicsWorld: SandPhysicsWorld): boolean {
  const particles = Array.from(physicsWorld.particles.values());
  if (particles.length === 0) return true;
  
  let settledCount = 0;
  for (const particle of particles) {
    if (particle.settled) settledCount++;
  }
  
  return settledCount / particles.length > 0.9;
}

export function clearPhysicsWorld(physicsWorld: SandPhysicsWorld): void {
  const particles = Array.from(physicsWorld.particles.values());
  for (const particle of particles) {
    physicsWorld.world.removeBody(particle.body);
  }
  physicsWorld.particles.clear();
}

export function convertPhysicsToGrid(physicsWorld: SandPhysicsWorld): (string | null)[][] {
  const grid: (string | null)[][] = Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(null));
  const cellCounts: number[][] = Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(0));
  const cellColors: Map<string, Map<string, number>> = new Map();
  
  const particles = Array.from(physicsWorld.particles.values());
  for (const particle of particles) {
    const gridX = Math.floor(particle.body.position.x + 0.5);
    const gridY = BOARD_HEIGHT - 1 - Math.floor(particle.body.position.y);
    
    if (gridX >= 0 && gridX < BOARD_WIDTH && gridY >= 0 && gridY < BOARD_HEIGHT) {
      cellCounts[gridY][gridX]++;
      
      const key = `${gridX},${gridY}`;
      if (!cellColors.has(key)) {
        cellColors.set(key, new Map());
      }
      const colorMap = cellColors.get(key)!;
      colorMap.set(particle.color, (colorMap.get(particle.color) || 0) + 1);
    }
  }
  
  const threshold = PARTICLES_PER_CELL * 0.5;
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (cellCounts[y][x] >= threshold) {
        const key = `${x},${y}`;
        const colorMap = cellColors.get(key);
        if (colorMap) {
          let maxColor = '';
          let maxCount = 0;
          colorMap.forEach((count, color) => {
            if (count > maxCount) {
              maxCount = count;
              maxColor = color;
            }
          });
          grid[y][x] = maxColor;
        }
      }
    }
  }
  
  return grid;
}

export function checkCompletedLines(physicsWorld: SandPhysicsWorld): number[] {
  const grid = convertPhysicsToGrid(physicsWorld);
  const completedLines: number[] = [];
  
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    let isFull = true;
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (grid[y][x] === null) {
        isFull = false;
        break;
      }
    }
    if (isFull) {
      completedLines.push(y);
    }
  }
  
  return completedLines;
}

export function removeBlocksInLines(physicsWorld: SandPhysicsWorld, lines: number[]): void {
  const particlesToRemove: string[] = [];
  
  const particles = Array.from(physicsWorld.particles.values());
  for (const particle of particles) {
    const gridY = BOARD_HEIGHT - 1 - Math.floor(particle.body.position.y);
    
    if (lines.includes(gridY)) {
      particlesToRemove.push(particle.id);
    }
  }
  
  for (const id of particlesToRemove) {
    const particle = physicsWorld.particles.get(id);
    if (particle) {
      physicsWorld.world.removeBody(particle.body);
      physicsWorld.particles.delete(id);
    }
  }
  
  const remainingParticles = Array.from(physicsWorld.particles.values());
  for (const particle of remainingParticles) {
    particle.settled = false;
  }
}
