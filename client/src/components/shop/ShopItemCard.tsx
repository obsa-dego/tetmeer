import { useTranslation } from 'react-i18next';
import { Gem } from 'lucide-react';
import type { ShopItem } from '@shared/shop';
import { getDurationConfig } from '@shared/shop';
import { Model3DPreview, hasGLBModel } from '@/components/shop/Model3DPreview';

interface ShopItemCardProps {
  item: ShopItem;
  owned: boolean;
  onClick?: () => void;
  fallbackIcon?: React.ReactNode;
}

export function ShopItemCard({ 
  item, 
  owned, 
  onClick,
  fallbackIcon
}: ShopItemCardProps) {
  const { t } = useTranslation();
  const hasModel = hasGLBModel(item.id);
  const durationConfig = getDurationConfig(item.duration);
  const isPermanent = item.duration === 'permanent';

  return (
    <div 
      className={`group cursor-pointer transition-all duration-200 ${
        owned ? 'opacity-70' : 'hover:scale-[1.02]'
      }`}
      onClick={onClick}
      data-testid={`shop-item-${item.id}`}
    >
      <div className="relative aspect-square rounded-xl overflow-hidden bg-white/5 backdrop-blur-md">
        <div className="absolute inset-0 flex items-center justify-center">
          {hasModel ? (
            <Model3DPreview 
              itemId={item.id} 
              size={180} 
              autoRotate={true}
              interactive={false}
            />
          ) : (
            <div className="w-24 h-24 flex items-center justify-center opacity-60">
              {fallbackIcon}
            </div>
          )}
        </div>
        
        {owned && (
          <>
            <div className="absolute inset-0 bg-black/25" />
            <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[10px] text-white/80 font-medium tracking-wide">
              보유중
            </div>
          </>
        )}
        
        {hasModel && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/50 rounded text-[10px] text-white/70 font-medium">
            3D
          </div>
        )}
      </div>
      
      <div className="flex items-start justify-between mt-3 px-0.5">
        <h3 className="text-sm font-medium text-foreground truncate leading-tight flex-1 min-w-0">
          {t(item.nameKey)}
        </h3>
        <div className="flex flex-col items-end flex-shrink-0 ml-2">
          <div className="flex items-center gap-1 text-purple-400">
            <Gem className="w-3.5 h-3.5" />
            <span className="text-sm font-semibold">{item.price.toLocaleString()}</span>
          </div>
          {!isPermanent && (
            <span className="text-[10px] text-muted-foreground">
              {t(durationConfig.labelKey)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
