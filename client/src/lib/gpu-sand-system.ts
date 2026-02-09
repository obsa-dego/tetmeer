import * as THREE from 'three';

const TEXTURE_SIZE = 512;
const MAX_PARTICLES = TEXTURE_SIZE * TEXTURE_SIZE;

const physicsVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const physicsFragmentShader = `
precision highp float;

uniform sampler2D positionTexture;
uniform sampler2D velocityTexture;
uniform float deltaTime;
uniform float gravity;
uniform float damping;
uniform float friction;
uniform float floorY;
uniform vec3 boardMin;
uniform vec3 boardMax;
uniform float particleRadius;

varying vec2 vUv;

void main() {
  vec4 posData = texture2D(positionTexture, vUv);
  vec4 velData = texture2D(velocityTexture, vUv);
  
  vec3 pos = posData.xyz;
  float alive = posData.w;
  vec3 vel = velData.xyz;
  
  if (alive < 0.5) {
    gl_FragColor = posData;
    return;
  }
  
  // Apply gravity
  vel.y += gravity * deltaTime;
  vel *= damping;
  
  vec3 newPos = pos + vel * deltaTime;
  
  // Simple floor collision - particles settle at floor level
  float effectiveFloor = floorY + particleRadius;
  
  if (newPos.y < effectiveFloor) {
    newPos.y = effectiveFloor;
    vel.y *= -0.02; // Very small bounce
    vel.x *= friction;
    vel.z *= friction;
    
    // Settling behavior - particles come to rest
    if (abs(vel.y) < 0.3) {
      vel.y = 0.0;
      vel.x *= 0.7;
      vel.z *= 0.7;
    }
    
    // Tiny random spread for natural pile formation
    if (length(vel.xz) < 0.05) {
      vel.x += (fract(sin(vUv.x * 12.9898) * 43758.5453) - 0.5) * 0.15;
    }
  }
  
  pos = newPos;
  
  // Strict board boundary constraints (walls)
  float wallMargin = particleRadius;
  if (pos.x < boardMin.x + wallMargin) { 
    pos.x = boardMin.x + wallMargin; 
    vel.x = abs(vel.x) * 0.1; 
  }
  if (pos.x > boardMax.x - wallMargin) { 
    pos.x = boardMax.x - wallMargin; 
    vel.x = -abs(vel.x) * 0.1; 
  }
  if (pos.z < boardMin.z + wallMargin) { 
    pos.z = boardMin.z + wallMargin; 
    vel.z = abs(vel.z) * 0.1; 
  }
  if (pos.z > boardMax.z - wallMargin) { 
    pos.z = boardMax.z - wallMargin; 
    vel.z = -abs(vel.z) * 0.1; 
  }
  
  // Clamp Y to prevent going below floor
  if (pos.y < floorY) pos.y = floorY + particleRadius;
  
  gl_FragColor = vec4(pos, alive);
}
`;

const velocityFragmentShader = `
precision highp float;

uniform sampler2D positionTexture;
uniform sampler2D velocityTexture;
uniform float deltaTime;
uniform float gravity;
uniform float damping;
uniform float friction;
uniform float floorY;

varying vec2 vUv;

void main() {
  vec4 posData = texture2D(positionTexture, vUv);
  vec4 velData = texture2D(velocityTexture, vUv);
  
  vec3 pos = posData.xyz;
  float alive = posData.w;
  vec3 vel = velData.xyz;
  
  if (alive < 0.5) {
    gl_FragColor = velData;
    return;
  }
  
  vel.y += gravity * deltaTime;
  vel *= damping;
  
  vec3 newPos = pos + vel * deltaTime;
  
  if (newPos.y < floorY) {
    vel.y *= -0.1;
    vel.x *= friction;
    vel.z *= friction;
    if (abs(vel.y) < 0.1) vel.y = 0.0;
  }
  
  gl_FragColor = vec4(vel, velData.w);
}
`;

const renderVertexShader = `
uniform sampler2D positionTexture;
uniform sampler2D colorTexture;
uniform float pointSize;

attribute vec2 particleUv;

varying vec3 vColor;
varying float vAlive;

void main() {
  vec4 posData = texture2D(positionTexture, particleUv);
  vec4 colData = texture2D(colorTexture, particleUv);
  
  vColor = colData.rgb;
  vAlive = posData.w;
  
  if (vAlive < 0.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  
  vec4 mvPosition = modelViewMatrix * vec4(posData.xyz, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = pointSize * (300.0 / -mvPosition.z);
}
`;

