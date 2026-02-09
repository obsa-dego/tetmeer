import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DECORATION_MODELS, BLOCK_MODELS } from '@/lib/model-loader';
import { Loader2 } from 'lucide-react';

interface Model3DPreviewProps {
  itemId: string;
  size?: number;
  autoRotate?: boolean;
  interactive?: boolean;
}

export function Model3DPreview({ 
  itemId, 
  size = 150, 
  autoRotate = true,
  interactive = true 
}: Model3DPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const config = DECORATION_MODELS[itemId] || BLOCK_MODELS[itemId];
    if (!config || !containerRef.current) {
      setError(true);
      setLoading(false);
      return;
    }

    const container = containerRef.current;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(2, 1.5, 2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = interactive;
    controls.enablePan = false;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 2;
    controlsRef.current = controls;

    const loader = new GLTFLoader();
    loader.load(
      config.modelPath,
      (gltf) => {
        const model = gltf.scene;
        const scale = config.scale ?? 1;
        model.scale.set(scale, scale, scale);

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const modelSize = box.getSize(new THREE.Vector3());
        
        model.position.sub(center);
        
        const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
        const cameraDistance = maxDim * 2.5;
        camera.position.set(cameraDistance, cameraDistance * 0.6, cameraDistance);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();

        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        scene.add(model);
        setLoading(false);
      },
      undefined,
      (err) => {
        console.error('Failed to load model:', err);
        setError(true);
        setLoading(false);
      }
    );

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(m => m.dispose());
          } else {
            object.material?.dispose();
          }
        }
      });
    };
  }, [itemId, size, autoRotate, interactive]);

  if (error) {
    return null;
  }

  return (
    <div 
      ref={containerRef} 
      className="relative rounded-lg overflow-hidden"
      style={{ width: size, height: size }}
      data-testid={`model-preview-${itemId}`}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}

export function hasGLBModel(itemId: string): boolean {
  return itemId in DECORATION_MODELS || itemId in BLOCK_MODELS;
}

export function getModelConfig(itemId: string) {
  return DECORATION_MODELS[itemId] || BLOCK_MODELS[itemId] || null;
}
