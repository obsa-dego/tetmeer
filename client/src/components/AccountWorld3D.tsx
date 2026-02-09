import { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const WORLD_SIZE = 50;
const CELL_SIZE = 1;
const GRID_DIVISIONS = WORLD_SIZE;
const AVATAR_HEIGHT = 1.6;
const AVATAR_RADIUS = 0.35;
const MAX_SPEED = 6;
const ACCELERATION = 28;
const FRICTION = 12;
const JUMP_FORCE = 9;
const GRAVITY = -25;
const CAMERA_DISTANCE = 5.5;
const CAMERA_HEIGHT_OFFSET = 2.2;
const MOUSE_SENSITIVITY = 0.003;

interface PlacedObject {
  id: string;
  modelId: string;
  gridX: number;
  gridZ: number;
  rotation: number;
  mesh: THREE.Object3D;
  bbox: THREE.Box3;
}

interface BuildableItem {
  id: string;
  name: string;
  modelPath?: string;
  color?: number;
  scale?: number;
}

const DEFAULT_BUILDABLE_ITEMS: BuildableItem[] = [
  { id: 'cube_red', name: 'Red Cube', color: 0xff4444, scale: 1 },
  { id: 'cube_blue', name: 'Blue Cube', color: 0x4444ff, scale: 1 },
  { id: 'cube_green', name: 'Green Cube', color: 0x44ff44, scale: 1 },
  { id: 'cube_yellow', name: 'Yellow Cube', color: 0xffff44, scale: 1 },
  { id: 'wall_white', name: 'White Wall', color: 0xeeeeee, scale: 1 },
  { id: 'deco_glass_cup', name: 'Glass Cup', modelPath: '/models/decorations/glass_cup.glb', scale: 7.5 },
  { id: 'deco_cartoon_pond', name: 'Cartoon Pond', modelPath: '/models/decorations/cartoon_pond.glb', scale: 0.5 },
];

function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else if (child.material) {
        child.material.dispose();
      }
    }
  });
}

interface LegoCharacterParts {
  head: THREE.Mesh;
  torso: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  hat: THREE.Mesh;
}

