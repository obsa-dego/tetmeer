import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { useSidebar } from '@/contexts/SidebarContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { useAuth } from '@/hooks/use-auth';
import { ArrowLeft, Gem, Clock, Check, Loader2, Box, Sparkles, Dog, Shield, Gift, ArrowUp, ArrowDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import type { ShopItem, ShopItemDuration } from '@shared/shop';
import { isItemExpired, getRemainingTime, getDurationConfig, SHOP_ITEMS, compareDurations } from '@shared/shop';
import type { UserInventory, PlayerProgression } from '@shared/schema';
import { Model3DPreview, hasGLBModel } from '@/components/shop/Model3DPreview';

const TYPE_ICONS: Record<string, typeof Box> = {
  block: Box,
  decoration: Sparkles,
  pet: Dog,
  badge: Shield,
  floor: Box,
  board: Box,
};

const TYPE_LABELS: Record<string, string> = {
  block: '블럭 스킨',
  decoration: '장식 아이템',
  pet: '펫',
  badge: '뱃지',
  floor: '바닥 재질',
  board: '게임판 재질',
};

export default function ProductDetail() {
  const { t } = useTranslation();
  const { expanded, notificationOpen, languageOpen, profileOpen } = useSidebar();
  const anyPanelOpen = notificationOpen || languageOpen || profileOpen;
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { navigateTo, params, goBack } = useNavigation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);

  const itemId = params.itemId;
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  
  // Fetch price options from database
  const { data: priceOptionsData } = useQuery<{ options: { id: number; duration: string; price: number; isDefault: boolean }[] }>({
    queryKey: ['/api/shop/price-options', itemId],
    queryFn: async () => {
      const res = await fetch(`/api/shop/price-options/${itemId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch price options');
      return res.json();
    },
    enabled: !!item,
  });
  
  // Use database options or fallback to item defaults
  const priceOptions = priceOptionsData?.options?.length 
    ? priceOptionsData.options.map(opt => ({
        price: opt.price,
        duration: opt.duration,
        labelKey: getDurationConfig(opt.duration as any).labelKey,
        isDefault: opt.isDefault,
      }))
    : item ? [
        { price: item.price, duration: item.duration, labelKey: getDurationConfig(item.duration).labelKey, isDefault: true },
      ] : [];
  
  // Auto-select default option on load
  useEffect(() => {
    if (priceOptions.length > 0) {
      const defaultIdx = priceOptions.findIndex(opt => opt.isDefault);
      if (defaultIdx >= 0 && selectedOptionIndex !== defaultIdx) {
        setSelectedOptionIndex(defaultIdx);
      }
    }
  }, [priceOptionsData]);
  
  const selectedOption = priceOptions[selectedOptionIndex];

  useEffect(() => {
    if (!item && !authLoading) {
      navigateTo('shop');
    }
  }, [item, authLoading, navigateTo]);

  const { data: inventoryData } = useQuery<{ inventory: UserInventory[] }>({
    queryKey: ['/api/shop/inventory'],
    enabled: isAuthenticated,
  });

  const { data: progressionData } = useQuery<PlayerProgression>({
    queryKey: ['/api/ranked/progression'],
    enabled: isAuthenticated,
  });

  const purchaseMutation = useMutation({
    mutationFn: async ({ itemId, duration, isCustomItem }: { itemId: string; duration?: string; isCustomItem?: boolean }) => {
      return apiRequest('POST', '/api/shop/purchase', { itemId, duration, isCustomItem });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/shop/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ranked/progression'] });
      toast({
        title: t('shop.purchaseSuccess'),
        description: `-${data.gemSpent} Gem`,
      });
      setIsPurchasing(false);
    },
    onError: (error: any) => {
      const message = error?.message || t('shop.insufficientGems', 'Insufficient Gems');
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      setIsPurchasing(false);
    },
  });

  const handlePurchase = () => {
    if (!item || !selectedOption) return;
    setIsPurchasing(true);
    purchaseMutation.mutate({ 
      itemId: item.id, 
      duration: selectedOption.duration,
      isCustomItem: false 
    });
  };

  const handleGift = () => {
    toast({
      title: t('shop.giftComingSoon', '선물하기 기능 준비중'),
      description: t('shop.giftComingSoonDesc', '곧 이용 가능합니다'),
    });
  };

  const getOwnedItem = (itemId: string) => {
    return inventoryData?.inventory.find(inv => inv.itemType === itemId && inv.quantity > 0);
  };

  const isOwned = (itemId: string) => {
    const owned = getOwnedItem(itemId);
    if (!owned) return false;
    const expiryDate = owned.expiresAt ? new Date(owned.expiresAt) : null;
    return !isItemExpired(expiryDate);
  };

  const getItemRemainingTime = (itemId: string): string | null => {
    const owned = getOwnedItem(itemId);
    if (!owned) return null;
    const expiryDate = owned.expiresAt ? new Date(owned.expiresAt) : null;
    if (!expiryDate) return t('shop.duration.permanent');
    
    const remaining = getRemainingTime(expiryDate);
    if (remaining <= 0) return null;
    
    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (days > 0) {
      return `${days}${t('shop.duration.daysLeft', 'd')} ${hours}${t('shop.duration.hoursLeft', 'h')}`;
    }
    return `${hours}${t('shop.duration.hoursLeft', 'h')}`;
  };

  if (!item) {
    return null;
  }

  const gemBalance = progressionData?.gemBalance ?? 0;
  const canAfford = selectedOption ? gemBalance >= selectedOption.price : false;
  const owned = isOwned(item.id);
  const ownedItem = getOwnedItem(item.id);
  const ownedDuration = ownedItem?.duration as ShopItemDuration | undefined;
  const pendingDuration = ownedItem?.pendingDuration as ShopItemDuration | undefined;
  const remainingTime = getItemRemainingTime(item.id);
  const hasModel = hasGLBModel(item.id);
  const Icon = TYPE_ICONS[item.type] || Box;
  
  // Check if item is permanent (no expiry)
  const isPermanentItem = ownedItem && !ownedItem.expiresAt;
  
  // Determine upgrade/downgrade status for selected option
  const getOptionStatus = (optionDuration: string): 'owned' | 'pending' | 'upgrade' | 'downgrade' | 'available' | 'blocked' => {
    if (!owned || !ownedDuration) return 'available';
    // Check if this duration is already pending
    if (pendingDuration && optionDuration === pendingDuration) return 'pending';
    const comparison = compareDurations(ownedDuration, optionDuration as ShopItemDuration);
    if (comparison === 'same') return 'owned';
    // Block upgrade/downgrade for permanent items or when pending exists
    if (isPermanentItem || pendingDuration) return 'blocked';
    if (comparison === 'upgrade') return 'upgrade';
    return 'downgrade';
  };
  
  const selectedStatus = selectedOption ? getOptionStatus(selectedOption.duration) : 'available';
  const hasPendingChange = !!pendingDuration;

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden">
      <Header />
      <main 
        className={`flex-1 overflow-hidden transition-all duration-300 ease-out ${anyPanelOpen ? 'blur-md pointer-events-none' : ''}`}
        style={{ 
          paddingLeft: expanded ? '240px' : '88px',
          paddingTop: '1rem',
          paddingRight: '1rem',
          paddingBottom: '1rem'
        }}
      >
        <div className="h-full bg-white/5 backdrop-blur-md rounded-xl overflow-hidden">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between gap-3 p-4">
              <button
                onClick={goBack}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                data-testid="back-button"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm font-medium">{t('shop.backToShop', '상점으로 돌아가기')}</span>
              </button>
              <div className="flex items-center gap-3 bg-purple-900/30 px-4 py-2 rounded-lg border border-purple-700/50">
                <Gem className="w-4 h-4 text-purple-400" />
                <span className="text-lg font-bold text-purple-400">{gemBalance.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex-1 min-h-0 p-4 overflow-hidden">
                <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
                  <div className="flex flex-col gap-2 min-h-0">
                    <div className="flex-1 min-h-0 rounded-xl overflow-hidden bg-white/5 backdrop-blur-md flex items-center justify-center">
                      {hasModel ? (
                        <Model3DPreview 
                          itemId={item.id} 
                          size={280} 
                          autoRotate={selectedImageIndex === 0}
                          interactive={true}
                        />
                      ) : (
                        <div className="w-48 h-48 flex items-center justify-center">
                          <Icon className="w-24 h-24 text-primary opacity-50" />
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 flex-shrink-0">
                      {[0, 1, 2].map((index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedImageIndex(index)}
                          className={`aspect-square rounded-lg overflow-hidden bg-white/5 backdrop-blur-md flex items-center justify-center transition-all ${
                            selectedImageIndex === index 
                              ? 'ring-2 ring-primary' 
                              : 'hover:bg-white/10'
                          }`}
                        >
                          {hasModel ? (
                            <Model3DPreview 
                              itemId={item.id} 
                              size={80} 
                              autoRotate={false}
                              interactive={false}
                            />
                          ) : (
                            <Icon className="w-6 h-6 text-primary opacity-40" />
                          )}
                        </button>
                      ))}
                    </div>

                    {hasModel && (
                      <p className="text-center text-xs text-muted-foreground flex-shrink-0">
                        {t('shop.dragToRotate', '드래그하여 360° 회전')}
                      </p>
                    )}
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-4">
                      <h1 className="text-2xl font-bold text-foreground">
                        {t(item.nameKey)}
                      </h1>
                      <div className="space-y-1">
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {t('shop.itemCategory', '아이템 분류')}
                        </h3>
                        <p className="text-sm text-foreground">
                          {TYPE_LABELS[item.type] || item.type}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {t('shop.selectOption', '옵션 선택')}
                      </h3>
                      <div className="space-y-2">
                        {priceOptions.map((option, index) => {
                          const optStatus = getOptionStatus(option.duration);
                          return (
                          <button
                            key={index}
                            onClick={() => setSelectedOptionIndex(index)}
                            className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition-all ${
                              selectedOptionIndex === index
                                ? 'bg-primary/20 ring-2 ring-primary'
                                : optStatus === 'owned' 
                                  ? 'bg-green-900/20 border border-green-800'
                                  : optStatus === 'pending'
                                    ? 'bg-purple-900/20 border border-purple-800'
                                    : 'bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {optStatus === 'owned' ? (
                                <Check className="w-4 h-4 text-green-400" />
                              ) : optStatus === 'pending' ? (
                                <Clock className="w-4 h-4 text-purple-400" />
                              ) : optStatus === 'upgrade' ? (
                                <ArrowUp className="w-4 h-4 text-blue-400" />
                              ) : optStatus === 'downgrade' ? (
                                <ArrowDown className="w-4 h-4 text-orange-400" />
                              ) : (
                                <Clock className="w-4 h-4 text-muted-foreground" />
                              )}
                              <span className="text-sm font-medium text-foreground">{t(option.labelKey)}</span>
                              {optStatus === 'owned' && (
                                <span className="text-xs text-green-400 ml-1">({t('shop.currentPlan', '현재 보유')})</span>
                              )}
                              {optStatus === 'pending' && (
                                <span className="text-xs text-purple-400 ml-1">({t('shop.pendingPlan', '예약됨')})</span>
                              )}
                              {optStatus === 'upgrade' && (
                                <span className="text-xs text-blue-400 ml-1">({t('shop.upgrade', '업그레이드')})</span>
                              )}
                              {optStatus === 'downgrade' && (
                                <span className="text-xs text-orange-400 ml-1">({t('shop.downgrade', '다운그레이드')})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-purple-400">
                              <Gem className="w-4 h-4" />
                              <span className="text-lg font-bold">{option.price.toLocaleString()}</span>
                            </div>
                          </button>
                        );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {t('shop.description', '설명')}
                      </h3>
                      <p className="text-sm text-foreground leading-relaxed">
                        {t(item.descriptionKey)}
                      </p>
                    </div>

                    {owned && remainingTime && (
                      <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-800 rounded-lg">
                        <Check className="w-5 h-5 text-green-400" />
                        <span className="text-green-400 font-medium">{t('shop.alreadyOwned')}</span>
                        <span className="text-yellow-400 text-sm ml-2">({remainingTime})</span>
                      </div>
                    )}
                    
                    {(selectedStatus === 'upgrade' || selectedStatus === 'downgrade') && remainingTime && (
                      <div className={`flex items-center gap-2 p-3 rounded-lg ${
                        selectedStatus === 'upgrade' 
                          ? 'bg-blue-900/20 border border-blue-800' 
                          : 'bg-orange-900/20 border border-orange-800'
                      }`}>
                        {selectedStatus === 'upgrade' ? (
                          <ArrowUp className="w-5 h-5 text-blue-400" />
                        ) : (
                          <ArrowDown className="w-5 h-5 text-orange-400" />
                        )}
                        <span className={selectedStatus === 'upgrade' ? 'text-blue-400' : 'text-orange-400'}>
                          {selectedStatus === 'upgrade' 
                            ? t('shop.upgradeInfo', '현재 아이템 만료 후 업그레이드 옵션이 적용됩니다')
                            : t('shop.downgradeInfo', '현재 아이템 만료 후 다운그레이드 옵션이 적용됩니다')}
                        </span>
                      </div>
                    )}

                    <div className="pt-4 space-y-4">
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          className="flex-1 h-11 gap-2 border-0 bg-white/5"
                          onClick={handleGift}
                          disabled={selectedStatus === 'owned'}
                          data-testid="gift-button"
                        >
                          <Gift className="w-4 h-4" />
                          {t('shop.gift', '선물하기')}
                        </Button>
                        <Button
                          className={`flex-1 h-11 gap-2 ${
                            selectedStatus === 'upgrade' ? 'bg-blue-600 hover:bg-blue-700' :
                            selectedStatus === 'downgrade' ? 'bg-orange-600 hover:bg-orange-700' :
                            selectedStatus === 'pending' ? 'bg-purple-600 hover:bg-purple-700' : ''
                          }`}
                          disabled={selectedStatus === 'owned' || selectedStatus === 'pending' || selectedStatus === 'blocked' || !canAfford || isPurchasing}
                          onClick={handlePurchase}
                          data-testid="purchase-button"
                        >
                          {isPurchasing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {t('shop.purchasing', '구매 중...')}
                            </>
                          ) : selectedStatus === 'owned' ? (
                            t('shop.alreadyOwned')
                          ) : selectedStatus === 'pending' ? (
                            t('shop.alreadyPending', '이미 예약됨')
                          ) : selectedStatus === 'blocked' ? (
                            isPermanentItem 
                              ? t('shop.permanentItem', '영구 아이템 변경 불가')
                              : t('shop.pendingExists', '예약된 변경이 있음')
                          ) : !canAfford ? (
                            t('shop.insufficientGems', 'Insufficient Gems')
                          ) : selectedStatus === 'upgrade' ? (
                            <>
                              <ArrowUp className="w-4 h-4" />
                              {t('shop.upgradeButton', '업그레이드 예약')}
                            </>
                          ) : selectedStatus === 'downgrade' ? (
                            <>
                              <ArrowDown className="w-4 h-4" />
                              {t('shop.downgradeButton', '다운그레이드 예약')}
                            </>
                          ) : (
                            <>
                              <Gem className="w-4 h-4" />
                              {t('shop.purchase')}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
