import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ItemPreview3D } from '@/components/ui/ItemPreview3D';
import { useAuth } from '@/hooks/use-auth';
import { loginWithGoogle } from '@/lib/auth-utils';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useNavigation } from '@/contexts/NavigationContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useTranslation } from 'react-i18next';
import { TitleBadge, getAllTitleIds } from '@/components/TitleBadge';
import { getAllAchievements } from '@shared/achievements';
import type { TitleId, BlockTexture, PlacedDecorations, DecorationItem, UserInventory, PlayerProgression } from '@shared/schema';
import { AccountWorld3D } from '@/components/AccountWorld3D';
import { parseEquippedDecorations, DECORATION_ITEMS } from "@/lib/decoration-items";
import { InterfaceSettings } from './account/InterfaceSettings';
import { ControlsSettings } from './account/ControlsSettings';
import { getShopItem, getDurationConfig } from '@shared/shop';
import { 
  Trophy, 
  Gamepad2, 
  Clock, 
  Target, 
  Crown, 
  Star,
  Swords,
  ArrowLeft,
  Pencil,
  Camera,
  Check,
  X,
  Loader2,
  Lock,
  CreditCard,
  Zap,
  Flame,
  Infinity,
  ExternalLink,
  User as UserIcon,
  Award,
  ChevronRight,
  BarChart3,
  Settings,
  Medal,
  TrendingUp,
  Sparkles,
  Palette,
  Box,
  Trees,
  Dog,
  Gem,
  Image,
  Upload,
  Trash2,
  AlertCircle,
  MoveHorizontal,
  MoveVertical,
  MousePointerClick,
  ZoomIn,
  RotateCcw,
  Info,
  MapPin,
  Calendar,
  Package,
} from 'lucide-react';

type GridMaterialType = 'default' | 'glass' | 'metal' | 'neon' | 'hologram' | 'matrix' | 'lava' | 'ice';
type BoardMaterialType = 'default' | 'glass' | 'metal' | 'neon' | 'hologram' | 'matrix' | 'carbon' | 'galaxy';
type ViewModeType = '2d' | '3d';

interface UserProfile {
  id: string;
  userId: string;
  highScore: number;
  totalGamesPlayed: number;
  totalLinesCleared: number;
  totalPlayTime: number;
  isPremium: boolean;
  ownedTitles?: string[];
  selectedTitle?: string | null;
  backgroundImage?: string | null;
}

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
  invertX?: boolean;
  invertY?: boolean;
  mouseSensitivity?: number;
  wheelSensitivity?: number;
}


interface TitlesData {
  ownedTitles: string[];
  selectedTitle: string | null;
}

interface ModeHighScore {
  mode: string;
  highScore: number;
  bestTime: number | null;
  totalGames: number;
}

interface Subscription {
  id: string;
  status: string;
  productId: string;
  productName: string;
  amount: number;
  currency: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

type PanelView = 'main' | 'edit-profile' | 'edit-nickname' | 'edit-title' | 'statistics' | 'premium' | 'subscription' | 'settings' | 'interface-settings' | 'controls-settings' | 'background-settings' | 'ranking-summary';


export default function Account() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { navigateTo } = useNavigation();
  const { expanded } = useSidebar();
  const { toast } = useToast();
  
