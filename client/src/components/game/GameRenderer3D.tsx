import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GameState, BOARD_WIDTH, BOARD_HEIGHT, getGhostPosition, PhysicsFallingBlock, FALL_SPEED } from '@/lib/game-engine';
import { BlockTexture, PlacedDecoration } from '@shared/schema';
import { DECORATION_ITEMS, DECORATION_SLOT_POSITIONS } from '@/lib/decoration-items';
import { isModelTexture, BLOCK_MODELS, loadBlockModel, getModelGeometry, getModelMaterial, isDecorationWithModel, loadDecorationModel, getCachedDecorationModel, DECORATION_MODELS } from '@/lib/model-loader';
import { loadAndNormalizeFloorModel, createGridHelper, DEFAULT_GRID_CONFIG } from '@/lib/floor-grid-system';

export interface PhysicsBlockPosition {
  id: string;
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  rotationW: number;
  color: string;
  size?: number;
}

type GridMaterialType = 'default' | 'glass' | 'metal' | 'neon' | 'hologram' | 'matrix' | 'lava' | 'ice';
type BoardMaterialType = 'default' | 'glass' | 'metal' | 'neon' | 'hologram' | 'matrix' | 'carbon' | 'galaxy';

type ViewModeType = '2d' | '3d';

export interface ExternalCameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

interface GameRenderer3DProps {
  gameState: GameState;
  onRotatingChange?: (isRotating: boolean) => void;
  onCameraChange?: (camera: ExternalCameraState) => void;
  externalCamera?: ExternalCameraState;
  spectatorMode?: boolean;
  blockTexture?: BlockTexture;
  backgroundColor?: string;
  gridColor?: string;
  invertX?: boolean;
  invertY?: boolean;
  mouseSensitivity?: number;
  wheelSensitivity?: number;
  sandPhysicsBlocks?: PhysicsBlockPosition[];
  useSandPhysics?: boolean;
  sandPoints?: THREE.Points;
  engine?: 'gravity' | 'classic' | 'sand';
  showPet?: boolean;
  petType?: string;
  selectedPets?: string[];
  gridMaterial?: GridMaterialType;
  boardMaterial?: BoardMaterialType;
  viewMode?: ViewModeType;
  equippedDecorations?: Record<string, string>;
  placedDecorations?: PlacedDecoration[];
  onPlaceDecoration?: (x: number, z: number) => void;
  placementPreviewItem?: string | null;
  onRendererReady?: (renderer: THREE.WebGLRenderer) => void;
  onFrame?: (deltaTime: number) => void;
  customFloorModelPath?: string;
  showFloorGrid?: boolean;
  liteMode?: boolean;
  onDebugLog?: (source: string, message: string, data?: any) => void;
  onContextLost?: () => void;
}

type PetType = 'pet_puppy' | 'pet_cat' | 'pet_lion' | 'pet_gecko' | 'pet_dragon' | 'pet_turtle' | 'pet_crab';

type PetState = 'idle' | 'walking' | 'sitting';

function createPetModel(petType: string): THREE.Group {
  const petGroup = new THREE.Group();
  
  switch (petType) {
    case 'pet_cat':
      return createCatModel();
    case 'pet_lion':
      return createLionModel();
    case 'pet_gecko':
      return createGeckoModel();
    case 'pet_dragon':
      return createDragonModel();
    case 'pet_turtle':
      return createTurtleModel();
    case 'pet_crab':
      return createCrabModel();
    case 'pet_puppy':
    default:
      return createDogModel();
  }
}

function createDogModel(): THREE.Group {
  const dogGroup = new THREE.Group();
  const furColor = new THREE.Color(0xD2691E);
  const lightFurColor = new THREE.Color(0xF5DEB3);
  const noseColor = new THREE.Color(0x1a1a1a);
  const tongueColor = new THREE.Color(0xFF6B8A);
  
  const furMaterial = new THREE.MeshStandardMaterial({ color: furColor, roughness: 0.9 });
  const lightFurMaterial = new THREE.MeshStandardMaterial({ color: lightFurColor, roughness: 0.9 });
  const noseMaterial = new THREE.MeshStandardMaterial({ color: noseColor, roughness: 0.3 });
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1 });
  const tongueMaterial = new THREE.MeshStandardMaterial({ color: tongueColor, roughness: 0.6 });
  
  // Body
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.6, 8, 16), furMaterial);
  body.rotation.z = Math.PI / 2;
  body.position.set(0, 0.45, 0);
  dogGroup.add(body);
  
  // Belly
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), lightFurMaterial);
  belly.scale.set(1, 0.6, 0.8);
  belly.position.set(0, 0.35, 0);
  dogGroup.add(belly);
  
  // Head
  const headGroup = new THREE.Group();
  headGroup.name = 'headGroup';
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), furMaterial);
  head.scale.set(1, 0.9, 0.85);
  headGroup.add(head);
  
  // Snout & Nose
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), lightFurMaterial);
  snout.scale.set(0.7, 0.5, 0.8);
  snout.position.set(0.2, -0.05, 0);
  headGroup.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), noseMaterial);
  nose.position.set(0.32, 0, 0);
  headGroup.add(nose);
  
  // Eyes
  const eyeGeom = new THREE.SphereGeometry(0.07, 12, 12);
  const leftEye = new THREE.Mesh(eyeGeom, eyeMaterial);
  leftEye.position.set(0.18, 0.1, 0.15);
  headGroup.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeom, eyeMaterial);
  rightEye.position.set(0.18, 0.1, -0.15);
  headGroup.add(rightEye);
  
  // Tongue
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), tongueMaterial);
  tongue.scale.set(0.6, 0.3, 1);
  tongue.position.set(0.26, -0.12, 0);
  tongue.name = 'tongue';
  headGroup.add(tongue);
  
  // Ears
  const earGeom = new THREE.ConeGeometry(0.12, 0.25, 8);
  const leftEarGroup = new THREE.Group();
  leftEarGroup.name = 'leftEar';
  leftEarGroup.add(new THREE.Mesh(earGeom, furMaterial));
  leftEarGroup.position.set(-0.05, 0.25, 0.2);
  leftEarGroup.rotation.set(0.3, 0, -0.4);
  headGroup.add(leftEarGroup);
  const rightEarGroup = new THREE.Group();
  rightEarGroup.name = 'rightEar';
  rightEarGroup.add(new THREE.Mesh(earGeom, furMaterial));
  rightEarGroup.position.set(-0.05, 0.25, -0.2);
  rightEarGroup.rotation.set(-0.3, 0, -0.4);
  headGroup.add(rightEarGroup);
  
  headGroup.position.set(0.5, 0.65, 0);
  dogGroup.add(headGroup);
  
  // Legs
  const legGeom = new THREE.CapsuleGeometry(0.08, 0.2, 4, 8);
  const pawGeom = new THREE.SphereGeometry(0.1, 8, 8);
  ['frontLeft', 'frontRight', 'backLeft', 'backRight'].forEach((name, i) => {
    const legGroup = new THREE.Group();
    legGroup.name = name + 'Leg';
    legGroup.add(new THREE.Mesh(legGeom, furMaterial));
    const paw = new THREE.Mesh(pawGeom, lightFurMaterial);
    paw.scale.set(1, 0.5, 1);
    paw.position.y = -0.25;
    legGroup.add(paw);
    const x = i < 2 ? 0.25 : -0.25;
    const z = i % 2 === 0 ? 0.2 : -0.2;
    legGroup.position.set(x, 0.25, z);
    dogGroup.add(legGroup);
  });
  
  // Tail
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tailGroup';
  tailGroup.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.3, 4, 8), furMaterial));
  tailGroup.position.set(-0.45, 0.5, 0);
  tailGroup.rotation.z = -0.5;
  dogGroup.add(tailGroup);
  
  return dogGroup;
}

function createCatModel(): THREE.Group {
  const catGroup = new THREE.Group();
  const furColor = new THREE.Color(0x808080);
  const lightFurColor = new THREE.Color(0xD3D3D3);
  
  const furMaterial = new THREE.MeshStandardMaterial({ color: furColor, roughness: 0.8 });
  const lightFurMaterial = new THREE.MeshStandardMaterial({ color: lightFurColor, roughness: 0.8 });
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x32CD32, roughness: 0.1, metalness: 0.3 });
  const noseMaterial = new THREE.MeshStandardMaterial({ color: 0xFFB6C1, roughness: 0.4 });
  
  // Body (slimmer than dog)
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 8, 16), furMaterial);
  body.rotation.z = Math.PI / 2;
  body.position.set(0, 0.4, 0);
  catGroup.add(body);
  
  // Head (rounder)
  const headGroup = new THREE.Group();
  headGroup.name = 'headGroup';
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), furMaterial);
  headGroup.add(head);
  
  // Cat eyes (almond shaped)
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), eyeMaterial);
  leftEye.scale.set(0.7, 1, 0.5);
  leftEye.position.set(0.18, 0.05, 0.12);
  headGroup.add(leftEye);
  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), eyeMaterial);
  rightEye.scale.set(0.7, 1, 0.5);
  rightEye.position.set(0.18, 0.05, -0.12);
  headGroup.add(rightEye);
  
  // Nose
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 3), noseMaterial);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0.26, -0.02, 0);
  headGroup.add(nose);
  
  // Tongue
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshStandardMaterial({ color: 0xFF6B8A }));
  tongue.name = 'tongue';
  tongue.position.set(0.24, -0.08, 0);
  tongue.visible = false;
  headGroup.add(tongue);
  
  // Pointed ears
  const earGeom = new THREE.ConeGeometry(0.1, 0.2, 4);
  const leftEarGroup = new THREE.Group();
  leftEarGroup.name = 'leftEar';
  leftEarGroup.add(new THREE.Mesh(earGeom, furMaterial));
  leftEarGroup.position.set(-0.05, 0.25, 0.15);
  leftEarGroup.rotation.z = -0.3;
  headGroup.add(leftEarGroup);
  const rightEarGroup = new THREE.Group();
  rightEarGroup.name = 'rightEar';
  rightEarGroup.add(new THREE.Mesh(earGeom, furMaterial));
  rightEarGroup.position.set(-0.05, 0.25, -0.15);
  rightEarGroup.rotation.z = -0.3;
  headGroup.add(rightEarGroup);
  
  headGroup.position.set(0.55, 0.55, 0);
  catGroup.add(headGroup);
  
  // Slender legs
  const legGeom = new THREE.CapsuleGeometry(0.05, 0.25, 4, 8);
  ['frontLeft', 'frontRight', 'backLeft', 'backRight'].forEach((name, i) => {
    const legGroup = new THREE.Group();
    legGroup.name = name + 'Leg';
    legGroup.add(new THREE.Mesh(legGeom, furMaterial));
    const x = i < 2 ? 0.25 : -0.25;
    const z = i % 2 === 0 ? 0.15 : -0.15;
    legGroup.position.set(x, 0.2, z);
    catGroup.add(legGroup);
  });
  
  // Long tail
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tailGroup';
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.5, 4, 8), furMaterial);
  tail.position.y = 0.25;
  tailGroup.add(tail);
  tailGroup.position.set(-0.5, 0.4, 0);
  tailGroup.rotation.z = -0.8;
  catGroup.add(tailGroup);
  
  return catGroup;
}

function createLionModel(): THREE.Group {
  const lionGroup = new THREE.Group();
  const maneColor = new THREE.Color(0xD4A017);
  const furColor = new THREE.Color(0xC19A6B);
  
  const maneMaterial = new THREE.MeshStandardMaterial({ color: maneColor, roughness: 1.0 });
  const furMaterial = new THREE.MeshStandardMaterial({ color: furColor, roughness: 0.9 });
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.2 });
  const noseMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3 });
  
  // Large body
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.8, 8, 16), furMaterial);
  body.rotation.z = Math.PI / 2;
  body.position.set(0, 0.55, 0);
  lionGroup.add(body);
  
  // Head with mane
  const headGroup = new THREE.Group();
  headGroup.name = 'headGroup';
  
  // Mane (fluffy ring)
  const mane = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.15, 8, 16), maneMaterial);
  mane.rotation.y = Math.PI / 2;
  headGroup.add(mane);
  
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), furMaterial);
  headGroup.add(head);
  
  // Snout
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), furMaterial);
  snout.scale.set(0.8, 0.6, 0.8);
  snout.position.set(0.25, -0.05, 0);
  headGroup.add(snout);
  
  // Eyes
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), eyeMaterial);
  leftEye.position.set(0.2, 0.1, 0.15);
  headGroup.add(leftEye);
  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), eyeMaterial);
  rightEye.position.set(0.2, 0.1, -0.15);
  headGroup.add(rightEye);
  
  // Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), noseMaterial);
  nose.position.set(0.35, -0.02, 0);
  headGroup.add(nose);
  
  // Tongue
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshStandardMaterial({ color: 0xFF6B8A }));
  tongue.name = 'tongue';
  tongue.position.set(0.3, -0.12, 0);
  headGroup.add(tongue);
  
  // Ears (round)
  const earGeom = new THREE.SphereGeometry(0.08, 8, 8);
  const leftEarGroup = new THREE.Group();
  leftEarGroup.name = 'leftEar';
  leftEarGroup.add(new THREE.Mesh(earGeom, furMaterial));
  leftEarGroup.position.set(-0.15, 0.28, 0.22);
  headGroup.add(leftEarGroup);
  const rightEarGroup = new THREE.Group();
  rightEarGroup.name = 'rightEar';
  rightEarGroup.add(new THREE.Mesh(earGeom, furMaterial));
  rightEarGroup.position.set(-0.15, 0.28, -0.22);
  headGroup.add(rightEarGroup);
  
  headGroup.position.set(0.6, 0.75, 0);
  lionGroup.add(headGroup);
  
  // Strong legs
  const legGeom = new THREE.CapsuleGeometry(0.1, 0.25, 4, 8);
  ['frontLeft', 'frontRight', 'backLeft', 'backRight'].forEach((name, i) => {
    const legGroup = new THREE.Group();
    legGroup.name = name + 'Leg';
    legGroup.add(new THREE.Mesh(legGeom, furMaterial));
    const x = i < 2 ? 0.3 : -0.3;
    const z = i % 2 === 0 ? 0.25 : -0.25;
    legGroup.position.set(x, 0.3, z);
    lionGroup.add(legGroup);
  });
  
  // Tail with tuft
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tailGroup';
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.5, 4, 8), furMaterial);
  tail.position.y = 0.25;
  tailGroup.add(tail);
  const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), maneMaterial);
  tuft.position.y = 0.55;
  tailGroup.add(tuft);
  tailGroup.position.set(-0.6, 0.5, 0);
  tailGroup.rotation.z = -0.6;
  lionGroup.add(tailGroup);
  
  lionGroup.scale.set(1.3, 1.3, 1.3);
  return lionGroup;
}

function createGeckoModel(): THREE.Group {
  const geckoGroup = new THREE.Group();
  const bodyColor = new THREE.Color(0xFF6347);
  const spotColor = new THREE.Color(0xFFD700);
  
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4 });
  const spotMaterial = new THREE.MeshStandardMaterial({ color: spotColor, roughness: 0.4 });
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1 });
  
  // Flat body
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.6, 8, 16), bodyMaterial);
  body.rotation.z = Math.PI / 2;
  body.scale.set(1, 0.5, 1.2);
  body.position.set(0, 0.15, 0);
  geckoGroup.add(body);
  
  // Spots
  for (let i = 0; i < 5; i++) {
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), spotMaterial);
    spot.position.set(-0.2 + i * 0.1, 0.22, (Math.random() - 0.5) * 0.2);
    geckoGroup.add(spot);
  }
  
  // Head
  const headGroup = new THREE.Group();
  headGroup.name = 'headGroup';
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), bodyMaterial);
  head.scale.set(1.2, 0.7, 1);
  headGroup.add(head);
  
  // Big eyes (crested gecko style)
  const eyeGeom = new THREE.SphereGeometry(0.08, 12, 12);
  const leftEye = new THREE.Mesh(eyeGeom, eyeMaterial);
  leftEye.position.set(0.1, 0.08, 0.12);
  headGroup.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeom, eyeMaterial);
  rightEye.position.set(0.1, 0.08, -0.12);
  headGroup.add(rightEye);
  
  // Crests
  const crestGeom = new THREE.ConeGeometry(0.03, 0.1, 4);
  const leftEarGroup = new THREE.Group();
  leftEarGroup.name = 'leftEar';
  for (let i = 0; i < 3; i++) {
    const crest = new THREE.Mesh(crestGeom, spotMaterial);
    crest.position.set(-0.05 - i * 0.05, 0.12, 0.1);
    leftEarGroup.add(crest);
  }
  headGroup.add(leftEarGroup);
  const rightEarGroup = new THREE.Group();
  rightEarGroup.name = 'rightEar';
  for (let i = 0; i < 3; i++) {
    const crest = new THREE.Mesh(crestGeom, spotMaterial);
    crest.position.set(-0.05 - i * 0.05, 0.12, -0.1);
    rightEarGroup.add(crest);
  }
  headGroup.add(rightEarGroup);
  
  // Tongue (hidden)
  const tongue = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.15, 4, 8), new THREE.MeshStandardMaterial({ color: 0xFF69B4 }));
  tongue.name = 'tongue';
  tongue.rotation.z = Math.PI / 2;
  tongue.position.set(0.25, 0, 0);
  tongue.visible = false;
  headGroup.add(tongue);
  
  headGroup.position.set(0.45, 0.18, 0);
  geckoGroup.add(headGroup);
  
  // Legs (splayed out)
  const legGeom = new THREE.CapsuleGeometry(0.04, 0.15, 4, 8);
  ['frontLeft', 'frontRight', 'backLeft', 'backRight'].forEach((name, i) => {
    const legGroup = new THREE.Group();
    legGroup.name = name + 'Leg';
    const leg = new THREE.Mesh(legGeom, bodyMaterial);
    leg.rotation.z = i % 2 === 0 ? 0.5 : -0.5;
    legGroup.add(leg);
    const x = i < 2 ? 0.15 : -0.2;
    const z = i % 2 === 0 ? 0.25 : -0.25;
    legGroup.position.set(x, 0.08, z);
    geckoGroup.add(legGroup);
  });
  
  // Long tail
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tailGroup';
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.5, 4, 8), bodyMaterial);
  tail.rotation.z = Math.PI / 2;
  tail.position.x = -0.25;
  tailGroup.add(tail);
  tailGroup.position.set(-0.4, 0.12, 0);
  geckoGroup.add(tailGroup);
  
  geckoGroup.scale.set(1.5, 1.5, 1.5);
  return geckoGroup;
}

function createDragonModel(): THREE.Group {
  const dragonGroup = new THREE.Group();
  const scaleColor = new THREE.Color(0x8B0000);
  const bellyColor = new THREE.Color(0xFFD700);
  
  const scaleMaterial = new THREE.MeshStandardMaterial({ color: scaleColor, roughness: 0.3, metalness: 0.4 });
  const bellyMaterial = new THREE.MeshStandardMaterial({ color: bellyColor, roughness: 0.5 });
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xFFA500, emissive: 0xFF4500, emissiveIntensity: 0.3 });
  
  // Body
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.8, 8, 16), scaleMaterial);
  body.rotation.z = Math.PI / 2;
  body.position.set(0, 0.5, 0);
  dragonGroup.add(body);
  
  // Belly plates
  const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.6, 8, 16), bellyMaterial);
  belly.rotation.z = Math.PI / 2;
  belly.scale.set(1, 0.5, 0.8);
  belly.position.set(0, 0.4, 0);
  dragonGroup.add(belly);
  
  // Head
  const headGroup = new THREE.Group();
  headGroup.name = 'headGroup';
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), scaleMaterial);
  head.scale.set(1.3, 0.9, 0.9);
  headGroup.add(head);
  
  // Snout
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 8), scaleMaterial);
  snout.rotation.x = -Math.PI / 2;
  snout.position.set(0.35, 0, 0);
  headGroup.add(snout);
  
  // Glowing eyes
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), eyeMaterial);
  leftEye.position.set(0.15, 0.1, 0.15);
  headGroup.add(leftEye);
  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), eyeMaterial);
  rightEye.position.set(0.15, 0.1, -0.15);
  headGroup.add(rightEye);
  
  // Horns
  const hornGeom = new THREE.ConeGeometry(0.05, 0.2, 6);
  const leftEarGroup = new THREE.Group();
  leftEarGroup.name = 'leftEar';
  const leftHorn = new THREE.Mesh(hornGeom, bellyMaterial);
  leftHorn.rotation.z = 0.3;
  leftEarGroup.add(leftHorn);
  leftEarGroup.position.set(-0.1, 0.25, 0.15);
  headGroup.add(leftEarGroup);
  const rightEarGroup = new THREE.Group();
  rightEarGroup.name = 'rightEar';
  const rightHorn = new THREE.Mesh(hornGeom, bellyMaterial);
  rightHorn.rotation.z = 0.3;
  rightEarGroup.add(rightHorn);
  rightEarGroup.position.set(-0.1, 0.25, -0.15);
  headGroup.add(rightEarGroup);
  
  // Fire tongue
  const tongue = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 4), new THREE.MeshStandardMaterial({ color: 0xFF4500, emissive: 0xFF0000, emissiveIntensity: 0.5 }));
  tongue.name = 'tongue';
  tongue.rotation.x = -Math.PI / 2;
  tongue.position.set(0.5, -0.05, 0);
  headGroup.add(tongue);
  
  headGroup.position.set(0.55, 0.7, 0);
  dragonGroup.add(headGroup);
  
  // Wings
  const wingGeom = new THREE.PlaneGeometry(0.6, 0.4);
  const wingMaterial = new THREE.MeshStandardMaterial({ color: scaleColor, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
  const leftWing = new THREE.Mesh(wingGeom, wingMaterial);
  leftWing.position.set(0, 0.7, 0.4);
  leftWing.rotation.x = -0.3;
  dragonGroup.add(leftWing);
  const rightWing = new THREE.Mesh(wingGeom, wingMaterial);
  rightWing.position.set(0, 0.7, -0.4);
  rightWing.rotation.x = 0.3;
  dragonGroup.add(rightWing);
  
  // Legs
  const legGeom = new THREE.CapsuleGeometry(0.08, 0.2, 4, 8);
  ['frontLeft', 'frontRight', 'backLeft', 'backRight'].forEach((name, i) => {
    const legGroup = new THREE.Group();
    legGroup.name = name + 'Leg';
    legGroup.add(new THREE.Mesh(legGeom, scaleMaterial));
    const x = i < 2 ? 0.25 : -0.25;
    const z = i % 2 === 0 ? 0.25 : -0.25;
    legGroup.position.set(x, 0.25, z);
    dragonGroup.add(legGroup);
  });
  
  // Spiked tail
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tailGroup';
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.6, 4, 8), scaleMaterial);
  tail.position.y = 0.3;
  tailGroup.add(tail);
  for (let i = 0; i < 4; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 4), scaleMaterial);
    spike.position.set(0, 0.1 + i * 0.15, 0);
    spike.rotation.x = -0.3;
    tailGroup.add(spike);
  }
  tailGroup.position.set(-0.55, 0.45, 0);
  tailGroup.rotation.z = -0.4;
  dragonGroup.add(tailGroup);
  
  dragonGroup.scale.set(1.2, 1.2, 1.2);
  return dragonGroup;
}