function createLegoCharacter(): { group: THREE.Group; parts: LegoCharacterParts } {
  const group = new THREE.Group();

  const skinColor = 0xfdd276;
  const torsoColor = 0x2266cc;
  const legColor = 0x1a1a6e;
  const handColor = skinColor;
  const hatColor = 0xcc2222;

  const torsoGeo = new THREE.BoxGeometry(0.55, 0.5, 0.3);
  const torsoMat = new THREE.MeshStandardMaterial({ color: torsoColor, roughness: 0.5, metalness: 0.1 });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.position.y = 0.85;
  torso.castShadow = true;
  group.add(torso);

  const neckBumpGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8);
  const neckBumpMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.4 });
  const neckBump = new THREE.Mesh(neckBumpGeo, neckBumpMat);
  neckBump.position.y = 1.13;
  neckBump.castShadow = true;
  group.add(neckBump);

  const headGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.35, 16);
  const headMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.4, metalness: 0.05 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.33;
  head.castShadow = true;
  group.add(head);

  const studGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8);
  const studMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.3 });
  const stud = new THREE.Mesh(studGeo, studMat);
  stud.position.y = 1.53;
  stud.castShadow = true;
  group.add(stud);

  const hatGeo = new THREE.CylinderGeometry(0.0, 0.24, 0.25, 16);
  const hatMat = new THREE.MeshStandardMaterial({ color: hatColor, roughness: 0.5, metalness: 0.1 });
  const hat = new THREE.Mesh(hatGeo, hatMat);
  hat.position.y = 1.63;
  hat.castShadow = true;
  group.add(hat);

  const eyeGeo = new THREE.SphereGeometry(0.03, 8, 8);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.08, 1.35, 0.21);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.08, 1.35, 0.21);
  group.add(rightEye);

  const smileShape = new THREE.Shape();
  smileShape.absarc(0, 0, 0.06, Math.PI * 0.15, Math.PI * 0.85, false);
  const smileGeo = new THREE.ShapeGeometry(smileShape);
  const smileMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide });
  const smile = new THREE.Mesh(smileGeo, smileMat);
  smile.position.set(0, 1.28, 0.222);
  smile.rotation.z = Math.PI;
  group.add(smile);

  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(-0.38, 1.05, 0);
  const leftArmGeo = new THREE.BoxGeometry(0.16, 0.42, 0.2);
  const leftArmMat = new THREE.MeshStandardMaterial({ color: torsoColor, roughness: 0.5, metalness: 0.1 });
  const leftArmMesh = new THREE.Mesh(leftArmGeo, leftArmMat);
  leftArmMesh.position.y = -0.18;
  leftArmMesh.castShadow = true;
  leftArmGroup.add(leftArmMesh);
  const leftHandGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8);
  const leftHandMat = new THREE.MeshStandardMaterial({ color: handColor, roughness: 0.4 });
  const leftHand = new THREE.Mesh(leftHandGeo, leftHandMat);
  leftHand.position.y = -0.42;
  leftHand.rotation.x = Math.PI / 6;
  leftArmGroup.add(leftHand);
  group.add(leftArmGroup);

  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0.38, 1.05, 0);
  const rightArmGeo = new THREE.BoxGeometry(0.16, 0.42, 0.2);
  const rightArmMat = new THREE.MeshStandardMaterial({ color: torsoColor, roughness: 0.5, metalness: 0.1 });
  const rightArmMesh = new THREE.Mesh(rightArmGeo, rightArmMat);
  rightArmMesh.position.y = -0.18;
  rightArmMesh.castShadow = true;
  rightArmGroup.add(rightArmMesh);
  const rightHandGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8);
  const rightHandMat = new THREE.MeshStandardMaterial({ color: handColor, roughness: 0.4 });
  const rightHand = new THREE.Mesh(rightHandGeo, rightHandMat);
  rightHand.position.y = -0.42;
  rightHand.rotation.x = Math.PI / 6;
  rightArmGroup.add(rightHand);
  group.add(rightArmGroup);

  const leftLegGroup = new THREE.Group();
  leftLegGroup.position.set(-0.13, 0.57, 0);
  const leftLegGeo = new THREE.BoxGeometry(0.2, 0.55, 0.25);
  const leftLegMat = new THREE.MeshStandardMaterial({ color: legColor, roughness: 0.6, metalness: 0.05 });
  const leftLegMesh = new THREE.Mesh(leftLegGeo, leftLegMat);
  leftLegMesh.position.y = -0.27;
  leftLegMesh.castShadow = true;
  leftLegGroup.add(leftLegMesh);
  const leftFootGeo = new THREE.BoxGeometry(0.2, 0.08, 0.35);
  const leftFootMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 });
  const leftFoot = new THREE.Mesh(leftFootGeo, leftFootMat);
  leftFoot.position.set(0, -0.55, 0.05);
  leftFoot.castShadow = true;
  leftLegGroup.add(leftFoot);
  group.add(leftLegGroup);

  const rightLegGroup = new THREE.Group();
  rightLegGroup.position.set(0.13, 0.57, 0);
  const rightLegGeo = new THREE.BoxGeometry(0.2, 0.55, 0.25);
  const rightLegMat = new THREE.MeshStandardMaterial({ color: legColor, roughness: 0.6, metalness: 0.05 });
  const rightLegMesh = new THREE.Mesh(rightLegGeo, rightLegMat);
  rightLegMesh.position.y = -0.27;
  rightLegMesh.castShadow = true;
  rightLegGroup.add(rightLegMesh);
  const rightFootGeo = new THREE.BoxGeometry(0.2, 0.08, 0.35);
  const rightFootMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 });
  const rightFoot = new THREE.Mesh(rightFootGeo, rightFootMat);
  rightFoot.position.set(0, -0.55, 0.05);
  rightFoot.castShadow = true;
  rightLegGroup.add(rightFoot);
  group.add(rightLegGroup);

  return {
    group,
    parts: {
      head,
      torso,
      leftArm: leftArmGroup,
      rightArm: rightArmGroup,
      leftLeg: leftLegGroup,
      rightLeg: rightLegGroup,
      hat,
    },
  };
}

