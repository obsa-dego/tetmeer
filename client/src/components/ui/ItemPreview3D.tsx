import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';

interface ItemPreview3DProps {
  itemType: 'pet' | 'decoration';
  itemId: string;
  size?: number;
  className?: string;
}

export function ItemPreview3D({ itemType, itemId, size = 48, className = '' }: ItemPreview3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    model: THREE.Group;
  } | null>(null);
  const frameRef = useRef<number>(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(2, 1.5, 2);
    camera.lookAt(0, 0.3, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(2, 3, 2);
    scene.add(directionalLight);

    let model: THREE.Group;
    if (itemType === 'pet') {
      model = createSimplePetModel(itemId);
    } else {
      model = createSimpleDecorationModel(itemId);
    }
    scene.add(model);

    sceneRef.current = { scene, camera, renderer, model };
    
    renderer.render(scene, camera);

    return () => {
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  }, [itemType, itemId, size]);

  useEffect(() => {
    if (!sceneRef.current) return;
    
    const { scene, camera, renderer, model } = sceneRef.current;
    
    if (isHovered) {
      const animate = () => {
        model.rotation.y += 0.03;
        renderer.render(scene, camera);
        frameRef.current = requestAnimationFrame(animate);
      };
      animate();
    } else {
      cancelAnimationFrame(frameRef.current);
      renderer.render(scene, camera);
    }

    return () => {
      cancelAnimationFrame(frameRef.current);
    };
  }, [isHovered]);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  return (
    <div
      ref={containerRef}
      className={`rounded-md overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    />
  );
}

function createSimplePetModel(petType: string): THREE.Group {
  const group = new THREE.Group();
  
  const colors: Record<string, number> = {
    'pet_puppy': 0xD2691E,
    'pet_cat': 0x808080,
    'pet_lion': 0xDAA520,
    'pet_gecko': 0x32CD32,
    'pet_dragon': 0x8B0000,
    'pet_turtle': 0x228B22,
    'pet_crab': 0xFF6347,
  };
  
  const color = colors[petType] || 0x888888;
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), material);
  body.position.y = 0.3;
  group.add(body);
  
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), material);
  head.position.set(0.25, 0.45, 0);
  group.add(head);
  
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), eyeMaterial);
  leftEye.position.set(0.38, 0.5, 0.08);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), eyeMaterial);
  rightEye.position.set(0.38, 0.5, -0.08);
  group.add(rightEye);
  
  return group;
}

function createSimpleDecorationModel(decorationId: string): THREE.Group {
  const group = new THREE.Group();
  
  const colors: Record<string, number> = {
    'stone_small': 0x808080,
    'stone_large': 0x696969,
    'pond_small': 0x4169E1,
    'pond_medium': 0x1E90FF,
    'oak_tree': 0x228B22,
    'pine_tree': 0x006400,
    'cherry_tree': 0xFF69B4,
    'flower_patch': 0xFF1493,
    'mushroom_cluster': 0xDC143C,
    'crystal_small': 0x00FFFF,
    'crystal_large': 0xFF00FF,
    'magic_crystal': 0x9400D3,
    'fairy_ring': 0xFFD700,
    'glowing_orb': 0x00FF00,
    'gold_trophy': 0xFFD700,
    'silver_trophy': 0xC0C0C0,
    'game_console': 0x333333,
    'lantern': 0xFFA500,
    'campfire': 0xFF4500,
  };
  
  const color = colors[decorationId] || 0x888888;
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  
  if (decorationId.includes('tree')) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0x8B4513 }));
    trunk.position.y = 0.2;
    group.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 8), material);
    leaves.position.y = 0.6;
    group.add(leaves);
  } else if (decorationId.includes('crystal')) {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), material);
    crystal.position.y = 0.35;
    group.add(crystal);
  } else if (decorationId.includes('trophy')) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.1, 16), material);
    base.position.y = 0.05;
    group.add(base);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.08, 0.3, 16), material);
    cup.position.y = 0.25;
    group.add(cup);
  } else if (decorationId.includes('stone') || decorationId.includes('pond')) {
    const stone = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), material);
    stone.scale.set(1.2, 0.6, 1);
    stone.position.y = 0.12;
    group.add(stone);
  } else {
    const obj = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), material);
    obj.position.y = 0.2;
    group.add(obj);
  }
  
  return group;
}