function createTurtleModel(): THREE.Group {
  const turtleGroup = new THREE.Group();
  const shellColor = new THREE.Color(0x228B22);
  const skinColor = new THREE.Color(0x8FBC8F);
  
  const shellMaterial = new THREE.MeshStandardMaterial({ color: shellColor, roughness: 0.6 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
  
  // Shell (dome)
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), shellMaterial);
  shell.scale.set(1.2, 0.6, 1);
  shell.position.set(0, 0.35, 0);
  turtleGroup.add(shell);
  
  // Shell pattern
  const patternMaterial = new THREE.MeshStandardMaterial({ color: 0x006400, roughness: 0.6 });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const pattern = new THREE.Mesh(new THREE.CircleGeometry(0.08, 6), patternMaterial);
    pattern.position.set(Math.cos(angle) * 0.2, 0.5, Math.sin(angle) * 0.2);
    pattern.rotation.x = -Math.PI / 2;
    turtleGroup.add(pattern);
  }
  
  // Head
  const headGroup = new THREE.Group();
  headGroup.name = 'headGroup';
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), skinMaterial);
  headGroup.add(head);
  
  // Eyes
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), eyeMaterial);
  leftEye.position.set(0.08, 0.03, 0.06);
  headGroup.add(leftEye);
  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), eyeMaterial);
  rightEye.position.set(0.08, 0.03, -0.06);
  headGroup.add(rightEye);
  
  // Dummy ears (hidden - turtles don't have visible ears)
  const leftEarGroup = new THREE.Group();
  leftEarGroup.name = 'leftEar';
  headGroup.add(leftEarGroup);
  const rightEarGroup = new THREE.Group();
  rightEarGroup.name = 'rightEar';
  headGroup.add(rightEarGroup);
  
  // Tongue (hidden)
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), new THREE.MeshStandardMaterial({ color: 0xFF6B8A }));
  tongue.name = 'tongue';
  tongue.position.set(0.1, -0.02, 0);
  tongue.visible = false;
  headGroup.add(tongue);
  
  headGroup.position.set(0.45, 0.25, 0);
  turtleGroup.add(headGroup);
  
  // Legs (flippers)
  const legGeom = new THREE.CapsuleGeometry(0.06, 0.12, 4, 8);
  ['frontLeft', 'frontRight', 'backLeft', 'backRight'].forEach((name, i) => {
    const legGroup = new THREE.Group();
    legGroup.name = name + 'Leg';
    const leg = new THREE.Mesh(legGeom, skinMaterial);
    leg.scale.set(1, 1, 1.5);
    legGroup.add(leg);
    const x = i < 2 ? 0.25 : -0.2;
    const z = i % 2 === 0 ? 0.35 : -0.35;
    legGroup.position.set(x, 0.15, z);
    turtleGroup.add(legGroup);
  });
  
  // Tail
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tailGroup';
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 6), skinMaterial);
  tail.rotation.x = Math.PI / 2;
  tailGroup.add(tail);
  tailGroup.position.set(-0.4, 0.2, 0);
  turtleGroup.add(tailGroup);
  
  turtleGroup.scale.set(1.3, 1.3, 1.3);
  return turtleGroup;
}

function createCrabModel(): THREE.Group {
  const crabGroup = new THREE.Group();
  const shellColor = new THREE.Color(0xFF4500);
  const clawColor = new THREE.Color(0xFF6347);
  
  const shellMaterial = new THREE.MeshStandardMaterial({ color: shellColor, roughness: 0.5 });
  const clawMaterial = new THREE.MeshStandardMaterial({ color: clawColor, roughness: 0.5 });
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
  
  // Body (wide and flat)
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), shellMaterial);
  body.scale.set(1.4, 0.5, 1);
  body.position.set(0, 0.2, 0);
  crabGroup.add(body);
  
  // Head (part of body - crabs don't have separate heads)
  const headGroup = new THREE.Group();
  headGroup.name = 'headGroup';
  
  // Eye stalks
  const eyeStalkGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.15, 8);
  const leftEyeStalk = new THREE.Mesh(eyeStalkGeom, shellMaterial);
  leftEyeStalk.position.set(0.25, 0.1, 0.1);
  headGroup.add(leftEyeStalk);
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), eyeMaterial);
  leftEye.position.set(0.25, 0.2, 0.1);
  headGroup.add(leftEye);
  
  const rightEyeStalk = new THREE.Mesh(eyeStalkGeom, shellMaterial);
  rightEyeStalk.position.set(0.25, 0.1, -0.1);
  headGroup.add(rightEyeStalk);
  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), eyeMaterial);
  rightEye.position.set(0.25, 0.2, -0.1);
  headGroup.add(rightEye);
  
  // Dummy ears (crabs don't have ears)
  const leftEarGroup = new THREE.Group();
  leftEarGroup.name = 'leftEar';
  headGroup.add(leftEarGroup);
  const rightEarGroup = new THREE.Group();
  rightEarGroup.name = 'rightEar';
  headGroup.add(rightEarGroup);
  
  // Tongue/mouth (hidden)
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), new THREE.MeshStandardMaterial({ color: 0xFF6B8A }));
  tongue.name = 'tongue';
  tongue.position.set(0.35, 0, 0);
  tongue.visible = false;
  headGroup.add(tongue);
  
  headGroup.position.set(0, 0.2, 0);
  crabGroup.add(headGroup);
  
  // Claws (front legs)
  const clawGeom = new THREE.SphereGeometry(0.12, 8, 8);
  const frontLeftLegGroup = new THREE.Group();
  frontLeftLegGroup.name = 'frontLeftLeg';
  const leftClaw = new THREE.Mesh(clawGeom, clawMaterial);
  leftClaw.scale.set(1.5, 0.8, 1);
  frontLeftLegGroup.add(leftClaw);
  const leftPincer = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 4), clawMaterial);
  leftPincer.rotation.z = -Math.PI / 4;
  leftPincer.position.set(0.1, 0.05, 0);
  frontLeftLegGroup.add(leftPincer);
  frontLeftLegGroup.position.set(0.35, 0.2, 0.4);
  crabGroup.add(frontLeftLegGroup);
  
  const frontRightLegGroup = new THREE.Group();
  frontRightLegGroup.name = 'frontRightLeg';
  const rightClaw = new THREE.Mesh(clawGeom, clawMaterial);
  rightClaw.scale.set(1.5, 0.8, 1);
  frontRightLegGroup.add(rightClaw);
  const rightPincer = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 4), clawMaterial);
  rightPincer.rotation.z = -Math.PI / 4;
  rightPincer.position.set(0.1, 0.05, 0);
  frontRightLegGroup.add(rightPincer);
  frontRightLegGroup.position.set(0.35, 0.2, -0.4);
  crabGroup.add(frontRightLegGroup);
  
  // Walking legs (4 pairs on each side = 8 legs, but we only animate 4)
  const legGeom = new THREE.CapsuleGeometry(0.03, 0.2, 4, 8);
  const backLeftLegGroup = new THREE.Group();
  backLeftLegGroup.name = 'backLeftLeg';
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(legGeom, shellMaterial);
    leg.rotation.z = 0.5;
    leg.position.set(-0.1 - i * 0.12, 0, 0.25 + i * 0.05);
    backLeftLegGroup.add(leg);
  }
  backLeftLegGroup.position.set(0, 0.1, 0);
  crabGroup.add(backLeftLegGroup);
  
  const backRightLegGroup = new THREE.Group();
  backRightLegGroup.name = 'backRightLeg';
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(legGeom, shellMaterial);
    leg.rotation.z = -0.5;
    leg.position.set(-0.1 - i * 0.12, 0, -0.25 - i * 0.05);
    backRightLegGroup.add(leg);
  }
  backRightLegGroup.position.set(0, 0.1, 0);
  crabGroup.add(backRightLegGroup);
  
  // Tail (hidden under body)
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tailGroup';
  crabGroup.add(tailGroup);
  
  crabGroup.scale.set(1.2, 1.2, 1.2);
  return crabGroup;
}

interface PetPhysicsRefs {
  world: CANNON.World | null;
  body: CANNON.Body | null;
  groundBody: CANNON.Body | null;
  mesh: THREE.Group | null;
  state: PetState;
  stateTimer: number;
  targetPosition: THREE.Vector3 | null;
  walkSpeed: number;
  legPhase: number;
  tailPhase: number;
}

interface ShakingBlock {
  mesh: THREE.Mesh;
  originalPosition: THREE.Vector3;
  startTime: number;
}

interface DestroyingBlock {
  mesh: THREE.Mesh;
  targetY: number;
  delay: number;
  startTime: number;
  originalPosition: THREE.Vector3;
}

interface FallingBlock {
  mesh: THREE.Mesh;
  startY: number;
  targetY: number;
  startTime: number;
  delay: number;
}

function createWoodTexture(baseColor: THREE.Color): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }
  
  const hsl = { h: 0, s: 0, l: 0 };
  baseColor.getHSL(hsl);
  
  const darkColor = `hsl(${hsl.h * 360}, ${Math.max(30, hsl.s * 100)}%, ${Math.max(15, hsl.l * 100 * 0.3)}%)`;
  const midColor = `hsl(${hsl.h * 360}, ${Math.max(40, hsl.s * 100)}%, ${Math.max(25, hsl.l * 100 * 0.5)}%)`;
  const lightColor = `hsl(${hsl.h * 360}, ${Math.max(35, hsl.s * 100)}%, ${Math.max(35, hsl.l * 100 * 0.7)}%)`;
  
  ctx.fillStyle = midColor;
  ctx.fillRect(0, 0, 256, 256);
  
  for (let i = 0; i < 60; i++) {
    const y = Math.random() * 256;
    const thickness = 1 + Math.random() * 4;
    const waviness = Math.random() * 8;
    
    ctx.strokeStyle = i % 3 === 0 ? darkColor : lightColor;
    ctx.lineWidth = thickness;
    ctx.globalAlpha = 0.3 + Math.random() * 0.4;
    
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < 256; x += 4) {
      const yOffset = Math.sin(x * 0.02 + i) * waviness;
      ctx.lineTo(x, y + yOffset);
    }
    ctx.stroke();
  }
  
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const radius = 5 + Math.random() * 15;
    
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  ctx.globalAlpha = 1;
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
}

