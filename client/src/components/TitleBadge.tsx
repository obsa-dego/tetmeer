import { useTranslation } from 'react-i18next';
import { Shield, Crown } from 'lucide-react';
import type { TitleId } from '@shared/schema';

interface TitleDefinition {
  id: TitleId;
  nameKey: string;
  backgroundGradient: string;
  textColor: string;
  borderColor: string;
  glowColor: string;
  icon: 'shield' | 'crown';
}

const TITLE_DEFINITIONS: Record<TitleId, TitleDefinition> = {
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

interface TitleBadgeProps {
  titleId: TitleId | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  showBackground?: boolean;
}

export function TitleBadge({ titleId, size = 'md', showBackground = false }: TitleBadgeProps) {
  const { t } = useTranslation();
  
  if (!titleId) return null;
  
  const title = TITLE_DEFINITIONS[titleId];
  if (!title) return null;

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-3 py-1 gap-1.5',
    lg: 'text-sm px-4 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  const IconComponent = title.icon === 'shield' ? Shield : Crown;

  return (
    <div
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]}`}
      style={{
        background: showBackground ? title.backgroundGradient : 'transparent',
        color: title.textColor,
        border: `1px solid ${title.borderColor}`,
        boxShadow: showBackground ? `0 0 12px ${title.glowColor}` : `0 0 6px ${title.glowColor}`,
      }}
      data-testid={`title-badge-${titleId}`}
    >
      <IconComponent className={iconSizes[size]} style={{ color: title.textColor }} />
      <span>{t(title.nameKey)}</span>
    </div>
  );
}

interface ProfileWithTitleProps {
  children: React.ReactNode;
  titleId: TitleId | null | undefined;
  className?: string;
}

export function ProfileWithTitleBackground({ children, titleId, className = '' }: ProfileWithTitleProps) {
  const title = titleId ? TITLE_DEFINITIONS[titleId] : null;

  if (!title) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={`relative rounded-xl p-4 ${className}`}
      style={{
        background: title.backgroundGradient,
        boxShadow: `0 0 30px ${title.glowColor}, inset 0 0 60px rgba(0,0,0,0.3)`,
      }}
      data-testid="profile-title-background"
    >
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          border: `2px solid ${title.borderColor}`,
          boxShadow: `inset 0 0 20px ${title.glowColor}`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function getTitleDefinition(titleId: TitleId): TitleDefinition | undefined {
  return TITLE_DEFINITIONS[titleId];
}

export function getAllTitleIds(): TitleId[] {
  return Object.keys(TITLE_DEFINITIONS) as TitleId[];
}
