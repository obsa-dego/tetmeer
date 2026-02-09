import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, Package, Gift, Send, Gem, Search } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { SHOP_ITEMS, type ShopItem, DURATION_CONFIGS, type ShopItemDuration } from "@shared/shop";

interface User {
  id: string;
  email: string | null;
  nickname: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  createdAt: string | null;
  gemBalance: number | null;
}

interface AdminGiftsProps {
  isAdmin: boolean;
}

export default function AdminGifts({ isAdmin }: AdminGiftsProps) {
  const { toast } = useToast();
  const { t } = useTranslation();

  // Gift sending state
  const [giftRecipientId, setGiftRecipientId] = useState("");
  const [giftRecipientName, setGiftRecipientName] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [giftItemId, setGiftItemId] = useState("");
  const [giftItemDuration, setGiftItemDuration] = useState<ShopItemDuration>("permanent");
  const [giftGemAmount, setGiftGemAmount] = useState(0);
  const [giftRecipientSearch, setGiftRecipientSearch] = useState("");
  const [giftUserResults, setGiftUserResults] = useState<User[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

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

  const sendGiftMutation = useMutation({
    mutationFn: async ({ userId, message, itemId, itemDuration, gemAmount }: { userId: string; message: string; itemId?: string; itemDuration?: ShopItemDuration; gemAmount?: number }) => {
      return apiRequest("POST", "/api/admin/send-gift", { userId, message, itemId, itemDuration, gemAmount });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Gift sent successfully! The user will see it in their messages." });
      setGiftRecipientId("");
      setGiftRecipientName("");
      setGiftItemDuration("permanent");
      setGiftMessage("");
      setGiftItemId("");
      setGiftGemAmount(0);
      setGiftRecipientSearch("");
      setGiftUserResults([]);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send gift", variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="w-5 h-5" />
          Send Operator Gift
        </CardTitle>
        <CardDescription>
          Send a message with optional gems or items to a user. Messages appear as "from Operator" in their DMs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="gift-recipient">Recipient User</Label>
            <div className="relative mt-1">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="gift-recipient-search"
                    placeholder="Search by nickname or email..."
                    value={giftRecipientSearch}
                    onChange={async (e) => {
                      const value = e.target.value;
                      setGiftRecipientSearch(value);
                      if (value.length >= 2) {
                        setIsSearchingUsers(true);
                        try {
                          const response = await fetch(`/api/admin/users?search=${encodeURIComponent(value)}`, { credentials: "include" });
                          const data = await response.json();
                          setGiftUserResults(data.users || []);
                        } catch {
                          setGiftUserResults([]);
                        } finally {
                          setIsSearchingUsers(false);
                        }
                      } else {
                        setGiftUserResults([]);
                      }
                    }}
                    data-testid="input-gift-recipient-search"
                    className="pl-9"
                  />
                </div>
                {giftRecipientId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setGiftRecipientId("");
                      setGiftRecipientName("");
                      setGiftRecipientSearch("");
                      setGiftUserResults([]);
                    }}
                    data-testid="button-clear-recipient"
                  >
                    Clear
                  </Button>
                )}
              </div>

              {/* User Search Results Dropdown */}
              {giftUserResults.length > 0 && !giftRecipientId && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                  {giftUserResults.map((u) => (
                    <button
                      key={u.id}
                      className="w-full px-3 py-2 text-left hover-elevate flex items-center justify-between gap-2"
                      onClick={() => {
                        setGiftRecipientId(u.id);
                        setGiftRecipientName(u.nickname || u.email || u.id);
                        setGiftRecipientSearch("");
                        setGiftUserResults([]);
                      }}
                      data-testid={`user-option-${u.id}`}
                    >
                      <div>
                        <div className="font-medium">{u.nickname || "No nickname"}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                      {u.role && u.role !== "user" && (
                        <Badge variant="secondary" className="text-xs">{u.role}</Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {isSearchingUsers && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg p-3 text-center text-muted-foreground">
                  Searching...
                </div>
              )}
            </div>

            {/* Selected User Display */}
            {giftRecipientId && (
              <div className="mt-2 p-3 bg-muted/50 rounded-md flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">{giftRecipientName}</div>
                  <div className="text-xs text-muted-foreground font-mono">{giftRecipientId}</div>
                </div>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="gift-message">Message (Required)</Label>
            <Textarea
              id="gift-message"
              placeholder="Enter your message to the user..."
              value={giftMessage}
              onChange={(e) => setGiftMessage(e.target.value)}
              data-testid="input-gift-message"
              className="mt-1"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="gift-gems" className="flex items-center gap-2">
                <Gem className="w-4 h-4" />
                Gem Amount (Optional)
              </Label>
              <Input
                id="gift-gems"
                type="number"
                min={0}
                placeholder="0"
                value={giftGemAmount || ""}
                onChange={(e) => setGiftGemAmount(parseInt(e.target.value) || 0)}
                data-testid="input-gift-gems"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="gift-item" className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Item (Optional)
              </Label>
              <Select
                value={giftItemId}
                onValueChange={setGiftItemId}
              >
                <SelectTrigger className="mt-1" data-testid="select-gift-item">
                  <SelectValue placeholder="Select an item..." />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="__none__">No item</SelectItem>
                  {Object.entries(shopItemsByType).map(([type, items]) => (
                    <div key={type}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase bg-muted/50">
                        {type}s
                      </div>
                      {items.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          <span>{getItemDisplayName(item)}</span>
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Duration selector - only shown when item is selected */}
          {giftItemId && giftItemId !== "__none__" && (
            <div>
              <Label htmlFor="gift-duration" className="flex items-center gap-2">
                Duration
              </Label>
              <Select
                value={giftItemDuration}
                onValueChange={(v) => setGiftItemDuration(v as ShopItemDuration)}
              >
                <SelectTrigger className="mt-1" data-testid="select-gift-duration">
                  <SelectValue placeholder="Select duration..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(DURATION_CONFIGS).map((config) => (
                    <SelectItem key={config.key} value={config.key}>
                      {t(config.labelKey, config.key === 'permanent' ? 'Permanent' : config.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {t('admin.giftDurationHelp', 'Select how long the item will be available in user\'s inventory')}
              </p>
            </div>
          )}

          <div className="pt-4 border-t">
            <Button
              onClick={() => {
                if (!giftRecipientId || !giftMessage.trim()) {
                  toast({ title: "Error", description: "Please select a user and enter a message", variant: "destructive" });
                  return;
                }
                sendGiftMutation.mutate({
                  userId: giftRecipientId,
                  message: giftMessage.trim(),
                  itemId: giftItemId && giftItemId !== "__none__" ? giftItemId : undefined,
                  itemDuration: giftItemId && giftItemId !== "__none__" ? giftItemDuration : undefined,
                  gemAmount: giftGemAmount > 0 ? giftGemAmount : undefined,
                });
              }}
              disabled={sendGiftMutation.isPending || !giftRecipientId || !giftMessage.trim()}
              data-testid="button-send-gift"
              className="w-full md:w-auto"
            >
              {sendGiftMutation.isPending ? (
                "Sending..."
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Gift Message
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 mt-6">
          <h4 className="font-medium mb-2">How it works:</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>The message will appear in the user's DM list from "TETMEER Operator"</li>
            <li>If gems or items are included, the user will see a "Claim Gift" button</li>
            <li>Users can only claim each gift once</li>
            <li>Claimed items are added to inventory, gems to their balance</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}