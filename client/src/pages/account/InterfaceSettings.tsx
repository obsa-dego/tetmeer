import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { ItemPreview3D } from '@/components/ui/ItemPreview3D';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useTranslation } from 'react-i18next';
import { parseEquippedDecorations, stringifyEquippedDecorations, DECORATION_ITEMS, DECORATION_CATEGORIES } from '@/lib/decoration-items';
import { soundManager } from '@/lib/sound-manager';
import type { BlockTexture, PlacedDecorations, DecorationItem, UserInventory } from '@shared/schema';
import {
  ArrowLeft, Check, Loader2, Lock, Box, Gem, Trash2, Info, MapPin,
} from 'lucide-react';

type GridMaterialType = 'default' | 'glass' | 'metal' | 'neon' | 'hologram' | 'matrix' | 'lava' | 'ice';
type BoardMaterialType = 'default' | 'glass' | 'metal' | 'neon' | 'hologram' | 'matrix' | 'carbon' | 'galaxy';
type ViewModeType = '2d' | '3d';

interface UserSettings {
  blockTexture: BlockTexture;
  backgroundColor: string;
  gridColor: string;
  showPet: boolean;
  selectedPets: string[];
  gridMaterial: GridMaterialType;
  boardMaterial: BoardMaterialType;
  viewMode: ViewModeType;
  equippedDecorations: string;
  placedDecorations: string;
}

interface ColorPreset {
  id: string;
  name: string;
  background: string;
  grid: string;
  accent: string;
}

const COLOR_PRESETS: ColorPreset[] = [
  { id: 'midnight', name: 'Midnight', background: '#060B24', grid: '#39436A', accent: '#4A5FA8' },
  { id: 'aurora', name: 'Aurora', background: '#0B1C2F', grid: '#6FFFE9', accent: '#00D4AA' },
  { id: 'nebula', name: 'Nebula', background: '#1F104A', grid: '#C778FF', accent: '#9B4DCA' },
  { id: 'desert', name: 'Desert Dusk', background: '#2E1B14', grid: '#FFB991', accent: '#FF8C42' },
  { id: 'zenith', name: 'Zenith', background: '#0D121F', grid: '#8EA3D1', accent: '#5B7EC2' },
  { id: 'ocean', name: 'Deep Ocean', background: '#0A1628', grid: '#00B4D8', accent: '#0096C7' },
  { id: 'forest', name: 'Forest', background: '#0D1F0D', grid: '#4CAF50', accent: '#2E7D32' },
  { id: 'rose', name: 'Rose Gold', background: '#1A0F0F', grid: '#E8A4A4', accent: '#D47F7F' },
  { id: 'classic', name: 'Classic', background: '#000000', grid: '#FFFFFF', accent: '#888888' },
  { id: 'cyber', name: 'Cyberpunk', background: '#0D0221', grid: '#FF00FF', accent: '#00FFFF' },
];

const PET_TYPES = [
  { id: 'pet_puppy', labelKey: 'shop.puppyPet' },
  { id: 'pet_cat', labelKey: 'shop.catPet' },
  { id: 'pet_lion', labelKey: 'shop.lionPet' },
  { id: 'pet_gecko', labelKey: 'shop.geckoPet' },
  { id: 'pet_dragon', labelKey: 'shop.dragonPet' },
  { id: 'pet_turtle', labelKey: 'shop.turtlePet' },
  { id: 'pet_crab', labelKey: 'shop.crabPet' },
];

const BASE_FLOOR_OPTIONS: { value: GridMaterialType; labelKey: string }[] = [
  { value: 'default', labelKey: 'settings.defaultFloor' },
];

const SHOP_FLOOR_OPTIONS: { value: GridMaterialType; labelKey: string; shopId: string }[] = [
  { value: 'glass', labelKey: 'shop.glassFloor', shopId: 'floor_glass' },
  { value: 'metal', labelKey: 'shop.metalFloor', shopId: 'floor_metal' },
  { value: 'neon', labelKey: 'shop.neonFloor', shopId: 'floor_neon' },
  { value: 'hologram', labelKey: 'shop.hologramFloor', shopId: 'floor_hologram' },
  { value: 'matrix', labelKey: 'shop.matrixFloor', shopId: 'floor_matrix' },
  { value: 'lava', labelKey: 'shop.lavaFloor', shopId: 'floor_lava' },
  { value: 'ice', labelKey: 'shop.iceFloor', shopId: 'floor_ice' },
];

const BASE_BOARD_OPTIONS: { value: BoardMaterialType; labelKey: string }[] = [
  { value: 'default', labelKey: 'settings.defaultBoard' },
];