function createWoodBumpMap(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }
  
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  
  for (let i = 0; i < 80; i++) {
    const y = Math.random() * 256;
    const thickness = 0.5 + Math.random() * 2;
    const waviness = Math.random() * 6;
    
    const brightness = 100 + Math.floor(Math.random() * 60);
    ctx.strokeStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
    ctx.lineWidth = thickness;
    ctx.globalAlpha = 0.5;
    
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < 256; x += 4) {
      const yOffset = Math.sin(x * 0.02 + i) * waviness;
      ctx.lineTo(x, y + yOffset);
    }
    ctx.stroke();
  }
  
  ctx.globalAlpha = 1;
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createMetallicTexture(baseColor: THREE.Color): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }
  
  const r = Math.floor(baseColor.r * 255);
  const g = Math.floor(baseColor.g * 255);
  const b = Math.floor(baseColor.b * 255);
  
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, 256, 256);
  
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const length = 20 + Math.random() * 80;
    const angle = (Math.random() - 0.5) * 0.3;
    
    const brightness = Math.random() > 0.5 ? 1.1 : 0.9;
    ctx.strokeStyle = `rgba(${Math.min(255, r * brightness)}, ${Math.min(255, g * brightness)}, ${Math.min(255, b * brightness)}, 0.3)`;
    ctx.lineWidth = 0.5 + Math.random();
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }
  
  const gradient = ctx.createRadialGradient(64, 64, 0, 128, 128, 180);
  gradient.addColorStop(0, `rgba(255, 255, 255, 0.15)`);
  gradient.addColorStop(0.5, `rgba(255, 255, 255, 0.05)`);
  gradient.addColorStop(1, `rgba(0, 0, 0, 0.1)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createMetallicRoughnessMap(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }
  
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, 256, 256);
  
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const length = 10 + Math.random() * 40;
    const angle = (Math.random() - 0.5) * 0.2;
    
    const grayValue = 20 + Math.floor(Math.random() * 30);
    ctx.strokeStyle = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
    ctx.lineWidth = 0.5;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createMetallicNormalMap(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }
  
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 256, 256);
  
  for (let i = 0; i < 150; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const length = 15 + Math.random() * 50;
    const angle = (Math.random() - 0.5) * 0.2;
    
    ctx.strokeStyle = `rgba(${120 + Math.random() * 20}, ${120 + Math.random() * 20}, 255, 0.5)`;
    ctx.lineWidth = 1 + Math.random();
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const textureCache = new Map<string, THREE.CanvasTexture>();
const materialCache = new Map<string, THREE.Material>();
// Reduced depth (0.6) to prevent z-fighting with phone bezel/glass layers
const sharedGeometry = new THREE.BoxGeometry(0.9, 0.9, 0.6);

function getCachedWoodTexture(colorHex: string): THREE.CanvasTexture {
  const key = `wood_${colorHex}`;
  if (!textureCache.has(key)) {
    textureCache.set(key, createWoodTexture(new THREE.Color(colorHex)));
  }
  return textureCache.get(key)!;
}

function getCachedWoodBumpMap(): THREE.CanvasTexture {
  const key = 'wood_bump';
  if (!textureCache.has(key)) {
    textureCache.set(key, createWoodBumpMap());
  }
  return textureCache.get(key)!;
}

function getCachedMetallicTexture(colorHex: string): THREE.CanvasTexture {
  const key = `metallic_${colorHex}`;
  if (!textureCache.has(key)) {
    textureCache.set(key, createMetallicTexture(new THREE.Color(colorHex)));
  }
  return textureCache.get(key)!;
}

function getCachedMetallicRoughnessMap(): THREE.CanvasTexture {
  const key = 'metallic_roughness';
  if (!textureCache.has(key)) {
    textureCache.set(key, createMetallicRoughnessMap());
  }
  return textureCache.get(key)!;
}

function getCachedMetallicNormalMap(): THREE.CanvasTexture {
  const key = 'metallic_normal';
  if (!textureCache.has(key)) {
    textureCache.set(key, createMetallicNormalMap());
  }
  return textureCache.get(key)!;
}

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

// Cache for decoration geometries to prevent recreating them
const decorationGeometryCache = new Map<string, THREE.BufferGeometry>();
const decorationMaterialCache = new Map<string, THREE.Material>();

function getCachedGeometry(key: string, createFn: () => THREE.BufferGeometry): THREE.BufferGeometry {
  if (!decorationGeometryCache.has(key)) {
    decorationGeometryCache.set(key, createFn());
  }
  return decorationGeometryCache.get(key)!;
}

function getCachedMaterial(key: string, createFn: () => THREE.Material): THREE.Material {
  if (!decorationMaterialCache.has(key)) {
    decorationMaterialCache.set(key, createFn());
  }
  return decorationMaterialCache.get(key)!;
}

function createDecorationModel(decorationId: string): THREE.Group {
  const group = new THREE.Group();
  const item = DECORATION_ITEMS[decorationId as keyof typeof DECORATION_ITEMS];
  if (!item) return group;

  const color = new THREE.Color(item.color);
  const emissiveColor = item.emissive ? new THREE.Color(item.emissive) : undefined;
  const sizeMap = { small: 2.0, medium: 2.8, large: 3.5 };
  const scale = sizeMap[item.size] || 2.5;

  const baseMaterial = getCachedMaterial(`base_${decorationId}`, () => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.5,
    metalness: 0.2,
    emissive: emissiveColor || new THREE.Color(0x000000),
    emissiveIntensity: emissiveColor ? 0.4 : 0,
  })) as THREE.MeshStandardMaterial;

  switch (decorationId) {
    case 'deco_stone': {
      const stoneGeo = getCachedGeometry(`stone_${scale}`, () => new THREE.DodecahedronGeometry(0.3 * scale, 0));
      const stone = new THREE.Mesh(stoneGeo, baseMaterial);
      stone.scale.set(1.2, 0.8, 1);
      stone.position.y = 0.15;
      group.add(stone);
      break;
    }
    case 'deco_pond': {
      const pondGeo = getCachedGeometry(`pond_${scale}`, () => new THREE.CylinderGeometry(0.5 * scale, 0.5 * scale, 0.1, 8));
      const pondMaterial = getCachedMaterial('pond', () => new THREE.MeshStandardMaterial({
        color: 0x4682B4,
        roughness: 0.1,
        metalness: 0.8,
        transparent: true,
        opacity: 0.7,
      }));
      const pond = new THREE.Mesh(pondGeo, pondMaterial);
      pond.position.y = 0.05;
      group.add(pond);
      break;
    }
    case 'deco_tree': {
      const trunkGeo = getCachedGeometry(`tree_trunk_${scale}`, () => new THREE.CylinderGeometry(0.08 * scale, 0.12 * scale, 0.4 * scale, 6));
      const trunkMat = getCachedMaterial('tree_trunk', () => new THREE.MeshStandardMaterial({ color: 0x8B4513 }));
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.2 * scale;
      group.add(trunk);
      const leavesGeo = getCachedGeometry(`tree_leaves_${scale}`, () => new THREE.ConeGeometry(0.35 * scale, 0.6 * scale, 6));
      const leavesMat = getCachedMaterial('tree_leaves', () => new THREE.MeshStandardMaterial({ color: 0x228B22 }));
      const leaves = new THREE.Mesh(leavesGeo, leavesMat);
      leaves.position.y = 0.6 * scale;
      group.add(leaves);
      break;
    }
    case 'deco_flower': {
      const stemGeo = getCachedGeometry(`flower_stem_${scale}`, () => new THREE.CylinderGeometry(0.02, 0.02, 0.25 * scale, 4));
      const stemMat = getCachedMaterial('flower_stem', () => new THREE.MeshStandardMaterial({ color: 0x228B22 }));
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.125 * scale;
      group.add(stem);
      const petalGeo = getCachedGeometry(`flower_petal_${scale}`, () => new THREE.SphereGeometry(0.08 * scale, 4, 4));
      const petalMat = getCachedMaterial(`flower_petal_${decorationId}`, () => new THREE.MeshStandardMaterial({ color }));
      for (let i = 0; i < 5; i++) {
        const petal = new THREE.Mesh(petalGeo, petalMat);
        const angle = (i / 5) * Math.PI * 2;
        petal.position.set(Math.cos(angle) * 0.1 * scale, 0.3 * scale, Math.sin(angle) * 0.1 * scale);
        group.add(petal);
      }
      const centerGeo = getCachedGeometry(`flower_center_${scale}`, () => new THREE.SphereGeometry(0.06 * scale, 4, 4));
      const centerMat = getCachedMaterial('flower_center', () => new THREE.MeshStandardMaterial({ color: 0xFFD700 }));
      const center = new THREE.Mesh(centerGeo, centerMat);
      center.position.y = 0.3 * scale;
      group.add(center);
      break;
    }
    case 'deco_mushroom': {
      const stemGeo = getCachedGeometry(`mushroom_stem_${scale}`, () => new THREE.CylinderGeometry(0.06 * scale, 0.08 * scale, 0.2 * scale, 6));
      const stemMat = getCachedMaterial('mushroom_stem', () => new THREE.MeshStandardMaterial({ color: 0xFFE4B5 }));
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.1 * scale;
      group.add(stem);
      const capGeo = new THREE.SphereGeometry(0.18 * scale, 12, 8);
      capGeo.scale(1, 0.5, 1);
      const capMat = new THREE.MeshStandardMaterial({
        color,
        emissive: emissiveColor,
        emissiveIntensity: 0.5,
      });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 0.22 * scale;
      group.add(cap);
      break;
    }
    case 'deco_crystal': {
      const crystalGeo = new THREE.OctahedronGeometry(0.25 * scale, 0);
      const crystalMat = new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        emissive: emissiveColor,
        emissiveIntensity: 0.6,
        metalness: 0.3,
        roughness: 0.1,
      });
      const crystal = new THREE.Mesh(crystalGeo, crystalMat);
      crystal.position.y = 0.25 * scale;
      crystal.rotation.y = Math.random() * Math.PI;
      group.add(crystal);
      break;
    }
    case 'deco_star': {
      const starMat = new THREE.MeshStandardMaterial({
        color,
        emissive: emissiveColor,
        emissiveIntensity: 0.8,
      });
      const starShape = new THREE.Shape();
      const outerRadius = 0.2 * scale;
      const innerRadius = 0.08 * scale;
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
        if (i === 0) starShape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        else starShape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      starShape.closePath();
      const extrudeSettings = { depth: 0.05 * scale, bevelEnabled: false };
      const starGeo = new THREE.ExtrudeGeometry(starShape, extrudeSettings);
      const star = new THREE.Mesh(starGeo, starMat);
      star.rotation.x = -Math.PI / 2;
      star.position.y = 0.3 * scale;
      group.add(star);
      break;
    }
    case 'deco_heart': {
      const heartMat = new THREE.MeshStandardMaterial({
        color,
        emissive: emissiveColor,
        emissiveIntensity: 0.4,
      });
      const heartGeo = new THREE.SphereGeometry(0.15 * scale, 12, 12);
      const heart = new THREE.Mesh(heartGeo, heartMat);
      heart.position.y = 0.25 * scale;
      heart.scale.set(1, 1.2, 0.5);
      group.add(heart);
      break;
    }
    case 'deco_trophy': {
      const cupGeo = new THREE.CylinderGeometry(0.15 * scale, 0.08 * scale, 0.3 * scale, 12);
      const cupMat = new THREE.MeshStandardMaterial({
        color: 0xFFD700,
        metalness: 0.8,
        roughness: 0.2,
      });
      const cup = new THREE.Mesh(cupGeo, cupMat);
      cup.position.y = 0.25 * scale;
      group.add(cup);
      const baseGeo = new THREE.CylinderGeometry(0.12 * scale, 0.15 * scale, 0.1 * scale, 12);
      const baseMesh = new THREE.Mesh(baseGeo, cupMat);
      baseMesh.position.y = 0.05 * scale;
      group.add(baseMesh);
      break;
    }
    case 'deco_lantern': {
      const lanternGeo = new THREE.BoxGeometry(0.15 * scale, 0.25 * scale, 0.15 * scale);
      const lanternMat = new THREE.MeshStandardMaterial({
        color: 0x8B4513,
        roughness: 0.7,
      });
      const lantern = new THREE.Mesh(lanternGeo, lanternMat);
      lantern.position.y = 0.2 * scale;
      group.add(lantern);
      const glowGeo = new THREE.SphereGeometry(0.06 * scale, 8, 8);
      const glowMat = new THREE.MeshStandardMaterial({
        color: 0xFFAA00,
        emissive: 0xFFAA00,
        emissiveIntensity: 1,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.y = 0.2 * scale;
      group.add(glow);
      break;
    }
    case 'deco_campfire': {
      const logGeo = new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 0.25 * scale, 6);
      const logMat = new THREE.MeshStandardMaterial({ color: 0x5D4037 });
      for (let i = 0; i < 3; i++) {
        const log = new THREE.Mesh(logGeo, logMat);
        const angle = (i / 3) * Math.PI * 2;
        log.position.set(Math.cos(angle) * 0.08, 0.04, Math.sin(angle) * 0.08);
        log.rotation.z = Math.PI / 4;
        log.rotation.y = angle;
        group.add(log);
      }
      const fireGeo = new THREE.ConeGeometry(0.1 * scale, 0.3 * scale, 8);
      const fireMat = new THREE.MeshStandardMaterial({
        color: 0xFF4500,
        emissive: 0xFF4500,
        emissiveIntensity: 1,
        transparent: true,
        opacity: 0.9,
      });
      const fire = new THREE.Mesh(fireGeo, fireMat);
      fire.position.y = 0.2 * scale;
      group.add(fire);
      break;
    }
    case 'deco_grass': {
      const grassMat = new THREE.MeshStandardMaterial({ color: 0x7CFC00 });
      for (let i = 0; i < 8; i++) {
        const bladeGeo = new THREE.ConeGeometry(0.02 * scale, 0.2 * scale, 4);
        const blade = new THREE.Mesh(bladeGeo, grassMat);
        const angle = (i / 8) * Math.PI * 2;
        blade.position.set(Math.cos(angle) * 0.1, 0.1 * scale, Math.sin(angle) * 0.1);
        blade.rotation.x = (Math.random() - 0.5) * 0.3;
        blade.rotation.z = (Math.random() - 0.5) * 0.3;
        group.add(blade);
      }
      break;
    }
    case 'deco_bush': {
      const bushMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
      for (let i = 0; i < 5; i++) {
        const sphereGeo = new THREE.SphereGeometry(0.1 * scale, 8, 8);
        const sphere = new THREE.Mesh(sphereGeo, bushMat);
        const offsetX = (Math.random() - 0.5) * 0.2;
        const offsetZ = (Math.random() - 0.5) * 0.2;
        sphere.position.set(offsetX, 0.12 * scale + i * 0.03, offsetZ);
        group.add(sphere);
      }
      break;
    }
    case 'deco_leaves': {
      const leafColors = [0xD2691E, 0xFF8C00, 0xFFD700, 0xCD853F];
      for (let i = 0; i < 12; i++) {
        const leafGeo = new THREE.CircleGeometry(0.05 * scale, 6);
        const leafMat = new THREE.MeshStandardMaterial({ 
          color: leafColors[i % leafColors.length],
          side: THREE.DoubleSide
        });
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        const angle = (i / 12) * Math.PI * 2;
        leaf.position.set(Math.cos(angle) * 0.15 * Math.random(), 0.02 + Math.random() * 0.05, Math.sin(angle) * 0.15 * Math.random());
        leaf.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
        leaf.rotation.z = Math.random() * Math.PI;
        group.add(leaf);
      }
      break;
    }
    case 'deco_treasure': {
      const chestMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
      const chestGeo = new THREE.BoxGeometry(0.25 * scale, 0.15 * scale, 0.18 * scale);
      const chest = new THREE.Mesh(chestGeo, chestMat);
      chest.position.y = 0.08 * scale;
      group.add(chest);
      const lidGeo = new THREE.BoxGeometry(0.26 * scale, 0.06 * scale, 0.19 * scale);
      const lid = new THREE.Mesh(lidGeo, chestMat);
      lid.position.y = 0.17 * scale;
      group.add(lid);
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.8, roughness: 0.2 });
      const lockGeo = new THREE.BoxGeometry(0.04 * scale, 0.06 * scale, 0.02 * scale);
      const lock = new THREE.Mesh(lockGeo, goldMat);
      lock.position.set(0, 0.08 * scale, 0.1 * scale);
      group.add(lock);
      break;
    }
    case 'deco_mini_tetro': {
      const tetroColors = [0x00FFFF, 0xFFFF00, 0xFF00FF, 0x00FF00];
      const blockSize = 0.06 * scale;
      const positions = [[0, 0], [1, 0], [0, 1], [1, 1]];
      positions.forEach((pos, i) => {
        const blockGeo = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
        const blockMat = new THREE.MeshStandardMaterial({ color: tetroColors[i % tetroColors.length] });
        const block = new THREE.Mesh(blockGeo, blockMat);
        block.position.set(pos[0] * blockSize - blockSize / 2, 0.05 + pos[1] * blockSize, 0);
        group.add(block);
      });
      break;
    }
    case 'deco_crown': {
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.9, roughness: 0.1 });
      const baseGeo = new THREE.CylinderGeometry(0.12 * scale, 0.15 * scale, 0.08 * scale, 12);
      const base = new THREE.Mesh(baseGeo, crownMat);
      base.position.y = 0.04 * scale;
      group.add(base);
      for (let i = 0; i < 5; i++) {
        const pointGeo = new THREE.ConeGeometry(0.03 * scale, 0.12 * scale, 4);
        const point = new THREE.Mesh(pointGeo, crownMat);
        const angle = (i / 5) * Math.PI * 2;
        point.position.set(Math.cos(angle) * 0.1 * scale, 0.14 * scale, Math.sin(angle) * 0.1 * scale);
        group.add(point);
      }
      break;
    }
    case 'deco_flag': {
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
      const poleGeo = new THREE.CylinderGeometry(0.02 * scale, 0.02 * scale, 0.5 * scale, 8);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 0.25 * scale;
      group.add(pole);
      const flagMat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide });
      const flagGeo = new THREE.PlaneGeometry(0.2 * scale, 0.12 * scale);
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(0.1 * scale, 0.42 * scale, 0);
      group.add(flag);
      break;
    }
    case 'deco_candle': {
      const candleMat = new THREE.MeshStandardMaterial({ color: 0xFFFAF0 });
      const candleGeo = new THREE.CylinderGeometry(0.04 * scale, 0.05 * scale, 0.15 * scale, 8);
      const candle = new THREE.Mesh(candleGeo, candleMat);
      candle.position.y = 0.08 * scale;
      group.add(candle);
      const wickGeo = new THREE.CylinderGeometry(0.005 * scale, 0.005 * scale, 0.03 * scale, 4);
      const wickMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
      const wick = new THREE.Mesh(wickGeo, wickMat);
      wick.position.y = 0.17 * scale;
      group.add(wick);
      const flameMat = new THREE.MeshStandardMaterial({ 
        color: 0xFFA500, 
        emissive: 0xFF4500, 
        emissiveIntensity: 1,
        transparent: true,
        opacity: 0.9
      });
      const flameGeo = new THREE.ConeGeometry(0.02 * scale, 0.06 * scale, 8);
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.y = 0.21 * scale;
      group.add(flame);
      break;
    }
    case 'deco_glass_cup': {
      const cachedModel = getCachedDecorationModel('deco_glass_cup');
      if (cachedModel) {
        cachedModel.position.y = 0;
        group.add(cachedModel);
      }
      break;
    }
    case 'deco_cartoon_pond': {
      const cachedModel = getCachedDecorationModel('deco_cartoon_pond');
      if (cachedModel) {
        cachedModel.position.y = 0;
        group.add(cachedModel);
      }
      break;
    }
    default: {
      const defaultGeo = new THREE.SphereGeometry(0.2 * scale, 12, 12);
      const defaultMesh = new THREE.Mesh(defaultGeo, baseMaterial);
      defaultMesh.position.y = 0.2 * scale;
      group.add(defaultMesh);
    }
  }

  group.userData.decorationId = decorationId;
  group.userData.animationPhase = Math.random() * Math.PI * 2;
  return group;
}

export function GameRenderer3D({ gameState, onRotatingChange, onCameraChange, externalCamera, spectatorMode = false, blockTexture = 'default', backgroundColor = '#000000', gridColor = '#ffffff', invertX = false, invertY = false, mouseSensitivity = 50, wheelSensitivity = 50, sandPhysicsBlocks, useSandPhysics = false, sandPoints, engine = 'gravity', showPet = false, petType = 'pet_puppy', selectedPets, gridMaterial = 'default', boardMaterial = 'default', viewMode = '3d', equippedDecorations = {}, placedDecorations = [], onPlaceDecoration, placementPreviewItem, onRendererReady, onFrame, customFloorModelPath, showFloorGrid = false, liteMode = false, onDebugLog, onContextLost }: GameRenderer3DProps) {
  // Memoize activePets to prevent unnecessary useEffect runs
  const activePets = useMemo(() => {
    return selectedPets && selectedPets.length > 0 ? selectedPets : (petType ? [petType] : ['pet_puppy']);
  }, [selectedPets, petType]);
  
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelGeometry, setModelGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [currentModelTexture, setCurrentModelTexture] = useState<string>('');
  
  useEffect(() => {
    if (isModelTexture(blockTexture)) {
      const cachedGeometry = getModelGeometry(blockTexture);
      if (cachedGeometry) {
        setModelGeometry(cachedGeometry);
        setModelLoaded(true);
        setCurrentModelTexture(blockTexture);
        return;
      }
      
      const config = BLOCK_MODELS[blockTexture];
      if (config) {
        loadBlockModel(config.modelPath).then(() => {
          const geometry = getModelGeometry(blockTexture);
          setModelGeometry(geometry);
          setModelLoaded(true);
          setCurrentModelTexture(blockTexture);
        }).catch((err) => {
          console.error(`[RENDERER] Failed to load model:`, err);
          setModelGeometry(null);
          setModelLoaded(false);
          setCurrentModelTexture('');
        });
      }
    } else {
      setModelGeometry(null);
      setModelLoaded(false);
      setCurrentModelTexture('');
    }
  }, [blockTexture]);
  
  const customFloorModelRef = useRef<THREE.Group | null>(null);
  const floorGridHelperRef = useRef<THREE.GridHelper | null>(null);
  const [customFloorLoaded, setCustomFloorLoaded] = useState(false);
  const [decoModelsLoaded, setDecoModelsLoaded] = useState(false);

  useEffect(() => {
    const decorationIds = new Set<string>();
    Object.values(equippedDecorations).forEach(id => decorationIds.add(id));
    placedDecorations?.forEach(p => decorationIds.add(p.itemId));
    if (placementPreviewItem) decorationIds.add(placementPreviewItem);
    
    const modelDecorations = Array.from(decorationIds).filter(id => isDecorationWithModel(id));
    if (modelDecorations.length > 0) {
      Promise.all(modelDecorations.map(id => loadDecorationModel(id)))
        .then(() => setDecoModelsLoaded(true))
        .catch(() => setDecoModelsLoaded(false));
    }
  }, [equippedDecorations, placedDecorations, placementPreviewItem]);
  
  useEffect(() => {
    let cancelled = false;
    
    if (customFloorModelPath) {
      setCustomFloorLoaded(false);
      loadAndNormalizeFloorModel(customFloorModelPath, DEFAULT_GRID_CONFIG.gridSize)
        .then((model) => {
          if (!cancelled) {
            customFloorModelRef.current = model;
            setCustomFloorLoaded(true);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            console.error('Failed to load custom floor model:', error);
            setCustomFloorLoaded(false);
          }
        });
    } else {
      customFloorModelRef.current = null;
      setCustomFloorLoaded(false);
    }
    
    return () => {
      cancelled = true;
    };
  }, [customFloorModelPath]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const blocksGroupRef = useRef<THREE.Group | null>(null);
  const invertXRef = useRef(invertX);
  const invertYRef = useRef(invertY);
  const mouseSensitivityRef = useRef(mouseSensitivity);
  const wheelSensitivityRef = useRef(wheelSensitivity);
  
  useEffect(() => {
    invertXRef.current = invertX;
    invertYRef.current = invertY;
    mouseSensitivityRef.current = mouseSensitivity;
    wheelSensitivityRef.current = wheelSensitivity;
  }, [invertX, invertY, mouseSensitivity, wheelSensitivity]);
  const currentPieceGroupRef = useRef<THREE.Group | null>(null);
  const ghostPieceGroupRef = useRef<THREE.Group | null>(null);
  const gridMeshRef = useRef<THREE.Mesh | null>(null);
  const floorMeshRef = useRef<THREE.Mesh | null>(null);
  const physicsBlocksGroupRef = useRef<THREE.Group | null>(null);
  const physicsBlockMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const shakingBlocksRef = useRef<ShakingBlock[]>([]);
  const destroyingBlocksRef = useRef<DestroyingBlock[]>([]);
  const fallingBlocksRef = useRef<FallingBlock[]>([]);
  const dogGroupRef = useRef<THREE.Group | null>(null);
  const petGroupsRef = useRef<Map<string, THREE.Group>>(new Map());
  const decorationsGroupRef = useRef<THREE.Group | null>(null);
  const ghostPreviewRef = useRef<THREE.Group | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const groundPlaneRef = useRef<THREE.Mesh | null>(null);
  const petStatesRef = useRef<Map<string, {
    posX: number;
    posY: number;
    posZ: number;
    velY: number;
    targetX: number;
    targetZ: number;
    state: 'walking' | 'sitting' | 'idle';
    stateTimer: number;
    walkSpeed: number;
    tailPhase: number;
    legPhase: number;
    headBob: number;
    earWiggle: number;
    isLeftSide: boolean;
  }>>(new Map());
  const dogStateRef = useRef<{
    posX: number;
    posY: number;
    posZ: number;
    velY: number;
    targetX: number;
    targetZ: number;
    state: 'walking' | 'sitting' | 'idle';
    stateTimer: number;
    walkSpeed: number;
    tailPhase: number;
    legPhase: number;
    headBob: number;
    earWiggle: number;
  }>({
    posX: 5,
    posY: 2,
    posZ: -3,
    velY: 0,
    targetX: 5,
    targetZ: -3,
    state: 'idle',
    stateTimer: 0,
    walkSpeed: 0.03,
    tailPhase: 0,
    legPhase: 0,
    headBob: 0,
    earWiggle: 0,
  });
  const animationFrameRef = useRef<number | null>(null);
  const isAnimatingRef = useRef(false);
  const previousBoardRef = useRef<(string | null)[][]>([]);
  const [isUserRotating, setIsUserRotating] = useState(false);
  const [webGLAvailable, setWebGLAvailable] = useState(true);
  
  const cameraAngleRef = useRef({ theta: Math.PI / 2, phi: Math.PI / 2.5 });
  const cameraDistanceRef = useRef(32);
  const targetZoomRef = useRef(32);
  const zoomVelocityRef = useRef(0);
  const [animationTick, setAnimationTick] = useState(0);
  
  // Zoom constants
  const ZOOM_MIN = 15;
  const ZOOM_MAX = 65;
  const ZOOM_ELASTIC_LIMIT = 8; // How far past limits you can stretch
  const ZOOM_SPRING_STRENGTH = 0.15; // How fast it springs back
  const ZOOM_DAMPING = 0.85; // Velocity damping
  const ZOOM_LERP_SPEED = 0.12; // Smooth zoom interpolation
  
  // Touch control refs
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastTouchRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number>(32);
  const touchCountRef = useRef(0);
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  
  // Bump effect refs for wall collision impact
  const bumpStartTimeRef = useRef<number>(0);
  const lastBumpTimestampRef = useRef<number>(0);
  const bumpDirectionRef = useRef<'left' | 'right' | 'down' | 'rotate' | null>(null);
  
  // Keyboard camera control refs (WASD for position offset, QE for tilt)
  const cameraTiltRef = useRef(0); // Roll angle in radians
  const cameraOffsetRef = useRef({ x: 0, y: 0 }); // Camera position offset (left/right, up/down)
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const CAMERA_OFFSET_SPEED = 0.15; // Speed for WASD camera position movement
  const CAMERA_TILT_SPEED = 0.02; // Speed for QE tilt
  
  // Spectator mode refs
  const spectatorModeRef = useRef(spectatorMode);
  const externalCameraRef = useRef(externalCamera);
  const onCameraChangeRef = useRef(onCameraChange);
  const liteModeRef = useRef(liteMode);
  const onContextLostRef = useRef(onContextLost);
  
  // Keep refs in sync
  useEffect(() => {
    spectatorModeRef.current = spectatorMode;
  }, [spectatorMode]);
  
  useEffect(() => {
    externalCameraRef.current = externalCamera;
  }, [externalCamera]);
  
  useEffect(() => {
    onCameraChangeRef.current = onCameraChange;
  }, [onCameraChange]);
  
  useEffect(() => {
    onContextLostRef.current = onContextLost;
  }, [onContextLost]);
  
  useEffect(() => {
    liteModeRef.current = liteMode;
  }, [liteMode]);
  
  // External camera is applied in animate() loop via ref - no useEffect needed
  // This prevents infinite re-renders when externalCamera object changes

  const createBlockMaterial = useCallback((color: string, opacity = 1) => {
    const cacheKey = `${blockTexture}_${color}_${opacity}`;
    
    if (materialCache.has(cacheKey)) {
      return materialCache.get(cacheKey)!;
    }
    
    const baseColor = new THREE.Color(color);
    let material: THREE.Material;
    
    switch (blockTexture) {
      case 'metallic': {
        material = new THREE.MeshStandardMaterial({
          map: getCachedMetallicTexture(color),
          transparent: opacity < 1,
          opacity,
          roughness: 0.2,
          roughnessMap: getCachedMetallicRoughnessMap(),
          metalness: 0.95,
          normalMap: getCachedMetallicNormalMap(),
          normalScale: new THREE.Vector2(0.3, 0.3),
          envMapIntensity: 2.0,
        });
        break;
      }
      case 'wood': {
        material = new THREE.MeshStandardMaterial({
          map: getCachedWoodTexture(color),
          transparent: opacity < 1,
          opacity,
          roughness: 0.8,
          metalness: 0.0,
          bumpMap: getCachedWoodBumpMap(),
          bumpScale: 0.03,
        });
        break;
      }
      case 'block_obsidian_matte': {
        const darkenedColor = baseColor.clone().multiplyScalar(0.7);
        material = new THREE.MeshStandardMaterial({
          color: darkenedColor,
          transparent: opacity < 1,
          opacity,
          roughness: 0.95,
          metalness: 0.05,
          flatShading: true,
        });
        break;
      }
      case 'block_neon_crystal': {
        const brightColor = baseColor.clone();
        brightColor.r = Math.min(1, brightColor.r * 1.3);
        brightColor.g = Math.min(1, brightColor.g * 1.3);
        brightColor.b = Math.min(1, brightColor.b * 1.3);
        material = new THREE.MeshPhysicalMaterial({
          color: brightColor,
          transparent: true,
          opacity: Math.max(0.85, opacity),
          roughness: 0.05,
          metalness: 0.2,
          clearcoat: 1.0,
          clearcoatRoughness: 0.05,
          transmission: 0.3,
          thickness: 0.5,
          emissive: baseColor,
          emissiveIntensity: 0.4,
        });
        break;
      }
      case 'block_hologram': {
        material = new THREE.MeshPhysicalMaterial({
          color: baseColor,
          transparent: true,
          opacity: 0.75,
          roughness: 0.0,
          metalness: 0.8,
          clearcoat: 1.0,
          clearcoatRoughness: 0.0,
          iridescence: 1.0,
          iridescenceIOR: 1.5,
          iridescenceThicknessRange: [100, 400],
          emissive: baseColor,
          emissiveIntensity: 0.15,
        });
        break;
      }
      case 'block_retro_pixel': {
        material = new THREE.MeshBasicMaterial({
          color: baseColor,
          transparent: opacity < 1,
          opacity,
        });
        break;
      }
      default:
        material = new THREE.MeshPhysicalMaterial({
          color: baseColor,
          transparent: opacity < 1,
          opacity,
          roughness: 0.2,
          metalness: 0.1,
          clearcoat: 0.3,
          clearcoatRoughness: 0.2,
        });
    }
    
    materialCache.set(cacheKey, material);
    return material;
  }, [blockTexture]);

  const updateCameraPosition = useCallback(() => {
    if (!cameraRef.current) return;
    
    // In spectator mode with external camera, apply the external camera state
    if (spectatorModeRef.current && externalCameraRef.current) {
      const ext = externalCameraRef.current;
      cameraRef.current.position.set(ext.position.x, ext.position.y, ext.position.z);
      cameraRef.current.lookAt(ext.target.x, ext.target.y, ext.target.z);
      cameraRef.current.updateMatrixWorld();
      return;
    }
    
    const { theta, phi } = cameraAngleRef.current;
    const distance = cameraDistanceRef.current;
    const tilt = cameraTiltRef.current;
    const offset = cameraOffsetRef.current;
    const centerX = BOARD_WIDTH / 2;
    const centerY = BOARD_HEIGHT / 2;
    
    const x = centerX + distance * Math.sin(phi) * Math.cos(theta);
    const y = centerY + distance * Math.cos(phi);
    const z = distance * Math.sin(phi) * Math.sin(theta);
    
    // Apply WASD offset to both camera position and lookAt target
    // This moves the camera in screen space while keeping the same viewing angle
    cameraRef.current.position.set(x + offset.x, y + offset.y, z);
    
    // Apply tilt (roll) by rotating the camera's up vector before lookAt
    const upX = Math.sin(tilt);
    const upY = Math.cos(tilt);
    cameraRef.current.up.set(upX, upY, 0).normalize();
    
    // LookAt target also moves with the offset to maintain viewing direction
    const targetX = centerX + offset.x;
    const targetY = centerY + offset.y;
    cameraRef.current.lookAt(targetX, targetY, 0);
    cameraRef.current.updateMatrixWorld();
    
    // Emit camera state for multiplayer sync
    if (onCameraChangeRef.current && !spectatorModeRef.current) {
      onCameraChangeRef.current({
        position: { x: x + offset.x, y: y + offset.y, z },
        target: { x: targetX, y: targetY, z: 0 },
      });
    }
  }, []);

  useEffect(() => {
    const initId = Math.random().toString(36).substring(7);
    const debugLog = (msg: string, data?: any) => {
      console.log(`[GameRenderer3D:${initId}] ${msg}`, data !== undefined ? data : '');
      onDebugLog?.(`GameRenderer3D:${initId}`, msg, data);
    };
    
    debugLog('INIT START', { liteMode, spectatorMode, viewMode });
    
    if (!containerRef.current) {
      debugLog('INIT ABORT - no container');
      return;
    }
    
    if (!isWebGLAvailable()) {
      debugLog('INIT ABORT - WebGL not available');
      setWebGLAvailable(false);
      return;
    }

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    debugLog('Container size', { width, height });

    const scene = new THREE.Scene();
    scene.background = null; // Transparent background (original design)
    sceneRef.current = scene;
    debugLog('Scene created');

    if (viewMode === '2d') {
      const frustumSize = 28;
      const aspect = width / height;
      const camera = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        -frustumSize / 2,
        0.1,
        1000
      );
      cameraRef.current = camera;
      
      const centerX = BOARD_WIDTH / 2;
      const centerY = BOARD_HEIGHT / 2;
      camera.position.set(centerX, centerY, 30);
      camera.lookAt(centerX, centerY, 0);
      camera.updateMatrixWorld();
    } else {
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      cameraRef.current = camera;
      
      cameraAngleRef.current = { theta: Math.PI / 2, phi: Math.PI / 2.5 };
      cameraDistanceRef.current = 32;
      targetZoomRef.current = 32;
      zoomVelocityRef.current = 0;
      updateCameraPosition();
    }

    let renderer: THREE.WebGLRenderer;
    debugLog('Creating WebGLRenderer...');
    try {
      renderer = new THREE.WebGLRenderer({ 
        antialias: !liteMode,
        alpha: true,
        powerPreference: liteMode ? 'low-power' : 'high-performance',
      });
      debugLog('WebGLRenderer created successfully');
    } catch (e) {
      debugLog('WebGLRenderer creation FAILED', { error: String(e) });
      setWebGLAvailable(false);
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(liteMode ? 0.5 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !liteMode;
    if (!liteMode) {
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    debugLog('Renderer attached to DOM');
    
    const canvas = renderer.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      debugLog('WebGL CONTEXT LOST', { liteMode });
      isAnimatingRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      onContextLostRef.current?.();
    };
    const handleContextRestored = () => {
      debugLog('WebGL context restored - restarting animation', { liteMode });
      if (!isAnimatingRef.current && rendererRef.current) {
        isAnimatingRef.current = true;
      }
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    
    if (onRendererReady) {
      onRendererReady(renderer);
    }

    // Skip environment texture in liteMode for faster initialization
    if (!liteMode) {
      const envCanvas = document.createElement('canvas');
      envCanvas.width = 512;
      envCanvas.height = 256;
      const envCtx = envCanvas.getContext('2d');
      if (envCtx) {
        const gradient = envCtx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(0.3, '#16213e');
        gradient.addColorStop(0.5, '#0f3460');
        gradient.addColorStop(0.7, '#16213e');
        gradient.addColorStop(1, '#1a1a2e');
        envCtx.fillStyle = gradient;
        envCtx.fillRect(0, 0, 512, 256);
        
        for (let i = 0; i < 30; i++) {
          const x = Math.random() * 512;
          const y = Math.random() * 128;
          const radius = 1 + Math.random() * 3;
          const brightness = 150 + Math.floor(Math.random() * 105);
          envCtx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
          envCtx.beginPath();
          envCtx.arc(x, y, radius, 0, Math.PI * 2);
          envCtx.fill();
        }
        
        const envTexture = new THREE.CanvasTexture(envCanvas);
        envTexture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = envTexture;
      }
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (viewMode === '2d' || spectatorModeRef.current) return;
      if (e.button === 0 || e.button === 2) {
        isDraggingRef.current = true;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        setIsUserRotating(true);
        onRotatingChange?.(true);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (viewMode === '2d' || spectatorModeRef.current) return;
      if (!isDraggingRef.current) return;
      
      const deltaX = e.clientX - lastMouseRef.current.x;
      const deltaY = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      
      const xFactor = invertXRef.current ? -1 : 1;
      const yFactor = invertYRef.current ? -1 : 1;
      const sensitivityMultiplier = mouseSensitivityRef.current / 50;
      
      cameraAngleRef.current.theta += deltaX * 0.005 * xFactor * sensitivityMultiplier;
      cameraAngleRef.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraAngleRef.current.phi + deltaY * 0.005 * yFactor * sensitivityMultiplier));
      
      updateCameraPosition();
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsUserRotating(false);
      onRotatingChange?.(false);
    };

    const handleWheel = (e: WheelEvent) => {
      if (viewMode === '2d' || spectatorModeRef.current) return;
      e.preventDefault();
      const wheelMultiplier = wheelSensitivityRef.current / 50;
      const delta = e.deltaY * 0.025 * wheelMultiplier;
      targetZoomRef.current += delta;
      
      // Apply elastic resistance when going past limits
      if (targetZoomRef.current < ZOOM_MIN) {
        const overshoot = ZOOM_MIN - targetZoomRef.current;
        const resistance = 1 - (overshoot / ZOOM_ELASTIC_LIMIT);
        targetZoomRef.current = ZOOM_MIN - overshoot * Math.max(0.1, resistance);
        targetZoomRef.current = Math.max(ZOOM_MIN - ZOOM_ELASTIC_LIMIT, targetZoomRef.current);
      } else if (targetZoomRef.current > ZOOM_MAX) {
        const overshoot = targetZoomRef.current - ZOOM_MAX;
        const resistance = 1 - (overshoot / ZOOM_ELASTIC_LIMIT);
        targetZoomRef.current = ZOOM_MAX + overshoot * Math.max(0.1, resistance);
        targetZoomRef.current = Math.min(ZOOM_MAX + ZOOM_ELASTIC_LIMIT, targetZoomRef.current);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Touch event handlers for mobile
    const getTouchDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (viewMode === '2d' || spectatorModeRef.current) return;
      touchCountRef.current = e.touches.length;
      
      if (e.touches.length === 1) {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setIsUserRotating(true);
        onRotatingChange?.(true);
      } else if (e.touches.length === 2) {
        initialPinchDistanceRef.current = getTouchDistance(e.touches);
        initialPinchZoomRef.current = cameraDistanceRef.current;
        setIsUserRotating(true);
        onRotatingChange?.(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (viewMode === '2d' || spectatorModeRef.current) return;
      e.preventDefault();
      
      if (e.touches.length === 1 && touchCountRef.current === 1) {
        // Single touch rotation
        const deltaX = e.touches[0].clientX - lastTouchRef.current.x;
        const deltaY = e.touches[0].clientY - lastTouchRef.current.y;
        lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        
        const xFactor = invertXRef.current ? -1 : 1;
        const yFactor = invertYRef.current ? -1 : 1;
        const sensitivityMultiplier = mouseSensitivityRef.current / 50;
        
        // Adjust sensitivity for touch (slightly higher than mouse)
        cameraAngleRef.current.theta += deltaX * 0.008 * xFactor * sensitivityMultiplier;
        cameraAngleRef.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraAngleRef.current.phi + deltaY * 0.008 * yFactor * sensitivityMultiplier));
        
        updateCameraPosition();
      } else if (e.touches.length === 2 && initialPinchDistanceRef.current !== null) {
        // Pinch to zoom
        const currentDistance = getTouchDistance(e.touches);
        const scale = currentDistance / initialPinchDistanceRef.current;
        
        // Inverse scale: pinch in = zoom out, pinch out = zoom in
        let newDistance = initialPinchZoomRef.current / scale;
        
        // Apply elastic resistance when going past limits
        if (newDistance < ZOOM_MIN) {
          const overshoot = ZOOM_MIN - newDistance;
          const resistance = 1 - (overshoot / ZOOM_ELASTIC_LIMIT);
          newDistance = ZOOM_MIN - overshoot * Math.max(0.1, resistance);
          newDistance = Math.max(ZOOM_MIN - ZOOM_ELASTIC_LIMIT, newDistance);
        } else if (newDistance > ZOOM_MAX) {
          const overshoot = newDistance - ZOOM_MAX;
          const resistance = 1 - (overshoot / ZOOM_ELASTIC_LIMIT);
          newDistance = ZOOM_MAX + overshoot * Math.max(0.1, resistance);
          newDistance = Math.min(ZOOM_MAX + ZOOM_ELASTIC_LIMIT, newDistance);
        }
        
        targetZoomRef.current = newDistance;
        cameraDistanceRef.current = newDistance; // Direct update for responsive pinch
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        // All touches ended
        touchStartRef.current = null;
        initialPinchDistanceRef.current = null;
        touchCountRef.current = 0;
        setIsUserRotating(false);
        onRotatingChange?.(false);
      } else if (e.touches.length === 1) {
        // Went from multi-touch to single touch
        touchCountRef.current = 1;
        initialPinchDistanceRef.current = null;
        lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    // Keyboard event handlers for WASD (pan) and QE (tilt) camera controls
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e'].includes(key)) {
        pressedKeysRef.current.add(key);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      pressedKeysRef.current.delete(key);
    };

    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('mouseleave', handleMouseUp);
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
    renderer.domElement.addEventListener('contextmenu', handleContextMenu);
    
    // Touch events with passive: false to prevent scroll
    renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', handleTouchEnd, { passive: false });
    renderer.domElement.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    
    // Keyboard events (window level for reliable capture)
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const ambientLight = new THREE.AmbientLight(0xffffff, liteMode ? 1.0 : 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, liteMode ? 0.5 : 1.0);
    directionalLight.position.set(10, 30, 20);
    // Disable shadows in liteMode for performance
    directionalLight.castShadow = !liteMode;
    if (!liteMode) {
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      directionalLight.shadow.camera.near = 0.5;
      directionalLight.shadow.camera.far = 100;
    }
    scene.add(directionalLight);

    // Skip fill light in liteMode
    if (!liteMode) {
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
      fillLight.position.set(-10, 10, 10);
      scene.add(fillLight);
    }

    // Create grid texture for the screen backing with material-based styling
    const gridCanvas = document.createElement('canvas');
    gridCanvas.width = liteMode ? 64 : 512;
    gridCanvas.height = liteMode ? 128 : 1024;
    const gridCtx = gridCanvas.getContext('2d');
    if (!gridCtx) {
      console.warn('Failed to get 2D context for grid canvas');
      return;
    }
    
    const cellWidth = gridCanvas.width / BOARD_WIDTH;
    const cellHeight = gridCanvas.height / BOARD_HEIGHT;
    
    // Apply different material styles based on gridMaterial
    // In liteMode, skip complex material generation for faster initialization
    const drawGridMaterial = () => {
      const canvasW = gridCanvas.width;
      const canvasH = gridCanvas.height;
      
      // In liteMode, use simple default style only
      if (liteMode) {
        gridCtx.fillStyle = '#1a1a2e';
        gridCtx.fillRect(0, 0, canvasW, canvasH);
        gridCtx.strokeStyle = 'rgba(255,255,255,0.2)';
        gridCtx.lineWidth = 1;
        return;
      }
      
      switch (gridMaterial) {
        case 'glass':
          // Glass: transparent with subtle white edges
          const glassGrad = gridCtx.createLinearGradient(0, 0, 512, 1024);
          glassGrad.addColorStop(0, 'rgba(100, 150, 200, 0.15)');
          glassGrad.addColorStop(0.5, 'rgba(150, 200, 255, 0.08)');
          glassGrad.addColorStop(1, 'rgba(100, 150, 200, 0.15)');
          gridCtx.fillStyle = glassGrad;
          gridCtx.fillRect(0, 0, 512, 1024);
          gridCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          gridCtx.lineWidth = 1;
          break;
          
        case 'metal':
          // Metal: brushed steel look with horizontal lines
          gridCtx.fillStyle = '#2a2a2a';
          gridCtx.fillRect(0, 0, 512, 1024);
          for (let i = 0; i < 1024; i += 2) {
            const colorVal = 100 + ((i * 7) % 50);
            gridCtx.strokeStyle = `rgba(${colorVal}, ${colorVal}, ${colorVal}, 0.3)`;
            gridCtx.beginPath();
            gridCtx.moveTo(0, i);
            gridCtx.lineTo(512, i);
            gridCtx.stroke();
          }
          gridCtx.strokeStyle = 'rgba(150, 150, 150, 0.6)';
          gridCtx.lineWidth = 2;
          break;
          
        case 'neon':
          // Neon: dark background with glowing colored grid
          gridCtx.fillStyle = '#0a0a0a';
          gridCtx.fillRect(0, 0, 512, 1024);
          gridCtx.shadowColor = '#00ffff';
          gridCtx.shadowBlur = 8;
          gridCtx.strokeStyle = '#00ffff';
          gridCtx.lineWidth = 1;
          break;
          
        case 'hologram':
          // Hologram: rainbow scan lines effect
          const holoGrad = gridCtx.createLinearGradient(0, 0, 0, 1024);
          holoGrad.addColorStop(0, 'rgba(0, 255, 255, 0.1)');
          holoGrad.addColorStop(0.25, 'rgba(255, 0, 255, 0.1)');
          holoGrad.addColorStop(0.5, 'rgba(0, 255, 0, 0.1)');
          holoGrad.addColorStop(0.75, 'rgba(255, 255, 0, 0.1)');
          holoGrad.addColorStop(1, 'rgba(0, 255, 255, 0.1)');
          gridCtx.fillStyle = holoGrad;
          gridCtx.fillRect(0, 0, 512, 1024);
          // Add scan lines
          for (let i = 0; i < 1024; i += 4) {
            gridCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            gridCtx.fillRect(0, i, 512, 2);
          }
          gridCtx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
          gridCtx.lineWidth = 1;
          break;
          
        case 'matrix':
          // Matrix: green digital rain effect
          gridCtx.fillStyle = '#000a00';
          gridCtx.fillRect(0, 0, 512, 1024);
          gridCtx.font = '12px monospace';
          for (let x = 0; x < 512; x += 16) {
            for (let y = 0; y < 1024; y += 16) {
              const seed = (x * 51 + y * 17) % 96;
              const char = String.fromCharCode(0x30A0 + seed);
              const greenVal = 150 + ((x * 7 + y * 13) % 105);
              const alpha = 0.1 + ((x * 3 + y * 11) % 30) / 100;
              gridCtx.fillStyle = `rgba(0, ${greenVal}, 0, ${alpha})`;
              gridCtx.fillText(char, x, y);
            }
          }
          gridCtx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
          gridCtx.lineWidth = 1;
          break;
          
        case 'lava':
          // Lava: orange/red glowing effect
          const lavaGrad = gridCtx.createRadialGradient(256, 512, 0, 256, 512, 600);
          lavaGrad.addColorStop(0, 'rgba(255, 100, 0, 0.4)');
          lavaGrad.addColorStop(0.5, 'rgba(200, 50, 0, 0.3)');
          lavaGrad.addColorStop(1, 'rgba(100, 20, 0, 0.2)');
          gridCtx.fillStyle = '#1a0500';
          gridCtx.fillRect(0, 0, 512, 1024);
          gridCtx.fillStyle = lavaGrad;
          gridCtx.fillRect(0, 0, 512, 1024);
          // Add cracks
          for (let i = 0; i < 20; i++) {
            gridCtx.beginPath();
            const colorVal = 100 + ((i * 37) % 100);
            gridCtx.strokeStyle = `rgba(255, ${colorVal}, 0, 0.5)`;
            gridCtx.lineWidth = 1 + ((i * 7) % 20) / 10;
            const startX = ((i * 73 + 17) % 512);
            const startY = ((i * 137 + 29) % 1024);
            gridCtx.moveTo(startX, startY);
            for (let j = 0; j < 5; j++) {
              const offsetX = ((i * 31 + j * 17) % 100) - 50;
              const offsetY = ((i * 23 + j * 41) % 100);
              gridCtx.lineTo(startX + offsetX, startY + offsetY);
            }
            gridCtx.stroke();
          }
          gridCtx.strokeStyle = 'rgba(255, 150, 50, 0.5)';
          gridCtx.lineWidth = 1;
          break;
          
        case 'ice':
          // Ice: blue crystalline effect
          const iceGrad = gridCtx.createLinearGradient(0, 0, 512, 1024);
          iceGrad.addColorStop(0, 'rgba(180, 220, 255, 0.2)');
          iceGrad.addColorStop(0.5, 'rgba(200, 240, 255, 0.15)');
          iceGrad.addColorStop(1, 'rgba(150, 200, 255, 0.2)');
          gridCtx.fillStyle = '#0a1520';
          gridCtx.fillRect(0, 0, 512, 1024);
          gridCtx.fillStyle = iceGrad;
          gridCtx.fillRect(0, 0, 512, 1024);
          // Add frost crystals
          for (let i = 0; i < 30; i++) {
            const cx = ((i * 73 + 29) % 512);
            const cy = ((i * 137 + 53) % 1024);
            const alpha = 0.1 + ((i * 11) % 20) / 100;
            gridCtx.strokeStyle = `rgba(200, 230, 255, ${alpha})`;
            gridCtx.lineWidth = 1;
            for (let j = 0; j < 6; j++) {
              gridCtx.beginPath();
              gridCtx.moveTo(cx, cy);
              const angle = (j / 6) * Math.PI * 2;
              const len = 10 + ((i * 17 + j * 7) % 20);
              gridCtx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
              gridCtx.stroke();
            }
          }
          gridCtx.strokeStyle = 'rgba(150, 200, 255, 0.4)';
          gridCtx.lineWidth = 1;
          break;
          
        default:
          // Default: user's background and grid colors
          gridCtx.fillStyle = backgroundColor;
          gridCtx.fillRect(0, 0, 512, 1024);
          gridCtx.strokeStyle = gridColor;
          gridCtx.lineWidth = 1;
          break;
      }
    };
    
    drawGridMaterial();
    
    // Draw grid lines (common for all materials)
    // Vertical lines
    for (let x = 0; x <= BOARD_WIDTH; x++) {
      gridCtx.beginPath();
      gridCtx.moveTo(x * cellWidth, 0);
      gridCtx.lineTo(x * cellWidth, 1024);
      gridCtx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y <= BOARD_HEIGHT; y++) {
      gridCtx.beginPath();
      gridCtx.moveTo(0, y * cellHeight);
      gridCtx.lineTo(512, y * cellHeight);
      gridCtx.stroke();
    }
    
    // Draw border (thicker)
    gridCtx.lineWidth = 4;
    gridCtx.strokeRect(2, 2, 508, 1020);
    
    // Reset shadow for non-neon materials
    gridCtx.shadowBlur = 0;
    
    const gridTexture = new THREE.CanvasTexture(gridCanvas);
    gridTexture.magFilter = THREE.NearestFilter;
    gridTexture.minFilter = THREE.LinearFilter;
    
    // Store texture for use in floor
    const gridTextureRef = gridTexture;

    // Create separate board texture for the game board background (vertical panel)
    const boardCanvas = document.createElement('canvas');
    boardCanvas.width = liteMode ? 64 : 512;
    boardCanvas.height = liteMode ? 128 : 1024;
    const boardCtx = boardCanvas.getContext('2d');
    
    const drawBoardMaterial = () => {
      if (!boardCtx) return;
      
      const canvasW = boardCanvas.width;
      const canvasH = boardCanvas.height;
      
      // In liteMode, use simple default style only
      if (liteMode) {
        boardCtx.fillStyle = '#1a1a2e';
        boardCtx.fillRect(0, 0, canvasW, canvasH);
        boardCtx.strokeStyle = 'rgba(255,255,255,0.2)';
        boardCtx.lineWidth = 1;
        return;
      }
      
      switch (boardMaterial) {
        case 'glass':
          // Glass: transparent with subtle reflections
          const glassGrad = boardCtx.createLinearGradient(0, 0, 512, 1024);
          glassGrad.addColorStop(0, 'rgba(100, 150, 200, 0.15)');
          glassGrad.addColorStop(0.5, 'rgba(150, 200, 255, 0.08)');
          glassGrad.addColorStop(1, 'rgba(100, 150, 200, 0.15)');
          boardCtx.fillStyle = glassGrad;
          boardCtx.fillRect(0, 0, 512, 1024);
          boardCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          boardCtx.lineWidth = 1;
          break;
          
        case 'metal':
          // Metal: brushed steel look
          boardCtx.fillStyle = '#2a2a2a';
          boardCtx.fillRect(0, 0, 512, 1024);
          for (let i = 0; i < 1024; i += 2) {
            const colorVal = 100 + ((i * 7) % 50);
            boardCtx.strokeStyle = `rgba(${colorVal}, ${colorVal}, ${colorVal}, 0.3)`;
            boardCtx.beginPath();
            boardCtx.moveTo(0, i);
            boardCtx.lineTo(512, i);
            boardCtx.stroke();
          }
          boardCtx.strokeStyle = 'rgba(150, 150, 150, 0.6)';
          boardCtx.lineWidth = 2;
          break;
          
        case 'neon':
          // Neon: dark with glowing cyan grid
          boardCtx.fillStyle = '#0a0a0a';
          boardCtx.fillRect(0, 0, 512, 1024);
          boardCtx.shadowColor = '#00ffff';
          boardCtx.shadowBlur = 8;
          boardCtx.strokeStyle = '#00ffff';
          boardCtx.lineWidth = 1;
          break;
          
        case 'hologram':
          // Hologram: rainbow scan lines
          const holoGrad = boardCtx.createLinearGradient(0, 0, 0, 1024);
          holoGrad.addColorStop(0, 'rgba(0, 255, 255, 0.1)');
          holoGrad.addColorStop(0.25, 'rgba(255, 0, 255, 0.1)');
          holoGrad.addColorStop(0.5, 'rgba(0, 255, 0, 0.1)');
          holoGrad.addColorStop(0.75, 'rgba(255, 255, 0, 0.1)');
          holoGrad.addColorStop(1, 'rgba(0, 255, 255, 0.1)');
          boardCtx.fillStyle = holoGrad;
          boardCtx.fillRect(0, 0, 512, 1024);
          for (let i = 0; i < 1024; i += 4) {
            boardCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            boardCtx.fillRect(0, i, 512, 2);
          }
          boardCtx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
          boardCtx.lineWidth = 1;
          break;
          
        case 'matrix':
          // Matrix: digital rain
          boardCtx.fillStyle = '#000a00';
          boardCtx.fillRect(0, 0, 512, 1024);
          boardCtx.font = '12px monospace';
          for (let x = 0; x < 512; x += 16) {
            for (let y = 0; y < 1024; y += 16) {
              const seed = (x * 51 + y * 17) % 96;
              const char = String.fromCharCode(0x30A0 + seed);
              const greenVal = 150 + ((x * 7 + y * 13) % 105);
              const alpha = 0.1 + ((x * 3 + y * 11) % 30) / 100;
              boardCtx.fillStyle = `rgba(0, ${greenVal}, 0, ${alpha})`;
              boardCtx.fillText(char, x, y);
            }
          }
          boardCtx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
          boardCtx.lineWidth = 1;
          break;
          
        case 'carbon':
          // Carbon: carbon fiber pattern
          boardCtx.fillStyle = '#1a1a1a';
          boardCtx.fillRect(0, 0, 512, 1024);
          // Draw carbon fiber weave pattern
          for (let y = 0; y < 1024; y += 8) {
            for (let x = 0; x < 512; x += 8) {
              const offset = (y / 8) % 2 === 0 ? 0 : 4;
              boardCtx.fillStyle = ((x + offset) / 4) % 2 === 0 ? '#222222' : '#1a1a1a';
              boardCtx.fillRect(x, y, 4, 4);
              boardCtx.fillStyle = ((x + offset) / 4) % 2 === 0 ? '#1a1a1a' : '#222222';
              boardCtx.fillRect(x + 4, y, 4, 4);
              boardCtx.fillRect(x, y + 4, 4, 4);
              boardCtx.fillStyle = ((x + offset) / 4) % 2 === 0 ? '#222222' : '#1a1a1a';
              boardCtx.fillRect(x + 4, y + 4, 4, 4);
            }
          }
          // Add subtle sheen
          const carbonGrad = boardCtx.createLinearGradient(0, 0, 512, 0);
          carbonGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          carbonGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
          carbonGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          boardCtx.fillStyle = carbonGrad;
          boardCtx.fillRect(0, 0, 512, 1024);
          boardCtx.strokeStyle = 'rgba(80, 80, 80, 0.5)';
          boardCtx.lineWidth = 1;
          break;
          
        case 'galaxy':
          // Galaxy: starfield with nebula
          boardCtx.fillStyle = '#050510';
          boardCtx.fillRect(0, 0, 512, 1024);
          // Add stars
          for (let i = 0; i < 200; i++) {
            const x = ((i * 73 + 29) % 512);
            const y = ((i * 137 + 53) % 1024);
            const size = ((i * 17) % 20) / 10;
            const brightness = 150 + ((i * 23) % 105);
            const alpha = 0.5 + ((i * 11) % 50) / 100;
            boardCtx.fillStyle = `rgba(${brightness}, ${brightness}, ${Math.min(255, brightness + 50)}, ${alpha})`;
            boardCtx.beginPath();
            boardCtx.arc(x, y, size, 0, Math.PI * 2);
            boardCtx.fill();
          }
          // Add nebula glow
          const nebulaGrad1 = boardCtx.createRadialGradient(128, 300, 0, 128, 300, 200);
          nebulaGrad1.addColorStop(0, 'rgba(100, 50, 150, 0.2)');
          nebulaGrad1.addColorStop(1, 'rgba(100, 50, 150, 0)');
          boardCtx.fillStyle = nebulaGrad1;
          boardCtx.fillRect(0, 0, 512, 1024);
          const nebulaGrad2 = boardCtx.createRadialGradient(384, 700, 0, 384, 700, 250);
          nebulaGrad2.addColorStop(0, 'rgba(50, 100, 200, 0.15)');
          nebulaGrad2.addColorStop(1, 'rgba(50, 100, 200, 0)');
          boardCtx.fillStyle = nebulaGrad2;
          boardCtx.fillRect(0, 0, 512, 1024);
          boardCtx.strokeStyle = 'rgba(100, 100, 150, 0.3)';
          boardCtx.lineWidth = 1;
          break;
          
        default:
          // Default: user's background and grid colors
          boardCtx.fillStyle = backgroundColor;
          boardCtx.fillRect(0, 0, 512, 1024);
          boardCtx.strokeStyle = gridColor;
          boardCtx.lineWidth = 1;
          break;
      }
    };
    
    if (boardCtx) {
      drawBoardMaterial();
      
      // Draw grid lines for board
      for (let x = 0; x <= BOARD_WIDTH; x++) {
        boardCtx.beginPath();
        boardCtx.moveTo(x * cellWidth, 0);
        boardCtx.lineTo(x * cellWidth, 1024);
        boardCtx.stroke();
      }
      
      for (let y = 0; y <= BOARD_HEIGHT; y++) {
        boardCtx.beginPath();
        boardCtx.moveTo(0, y * cellHeight);
        boardCtx.lineTo(512, y * cellHeight);
        boardCtx.stroke();
      }
      
      boardCtx.lineWidth = 4;
      boardCtx.strokeRect(2, 2, 508, 1020);
      boardCtx.shadowBlur = 0;
    }
    
    const boardTexture = new THREE.CanvasTexture(boardCanvas);
    boardTexture.magFilter = THREE.NearestFilter;
    boardTexture.minFilter = THREE.LinearFilter;
    
    // Store board texture reference
    const boardTextureRef = boardTexture;

    const blocksGroup = new THREE.Group();
    blocksGroup.position.z = 0.5; // Position blocks in front of grid wall
    scene.add(blocksGroup);
    blocksGroupRef.current = blocksGroup;

    const currentPieceGroup = new THREE.Group();
    currentPieceGroup.position.z = 0.5; // Match blocks position
    scene.add(currentPieceGroup);
    currentPieceGroupRef.current = currentPieceGroup;

    const ghostPieceGroup = new THREE.Group();
    ghostPieceGroup.position.z = 0.6; // Slightly in front of blocks
    ghostPieceGroup.renderOrder = 10;
    scene.add(ghostPieceGroup);
    ghostPieceGroupRef.current = ghostPieceGroup;

    const physicsBlocksGroup = new THREE.Group();
    physicsBlocksGroup.position.z = 0.5; // Match blocks position
    scene.add(physicsBlocksGroup);
    physicsBlocksGroupRef.current = physicsBlocksGroup;

    // Board dimensions
    const boardCenterX = (BOARD_WIDTH - 1) / 2;
    const boardCenterY = (BOARD_HEIGHT - 1) / 2;
    
    // Create grid floor with radial fade effect - centered on the game board
    const floorGridSize = 80;
    const gridDivisions = 80;
    
    // Create floor grid texture with radial fade
    // In liteMode, use smaller texture and simple style
    const floorCanvasSize = liteMode ? 128 : 1024;
    const floorGridCanvas = document.createElement('canvas');
    floorGridCanvas.width = floorCanvasSize;
    floorGridCanvas.height = floorCanvasSize;
    const floorGridCtx = floorGridCanvas.getContext('2d');
    
    if (floorGridCtx) {
      const cellSize = floorCanvasSize / gridDivisions;
      
      // In liteMode, use simple default style only and skip complex materials
      if (liteMode) {
        floorGridCtx.fillStyle = 'rgba(26, 26, 46, 0.5)';
        floorGridCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
        floorGridCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        floorGridCtx.lineWidth = 1;
        // Simple grid
        for (let i = 0; i <= gridDivisions; i++) {
          floorGridCtx.beginPath();
          floorGridCtx.moveTo(i * cellSize, 0);
          floorGridCtx.lineTo(i * cellSize, floorCanvasSize);
          floorGridCtx.stroke();
          floorGridCtx.beginPath();
          floorGridCtx.moveTo(0, i * cellSize);
          floorGridCtx.lineTo(floorCanvasSize, i * cellSize);
          floorGridCtx.stroke();
        }
      }
      
      if (!liteMode) {
      // Apply floor material styles based on gridMaterial
      switch (gridMaterial) {
        case 'glass':
          const glassGrad = floorGridCtx.createLinearGradient(0, 0, floorCanvasSize, floorCanvasSize);
          glassGrad.addColorStop(0, 'rgba(100, 150, 200, 0.3)');
          glassGrad.addColorStop(0.5, 'rgba(150, 200, 255, 0.2)');
          glassGrad.addColorStop(1, 'rgba(100, 150, 200, 0.3)');
          floorGridCtx.fillStyle = glassGrad;
          floorGridCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
          floorGridCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          break;
          
        case 'metal':
          floorGridCtx.fillStyle = '#2a2a2a';
          floorGridCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
          for (let i = 0; i < floorCanvasSize; i += 4) {
            const colorVal = 100 + ((i * 7) % 50);
            floorGridCtx.strokeStyle = `rgba(${colorVal}, ${colorVal}, ${colorVal}, 0.3)`;
            floorGridCtx.beginPath();
            floorGridCtx.moveTo(0, i);
            floorGridCtx.lineTo(floorCanvasSize, i);
            floorGridCtx.stroke();
          }
          floorGridCtx.strokeStyle = 'rgba(150, 150, 150, 0.6)';
          break;
          
        case 'neon':
          floorGridCtx.fillStyle = '#0a0a0a';
          floorGridCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
          floorGridCtx.shadowColor = '#00ffff';
          floorGridCtx.shadowBlur = 8;
          floorGridCtx.strokeStyle = '#00ffff';
          break;
          
        case 'hologram':
          const holoGrad = floorGridCtx.createLinearGradient(0, 0, floorCanvasSize, floorCanvasSize);
          holoGrad.addColorStop(0, 'rgba(0, 255, 255, 0.15)');
          holoGrad.addColorStop(0.25, 'rgba(255, 0, 255, 0.15)');
          holoGrad.addColorStop(0.5, 'rgba(0, 255, 0, 0.15)');
          holoGrad.addColorStop(0.75, 'rgba(255, 255, 0, 0.15)');
          holoGrad.addColorStop(1, 'rgba(0, 255, 255, 0.15)');
          floorGridCtx.fillStyle = holoGrad;
          floorGridCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
          floorGridCtx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
          break;
          
        case 'matrix':
          floorGridCtx.fillStyle = '#000a00';
          floorGridCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
          floorGridCtx.font = '14px monospace';
          for (let x = 0; x < floorCanvasSize; x += 20) {
            for (let y = 0; y < floorCanvasSize; y += 20) {
              const seed = (x * 51 + y * 17) % 96;
              const char = String.fromCharCode(0x30A0 + seed);
              const greenVal = 150 + ((x * 7 + y * 13) % 105);
              const alpha = 0.15 + ((x * 3 + y * 11) % 25) / 100;
              floorGridCtx.fillStyle = `rgba(0, ${greenVal}, 0, ${alpha})`;
              floorGridCtx.fillText(char, x, y);
            }
          }
          floorGridCtx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
          break;
          
        case 'lava':
          const lavaGrad = floorGridCtx.createRadialGradient(floorCanvasSize/2, floorCanvasSize/2, 0, floorCanvasSize/2, floorCanvasSize/2, floorCanvasSize * 0.7);
          lavaGrad.addColorStop(0, 'rgba(255, 100, 0, 0.5)');
          lavaGrad.addColorStop(0.5, 'rgba(200, 50, 0, 0.4)');
          lavaGrad.addColorStop(1, 'rgba(100, 20, 0, 0.3)');
          floorGridCtx.fillStyle = '#1a0500';
          floorGridCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
          floorGridCtx.fillStyle = lavaGrad;
          floorGridCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
          for (let i = 0; i < 30; i++) {
            floorGridCtx.beginPath();
            const colorVal = 100 + ((i * 37) % 100);
            floorGridCtx.strokeStyle = `rgba(255, ${colorVal}, 0, 0.5)`;
            floorGridCtx.lineWidth = 1 + ((i * 7) % 20) / 10;
            const startX = ((i * 73 + 17) % 1024);
            const startY = ((i * 137 + 29) % 1024);
            floorGridCtx.moveTo(startX, startY);
            for (let j = 0; j < 5; j++) {
              const offsetX = ((i * 31 + j * 17) % 100) - 50;
              const offsetY = ((i * 23 + j * 41) % 100);
              floorGridCtx.lineTo(startX + offsetX, startY + offsetY);
            }
            floorGridCtx.stroke();
          }
          floorGridCtx.strokeStyle = 'rgba(255, 100, 0, 0.4)';
          floorGridCtx.lineWidth = 1;
          break;
          
        case 'ice':
          const iceGrad = floorGridCtx.createLinearGradient(0, 0, floorCanvasSize, floorCanvasSize);
          iceGrad.addColorStop(0, 'rgba(200, 230, 255, 0.4)');
          iceGrad.addColorStop(0.5, 'rgba(150, 200, 255, 0.3)');
          iceGrad.addColorStop(1, 'rgba(200, 230, 255, 0.4)');
          floorGridCtx.fillStyle = iceGrad;
          floorGridCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
          for (let i = 0; i < 50; i++) {
            floorGridCtx.beginPath();
            floorGridCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            floorGridCtx.lineWidth = 0.5;
            const x = ((i * 73 + 29) % 1024);
            const y = ((i * 137 + 53) % 1024);
            floorGridCtx.moveTo(x, y);
            const offsetX = ((i * 31) % 50) - 25;
            const offsetY = ((i * 23) % 50) - 25;
            floorGridCtx.lineTo(x + offsetX, y + offsetY);
            floorGridCtx.stroke();
          }
          floorGridCtx.strokeStyle = 'rgba(150, 200, 255, 0.4)';
          floorGridCtx.lineWidth = 1;
          break;
          
        default:
          floorGridCtx.fillStyle = '#1a1a1a';
          floorGridCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
          floorGridCtx.strokeStyle = '#333333';
          break;
      }
      
      // Draw grid lines (only in normal mode)
      floorGridCtx.lineWidth = 1;
      for (let i = 0; i <= gridDivisions; i++) {
        const pos = i * cellSize;
        floorGridCtx.beginPath();
        floorGridCtx.moveTo(pos, 0);
        floorGridCtx.lineTo(pos, floorCanvasSize);
        floorGridCtx.stroke();
        floorGridCtx.beginPath();
        floorGridCtx.moveTo(0, pos);
        floorGridCtx.lineTo(floorCanvasSize, pos);
        floorGridCtx.stroke();
      }
      
      // Apply radial gradient fade using composite operation
      floorGridCtx.shadowBlur = 0;
      floorGridCtx.globalCompositeOperation = 'destination-in';
      const centerX = floorCanvasSize / 2;
      const centerY = floorCanvasSize / 2;
      const innerRadius = floorCanvasSize * 0.15;
      const outerRadius = floorCanvasSize * 0.5;
      
      const gradient = floorGridCtx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, outerRadius);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.7)');
      gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.3)');
      gradient.addColorStop(0.9, 'rgba(255, 255, 255, 0.1)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      floorGridCtx.fillStyle = gradient;
      floorGridCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
      floorGridCtx.globalCompositeOperation = 'source-over';
      } // End of if (!liteMode)
    }
    
    const floorGridTexture = new THREE.CanvasTexture(floorGridCanvas);
    
    // Create floor plane with grid texture and radial fade
    const floorGeometry = new THREE.PlaneGeometry(floorGridSize, floorGridSize);
    const floorMaterial = new THREE.MeshBasicMaterial({
      map: floorGridTexture,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(boardCenterX, -0.5, 0);
    scene.add(floorMesh);
    floorMeshRef.current = floorMesh;
    
    // Vertical grid wall (game board background) - uses boardMaterial with block thickness
    const BOARD_THICKNESS = 1.0; // Same as block thickness
    const gridBoxGeometry = new THREE.BoxGeometry(BOARD_WIDTH, BOARD_HEIGHT, BOARD_THICKNESS);
    const gridPlaneMaterial = new THREE.MeshBasicMaterial({
      map: boardTextureRef,
      side: THREE.DoubleSide,
    });
    const gridBackingMesh = new THREE.Mesh(gridBoxGeometry, gridPlaneMaterial);
    gridBackingMesh.position.set(boardCenterX, boardCenterY, -BOARD_THICKNESS / 2);
    scene.add(gridBackingMesh);
    gridMeshRef.current = gridBackingMesh;
    
    // Thin border frame around the game board
    const borderMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.3,
      metalness: 0.7,
    });
    
    // Left border
    const leftBorderGeom = new THREE.BoxGeometry(0.1, BOARD_HEIGHT + 0.1, 0.3);
    const leftBorder = new THREE.Mesh(leftBorderGeom, borderMaterial);
    leftBorder.position.set(-0.55, boardCenterY, 0.15);
    scene.add(leftBorder);
    
    // Right border
    const rightBorder = new THREE.Mesh(leftBorderGeom, borderMaterial);
    rightBorder.position.set(BOARD_WIDTH - 0.45, boardCenterY, 0.15);
    scene.add(rightBorder);
    
    // Top border
    const topBorderGeom = new THREE.BoxGeometry(BOARD_WIDTH + 0.2, 0.1, 0.3);
    const topBorder = new THREE.Mesh(topBorderGeom, borderMaterial);
    topBorder.position.set(boardCenterX, BOARD_HEIGHT - 0.45, 0.15);
    scene.add(topBorder);
    
    // Bottom border (connects to floor)
    const bottomBorder = new THREE.Mesh(topBorderGeom, borderMaterial);
    bottomBorder.position.set(boardCenterX, -0.55, 0.15);
    scene.add(bottomBorder);

    // Create pet models for all selected pets - SKIP in liteMode for performance
    petGroupsRef.current.clear();
    petStatesRef.current.clear();
    
    if (!liteMode) {
      activePets.forEach((petId, index) => {
        const petGroup = createPetModel(petId);
        // Randomly spawn on left or right side of the game board
        const isLeftSide = Math.random() > 0.5;
        const sideOffset = index * 1.5;
        const posX = isLeftSide ? (-3 - sideOffset) : (BOARD_WIDTH + 2 + sideOffset);
        const posZ = 2 + Math.random() * 3; // In front of the board
        petGroup.position.set(posX, 2, posZ);
        petGroup.scale.set(1.2, 1.2, 1.2);
        petGroup.visible = showPet;
        scene.add(petGroup);
        petGroupsRef.current.set(petId, petGroup);
        
        petStatesRef.current.set(petId, {
          posX: posX,
          posY: 2,
          posZ: posZ,
          velY: 0,
          targetX: posX,
          targetZ: posZ,
          state: 'idle',
          stateTimer: 0,
          walkSpeed: 0.03,
          tailPhase: Math.random() * Math.PI * 2,
          legPhase: Math.random() * Math.PI * 2,
          headBob: 0,
          earWiggle: 0,
          isLeftSide: isLeftSide,
        });
      });
      
      // Keep legacy single pet ref for backward compatibility
      const firstPetGroup = petGroupsRef.current.get(activePets[0]);
      if (firstPetGroup) {
        dogGroupRef.current = firstPetGroup;
      }

      // Initialize pet position (simple physics)
      dogStateRef.current.posX = 5;
      dogStateRef.current.posY = 2;
      dogStateRef.current.posZ = -3;
      dogStateRef.current.velY = 0;
    }

    // Create decorations group - SKIP in liteMode for performance
    const decorationsGroup = new THREE.Group();
    decorationsGroup.name = 'decorations';
    decorationsGroupRef.current = decorationsGroup;
    
    if (!liteMode) {
      scene.add(decorationsGroup);

      // Add equipped decorations
      Object.entries(equippedDecorations).forEach(([slot, decorationId]) => {
        if (!decorationId) return;
        const position = DECORATION_SLOT_POSITIONS[slot as keyof typeof DECORATION_SLOT_POSITIONS];
        if (!position) return;
        
        const decoModel = createDecorationModel(decorationId);
        decoModel.position.set(
          position.x + BOARD_WIDTH / 2 - 0.5,
          0,
          position.z
        );
        decoModel.userData.slot = slot;
        decorationsGroup.add(decoModel);
      });
    }

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      
      if (cameraRef.current instanceof THREE.PerspectiveCamera) {
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
      } else if (cameraRef.current instanceof THREE.OrthographicCamera) {
        const frustumSize = 28;
        const aspect = w / h;
        cameraRef.current.left = -frustumSize * aspect / 2;
        cameraRef.current.right = frustumSize * aspect / 2;
        cameraRef.current.top = frustumSize / 2;
        cameraRef.current.bottom = -frustumSize / 2;
        cameraRef.current.updateProjectionMatrix();
      }
      
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    let lastFrameTime = performance.now();
    const LITE_MODE_FRAME_INTERVAL = 67; // ~15fps for liteMode (spectator view) - reduced GPU load for dual renderer stability
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    // Mark animation loop as active
    isAnimatingRef.current = true;
    debugLog('Animation loop starting', { liteMode, spectatorMode });
    
    // Debug: frame counter for logging
    let frameCount = 0;
    const DEBUG_LOG_INTERVAL = 300; // Log every 300 frames (~5 seconds at 60fps, ~10 seconds at 30fps)
    const EARLY_LOG_FRAMES = [1, 5, 10, 20, 50, 100]; // Log these early frames for debugging
    
    const animate = () => {
      // Stop animation loop if component unmounted or effect cleanup ran
      if (!isAnimatingRef.current) {
        console.log(`[GameRenderer3D:${initId}] animate loop stopped (isAnimatingRef=false), liteMode=${liteModeRef.current}, spectator=${spectatorModeRef.current}`);
        return;
      }
      
      frameCount++;
      
      // Log early frames for debugging initialization - send to server for remote debugging
      if (EARLY_LOG_FRAMES.includes(frameCount)) {
        debugLog(`Frame ${frameCount}`, { liteMode: liteModeRef.current, spectator: spectatorModeRef.current });
      }
      
      // Debug logging every N frames - send to server
      if (frameCount % DEBUG_LOG_INTERVAL === 0) {
        debugLog(`Frame ${frameCount}`, { liteMode: liteModeRef.current, spectator: spectatorModeRef.current, renderer: !!rendererRef.current, scene: !!sceneRef.current, camera: !!cameraRef.current });
      }
      
      // In liteMode, use setTimeout for true frame limiting (reduces CPU usage)
      // In normal mode, use RAF for smooth 60fps
      if (liteModeRef.current) {
        timeoutId = setTimeout(animate, LITE_MODE_FRAME_INTERVAL);
      } else {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
      
      const now = performance.now();
      const deltaTime = (now - lastFrameTime) / 1000;
      lastFrameTime = now;
      
      if (onFrame) {
        onFrame(deltaTime);
      }
      
      // Skip 3D camera updates in 2D mode
      if (viewMode === '3d') {
        // Smooth zoom animation with elastic spring-back
        const currentZoom = cameraDistanceRef.current;
        let targetZoom = targetZoomRef.current;
        
        // Spring back if outside valid range
        if (targetZoom < ZOOM_MIN) {
          zoomVelocityRef.current += (ZOOM_MIN - targetZoom) * ZOOM_SPRING_STRENGTH;
          zoomVelocityRef.current *= ZOOM_DAMPING;
          targetZoomRef.current += zoomVelocityRef.current;
          targetZoom = targetZoomRef.current;
        } else if (targetZoom > ZOOM_MAX) {
          zoomVelocityRef.current += (ZOOM_MAX - targetZoom) * ZOOM_SPRING_STRENGTH;
          zoomVelocityRef.current *= ZOOM_DAMPING;
          targetZoomRef.current += zoomVelocityRef.current;
          targetZoom = targetZoomRef.current;
        } else {
          // When in valid range, decay velocity
          zoomVelocityRef.current *= 0.5;
        }
        
        // Smooth lerp towards target
        const diff = targetZoom - currentZoom;
        if (Math.abs(diff) > 0.01) {
          cameraDistanceRef.current += diff * ZOOM_LERP_SPEED;
          updateCameraPosition();
        }
        
        // Process keyboard input for camera controls (WASD position, QE tilt)
        const keys = pressedKeysRef.current;
        let cameraUpdated = false;
        
        // WASD for camera position offset (moves camera up/down/left/right while keeping same view direction)
        if (keys.has('a')) {
          cameraOffsetRef.current.x -= CAMERA_OFFSET_SPEED;
          cameraUpdated = true;
        }
        if (keys.has('d')) {
          cameraOffsetRef.current.x += CAMERA_OFFSET_SPEED;
          cameraUpdated = true;
        }
        if (keys.has('w')) {
          cameraOffsetRef.current.y += CAMERA_OFFSET_SPEED;
          cameraUpdated = true;
        }
        if (keys.has('s')) {
          cameraOffsetRef.current.y -= CAMERA_OFFSET_SPEED;
          cameraUpdated = true;
        }
        
        // QE for camera tilt (roll)
        if (keys.has('q')) {
          cameraTiltRef.current = Math.max(-Math.PI / 4, cameraTiltRef.current - CAMERA_TILT_SPEED);
          cameraUpdated = true;
        }
        if (keys.has('e')) {
          cameraTiltRef.current = Math.min(Math.PI / 4, cameraTiltRef.current + CAMERA_TILT_SPEED);
          cameraUpdated = true;
        }
        
        if (cameraUpdated) {
          updateCameraPosition();
        }
      } // End of viewMode === '3d' block
      
      // In spectator mode, directly apply external camera (lightweight, no full updateCameraPosition)
      if (spectatorModeRef.current && externalCameraRef.current && cameraRef.current) {
        const ext = externalCameraRef.current;
        cameraRef.current.position.set(ext.position.x, ext.position.y, ext.position.z);
        cameraRef.current.lookAt(ext.target.x, ext.target.y, ext.target.z);
      }
      
      const currentTime = Date.now();
      
      // In liteMode (spectator view), skip all expensive animations for performance
      // Only render the basic scene without pet, bump, shake, or destroy animations
      if (liteModeRef.current) {
        // Just render the scene and exit early
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          // Debug: Log before render to identify if render() blocks
          if (frameCount <= 5) {
            debugLog(`Frame ${frameCount} pre-render`, { liteMode: true });
          }
          rendererRef.current.render(sceneRef.current, cameraRef.current);
          // Debug: Log after render
          if (frameCount <= 5) {
            debugLog(`Frame ${frameCount} post-render`, { liteMode: true });
          }
        }
        return;
      }
      
      // Skip legacy single-pet animation when using multi-pet mode
      const useMultiPetMode = selectedPets && selectedPets.length > 0;
      
      // Dog animation with simple physics (only when visible and not using multi-pet mode)
      if (!useMultiPetMode && dogGroupRef.current?.visible) {
        const dog = dogGroupRef.current;
        const state = dogStateRef.current;
        const GROUND_Y = -0.2; // Ground level for the pet
        const GRAVITY = 0.015;
        
        // Simple gravity physics
        state.velY -= GRAVITY;
        state.posY += state.velY;
        
        // Ground collision
        if (state.posY <= GROUND_Y) {
          state.posY = GROUND_Y;
          state.velY = 0;
        }
        
        const isGrounded = state.posY <= GROUND_Y + 0.01;
        
        // Sync mesh position
        dog.position.set(state.posX, state.posY, state.posZ);
        
        // Update state timer
        state.stateTimer += 16; // ~60fps
        
        // State machine for dog behavior (only when grounded)
        if (isGrounded && state.stateTimer > 2000 + Math.random() * 3000) {
          state.stateTimer = 0;
          const rand = Math.random();
          if (rand < 0.5) {
            state.state = 'walking';
            state.targetX = 2 + Math.random() * 6;
            state.targetZ = -5 + Math.random() * 3;
          } else if (rand < 0.75) {
            state.state = 'sitting';
          } else {
            state.state = 'idle';
          }
        }
        
        // Always wag tail (happy dog!)
        state.tailPhase += 0.15;
        const tailGroup = dog.getObjectByName('tailGroup');
        if (tailGroup) {
          tailGroup.rotation.x = Math.sin(state.tailPhase) * 0.5;
          tailGroup.rotation.z = -0.5 + Math.sin(state.tailPhase * 0.5) * 0.2;
        }
        
        // Ear wiggle
        state.earWiggle += 0.08;
        const leftEar = dog.getObjectByName('leftEar');
        const rightEar = dog.getObjectByName('rightEar');
        if (leftEar && rightEar) {
          leftEar.rotation.z = Math.sin(state.earWiggle) * 0.1;
          rightEar.rotation.z = Math.sin(state.earWiggle + 0.5) * 0.1;
        }
        
        // Head group for animations
        const headGroup = dog.getObjectByName('headGroup');
        
        if (state.state === 'walking' && isGrounded) {
          // Move towards target
          const dx = state.targetX - state.posX;
          const dz = state.targetZ - state.posZ;
          const dist = Math.sqrt(dx * dx + dz * dz);
          
          if (dist > 0.1) {
            // Move position directly
            state.posX += (dx / dist) * state.walkSpeed;
            state.posZ += (dz / dist) * state.walkSpeed;
            
            // Face walking direction
            dog.rotation.y = Math.atan2(-dz, dx);
            
            // Leg animation
            state.legPhase += 0.2;
            const frontLeftLeg = dog.getObjectByName('frontLeftLeg');
            const frontRightLeg = dog.getObjectByName('frontRightLeg');
            const backLeftLeg = dog.getObjectByName('backLeftLeg');
            const backRightLeg = dog.getObjectByName('backRightLeg');
            
            if (frontLeftLeg && frontRightLeg && backLeftLeg && backRightLeg) {
              frontLeftLeg.rotation.x = Math.sin(state.legPhase) * 0.4;
              frontRightLeg.rotation.x = Math.sin(state.legPhase + Math.PI) * 0.4;
              backLeftLeg.rotation.x = Math.sin(state.legPhase + Math.PI) * 0.4;
              backRightLeg.rotation.x = Math.sin(state.legPhase) * 0.4;
            }
            
            // Head bob
            if (headGroup) {
              headGroup.rotation.z = Math.sin(state.legPhase) * 0.05;
            }
          } else {
            state.state = 'idle';
          }
        } else if (state.state === 'sitting' && isGrounded) {
          // Reset leg positions for sitting
          const frontLeftLeg = dog.getObjectByName('frontLeftLeg');
          const frontRightLeg = dog.getObjectByName('frontRightLeg');
          const backLeftLeg = dog.getObjectByName('backLeftLeg');
          const backRightLeg = dog.getObjectByName('backRightLeg');
          
          if (frontLeftLeg && frontRightLeg && backLeftLeg && backRightLeg) {
            frontLeftLeg.rotation.x = 0;
            frontRightLeg.rotation.x = 0;
            backLeftLeg.rotation.x = 0.6; // Bent for sitting
            backRightLeg.rotation.x = 0.6;
          }
          
          // Cute head tilt
          if (headGroup) {
            headGroup.rotation.z = Math.sin(currentTime * 0.001) * 0.1;
            headGroup.rotation.x = Math.sin(currentTime * 0.0015) * 0.05;
          }
        } else if (isGrounded) {
          // Idle - subtle breathing animation
          const frontLeftLeg = dog.getObjectByName('frontLeftLeg');
          const frontRightLeg = dog.getObjectByName('frontRightLeg');
          const backLeftLeg = dog.getObjectByName('backLeftLeg');
          const backRightLeg = dog.getObjectByName('backRightLeg');
          
          if (frontLeftLeg && frontRightLeg && backLeftLeg && backRightLeg) {
            frontLeftLeg.rotation.x = 0;
            frontRightLeg.rotation.x = 0;
            backLeftLeg.rotation.x = 0;
            backRightLeg.rotation.x = 0;
          }
          
          // Look around occasionally
          if (headGroup) {
            headGroup.rotation.y = Math.sin(currentTime * 0.0008) * 0.3;
            headGroup.rotation.x = Math.sin(currentTime * 0.001) * 0.05;
          }
        }
        
        // Tongue animation (panting)
        const tongue = dog.getObjectByName('tongue');
        if (tongue) {
          tongue.position.y = -0.12 + Math.sin(currentTime * 0.01) * 0.02;
          tongue.scale.y = 0.3 + Math.sin(currentTime * 0.015) * 0.1;
        }
      }
      
      // Animate all pets in petGroupsRef (for multi-pet support)
      petGroupsRef.current.forEach((petGroup, petId) => {
        if (!petGroup.visible) return;
        
        const petState = petStatesRef.current.get(petId);
        if (!petState) return;
        
        const GROUND_Y = -0.2;
        const GRAVITY = 0.015;
        
        // Simple gravity physics
        petState.velY -= GRAVITY;
        petState.posY += petState.velY;
        
        if (petState.posY <= GROUND_Y) {
          petState.posY = GROUND_Y;
          petState.velY = 0;
        }
        
        const isGrounded = petState.posY <= GROUND_Y + 0.01;
        petGroup.position.set(petState.posX, petState.posY, petState.posZ);
        
        petState.stateTimer += 16;
        
        if (isGrounded && petState.stateTimer > 2000 + Math.random() * 3000) {
          petState.stateTimer = 0;
          const rand = Math.random();
          if (rand < 0.5) {
            petState.state = 'walking';
            // Move within left or right side of the board
            if (petState.isLeftSide) {
              petState.targetX = -5 + Math.random() * 4; // Left side: -5 to -1
            } else {
              petState.targetX = BOARD_WIDTH + 1 + Math.random() * 4; // Right side
            }
            petState.targetZ = 1 + Math.random() * 4; // In front of board
          } else if (rand < 0.75) {
            petState.state = 'sitting';
          } else {
            petState.state = 'idle';
          }
        }
        
        // Tail wag animation
        petState.tailPhase += 0.15;
        const tailGroup = petGroup.getObjectByName('tailGroup');
        if (tailGroup) {
          tailGroup.rotation.x = Math.sin(petState.tailPhase) * 0.5;
          tailGroup.rotation.z = -0.5 + Math.sin(petState.tailPhase * 0.5) * 0.2;
        }
        
        // Walking behavior
        if (petState.state === 'walking' && isGrounded) {
          const dx = petState.targetX - petState.posX;
          const dz = petState.targetZ - petState.posZ;
          const dist = Math.sqrt(dx * dx + dz * dz);
          
          if (dist > 0.1) {
            petState.posX += (dx / dist) * petState.walkSpeed;
            petState.posZ += (dz / dist) * petState.walkSpeed;
            petGroup.rotation.y = Math.atan2(-dz, dx);
            
            petState.legPhase += 0.2;
            const frontLeftLeg = petGroup.getObjectByName('frontLeftLeg');
            const frontRightLeg = petGroup.getObjectByName('frontRightLeg');
            const backLeftLeg = petGroup.getObjectByName('backLeftLeg');
            const backRightLeg = petGroup.getObjectByName('backRightLeg');
            
            if (frontLeftLeg && frontRightLeg && backLeftLeg && backRightLeg) {
              frontLeftLeg.rotation.x = Math.sin(petState.legPhase) * 0.4;
              frontRightLeg.rotation.x = Math.sin(petState.legPhase + Math.PI) * 0.4;
              backLeftLeg.rotation.x = Math.sin(petState.legPhase + Math.PI) * 0.3;
              backRightLeg.rotation.x = Math.sin(petState.legPhase) * 0.3;
            }
          } else {
            petState.state = 'idle';
          }
        }
      });
      
      // Bump effect for wall collisions and piece placement
      if (blocksGroupRef.current) {
        const BUMP_DURATION = 150; // ms
        const bumpElapsed = currentTime - bumpStartTimeRef.current;
        
        if (bumpElapsed < BUMP_DURATION && bumpDirectionRef.current) {
          const progress = bumpElapsed / BUMP_DURATION;
          // Exponential decay for smooth falloff
          const intensity = (1 - progress) * Math.exp(-progress * 3);
          
          // Directional offset based on bump type
          let offsetX = 0, offsetY = 0, rotationZ = 0;
          const magnitude = bumpDirectionRef.current === 'down' ? 0.15 : 0.1;
          
          switch (bumpDirectionRef.current) {
            case 'left':
              offsetX = -magnitude * intensity;
              rotationZ = 0.02 * intensity;
              break;
            case 'right':
              offsetX = magnitude * intensity;
              rotationZ = -0.02 * intensity;
              break;
            case 'down':
              offsetY = -magnitude * intensity;
              break;
            case 'rotate':
              rotationZ = 0.04 * Math.sin(bumpElapsed * 0.1) * intensity;
              break;
          }
          
          blocksGroupRef.current.position.x = offsetX;
          blocksGroupRef.current.position.y = offsetY;
          blocksGroupRef.current.rotation.z = rotationZ;
        } else {
          // Reset to neutral position
          blocksGroupRef.current.position.x = 0;
          blocksGroupRef.current.position.y = 0;
          blocksGroupRef.current.rotation.z = 0;
        }
      }
      
      const shakingBlocks = shakingBlocksRef.current;
      const destroyingBlocks = destroyingBlocksRef.current;
      const fallingBlocks = fallingBlocksRef.current;
      
      // Shake animation - unstable wobble before destruction
      for (let i = shakingBlocks.length - 1; i >= 0; i--) {
        const block = shakingBlocks[i];
        const elapsed = currentTime - block.startTime;
        const shakeDuration = 500;
        
        if (elapsed < shakeDuration) {
          // Increasing intensity shake
          const progress = elapsed / shakeDuration;
          const intensity = 0.03 + progress * 0.05; // Grows from 0.03 to 0.08
          const frequency = 30 + progress * 20; // Speeds up over time
          
          const shakeX = Math.sin(elapsed * frequency / 100) * intensity;
          const shakeY = Math.cos(elapsed * frequency / 80) * intensity * 0.5;
          const shakeRot = Math.sin(elapsed * frequency / 120) * 0.05 * progress;
          
          block.mesh.position.x = block.originalPosition.x + shakeX;
          block.mesh.position.y = block.originalPosition.y + shakeY;
          block.mesh.rotation.z = shakeRot;
        }
        // Shaking blocks are removed when destroy animation starts (handled in useEffect)
      }
      
      for (let i = destroyingBlocks.length - 1; i >= 0; i--) {
        const block = destroyingBlocks[i];
        const elapsed = currentTime - block.startTime - block.delay;
        
        if (elapsed < 0) continue;
        
        const duration = 800;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        block.mesh.scale.setScalar(1 - easeOut * 0.8);
        block.mesh.position.y = block.originalPosition.y + easeOut * 0.3;
        block.mesh.rotation.x = easeOut * Math.PI * 0.3;
        block.mesh.rotation.z = easeOut * Math.PI * 0.2;
        
        if (block.mesh.material instanceof THREE.Material) {
          block.mesh.material.opacity = 1 - easeOut;
        }
        
        if (progress >= 1) {
          block.mesh.parent?.remove(block.mesh);
          if (block.mesh.material instanceof THREE.Material) {
            block.mesh.material.dispose();
          }
          destroyingBlocks.splice(i, 1);
        }
      }
      
      for (let i = fallingBlocks.length - 1; i >= 0; i--) {
        const block = fallingBlocks[i];
        const elapsed = currentTime - block.startTime - block.delay;
        
        if (elapsed < 0) continue;
        
        const duration = 300;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutBounce = progress < 0.5 
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        
        const currentY = block.startY + (block.targetY - block.startY) * easeOutBounce;
        block.mesh.position.y = currentY;
        
        if (progress >= 1) {
          block.mesh.position.y = block.targetY;
          fallingBlocks.splice(i, 1);
        }
      }
      
      if (cameraRef.current) {
        renderer.render(scene, cameraRef.current);
      }
    };
    
    animate();

    return () => {
      debugLog('CLEANUP START', { liteMode, spectatorMode, frames: frameCount });
      
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('mouseleave', handleMouseUp);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      renderer.domElement.removeEventListener('contextmenu', handleContextMenu);
      renderer.domElement.removeEventListener('touchstart', handleTouchStart);
      renderer.domElement.removeEventListener('touchmove', handleTouchMove);
      renderer.domElement.removeEventListener('touchend', handleTouchEnd);
      renderer.domElement.removeEventListener('touchcancel', handleTouchEnd);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      
      // Stop animation loop first - prevents new frames from being scheduled
      isAnimatingRef.current = false;
      debugLog('Animation stopped');
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      pressedKeysRef.current.clear();
      
      renderer.dispose();
      container.removeChild(renderer.domElement);
      debugLog('CLEANUP COMPLETE');
    };
  }, [onRotatingChange, updateCameraPosition, petType, viewMode]);
  
  // Control pet visibility based on showPet prop
  useEffect(() => {
    // Show/hide all pets
    petGroupsRef.current.forEach((petGroup, petId) => {
      petGroup.visible = showPet;
      
      // Reset pet position when becoming visible
      if (showPet) {
        const petState = petStatesRef.current.get(petId);
        if (petState) {
          petState.velY = 0;
          petState.state = 'idle';
          petState.stateTimer = 0;
        }
      }
    });
    
    // Legacy single pet support
    if (dogGroupRef.current) {
      dogGroupRef.current.visible = showPet;
      
      // Reset pet position when becoming visible (so it falls with physics)
      if (showPet) {
        dogStateRef.current.posX = 5;
        dogStateRef.current.posY = 2; // Start above ground to fall
        dogStateRef.current.posZ = -3;
        dogStateRef.current.velY = 0;
        dogStateRef.current.state = 'idle';
        dogStateRef.current.stateTimer = 0;
      }
    }
  }, [showPet]);

  // Update pets when selectedPets changes (without rebuilding entire scene)
  // Skip in liteMode since pets are not created
  useEffect(() => {
    if (liteMode) return;  // Skip pet updates in liteMode
    if (!sceneRef.current) return;
    
    const scene = sceneRef.current;
    
    // Remove old pets from scene
    petGroupsRef.current.forEach((petGroup) => {
      scene.remove(petGroup);
      petGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    });
    
    // Clear refs
    petGroupsRef.current.clear();
    petStatesRef.current.clear();
    
    // Create new pets
    activePets.forEach((petId, index) => {
      const petGroup = createPetModel(petId);
      // Randomly spawn on left or right side of the game board
      const isLeftSide = Math.random() > 0.5;
      const sideOffset = index * 1.5;
      const posX = isLeftSide ? (-3 - sideOffset) : (BOARD_WIDTH + 2 + sideOffset);
      const posZ = 2 + Math.random() * 3; // In front of the board
      petGroup.position.set(posX, 2, posZ);
      petGroup.scale.set(1.2, 1.2, 1.2);
      petGroup.visible = showPet;
      scene.add(petGroup);
      petGroupsRef.current.set(petId, petGroup);
      
      petStatesRef.current.set(petId, {
        posX: posX,
        posY: 2,
        posZ: posZ,
        velY: 0,
        targetX: posX,
        targetZ: posZ,
        state: 'idle',
        stateTimer: 0,
        walkSpeed: 0.03,
        tailPhase: Math.random() * Math.PI * 2,
        legPhase: Math.random() * Math.PI * 2,
        headBob: 0,
        earWiggle: 0,
        isLeftSide: isLeftSide,
      });
    });
    
    // Update legacy ref for backward compatibility
    const firstPetGroup = petGroupsRef.current.get(activePets[0]);
    if (firstPetGroup) {
      dogGroupRef.current = firstPetGroup;
    }
  }, [activePets, showPet]);

  // Track previous decoration state to avoid unnecessary recreation
  const prevDecoStateRef = useRef<string>('');

  // Update decorations when equipped decorations or placed decorations change
  // Skip in liteMode since decorations are not added to scene
  useEffect(() => {
    if (liteMode) return;  // Skip decoration updates in liteMode
    if (!decorationsGroupRef.current || !sceneRef.current) return;
    
    // Create a hash of current state to compare (include decoModelsLoaded to re-render after GLB loads)
    const currentState = JSON.stringify({ placed: placedDecorations, equipped: equippedDecorations, modelsLoaded: decoModelsLoaded });
    if (currentState === prevDecoStateRef.current) {
      return; // Skip if nothing changed
    }
    prevDecoStateRef.current = currentState;
    
    const decorationsGroup = decorationsGroupRef.current;
    
    // Clear existing decorations (except ghost preview) - don't dispose cached geometries/materials
    const childrenToRemove = decorationsGroup.children.filter(c => !c.userData.isGhostPreview);
    childrenToRemove.forEach(child => {
      decorationsGroup.remove(child);
    });
    
    // Add decorations from the new free-placement system
    if (placedDecorations && placedDecorations.length > 0) {
      placedDecorations.forEach((placement) => {
        const decoModel = createDecorationModel(placement.itemId);
        decoModel.position.set(placement.x, 0, placement.z);
        decoModel.userData.placementId = placement.id;
        decorationsGroup.add(decoModel);
      });
    } else {
      // Fallback to legacy slot-based system
      Object.entries(equippedDecorations).forEach(([slot, decorationId]) => {
        if (!decorationId) return;
        const position = DECORATION_SLOT_POSITIONS[slot as keyof typeof DECORATION_SLOT_POSITIONS];
        if (!position) return;
        
        const decoModel = createDecorationModel(decorationId);
        decoModel.position.set(
          position.x + BOARD_WIDTH / 2 - 0.5,
          0,
          position.z
        );
        decoModel.userData.slot = slot;
        decorationsGroup.add(decoModel);
      });
    }
  }, [equippedDecorations, placedDecorations, decoModelsLoaded]);

  // Handle ghost preview for decoration placement
  // Skip in liteMode since decorations are not added to scene
  useEffect(() => {
    if (liteMode) return;  // Skip ghost preview in liteMode
    if (!decorationsGroupRef.current || !sceneRef.current || !containerRef.current) return;
    if (!placementPreviewItem || !onPlaceDecoration) return;
    
    const container = containerRef.current;
    const decorationsGroup = decorationsGroupRef.current;
    
    // Create ghost preview model with cloned materials to avoid mutating cached materials
    const ghostModel = createDecorationModel(placementPreviewItem);
    ghostModel.userData.isGhostPreview = true;
    ghostModel.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        // Clone the material so we don't mutate the cached one
        const originalMat = child.material as THREE.MeshStandardMaterial;
        const clonedMat = originalMat.clone();
        clonedMat.transparent = true;
        clonedMat.opacity = 0.6;
        child.material = clonedMat;
      }
    });
    ghostModel.visible = false;
    decorationsGroup.add(ghostModel);
    ghostPreviewRef.current = ghostModel;
    
    // Create invisible ground plane for raycasting
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = 0;
    sceneRef.current.add(groundPlane);
    groundPlaneRef.current = groundPlane;
    
    const handleMouseMove = (event: MouseEvent) => {
      if (!containerRef.current || !cameraRef.current || !ghostPreviewRef.current || !groundPlaneRef.current) return;
      
      const rect = container.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObject(groundPlaneRef.current);
      
      if (intersects.length > 0) {
        const point = intersects[0].point;
        ghostPreviewRef.current.position.set(point.x, 0, point.z);
        ghostPreviewRef.current.visible = true;
      } else {
        ghostPreviewRef.current.visible = false;
      }
    };
    
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current || !cameraRef.current || !groundPlaneRef.current || !ghostPreviewRef.current || !rendererRef.current) return;
      if (!ghostPreviewRef.current.visible) return;
      
      const target = event.target as HTMLElement;
      const canvas = rendererRef.current.domElement;
      if (target !== canvas && !target.closest('canvas')) return;
      
      const rect = container.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObject(groundPlaneRef.current);
      
      if (intersects.length > 0) {
        const point = intersects[0].point;
        onPlaceDecoration(point.x, point.z);
      }
    };
    
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('click', handleClick);
    
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('click', handleClick);
      
      if (ghostPreviewRef.current && decorationsGroup) {
        ghostPreviewRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else if (child.material) {
              child.material.dispose();
            }
          }
        });
        decorationsGroup.remove(ghostPreviewRef.current);
        ghostPreviewRef.current = null;
      }
      if (groundPlaneRef.current && sceneRef.current) {
        groundPlaneRef.current.geometry?.dispose();
        if (groundPlaneRef.current.material instanceof THREE.Material) {
          groundPlaneRef.current.material.dispose();
        }
        sceneRef.current.remove(groundPlaneRef.current);
        groundPlaneRef.current = null;
      }
    };
  }, [placementPreviewItem, onPlaceDecoration]);

  // Update board and floor textures when materials change
  useEffect(() => {
    // Update board texture (vertical panel) with boardMaterial
    if (gridMeshRef.current) {
      const boardCanvas = document.createElement('canvas');
      boardCanvas.width = 512;
      boardCanvas.height = 1024;
      const boardCtx = boardCanvas.getContext('2d');
      
      if (boardCtx) {
        const cellWidth = 512 / BOARD_WIDTH;
        const cellHeight = 1024 / BOARD_HEIGHT;
        
        switch (boardMaterial) {
          case 'glass':
            const glassGrad = boardCtx.createLinearGradient(0, 0, 512, 1024);
            glassGrad.addColorStop(0, 'rgba(100, 150, 200, 0.3)');
            glassGrad.addColorStop(0.5, 'rgba(150, 200, 255, 0.2)');
            glassGrad.addColorStop(1, 'rgba(100, 150, 200, 0.3)');
            boardCtx.fillStyle = glassGrad;
            boardCtx.fillRect(0, 0, 512, 1024);
            boardCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            break;
          case 'metal':
            boardCtx.fillStyle = '#2a2a2a';
            boardCtx.fillRect(0, 0, 512, 1024);
            for (let i = 0; i < 1024; i += 4) {
              const colorVal = 100 + ((i * 7) % 50);
              boardCtx.strokeStyle = `rgba(${colorVal}, ${colorVal}, ${colorVal}, 0.3)`;
              boardCtx.beginPath();
              boardCtx.moveTo(0, i);
              boardCtx.lineTo(512, i);
              boardCtx.stroke();
            }
            boardCtx.strokeStyle = 'rgba(150, 150, 150, 0.6)';
            break;
          case 'neon':
            boardCtx.fillStyle = '#0a0a0a';
            boardCtx.fillRect(0, 0, 512, 1024);
            boardCtx.shadowColor = '#00ffff';
            boardCtx.shadowBlur = 15;
            boardCtx.strokeStyle = '#00ffff';
            break;
          case 'hologram':
            const holoGrad = boardCtx.createLinearGradient(0, 0, 512, 1024);
            holoGrad.addColorStop(0, 'rgba(0, 255, 255, 0.15)');
            holoGrad.addColorStop(0.25, 'rgba(255, 0, 255, 0.15)');
            holoGrad.addColorStop(0.5, 'rgba(0, 255, 0, 0.15)');
            holoGrad.addColorStop(0.75, 'rgba(255, 255, 0, 0.15)');
            holoGrad.addColorStop(1, 'rgba(0, 255, 255, 0.15)');
            boardCtx.fillStyle = holoGrad;
            boardCtx.fillRect(0, 0, 512, 1024);
            boardCtx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
            break;
          case 'matrix':
            boardCtx.fillStyle = '#000a00';
            boardCtx.fillRect(0, 0, 512, 1024);
            boardCtx.font = '14px monospace';
            for (let x = 0; x < 512; x += 20) {
              for (let y = 0; y < 1024; y += 20) {
                const seed = (x * 51 + y * 17) % 96;
                const char = String.fromCharCode(0x30A0 + seed);
                const greenVal = 150 + ((x * 7 + y * 13) % 105);
                const alpha = 0.15 + ((x * 3 + y * 11) % 25) / 100;
                boardCtx.fillStyle = `rgba(0, ${greenVal}, 0, ${alpha})`;
                boardCtx.fillText(char, x, y);
              }
            }
            boardCtx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
            break;
          case 'carbon':
            boardCtx.fillStyle = '#1a1a1a';
            boardCtx.fillRect(0, 0, 512, 1024);
            for (let y = 0; y < 1024; y += 8) {
              for (let x = 0; x < 512; x += 8) {
                const offset = (y / 8) % 2 === 0 ? 0 : 4;
                boardCtx.fillStyle = (x + offset) % 16 < 8 ? '#222222' : '#1a1a1a';
                boardCtx.fillRect(x, y, 8, 8);
              }
            }
            boardCtx.strokeStyle = 'rgba(80, 80, 80, 0.5)';
            break;
          case 'galaxy':
            const galaxyGrad = boardCtx.createRadialGradient(256, 512, 0, 256, 512, 600);
            galaxyGrad.addColorStop(0, 'rgba(50, 0, 100, 0.8)');
            galaxyGrad.addColorStop(0.5, 'rgba(20, 0, 50, 0.9)');
            galaxyGrad.addColorStop(1, 'rgba(0, 0, 10, 1)');
            boardCtx.fillStyle = galaxyGrad;
            boardCtx.fillRect(0, 0, 512, 1024);
            for (let i = 0; i < 100; i++) {
              const x = ((i * 73 + 29) % 512);
              const y = ((i * 137 + 53) % 1024);
              const size = ((i * 17) % 20) / 10 + 0.5;
              boardCtx.beginPath();
              boardCtx.arc(x, y, size, 0, Math.PI * 2);
              boardCtx.fillStyle = `rgba(255, 255, 255, ${0.3 + ((i * 11) % 70) / 100})`;
              boardCtx.fill();
            }
            boardCtx.strokeStyle = 'rgba(100, 50, 150, 0.4)';
            break;
          default:
            boardCtx.fillStyle = backgroundColor;
            boardCtx.fillRect(0, 0, 512, 1024);
            boardCtx.strokeStyle = gridColor;
            break;
        }
        
        boardCtx.lineWidth = 1;
        for (let x = 0; x <= BOARD_WIDTH; x++) {
          boardCtx.beginPath();
          boardCtx.moveTo(x * cellWidth, 0);
          boardCtx.lineTo(x * cellWidth, 1024);
          boardCtx.stroke();
        }
        for (let y = 0; y <= BOARD_HEIGHT; y++) {
          boardCtx.beginPath();
          boardCtx.moveTo(0, y * cellHeight);
          boardCtx.lineTo(512, y * cellHeight);
          boardCtx.stroke();
        }
        boardCtx.shadowBlur = 0;
        boardCtx.lineWidth = 4;
        boardCtx.strokeRect(2, 2, 508, 1020);
        
        const boardTexture = new THREE.CanvasTexture(boardCanvas);
        boardTexture.magFilter = THREE.NearestFilter;
        boardTexture.minFilter = THREE.LinearFilter;
        
        const mesh = gridMeshRef.current;
        if (mesh.material instanceof THREE.MeshBasicMaterial) {
          if (mesh.material.map) mesh.material.map.dispose();
          mesh.material.map = boardTexture;
          mesh.material.needsUpdate = true;
        }
      }
    }
    
    // Update floor texture with gridMaterial
    if (floorMeshRef.current) {
      const floorCanvasSize = liteMode ? 128 : 1024;
      const gridDivisions = 80;
      const floorCanvas = document.createElement('canvas');
      floorCanvas.width = floorCanvasSize;
      floorCanvas.height = floorCanvasSize;
      const floorCtx = floorCanvas.getContext('2d');
      
      if (floorCtx) {
        const cellSize = floorCanvasSize / gridDivisions;
        
        switch (gridMaterial) {
          case 'glass':
            const glassGrad = floorCtx.createLinearGradient(0, 0, floorCanvasSize, floorCanvasSize);
            glassGrad.addColorStop(0, 'rgba(100, 150, 200, 0.3)');
            glassGrad.addColorStop(0.5, 'rgba(150, 200, 255, 0.2)');
            glassGrad.addColorStop(1, 'rgba(100, 150, 200, 0.3)');
            floorCtx.fillStyle = glassGrad;
            floorCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
            floorCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            break;
          case 'metal':
            floorCtx.fillStyle = '#2a2a2a';
            floorCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
            for (let i = 0; i < floorCanvasSize; i += 4) {
              const colorVal = 100 + ((i * 7) % 50);
              floorCtx.strokeStyle = `rgba(${colorVal}, ${colorVal}, ${colorVal}, 0.3)`;
              floorCtx.beginPath();
              floorCtx.moveTo(0, i);
              floorCtx.lineTo(floorCanvasSize, i);
              floorCtx.stroke();
            }
            floorCtx.strokeStyle = 'rgba(150, 150, 150, 0.6)';
            break;
          case 'neon':
            floorCtx.fillStyle = '#0a0a0a';
            floorCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
            floorCtx.shadowColor = '#00ffff';
            floorCtx.shadowBlur = 8;
            floorCtx.strokeStyle = '#00ffff';
            break;
          case 'hologram':
            const holoGrad = floorCtx.createLinearGradient(0, 0, floorCanvasSize, floorCanvasSize);
            holoGrad.addColorStop(0, 'rgba(0, 255, 255, 0.15)');
            holoGrad.addColorStop(0.25, 'rgba(255, 0, 255, 0.15)');
            holoGrad.addColorStop(0.5, 'rgba(0, 255, 0, 0.15)');
            holoGrad.addColorStop(0.75, 'rgba(255, 255, 0, 0.15)');
            holoGrad.addColorStop(1, 'rgba(0, 255, 255, 0.15)');
            floorCtx.fillStyle = holoGrad;
            floorCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
            floorCtx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
            break;
          case 'matrix':
            floorCtx.fillStyle = '#000a00';
            floorCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
            floorCtx.font = '14px monospace';
            for (let x = 0; x < floorCanvasSize; x += 20) {
              for (let y = 0; y < floorCanvasSize; y += 20) {
                const seed = (x * 51 + y * 17) % 96;
                const char = String.fromCharCode(0x30A0 + seed);
                const greenVal = 150 + ((x * 7 + y * 13) % 105);
                const alpha = 0.15 + ((x * 3 + y * 11) % 25) / 100;
                floorCtx.fillStyle = `rgba(0, ${greenVal}, 0, ${alpha})`;
                floorCtx.fillText(char, x, y);
              }
            }
            floorCtx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
            break;
          case 'lava':
            const lavaGrad = floorCtx.createRadialGradient(floorCanvasSize/2, floorCanvasSize/2, 0, floorCanvasSize/2, floorCanvasSize/2, floorCanvasSize * 0.7);
            lavaGrad.addColorStop(0, 'rgba(255, 100, 0, 0.5)');
            lavaGrad.addColorStop(0.5, 'rgba(200, 50, 0, 0.4)');
            lavaGrad.addColorStop(1, 'rgba(100, 20, 0, 0.3)');
            floorCtx.fillStyle = '#1a0500';
            floorCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
            floorCtx.fillStyle = lavaGrad;
            floorCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
            floorCtx.strokeStyle = 'rgba(255, 100, 0, 0.4)';
            break;
          case 'ice':
            const iceGrad = floorCtx.createLinearGradient(0, 0, floorCanvasSize, floorCanvasSize);
            iceGrad.addColorStop(0, 'rgba(200, 230, 255, 0.4)');
            iceGrad.addColorStop(0.5, 'rgba(150, 200, 255, 0.3)');
            iceGrad.addColorStop(1, 'rgba(200, 230, 255, 0.4)');
            floorCtx.fillStyle = iceGrad;
            floorCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
            floorCtx.strokeStyle = 'rgba(150, 200, 255, 0.4)';
            break;
          default:
            floorCtx.fillStyle = '#1a1a1a';
            floorCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
            floorCtx.strokeStyle = '#333333';
            break;
        }
        
        floorCtx.lineWidth = 1;
        for (let i = 0; i <= gridDivisions; i++) {
          const pos = i * cellSize;
          floorCtx.beginPath();
          floorCtx.moveTo(pos, 0);
          floorCtx.lineTo(pos, floorCanvasSize);
          floorCtx.stroke();
          floorCtx.beginPath();
          floorCtx.moveTo(0, pos);
          floorCtx.lineTo(floorCanvasSize, pos);
          floorCtx.stroke();
        }
        
        floorCtx.shadowBlur = 0;
        floorCtx.globalCompositeOperation = 'destination-in';
        const centerX = floorCanvasSize / 2;
        const centerY = floorCanvasSize / 2;
        const innerRadius = floorCanvasSize * 0.15;
        const outerRadius = floorCanvasSize * 0.5;
        const fadeGrad = floorCtx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, outerRadius);
        fadeGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        fadeGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.7)');
        fadeGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.3)');
        fadeGrad.addColorStop(0.9, 'rgba(255, 255, 255, 0.1)');
        fadeGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        floorCtx.fillStyle = fadeGrad;
        floorCtx.fillRect(0, 0, floorCanvasSize, floorCanvasSize);
        floorCtx.globalCompositeOperation = 'source-over';
        
        const floorTexture = new THREE.CanvasTexture(floorCanvas);
        
        const mesh = floorMeshRef.current;
        if (mesh.material instanceof THREE.MeshBasicMaterial) {
          if (mesh.material.map) mesh.material.map.dispose();
          mesh.material.map = floorTexture;
          mesh.material.needsUpdate = true;
        }
      }
    }
  }, [backgroundColor, gridColor, gridMaterial, boardMaterial, equippedDecorations]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const boardCenterX = BOARD_WIDTH / 2;
    const gridCenterX = boardCenterX + DEFAULT_GRID_CONFIG.offsetX + (DEFAULT_GRID_CONFIG.gridSize * DEFAULT_GRID_CONFIG.cellSize) / 2;
    const gridCenterZ = DEFAULT_GRID_CONFIG.offsetZ + (DEFAULT_GRID_CONFIG.gridSize * DEFAULT_GRID_CONFIG.cellSize) / 2;
    
    const disposeModel = (obj: THREE.Object3D) => {
      obj.traverse((child) => {
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
    };
    
    if (customFloorLoaded && customFloorModelRef.current) {
      if (floorMeshRef.current) {
        floorMeshRef.current.visible = false;
      }
      
      const existing = scene.getObjectByName('customFloorModel');
      if (existing) {
        disposeModel(existing);
        scene.remove(existing);
      }
      
      const floorModel = customFloorModelRef.current.clone();
      floorModel.position.set(gridCenterX, -0.5, gridCenterZ);
      floorModel.name = 'customFloorModel';
      scene.add(floorModel);
    } else {
      if (floorMeshRef.current) {
        floorMeshRef.current.visible = true;
      }
      
      const existing = scene.getObjectByName('customFloorModel');
      if (existing) {
        disposeModel(existing);
        scene.remove(existing);
      }
    }
    
    if (showFloorGrid) {
      const existingGrid = scene.getObjectByName('floorGridHelper');
      if (existingGrid) {
        scene.remove(existingGrid);
      }
      
      const gridHelper = createGridHelper(DEFAULT_GRID_CONFIG);
      gridHelper.name = 'floorGridHelper';
      scene.add(gridHelper);
      floorGridHelperRef.current = gridHelper;
    } else {
      const existingGrid = scene.getObjectByName('floorGridHelper');
      if (existingGrid) {
        scene.remove(existingGrid);
      }
      floorGridHelperRef.current = null;
    }
    
    return () => {
      const customFloor = scene.getObjectByName('customFloorModel');
      if (customFloor) {
        disposeModel(customFloor);
        scene.remove(customFloor);
      }
      const gridHelper = scene.getObjectByName('floorGridHelper');
      if (gridHelper) {
        scene.remove(gridHelper);
      }
    };
  }, [customFloorLoaded, customFloorModelPath, showFloorGrid]);

  const boardUpdateCountRef = useRef(0);
  const boardUpdateStartRef = useRef(performance.now());
  
  useEffect(() => {
    if (!blocksGroupRef.current || !sceneRef.current) return;

    boardUpdateCountRef.current++;
    const updateStart = performance.now();
    
    if (boardUpdateCountRef.current % 60 === 0) {
      const elapsed = (updateStart - boardUpdateStartRef.current) / 1000;
      const rate = boardUpdateCountRef.current / elapsed;
      console.log(`[GameRenderer3D] Board update #${boardUpdateCountRef.current}, rate: ${rate.toFixed(1)}/s, liteMode: ${liteModeRef.current}`);
      const serverLog = (window as any).__sendDebugLog;
      if (serverLog) serverLog('GameRenderer3D', 'board_rate', { count: boardUpdateCountRef.current, rate: rate.toFixed(1), liteMode: liteModeRef.current });
    }

    const blocksGroup = blocksGroupRef.current;
    const existingMeshes = blocksGroup.children as THREE.Mesh[];
    
    if (useSandPhysics) {
      for (let i = existingMeshes.length - 1; i >= 0; i--) {
        existingMeshes[i].visible = false;
      }
      return;
    }
    
    let meshIndex = 0;
    
    const currentTime = Date.now();
    const hasClearedLines = gameState.lastClearedLines.length > 0;
    const hasDisplacements = gameState.blockDisplacements && gameState.blockDisplacements.length > 0;
    const isFallingPhase = gameState.animationPhase === 'falling';
    const hasPhysicsFalling = gameState.physicsFallingBlocks && gameState.physicsFallingBlocks.length > 0;
    
    // Clear any pending falling animations when new lines are cleared to prevent conflicts
    if (hasClearedLines) {
      fallingBlocksRef.current = [];
    }
    
    const shakeDuration = 500;
    const maxDestroyDelay = (BOARD_WIDTH / 2) * 50;
    const destroyDuration = 800;
    const fallStartDelay = shakeDuration + maxDestroyDelay + destroyDuration + 100;
    
    // Calculate elapsed time since fall started for interpolation
    const fallElapsed = isFallingPhase && gameState.fallStartTime > 0 
      ? (currentTime - gameState.fallStartTime) / 1000 
      : 0;
    
    // Create a map for physics falling blocks with interpolated positions
    // key = "x,targetY" -> interpolated currentY based on elapsed time
    const physicsMap = new Map<string, number>();
    if (isFallingPhase && hasPhysicsFalling) {
      for (const fb of gameState.physicsFallingBlocks) {
        const key = `${fb.x},${fb.targetY}`;
        // Interpolate position based on elapsed time
        const fallDistance = fb.targetY - fb.currentY;
        const interpolatedY = Math.min(fb.targetY, fb.currentY + FALL_SPEED * fallElapsed);
        physicsMap.set(key, interpolatedY);
      }
    }
    
    // Create a displacement lookup map: key = "x,boardY" -> displacement info
    // Both oldY and newY are in board coordinates (0 = top, 19 = bottom)
    const displacementMap = new Map<string, { oldY: number; newY: number }>();
    if (hasDisplacements && !isFallingPhase) {
      for (const disp of gameState.blockDisplacements) {
        // Key by the NEW board position since that's where blocks are in the updated board
        const key = `${disp.x},${disp.newY}`;
        displacementMap.set(key, { oldY: disp.oldY, newY: disp.newY });
      }
    }

    const isUsingModel = isModelTexture(blockTexture);
    const effectiveGeometry = isUsingModel ? (getModelGeometry(blockTexture) || sharedGeometry) : sharedGeometry;
    const modelMaterial = isUsingModel ? getModelMaterial(blockTexture) : null;
    
    for (let boardY = 0; boardY < BOARD_HEIGHT; boardY++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const color = gameState.board[boardY][x];
        if (color) {
          const material = modelMaterial || createBlockMaterial(color);
          let mesh: THREE.Mesh;
          
          const activeGeometry = effectiveGeometry;
          
          if (meshIndex < existingMeshes.length) {
            mesh = existingMeshes[meshIndex];
            if (mesh.geometry !== activeGeometry) {
              blocksGroup.remove(mesh);
              mesh.geometry.dispose();
              mesh = new THREE.Mesh(activeGeometry, material);
              // Disable shadows in liteMode for performance
              mesh.castShadow = !liteModeRef.current;
              mesh.receiveShadow = !liteModeRef.current;
              blocksGroup.add(mesh);
            } else {
              mesh.material = material;
            }
            mesh.visible = true;
          } else {
            mesh = new THREE.Mesh(activeGeometry, material);
            mesh.castShadow = !liteModeRef.current;
            mesh.receiveShadow = !liteModeRef.current;
            blocksGroup.add(mesh);
          }
          
          // Convert board coordinate (0=top) to visual coordinate (0=bottom in 3D)
          const targetVisualY = BOARD_HEIGHT - 1 - boardY;
          
          // Check if this block is a physics falling block
          const physicsKey = `${x},${boardY}`;
          const physicsCurrentY = physicsMap.get(physicsKey);
          
          if (physicsCurrentY !== undefined) {
            // Physics-based falling: use currentY from gameState
            const visualCurrentY = BOARD_HEIGHT - 1 - physicsCurrentY;
            mesh.position.set(x, visualCurrentY, 0);
          } else if (!isFallingPhase) {
            // Look up displacement using board coordinates (for shake/explode phases)
            const key = `${x},${boardY}`;
            const displacement = displacementMap.get(key);
            
            if (displacement && hasClearedLines) {
              // Convert old board position to visual coordinate
              const startVisualY = BOARD_HEIGHT - 1 - displacement.oldY;
              
              // Only animate if there's actual movement
              if (startVisualY !== targetVisualY) {
                mesh.position.set(x, startVisualY, 0);
                
                fallingBlocksRef.current.push({
                  mesh,
                  startY: startVisualY,
                  targetY: targetVisualY,
                  startTime: currentTime,
                  delay: fallStartDelay,
                });
              } else {
                mesh.position.set(x, targetVisualY, 0);
              }
            } else {
              // No displacement - place at final position immediately
              mesh.position.set(x, targetVisualY, 0);
            }
          } else {
            // Falling phase but not a physics block - at target position
            mesh.position.set(x, targetVisualY, 0);
          }
          
          meshIndex++;
        }
      }
    }

    for (let i = meshIndex; i < existingMeshes.length; i++) {
      existingMeshes[i].visible = false;
    }
    
    previousBoardRef.current = gameState.board.map(row => [...row]);
    
    const updateDuration = performance.now() - updateStart;
    if (updateDuration > 5 || boardUpdateCountRef.current <= 3) {
      console.log(`[GameRenderer3D] Board update #${boardUpdateCountRef.current} took ${updateDuration.toFixed(1)}ms, meshes: ${meshIndex}, liteMode: ${liteModeRef.current}`);
      const serverLog = (window as any).__sendDebugLog;
      if (serverLog) serverLog('GameRenderer3D', 'slow_update', { count: boardUpdateCountRef.current, duration_ms: updateDuration.toFixed(1), meshes: meshIndex, liteMode: liteModeRef.current });
    }
  }, [gameState.board, gameState.lastClearedLines, gameState.blockDisplacements, gameState.animationPhase, gameState.physicsFallingBlocks, gameState.fallStartTime, createBlockMaterial, blockTexture, animationTick, useSandPhysics, modelLoaded]);

  // Animation tick for smooth falling block interpolation
  // Skip in spectatorMode or liteMode to prevent excessive re-renders
  useEffect(() => {
    if (gameState.animationPhase !== 'falling') return;
    if (spectatorMode || liteMode) return; // Skip animation ticks for performance
    
    let animationFrameId: number;
    const animate = () => {
      setAnimationTick(t => t + 1);
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState.animationPhase, spectatorMode, liteMode]);

  // Shared geometry for sand particles - using low-poly sphere for performance
  const sharedSphereGeometryRef = useRef<THREE.SphereGeometry | null>(null);
  const sandMaterialCacheRef = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());
  const sandInstancedMeshRef = useRef<Map<string, THREE.InstancedMesh>>(new Map());
  
  // Render physics-based sand particles using InstancedMesh for high performance
  // Skip if sandPoints is provided (new fast system takes priority)
  useEffect(() => {
    if (!physicsBlocksGroupRef.current || !useSandPhysics || sandPoints) return;
    
    const group = physicsBlocksGroupRef.current;
    const instancedMeshes = sandInstancedMeshRef.current;
    const meshMap = physicsBlockMeshesRef.current;
    
    if (!sharedSphereGeometryRef.current) {
      sharedSphereGeometryRef.current = new THREE.SphereGeometry(0.035, 6, 4);
    }
    
    if (!sandPhysicsBlocks || sandPhysicsBlocks.length === 0) {
      instancedMeshes.forEach((mesh) => {
        group.remove(mesh);
        mesh.dispose();
      });
      instancedMeshes.clear();
      
      const meshArray = Array.from(meshMap.values());
      for (const mesh of meshArray) {
        group.remove(mesh);
      }
      meshMap.clear();
      return;
    }
    
    const particlesByColor: Map<string, typeof sandPhysicsBlocks> = new Map();
    for (const particle of sandPhysicsBlocks) {
      if (!particlesByColor.has(particle.color)) {
        particlesByColor.set(particle.color, []);
      }
      particlesByColor.get(particle.color)!.push(particle);
    }
    
    const currentColors = new Set(particlesByColor.keys());
    const colorsToRemove: string[] = [];
    instancedMeshes.forEach((mesh, color) => {
      if (!currentColors.has(color)) {
        colorsToRemove.push(color);
        group.remove(mesh);
        mesh.dispose();
      }
    });
    for (const color of colorsToRemove) {
      instancedMeshes.delete(color);
    }
    
    const getMaterial = (color: string): THREE.MeshStandardMaterial => {
      let mat = sandMaterialCacheRef.current.get(color);
      if (!mat) {
        mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          roughness: 0.8,
          metalness: 0.05,
        });
        sandMaterialCacheRef.current.set(color, mat);
      }
      return mat;
    };
    
    const tempMatrix = new THREE.Matrix4();
    const tempPosition = new THREE.Vector3();
    const tempScale = new THREE.Vector3();
    const tempQuaternion = new THREE.Quaternion();
    
    const colorEntries = Array.from(particlesByColor.entries());
    for (const [color, particles] of colorEntries) {
      let instancedMesh = instancedMeshes.get(color);
      
      if (!instancedMesh || instancedMesh.count < particles.length) {
        if (instancedMesh) {
          group.remove(instancedMesh);
          instancedMesh.dispose();
        }
        
        const material = getMaterial(color);
        instancedMesh = new THREE.InstancedMesh(
          sharedSphereGeometryRef.current!,
          material,
          Math.max(particles.length * 1.5, 500)
        );
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;
        instancedMesh.frustumCulled = false;
        group.add(instancedMesh);
        instancedMeshes.set(color, instancedMesh);
      }
      
      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        const scale = (particle.size || 0.035) / 0.035;
        
        tempPosition.set(particle.x, particle.y, particle.z);
        tempScale.setScalar(scale);
        tempQuaternion.identity();
        
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        instancedMesh.setMatrixAt(i, tempMatrix);
      }
      
      instancedMesh.count = particles.length;
      instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }, [sandPhysicsBlocks, useSandPhysics, sandPoints]);

  // Fast sand points rendering - directly add Points object to scene
  const currentSandPointsRef = useRef<THREE.Points | null>(null);
  useEffect(() => {
    if (!physicsBlocksGroupRef.current) return;
    
    const group = physicsBlocksGroupRef.current;
    
    if (currentSandPointsRef.current && currentSandPointsRef.current !== sandPoints) {
      group.remove(currentSandPointsRef.current);
      currentSandPointsRef.current = null;
    }
    
    if (sandPoints && useSandPhysics && !sandPoints.parent) {
      group.add(sandPoints);
      currentSandPointsRef.current = sandPoints;
    }
    
    return () => {
      if (currentSandPointsRef.current) {
        group.remove(currentSandPointsRef.current);
        currentSandPointsRef.current = null;
      }
    };
  }, [sandPoints, useSandPhysics]);

  const pieceUpdateCountRef = useRef(0);
  
  useEffect(() => {
    if (!currentPieceGroupRef.current) return;

    pieceUpdateCountRef.current++;
    if (pieceUpdateCountRef.current % 100 === 0) {
      console.log(`[GameRenderer3D] Piece update #${pieceUpdateCountRef.current}, liteMode: ${liteModeRef.current}`);
    }

    const group = currentPieceGroupRef.current;
    const existingMeshes = group.children as THREE.Mesh[];
    let meshIndex = 0;

    if (gameState.currentPiece) {
      const { shape, position, color } = gameState.currentPiece;
      const isUsingModel = isModelTexture(blockTexture);
      const effectiveGeometry = isUsingModel ? (getModelGeometry(blockTexture) || sharedGeometry) : sharedGeometry;
      const modelMaterial = isUsingModel ? getModelMaterial(blockTexture) : null;
      const material = modelMaterial || createBlockMaterial(color);

      for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
          if (shape[y][x]) {
            let mesh: THREE.Mesh;
            const activeGeometry = effectiveGeometry;
            
            if (meshIndex < existingMeshes.length) {
              mesh = existingMeshes[meshIndex];
              if (mesh.geometry !== activeGeometry) {
                mesh.geometry = activeGeometry;
              }
              mesh.material = material;
              mesh.visible = true;
            } else {
              mesh = new THREE.Mesh(activeGeometry, material);
              mesh.castShadow = true;
              group.add(mesh);
            }
            
            mesh.position.set(
              position.x + x,
              BOARD_HEIGHT - 1 - (position.y + y),
              0
            );
            meshIndex++;
          }
        }
      }
    }

    for (let i = meshIndex; i < existingMeshes.length; i++) {
      existingMeshes[i].visible = false;
    }
  }, [gameState.currentPiece, createBlockMaterial, blockTexture, modelLoaded]);

  useEffect(() => {
    if (!ghostPieceGroupRef.current) return;

    const group = ghostPieceGroupRef.current;
    const existingMeshes = group.children as THREE.Mesh[];
    let meshIndex = 0;

    if (gameState.currentPiece && gameState.showGhost !== false) {
      const ghost = getGhostPosition(gameState.board, gameState.currentPiece);
      
      if (ghost.position.y !== gameState.currentPiece.position.y) {
        const { shape, position, color } = ghost;
        const baseColor = new THREE.Color(color);
        // Ghost material: transparent, no depth test to always show through
        const material = new THREE.MeshBasicMaterial({
          color: baseColor,
          transparent: true,
          opacity: 0.4,
          depthTest: false,
          depthWrite: false,
        });

        const effectiveGeometry = isModelTexture(blockTexture) ? (getModelGeometry(blockTexture) || sharedGeometry) : sharedGeometry;
        for (let y = 0; y < shape.length; y++) {
          for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x]) {
              let mesh: THREE.Mesh;
              const activeGeometry = effectiveGeometry;
              
              if (meshIndex < existingMeshes.length) {
                mesh = existingMeshes[meshIndex];
                if (mesh.geometry !== activeGeometry) {
                  mesh.geometry = activeGeometry;
                }
                mesh.material = material;
                mesh.visible = true;
              } else {
                mesh = new THREE.Mesh(activeGeometry, material);
                group.add(mesh);
              }
              
              mesh.position.set(
                position.x + x,
                BOARD_HEIGHT - 1 - (position.y + y),
                0
              );
              meshIndex++;
            }
          }
        }
      }
    }

    for (let i = meshIndex; i < existingMeshes.length; i++) {
      existingMeshes[i].visible = false;
    }
  }, [gameState.currentPiece, gameState.board, gameState.showGhost, blockTexture, modelLoaded]);

  useEffect(() => {
    // Classic engine: no line clear animation
    if (engine === 'classic') return;
    
    if (!sceneRef.current || gameState.lastClearedLines.length === 0) return;

    // Clear any previous animations to prevent conflicts
    shakingBlocksRef.current = [];
    destroyingBlocksRef.current = [];
    
    const destroyGroup = new THREE.Group();
    sceneRef.current.add(destroyGroup);

    const currentTime = Date.now();
    const shakeDuration = 500;
    
    // Use landing position as explosion center, fallback to board center
    const explosionCenterX = gameState.landingX ?? BOARD_WIDTH / 2;

    // First create shaking blocks
    const meshesToDestroy: { mesh: THREE.Mesh; cell: { x: number; y: number; color: string } }[] = [];
    
    const isUsingModel = isModelTexture(blockTexture);
    const effectiveGeometry = isUsingModel ? (getModelGeometry(blockTexture) || sharedGeometry) : sharedGeometry;
    const modelMaterial = isUsingModel ? getModelMaterial(blockTexture) : null;
    
    for (const line of gameState.lastClearedLines) {
      for (const cell of line.cells) {
        let material: THREE.Material | THREE.Material[];
        if (modelMaterial) {
          if (Array.isArray(modelMaterial)) {
            material = modelMaterial.map(m => {
              const cloned = m.clone();
              cloned.transparent = true;
              return cloned;
            });
          } else {
            material = modelMaterial.clone();
            material.transparent = true;
          }
        } else {
          const baseMaterial = createBlockMaterial(cell.color);
          material = baseMaterial.clone() as THREE.Material;
          material.transparent = true;
        }
        
        const activeGeometry = effectiveGeometry;
        const mesh = new THREE.Mesh(activeGeometry, material);
        const yPos = BOARD_HEIGHT - 1 - cell.y;
        mesh.position.set(cell.x, yPos, 0);
        destroyGroup.add(mesh);

        // Add to shaking animation
        shakingBlocksRef.current.push({
          mesh,
          originalPosition: new THREE.Vector3(cell.x, yPos, 0),
          startTime: currentTime,
        });
        
        meshesToDestroy.push({ mesh, cell });
      }
    }

    // After shake duration, transition to destroying animation
    const transitionTimer = setTimeout(() => {
      // Clear shaking blocks
      shakingBlocksRef.current = [];
      
      const destroyStartTime = Date.now();
      
      for (const { mesh, cell } of meshesToDestroy) {
        // Calculate delay based on distance from explosion center (landing point)
        const distanceFromLanding = Math.abs(cell.x - explosionCenterX);
        const delay = distanceFromLanding * 50; // 50ms per cell distance
        
        const yPos = BOARD_HEIGHT - 1 - cell.y;
        
        // Reset position in case shake moved it
        mesh.position.set(cell.x, yPos, 0);
        mesh.rotation.set(0, 0, 0);

        destroyingBlocksRef.current.push({
          mesh,
          targetY: yPos + 1,
          delay,
          startTime: destroyStartTime,
          originalPosition: new THREE.Vector3(cell.x, yPos, 0),
        });
      }
    }, shakeDuration);

    return () => {
      clearTimeout(transitionTimer);
    };
  }, [gameState.lastClearedLines, gameState.landingX, createBlockMaterial, blockTexture, engine]);

  // Detect bump events and trigger animation
  // IMPORTANT: This hook must be BEFORE any early returns to satisfy React hooks rules
  useEffect(() => {
    if (gameState.bumpTimestamp && gameState.bumpTimestamp !== lastBumpTimestampRef.current) {
      lastBumpTimestampRef.current = gameState.bumpTimestamp;
      bumpStartTimeRef.current = Date.now();
      bumpDirectionRef.current = gameState.bumpDirection;
    }
  }, [gameState.bumpTimestamp, gameState.bumpDirection]);

  if (!webGLAvailable) {
    return (
      <div 
        className="w-full h-full flex items-center justify-center bg-background"
        data-testid="game-canvas-3d"
      >
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-foreground mb-4">WebGL Not Available</h2>
          <p className="text-muted-foreground">
            Your browser or device doesn't support WebGL, which is required for the 3D game.
            Please try a different browser or enable hardware acceleration.
          </p>
        </div>
      </div>
    );
  }

  // Camera control handlers for UI buttons
  const handleCameraMove = (direction: 'up' | 'down' | 'left' | 'right') => {
    const speed = CAMERA_OFFSET_SPEED * 3;
    switch (direction) {
      case 'up':
        cameraOffsetRef.current.y += speed;
        break;
      case 'down':
        cameraOffsetRef.current.y -= speed;
        break;
      case 'left':
        cameraOffsetRef.current.x -= speed;
        break;
      case 'right':
        cameraOffsetRef.current.x += speed;
        break;
    }
    updateCameraPosition();
  };

  const handleCameraTilt = (direction: 'left' | 'right') => {
    const speed = CAMERA_TILT_SPEED * 3;
    if (direction === 'left') {
      cameraTiltRef.current = Math.max(-Math.PI / 4, cameraTiltRef.current - speed);
    } else {
      cameraTiltRef.current = Math.min(Math.PI / 4, cameraTiltRef.current + speed);
    }
    updateCameraPosition();
  };

  const handleCameraReset = () => {
    cameraOffsetRef.current = { x: 0, y: 0 };
    cameraTiltRef.current = 0;
    cameraAngleRef.current = { theta: Math.PI / 2, phi: Math.PI / 2.5 };
    cameraDistanceRef.current = 32;
    targetZoomRef.current = 32;
    updateCameraPosition();
  };

  return (
    <div className="relative w-full h-full">
      <div 
        ref={containerRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        data-testid="game-canvas-3d"
      />
      
      {/* Camera Controls - Premium Minimalist UI */}
      <div className="absolute bottom-24 md:bottom-4 right-4 z-50 select-none" data-testid="camera-controls">
        <div className="backdrop-blur-xl bg-black/30 border border-white/10 rounded-2xl p-3 shadow-2xl">
          {/* Position Controls */}
          <div className="flex flex-col items-center gap-1 mb-2">
            <button
              onClick={() => handleCameraMove('up')}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/15 active:bg-white/25 transition-all duration-150 text-white/70 hover:text-white"
              data-testid="camera-up"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7"/>
              </svg>
            </button>
            <div className="flex gap-1">
              <button
                onClick={() => handleCameraMove('left')}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/15 active:bg-white/25 transition-all duration-150 text-white/70 hover:text-white"
                data-testid="camera-left"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <button
                onClick={handleCameraReset}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-all duration-150 text-white/50 hover:text-white text-xs font-medium"
                data-testid="camera-reset"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
                </svg>
              </button>
              <button
                onClick={() => handleCameraMove('right')}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/15 active:bg-white/25 transition-all duration-150 text-white/70 hover:text-white"
                data-testid="camera-right"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
            <button
              onClick={() => handleCameraMove('down')}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/15 active:bg-white/25 transition-all duration-150 text-white/70 hover:text-white"
              data-testid="camera-down"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
            </button>
          </div>
          
          {/* Divider */}
          <div className="w-full h-px bg-white/10 my-2"/>
          
          {/* Tilt Controls */}
          <div className="flex justify-center gap-1">
            <button
              onClick={() => handleCameraTilt('left')}
              className="w-10 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/15 active:bg-white/25 transition-all duration-150 text-white/70 hover:text-white"
              data-testid="camera-tilt-left"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h4l3 9 4-18 3 9h4"/>
              </svg>
            </button>
            <button
              onClick={() => handleCameraTilt('right')}
              className="w-10 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/15 active:bg-white/25 transition-all duration-150 text-white/70 hover:text-white"
              data-testid="camera-tilt-right"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'scaleX(-1)' }}>
                <path d="M3 12h4l3 9 4-18 3 9h4"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
