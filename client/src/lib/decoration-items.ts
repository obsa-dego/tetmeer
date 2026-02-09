import { DecorationItem, DecorationSlot } from "@shared/schema";

export type DecorationCategory = "natural" | "fantasy" | "game" | "ambiance";
export type DecorationSize = "small" | "medium" | "large";

export interface DecorationItemDefinition {
  id: DecorationItem;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  category: DecorationCategory;
  size: DecorationSize;
  price: number;
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  animated?: boolean;
  animationType?: "float" | "rotate" | "pulse" | "flicker" | "wave";
}

export const DECORATION_ITEMS: Record<DecorationItem, DecorationItemDefinition> = {
  // Natural theme
  deco_stone: {
    id: "deco_stone",
    name: "Stone",
    nameKo: "돌",
    description: "A simple decorative stone",
    descriptionKo: "간단한 장식용 돌",
    category: "natural",
    size: "small",
    price: 100,
    color: "#808080",
  },
  deco_pond: {
    id: "deco_pond",
    name: "Pond",
    nameKo: "연못",
    description: "A tranquil pond with rippling water",
    descriptionKo: "잔잔한 물결이 일렁이는 연못",
    category: "natural",
    size: "large",
    price: 500,
    color: "#4a90d9",
    animated: true,
    animationType: "wave",
  },
  deco_tree: {
    id: "deco_tree",
    name: "Tree",
    nameKo: "나무",
    description: "A small decorative tree",
    descriptionKo: "작은 장식용 나무",
    category: "natural",
    size: "large",
    price: 400,
    color: "#228b22",
  },
  deco_flower: {
    id: "deco_flower",
    name: "Flower",
    nameKo: "꽃",
    description: "Colorful blooming flowers",
    descriptionKo: "화려하게 피어난 꽃",
    category: "natural",
    size: "small",
    price: 150,
    color: "#ff69b4",
  },
  deco_mushroom: {
    id: "deco_mushroom",
    name: "Mushroom",
    nameKo: "버섯",
    description: "A cute glowing mushroom",
    descriptionKo: "귀여운 빛나는 버섯",
    category: "natural",
    size: "small",
    price: 200,
    color: "#ff6b6b",
    emissive: "#ff6b6b",
    emissiveIntensity: 0.3,
  },
  deco_grass: {
    id: "deco_grass",
    name: "Grass Patch",
    nameKo: "잔디",
    description: "A patch of swaying grass",
    descriptionKo: "살랑이는 잔디밭",
    category: "natural",
    size: "medium",
    price: 120,
    color: "#7cfc00",
    animated: true,
    animationType: "wave",
  },
  deco_bush: {
    id: "deco_bush",
    name: "Bush",
    nameKo: "덤불",
    description: "A decorative green bush",
    descriptionKo: "장식용 녹색 덤불",
    category: "natural",
    size: "medium",
    price: 180,
    color: "#2e8b57",
  },
  deco_leaves: {
    id: "deco_leaves",
    name: "Leaf Pile",
    nameKo: "낙엽더미",
    description: "A pile of autumn leaves",
    descriptionKo: "가을 낙엽이 쌓인 더미",
    category: "natural",
    size: "medium",
    price: 160,
    color: "#cd853f",
  },

  // Fantasy theme
  deco_treasure: {
    id: "deco_treasure",
    name: "Treasure Chest",
    nameKo: "보물상자",
    description: "A mysterious treasure chest",
    descriptionKo: "신비로운 보물상자",
    category: "fantasy",
    size: "medium",
    price: 600,
    color: "#daa520",
    emissive: "#ffd700",
    emissiveIntensity: 0.4,
  },
  deco_crystal: {
    id: "deco_crystal",
    name: "Crystal",
    nameKo: "크리스탈",
    description: "A glowing magical crystal",
    descriptionKo: "빛나는 마법의 크리스탈",
    category: "fantasy",
    size: "medium",
    price: 450,
    color: "#9966ff",
    emissive: "#9966ff",
    emissiveIntensity: 0.6,
    animated: true,
    animationType: "pulse",
  },
  deco_star: {
    id: "deco_star",
    name: "Star",
    nameKo: "별",
    description: "A twinkling star decoration",
    descriptionKo: "반짝이는 별 장식",
    category: "fantasy",
    size: "small",
    price: 300,
    color: "#ffff00",
    emissive: "#ffff00",
    emissiveIntensity: 0.8,
    animated: true,
    animationType: "pulse",
  },
  deco_heart: {
    id: "deco_heart",
    name: "Heart",
    nameKo: "하트",
    description: "A floating heart",
    descriptionKo: "떠다니는 하트",
    category: "fantasy",
    size: "small",
    price: 250,
    color: "#ff1493",
    emissive: "#ff1493",
    emissiveIntensity: 0.5,
    animated: true,
    animationType: "float",
  },

  // Game theme
  deco_mini_tetro: {
    id: "deco_mini_tetro",
    name: "Mini Tetromino",
    nameKo: "미니 테트로미노",
    description: "A tiny tetromino sculpture",
    descriptionKo: "작은 테트로미노 조각상",
    category: "game",
    size: "small",
    price: 350,
    color: "#00bfff",
    animated: true,
    animationType: "rotate",
  },
  deco_trophy: {
    id: "deco_trophy",
    name: "Trophy",
    nameKo: "트로피",
    description: "A golden trophy",
    descriptionKo: "황금 트로피",
    category: "game",
    size: "medium",
    price: 700,
    color: "#ffd700",
    emissive: "#ffd700",
    emissiveIntensity: 0.3,
  },
  deco_crown: {
    id: "deco_crown",
    name: "Crown",
    nameKo: "왕관",
    description: "A majestic crown",
    descriptionKo: "위풍당당한 왕관",
    category: "game",
    size: "small",
    price: 800,
    color: "#ffd700",
    emissive: "#ffd700",
    emissiveIntensity: 0.4,
    animated: true,
    animationType: "float",
  },
  deco_flag: {
    id: "deco_flag",
    name: "Flag",
    nameKo: "깃발",
    description: "A waving flag",
    descriptionKo: "펄럭이는 깃발",
    category: "game",
    size: "medium",
    price: 280,
    color: "#ff4500",
    animated: true,
    animationType: "wave",
  },

  // Ambiance theme
  deco_lantern: {
    id: "deco_lantern",
    name: "Lantern",
    nameKo: "등불",
    description: "A warm glowing lantern",
    descriptionKo: "따뜻하게 빛나는 등불",
    category: "ambiance",
    size: "small",
    price: 380,
    color: "#ff8c00",
    emissive: "#ff8c00",
    emissiveIntensity: 0.7,
    animated: true,
    animationType: "flicker",
  },
  deco_campfire: {
    id: "deco_campfire",
    name: "Campfire",
    nameKo: "모닥불",
    description: "A cozy campfire",
    descriptionKo: "아늑한 모닥불",
    category: "ambiance",
    size: "medium",
    price: 550,
    color: "#ff4500",
    emissive: "#ff6600",
    emissiveIntensity: 0.9,
    animated: true,
    animationType: "flicker",
  },
  deco_candle: {
    id: "deco_candle",
    name: "Candle",
    nameKo: "촛불",
    description: "A flickering candle",
    descriptionKo: "일렁이는 촛불",
    category: "ambiance",
    size: "small",
    price: 220,
    color: "#ffe4b5",
    emissive: "#ff8c00",
    emissiveIntensity: 0.6,
    animated: true,
    animationType: "flicker",
  },

  // Special items
  deco_glass_cup: {
    id: "deco_glass_cup",
    name: "Glass Cup",
    nameKo: "유리잔",
    description: "An elegant glass cup decoration",
    descriptionKo: "우아한 유리잔 장식",
    category: "ambiance",
    size: "small",
    price: 350,
    color: "#88ccff",
  },
  deco_cartoon_pond: {
    id: "deco_cartoon_pond",
    name: "Cartoon Pond",
    nameKo: "카툰 연못",
    description: "A cute cartoon-style pond decoration",
    descriptionKo: "귀여운 카툰 스타일 연못 장식",
    category: "natural",
    size: "large",
    price: 450,
    color: "#4a90d9",
    animated: true,
    animationType: "wave",
  },
};

