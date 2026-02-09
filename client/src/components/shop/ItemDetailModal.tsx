import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Model3DPreview, hasGLBModel } from './Model3DPreview';
import { Gem, Clock, Check, Loader2, Box, Sparkles, Dog, Shield } from 'lucide-react';
import type { ShopItem } from '@shared/shop';
import { getDurationConfig } from '@shared/shop';

interface ItemDetailModalProps {
  item: ShopItem | null;
  isOpen: boolean;
  onClose: () => void;
  onPurchase: (itemId: string) => void;
  isOwned: boolean;
  canAfford: boolean;
  isPurchasing: boolean;
  remainingTime: string | null;
}

const TYPE_ICONS: Record<string, typeof Box> = {
  block: Box,
  decoration: Sparkles,
  pet: Dog,
  badge: Shield,
  floor: Box,
  board: Box,
};

export function ItemDetailModal({
  item,
  isOpen,
  onClose,
  onPurchase,
  isOwned,
  canAfford,
  isPurchasing,
  remainingTime,
}: ItemDetailModalProps) {
  const { t } = useTranslation();

  if (!item) return null;

  const hasModel = hasGLBModel(item.id);
  const Icon = TYPE_ICONS[item.type] || Box;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-xl">{t(item.nameKey)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex justify-center py-4 bg-zinc-950 rounded-lg">
            {hasModel ? (
              <Model3DPreview 
                itemId={item.id} 
                size={250} 
                autoRotate={true}
                interactive={true}
              />
            ) : (
              <div className="w-[250px] h-[250px] flex items-center justify-center">
                <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                  <Icon className="w-12 h-12 text-primary opacity-50" />
                </div>
              </div>
            )}
          </div>

          {hasModel && (
            <p className="text-center text-sm text-zinc-500">
              {t('shop.dragToRotate', '드래그하여 360° 회전')}
            </p>
          )}

          <DialogDescription className="text-base text-zinc-300">
            {t(item.descriptionKey)}
          </DialogDescription>

          <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
            <div className="flex items-center gap-2 text-purple-400">
              <Gem className="w-5 h-5" />
              <span className="font-bold text-lg">{item.price.toLocaleString()} Gem</span>
            </div>
            <div className="flex items-center gap-1 text-zinc-400">
              <Clock className="w-4 h-4" />
              <span>{t(getDurationConfig(item.duration).labelKey)}</span>
            </div>
          </div>

          {isOwned && remainingTime && (
            <div className="flex items-center justify-center gap-2 p-3 bg-green-900/20 border border-green-800 rounded-lg">
              <Check className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-medium">{t('shop.alreadyOwned')}</span>
              <span className="text-yellow-400 text-sm ml-2">({remainingTime})</span>
            </div>
          )}

          <Button
            className="w-full gap-2 h-12 text-base"
            size="lg"
            variant={isOwned ? 'outline' : 'default'}
            disabled={isOwned || !canAfford || isPurchasing}
            onClick={() => onPurchase(item.id)}
            data-testid={`modal-buy-${item.id}`}
          >
            {isPurchasing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('shop.purchasing', '구매 중...')}
              </>
            ) : isOwned ? (
              t('shop.alreadyOwned')
            ) : !canAfford ? (
              t('shop.insufficientGems', 'Insufficient Gems')
            ) : (
              <>
                <Gem className="w-5 h-5" />
                {t('shop.purchase')} - {item.price.toLocaleString()} Gem
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
