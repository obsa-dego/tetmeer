import { useState, useEffect } from 'react';
import { useNavigation } from '@/contexts/NavigationContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  UserPlus, 
  UserMinus, 
  Ban, 
  ShieldOff, 
  MessageCircle,
  Trophy,
  Clock,
  Target,
  ArrowLeft,
  Crown,
  Star,
  Edit3,
  Check,
  X,
  Medal,
  Gamepad2,
  TrendingUp,
  Zap,
  ChevronRight,
  User as UserIcon,
  Award,
  BarChart3,
  CreditCard,
  Settings,
  Sparkles
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { User, UserProfile as UserProfileType, PlayerProgression, BlockTexture, PlacedDecorations } from '@shared/schema';
import { GameRenderer3D } from '@/components/game/GameRenderer3D';
import { GameState, createInitialGameState, TETROMINO_SHAPES, TETROMINO_COLORS, TetrominoType } from '@/lib/game-engine';
import { parseEquippedDecorations } from "@/lib/decoration-items";
import { ScrollArea } from '@/components/ui/scroll-area';

type GridMaterialType = 'default' | 'glass' | 'metal' | 'neon' | 'hologram' | 'matrix' | 'lava' | 'ice';
type BoardMaterialType = 'default' | 'glass' | 'metal' | 'neon' | 'hologram' | 'matrix' | 'carbon' | 'galaxy';
type ViewModeType = '2d' | '3d';

interface UserProfileData {
  user: User;
  profile: UserProfileType | null;
  progression: PlayerProgression | null;
  isFriend: boolean;
  isBlocked: boolean;
  isBlockedBy: boolean;
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
}

type ProfilePanelView = 'main' | 'edit-nickname' | 'edit-title' | 'statistics' | 'premium';

// All titles available in the system
const ALL_TITLES = [
  { id: 'newcomer', labelKey: 'titles.newcomer' },
  { id: 'block_rookie', labelKey: 'titles.blockRookie' },
  { id: 'line_clearer', labelKey: 'titles.lineClearer' },
  { id: 'combo_starter', labelKey: 'titles.comboStarter' },
  { id: 'tetris_fan', labelKey: 'titles.tetrisFan' },
  { id: 'rising_star', labelKey: 'titles.risingStar' },
  { id: 'speed_demon', labelKey: 'titles.speedDemon' },
  { id: 'marathon_runner', labelKey: 'titles.marathonRunner' },
  { id: 'puzzle_master', labelKey: 'titles.puzzleMaster' },
  { id: 'grand_master', labelKey: 'titles.grandMaster' },
  { id: 'legend', labelKey: 'titles.legend' },
  { id: 'champion', labelKey: 'titles.champion' },
];

function createPreviewGameState(): GameState {
  const state = createInitialGameState('zen');
  
  const previewBlocks: Array<{ x: number; y: number; type: TetrominoType }> = [
    { x: 1, y: 17, type: 'I' }, { x: 2, y: 17, type: 'I' }, { x: 3, y: 17, type: 'I' }, { x: 4, y: 17, type: 'I' },
    { x: 0, y: 18, type: 'L' }, { x: 1, y: 18, type: 'L' }, { x: 2, y: 18, type: 'L' }, { x: 0, y: 19, type: 'L' },
    { x: 5, y: 18, type: 'T' }, { x: 5, y: 19, type: 'T' }, { x: 6, y: 19, type: 'T' }, { x: 7, y: 19, type: 'T' },
    { x: 8, y: 18, type: 'O' }, { x: 9, y: 18, type: 'O' }, { x: 8, y: 19, type: 'O' }, { x: 9, y: 19, type: 'O' },
    { x: 3, y: 14, type: 'S' }, { x: 4, y: 14, type: 'S' }, { x: 4, y: 15, type: 'S' }, { x: 5, y: 15, type: 'S' },
    { x: 6, y: 13, type: 'Z' }, { x: 7, y: 13, type: 'Z' }, { x: 5, y: 14, type: 'Z' }, { x: 6, y: 14, type: 'Z' },
  ];

  previewBlocks.forEach(block => {
    const color = TETROMINO_COLORS[block.type];
    state.board[block.y][block.x] = color;
  });

  state.currentPiece = {
    type: 'T',
    shape: TETROMINO_SHAPES['T'],
    position: { x: 4, y: 5 },
    color: TETROMINO_COLORS['T'],
    rotationState: 0,
  };

  return state;
}

