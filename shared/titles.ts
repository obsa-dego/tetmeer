import type { TitleId } from './schema';

export interface TitleDefinition {
  id: TitleId;
  nameKey: string;
  backgroundGradient: string;
  textColor: string;
  borderColor: string;
  glowColor: string;
  icon?: string;
}

export const TITLE_DEFINITIONS: Record<TitleId, TitleDefinition> = {
  admin: {
    id: 'admin',
    nameKey: 'titles.admin',
    backgroundGradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    textColor: '#00d4ff',
    borderColor: '#00d4ff',
    glowColor: 'rgba(0, 212, 255, 0.5)',
    icon: 'shield',
  },
  challenger: {
    id: 'challenger',
    nameKey: 'titles.challenger',
    backgroundGradient: 'linear-gradient(135deg, #2d1b4e 0%, #4a1942 50%, #6b1d5c 100%)',
    textColor: '#ff6b35',
    borderColor: '#ff6b35',
    glowColor: 'rgba(255, 107, 53, 0.5)',
    icon: 'crown',
  },
};

export function getTitleDefinition(titleId: TitleId): TitleDefinition | undefined {
  return TITLE_DEFINITIONS[titleId];
}

export function getAllTitleIds(): TitleId[] {
  return Object.keys(TITLE_DEFINITIONS) as TitleId[];
}
