import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BLOCK_MODELS } from '@/lib/model-loader';
import { Loader2, Palette, Sparkles, Droplets, Sun } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// Block shapes in Tetris
export const BLOCK_SHAPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;
export type BlockShape = typeof BLOCK_SHAPES[number];

// Default colors for each block shape (classic Tetris colors)
export const DEFAULT_BLOCK_COLORS: Record<BlockShape, string> = {
  I: '#00f0f0', // Cyan
  O: '#f0f000', // Yellow
  T: '#a000f0', // Purple
  S: '#00f000', // Green
  Z: '#f00000', // Red
  J: '#0000f0', // Blue
  L: '#f0a000', // Orange
};

export interface MaterialSettings {
  // Per-shape colors
  blockColors: Record<BlockShape, string>;
  // Shared material properties
  metalness: number;
  roughness: number;
  opacity: number;
  emissive: string;
  emissiveIntensity: number;
}

const DEFAULT_SETTINGS: MaterialSettings = {
  blockColors: { ...DEFAULT_BLOCK_COLORS },
  metalness: 0.5,
  roughness: 0.5,
  opacity: 1.0,
  emissive: '#000000',
  emissiveIntensity: 0,
};

const PREMIUM_PALETTE = [
  { name: 'Pure White', color: '#ffffff' },
  { name: 'Obsidian', color: '#1a1a2e' },
  { name: 'Royal Gold', color: '#d4af37' },
  { name: 'Rose Gold', color: '#b76e79' },
  { name: 'Sapphire', color: '#0f52ba' },
  { name: 'Emerald', color: '#50c878' },
  { name: 'Ruby', color: '#e0115f' },
  { name: 'Amethyst', color: '#9966cc' },
  { name: 'Champagne', color: '#f7e7ce' },
  { name: 'Titanium', color: '#878681' },
  { name: 'Copper', color: '#b87333' },
  { name: 'Pearl', color: '#eae0c8' },
  { name: 'Midnight', color: '#191970' },
  { name: 'Coral', color: '#ff7f50' },
  { name: 'Teal', color: '#008080' },
  { name: 'Lavender', color: '#e6e6fa' },
];

const MATERIAL_PRESETS = [
  { name: 'Matte', metalness: 0, roughness: 0.9, emissiveIntensity: 0 },
  { name: 'Satin', metalness: 0.1, roughness: 0.6, emissiveIntensity: 0 },
  { name: 'Glossy', metalness: 0.3, roughness: 0.2, emissiveIntensity: 0 },
  { name: 'Metallic', metalness: 0.9, roughness: 0.3, emissiveIntensity: 0 },
  { name: 'Chrome', metalness: 1.0, roughness: 0.1, emissiveIntensity: 0 },
  { name: 'Glow', metalness: 0.2, roughness: 0.5, emissiveIntensity: 0.8 },
];

interface Model3DCustomizerProps {
  itemId: string;
  initialSettings?: MaterialSettings;
  onSettingsChange: (settings: MaterialSettings) => void;
  size?: number;
}