export const DECORATION_CATEGORIES: { id: DecorationCategory; name: string; nameKo: string }[] = [
  { id: "natural", name: "Natural", nameKo: "자연" },
  { id: "fantasy", name: "Fantasy", nameKo: "판타지" },
  { id: "game", name: "Game", nameKo: "게임" },
  { id: "ambiance", name: "Ambiance", nameKo: "분위기" },
];

export const DECORATION_SLOT_POSITIONS: Record<DecorationSlot, { x: number; z: number; name: string; nameKo: string }> = {
  top_left: { x: -2, z: -2, name: "Top Left", nameKo: "좌상단" },
  top: { x: 5, z: -2, name: "Top", nameKo: "상단" },
  top_right: { x: 12, z: -2, name: "Top Right", nameKo: "우상단" },
  left: { x: -2, z: 10, name: "Left", nameKo: "좌측" },
  right: { x: 12, z: 10, name: "Right", nameKo: "우측" },
  bottom_left: { x: -2, z: 22, name: "Bottom Left", nameKo: "좌하단" },
  bottom: { x: 5, z: 22, name: "Bottom", nameKo: "하단" },
  bottom_right: { x: 12, z: 22, name: "Bottom Right", nameKo: "우하단" },
};

export function getDecorationsByCategory(category: DecorationCategory): DecorationItemDefinition[] {
  return Object.values(DECORATION_ITEMS).filter(item => item.category === category);
}

export function parseEquippedDecorations(jsonString: string | null | undefined): Record<string, DecorationItem> {
  if (!jsonString) return {};
  try {
    return JSON.parse(jsonString);
  } catch {
    return {};
  }
}

export function stringifyEquippedDecorations(decorations: Record<string, DecorationItem>): string {
  return JSON.stringify(decorations);
}
