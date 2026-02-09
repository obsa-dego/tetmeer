import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ShoppingCart, Search, RefreshCw, Edit, Trash2, Package, Plus, RotateCcw, X, Clock } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Model3DPreview, hasGLBModel } from "@/components/shop/Model3DPreview";
import { Model3DCustomizer, isBlockModel, DEFAULT_SETTINGS, DEFAULT_BLOCK_COLORS, type MaterialSettings } from "@/components/shop/Model3DCustomizer";
import { SHOP_ITEMS, type ShopItem, DURATION_CONFIGS, type ShopItemDuration, DEFAULT_SHOP_DURATION } from "@shared/shop";

interface AdminShopProps {
  isAdmin: boolean;
}

export default function AdminShop({ isAdmin }: AdminShopProps) {
  const { toast } = useToast();
  const { t } = useTranslation();

  // Shop state
  const [shopCategoryFilter, setShopCategoryFilter] = useState("all");
  const [shopSearchQuery, setShopSearchQuery] = useState("");
  const [editingShopItem, setEditingShopItem] = useState<any | null>(null);
  const [shopItemEdit, setShopItemEdit] = useState({ priceOverride: 0, isDisabled: false, discountPercent: 0 });
  const [materialSettings, setMaterialSettings] = useState<MaterialSettings>(DEFAULT_SETTINGS);
  const [editingItemPriceOptions, setEditingItemPriceOptions] = useState<{duration: ShopItemDuration; price: number; isDefault: boolean}[]>([]);

  // Custom shop items state
  const [showCreateItemDialog, setShowCreateItemDialog] = useState(false);
  const [editingCustomItem, setEditingCustomItem] = useState<any | null>(null);
  const [customItemForm, setCustomItemForm] = useState({
    type: "block",
    nameKey: "",
    descriptionKey: "",
    modelUrl: "",
    thumbnailUrl: "",
    isActive: true,
    sortOrder: 0,
    priceOptions: [{ duration: "one_week" as ShopItemDuration, price: 100, isDefault: true }],
  });
  const [isUploadingModel, setIsUploadingModel] = useState(false);

  // Scheduled actions state
  const [scheduledActionsFilter, setScheduledActionsFilter] = useState("pending");
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);

  // Unified shop items state (i18n support)
  const [unifiedItemsLocale, setUnifiedItemsLocale] = useState("en");
  const [unifiedItemsSearch, setUnifiedItemsSearch] = useState("");
  const [unifiedItemsType, setUnifiedItemsType] = useState("all");
  const [editingUnifiedItem, setEditingUnifiedItem] = useState<any | null>(null);
  const [showCreateUnifiedItem, setShowCreateUnifiedItem] = useState(false);
  const [unifiedItemForm, setUnifiedItemForm] = useState({
    id: "",
    type: "block",
    basePrice: 100,
    isActive: true,
    isPremiumOnly: false,
    translations: {} as Record<string, { name: string; description: string }>,
  });

  // Unified item edit state for price options and scheduling
  const [unifiedItemPriceOptions, setUnifiedItemPriceOptions] = useState<{duration: ShopItemDuration; price: number; isDefault: boolean}[]>([]);
  const [enableUnifiedEditSchedule, setEnableUnifiedEditSchedule] = useState(false);
  const [unifiedEditScheduleTime, setUnifiedEditScheduleTime] = useState("");
  const [scheduleActionForm, setScheduleActionForm] = useState({
    actionType: "create" as "create" | "update" | "delete",
    targetItemId: "",
    isCustomItem: false,
    scheduledAt: "",
    actionData: {} as any,
  });

  // Schedule time for inline scheduling in create/edit dialogs
  const [createScheduleTime, setCreateScheduleTime] = useState("");
  const [editScheduleTime, setEditScheduleTime] = useState("");
  const [enableCreateSchedule, setEnableCreateSchedule] = useState(false);
  const [enableEditSchedule, setEnableEditSchedule] = useState(false);

  // Group shop items by type for dropdown
  const shopItemsByType = SHOP_ITEMS.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, ShopItem[]>);

  // Get item name from translation key
  const getItemDisplayName = (item: ShopItem) => {
    const name = t(item.nameKey, item.nameKey.split('.').pop() || item.id);
    return `${name} (${item.price} Gem)`;
  };

  const parseMaterialSettings = useCallback((jsonStr: string | null): MaterialSettings => {
    if (!jsonStr) return { ...DEFAULT_SETTINGS, blockColors: { ...DEFAULT_BLOCK_COLORS } };
    try {
      const parsed = JSON.parse(jsonStr);
      // Handle backward compatibility: if old format with single 'color', convert to blockColors
      let blockColors = parsed.blockColors;
      if (!blockColors) {
        // Old format - apply single color to all shapes for backward compatibility
        const singleColor = parsed.color || '#ffffff';
        blockColors = {
          I: singleColor,
          O: singleColor,
          T: singleColor,
          S: singleColor,
          Z: singleColor,
          J: singleColor,
          L: singleColor,
        };
      } else {
        // Ensure all shapes have colors (merge with defaults)
        blockColors = { ...DEFAULT_BLOCK_COLORS, ...blockColors };
      }
      return {
        blockColors,
        metalness: parsed.metalness ?? DEFAULT_SETTINGS.metalness,
        roughness: parsed.roughness ?? DEFAULT_SETTINGS.roughness,
        opacity: parsed.opacity ?? DEFAULT_SETTINGS.opacity,
        emissive: parsed.emissive || DEFAULT_SETTINGS.emissive,
        emissiveIntensity: parsed.emissiveIntensity ?? DEFAULT_SETTINGS.emissiveIntensity,
      };
    } catch {
      return { ...DEFAULT_SETTINGS, blockColors: { ...DEFAULT_BLOCK_COLORS } };
    }
  }, []);

  useEffect(() => {
    if (editingShopItem) {
      const settings = parseMaterialSettings(editingShopItem.materialSettings);
      setMaterialSettings(settings);
      // Load price options for existing item
      fetch(`/api/admin/shop/price-options/${editingShopItem.id}?isCustom=false`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.options && data.options.length > 0) {
            setEditingItemPriceOptions(data.options.map((o: any) => ({
              duration: o.duration as ShopItemDuration,
              price: o.price,
              isDefault: o.isDefault,
            })));
          } else {
            // Default to item's original price/duration
            setEditingItemPriceOptions([{
              duration: editingShopItem.duration || 'one_week',
              price: editingShopItem.originalPrice || editingShopItem.price,
              isDefault: true,
            }]);
          }
        })
        .catch(() => {
          setEditingItemPriceOptions([{
            duration: editingShopItem.duration || 'one_week',
            price: editingShopItem.originalPrice || editingShopItem.price,
            isDefault: true,
          }]);
        });
    } else {
      setEditingItemPriceOptions([]);
    }
  }, [editingShopItem, parseMaterialSettings]);

  // Queries
  const { data: shopData, refetch: refetchShop } = useQuery<{ items: any[]; total: number; types: string[] }>({
    queryKey: ["/api/admin/shop/items", { type: shopCategoryFilter, search: shopSearchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (shopCategoryFilter && shopCategoryFilter !== "all") params.set("type", shopCategoryFilter);
      if (shopSearchQuery) params.set("search", shopSearchQuery);
      const res = await fetch(`/api/admin/shop/items?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch shop items");
      return res.json();
    },
    enabled: isAdmin,
  });

  const { data: customItemsData, refetch: refetchCustomItems } = useQuery<{ items: any[]; total: number }>({
    queryKey: ["/api/admin/shop/custom-items", { includeInactive: true }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/shop/custom-items?includeInactive=true`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch custom items");
      return res.json();
    },
    enabled: isAdmin,
  });

  const { data: scheduledActionsData, refetch: refetchScheduledActions } = useQuery<{ actions: any[]; total: number }>({
    queryKey: ["/api/admin/shop/scheduled-actions", { status: scheduledActionsFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (scheduledActionsFilter && scheduledActionsFilter !== "all") params.set("status", scheduledActionsFilter);
      const res = await fetch(`/api/admin/shop/scheduled-actions?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch scheduled actions");
      return res.json();
    },
    enabled: isAdmin,
  });

  // Unified shop items with i18n support
  const { data: unifiedItemsData, refetch: refetchUnifiedItems } = useQuery<{ items: any[]; supportedLocales: string[] }>({
    queryKey: ["/api/admin/shop/unified-items", { locale: unifiedItemsLocale, type: unifiedItemsType, search: unifiedItemsSearch }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("locale", unifiedItemsLocale);
      if (unifiedItemsType && unifiedItemsType !== "all") params.set("type", unifiedItemsType);
      if (unifiedItemsSearch) params.set("search", unifiedItemsSearch);
      const res = await fetch(`/api/admin/shop/unified-items?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch unified items");
      return res.json();
    },
    enabled: isAdmin,
  });

  // Mutations
  const updateShopItemMutation = useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: string; updates: any }) => {
      return apiRequest("PUT", `/api/admin/shop/items/${itemId}`, updates);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Shop item updated" });
      refetchShop();
      setEditingShopItem(null);
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const resetShopItemMutation = useMutation({
    mutationFn: async (itemId: string) => apiRequest("DELETE", `/api/admin/shop/items/${itemId}`),
    onSuccess: () => {
      toast({ title: "Success", description: "Shop item reset to default" });
      refetchShop();
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const createCustomItemMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", `/api/admin/shop/custom-items`, data),
    onSuccess: () => {
      toast({ title: "Success", description: "Custom item created" });
      refetchCustomItems();
      setShowCreateItemDialog(false);
      setCustomItemForm({
        type: "block",
        nameKey: "",
        descriptionKey: "",
        modelUrl: "",
        thumbnailUrl: "",
        isActive: true,
        sortOrder: 0,
        priceOptions: [{ duration: "one_week" as ShopItemDuration, price: 100, isDefault: true }],
      });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateCustomItemMutation = useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: string; updates: any }) => {
      return apiRequest("PUT", `/api/admin/shop/custom-items/${itemId}`, updates);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Custom item updated" });
      refetchCustomItems();
      setEditingCustomItem(null);
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteCustomItemMutation = useMutation({
    mutationFn: async (itemId: string) => apiRequest("DELETE", `/api/admin/shop/custom-items/${itemId}`),
    onSuccess: () => {
      toast({ title: "Success", description: "Custom item deleted" });
      refetchCustomItems();
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updatePriceOptionsMutation = useMutation({
    mutationFn: async ({ itemId, isCustomItem, options }: { itemId: string; isCustomItem: boolean; options: any[] }) => {
      return apiRequest("PUT", `/api/admin/shop/price-options/${itemId}`, { isCustomItem, options });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Price options updated" });
      refetchShop();
      refetchCustomItems();
      refetchUnifiedItems();
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  // Unified item mutations
  const createUnifiedItemMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", `/api/admin/shop/unified-items`, data),
    onSuccess: () => {
      toast({ title: "Success", description: "Item created" });
      refetchUnifiedItems();
      setShowCreateUnifiedItem(false);
      setUnifiedItemForm({ id: "", type: "block", basePrice: 100, isActive: true, isPremiumOnly: false, translations: {} });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateUnifiedItemMutation = useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: string; updates: any }) => {
      return apiRequest("PUT", `/api/admin/shop/unified-items/${itemId}`, updates);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Item updated" });
      refetchUnifiedItems();
      setEditingUnifiedItem(null);
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  return (
    <>
      {/* Unified Items with i18n Support */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Unified Items (i18n)
          </CardTitle>
          <CardDescription>Manage all shop items with multi-language support</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-[300px]">
              <Input
                placeholder="Search items..."
                value={unifiedItemsSearch}
                onChange={(e) => setUnifiedItemsSearch(e.target.value)}
                className="h-9"
                data-testid="input-unified-search"
              />
              {unifiedItemsSearch && (
                <Button variant="ghost" size="icon" onClick={() => setUnifiedItemsSearch("")}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            <Select value={unifiedItemsLocale} onValueChange={setUnifiedItemsLocale}>
              <SelectTrigger className="w-[120px]" data-testid="select-unified-locale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(unifiedItemsData?.supportedLocales || ["en", "ko", "ja", "de", "es", "fr"]).map(locale => (
                  <SelectItem key={locale} value={locale}>{locale.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={unifiedItemsType} onValueChange={setUnifiedItemsType}>
              <SelectTrigger className="w-[120px]" data-testid="select-unified-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="block">Block</SelectItem>
                <SelectItem value="badge">Badge</SelectItem>
                <SelectItem value="pet">Pet</SelectItem>
                <SelectItem value="floor">Floor</SelectItem>
                <SelectItem value="board">Board</SelectItem>
                <SelectItem value="decoration">Decoration</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon" onClick={() => refetchUnifiedItems()} data-testid="button-refresh-unified">
              <RefreshCw className="w-4 h-4" />
            </Button>

            <Badge variant="outline">{unifiedItemsData?.items?.length || 0} items</Badge>

            <Button size="sm" onClick={() => setShowCreateUnifiedItem(true)} data-testid="button-add-unified-item">
              <Plus className="w-4 h-4 mr-1" /> Add Item
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name ({unifiedItemsLocale.toUpperCase()})</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Translations</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(unifiedItemsData?.items || []).slice(0, 20).map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">{item.description}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{item.type}</Badge></TableCell>
                    <TableCell>{item.basePrice.toLocaleString()} Gem</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(unifiedItemsData?.supportedLocales || []).map((loc: string) => (
                          <span
                            key={loc}
                            className={`text-xs px-1 rounded ${item.translationCompleteness?.[loc] ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}
                          >
                            {loc}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.isActive ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="destructive">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          setEditingUnifiedItem(item);
                          setEnableUnifiedEditSchedule(false);
                          setUnifiedEditScheduleTime("");
                          try {
                            const res = await fetch(`/api/admin/shop/price-options/${item.id}?isCustom=false`, { credentials: "include" });
                            if (res.ok) {
                              const data = await res.json();
                              if (data.options && data.options.length > 0) {
                                setUnifiedItemPriceOptions(data.options);
                              } else {
                                setUnifiedItemPriceOptions([{ duration: DEFAULT_SHOP_DURATION, price: item.basePrice, isDefault: true }]);
                              }
                            } else {
                              setUnifiedItemPriceOptions([{ duration: DEFAULT_SHOP_DURATION, price: item.basePrice, isDefault: true }]);
                            }
                          } catch {
                            setUnifiedItemPriceOptions([{ duration: DEFAULT_SHOP_DURATION, price: item.basePrice, isDefault: true }]);
                          }
                        }}
                        data-testid={`button-edit-unified-${item.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {(unifiedItemsData?.items?.length || 0) > 20 && (
            <p className="text-sm text-muted-foreground mt-2">Showing 20 of {unifiedItemsData?.items?.length} items. Use search to find specific items.</p>
          )}
        </CardContent>
      </Card>

      {/* Unified Item Edit Dialog */}
      <Dialog open={!!editingUnifiedItem} onOpenChange={() => setEditingUnifiedItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Item: {editingUnifiedItem?.id}</DialogTitle>
            <DialogDescription>Edit item properties and translations</DialogDescription>
          </DialogHeader>
          {editingUnifiedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select
                    value={editingUnifiedItem.type}
                    onValueChange={(v) => setEditingUnifiedItem({...editingUnifiedItem, type: v})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="block">Block</SelectItem>
                      <SelectItem value="badge">Badge</SelectItem>
                      <SelectItem value="pet">Pet</SelectItem>
                      <SelectItem value="floor">Floor</SelectItem>
                      <SelectItem value="board">Board</SelectItem>
                      <SelectItem value="decoration">Decoration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Base Price (Gem)</Label>
                  <Input
                    type="number"
                    value={editingUnifiedItem.basePrice}
                    onChange={(e) => setEditingUnifiedItem({...editingUnifiedItem, basePrice: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingUnifiedItem.isActive}
                    onChange={(e) => setEditingUnifiedItem({...editingUnifiedItem, isActive: e.target.checked})}
                  />
                  Active
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingUnifiedItem.isPremiumOnly}
                    onChange={(e) => setEditingUnifiedItem({...editingUnifiedItem, isPremiumOnly: e.target.checked})}
                  />
                  Premium Only
                </label>
              </div>

              <div className="border-t pt-4">
                <Label className="text-base font-semibold">Translations</Label>
                <p className="text-sm text-muted-foreground mb-3">Edit name and description for each language</p>

                <Tabs defaultValue="en" className="w-full">
                  <TabsList className="mb-2 flex-wrap h-auto gap-1">
                    {(unifiedItemsData?.supportedLocales || ["en", "ko", "ja", "de", "es", "fr"]).map((loc: string) => (
                      <TabsTrigger key={loc} value={loc} className="relative">
                        {loc.toUpperCase()}
                        {editingUnifiedItem.translations?.[loc] && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></span>
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {(unifiedItemsData?.supportedLocales || ["en", "ko", "ja", "de", "es", "fr"]).map((loc: string) => (
                    <TabsContent key={loc} value={loc} className="space-y-3">
                      <div>
                        <Label>Name ({loc.toUpperCase()})</Label>
                        <Input
                          value={editingUnifiedItem.translations?.[loc]?.name || ""}
                          onChange={(e) => setEditingUnifiedItem({
                            ...editingUnifiedItem,
                            translations: {
                              ...editingUnifiedItem.translations,
                              [loc]: { ...editingUnifiedItem.translations?.[loc], name: e.target.value }
                            }
                          })}
                          placeholder={`Name in ${loc.toUpperCase()}`}
                        />
                      </div>
                      <div>
                        <Label>Description ({loc.toUpperCase()})</Label>
                        <Textarea
                          value={editingUnifiedItem.translations?.[loc]?.description || ""}
                          onChange={(e) => setEditingUnifiedItem({
                            ...editingUnifiedItem,
                            translations: {
                              ...editingUnifiedItem.translations,
                              [loc]: { ...editingUnifiedItem.translations?.[loc], description: e.target.value }
                            }
                          })}
                          placeholder={`Description in ${loc.toUpperCase()}`}
                          rows={2}
                        />
                      </div>
                      {loc !== "en" && editingUnifiedItem.translations?.en && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingUnifiedItem({
                            ...editingUnifiedItem,
                            translations: {
                              ...editingUnifiedItem.translations,
                              [loc]: { ...editingUnifiedItem.translations?.en }
                            }
                          })}
                        >
                          Copy from EN
                        </Button>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              {/* Price Options Section */}
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label>Price Options (Duration/Price)</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const usedDurations = unifiedItemPriceOptions.map(o => o.duration);
                      const availableDuration = Object.keys(DURATION_CONFIGS).find(d => !usedDurations.includes(d as ShopItemDuration)) as ShopItemDuration | undefined;
                      if (availableDuration) {
                        setUnifiedItemPriceOptions([...unifiedItemPriceOptions, { duration: availableDuration, price: 100, isDefault: false }]);
                      } else {
                        toast({ title: "All duration options are already used", variant: "destructive" });
                      }
                    }}
                    disabled={unifiedItemPriceOptions.length >= Object.keys(DURATION_CONFIGS).length}
                    data-testid="button-add-unified-price-option"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Option
                  </Button>
                </div>
                <div className="space-y-2">
                  {unifiedItemPriceOptions.map((opt, idx) => {
                    const usedDurations = unifiedItemPriceOptions.filter((_, i) => i !== idx).map(o => o.duration);
                    return (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <Select
                        value={opt.duration}
                        onValueChange={(v) => {
                          const newOpts = [...unifiedItemPriceOptions];
                          newOpts[idx].duration = v as ShopItemDuration;
                          setUnifiedItemPriceOptions(newOpts);
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(DURATION_CONFIGS).map(d => (
                            <SelectItem
                              key={d}
                              value={d}
                              disabled={usedDurations.includes(d as ShopItemDuration)}
                            >
                              {d.replace(/_/g, ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={opt.price}
                        onChange={(e) => {
                          const newOpts = [...unifiedItemPriceOptions];
                          newOpts[idx].price = parseInt(e.target.value) || 0;
                          setUnifiedItemPriceOptions(newOpts);
                        }}
                        className="w-24"
                        placeholder="Price"
                      />
                      <span className="text-sm text-muted-foreground">Gem</span>
                      <Button
                        variant={opt.isDefault ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          const newOpts = unifiedItemPriceOptions.map((o, i) => ({...o, isDefault: i === idx}));
                          setUnifiedItemPriceOptions(newOpts);
                        }}
                      >
                        Default
                      </Button>
                      {unifiedItemPriceOptions.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newOpts = unifiedItemPriceOptions.filter((_, i) => i !== idx);
                            if (newOpts.length > 0 && !newOpts.some(o => o.isDefault)) {
                              newOpts[0].isDefault = true;
                            }
                            setUnifiedItemPriceOptions(newOpts);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  );
                  })}
                </div>
              </div>

              {/* Schedule for later */}
              <div className="border-t pt-4 mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="enable-unified-edit-schedule"
                    checked={enableUnifiedEditSchedule}
                    onChange={(e) => {
                      setEnableUnifiedEditSchedule(e.target.checked);
                      if (!e.target.checked) setUnifiedEditScheduleTime("");
                    }}
                    data-testid="checkbox-enable-unified-edit-schedule"
                  />
                  <label htmlFor="enable-unified-edit-schedule" className="text-sm font-medium">Schedule for later</label>
                </div>
                {enableUnifiedEditSchedule && (
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={unifiedEditScheduleTime.split("T")[0] || ""}
                      onChange={(e) => {
                        const time = unifiedEditScheduleTime.split("T")[1] || "12:00";
                        setUnifiedEditScheduleTime(e.target.value + "T" + time);
                      }}
                      className="flex-1"
                      data-testid="input-unified-edit-schedule-date"
                    />
                    <Input
                      type="time"
                      value={unifiedEditScheduleTime.split("T")[1] || ""}
                      onChange={(e) => {
                        const date = unifiedEditScheduleTime.split("T")[0] || new Date().toISOString().split("T")[0];
                        setUnifiedEditScheduleTime(date + "T" + e.target.value);
                      }}
                      className="w-32"
                      data-testid="input-unified-edit-schedule-time"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t">
                {enableUnifiedEditSchedule ? (
                  <Button
                    className="flex-1"
                    onClick={async () => {
                      try {
                        const updates = {
                          type: editingUnifiedItem.type,
                          basePrice: editingUnifiedItem.basePrice,
                          isActive: editingUnifiedItem.isActive,
                          isPremiumOnly: editingUnifiedItem.isPremiumOnly,
                          translations: editingUnifiedItem.translations,
                          priceOptions: unifiedItemPriceOptions,
                        };
                        await apiRequest("POST", "/api/admin/shop/scheduled-actions", {
                          actionType: "update",
                          targetItemId: editingUnifiedItem.id,
                          isCustomItem: false,
                          scheduledAt: new Date(unifiedEditScheduleTime).toISOString(),
                          actionData: updates,
                        });
                        toast({ title: "Update scheduled" });
                        setUnifiedEditScheduleTime("");
                        setEnableUnifiedEditSchedule(false);
                        setEditingUnifiedItem(null);
                        queryClient.invalidateQueries({ queryKey: ["/api/admin/shop/scheduled-actions"] });
                      } catch (error: any) {
                        toast({ title: "Failed to schedule", description: error.message, variant: "destructive" });
                      }
                    }}
                    disabled={!unifiedEditScheduleTime}
                    data-testid="button-schedule-unified-update"
                  >
                    <Clock className="w-4 h-4 mr-1" />
                    Schedule Update
                  </Button>
                ) : (
                  <Button
                    className="flex-1"
                    onClick={async () => {
                      if (unifiedItemPriceOptions.length > 0) {
                        await updatePriceOptionsMutation.mutateAsync({
                          itemId: editingUnifiedItem.id,
                          isCustomItem: false,
                          options: unifiedItemPriceOptions,
                        });
                      }
                      updateUnifiedItemMutation.mutate({
                        itemId: editingUnifiedItem.id,
                        updates: {
                          type: editingUnifiedItem.type,
                          basePrice: editingUnifiedItem.basePrice,
                          isActive: editingUnifiedItem.isActive,
                          isPremiumOnly: editingUnifiedItem.isPremiumOnly,
                          translations: editingUnifiedItem.translations,
                        }
                      });
                    }}
                    disabled={updateUnifiedItemMutation.isPending || updatePriceOptionsMutation.isPending}
                    data-testid="button-save-unified-item"
                  >
                    {(updateUnifiedItemMutation.isPending || updatePriceOptionsMutation.isPending) ? "Saving..." : "Save Changes"}
                  </Button>
                )}
                <Button variant="outline" onClick={() => {
                  setEditingUnifiedItem(null);
                  setUnifiedEditScheduleTime("");
                  setEnableUnifiedEditSchedule(false);
                }}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Unified Item Dialog */}
      <Dialog open={showCreateUnifiedItem} onOpenChange={setShowCreateUnifiedItem}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Item</DialogTitle>
            <DialogDescription>Add a new shop item with translations</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Item ID</Label>
                <Input
                  value={unifiedItemForm.id}
                  onChange={(e) => setUnifiedItemForm({...unifiedItemForm, id: e.target.value})}
                  placeholder="e.g., block_crystal_blue"
                />
                <p className="text-xs text-muted-foreground mt-1">Unique identifier (no spaces)</p>
              </div>
              <div>
                <Label>Type</Label>
                <Select
                  value={unifiedItemForm.type}
                  onValueChange={(v) => setUnifiedItemForm({...unifiedItemForm, type: v})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="block">Block</SelectItem>
                    <SelectItem value="badge">Badge</SelectItem>
                    <SelectItem value="pet">Pet</SelectItem>
                    <SelectItem value="floor">Floor</SelectItem>
                    <SelectItem value="board">Board</SelectItem>
                    <SelectItem value="decoration">Decoration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Base Price (Gem)</Label>
              <Input
                type="number"
                value={unifiedItemForm.basePrice}
                onChange={(e) => setUnifiedItemForm({...unifiedItemForm, basePrice: parseInt(e.target.value) || 0})}
              />
            </div>

            <div className="border-t pt-4">
              <Label className="text-base font-semibold">Translations (at least English required)</Label>
              <div className="space-y-3 mt-3">
                <div>
                  <Label>Name (EN) *</Label>
                  <Input
                    value={unifiedItemForm.translations?.en?.name || ""}
                    onChange={(e) => setUnifiedItemForm({
                      ...unifiedItemForm,
                      translations: {
                        ...unifiedItemForm.translations,
                        en: { ...unifiedItemForm.translations?.en, name: e.target.value, description: unifiedItemForm.translations?.en?.description || "" }
                      }
                    })}
                    placeholder="English name"
                  />
                </div>
                <div>
                  <Label>Description (EN)</Label>
                  <Textarea
                    value={unifiedItemForm.translations?.en?.description || ""}
                    onChange={(e) => setUnifiedItemForm({
                      ...unifiedItemForm,
                      translations: {
                        ...unifiedItemForm.translations,
                        en: { ...unifiedItemForm.translations?.en, description: e.target.value }
                      }
                    })}
                    placeholder="English description"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button
                className="flex-1"
                onClick={() => createUnifiedItemMutation.mutate(unifiedItemForm)}
                disabled={!unifiedItemForm.id || !unifiedItemForm.translations?.en?.name || createUnifiedItemMutation.isPending}
                data-testid="button-create-unified-item"
              >
                {createUnifiedItemMutation.isPending ? "Creating..." : "Create Item"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreateUnifiedItem(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Shop Items Management (Legacy)
          </CardTitle>
          <CardDescription>Manage shop item prices, discounts, and availability</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-[300px]">
              <Input
                placeholder="Search items by name or ID..."
                value={shopSearchQuery}
                onChange={(e) => setShopSearchQuery(e.target.value)}
                className="h-9"
                data-testid="input-shop-search"
              />
              {shopSearchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShopSearchQuery("")}
                  data-testid="button-clear-shop-search"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Badge variant="outline">Total: {shopData?.total || 0} items</Badge>
            <div className="flex gap-1 ml-4">
              {(shopData?.types || []).map(type => (
                <Button
                  key={type}
                  variant={shopCategoryFilter === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShopCategoryFilter(type)}
                  data-testid={`button-shop-filter-${type}`}
                >
                  {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
              ))}
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Preview</TableHead>
                <TableHead>ID / Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Rarity</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(shopData?.items || []).map((item) => (
                <TableRow key={item.id} className={item.isDisabled ? "opacity-50" : ""}>
                  <TableCell>
                    {hasGLBModel(item.id) ? (
                      <Model3DPreview itemId={item.id} size={60} autoRotate={true} interactive={false} />
                    ) : (
                      <div className="w-[60px] h-[60px] bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                        No 3D
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{t(item.nameKey)}</span>
                      <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{item.type}</Badge></TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className={item.hasOverride ? "text-green-600 font-bold" : ""}>{item.price.toLocaleString()} Gem</span>
                      {item.hasOverride && item.originalPrice !== item.price && (
                        <span className="text-xs text-muted-foreground line-through">{item.originalPrice.toLocaleString()}</span>
                      )}
                      {item.discountPercent && item.discountPercent > 0 && (
                        <Badge variant="destructive" className="text-xs w-fit">-{item.discountPercent}%</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.isDisabled ? (
                      <Badge variant="destructive">Disabled</Badge>
                    ) : item.hasOverride ? (
                      <Badge variant="secondary">Modified</Badge>
                    ) : (
                      <Badge variant="outline">Default</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.duration}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingShopItem(item);
                          setShopItemEdit({
                            priceOverride: item.price,
                            isDisabled: item.isDisabled,
                            discountPercent: item.discountPercent || 0,
                          });
                        }}
                        data-testid={`button-edit-shop-${item.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {item.hasOverride && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => resetShopItemMutation.mutate(item.id)}
                          data-testid={`button-reset-shop-${item.id}`}
                        >
                          <RotateCcw className="w-4 h-4 text-orange-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Custom Shop Items Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Custom Shop Items
            </div>
            <Dialog open={showCreateItemDialog} onOpenChange={setShowCreateItemDialog}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-create-custom-item">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Custom Shop Item</DialogTitle>
                  <DialogDescription>Add a new item to the shop</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Type</label>
                      <Select value={customItemForm.type} onValueChange={(v) => setCustomItemForm({...customItemForm, type: v})}>
                        <SelectTrigger data-testid="select-custom-item-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="block">Block Skin</SelectItem>
                          <SelectItem value="pet">Pet</SelectItem>
                          <SelectItem value="floor">Floor Material</SelectItem>
                          <SelectItem value="board">Board Material</SelectItem>
                          <SelectItem value="decoration">Decoration</SelectItem>
                          <SelectItem value="badge">Badge</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Sort Order</label>
                      <Input
                        type="number"
                        value={customItemForm.sortOrder}
                        onChange={(e) => setCustomItemForm({...customItemForm, sortOrder: parseInt(e.target.value) || 0})}
                        data-testid="input-custom-item-sort"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name (or i18n key)</label>
                    <Input
                      value={customItemForm.nameKey}
                      onChange={(e) => setCustomItemForm({...customItemForm, nameKey: e.target.value})}
                      placeholder="e.g., My Custom Block or shop.items.custom1"
                      data-testid="input-custom-item-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description (or i18n key)</label>
                    <Input
                      value={customItemForm.descriptionKey}
                      onChange={(e) => setCustomItemForm({...customItemForm, descriptionKey: e.target.value})}
                      placeholder="e.g., A beautiful custom block"
                      data-testid="input-custom-item-desc"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">3D Model URL (optional)</label>
                    <div className="flex gap-2">
                      <Input
                        value={customItemForm.modelUrl}
                        onChange={(e) => setCustomItemForm({...customItemForm, modelUrl: e.target.value})}
                        placeholder="https://... or /objects/..."
                        className="flex-1"
                        data-testid="input-custom-item-model"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isUploadingModel}
                        onClick={async () => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = '.glb,.gltf';
                          input.onchange = async (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (!file) return;
                            setIsUploadingModel(true);
                            try {
                              const urlRes = await fetch('/api/admin/shop/upload-model-url', { method: 'POST', credentials: 'include' });
                              if (!urlRes.ok) throw new Error('Failed to get upload URL');
                              const { uploadURL, objectPath } = await urlRes.json();
                              await fetch(uploadURL, { method: 'PUT', body: file, headers: { 'Content-Type': 'model/gltf-binary' } });
                              setCustomItemForm({...customItemForm, modelUrl: objectPath});
                              toast({ title: "Success", description: "Model uploaded" });
                            } catch (err: any) {
                              toast({ title: "Error", description: err.message, variant: "destructive" });
                            } finally {
                              setIsUploadingModel(false);
                            }
                          };
                          input.click();
                        }}
                        data-testid="button-upload-model"
                      >
                        {isUploadingModel ? "Uploading..." : "Upload GLB"}
                      </Button>
                    </div>
                  </div>

                  {/* Price Options */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Price Options</label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCustomItemForm({
                          ...customItemForm,
                          priceOptions: [...customItemForm.priceOptions, { duration: "one_week" as ShopItemDuration, price: 100, isDefault: false }]
                        })}
                        data-testid="button-add-price-option"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Option
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {customItemForm.priceOptions.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded">
                          <Select
                            value={opt.duration}
                            onValueChange={(v) => {
                              const newOpts = [...customItemForm.priceOptions];
                              newOpts[idx].duration = v as ShopItemDuration;
                              setCustomItemForm({...customItemForm, priceOptions: newOpts});
                            }}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.keys(DURATION_CONFIGS).map(d => (
                                <SelectItem key={d} value={d}>{d.replace(/_/g, ' ')}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            value={opt.price}
                            onChange={(e) => {
                              const newOpts = [...customItemForm.priceOptions];
                              newOpts[idx].price = parseInt(e.target.value) || 0;
                              setCustomItemForm({...customItemForm, priceOptions: newOpts});
                            }}
                            className="w-24"
                            placeholder="Price"
                          />
                          <span className="text-sm text-muted-foreground">Gem</span>
                          <Button
                            variant={opt.isDefault ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              const newOpts = customItemForm.priceOptions.map((o, i) => ({...o, isDefault: i === idx}));
                              setCustomItemForm({...customItemForm, priceOptions: newOpts});
                            }}
                          >
                            Default
                          </Button>
                          {customItemForm.priceOptions.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const newOpts = customItemForm.priceOptions.filter((_, i) => i !== idx);
                                if (newOpts.length > 0 && !newOpts.some(o => o.isDefault)) {
                                  newOpts[0].isDefault = true;
                                }
                                setCustomItemForm({...customItemForm, priceOptions: newOpts});
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={customItemForm.isActive}
                      onChange={(e) => setCustomItemForm({...customItemForm, isActive: e.target.checked})}
                      id="custom-item-active"
                    />
                    <label htmlFor="custom-item-active" className="text-sm">Active (visible in shop)</label>
                  </div>

                  <div className="border-t pt-4 mt-2">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id="enable-create-schedule"
                        checked={enableCreateSchedule}
                        onChange={(e) => {
                          setEnableCreateSchedule(e.target.checked);
                          if (!e.target.checked) setCreateScheduleTime("");
                        }}
                        data-testid="checkbox-enable-create-schedule"
                      />
                      <label htmlFor="enable-create-schedule" className="text-sm font-medium">Schedule for later</label>
                    </div>
                    {enableCreateSchedule && (
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={createScheduleTime.split("T")[0] || ""}
                          onChange={(e) => {
                            const time = createScheduleTime.split("T")[1] || "12:00";
                            setCreateScheduleTime(e.target.value + "T" + time);
                          }}
                          className="flex-1"
                          data-testid="input-create-schedule-date"
                        />
                        <Input
                          type="time"
                          value={createScheduleTime.split("T")[1] || ""}
                          onChange={(e) => {
                            const date = createScheduleTime.split("T")[0] || new Date().toISOString().split("T")[0];
                            setCreateScheduleTime(date + "T" + e.target.value);
                          }}
                          className="w-32"
                          data-testid="input-create-schedule-time"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {!enableCreateSchedule ? (
                      <Button
                        className="w-full"
                        onClick={() => createCustomItemMutation.mutate(customItemForm)}
                        disabled={!customItemForm.nameKey || !customItemForm.descriptionKey || createCustomItemMutation.isPending}
                        data-testid="button-save-custom-item"
                      >
                        {createCustomItemMutation.isPending ? "Creating..." : "Create Item"}
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={async () => {
                          try {
                            await apiRequest("POST", "/api/admin/shop/scheduled-actions", {
                                actionType: "create",
                                isCustomItem: true,
                                scheduledAt: new Date(createScheduleTime).toISOString(),
                                actionData: customItemForm,
                              });
                            toast({ title: "Item creation scheduled" });
                            setCreateScheduleTime("");
                            setEnableCreateSchedule(false);
                            queryClient.invalidateQueries({ queryKey: ["/api/admin/shop/scheduled-actions"] });
                          } catch (error: any) {
                            toast({ title: "Failed to schedule", description: error.message, variant: "destructive" });
                          }
                        }}
                        disabled={!customItemForm.nameKey || !customItemForm.descriptionKey || !createScheduleTime}
                        data-testid="button-schedule-custom-item"
                      >
                        <Clock className="w-4 h-4 mr-1" />
                        Schedule Creation
                      </Button>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
          <CardDescription>Admin-created custom items stored in database</CardDescription>
        </CardHeader>
        <CardContent>
          {(customItemsData?.items || []).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No custom items yet. Click "Create New Item" to add one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Price Options</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(customItemsData?.items || []).map((item: any) => (
                  <TableRow key={item.id} className={!item.isActive ? "opacity-50" : ""}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{item.nameKey}</span>
                        <span className="text-xs text-muted-foreground">{item.id.slice(0, 8)}...</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{item.type}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(item.priceOptions || []).map((opt: any, idx: number) => (
                          <Badge key={idx} variant={opt.isDefault ? "default" : "secondary"} className="text-xs">
                            {opt.duration.replace(/_/g, ' ')}: {opt.price} Gem
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.isActive ? (
                        <Badge variant="outline" className="text-green-600">Active</Badge>
                      ) : (
                        <Badge variant="destructive">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingCustomItem(item)}
                          data-testid={`button-edit-custom-${item.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this item?')) {
                              deleteCustomItemMutation.mutate(item.id);
                            }
                          }}
                          data-testid={`button-delete-custom-${item.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Scheduled Actions Card */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Scheduled Shop Actions
          </CardTitle>
          <CardDescription>View and manage scheduled shop item changes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="outline">Total: {scheduledActionsData?.total || 0}</Badge>
            <div className="flex gap-1 ml-4">
              {["all", "pending", "processing", "executed", "failed", "cancelled"].map(status => (
                <Button
                  key={status}
                  variant={scheduledActionsFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setScheduledActionsFilter(status)}
                  data-testid={`button-scheduled-filter-${status}`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchScheduledActions()}
              className="ml-auto"
              data-testid="button-refresh-scheduled"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setShowScheduleDialog(true)}
              data-testid="button-new-scheduled-action"
            >
              <Plus className="w-4 h-4 mr-1" />
              Schedule New Action
            </Button>
          </div>

          {(!scheduledActionsData?.actions || scheduledActionsData.actions.length === 0) ? (
            <div className="text-center py-8 text-muted-foreground">
              No scheduled actions found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target Item</TableHead>
                  <TableHead>Scheduled For</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledActionsData.actions.map((action: any) => (
                  <TableRow key={action.id}>
                    <TableCell className="font-mono text-xs">{action.id}</TableCell>
                    <TableCell>
                      <Badge variant={
                        action.actionType === "create" ? "default" :
                        action.actionType === "update" ? "secondary" : "destructive"
                      }>
                        {action.actionType.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {action.targetItemId || "(New Item)"}
                      {action.isCustomItem && <Badge variant="outline" className="ml-1">Custom</Badge>}
                    </TableCell>
                    <TableCell>
                      {new Date(action.scheduledAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={
                          action.status === "pending" ? "default" :
                          action.status === "processing" ? "secondary" :
                          action.status === "executed" ? "outline" :
                          action.status === "failed" ? "destructive" : "outline"
                        }>
                          {action.status}
                        </Badge>
                        {action.errorMessage && (
                          <span className="text-xs text-destructive truncate max-w-[150px]" title={action.errorMessage}>
                            {action.errorMessage.slice(0, 30)}...
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{action.createdBy?.slice(0, 8)}...</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {(action.status === "pending" || action.status === "failed") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              if (confirm('Cancel this scheduled action?')) {
                                try {
                                  await apiRequest("POST", `/api/admin/shop/scheduled-actions/${action.id}/cancel`);
                                  toast({ title: "Action cancelled" });
                                  queryClient.invalidateQueries({ queryKey: ["/api/admin/shop/scheduled-actions"] });
                                } catch (error) {
                                  toast({ title: "Failed to cancel action", variant: "destructive" });
                                }
                              }
                            }}
                            data-testid={`button-cancel-scheduled-${action.id}`}
                          >
                            <X className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                        {(action.status === "cancelled" || action.status === "executed" || action.status === "failed") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              if (confirm('Delete this action record?')) {
                                try {
                                  await apiRequest("DELETE", `/api/admin/shop/scheduled-actions/${action.id}`);
                                  toast({ title: "Action deleted" });
                                  queryClient.invalidateQueries({ queryKey: ["/api/admin/shop/scheduled-actions"] });
                                } catch (error) {
                                  toast({ title: "Failed to delete action", variant: "destructive" });
                                }
                              }
                            }}
                            data-testid={`button-delete-scheduled-${action.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Shop Item Edit Dialog */}
      <Dialog open={!!editingShopItem} onOpenChange={() => setEditingShopItem(null)}>
        <DialogContent className={isBlockModel(editingShopItem?.id || '') ? "max-w-2xl max-h-[90vh] overflow-y-auto" : ""}>
          <DialogHeader>
            <DialogTitle>Edit Shop Item</DialogTitle>
            <DialogDescription>
              {editingShopItem?.nameKey && t(editingShopItem.nameKey)} ({editingShopItem?.id})
            </DialogDescription>
          </DialogHeader>
          {editingShopItem && (
            <div className="space-y-4">
              {isBlockModel(editingShopItem.id) ? (
                <Model3DCustomizer
                  itemId={editingShopItem.id}
                  initialSettings={materialSettings}
                  onSettingsChange={setMaterialSettings}
                  size={180}
                />
              ) : hasGLBModel(editingShopItem.id) && (
                <div className="flex justify-center">
                  <Model3DPreview itemId={editingShopItem.id} size={120} autoRotate={true} interactive={true} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Original Price</Label>
                  <div className="text-lg font-bold text-muted-foreground">{editingShopItem.originalPrice?.toLocaleString()} Gem</div>
                </div>
                <div>
                  <Label>Type</Label>
                  <div className="flex gap-2">
                    <Badge variant="outline">{editingShopItem.type}</Badge>
                  </div>
                </div>
              </div>
              <div>
                <Label>Price Override (Gem)</Label>
                <Input
                  type="number"
                  value={shopItemEdit.priceOverride}
                  onChange={(e) => setShopItemEdit({...shopItemEdit, priceOverride: parseInt(e.target.value) || 0})}
                  data-testid="input-shop-price"
                />
              </div>
              <div>
                <Label>Discount Percent (0-100)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={shopItemEdit.discountPercent}
                  onChange={(e) => setShopItemEdit({...shopItemEdit, discountPercent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0))})}
                  data-testid="input-shop-discount"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="shop-disabled"
                  checked={shopItemEdit.isDisabled}
                  onChange={(e) => setShopItemEdit({...shopItemEdit, isDisabled: e.target.checked})}
                  data-testid="checkbox-shop-disabled"
                />
                <Label htmlFor="shop-disabled">Disable Item (Hide from shop)</Label>
              </div>

              {/* Price Options Section */}
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label>Price Options (Duration/Price)</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingItemPriceOptions([...editingItemPriceOptions, { duration: "one_week" as ShopItemDuration, price: 100, isDefault: false }])}
                    data-testid="button-add-existing-price-option"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Option
                  </Button>
                </div>
                <div className="space-y-2">
                  {editingItemPriceOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <Select
                        value={opt.duration}
                        onValueChange={(v) => {
                          const newOpts = [...editingItemPriceOptions];
                          newOpts[idx].duration = v as ShopItemDuration;
                          setEditingItemPriceOptions(newOpts);
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(DURATION_CONFIGS).map(d => (
                            <SelectItem key={d} value={d}>{d.replace(/_/g, ' ')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={opt.price}
                        onChange={(e) => {
                          const newOpts = [...editingItemPriceOptions];
                          newOpts[idx].price = parseInt(e.target.value) || 0;
                          setEditingItemPriceOptions(newOpts);
                        }}
                        className="w-24"
                        placeholder="Price"
                      />
                      <span className="text-sm text-muted-foreground">Gem</span>
                      <Button
                        variant={opt.isDefault ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          const newOpts = editingItemPriceOptions.map((o, i) => ({...o, isDefault: i === idx}));
                          setEditingItemPriceOptions(newOpts);
                        }}
                      >
                        Default
                      </Button>
                      {editingItemPriceOptions.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newOpts = editingItemPriceOptions.filter((_, i) => i !== idx);
                            if (newOpts.length > 0 && !newOpts.some(o => o.isDefault)) {
                              newOpts[0].isDefault = true;
                            }
                            setEditingItemPriceOptions(newOpts);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="enable-edit-schedule"
                    checked={enableEditSchedule}
                    onChange={(e) => {
                      setEnableEditSchedule(e.target.checked);
                      if (!e.target.checked) setEditScheduleTime("");
                    }}
                    data-testid="checkbox-enable-edit-schedule"
                  />
                  <label htmlFor="enable-edit-schedule" className="text-sm font-medium">Schedule for later</label>
                </div>
                {enableEditSchedule && (
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={editScheduleTime.split("T")[0] || ""}
                      onChange={(e) => {
                        const time = editScheduleTime.split("T")[1] || "12:00";
                        setEditScheduleTime(e.target.value + "T" + time);
                      }}
                      className="flex-1"
                      data-testid="input-edit-schedule-date"
                    />
                    <Input
                      type="time"
                      value={editScheduleTime.split("T")[1] || ""}
                      onChange={(e) => {
                        const date = editScheduleTime.split("T")[0] || new Date().toISOString().split("T")[0];
                        setEditScheduleTime(date + "T" + e.target.value);
                      }}
                      className="w-32"
                      data-testid="input-edit-schedule-time"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setEditingShopItem(null); setEditScheduleTime(""); setEnableEditSchedule(false); }} data-testid="button-cancel-shop-edit">
                  Cancel
                </Button>
                {enableEditSchedule ? (
                  <Button
                    onClick={async () => {
                      try {
                        const updates = {
                          priceOverride: shopItemEdit.priceOverride,
                          isDisabled: shopItemEdit.isDisabled,
                          discountPercent: shopItemEdit.discountPercent > 0 ? shopItemEdit.discountPercent : null,
                          materialSettings: isBlockModel(editingShopItem.id) ? JSON.stringify(materialSettings) : null,
                          priceOptions: editingItemPriceOptions,
                        };
                        await apiRequest("POST", "/api/admin/shop/scheduled-actions", {
                            actionType: "update",
                            targetItemId: editingShopItem.id,
                            isCustomItem: false,
                            scheduledAt: new Date(editScheduleTime).toISOString(),
                            actionData: updates,
                          });
                        toast({ title: "Update scheduled" });
                        setEditScheduleTime("");
                        setEnableEditSchedule(false);
                        setEditingShopItem(null);
                        queryClient.invalidateQueries({ queryKey: ["/api/admin/shop/scheduled-actions"] });
                      } catch (error: any) {
                        toast({ title: "Failed to schedule", description: error.message, variant: "destructive" });
                      }
                    }}
                    disabled={!editScheduleTime}
                    data-testid="button-schedule-shop-update"
                  >
                    <Clock className="w-4 h-4 mr-1" />
                    Schedule Update
                  </Button>
                ) : (
                  <Button
                    onClick={async () => {
                      // Save price options first
                      await updatePriceOptionsMutation.mutateAsync({
                        itemId: editingShopItem.id,
                        isCustomItem: false,
                        options: editingItemPriceOptions,
                      });
                      // Then save other overrides
                      updateShopItemMutation.mutate({
                        itemId: editingShopItem.id,
                        updates: {
                          priceOverride: shopItemEdit.priceOverride,
                          isDisabled: shopItemEdit.isDisabled,
                          discountPercent: shopItemEdit.discountPercent > 0 ? shopItemEdit.discountPercent : null,
                          materialSettings: isBlockModel(editingShopItem.id) ? JSON.stringify(materialSettings) : null,
                        }
                      });
                    }}
                    disabled={updateShopItemMutation.isPending || updatePriceOptionsMutation.isPending}
                    data-testid="button-save-shop-item"
                  >
                    {(updateShopItemMutation.isPending || updatePriceOptionsMutation.isPending) ? "Saving..." : "Save Changes"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Custom Item Edit Dialog */}
      <Dialog open={!!editingCustomItem} onOpenChange={() => setEditingCustomItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Custom Item</DialogTitle>
            <DialogDescription>Modify custom item settings</DialogDescription>
          </DialogHeader>
          {editingCustomItem && (
            <div className="space-y-4">
              <div>
                <Label>Item Name</Label>
                <Input
                  value={editingCustomItem.nameKey || ""}
                  onChange={(e) => setEditingCustomItem({ ...editingCustomItem, nameKey: e.target.value })}
                  placeholder="Enter item name"
                  data-testid="input-custom-item-name"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={editingCustomItem.descriptionKey || ""}
                  onChange={(e) => setEditingCustomItem({ ...editingCustomItem, descriptionKey: e.target.value })}
                  placeholder="Enter description"
                  data-testid="input-custom-item-description"
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select
                  value={editingCustomItem.type}
                  onValueChange={(v) => setEditingCustomItem({ ...editingCustomItem, type: v })}
                >
                  <SelectTrigger data-testid="select-custom-item-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="block">Block</SelectItem>
                    <SelectItem value="pet">Pet</SelectItem>
                    <SelectItem value="decoration">Decoration</SelectItem>
                    <SelectItem value="floor">Floor</SelectItem>
                    <SelectItem value="background">Background</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>3D Model URL</Label>
                <Input
                  value={editingCustomItem.modelUrl || ""}
                  onChange={(e) => setEditingCustomItem({ ...editingCustomItem, modelUrl: e.target.value })}
                  placeholder="GLB file URL"
                  data-testid="input-custom-item-model"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="custom-edit-active"
                  checked={editingCustomItem.isActive ?? true}
                  onChange={(e) => setEditingCustomItem({ ...editingCustomItem, isActive: e.target.checked })}
                />
                <label htmlFor="custom-edit-active" className="text-sm">Active (visible in shop)</label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingCustomItem(null)} data-testid="button-cancel-custom-edit">
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    updateCustomItemMutation.mutate({
                      itemId: editingCustomItem.id,
                      updates: {
                        nameKey: editingCustomItem.nameKey,
                        descriptionKey: editingCustomItem.descriptionKey,
                        type: editingCustomItem.type,
                        modelUrl: editingCustomItem.modelUrl,
                        isActive: editingCustomItem.isActive,
                      }
                    });
                  }}
                  disabled={updateCustomItemMutation.isPending}
                  data-testid="button-save-custom-item-edit"
                >
                  {updateCustomItemMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Schedule New Action Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule New Action</DialogTitle>
            <DialogDescription>
              Schedule a shop item action to execute at a specific time
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Action Type</Label>
              <Select
                value={scheduleActionForm.actionType}
                onValueChange={(v) => setScheduleActionForm(f => ({ ...f, actionType: v as any, targetItemId: "", actionData: {} }))}
              >
                <SelectTrigger data-testid="select-schedule-action-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="create">Create New Item</SelectItem>
                  <SelectItem value="update">Update Item</SelectItem>
                  <SelectItem value="delete">Delete Item</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scheduleActionForm.actionType !== "create" && (
              <div>
                <Label>Target Item</Label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={scheduleActionForm.isCustomItem}
                    onChange={(e) => setScheduleActionForm(f => ({ ...f, isCustomItem: e.target.checked, targetItemId: "" }))}
                    data-testid="checkbox-schedule-custom-item"
                  />
                  <span className="text-sm">Custom Item</span>
                </div>
                {scheduleActionForm.isCustomItem ? (
                  <Select
                    value={scheduleActionForm.targetItemId}
                    onValueChange={(v) => setScheduleActionForm(f => ({ ...f, targetItemId: v }))}
                  >
                    <SelectTrigger data-testid="select-schedule-custom-item">
                      <SelectValue placeholder="Select custom item..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(customItemsData?.items || []).map((item: any) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name || item.nameKey} ({item.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value={scheduleActionForm.targetItemId}
                    onValueChange={(v) => setScheduleActionForm(f => ({ ...f, targetItemId: v }))}
                  >
                    <SelectTrigger data-testid="select-schedule-item">
                      <SelectValue placeholder="Select item..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SHOP_ITEMS.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {t(item.nameKey, item.id)} ({item.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div>
              <Label>Scheduled Time</Label>
              <Input
                type="datetime-local"
                value={scheduleActionForm.scheduledAt}
                onChange={(e) => setScheduleActionForm(f => ({ ...f, scheduledAt: e.target.value }))}
                data-testid="input-schedule-time"
              />
            </div>

            {(scheduleActionForm.actionType === "create" || scheduleActionForm.actionType === "update") && (
              <div>
                <Label>Action Data (JSON)</Label>
                <Textarea
                  placeholder={scheduleActionForm.actionType === "create"
                    ? '{"name": "New Item", "type": "decoration", "price": 100, ...}'
                    : '{"priceOverride": 150, "isDisabled": false, ...}'
                  }
                  value={JSON.stringify(scheduleActionForm.actionData, null, 2)}
                  onChange={(e) => {
                    try {
                      const data = JSON.parse(e.target.value);
                      setScheduleActionForm(f => ({ ...f, actionData: data }));
                    } catch {
                      // Keep raw text for editing
                    }
                  }}
                  className="font-mono text-sm min-h-[100px]"
                  data-testid="textarea-schedule-action-data"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {scheduleActionForm.actionType === "create"
                    ? "Enter the full item data for creating a new custom item"
                    : "Enter the fields you want to update"}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowScheduleDialog(false)} data-testid="button-cancel-schedule">
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  try {
                    const body = {
                      actionType: scheduleActionForm.actionType,
                      targetItemId: scheduleActionForm.actionType !== "create" ? scheduleActionForm.targetItemId : undefined,
                      isCustomItem: scheduleActionForm.isCustomItem,
                      scheduledAt: new Date(scheduleActionForm.scheduledAt).toISOString(),
                      actionData: scheduleActionForm.actionData,
                    };
                    await apiRequest("POST", "/api/admin/shop/scheduled-actions", body);
                    toast({ title: "Action scheduled successfully" });
                    setShowScheduleDialog(false);
                    setScheduleActionForm({
                      actionType: "create",
                      targetItemId: "",
                      isCustomItem: false,
                      scheduledAt: "",
                      actionData: {},
                    });
                    queryClient.invalidateQueries({ queryKey: ["/api/admin/shop/scheduled-actions"] });
                  } catch (error: any) {
                    toast({ title: "Failed to schedule action", description: error.message, variant: "destructive" });
                  }
                }}
                disabled={!scheduleActionForm.scheduledAt || (scheduleActionForm.actionType !== "create" && !scheduleActionForm.targetItemId)}
                data-testid="button-submit-schedule"
              >
                Schedule Action
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