export function Model3DCustomizer({
  itemId,
  initialSettings,
  onSettingsChange,
  size = 200,
}: Model3DCustomizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationRef = useRef<number>(0);
  const modelRef = useRef<THREE.Group | null>(null);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  const [settings, setSettings] = useState<MaterialSettings>(
    initialSettings || DEFAULT_SETTINGS
  );
  const [selectedShape, setSelectedShape] = useState<BlockShape>('T');

  useEffect(() => {
    // Create a new object to avoid mutating initialSettings
    const normalizedSettings: MaterialSettings = {
      blockColors: initialSettings?.blockColors 
        ? { ...DEFAULT_BLOCK_COLORS, ...initialSettings.blockColors }
        : { ...DEFAULT_BLOCK_COLORS },
      metalness: initialSettings?.metalness ?? DEFAULT_SETTINGS.metalness,
      roughness: initialSettings?.roughness ?? DEFAULT_SETTINGS.roughness,
      opacity: initialSettings?.opacity ?? DEFAULT_SETTINGS.opacity,
      emissive: initialSettings?.emissive || DEFAULT_SETTINGS.emissive,
      emissiveIntensity: initialSettings?.emissiveIntensity ?? DEFAULT_SETTINGS.emissiveIntensity,
    };
    setSettings(normalizedSettings);
    onSettingsChange(normalizedSettings);
  }, [initialSettings, onSettingsChange]);

  const updateMaterials = useCallback((newSettings: MaterialSettings, shape: BlockShape) => {
    const color = newSettings.blockColors?.[shape] || DEFAULT_BLOCK_COLORS[shape];
    materialsRef.current.forEach((material) => {
      material.color.set(color);
      material.metalness = newSettings.metalness;
      material.roughness = newSettings.roughness;
      material.opacity = newSettings.opacity;
      material.transparent = newSettings.opacity < 1;
      material.emissive.set(newSettings.emissive);
      material.emissiveIntensity = newSettings.emissiveIntensity;
      material.needsUpdate = true;
    });
  }, []);

  const handleSettingsChange = useCallback(
    (partial: Partial<MaterialSettings>) => {
      const newSettings = { ...settings, ...partial };
      setSettings(newSettings);
      updateMaterials(newSettings, selectedShape);
      onSettingsChange(newSettings);
    },
    [settings, selectedShape, updateMaterials, onSettingsChange]
  );

  const handleShapeColorChange = useCallback(
    (shape: BlockShape, color: string) => {
      const newBlockColors = { ...settings.blockColors, [shape]: color };
      const newSettings = { ...settings, blockColors: newBlockColors };
      setSettings(newSettings);
      if (shape === selectedShape) {
        updateMaterials(newSettings, selectedShape);
      }
      onSettingsChange(newSettings);
    },
    [settings, selectedShape, updateMaterials, onSettingsChange]
  );

  const handleShapeSelect = useCallback(
    (shape: BlockShape) => {
      setSelectedShape(shape);
      updateMaterials(settings, shape);
    },
    [settings, updateMaterials]
  );

  const applyPreset = useCallback(
    (preset: typeof MATERIAL_PRESETS[0]) => {
      handleSettingsChange({
        metalness: preset.metalness,
        roughness: preset.roughness,
        emissiveIntensity: preset.emissiveIntensity,
      });
    },
    [handleSettingsChange]
  );

  useEffect(() => {
    const config = BLOCK_MODELS[itemId];
    if (!config || !containerRef.current) {
      setError(true);
      setLoading(false);
      return;
    }

    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(2, 1.5, 2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(5, 10, 7);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x8080ff, 0.2);
    rimLight.position.set(0, 0, -10);
    scene.add(rimLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;
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

        materialsRef.current = [];
        const initialColor = settings.blockColors?.[selectedShape] || DEFAULT_BLOCK_COLORS[selectedShape];
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            const newMaterial = new THREE.MeshStandardMaterial({
              color: initialColor,
              metalness: settings.metalness,
              roughness: settings.roughness,
              opacity: settings.opacity,
              transparent: settings.opacity < 1,
              emissive: settings.emissive,
              emissiveIntensity: settings.emissiveIntensity,
            });
            child.material = newMaterial;
            materialsRef.current.push(newMaterial);
          }
        });

        modelRef.current = model;
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
      materialsRef.current.forEach((m) => m.dispose());
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
        }
      });
    };
  }, [itemId, size]);

  if (error) {
    return (
      <div className="text-center text-muted-foreground p-4">
        Failed to load model
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div
          ref={containerRef}
          className="relative rounded-xl overflow-hidden border border-zinc-800 bg-gradient-to-b from-zinc-900 to-black"
          style={{ width: size, height: size }}
          data-testid={`model-customizer-${itemId}`}
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}
        </div>
      </div>

      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-4 space-y-5">
          {/* Block Shape Color Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" />
              <Label className="text-sm font-medium">Block Shape Colors</Label>
            </div>
            <div className="flex flex-wrap gap-2">
              {BLOCK_SHAPES.map((shape) => (
                <button
                  key={shape}
                  onClick={() => handleShapeSelect(shape)}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                    selectedShape === shape
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-500'
                  }`}
                  data-testid={`shape-${shape}`}
                >
                  <div
                    className="w-5 h-5 rounded border border-zinc-600"
                    style={{ backgroundColor: settings.blockColors?.[shape] || DEFAULT_BLOCK_COLORS[shape] }}
                  />
                  <span className="text-sm font-mono font-bold">{shape}</span>
                </button>
              ))}
            </div>
            
            {/* Color picker for selected shape */}
            <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">
                  Color for <span className="font-mono text-primary">{selectedShape}</span> Block
                </Label>
                <input
                  type="color"
                  value={settings.blockColors?.[selectedShape] || DEFAULT_BLOCK_COLORS[selectedShape]}
                  onChange={(e) => handleShapeColorChange(selectedShape, e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-zinc-600"
                  data-testid={`input-color-${selectedShape}`}
                />
              </div>
              <div className="grid grid-cols-8 gap-1.5">
                {PREMIUM_PALETTE.map((p) => (
                  <button
                    key={p.color}
                    onClick={() => handleShapeColorChange(selectedShape, p.color)}
                    className={`w-6 h-6 rounded-md border-2 transition-all hover:scale-110 ${
                      (settings.blockColors?.[selectedShape] || DEFAULT_BLOCK_COLORS[selectedShape]) === p.color
                        ? 'border-primary ring-2 ring-primary/50'
                        : 'border-zinc-600 hover:border-zinc-400'
                    }`}
                    style={{ backgroundColor: p.color }}
                    title={p.name}
                    data-testid={`color-${selectedShape}-${p.name.toLowerCase().replace(' ', '-')}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <Label className="text-sm font-medium">Material Presets</Label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MATERIAL_PRESETS.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(preset)}
                  className="text-xs h-7 px-2 bg-zinc-800/50 border-zinc-700 hover:bg-zinc-700"
                  data-testid={`preset-${preset.name.toLowerCase()}`}
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Metalness</Label>
                <span className="text-xs text-muted-foreground">
                  {Math.round(settings.metalness * 100)}%
                </span>
              </div>
              <Slider
                value={[settings.metalness]}
                onValueChange={([v]) => handleSettingsChange({ metalness: v })}
                min={0}
                max={1}
                step={0.01}
                className="w-full"
                data-testid="slider-metalness"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Roughness</Label>
                <span className="text-xs text-muted-foreground">
                  {Math.round(settings.roughness * 100)}%
                </span>
              </div>
              <Slider
                value={[settings.roughness]}
                onValueChange={([v]) => handleSettingsChange({ roughness: v })}
                min={0}
                max={1}
                step={0.01}
                className="w-full"
                data-testid="slider-roughness"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-primary" />
              <div className="flex items-center justify-between flex-1">
                <Label className="text-xs">Opacity</Label>
                <span className="text-xs text-muted-foreground">
                  {Math.round(settings.opacity * 100)}%
                </span>
              </div>
            </div>
            <Slider
              value={[settings.opacity]}
              onValueChange={([v]) => handleSettingsChange({ opacity: v })}
              min={0.1}
              max={1}
              step={0.01}
              className="w-full"
              data-testid="slider-opacity"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-primary" />
              <Label className="text-sm font-medium">Glow Effect</Label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.emissive}
                onChange={(e) => handleSettingsChange({ emissive: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer border border-zinc-700"
                data-testid="input-emissive-color"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Intensity</Label>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(settings.emissiveIntensity * 100)}%
                  </span>
                </div>
                <Slider
                  value={[settings.emissiveIntensity]}
                  onValueChange={([v]) =>
                    handleSettingsChange({ emissiveIntensity: v })
                  }
                  min={0}
                  max={2}
                  step={0.01}
                  className="w-full"
                  data-testid="slider-emissive"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function isBlockModel(itemId: string): boolean {
  return itemId in BLOCK_MODELS;
}

export { DEFAULT_SETTINGS };