export default function UserProfile() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { params, navigateTo } = useNavigation();

  const userId = params?.userId;
  const isOwnProfile = currentUser?.id === userId;

  // Panel navigation state
  const [panelView, setPanelView] = useState<ProfilePanelView>('main');
  
  // Edit states
  const [editingNickname, setEditingNickname] = useState('');
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);

  // Preview game state
  const [previewGameState] = useState<GameState>(createPreviewGameState);

  // Fetch profile data
  const { data: profileData, isLoading } = useQuery<UserProfileData>({
    queryKey: [`/api/users/${userId}`],
    enabled: !!userId && !!currentUser,
  });

  // Fetch user settings for preview
  const { data: settings } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
    enabled: !!currentUser && isOwnProfile,
  });

  // Parse settings for preview
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

  // Update nickname mutation
  const updateNicknameMutation = useMutation({
    mutationFn: async (nickname: string) => {
      return apiRequest('PATCH', '/api/user/profile', { nickname });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: t('profile.nicknameUpdated', 'Nickname Updated'),
        description: t('profile.nicknameUpdatedDesc', 'Your nickname has been saved'),
      });
      setPanelView('main');
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('profile.nicknameUpdateError', 'Failed to update nickname'),
        variant: 'destructive',
      });
    },
  });

  // Update title mutation
  const updateTitleMutation = useMutation({
    mutationFn: async (title: string | null) => {
      return apiRequest('PATCH', '/api/user/profile', { selectedTitle: title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
      toast({
        title: t('profile.titleUpdated', 'Title Updated'),
        description: t('profile.titleUpdatedDesc', 'Your title has been saved'),
      });
      setPanelView('main');
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('profile.titleUpdateError', 'Failed to update title'),
        variant: 'destructive',
      });
    },
  });

  // Social mutations
  const addFriendMutation = useMutation({
    mutationFn: async () => apiRequest('POST', `/api/friends/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
      toast({ title: t('profile.friendAdded'), description: t('profile.friendAddedDesc') });
    },
    onError: () => {
      toast({ title: t('common.error'), description: t('profile.friendAddError'), variant: 'destructive' });
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: async () => apiRequest('DELETE', `/api/friends/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
      toast({ title: t('profile.friendRemoved'), description: t('profile.friendRemovedDesc') });
    },
  });

  const blockUserMutation = useMutation({
    mutationFn: async () => apiRequest('POST', `/api/blocks/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/blocks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
      toast({ title: t('profile.userBlocked'), description: t('profile.userBlockedDesc') });
    },
  });

  const unblockUserMutation = useMutation({
    mutationFn: async () => apiRequest('DELETE', `/api/blocks/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/blocks'] });
      toast({ title: t('profile.userUnblocked'), description: t('profile.userUnblockedDesc') });
    },
  });

  const handleStartChat = async () => {
    try {
      await apiRequest('POST', '/api/conversations', { otherUserId: userId });
      navigateTo('social');
    } catch {
      toast({ title: t('common.error'), description: t('profile.chatError'), variant: 'destructive' });
    }
  };

  // Initialize edit states when profile data loads
  useEffect(() => {
    if (profileData?.user) {
      setEditingNickname(profileData.user.nickname || '');
    }
    if (profileData?.profile) {
      setSelectedTitle(profileData.profile.selectedTitle || null);
    }
  }, [profileData]);

  const getDisplayName = (): string => {
    if (!profileData?.user) return '';
    const user = profileData.user;
    if (user.nickname) return user.nickname;
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email?.split('@')[0] || 'User';
  };

  const getRankTierLabel = (tier: string | undefined): string => {
    if (!tier || tier === 'unranked') return t('ranked.unranked');
    return t(`ranked.${tier}`);
  };

  const formatPlayTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getTitleLabel = (titleId: string | null | undefined): string => {
    if (!titleId) return t('profile.noTitle', 'No Title');
    const title = ALL_TITLES.find(t => t.id === titleId);
    return title ? t(title.labelKey, titleId) : titleId;
  };

  if (!userId) {
    return null;
  }

  // Render different panel views
  const renderPanelContent = () => {
    switch (panelView) {
      case 'edit-nickname':
        return (
          <div className="h-full flex flex-col p-4">
            <div className="flex items-center gap-2 mb-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPanelView('main')}
                data-testid="button-back-nickname"
              >
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
                  onClick={() => updateNicknameMutation.mutate(editingNickname)}
                  disabled={updateNicknameMutation.isPending || !editingNickname.trim()}
                  className="flex-1"
                  data-testid="button-save-nickname"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {t('common.save', 'Save')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPanelView('main')}
                  data-testid="button-cancel-nickname"
                >
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPanelView('main')}
                data-testid="button-back-title"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-semibold">{t('profile.selectTitle', 'Select Title')}</h2>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedTitle(null)}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    selectedTitle === null
                      ? 'bg-primary/20 border-primary'
                      : 'bg-muted/30 border-transparent hover:bg-muted/50'
                  }`}
                  data-testid="button-title-none"
                >
                  <span className="text-muted-foreground">{t('profile.noTitle', 'No Title')}</span>
                </button>
                
                {ALL_TITLES.map((title) => (
                  <button
                    key={title.id}
                    onClick={() => setSelectedTitle(title.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      selectedTitle === title.id
                        ? 'bg-primary/20 border-primary'
                        : 'bg-muted/30 border-transparent hover:bg-muted/50'
                    }`}
                    data-testid={`button-title-${title.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-yellow-500" />
                      <span>{t(title.labelKey, title.id)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
            
            <div className="pt-4 mt-4 border-t">
              <Button
                onClick={() => updateTitleMutation.mutate(selectedTitle)}
                disabled={updateTitleMutation.isPending}
                className="w-full"
                data-testid="button-save-title"
              >
                <Check className="w-4 h-4 mr-2" />
                {t('common.save', 'Save')}
              </Button>
            </div>
          </div>
        );

      case 'statistics':
        return (
          <div className="h-full flex flex-col p-4">
            <div className="flex items-center gap-2 mb-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPanelView('main')}
                data-testid="button-back-stats"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-semibold">{t('profile.detailedStats', 'Detailed Statistics')}</h2>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="space-y-4">
                {/* General Stats */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">{t('profile.generalStats', 'General')}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        <span className="text-xs">{t('stats.highScore', 'High Score')}</span>
                      </div>
                      <p className="text-lg font-bold" data-testid="text-stat-highscore">
                        {(profileData?.profile?.highScore || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Gamepad2 className="w-4 h-4 text-cyan-500" />
                        <span className="text-xs">{t('stats.gamesPlayed', 'Games Played')}</span>
                      </div>
                      <p className="text-lg font-bold" data-testid="text-stat-games">
                        {profileData?.profile?.totalGamesPlayed || 0}
                      </p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Clock className="w-4 h-4 text-purple-500" />
                        <span className="text-xs">{t('stats.playTime', 'Play Time')}</span>
                      </div>
                      <p className="text-lg font-bold" data-testid="text-stat-playtime">
                        {formatPlayTime(profileData?.profile?.totalPlayTime || 0)}
                      </p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Target className="w-4 h-4 text-green-500" />
                        <span className="text-xs">{t('stats.linesCleared', 'Lines Cleared')}</span>
                      </div>
                      <p className="text-lg font-bold" data-testid="text-stat-lines">
                        {profileData?.profile?.totalLinesCleared || 0}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Ranked Stats */}
                {profileData?.progression && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">{t('profile.rankedStats', 'Ranked')}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-muted/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <TrendingUp className="w-4 h-4 text-green-500" />
                          <span className="text-xs">{t('ranked.wins', 'Wins')}</span>
                        </div>
                        <p className="text-lg font-bold text-green-500" data-testid="text-stat-wins">
                          {profileData.progression.rankedWins}
                        </p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <X className="w-4 h-4 text-red-500" />
                          <span className="text-xs">{t('ranked.losses', 'Losses')}</span>
                        </div>
                        <p className="text-lg font-bold text-red-500" data-testid="text-stat-losses">
                          {profileData.progression.rankedLosses}
                        </p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Zap className="w-4 h-4 text-orange-500" />
                          <span className="text-xs">{t('ranked.winStreak', 'Win Streak')}</span>
                        </div>
                        <p className="text-lg font-bold text-orange-500" data-testid="text-stat-streak">
                          {profileData.progression.winStreak}
                        </p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Medal className="w-4 h-4 text-yellow-500" />
                          <span className="text-xs">{t('ranked.bestStreak', 'Best Streak')}</span>
                        </div>
                        <p className="text-lg font-bold text-yellow-500" data-testid="text-stat-beststreak">
                          {profileData.progression.bestWinStreak}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        );

      case 'premium':
        return (
          <div className="h-full flex flex-col p-4">
            <div className="flex items-center gap-2 mb-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPanelView('main')}
                data-testid="button-back-premium"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-semibold">{t('profile.premiumStatus', 'Premium Status')}</h2>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              {profileData?.profile?.isPremium ? (
                <div className="space-y-4">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center mx-auto">
                    <Crown className="w-10 h-10 text-black" />
                  </div>
                  <h3 className="text-xl font-bold">{t('premium.active', 'Premium Active')}</h3>
                  <p className="text-muted-foreground text-sm">
                    {t('premium.thankYou', 'Thank you for supporting TETMEER!')}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Badge className="bg-gradient-to-r from-yellow-500 to-amber-600 text-black">
                      <Sparkles className="w-3 h-3 mr-1" />
                      {t('premium.exclusiveContent', 'Exclusive Content')}
                    </Badge>
                    <Badge className="bg-gradient-to-r from-yellow-500 to-amber-600 text-black">
                      <Star className="w-3 h-3 mr-1" />
                      {t('premium.noAds', 'No Ads')}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
                    <Crown className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold">{t('premium.notActive', 'No Premium')}</h3>
                  <p className="text-muted-foreground text-sm">
                    {t('premium.upgradeDesc', 'Upgrade to unlock exclusive features!')}
                  </p>
                  <Button
                    onClick={() => navigateTo('shop')}
                    className="bg-gradient-to-r from-yellow-500 to-amber-600 text-black hover:from-yellow-600 hover:to-amber-700"
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

      default: // main view
        return (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* Profile Header */}
              <div className="flex flex-col items-center text-center space-y-3">
                <Avatar className="w-24 h-24 border-4 border-primary/30">
                  <AvatarImage src={profileData?.user?.profileImageUrl || undefined} />
                  <AvatarFallback className="text-3xl bg-muted">
                    {getDisplayName()[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <h1 className="text-xl font-bold" data-testid="text-username">
                      {getDisplayName()}
                    </h1>
                    {isOwnProfile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setEditingNickname(profileData?.user?.nickname || '');
                          setPanelView('edit-nickname');
                        }}
                        data-testid="button-edit-nickname"
                      >
                        <Edit3 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Title */}
                  <div className="flex items-center justify-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      <Award className="w-3 h-3 mr-1 text-yellow-500" />
                      {getTitleLabel(profileData?.profile?.selectedTitle)}
                    </Badge>
                    {isOwnProfile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => {
                          setSelectedTitle(profileData?.profile?.selectedTitle || null);
                          setPanelView('edit-title');
                        }}
                        data-testid="button-edit-title"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Level & Rank */}
                  <div className="flex items-center justify-center gap-2">
                    {profileData?.progression && (
                      <>
                        <Badge variant="outline" className="text-xs text-primary border-primary">
                          <Star className="w-3 h-3 mr-1" />
                          Lv. {profileData.progression.level}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {getRankTierLabel(profileData.progression.rankTier)}
                        </Badge>
                      </>
                    )}
                    {profileData?.profile?.isPremium && (
                      <Badge className="bg-gradient-to-r from-yellow-500 to-amber-600 text-black text-xs">
                        <Crown className="w-3 h-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-muted/30 rounded-lg p-2 text-center">
                  <Trophy className="w-4 h-4 text-yellow-500 mx-auto mb-1" />
                  <p className="text-sm font-bold" data-testid="text-highscore">
                    {((profileData?.profile?.highScore || 0) / 1000).toFixed(0)}K
                  </p>
                  <p className="text-[10px] text-muted-foreground">{t('stats.highScore', 'High Score')}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2 text-center">
                  <Gamepad2 className="w-4 h-4 text-cyan-500 mx-auto mb-1" />
                  <p className="text-sm font-bold" data-testid="text-games">
                    {profileData?.profile?.totalGamesPlayed || 0}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{t('stats.games', 'Games')}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2 text-center">
                  <Clock className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                  <p className="text-sm font-bold" data-testid="text-playtime">
                    {formatPlayTime(profileData?.profile?.totalPlayTime || 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{t('stats.time', 'Time')}</p>
                </div>
              </div>

              {/* Menu Items */}
              <div className="space-y-1">
                <button
                  onClick={() => setPanelView('statistics')}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  data-testid="button-view-stats"
                >
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-5 h-5 text-cyan-500" />
                    <span className="font-medium">{t('profile.statistics', 'Statistics')}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
                
                <button
                  onClick={() => setPanelView('premium')}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  data-testid="button-view-premium"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-amber-500" />
                    <span className="font-medium">{t('profile.premiumPlan', 'Premium Plan')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {profileData?.profile?.isPremium && (
                      <Badge className="bg-amber-500/20 text-amber-500 text-xs">
                        {t('premium.active', 'Active')}
                      </Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>

                {isOwnProfile && (
                  <button
                    onClick={() => navigateTo('settings')}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    data-testid="button-settings"
                  >
                    <div className="flex items-center gap-3">
                      <Settings className="w-5 h-5 text-muted-foreground" />
                      <span className="font-medium">{t('nav.settings', 'Settings')}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Social Actions (for other users) */}
              {!isOwnProfile && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  {profileData?.isBlocked ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => unblockUserMutation.mutate()}
                      disabled={unblockUserMutation.isPending}
                      data-testid="button-unblock"
                    >
                      <ShieldOff className="w-4 h-4 mr-2" />
                      {t('profile.unblock', 'Unblock')}
                    </Button>
                  ) : (
                    <>
                      {profileData?.isFriend ? (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => removeFriendMutation.mutate()}
                          disabled={removeFriendMutation.isPending}
                          data-testid="button-remove-friend"
                        >
                          <UserMinus className="w-4 h-4 mr-2" />
                          {t('profile.removeFriend', 'Remove Friend')}
                        </Button>
                      ) : (
                        <Button
                          className="w-full bg-lime-500 hover:bg-lime-600 text-black"
                          onClick={() => addFriendMutation.mutate()}
                          disabled={addFriendMutation.isPending}
                          data-testid="button-add-friend"
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          {t('profile.addFriend', 'Add Friend')}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleStartChat}
                        data-testid="button-message"
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        {t('profile.message', 'Message')}
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => blockUserMutation.mutate()}
                        disabled={blockUserMutation.isPending}
                        data-testid="button-block"
                      >
                        <Ban className="w-4 h-4 mr-2" />
                        {t('profile.block', 'Block')}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        );
    }
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 pt-16 pb-4 overflow-hidden">
        <div className="flex items-center gap-3 mb-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigateTo('landing')}
            data-testid="button-back-profile"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t('common.back', 'Back')}
          </Button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <UserIcon className="w-5 h-5" />
              {t('profile.title', 'Profile')}
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 h-[calc(100%-3rem)]">
          {/* Left: Game Preview */}
          <div 
            className="relative h-full min-h-[400px] rounded-xl overflow-hidden"
            data-testid="profile-preview-canvas"
          >
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : profileData?.isBlockedBy ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/20">
                <Ban className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t('profile.blockedByUser', 'You are blocked by this user')}</p>
              </div>
            ) : (
              <GameRenderer3D
                gameState={previewGameState}
                blockTexture={blockTexture}
                backgroundColor={backgroundColor}
                gridColor={gridColor}
                gridMaterial={gridMaterial}
                boardMaterial={boardMaterial}
                showPet={showPet && selectedPets.length > 0}
                selectedPets={selectedPets}
                viewMode={viewMode}
                equippedDecorations={equippedDecorations}
                placedDecorations={placedDecorations}
              />
            )}
          </div>

          {/* Right: Profile Panel */}
          <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl h-full overflow-hidden">
            {isLoading ? (
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
    </div>
  );
}