const renderFragmentShader = `
precision highp float;

varying vec3 vColor;
varying float vAlive;

void main() {
  if (vAlive < 0.5) discard;
  
  // Square sand grain shape (no circle discard)
  // Add slight edge darkening for 3D effect
  vec2 edge = abs(gl_PointCoord - 0.5) * 2.0;
  float edgeFactor = max(edge.x, edge.y);
  vec3 finalColor = vColor * (1.0 - edgeFactor * 0.3);
  
  gl_FragColor = vec4(finalColor, 1.0);
}
`;

export interface GPUSandSystem {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  
  positionRT: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  velocityRT: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  colorRT: THREE.WebGLRenderTarget;
  
  physicsMaterial: THREE.ShaderMaterial;
  velocityMaterial: THREE.ShaderMaterial;
  renderMaterial: THREE.ShaderMaterial;
  
  quadMesh: THREE.Mesh;
  points: THREE.Points;
  
  currentIndex: number;
  particleCount: number;
  nextSlot: number;
  
  gravity: number;
  damping: number;
  friction: number;
  floorY: number;
  boardMin: THREE.Vector3;
  boardMax: THREE.Vector3;
  particleRadius: number;
  
  positionData: Float32Array;
  velocityData: Float32Array;
  colorData: Float32Array;
  needsUpload: boolean;
}

function createFloatRenderTarget(): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(TEXTURE_SIZE, TEXTURE_SIZE, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
  });
}

export function checkGPUCapabilities(renderer: THREE.WebGLRenderer): boolean {
  const gl = renderer.getContext();
  const isWebGL2 = renderer.capabilities.isWebGL2;
  
  if (isWebGL2) {
    const colorBufferFloat = gl.getExtension('EXT_color_buffer_float');
    if (!colorBufferFloat) {
      console.warn('[GPU Sand] EXT_color_buffer_float not supported in WebGL2');
      return false;
    }
    return true;
  }
  
  const floatTexExt = gl.getExtension('OES_texture_float');
  const colorBufferFloatExt = gl.getExtension('WEBGL_color_buffer_float') || gl.getExtension('EXT_color_buffer_float');
  
  if (!floatTexExt || !colorBufferFloatExt) {
    console.warn('[GPU Sand] Float texture or color buffer float not supported');
    return false;
  }
  
  return true;
}

function checkFramebufferComplete(renderer: THREE.WebGLRenderer, rt: THREE.WebGLRenderTarget): boolean {
  const gl = renderer.getContext();
  renderer.setRenderTarget(rt);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  renderer.setRenderTarget(null);
  return status === gl.FRAMEBUFFER_COMPLETE;
}