const SHOP_BOARD_OPTIONS: { value: BoardMaterialType; labelKey: string; shopId: string }[] = [
  { value: 'glass', labelKey: 'shop.glassBoard', shopId: 'board_glass' },
  { value: 'metal', labelKey: 'shop.metalBoard', shopId: 'board_metal' },
  { value: 'neon', labelKey: 'shop.neonBoard', shopId: 'board_neon' },
  { value: 'hologram', labelKey: 'shop.hologramBoard', shopId: 'board_hologram' },
  { value: 'matrix', labelKey: 'shop.matrixBoard', shopId: 'board_matrix' },
  { value: 'carbon', labelKey: 'shop.carbonBoard', shopId: 'board_carbon' },
  { value: 'galaxy', labelKey: 'shop.galaxyBoard', shopId: 'board_galaxy' },
];

const BASE_TEXTURE_OPTIONS: { value: BlockTexture; labelKey: string }[] = [
  { value: "default", labelKey: "settings.default" },
  { value: "metallic", labelKey: "settings.metallic" },
  { value: "wood", labelKey: "settings.wood" },
  { value: "model_cube", labelKey: "settings.modelCube" },
];

const SHOP_TEXTURE_OPTIONS: { value: BlockTexture; labelKey: string }[] = [
  { value: "block_retro_pixel", labelKey: "shop.retroPixel" },
  { value: "block_obsidian_matte", labelKey: "shop.obsidianMatte" },
  { value: "block_neon_crystal", labelKey: "shop.neonCrystal" },
  { value: "block_hologram", labelKey: "shop.hologram" },
  { value: "model_cloth", labelKey: "shop.clothBlock" },
];

const MAX_SELECTED_PETS = 3;

interface InterfaceSettingsProps {
  settings: UserSettings | undefined;
  inventory: UserInventory[] | undefined;
  onBack: () => void;
  onSaved: () => void;
}