function animateLegoCharacter(
  parts: LegoCharacterParts,
  time: number,
  speed: number,
  isGrounded: boolean,
  velocityY: number
) {
  const isMoving = speed > 0.3;
  const isJumping = !isGrounded;

  if (isJumping) {
    const jumpPhase = velocityY > 0 ? 0.3 : -0.15;
    parts.leftArm.rotation.x = THREE.MathUtils.lerp(parts.leftArm.rotation.x, -1.2, 0.15);
    parts.rightArm.rotation.x = THREE.MathUtils.lerp(parts.rightArm.rotation.x, -1.2, 0.15);
    parts.leftLeg.rotation.x = THREE.MathUtils.lerp(parts.leftLeg.rotation.x, jumpPhase, 0.15);
    parts.rightLeg.rotation.x = THREE.MathUtils.lerp(parts.rightLeg.rotation.x, jumpPhase, 0.15);
    parts.head.position.y = THREE.MathUtils.lerp(parts.head.position.y, 1.33, 0.1);
  } else if (isMoving) {
    const walkSpeed = Math.min(speed / MAX_SPEED, 1);
    const freq = 8 + walkSpeed * 6;
    const amplitude = 0.5 + walkSpeed * 0.4;

    parts.leftArm.rotation.x = Math.sin(time * freq) * amplitude;
    parts.rightArm.rotation.x = -Math.sin(time * freq) * amplitude;
    parts.leftLeg.rotation.x = -Math.sin(time * freq) * amplitude * 0.7;
    parts.rightLeg.rotation.x = Math.sin(time * freq) * amplitude * 0.7;

    const bobAmount = Math.abs(Math.sin(time * freq * 2)) * 0.03 * walkSpeed;
    parts.head.position.y = 1.33 + bobAmount;
    parts.torso.position.y = 0.85 + bobAmount * 0.5;
  } else {
    parts.leftArm.rotation.x = THREE.MathUtils.lerp(parts.leftArm.rotation.x, Math.sin(time * 1.5) * 0.05, 0.08);
    parts.rightArm.rotation.x = THREE.MathUtils.lerp(parts.rightArm.rotation.x, -Math.sin(time * 1.5) * 0.05, 0.08);
    parts.leftLeg.rotation.x = THREE.MathUtils.lerp(parts.leftLeg.rotation.x, 0, 0.1);
    parts.rightLeg.rotation.x = THREE.MathUtils.lerp(parts.rightLeg.rotation.x, 0, 0.1);

    const breathe = Math.sin(time * 2) * 0.008;
    parts.head.position.y = THREE.MathUtils.lerp(parts.head.position.y, 1.33 + breathe, 0.1);
    parts.torso.position.y = THREE.MathUtils.lerp(parts.torso.position.y, 0.85, 0.1);
  }
}

function getAvatarBBox(pos: THREE.Vector3): THREE.Box3 {
  const halfW = AVATAR_RADIUS;
  return new THREE.Box3(
    new THREE.Vector3(pos.x - halfW, pos.y, pos.z - halfW),
    new THREE.Vector3(pos.x + halfW, pos.y + AVATAR_HEIGHT, pos.z + halfW)
  );
}