export function createGPUSandSystem(renderer: THREE.WebGLRenderer): GPUSandSystem | null {
  if (!checkGPUCapabilities(renderer)) {
    console.warn('[GPU Sand] Float textures not supported, GPU sand disabled');
    return null;
  }
  
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  
  const testRT = createFloatRenderTarget();
  if (!checkFramebufferComplete(renderer, testRT)) {
    console.warn('[GPU Sand] Float framebuffer not complete, GPU sand disabled');
    testRT.dispose();
    return null;
  }
  testRT.dispose();
  
  const positionRT: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] = [
    createFloatRenderTarget(),
    createFloatRenderTarget(),
  ];
  
  const velocityRT: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] = [
    createFloatRenderTarget(),
    createFloatRenderTarget(),
  ];
  
  const colorRT = createFloatRenderTarget();
  
  const quadGeometry = new THREE.PlaneGeometry(2, 2);
  
  // Very tiny particles for realistic sand appearance
  const particleRadius = 0.015;
  
  const physicsMaterial = new THREE.ShaderMaterial({
    vertexShader: physicsVertexShader,
    fragmentShader: physicsFragmentShader,
    uniforms: {
      positionTexture: { value: null },
      velocityTexture: { value: null },
      deltaTime: { value: 0 },
      gravity: { value: -30 },
      damping: { value: 0.98 },
      friction: { value: 0.75 },
      floorY: { value: 0 },
      // Tight board boundaries to prevent particles escaping
      boardMin: { value: new THREE.Vector3(0.0, 0, -0.3) },
      boardMax: { value: new THREE.Vector3(10.0, 20, 0.3) },
      particleRadius: { value: particleRadius },
    },
  });
  
  const velocityMaterial = new THREE.ShaderMaterial({
    vertexShader: physicsVertexShader,
    fragmentShader: velocityFragmentShader,
    uniforms: {
      positionTexture: { value: null },
      velocityTexture: { value: null },
      deltaTime: { value: 0 },
      gravity: { value: -35 },
      damping: { value: 0.98 },
      friction: { value: 0.7 },
      floorY: { value: -10 },
    },
  });
  
  const quadMesh = new THREE.Mesh(quadGeometry, physicsMaterial);
  scene.add(quadMesh);
  
  const particleUvs = new Float32Array(MAX_PARTICLES * 2);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const x = (i % TEXTURE_SIZE) / TEXTURE_SIZE + 0.5 / TEXTURE_SIZE;
    const y = Math.floor(i / TEXTURE_SIZE) / TEXTURE_SIZE + 0.5 / TEXTURE_SIZE;
    particleUvs[i * 2] = x;
    particleUvs[i * 2 + 1] = y;
  }
  
  const pointsGeometry = new THREE.BufferGeometry();
  pointsGeometry.setAttribute('particleUv', new THREE.BufferAttribute(particleUvs, 2));
  pointsGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3));
  
  const renderMaterial = new THREE.ShaderMaterial({
    vertexShader: renderVertexShader,
    fragmentShader: renderFragmentShader,
    uniforms: {
      positionTexture: { value: null },
      colorTexture: { value: null },
      pointSize: { value: 0.4 }, // Very small point size for fine sand grains
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  
  const points = new THREE.Points(pointsGeometry, renderMaterial);
  
  const positionData = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  const velocityData = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  const colorData = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  
  renderMaterial.uniforms.positionTexture.value = positionRT[0].texture;
  renderMaterial.uniforms.colorTexture.value = colorRT.texture;
  
  return {
    renderer,
    scene,
    camera,
    positionRT,
    velocityRT,
    colorRT,
    physicsMaterial,
    velocityMaterial,
    renderMaterial,
    quadMesh,
    points,
    currentIndex: 0,
    particleCount: 0,
    nextSlot: 0,
    gravity: -30,
    damping: 0.98,
    friction: 0.75,
    floorY: 0,
    // Tight boundaries matching the game board exactly
    boardMin: new THREE.Vector3(0.0, 0, -0.3),
    boardMax: new THREE.Vector3(10.0, 20, 0.3),
    particleRadius,
    positionData,
    velocityData,
    colorData,
    needsUpload: true,
  };
}

export function addParticleToGPUSand(
  system: GPUSandSystem,
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  r: number,
  g: number,
  b: number
): void {
  if (system.nextSlot >= MAX_PARTICLES) return;
  
  const idx = system.nextSlot * 4;
  
  system.positionData[idx] = x;
  system.positionData[idx + 1] = y;
  system.positionData[idx + 2] = z;
  system.positionData[idx + 3] = 1.0;
  
  system.velocityData[idx] = vx;
  system.velocityData[idx + 1] = vy;
  system.velocityData[idx + 2] = vz;
  system.velocityData[idx + 3] = 1.0;
  
  system.colorData[idx] = r;
  system.colorData[idx + 1] = g;
  system.colorData[idx + 2] = b;
  system.colorData[idx + 3] = 1.0;
  
  system.nextSlot++;
  system.particleCount = system.nextSlot;
  system.needsUpload = true;
}

export function addBlockAsGPUSand(
  system: GPUSandSystem,
  cellX: number,
  cellY: number,
  color: string,
  explode: boolean = false
): void {
  // Many tiny particles for ultra-fine sand effect
  const PARTICLES_PER_CELL = 300;
  const cellSize = 1.0;
  // Spread particles throughout the cell
  const particleSpread = cellSize * 0.45;
  
  // Convert board coordinates to 3D visual coordinates
  // Board Y: 0 = top, 19 = bottom
  // Visual Y: 0 = bottom, 19 = top
  const BOARD_HEIGHT = 20;
  const baseX = cellX + 0.5;
  const baseY = (BOARD_HEIGHT - 1 - cellY) + 0.5;
  const baseZ = 0;
  
  let r = 0.5, g = 0.5, b = 0.5;
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    r = parseInt(hex.slice(0, 2), 16) / 255;
    g = parseInt(hex.slice(2, 4), 16) / 255;
    b = parseInt(hex.slice(4, 6), 16) / 255;
  }
  
  for (let i = 0; i < PARTICLES_PER_CELL; i++) {
    // Uniform distribution within cell bounds
    const px = baseX + (Math.random() - 0.5) * particleSpread;
    const py = baseY + (Math.random() - 0.5) * particleSpread;
    // Very narrow Z spread to keep particles on the board
    const pz = baseZ + (Math.random() - 0.5) * 0.15;
    
    let vx = 0, vy = 0, vz = 0;
    if (explode) {
      // Contained explosion with slight downward bias
      const spread = 1.5;
      vx = (Math.random() - 0.5) * spread;
      vy = -Math.random() * spread * 0.5; // Fall downward
      vz = (Math.random() - 0.5) * spread * 0.3;
    }
    
    // Subtle color variation for natural sand look
    const colorVar = 0.12;
    const pr = Math.max(0, Math.min(1, r + (Math.random() - 0.5) * colorVar));
    const pg = Math.max(0, Math.min(1, g + (Math.random() - 0.5) * colorVar));
    const pb = Math.max(0, Math.min(1, b + (Math.random() - 0.5) * colorVar));
    
    addParticleToGPUSand(system, px, py, pz, vx, vy, vz, pr, pg, pb);
  }
}

export function addTetrominoAsGPUSand(
  system: GPUSandSystem,
  shape: number[][],
  posX: number,
  posY: number,
  color: string,
  explode: boolean = false
): void {
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col]) {
        const cellX = posX + col;
        const cellY = posY - row;
        addBlockAsGPUSand(system, cellX, cellY, color, explode);
      }
    }
  }
}