  const [panelView, setPanelView] = useState<PanelView>('main');
  const [editingNickname, setEditingNickname] = useState('');
  const [selectedTitleId, setSelectedTitleId] = useState<string | null>(null);
  const [billingPortalLoading, setBillingPortalLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const [itemInfoModalOpen, setItemInfoModalOpen] = useState(false);
  const [selectedItemForInfo, setSelectedItemForInfo] = useState<string | null>(null);

  // Background settings state
  const [editBackgroundImage, setEditBackgroundImage] = useState<string | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgHasChanges, setBgHasChanges] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      loginWithGoogle();
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (user?.nickname) {
      setEditingNickname(user.nickname);
    } else if (user?.firstName) {
      setEditingNickname(user.firstName);
    }
  }, [user]);

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ['/api/profile'],
    enabled: isAuthenticated,
  });

  const { data: settings } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
    enabled: isAuthenticated,
  });

  const { data: highScoresData } = useQuery<{ highScores: ModeHighScore[] }>({
    queryKey: ['/api/profile/high-scores'],
    enabled: isAuthenticated,
  });

  const { data: progression } = useQuery<PlayerProgression>({
    queryKey: ['/api/user/progression'],
    enabled: isAuthenticated,
  });

  const { data: subscriptionData, isLoading: subscriptionLoading } = useQuery<{ 
    subscriptions: Subscription[];
    hasActiveSubscription: boolean;
  }>({
    queryKey: ['/api/subscription/status'],
    enabled: isAuthenticated && profile?.isPremium,
    retry: 2,
  });

  const { data: titlesData } = useQuery<TitlesData>({
    queryKey: ['/api/profile/titles'],
    enabled: isAuthenticated,
  });

  const { data: userAchievements } = useQuery<{ unlocked: any[] }>({
    queryKey: ["/api/achievements"],
    enabled: isAuthenticated,
  });

  const { data: inventoryData } = useQuery<{ inventory: UserInventory[] }>({
    queryKey: ['/api/shop/inventory'],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (titlesData) {
      setSelectedTitleId(titlesData.selectedTitle);
    }
  }, [titlesData]);



  useEffect(() => {
    if (panelView === 'background-settings') {
      setEditBackgroundImage(profile?.backgroundImage || null);
      setBgHasChanges(false);
    }
  }, [panelView, profile?.backgroundImage]);

  const backgroundColor = settings?.backgroundColor || '#000000';
  const gridColor = settings?.gridColor || '#ffffff';
  const blockTexture = settings?.blockTexture || 'default';
  const gridMaterial = settings?.gridMaterial || 'default';
  const boardMaterial = settings?.boardMaterial || 'default';
  const showPet = settings?.showPet || false;
  const selectedPets = settings?.selectedPets || ['pet_puppy'];
  const viewMode = settings?.viewMode || '3d';
  const equippedDecorations = settings?.equippedDecorations 
    ? parseEquippedDecorations(settings.equippedDecorations) 
    : {};
  const placedDecorations: PlacedDecorations = (() => {
    if (!settings?.placedDecorations) return [];
    try {
      return JSON.parse(settings.placedDecorations);
    } catch {
      return [];
    }
  })();

  const updateTitleMutation = useMutation({
    mutationFn: async (titleId: string | null) => {
      const response = await apiRequest('PATCH', '/api/profile/title', { titleId });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('titles.titleChanged'), description: t('titles.titleChangedDesc') });
      queryClient.invalidateQueries({ queryKey: ['/api/profile/titles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      setPanelView('main');
    },
    onError: (error: any) => {
      toast({ 
        title: t('common.error'), 
        description: error.message || t('common.tryAgain'),
        variant: 'destructive' 
      });
    },
  });

  const updateBackgroundMutation = useMutation({
    mutationFn: async (data: { backgroundImage: string | null }) => {
      const res = await apiRequest('PATCH', '/api/profile', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      toast({ title: t('settings.saved', 'Settings saved'), description: t('settings.backgroundUpdated', 'Background updated') });
      setBgHasChanges(false);
    },
    onError: () => {
      toast({ title: t('common.error'), description: t('settings.saveFailed'), variant: 'destructive' });
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const response = await apiRequest('POST', '/api/subscription/cancel', { subscriptionId });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('account.subscriptionCanceled'), description: t('account.subscriptionCanceledDesc') });
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/status'] });
    },
    onError: (error: any) => {
      toast({ 
        title: t('account.failedToCancelSubscription'), 
        description: error.message || t('common.tryAgain'),
        variant: 'destructive' 
      });
    },
  });

  const reactivateSubscriptionMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const response = await apiRequest('POST', '/api/subscription/reactivate', { subscriptionId });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('account.subscriptionReactivated'), description: t('account.subscriptionReactivatedDesc') });
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/status'] });
    },
    onError: (error: any) => {
      toast({ 
        title: t('account.failedToReactivateSubscription'), 
        description: error.message || t('common.tryAgain'),
        variant: 'destructive' 
      });
    },
  });

  const updateNicknameMutation = useMutation({
    mutationFn: async (newNickname: string) => {
      const response = await apiRequest('PATCH', '/api/profile/nickname', { nickname: newNickname });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('account.nicknameUpdated') });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setPanelView('main');
    },
    onError: (error: any) => {
      toast({ 
        title: t('account.failedNicknameUpdate'), 
        description: error.message || t('common.tryAgain'),
        variant: 'destructive' 
      });
    },
  });

  const updateImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/profile/image', {
        method: 'PATCH',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('account.failedImageUpdate'));
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('account.imageUpdated') });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: any) => {
      toast({ 
        title: t('account.failedImageUpdate'), 
        description: error.message || t('common.tryAgain'),
        variant: 'destructive' 
      });
    },
  });

  const openBillingPortal = async () => {
    setBillingPortalLoading(true);
    try {
      const response = await fetch('/api/billing/portal', { credentials: 'include' });
      const data = await response.json();
      
      if (data.success && data.url) {
        window.open(data.url, '_blank');
      } else {
        toast({ 
          title: t('account.failedBillingPortal'), 
          description: data.message || t('account.noBillingInfo'),
          variant: 'destructive' 
        });
      }
    } catch {
      toast({ 
        title: t('account.failedBillingPortal'), 
        description: t('common.tryAgain'),
        variant: 'destructive' 
      });
    } finally {
      setBillingPortalLoading(false);
    }
  };

  const handleNicknameSubmit = () => {
    if (editingNickname.trim().length >= 2 && editingNickname.trim().length <= 20) {
      updateNicknameMutation.mutate(editingNickname.trim());
    } else {
      toast({ 
        title: t('account.nicknameLengthError'), 
        variant: 'destructive' 
      });
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ 
        title: t('account.imageSizeError'), 
        variant: 'destructive' 
      });
      return;
    }

    updateImageMutation.mutate(file);
  };

  const handleImageClick = () => {
    if (!profile?.isPremium) {
      toast({ 
        title: t('account.premiumFeature'), 
        description: t('account.premiumImageError'),
        variant: 'destructive' 
      });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleBgFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: t('settings.fileTooLarge'), description: t('settings.maxFileSize'), variant: 'destructive' });
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast({ title: t('settings.invalidFile'), description: t('settings.imageOnly'), variant: 'destructive' });
      return;
    }
    setBgUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      setEditBackgroundImage(e.target?.result as string);
      setBgHasChanges(true);
      setBgUploading(false);
    };
    reader.onerror = () => {
      toast({ title: t('common.error'), description: t('settings.uploadFailed'), variant: 'destructive' });
      setBgUploading(false);
    };
    reader.readAsDataURL(file);
    if (bgFileInputRef.current) bgFileInputRef.current.value = '';
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const formatTimeShort = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'marathon': return <Trophy className="w-4 h-4 text-yellow-500" />;
      case 'sprint': return <Zap className="w-4 h-4 text-blue-500" />;
      case 'ultra': return <Flame className="w-4 h-4 text-orange-500" />;
      case 'zen': return <Infinity className="w-4 h-4 text-purple-500" />;
      default: return <Trophy className="w-4 h-4" />;
    }
  };

  const displayName = user?.nickname || user?.firstName || user?.email?.split('@')[0] || 'User';
  const mainModes = ['marathon', 'sprint', 'ultra', 'zen'];
  const filteredHighScores = highScoresData?.highScores?.filter(hs => mainModes.includes(hs.mode)) || [];
  const activeSubscription = subscriptionData?.subscriptions?.[0];
  const ownedTitles = titlesData?.ownedTitles || [];
  const allAchievements = getAllAchievements();
  const unlockedCount = userAchievements?.unlocked?.length || 0;
  const totalAchievements = allAchievements.length;

  if (authLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto px-4 pt-24">
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const renderPanelContent = () => {
    switch (panelView) {
      case 'edit-profile':
        return (
          <div className="h-full flex flex-col p-4">
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="icon" onClick={() => setPanelView('main')} data-testid="button-back-edit-profile">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-semibold">{t('profile.editProfile', 'Edit Profile')}</h2>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="space-y-4 pr-2">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <Label className="text-sm font-medium mb-3 block">{t('profile.profileImage', 'Profile Image')}</Label>
                  <div className="flex items-center gap-4">
                    <Avatar className="w-20 h-20 border-2 border-primary/30">
                      <AvatarImage src={user?.profileImageUrl || undefined} />
                      <AvatarFallback className="text-2xl bg-muted">
                        {displayName[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      {profile?.isPremium ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleImageClick}
                          disabled={updateImageMutation.isPending}
                          data-testid="button-change-image"
                        >
                          {updateImageMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Camera className="w-4 h-4 mr-2" />
                          )}
                          {t('profile.changeImage', 'Change Image')}
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Lock className="w-4 h-4" />
                          <span>{t('profile.premiumOnly', 'Premium only')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="space-y-2">
                    <Label htmlFor="nickname">{t('profile.nickname', 'Nickname')}</Label>
                    <Input
                      id="nickname"
                      value={editingNickname}
                      onChange={(e) => setEditingNickname(e.target.value)}
                      placeholder={t('profile.enterNickname', 'Enter your nickname')}
                      maxLength={20}
                      data-testid="input-nickname"
                    />
                    <p className="text-xs text-muted-foreground">
                      {editingNickname.length}/20 {t('profile.characters', 'characters')}
                    </p>
                  </div>
                  <Button
                    onClick={handleNicknameSubmit}
                    disabled={updateNicknameMutation.isPending || !editingNickname.trim()}
                    className="w-full mt-3"
                    size="sm"
                    data-testid="button-save-nickname"
                  >
                    {updateNicknameMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {t('common.save', 'Save')}
                  </Button>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <Label className="text-sm font-medium mb-3 block">{t('profile.title', 'Title')}</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    <button
                      onClick={() => setSelectedTitleId(null)}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors ${
                        selectedTitleId === null ? 'bg-primary/20 border border-primary' : 'bg-muted/30 hover:bg-muted/50'
                      }`}
                    >
                      <Award className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{t('titles.noTitle', 'No Title')}</span>
                    </button>
                    {getAllTitleIds().filter(id => ownedTitles.includes(id)).map((titleId) => (
                      <button
                        key={titleId}
                        onClick={() => setSelectedTitleId(titleId)}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors ${
                          selectedTitleId === titleId ? 'bg-primary/20 border border-primary' : 'bg-muted/30 hover:bg-muted/50'
                        }`}
                      >
                        <TitleBadge titleId={titleId as TitleId} size="sm" />
                      </button>
                    ))}
                  </div>
                  <Button
                    onClick={() => updateTitleMutation.mutate(selectedTitleId)}
                    disabled={updateTitleMutation.isPending}
                    className="w-full mt-3"
                    size="sm"
                    data-testid="button-save-title"
                  >
                    {updateTitleMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {t('common.save', 'Save')}
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </div>
        );

      case 'edit-nickname':
        return (
          <div className="h-full flex flex-col p-4">
            <div className="flex items-center gap-2 mb-6">
              <Button variant="ghost" size="icon" onClick={() => setPanelView('main')} data-testid="button-back-nickname">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-semibold">{t('profile.editNickname', 'Edit Nickname')}</h2>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nickname">{t('profile.nickname', 'Nickname')}</Label>
                <Input
                  id="nickname"
                  value={editingNickname}
                  onChange={(e) => setEditingNickname(e.target.value)}
                  placeholder={t('profile.enterNickname', 'Enter your nickname')}
                  maxLength={20}
                  data-testid="input-nickname"
                />
                <p className="text-xs text-muted-foreground">
                  {editingNickname.length}/20 {t('profile.characters', 'characters')}
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={handleNicknameSubmit}
                  disabled={updateNicknameMutation.isPending || !editingNickname.trim()}
                  className="flex-1"
                  data-testid="button-save-nickname"
                >
                  {updateNicknameMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  {t('common.save', 'Save')}
                </Button>
                <Button variant="outline" onClick={() => setPanelView('main')} data-testid="button-cancel-nickname">
                  <X className="w-4 h-4 mr-2" />
                  {t('common.cancel', 'Cancel')}
                </Button>
              </div>
            </div>
          </div>
        );

      case 'edit-title':
        return (
          <div className="h-full flex flex-col p-4">
            <div className="flex items-center gap-2 mb-6">
              <Button variant="ghost" size="icon" onClick={() => setPanelView('main')} data-testid="button-back-title">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-semibold">{t('titles.selectTitle', 'Select Title')}</h2>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedTitleId(null)}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    selectedTitleId === null
                      ? 'bg-primary/20 border-primary'
                      : 'bg-muted/30 border-transparent hover:bg-muted/50'
                  }`}
                  data-testid="button-title-none"
                >
                  <span className="text-muted-foreground">{t('titles.noTitle', 'No Title')}</span>
                </button>
                
                {getAllTitleIds().map((titleId) => {
                  const isOwned = ownedTitles.includes(titleId);
                  const isSelected = selectedTitleId === titleId;
                  
                  return (
                    <button
                      key={titleId}
                      onClick={() => isOwned && setSelectedTitleId(titleId)}
                      disabled={!isOwned}
                      className={`w-full p-3 rounded-lg border text-left transition-colors ${
                        isSelected 
                          ? 'bg-primary/20 border-primary' 
                          : isOwned 
                            ? 'bg-muted/30 border-transparent hover:bg-muted/50' 
                            : 'bg-muted/10 border-transparent opacity-50 cursor-not-allowed'
                      }`}
                      data-testid={`button-title-${titleId}`}
                    >
                      <div className="flex items-center justify-between">
                        <TitleBadge titleId={titleId as TitleId} size="sm" showBackground />
                        {!isOwned && <Lock className="w-4 h-4 text-muted-foreground" />}
                        {isSelected && isOwned && <Check className="w-4 h-4 text-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
            
            <div className="pt-4 mt-4 border-t">
              <Button
                onClick={() => updateTitleMutation.mutate(selectedTitleId)}
                disabled={updateTitleMutation.isPending}
                className="w-full"
                data-testid="button-save-title"
              >
                {updateTitleMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                {t('common.save', 'Save')}
              </Button>
            </div>
          </div>
        );

      case 'statistics':
        return (
          <div className="h-full flex flex-col p-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setPanelView('main')} data-testid="button-back-stats">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <h2 className="text-lg font-semibold">{t('account.stats', 'Statistics')}</h2>
              </div>
              <button
                onClick={() => navigateTo('my-statistics')}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                data-testid="button-stats-detail"
              >
                {t('ranking.viewDetail', 'View Details')}
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">{t('account.modeHighScores', 'Mode High Scores')}</h3>
                  <div className="space-y-2">
                    {filteredHighScores.map(hs => (
                      <div key={hs.mode} className="bg-muted/30 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getModeIcon(hs.mode)}
                          <span className="text-sm">{t(`modes.${hs.mode}`, hs.mode)}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{hs.highScore.toLocaleString()}</p>
                          {hs.bestTime && (
                            <p className="text-xs text-muted-foreground">{formatTimeShort(hs.bestTime)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        );

      case 'premium':
      case 'subscription':
        return (
          <div className="h-full flex flex-col p-4">
            <div className="flex items-center gap-2 mb-6">
              <Button variant="ghost" size="icon" onClick={() => setPanelView('main')} data-testid="button-back-premium">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-semibold">{t('account.premiumPlan', 'Premium Plan')}</h2>
            </div>
            
            <div className="flex-1 flex flex-col">
              {profile?.isPremium ? (
                <div className="space-y-4">
                  <div className="text-center p-6 bg-gradient-to-br from-yellow-500/20 to-amber-600/20 rounded-xl border border-yellow-500/30">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center mx-auto mb-3">
                      <Crown className="w-8 h-8 text-black" />
                    </div>
                    <h3 className="text-xl font-bold">{t('premium.active', 'Premium Active')}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{t('premium.thankYou', 'Thank you for supporting TETMEER!')}</p>
                  </div>
                  
                  {subscriptionLoading ? (
                    <Skeleton className="h-24 rounded-lg" />
                  ) : activeSubscription ? (
                    <div className="space-y-3">
                      <div className="bg-muted/30 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">{t('account.plan', 'Plan')}</p>
                        <p className="font-medium">{activeSubscription.productName}</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">{t('account.nextBilling', 'Next Billing')}</p>
                        <p className="font-medium">{new Date(activeSubscription.currentPeriodEnd).toLocaleDateString()}</p>
                      </div>
                      
                      <div className="space-y-2 pt-2">
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={openBillingPortal}
                          disabled={billingPortalLoading}
                          data-testid="button-billing-portal"
                        >
                          {billingPortalLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                          {t('account.manageBilling', 'Manage Billing')}
                        </Button>
                        
                        {activeSubscription.cancelAtPeriodEnd ? (
                          <Button
                            className="w-full"
                            onClick={() => reactivateSubscriptionMutation.mutate(activeSubscription.id)}
                            disabled={reactivateSubscriptionMutation.isPending}
                            data-testid="button-reactivate"
                          >
                            {reactivateSubscriptionMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {t('account.reactivateSubscription', 'Reactivate')}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            className="w-full text-red-500 hover:text-red-400"
                            onClick={() => cancelSubscriptionMutation.mutate(activeSubscription.id)}
                            disabled={cancelSubscriptionMutation.isPending}
                            data-testid="button-cancel-subscription"
                          >
                            {cancelSubscriptionMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {t('account.cancelSubscription', 'Cancel Subscription')}
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <Crown className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold">{t('premium.notActive', 'No Premium')}</h3>
                  <p className="text-muted-foreground text-sm mt-2 mb-6">
                    {t('premium.upgradeDesc', 'Upgrade to unlock exclusive features!')}
                  </p>
                  <div className="space-y-2 w-full">
                    <div className="flex items-center gap-2 text-sm">
                      <Sparkles className="w-4 h-4 text-yellow-500" />
                      <span>{t('premium.feature1', 'Exclusive cosmetics')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Camera className="w-4 h-4 text-yellow-500" />
                      <span>{t('premium.feature2', 'Custom profile image')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span>{t('premium.feature3', 'Premium badge')}</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => navigateTo('premium')}
                    className="mt-6 bg-gradient-to-r from-yellow-500 to-amber-600 text-black hover:from-yellow-600 hover:to-amber-700"
                    data-testid="button-upgrade-premium"
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    {t('premium.upgrade', 'Upgrade to Premium')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="h-full flex flex-col p-4">
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="icon" onClick={() => setPanelView('main')} data-testid="button-back-settings">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-semibold">{t('nav.settings', 'Settings')}</h2>
            </div>
            
            <div className="space-y-2">
              <button
                onClick={() => setPanelView('interface-settings')}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                data-testid="button-interface-settings"
              >
                <div className="flex items-center gap-3">
                  <Palette className="w-5 h-5 text-purple-500" />
                  <div className="text-left">
                    <span className="font-medium block">{t('settings.interfaceSettings', 'Interface')}</span>
                    <span className="text-xs text-muted-foreground">{t('settings.interfaceDesc', 'Colors, textures, decorations')}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
              
              <button
                onClick={() => setPanelView('controls-settings')}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                data-testid="button-controls-settings"
              >
                <div className="flex items-center gap-3">
                  <Gamepad2 className="w-5 h-5 text-cyan-500" />
                  <div className="text-left">
                    <span className="font-medium block">{t('settings.controlSettings', 'Controls')}</span>
                    <span className="text-xs text-muted-foreground">{t('settings.controlsDesc', 'Camera, sensitivity')}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
              
              <button
                onClick={() => setPanelView('background-settings')}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                data-testid="button-background-settings"
              >
                <div className="flex items-center gap-3">
                  <Image className="w-5 h-5 text-green-500" />
                  <div className="text-left">
                    <span className="font-medium block">{t('settings.background', 'Background')}</span>
                    <span className="text-xs text-muted-foreground">{t('settings.backgroundDesc', 'Custom background image')}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        );

      case 'interface-settings':
        return (
          <InterfaceSettings
            settings={settings}
            inventory={inventoryData?.inventory}
            onBack={() => setPanelView('settings')}
            onSaved={() => setPanelView('settings')}
          />
        );

      case 'controls-settings':
        return (
          <ControlsSettings
            settings={settings}
            onBack={() => setPanelView('settings')}
            onSaved={() => setPanelView('settings')}
          />
        );

      case 'background-settings':
        return (
          <div className="h-full flex flex-col p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setPanelView('settings')} data-testid="button-back-background">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <h2 className="text-lg font-semibold">{t('settings.background', 'Background')}</h2>
              </div>
              {bgHasChanges && (
                <Button size="sm" onClick={() => updateBackgroundMutation.mutate({ backgroundImage: editBackgroundImage })} disabled={updateBackgroundMutation.isPending} data-testid="button-save-background">
                  {updateBackgroundMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                  {t('common.save', 'Save')}
                </Button>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <Label className="text-sm font-medium mb-3 block">{t('settings.uploadImage', 'Upload Image')}</Label>
                <input ref={bgFileInputRef} type="file" accept="image/*" onChange={handleBgFileSelect} className="hidden" />
                <Button variant="outline" onClick={() => bgFileInputRef.current?.click()} disabled={bgUploading} className="w-full h-20 border-dashed border-2">
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-5 h-5" />
                    <span className="text-xs">{bgUploading ? t('settings.uploading', 'Uploading...') : t('settings.clickToUpload', 'Click to upload')}</span>
                  </div>
                </Button>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                  <AlertCircle className="w-3 h-3" />
                  <span>{t('settings.maxFileSizeNote', 'Max 10MB')}</span>
                </div>
              </div>

              {editBackgroundImage && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                  <Label className="text-sm font-medium">{t('settings.currentBackground', 'Current Background')}</Label>
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-white/10">
                    <img src={editBackgroundImage} alt="Background" className="w-full h-full object-cover" />
                  </div>
                  <Button variant="outline" className="w-full text-red-500 hover:text-red-400" onClick={() => { setEditBackgroundImage(null); setBgHasChanges(true); }}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('settings.removeBackground', 'Remove Background')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        );

      case 'ranking-summary':
        const summaryRankTier = progression?.rankTier || 'unranked';
        const summaryRankDivision = progression?.rankDivision || 'IV';
        const summaryRankPoints = progression?.rankPoints || 0;
        const summaryRankedWins = progression?.rankedWins || 0;
        const summaryRankedLosses = progression?.rankedLosses || 0;
        const summaryWinRate = summaryRankedWins + summaryRankedLosses > 0 
          ? Math.round((summaryRankedWins / (summaryRankedWins + summaryRankedLosses)) * 100) 
          : 0;
        const summaryIsPlacementComplete = progression?.isPlacementComplete || false;
        const summaryPlacementMatchesPlayed = progression?.placementMatchesPlayed || 0;

        return (
          <div className="p-3 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setPanelView('main')} data-testid="button-back-ranking">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <h3 className="font-bold">{t('ranking.myRanking', 'My Ranking')}</h3>
              </div>
              <button
                onClick={() => navigateTo('my-ranking')}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                data-testid="button-ranking-detail"
              >
                {t('ranking.viewDetail', 'View Details')}
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <Trophy className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
              <p className="text-2xl font-bold capitalize">{summaryRankTier}</p>
              <p className="text-sm text-muted-foreground">{summaryRankDivision} • {summaryRankPoints} LP</p>
            </div>

            {!summaryIsPlacementComplete && (
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-medium text-cyan-400">{t('ranking.placementMatches', 'Placement Matches')}</span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 flex-1 rounded-full ${i < summaryPlacementMatchesPlayed ? 'bg-cyan-500' : 'bg-white/10'}`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">{summaryPlacementMatchesPlayed}/10 {t('ranking.completed', 'Completed')}</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-green-500">{summaryRankedWins}</p>
                <p className="text-xs text-muted-foreground">{t('ranking.wins', 'Wins')}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-red-500">{summaryRankedLosses}</p>
                <p className="text-xs text-muted-foreground">{t('ranking.losses', 'Losses')}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-cyan-400">{summaryWinRate}%</p>
                <p className="text-xs text-muted-foreground">{t('ranking.winRate', 'Win Rate')}</p>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => {
                    setEditingNickname(user?.nickname || user?.firstName || '');
                    setSelectedTitleId(titlesData?.selectedTitle || null);
                    setPanelView('edit-profile');
                  }}
                  data-testid="button-edit-profile"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16 border-2 border-primary/30 flex-shrink-0">
                    <AvatarImage src={user?.profileImageUrl || undefined} />
                    <AvatarFallback className="text-xl bg-muted">
                      {displayName[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0 space-y-1">
                    <h1 className="text-lg font-bold truncate" data-testid="text-username">{displayName}</h1>
                    
                    <div className="flex items-center gap-2">
                      {titlesData?.selectedTitle ? (
                        <TitleBadge titleId={titlesData.selectedTitle as TitleId} size="sm" showBackground />
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          <Award className="w-3 h-3 mr-1 text-muted-foreground" />
                          {t('titles.noTitle', 'No Title')}
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    
                    {profile?.isPremium && (
                      <Badge className="bg-gradient-to-r from-yellow-500 to-amber-600 text-black text-xs">
                        <Crown className="w-3 h-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground">{t('ranking.myRanking', 'My Ranking')}</span>
                  <button
                    onClick={() => setPanelView('ranking-summary')}
                    className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    data-testid="button-view-ranking"
                  >
                    {t('common.viewMore', 'View More')}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <Trophy className="w-4 h-4 text-yellow-500 mx-auto mb-1" />
                    <p className="text-sm font-bold capitalize">{progression?.rankTier || 'Unranked'}</p>
                    <p className="text-[10px] text-muted-foreground">{progression?.rankDivision || '-'}</p>
                  </div>
                  <div className="text-center">
                    <Swords className="w-4 h-4 text-green-500 mx-auto mb-1" />
                    <p className="text-sm font-bold">{progression?.rankedWins || 0}W / {progression?.rankedLosses || 0}L</p>
                    <p className="text-[10px] text-muted-foreground">{t('ranking.record', 'Record')}</p>
                  </div>
                  <div className="text-center">
                    <Target className="w-4 h-4 text-cyan-500 mx-auto mb-1" />
                    <p className="text-sm font-bold">
                      {(progression?.rankedWins || 0) + (progression?.rankedLosses || 0) > 0 
                        ? Math.round(((progression?.rankedWins || 0) / ((progression?.rankedWins || 0) + (progression?.rankedLosses || 0))) * 100) 
                        : 0}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">{t('ranking.winRate', 'Win Rate')}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setPanelView('statistics')}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                data-testid="button-view-stats"
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-cyan-500" />
                  <span className="font-medium">{t('account.stats', 'Statistics')}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
              
              <button
                onClick={() => navigateTo('achievements')}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                data-testid="button-achievements"
              >
                <div className="flex items-center gap-3">
                  <Medal className="w-5 h-5 text-yellow-500" />
                  <span className="font-medium">{t('achievements.title', 'Achievements')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{unlockedCount}/{totalAchievements}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
              
              <button
                onClick={() => setPanelView('premium')}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                data-testid="button-view-premium"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-amber-500" />
                  <span className="font-medium">{t('account.premiumPlan', 'Premium Plan')}</span>
                </div>
                <div className="flex items-center gap-2">
                  {profile?.isPremium && (
                    <Badge className="bg-amber-500/20 text-amber-500 text-xs">
                      {t('premium.active', 'Active')}
                    </Badge>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>

              <button
                onClick={() => setPanelView('settings')}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                data-testid="button-settings"
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">{t('nav.settings', 'Settings')}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </ScrollArea>
        );
    }
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <Header />
      <main 
        className="fixed overflow-hidden flex flex-col transition-all duration-300 ease-out"
        style={{ 
          left: expanded ? '240px' : '88px',
          top: 'calc(3.5rem + 1rem)',
          bottom: '1rem',
          right: '1rem'
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 flex-1 min-h-0">
          <div 
            className="relative h-full min-h-[400px] rounded-xl overflow-hidden"
            data-testid="account-preview-canvas"
          >
            {profileLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <AccountWorld3D />
            )}
          </div>

          <div className="h-full overflow-hidden">
            {profileLoading ? (
              <div className="p-4 space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <Skeleton className="w-24 h-24 rounded-full" />
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              </div>
            ) : (
              renderPanelContent()
            )}
          </div>
        </div>
      </main>

      {/* Item Info Modal */}
      <Dialog open={itemInfoModalOpen} onOpenChange={setItemInfoModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              {t('shop.itemInfo', 'Item Info')}
            </DialogTitle>
            <DialogDescription>
              {t('shop.itemDetails', 'Details about this item')}
            </DialogDescription>
          </DialogHeader>
          {selectedItemForInfo && (() => {
            const itemDef = DECORATION_ITEMS[selectedItemForInfo as DecorationItem];
            const shopItem = getShopItem(selectedItemForInfo);
            const inventoryItem = inventoryData?.inventory?.find(
              (inv: UserInventory) => inv.itemType === selectedItemForInfo
            );
            const expiryDate = inventoryItem?.expiresAt ? new Date(inventoryItem.expiresAt) : null;
            const isExpired = expiryDate && expiryDate < new Date();
            const remainingTime = expiryDate ? Math.max(0, expiryDate.getTime() - Date.now()) : null;
            const remainingDays = remainingTime ? Math.ceil(remainingTime / (24 * 60 * 60 * 1000)) : null;
            
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-muted/30 rounded-xl flex items-center justify-center">
                    <ItemPreview3D itemType="decoration" itemId={selectedItemForInfo} size={60} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{itemDef?.name || selectedItemForInfo}</h3>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {t('shop.category', 'Category')}
                    </span>
                    <span className="font-medium capitalize">{itemDef?.category || 'Unknown'}</span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Gem className="w-3 h-3" />
                      {t('shop.quantity', 'Quantity')}
                    </span>
                    <span className="font-medium">{inventoryItem?.quantity || 0}</span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {t('shop.acquiredDate', 'Acquired')}
                    </span>
                    <span className="font-medium">
                      {inventoryItem?.purchasedAt 
                        ? new Date(inventoryItem.purchasedAt).toLocaleDateString()
                        : t('common.unknown', 'Unknown')}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {t('shop.expiresIn', 'Expires')}
                    </span>
                    <span className={`font-medium ${isExpired ? 'text-red-500' : remainingDays && remainingDays <= 3 ? 'text-amber-500' : ''}`}>
                      {expiryDate 
                        ? (isExpired 
                            ? t('shop.expired', 'Expired') 
                            : t('shop.daysRemaining', '{{days}} days left', { days: remainingDays }))
                        : t('shop.permanent', 'Permanent')}
                    </span>
                  </div>
                </div>
                
                <div className="bg-muted/20 rounded-lg p-3 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      {t('shop.acquisitionSource', 'Obtained From')}
                    </p>
                    <p className="text-sm mt-1 font-medium">
                      {inventoryItem?.acquisitionSource === 'admin_gift' 
                        ? t('shop.giftFromOperator', 'Gift from TETMEER Operator')
                        : inventoryItem?.acquisitionSource === 'shop' 
                          ? t('shop.purchasedFromShop', 'Purchased from Shop')
                          : inventoryItem?.acquisitionSource === 'event'
                            ? t('shop.eventReward', 'Event Reward')
                            : inventoryItem?.acquisitionSource === 'achievement'
                              ? t('shop.achievementReward', 'Achievement Reward')
                              : t('shop.unknownSource', 'Unknown')}
                    </p>
                  </div>
                  
                  <div className="border-t border-border/30 pt-2">
                    <p className="text-xs text-muted-foreground">
                      {t('shop.originalDuration', 'Original Duration')}
                    </p>
                    <p className="text-sm mt-1">
                      {inventoryItem?.duration 
                        ? t(getDurationConfig(inventoryItem.duration as any)?.labelKey || 'shop.duration.unknown', inventoryItem.duration)
                        : t('shop.duration.permanent', 'Permanent')}
                    </p>
                  </div>
                  
                  {inventoryItem?.acquisitionSource === 'shop' && inventoryItem?.purchasedAt && (
                    <div className="border-t border-border/30 pt-2">
                      <p className="text-xs text-muted-foreground">
                        {t('shop.purchaseDetails', 'Purchase Details')}
                      </p>
                      <p className="text-sm mt-1">
                        {new Date(inventoryItem.purchasedAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