function resolveCollisions(
  avatarPos: THREE.Vector3,
  prevPos: THREE.Vector3,
  velocity: THREE.Vector3,
  objects: PlacedObject[]
): boolean {
  let grounded = false;

  const testX = avatarPos.clone();
  testX.y = prevPos.y;
  testX.z = prevPos.z;
  for (const obj of objects) {
    const aBBox = getAvatarBBox(testX);
    if (aBBox.intersectsBox(obj.bbox)) {
      testX.x = prevPos.x;
      velocity.x = 0;
      break;
    }
  }

  const testZ = testX.clone();
  testZ.z = avatarPos.z;
  for (const obj of objects) {
    const aBBox = getAvatarBBox(testZ);
    if (aBBox.intersectsBox(obj.bbox)) {
      testZ.z = prevPos.z;
      velocity.z = 0;
      break;
    }
  }

  const testY = testZ.clone();
  testY.y = avatarPos.y;
  for (const obj of objects) {
    const aBBox = getAvatarBBox(testY);
    if (aBBox.intersectsBox(obj.bbox)) {
      if (velocity.y <= 0) {
        testY.y = obj.bbox.max.y;
        grounded = true;
      } else {
        testY.y = obj.bbox.min.y - AVATAR_HEIGHT;
      }
      velocity.y = 0;
      break;
    }
  }

  avatarPos.copy(testY);
  return grounded;
}

interface AccountWorld3DProps {
  floorModelPath?: string;
  onBuildModeChange?: (active: boolean) => void;
}