export function InterfaceSettings({ settings, inventory, onBack, onSaved }: InterfaceSettingsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [editBackgroundColor, setEditBackgroundColor] = useState('#000000');
  const [editGridColor, setEditGridColor] = useState('#ffffff');
  const [editBlockTexture, setEditBlockTexture] = useState<BlockTexture>('default');
  const [editGridMaterial, setEditGridMaterial] = useState<GridMaterialType>('default');
  const [editBoardMaterial, setEditBoardMaterial] = useState<BoardMaterialType>('default');
  const [editShowPet, setEditShowPet] = useState(false);
  const [editSelectedPets, setEditSelectedPets] = useState<string[]>(['pet_puppy']);
  const [editViewMode, setEditViewMode] = useState<ViewModeType>('3d');
  const [editEquippedDecorations, setEditEquippedDecorations] = useState<Record<string, DecorationItem>>({});
  const [editPlacedDecorations, setEditPlacedDecorations] = useState<PlacedDecorations>([]);
  const [interfaceSettingsTab, setInterfaceSettingsTab] = useState<'colors' | 'texture' | 'floor' | 'board' | 'pet' | 'decoration'>('colors');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedDecorationForPlacement, setSelectedDecorationForPlacement] = useState<DecorationItem | null>(null);
  const [expandedDecorationId, setExpandedDecorationId] = useState<string | null>(null);

  // Derived inventory sets
  const ownedTextureIds = new Set(
    inventory?.filter(item => item.itemType.startsWith('block_') || item.itemType.startsWith('model_')).map(item => item.itemType) || []
  );
  const ownedFloorIds = new Set(
    inventory?.filter(item => item.itemType.startsWith('floor_')).map(item => item.itemType) || []
  );
  const ownedBoardIds = new Set(
    inventory?.filter(item => item.itemType.startsWith('board_')).map(item => item.itemType) || []
  );
  const ownedPets = inventory?.filter(item => item.itemType.startsWith('pet_') && item.quantity > 0) ?? [];
  const ownsPet = ownedPets.length > 0;
  const ownedDecorationIds = new Set(
    inventory?.filter(item => item.itemType.startsWith('deco_') && item.quantity > 0).map(item => item.itemType) || []
  );

  // Sync from settings on mount
  useEffect(() => {
    if (settings) {
      setEditBackgroundColor(settings.backgroundColor || '#000000');
      setEditGridColor(settings.gridColor || '#ffffff');
      setEditBlockTexture(settings.blockTexture || 'default');
      setEditGridMaterial(settings.gridMaterial || 'default');
      setEditBoardMaterial(settings.boardMaterial || 'default');
      setEditShowPet(settings.showPet || false);
      setEditSelectedPets(settings.selectedPets || ['pet_puppy']);
      setEditViewMode(settings.viewMode || '3d');
      if (settings.equippedDecorations) {
        setEditEquippedDecorations(parseEquippedDecorations(settings.equippedDecorations));
      }
      if (settings.placedDecorations) {
        try {
          setEditPlacedDecorations(JSON.parse(settings.placedDecorations));
        } catch { setEditPlacedDecorations([]); }
      }
      const matchingPreset = COLOR_PRESETS.find(
        p => p.background.toLowerCase() === settings.backgroundColor?.toLowerCase() &&
             p.grid.toLowerCase() === settings.gridColor?.toLowerCase()
      );
      setSelectedPreset(matchingPreset?.id || null);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<UserSettings>) => {
      const response = await apiRequest('PATCH', '/api/settings', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({ title: t('settings.settingsSaved', 'Settings Saved'), description: t('settings.interfaceUpdated', 'Interface settings updated') });
      onSaved();
    },
    onError: () => {
      toast({ title: t('common.error'), description: t('common.failedToSave'), variant: 'destructive' });
    },
  });

  const handlePresetSelect = (preset: ColorPreset) => {
    setSelectedPreset(preset.id);
    setEditBackgroundColor(preset.background);
    setEditGridColor(preset.grid);
  };

  const handleTextureChange = (value: BlockTexture) => {
    setEditBlockTexture(value);
    soundManager.playBlockPlace(value);
  };

  const togglePetSelection = (petId: string) => {
    setEditSelectedPets(prev => {
      if (prev.includes(petId)) {
        return prev.filter(id => id !== petId);
      } else if (prev.length < MAX_SELECTED_PETS) {
        return [...prev, petId];
      }
      return prev;
    });
  };

  const handleSave = () => {
    updateMutation.mutate({
      backgroundColor: editBackgroundColor,
      gridColor: editGridColor,
      blockTexture: editBlockTexture,
      gridMaterial: editGridMaterial,
      boardMaterial: editBoardMaterial,
      showPet: ownsPet ? editShowPet : false,
      selectedPets: ownsPet ? editSelectedPets : ['pet_puppy'],
      viewMode: editViewMode,
      equippedDecorations: stringifyEquippedDecorations(editEquippedDecorations),
      placedDecorations: JSON.stringify(editPlacedDecorations),
    });
  };

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-interface">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold">{t('settings.interfaceSettings', 'Interface')}</h2>
        </div>
        <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-interface">
          {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
          {t('common.save', 'Save')}
        </Button>
      </div>

      <div className="flex rounded-lg bg-muted/30 p-1 mb-3">
        {(['colors', 'texture', 'floor', 'board', 'pet', 'decoration'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setInterfaceSettingsTab(tab)}
            className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
              interfaceSettingsTab === tab ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid={`tab-${tab}`}
          >
            {t(`settings.${tab}`, tab.charAt(0).toUpperCase() + tab.slice(1))}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg mb-3">
        <span className="text-xs font-medium">{t('settings.viewMode', 'View Mode')}</span>
        <div className="flex gap-1 bg-background rounded-md p-0.5">
          <button
            onClick={() => setEditViewMode('2d')}
            className={`px-2 py-1 rounded text-xs ${editViewMode === '2d' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >2D</button>
          <button
            onClick={() => setEditViewMode('3d')}
            className={`px-2 py-1 rounded text-xs ${editViewMode === '3d' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >3D</button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {interfaceSettingsTab === 'colors' && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('settings.colorPresets', 'Color Presets')}</Label>
            <div className="grid grid-cols-5 gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset)}
                  className={`relative aspect-square rounded-lg border-2 transition-all ${
                    selectedPreset === preset.id ? 'border-primary scale-105' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ background: `linear-gradient(135deg, ${preset.background} 0%, ${preset.grid} 100%)` }}
                  title={preset.name}
                >
                  {selectedPreset === preset.id && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white drop-shadow-lg" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <Label className="text-xs">{t('settings.backgroundColor', 'Background')}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={editBackgroundColor} onChange={(e) => { setEditBackgroundColor(e.target.value); setSelectedPreset(null); }} className="w-8 h-8 rounded cursor-pointer" />
                  <Input value={editBackgroundColor} onChange={(e) => { setEditBackgroundColor(e.target.value); setSelectedPreset(null); }} className="h-8 text-xs" />
                </div>
              </div>
              <div>
                <Label className="text-xs">{t('settings.gridColor', 'Grid')}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={editGridColor} onChange={(e) => { setEditGridColor(e.target.value); setSelectedPreset(null); }} className="w-8 h-8 rounded cursor-pointer" />
                  <Input value={editGridColor} onChange={(e) => { setEditGridColor(e.target.value); setSelectedPreset(null); }} className="h-8 text-xs" />
                </div>
              </div>
            </div>
          </div>
        )}

        {interfaceSettingsTab === 'texture' && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('settings.blockTexture', 'Block Texture')}</Label>
            {BASE_TEXTURE_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => handleTextureChange(opt.value)} className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${editBlockTexture === opt.value ? 'bg-primary/20 border border-primary' : 'bg-muted/30 hover:bg-muted/50'}`}>
                <Box className="w-5 h-5" />
                <span className="text-sm">{t(opt.labelKey, opt.value)}</span>
                {editBlockTexture === opt.value && <Check className="w-4 h-4 ml-auto text-primary" />}
              </button>
            ))}
            {SHOP_TEXTURE_OPTIONS.map((opt) => {
              const owned = ownedTextureIds.has(opt.value);
              return (
                <button key={opt.value} onClick={() => owned && handleTextureChange(opt.value)} disabled={!owned} className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${editBlockTexture === opt.value ? 'bg-primary/20 border border-primary' : owned ? 'bg-muted/30 hover:bg-muted/50' : 'bg-muted/20 opacity-50'}`}>
                  {owned ? <Gem className="w-5 h-5" /> : <Lock className="w-5 h-5 text-muted-foreground" />}
                  <span className="text-sm">{t(opt.labelKey, opt.value)}</span>
                  {editBlockTexture === opt.value && <Check className="w-4 h-4 ml-auto text-primary" />}
                </button>
              );
            })}
          </div>
        )}

        {interfaceSettingsTab === 'floor' && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('settings.floorMaterial', 'Floor Material')}</Label>
            {BASE_FLOOR_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => setEditGridMaterial(opt.value)} className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${editGridMaterial === opt.value ? 'bg-primary/20 border border-primary' : 'bg-muted/30 hover:bg-muted/50'}`}>
                <Box className="w-5 h-5" />
                <span className="text-sm">{t(opt.labelKey, opt.value)}</span>
                {editGridMaterial === opt.value && <Check className="w-4 h-4 ml-auto text-primary" />}
              </button>
            ))}
            {SHOP_FLOOR_OPTIONS.map((opt) => {
              const owned = ownedFloorIds.has(opt.shopId);
              return (
                <button key={opt.value} onClick={() => owned && setEditGridMaterial(opt.value)} disabled={!owned} className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${editGridMaterial === opt.value ? 'bg-primary/20 border border-primary' : owned ? 'bg-muted/30 hover:bg-muted/50' : 'bg-muted/20 opacity-50'}`}>
                  {owned ? <Box className="w-5 h-5" /> : <Lock className="w-5 h-5 text-muted-foreground" />}
                  <span className="text-sm">{t(opt.labelKey, opt.value)}</span>
                  {editGridMaterial === opt.value && <Check className="w-4 h-4 ml-auto text-primary" />}
                </button>
              );
            })}
          </div>
        )}

        {interfaceSettingsTab === 'board' && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('settings.boardMaterial', 'Board Material')}</Label>
            {BASE_BOARD_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => setEditBoardMaterial(opt.value)} className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${editBoardMaterial === opt.value ? 'bg-primary/20 border border-primary' : 'bg-muted/30 hover:bg-muted/50'}`}>
                <Box className="w-5 h-5" />
                <span className="text-sm">{t(opt.labelKey, opt.value)}</span>
                {editBoardMaterial === opt.value && <Check className="w-4 h-4 ml-auto text-primary" />}
              </button>
            ))}
            {SHOP_BOARD_OPTIONS.map((opt) => {
              const owned = ownedBoardIds.has(opt.shopId);
              return (
                <button key={opt.value} onClick={() => owned && setEditBoardMaterial(opt.value)} disabled={!owned} className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${editBoardMaterial === opt.value ? 'bg-primary/20 border border-primary' : owned ? 'bg-muted/30 hover:bg-muted/50' : 'bg-muted/20 opacity-50'}`}>
                  {owned ? <Box className="w-5 h-5" /> : <Lock className="w-5 h-5 text-muted-foreground" />}
                  <span className="text-sm">{t(opt.labelKey, opt.value)}</span>
                  {editBoardMaterial === opt.value && <Check className="w-4 h-4 ml-auto text-primary" />}
                </button>
              );
            })}
          </div>
        )}

        {interfaceSettingsTab === 'pet' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t('settings.showPet', 'Show Pet')}</Label>
              <Switch checked={editShowPet} onCheckedChange={setEditShowPet} disabled={!ownsPet} />
            </div>
            {!ownsPet && <p className="text-xs text-muted-foreground">{t('settings.noPetsOwned', 'Purchase pets in the shop')}</p>}
            {ownsPet && editShowPet && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t('settings.selectPets', 'Select up to 3 pets')} ({editSelectedPets.length}/{MAX_SELECTED_PETS})</p>
                <div className="grid grid-cols-3 gap-2">
                  {PET_TYPES.map((pet) => {
                    const owned = ownedPets.some(p => p.itemType === pet.id);
                    const selected = editSelectedPets.includes(pet.id);
                    return (
                      <button
                        key={pet.id}
                        onClick={() => owned && togglePetSelection(pet.id)}
                        disabled={!owned}
                        className={`flex flex-col items-center p-2 rounded-lg transition-colors ${selected ? 'bg-primary/20 border border-primary' : owned ? 'bg-muted/30 hover:bg-muted/50' : 'bg-muted/20 opacity-50'}`}
                      >
                        {owned ? (
                          <ItemPreview3D itemType="pet" itemId={pet.id} size={48} />
                        ) : (
                          <div className="w-12 h-12 flex items-center justify-center">
                            <Lock className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <span className="text-xs mt-1 truncate w-full text-center">{t(pet.labelKey, pet.id.replace('pet_', ''))}</span>
                        {selected && <Check className="w-3 h-3 text-primary mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {interfaceSettingsTab === 'decoration' && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('settings.decorations', 'Decorations')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.decorationHint', 'Select an item and click on the preview to place it')}</p>
            {selectedDecorationForPlacement && (
              <div className="p-2 bg-primary/20 border border-primary rounded-lg flex items-center gap-2">
                <ItemPreview3D itemType="decoration" itemId={selectedDecorationForPlacement} size={40} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{DECORATION_ITEMS[selectedDecorationForPlacement]?.name}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.clickToPlace', 'Click on grid to place')}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedDecorationForPlacement(null)} className="h-6 text-xs">
                  {t('common.cancel', 'Cancel')}
                </Button>
              </div>
            )}
            {DECORATION_CATEGORIES.map((cat) => {
              const ownedInCategory = Object.entries(DECORATION_ITEMS)
                .filter(([itemId, def]) => def.category === cat.id && ownedDecorationIds.has(itemId))
                .map(([itemId]) => itemId);
              if (ownedInCategory.length === 0) return null;
              return (
                <div key={cat.id} className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{cat.name}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {ownedInCategory.map((itemId) => {
                      const itemDef = DECORATION_ITEMS[itemId as DecorationItem];
                      const isExpanded = expandedDecorationId === itemId;
                      const isSelected = selectedDecorationForPlacement === itemId;
                      return (
                        <div key={itemId} className="relative">
                          <button
                            onClick={() => setExpandedDecorationId(isExpanded ? null : itemId)}
                            className={`flex flex-col items-center p-1 rounded-lg border-2 transition-all w-full ${isSelected ? 'border-primary bg-primary/20' : isExpanded ? 'border-amber-400 bg-amber-400/10' : 'border-transparent bg-muted/30 hover:bg-muted/50'}`}
                            title={itemDef?.name || itemId}
                            data-testid={`button-inventory-item-${itemId}`}
                          >
                            <ItemPreview3D itemType="decoration" itemId={itemId} size={40} />
                            <span className="text-[10px] mt-0.5 truncate w-full text-center">{itemDef?.name?.split('_').pop()}</span>
                          </button>
                          {isExpanded && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-background border border-border rounded-lg p-2 shadow-lg space-y-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="w-full text-xs justify-start"
                                onClick={() => {
                                  setExpandedDecorationId(null);
                                }}
                                data-testid={`button-item-info-${itemId}`}
                              >
                                <Info className="w-3 h-3 mr-1" />
                                {t('shop.viewInfo', 'View Info')}
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                className="w-full text-xs justify-start"
                                onClick={() => {
                                  setSelectedDecorationForPlacement(itemId as DecorationItem);
                                  setExpandedDecorationId(null);
                                }}
                                data-testid={`button-place-${itemId}`}
                              >
                                <MapPin className="w-3 h-3 mr-1" />
                                {t('shop.place', 'Place')}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {editPlacedDecorations.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium">{t('settings.placedDecorations', 'Placed')} ({editPlacedDecorations.length})</p>
                  <Button variant="ghost" size="sm" onClick={() => setEditPlacedDecorations([])} className="h-6 text-xs text-red-500">
                    <Trash2 className="w-3 h-3 mr-1" />
                    {t('common.clearAll', 'Clear All')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