function uploadDataToTexture(
  renderer: THREE.WebGLRenderer,
  rt: THREE.WebGLRenderTarget,
  data: Float32Array
): void {
  const texture = new THREE.DataTexture(
    data,
    TEXTURE_SIZE,
    TEXTURE_SIZE,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  texture.needsUpdate = true;
  
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  
  texture.dispose();
  material.dispose();
  mesh.geometry.dispose();
}

export function stepGPUSandSystem(system: GPUSandSystem, deltaTime: number): void {
  const dt = Math.min(deltaTime, 0.033);
  
  if (system.needsUpload) {
    uploadDataToTexture(system.renderer, system.positionRT[0], system.positionData);
    uploadDataToTexture(system.renderer, system.positionRT[1], system.positionData);
    uploadDataToTexture(system.renderer, system.velocityRT[0], system.velocityData);
    uploadDataToTexture(system.renderer, system.velocityRT[1], system.velocityData);
    uploadDataToTexture(system.renderer, system.colorRT, system.colorData);
    system.needsUpload = false;
  }
  
  if (system.particleCount === 0 && !system.needsUpload) return;
  
  const readIdx = system.currentIndex;
  const writeIdx = 1 - system.currentIndex;
  
  system.velocityMaterial.uniforms.positionTexture.value = system.positionRT[readIdx].texture;
  system.velocityMaterial.uniforms.velocityTexture.value = system.velocityRT[readIdx].texture;
  system.velocityMaterial.uniforms.deltaTime.value = dt;
  system.velocityMaterial.uniforms.gravity.value = system.gravity;
  system.velocityMaterial.uniforms.damping.value = system.damping;
  system.velocityMaterial.uniforms.friction.value = system.friction;
  system.velocityMaterial.uniforms.floorY.value = system.floorY;
  
  system.quadMesh.material = system.velocityMaterial;
  system.renderer.setRenderTarget(system.velocityRT[writeIdx]);
  system.renderer.render(system.scene, system.camera);
  
  system.physicsMaterial.uniforms.positionTexture.value = system.positionRT[readIdx].texture;
  system.physicsMaterial.uniforms.velocityTexture.value = system.velocityRT[writeIdx].texture;
  system.physicsMaterial.uniforms.deltaTime.value = dt;
  system.physicsMaterial.uniforms.gravity.value = system.gravity;
  system.physicsMaterial.uniforms.damping.value = system.damping;
  system.physicsMaterial.uniforms.friction.value = system.friction;
  system.physicsMaterial.uniforms.floorY.value = system.floorY;
  system.physicsMaterial.uniforms.boardMin.value = system.boardMin;
  system.physicsMaterial.uniforms.boardMax.value = system.boardMax;
  system.physicsMaterial.uniforms.particleRadius.value = system.particleRadius;
  
  system.quadMesh.material = system.physicsMaterial;
  system.renderer.setRenderTarget(system.positionRT[writeIdx]);
  system.renderer.render(system.scene, system.camera);
  
  system.renderer.setRenderTarget(null);
  
  system.currentIndex = writeIdx;
  
  system.renderMaterial.uniforms.positionTexture.value = system.positionRT[writeIdx].texture;
  system.renderMaterial.uniforms.colorTexture.value = system.colorRT.texture;
}

export function clearGPUSandSystem(system: GPUSandSystem): void {
  system.positionData.fill(0);
  system.velocityData.fill(0);
  system.colorData.fill(0);
  system.particleCount = 0;
  system.nextSlot = 0;
  system.needsUpload = true;
}

export function disposeGPUSandSystem(system: GPUSandSystem): void {
  system.positionRT[0].dispose();
  system.positionRT[1].dispose();
  system.velocityRT[0].dispose();
  system.velocityRT[1].dispose();
  system.colorRT.dispose();
  system.physicsMaterial.dispose();
  system.velocityMaterial.dispose();
  system.renderMaterial.dispose();
  system.quadMesh.geometry.dispose();
  (system.points.geometry as THREE.BufferGeometry).dispose();
}

export function areAllGPUParticlesSettled(system: GPUSandSystem): boolean {
  return system.particleCount === 0;
}