export function AccountWorld3D({ floorModelPath, onBuildModeChange }: AccountWorld3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const avatarRef = useRef<THREE.Group | null>(null);
  const avatarPartsRef = useRef<LegoCharacterParts | null>(null);
  const floorMeshRef = useRef<THREE.Object3D | null>(null);

  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef({ yaw: 0, pitch: 0.3 });
  const velocityRef = useRef(new THREE.Vector3());
  const horizontalVelRef = useRef(new THREE.Vector2());
  const isGroundedRef = useRef(true);
  const isPointerLockedRef = useRef(false);
  const animFrameRef = useRef<number>(0);
  const clockRef = useRef(new THREE.Clock());
  const raycasterRef = useRef(new THREE.Raycaster());
  const animTimeRef = useRef(0);

  const buildModeRef = useRef(false);
  const selectedItemRef = useRef<BuildableItem | null>(null);
  const [buildMode, setBuildMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BuildableItem | null>(null);
  const placedObjectsRef = useRef<PlacedObject[]>([]);
  const previewObjRef = useRef<THREE.Object3D | null>(null);

  const modelCacheRef = useRef<Map<string, THREE.Object3D>>(new Map());

  useEffect(() => {
    buildModeRef.current = buildMode;
  }, [buildMode]);
  useEffect(() => {
    selectedItemRef.current = selectedItem;
  }, [selectedItem]);

  const loadGLBModel = useCallback(async (path: string): Promise<THREE.Object3D> => {
    if (modelCacheRef.current.has(path)) {
      return modelCacheRef.current.get(path)!.clone();
    }
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        path,
        (gltf) => {
          const model = gltf.scene;
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          modelCacheRef.current.set(path, model);
          resolve(model.clone());
        },
        undefined,
        (error) => reject(error)
      );
    });
  }, []);

  const createDefaultFloor = useCallback(() => {
    const group = new THREE.Group();

    const floorGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a3a,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(WORLD_SIZE / 2, 0, WORLD_SIZE / 2);
    floor.receiveShadow = true;
    floor.name = 'floor';
    group.add(floor);

    const gridHelper = new THREE.GridHelper(WORLD_SIZE, GRID_DIVISIONS, 0x555555, 0x333333);
    gridHelper.position.set(WORLD_SIZE / 2, 0.01, WORLD_SIZE / 2);
    group.add(gridHelper);

    return group;
  }, []);

  const getFloorHeight = useCallback((x: number, z: number): number => {
    const floorObj = floorMeshRef.current;
    if (!floorObj) return 0;
    const ray = raycasterRef.current;
    ray.set(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));

    const meshes: THREE.Object3D[] = [];
    floorObj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshes.push(child);
      }
    });

    const intersects = ray.intersectObjects(meshes, true);
    if (intersects.length > 0) {
      return intersects[0].point.y;
    }
    return 0;
  }, []);

  const getCrosshairGridPosition = useCallback((): { gridX: number; gridZ: number; worldY: number } | null => {
    if (!cameraRef.current || !floorMeshRef.current) return null;

    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), cameraRef.current);

    const meshes: THREE.Object3D[] = [];
    floorMeshRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) meshes.push(child);
    });

    const intersects = ray.intersectObjects(meshes, true);
    if (intersects.length > 0) {
      const point = intersects[0].point;
      const gridX = Math.floor(point.x / CELL_SIZE);
      const gridZ = Math.floor(point.z / CELL_SIZE);
      if (gridX >= 0 && gridX < WORLD_SIZE && gridZ >= 0 && gridZ < WORLD_SIZE) {
        return { gridX, gridZ, worldY: point.y };
      }
    }
    return null;
  }, []);

  const isOccupied = useCallback((gridX: number, gridZ: number): boolean => {
    return placedObjectsRef.current.some(obj => obj.gridX === gridX && obj.gridZ === gridZ);
  }, []);

  const clearPreview = useCallback(() => {
    if (previewObjRef.current && sceneRef.current) {
      sceneRef.current.remove(previewObjRef.current);
      disposeObject3D(previewObjRef.current);
      previewObjRef.current = null;
    }
  }, []);

  const computeObjectBBox = useCallback((mesh: THREE.Object3D, gridX: number, gridZ: number): THREE.Box3 => {
    const box = new THREE.Box3().setFromObject(mesh);
    if (box.isEmpty()) {
      const cx = gridX * CELL_SIZE + CELL_SIZE / 2;
      const cz = gridZ * CELL_SIZE + CELL_SIZE / 2;
      const half = CELL_SIZE * 0.45;
      return new THREE.Box3(
        new THREE.Vector3(cx - half, 0, cz - half),
        new THREE.Vector3(cx + half, CELL_SIZE * 0.9, cz + half)
      );
    }
    return box;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 30, 60);
    sceneRef.current = scene;

    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.0);
    dirLight.position.set(20, 30, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 80;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    scene.add(dirLight);

    const hemiLight = new THREE.HemisphereLight(0x6688cc, 0x443322, 0.4);
    scene.add(hemiLight);

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 200);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    const floorGroup = createDefaultFloor();
    scene.add(floorGroup);
    floorMeshRef.current = floorGroup;

    if (floorModelPath) {
      loadGLBModel(floorModelPath).then((model) => {
        scene.remove(floorGroup);
        disposeObject3D(floorGroup);
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.z);
        const scale = WORLD_SIZE / maxDim;
        model.scale.set(scale, scale, scale);

        const newBox = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        newBox.getCenter(center);
        model.position.set(WORLD_SIZE / 2 - center.x, -newBox.min.y, WORLD_SIZE / 2 - center.z);
        model.name = 'floor';
        scene.add(model);
        floorMeshRef.current = model;
      }).catch(() => {});
    }

    const { group: avatar, parts } = createLegoCharacter();
    avatar.position.set(WORLD_SIZE / 2, 0, WORLD_SIZE / 2);
    scene.add(avatar);
    avatarRef.current = avatar;
    avatarPartsRef.current = parts;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      keysRef.current.add(e.code);
      if (e.code === 'Space' && isGroundedRef.current) {
        velocityRef.current.y = JUMP_FORCE;
        isGroundedRef.current = false;
        e.preventDefault();
      }
      if (e.code === 'KeyB') {
        setBuildMode(prev => !prev);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPointerLockedRef.current) return;
      mouseRef.current.yaw -= e.movementX * MOUSE_SENSITIVITY;
      mouseRef.current.pitch -= e.movementY * MOUSE_SENSITIVITY;
      mouseRef.current.pitch = Math.max(-0.5, Math.min(1.2, mouseRef.current.pitch));
    };

    const handleClick = () => {
      if (!isPointerLockedRef.current) {
        container.requestPointerLock();
        return;
      }
      if (buildModeRef.current && selectedItemRef.current) {
        placeBuildItem(selectedItemRef.current);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (!isPointerLockedRef.current) return;
      if (!buildModeRef.current) return;

      const gridPos = getCrosshairGridPosition();
      if (!gridPos) return;

      const idx = placedObjectsRef.current.findIndex(
        obj => obj.gridX === gridPos.gridX && obj.gridZ === gridPos.gridZ
      );
      if (idx !== -1) {
        const removed = placedObjectsRef.current.splice(idx, 1)[0];
        scene.remove(removed.mesh);
        disposeObject3D(removed.mesh);
      }
    };

    const placeBuildItem = (item: BuildableItem) => {
      const gridPos = getCrosshairGridPosition();
      if (!gridPos || isOccupied(gridPos.gridX, gridPos.gridZ)) return;

      const worldX = gridPos.gridX * CELL_SIZE + CELL_SIZE / 2;
      const worldZ = gridPos.gridZ * CELL_SIZE + CELL_SIZE / 2;
      const worldY = gridPos.worldY;

      if (item.modelPath) {
        loadGLBModel(item.modelPath).then((model) => {
          const scale = item.scale ?? 1;
          model.scale.set(scale, scale, scale);
          model.position.set(worldX, worldY, worldZ);
          scene.add(model);

          const bbox = computeObjectBBox(model, gridPos.gridX, gridPos.gridZ);
          placedObjectsRef.current.push({
            id: `obj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            modelId: item.id,
            gridX: gridPos.gridX,
            gridZ: gridPos.gridZ,
            rotation: 0,
            mesh: model,
            bbox,
          });
        });
      } else {
        const geo = new THREE.BoxGeometry(CELL_SIZE * 0.9, CELL_SIZE * 0.9, CELL_SIZE * 0.9);
        const mat = new THREE.MeshStandardMaterial({
          color: item.color ?? 0xffffff,
          roughness: 0.6,
          metalness: 0.1,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.set(worldX, worldY + CELL_SIZE * 0.45, worldZ);
        scene.add(mesh);

        const bbox = computeObjectBBox(mesh, gridPos.gridX, gridPos.gridZ);
        placedObjectsRef.current.push({
          id: `obj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          modelId: item.id,
          gridX: gridPos.gridX,
          gridZ: gridPos.gridZ,
          rotation: 0,
          mesh,
          bbox,
        });
      }
    };

    const handlePointerLockChange = () => {
      isPointerLockedRef.current = document.pointerLockElement === container;
    };

    const handleResize = () => {
      if (!container || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('click', handleClick);
    container.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    window.addEventListener('resize', handleResize);

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = Math.min(clockRef.current.getDelta(), 0.05);
      animTimeRef.current += delta;

      if (!avatarRef.current || !cameraRef.current) return;

      const keys = keysRef.current;
      const forward = new THREE.Vector3(0, 0, -1);
      const right = new THREE.Vector3(1, 0, 0);
      forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), mouseRef.current.yaw);
      right.applyAxisAngle(new THREE.Vector3(0, 1, 0), mouseRef.current.yaw);

      const inputDir = new THREE.Vector3();
      if (keys.has('KeyW') || keys.has('ArrowUp')) inputDir.add(forward);
      if (keys.has('KeyS') || keys.has('ArrowDown')) inputDir.sub(forward);
      if (keys.has('KeyA') || keys.has('ArrowLeft')) inputDir.sub(right);
      if (keys.has('KeyD') || keys.has('ArrowRight')) inputDir.add(right);

      const hasInput = inputDir.lengthSq() > 0;
      if (hasInput) inputDir.normalize();

      const hVel = horizontalVelRef.current;

      if (hasInput) {
        hVel.x += inputDir.x * ACCELERATION * delta;
        hVel.y += inputDir.z * ACCELERATION * delta;
      }

      const currentSpeed = hVel.length();
      if (currentSpeed > MAX_SPEED) {
        hVel.multiplyScalar(MAX_SPEED / currentSpeed);
      }

      if (!hasInput || currentSpeed > MAX_SPEED) {
        const frictionFactor = Math.max(0, 1 - FRICTION * delta);
        if (!hasInput) {
          hVel.multiplyScalar(frictionFactor);
          if (hVel.length() < 0.1) {
            hVel.set(0, 0);
          }
        }
      }

      const vel = velocityRef.current;
      vel.x = hVel.x;
      vel.z = hVel.y;

      vel.y += GRAVITY * delta;

      const pos = avatarRef.current.position;
      const prevPos = pos.clone();

      pos.x += vel.x * delta;
      pos.z += vel.z * delta;
      pos.y += vel.y * delta;

      isGroundedRef.current = false;

      const groundY = getFloorHeight(pos.x, pos.z);
      if (pos.y <= groundY) {
        pos.y = groundY;
        vel.y = 0;
        isGroundedRef.current = true;
      }

      const landedOnObject = resolveCollisions(pos, prevPos, vel, placedObjectsRef.current);
      if (landedOnObject) {
        isGroundedRef.current = true;
      }

      hVel.x = vel.x;
      hVel.y = vel.z;

      pos.x = Math.max(0.5, Math.min(WORLD_SIZE - 0.5, pos.x));
      pos.z = Math.max(0.5, Math.min(WORLD_SIZE - 0.5, pos.z));

      if (pos.y < -10) {
        pos.set(WORLD_SIZE / 2, 5, WORLD_SIZE / 2);
        vel.set(0, 0, 0);
        hVel.set(0, 0);
      }

      const moveSpeed = hVel.length();
      if (hasInput && moveSpeed > 0.3) {
        const targetAngle = Math.atan2(inputDir.x, inputDir.z);
        let currentAngle = avatarRef.current.rotation.y;
        let diff = targetAngle - currentAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        avatarRef.current.rotation.y += diff * Math.min(1, 12 * delta);
      }

      if (avatarPartsRef.current) {
        animateLegoCharacter(
          avatarPartsRef.current,
          animTimeRef.current,
          moveSpeed,
          isGroundedRef.current,
          vel.y
        );
      }

      const camOffset = new THREE.Vector3(
        Math.sin(mouseRef.current.yaw) * CAMERA_DISTANCE * Math.cos(mouseRef.current.pitch),
        CAMERA_HEIGHT_OFFSET + Math.sin(mouseRef.current.pitch) * CAMERA_DISTANCE,
        Math.cos(mouseRef.current.yaw) * CAMERA_DISTANCE * Math.cos(mouseRef.current.pitch)
      );

      const targetCamPos = new THREE.Vector3().copy(pos).add(camOffset);
      targetCamPos.y = Math.max(targetCamPos.y, groundY + 0.5);

      camera.position.lerp(targetCamPos, 1 - Math.pow(0.01, delta));
      const lookTarget = new THREE.Vector3(pos.x, pos.y + AVATAR_HEIGHT * 0.7, pos.z);
      camera.lookAt(lookTarget);

      if (buildModeRef.current && previewObjRef.current) {
        const gridPos = getCrosshairGridPosition();
        if (gridPos && !isOccupied(gridPos.gridX, gridPos.gridZ)) {
          previewObjRef.current.visible = true;
          previewObjRef.current.position.set(
            gridPos.gridX * CELL_SIZE + CELL_SIZE / 2,
            gridPos.worldY + CELL_SIZE * 0.45,
            gridPos.gridZ * CELL_SIZE + CELL_SIZE / 2
          );
        } else {
          previewObjRef.current.visible = false;
        }
      }

      renderer.render(scene, camera);
    };

    clockRef.current.start();
    animate();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      window.removeEventListener('resize', handleResize);

      if (document.pointerLockElement === container) {
        document.exitPointerLock();
      }

      cancelAnimationFrame(animFrameRef.current);

      placedObjectsRef.current.forEach(obj => {
        disposeObject3D(obj.mesh);
      });
      placedObjectsRef.current = [];

      if (previewObjRef.current) {
        disposeObject3D(previewObjRef.current);
        previewObjRef.current = null;
      }

      modelCacheRef.current.forEach((model) => {
        disposeObject3D(model);
      });
      modelCacheRef.current.clear();

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else if (obj.material) {
            obj.material.dispose();
          }
        }
      });

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [floorModelPath, createDefaultFloor, getFloorHeight, getCrosshairGridPosition, isOccupied, loadGLBModel, clearPreview, computeObjectBBox]);

  useEffect(() => {
    onBuildModeChange?.(buildMode);
  }, [buildMode, onBuildModeChange]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    clearPreview();

    if (buildMode && selectedItem) {
      if (selectedItem.modelPath) {
        loadGLBModel(selectedItem.modelPath).then((model) => {
          if (!buildModeRef.current || selectedItemRef.current?.id !== selectedItem.id) {
            disposeObject3D(model);
            return;
          }
          const scale = selectedItem.scale ?? 1;
          model.scale.set(scale, scale, scale);
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const mat = child.material as THREE.MeshStandardMaterial;
              if (mat.clone) {
                const previewMat = mat.clone();
                previewMat.transparent = true;
                previewMat.opacity = 0.5;
                child.material = previewMat;
              }
            }
          });
          model.visible = false;
          scene.add(model);
          previewObjRef.current = model;
        }).catch(() => {});
      } else {
        const geo = new THREE.BoxGeometry(CELL_SIZE * 0.9, CELL_SIZE * 0.9, CELL_SIZE * 0.9);
        const mat = new THREE.MeshStandardMaterial({
          color: selectedItem.color ?? 0xffffff,
          transparent: true,
          opacity: 0.5,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.visible = false;
        scene.add(mesh);
        previewObjRef.current = mesh;
      }
    }

    return () => {
      clearPreview();
    };
  }, [buildMode, selectedItem, loadGLBModel, clearPreview]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full cursor-crosshair"
        data-testid="account-world-3d"
      />

      <div className="absolute top-3 left-3 bg-black/70 text-white px-3 py-2 rounded-lg text-xs backdrop-blur-sm pointer-events-none select-none" data-testid="world-controls-hint">
        <div className="font-bold mb-1 text-sm">Controls</div>
        <div>Click to look around</div>
        <div>WASD / Arrows to move</div>
        <div>Space to jump</div>
        <div>B to toggle build mode</div>
        <div>ESC to release mouse</div>
      </div>

      {buildMode && (
        <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-2 pointer-events-auto" data-testid="build-panel">
          <div className="bg-black/80 text-white px-3 py-2 rounded-lg backdrop-blur-sm text-xs text-center font-bold" data-testid="build-mode-indicator">
            BUILD MODE (Left click: place | Right click: remove | B: exit)
          </div>
          <div className="bg-black/80 rounded-lg backdrop-blur-sm p-2 flex gap-1.5 overflow-x-auto">
            {DEFAULT_BUILDABLE_ITEMS.map((item) => (
              <button
                key={item.id}
                data-testid={`build-item-${item.id}`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setSelectedItem(prev => prev?.id === item.id ? null : item);
                }}
                className={`flex-shrink-0 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  selectedItem?.id === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                {item.modelPath && <span className="mr-1">3D</span>}
                {!item.modelPath && item.color && (
                  <span
                    className="inline-block w-3 h-3 rounded-sm mr-1 align-middle"
                    style={{ backgroundColor: `#${item.color.toString(16).padStart(6, '0')}` }}
                  />
                )}
                {item.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-20">
        {buildMode && (
          <div className="relative w-6 h-6">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/60" />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/60" />
          </div>
        )}
      </div>
    </div>
  );
}
