import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Header } from '@/components/Header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSidebar } from '@/contexts/SidebarContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { useAuth } from '@/hooks/use-auth';
import { Box, Shield, ShoppingCart, Gem, Dog, Sparkles, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ShopItem } from '@shared/shop';
import { isItemExpired } from '@shared/shop';
import type { UserInventory, PlayerProgression } from '@shared/schema';
import { ShopItemCard } from '@/components/shop/ShopItemCard';

export default function Shop() {
  const { t } = useTranslation();
  const { expanded, notificationOpen, languageOpen, profileOpen } = useSidebar();
  const anyPanelOpen = notificationOpen || languageOpen || profileOpen;
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { navigateTo } = useNavigation();
  const [sortBy, setSortBy] = useState<'price' | 'name'>('price');
  const [sortAsc, setSortAsc] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSortChange = (value: string) => {
    setSortBy(value as 'price' | 'name');
  };

  const toggleSortDirection = () => {
    setSortAsc(!sortAsc);
  };


  const { data: shopData } = useQuery<{ items: ShopItem[] }>({
    queryKey: ['/api/shop/items'],
  });

  const { data: inventoryData } = useQuery<{ inventory: UserInventory[] }>({
    queryKey: ['/api/shop/inventory'],
    enabled: isAuthenticated,
  });

  const { data: progressionData } = useQuery<PlayerProgression>({
    queryKey: ['/api/ranked/progression'],
    enabled: isAuthenticated,
  });

  const getOwnedItem = (itemId: string) => {
    return inventoryData?.inventory.find(inv => inv.itemType === itemId && inv.quantity > 0);
  };

  const isOwned = (itemId: string) => {
    const item = getOwnedItem(itemId);
    if (!item) return false;
    const expiryDate = item.expiresAt ? new Date(item.expiresAt) : null;
    return !isItemExpired(expiryDate);
  };

  
  const gemBalance = progressionData?.gemBalance ?? 0;
  const items = shopData?.items ?? [];
  
  const filterAndSortItems = (itemList: ShopItem[]) => {
    let filtered = itemList;
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = itemList.filter(item => 
        t(item.nameKey).toLowerCase().includes(query)
      );
    }
    return [...filtered].sort((a, b) => {
      let result: number;
      if (sortBy === 'price') {
        result = a.price - b.price;
      } else {
        result = t(a.nameKey).localeCompare(t(b.nameKey), 'ko');
      }
      return sortAsc ? result : -result;
    });
  };
  
  const blockItems = filterAndSortItems(items.filter(item => item.type === 'block'));
  const badgeItems = filterAndSortItems(items.filter(item => item.type === 'badge'));
  const petItems = filterAndSortItems(items.filter(item => item.type === 'pet'));
  const floorItems = filterAndSortItems(items.filter(item => item.type === 'floor'));
  const boardItems = filterAndSortItems(items.filter(item => item.type === 'board'));
  const decorationItems = filterAndSortItems(items.filter(item => item.type === 'decoration'));

  const renderItemGrid = (itemList: ShopItem[], fallbackIcon: React.ReactNode) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
      {itemList.map((item) => (
        <ShopItemCard
          key={item.id}
          item={item}
          owned={isOwned(item.id)}
          onClick={() => navigateTo('product-detail', { itemId: item.id })}
          fallbackIcon={fallbackIcon}
        />
      ))}
    </div>
  );

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
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-6 h-6 text-primary" />
                <h1 className="text-xl font-bold">{t('nav.shop')}</h1>
              </div>
              <div className="flex items-center gap-3 bg-purple-900/30 px-4 py-2 rounded-lg border border-purple-700/50">
                <Gem className="w-4 h-4 text-purple-400" />
                <span className="text-lg font-bold text-purple-400">{gemBalance.toLocaleString()}</span>
              </div>
            </div>

            <div className="p-4 space-y-3 flex-1 flex flex-col">
              <Tabs defaultValue="blocks" className="w-full flex-1 flex flex-col">
                <TabsList className="inline-flex h-9 items-center justify-center rounded-lg bg-white/5 p-1 text-muted-foreground gap-1">
                  <TabsTrigger value="blocks" className="gap-2 text-xs" data-testid="tab-blocks">
                    <Box className="w-3.5 h-3.5" />
                    {t('shop.blocks', '블럭')}
                  </TabsTrigger>
                  <TabsTrigger value="floors" className="gap-2 text-xs" data-testid="tab-floors">
                    <Box className="w-3.5 h-3.5" />
                    {t('shop.floors', '바닥')}
                  </TabsTrigger>
                  <TabsTrigger value="boards" className="gap-2 text-xs" data-testid="tab-boards">
                    <Box className="w-3.5 h-3.5" />
                    {t('shop.boards', '게임판')}
                  </TabsTrigger>
                  <TabsTrigger value="decorations" className="gap-2 text-xs" data-testid="tab-decorations">
                    <Sparkles className="w-3.5 h-3.5" />
                    {t('shop.decorations', '장식')}
                  </TabsTrigger>
                  <TabsTrigger value="badges" className="gap-2 text-xs" data-testid="tab-badges">
                    <Shield className="w-3.5 h-3.5" />
                    {t('shop.badges', '뱃지')}
                  </TabsTrigger>
                  <TabsTrigger value="pets" className="gap-2 text-xs" data-testid="tab-pets">
                    <Dog className="w-3.5 h-3.5" />
                    {t('shop.pets', '펫')}
                  </TabsTrigger>
                </TabsList>

                <div className="flex items-center justify-between gap-4 mt-3">
                  <div className="flex items-center gap-2">
                    <Select value={sortBy} onValueChange={handleSortChange}>
                      <SelectTrigger className="w-[120px] h-8 bg-white/5 border-0" data-testid="sort-dropdown">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="price" data-testid="sort-price">
                          {t('shop.sortPrice', '가격순')}
                        </SelectItem>
                        <SelectItem value="name" data-testid="sort-name">
                          {t('shop.sortName', '이름순')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleSortDirection}
                      data-testid="sort-direction-toggle"
                      className="h-8 w-8"
                    >
                      {sortAsc ? (
                        <ArrowUp className="w-4 h-4" />
                      ) : (
                        <ArrowDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder={t('shop.searchPlaceholder', '아이템 검색...')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-[180px] h-8 bg-white/5 border-0"
                      data-testid="search-input"
                    />
                  </div>
                </div>

                <ScrollArea className="flex-1 mt-4" style={{ height: 'calc(100vh - 280px)' }}>
                  <TabsContent value="blocks" className="mt-0 pr-4">
                    {renderItemGrid(blockItems, <Box className="w-12 h-12 text-primary" />)}
                  </TabsContent>

                  <TabsContent value="floors" className="mt-0 pr-4">
                    {renderItemGrid(floorItems, <Box className="w-12 h-12 text-cyan-400" />)}
                  </TabsContent>

                  <TabsContent value="boards" className="mt-0 pr-4">
                    {renderItemGrid(boardItems, <Box className="w-12 h-12 text-violet-400" />)}
                  </TabsContent>

                  <TabsContent value="decorations" className="mt-0 pr-4">
                    {renderItemGrid(decorationItems, <Sparkles className="w-12 h-12 text-emerald-400" />)}
                  </TabsContent>

                  <TabsContent value="badges" className="mt-0 pr-4">
                    {renderItemGrid(badgeItems, <Shield className="w-12 h-12 text-primary" />)}
                  </TabsContent>

                  <TabsContent value="pets" className="mt-0 pr-4">
                    {renderItemGrid(petItems, <Dog className="w-12 h-12 text-amber-500" />)}
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
