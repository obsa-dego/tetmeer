import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigation, PageType } from '@/contexts/NavigationContext';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { NotificationDropdown } from './NotificationDropdown';
import { DMButton, DMPanel } from './DMPanel';
import { PiecePreview } from './game/PiecePreview';
import { useAuth } from '@/hooks/use-auth';
import { loginWithGoogle } from '@/lib/auth-utils';
import { useSidebar } from '@/contexts/SidebarContext';
import { useQuery } from '@tanstack/react-query';
import { 
  User, 
  LogOut, 
  Crown, 
  Settings, 
  Megaphone, 
  ChevronLeft,
  LogIn,
  X,
  Gamepad2,
  ArrowLeft,
  Shield
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SidebarButtonProps {
  icon: React.ReactNode;
  label: string;
  expanded: boolean;
  variant?: 'ghost' | 'secondary';
  onClick?: () => void;
  badge?: React.ReactNode;
}

function SidebarButton({ icon, label, expanded, variant = 'ghost', onClick, badge }: SidebarButtonProps) {
  return (
    <Button
      variant={variant}
      onClick={onClick}
      className="w-full h-10 rounded-xl px-0 overflow-visible"
    >
      <div className={`flex items-center w-full ${expanded ? '' : 'justify-center'}`}>
        <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 relative">
          {icon}
          {badge}
        </div>
        <div 
          className={`overflow-hidden transition-all duration-300 ease-out ${
            expanded ? 'w-[140px] opacity-100' : 'w-0 opacity-0'
          }`}
        >
          <span className="whitespace-nowrap text-sm">{label}</span>
        </div>
      </div>
    </Button>
  );
}

export function FloatingSidebar() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { expanded, toggleExpanded, profileOpen, setProfileOpen } = useSidebar();
  const { currentPage, navigateTo, goBack, canGoBack } = useNavigation();
  const panelRef = useRef<HTMLDivElement>(null);

  const isActive = (page: PageType) => currentPage === page;
  const { isPlaying, gamePieces } = useGame();
  const [maxNextBlocks, setMaxNextBlocks] = useState(3);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Detect ad banner presence in DOM directly
  const [adBannerVisible, setAdBannerVisible] = useState(false);
  
  useEffect(() => {
    // Check if ad banner exists in DOM
    const checkAdBanner = () => {
      const adBanner = document.querySelector('[data-testid="ad-banner"]');
      setAdBannerVisible(!!adBanner);
    };
    
    // Initial check
    checkAdBanner();
    
    // Observe DOM changes to detect ad banner addition/removal
    const observer = new MutationObserver(() => {
      checkAdBanner();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    return () => observer.disconnect();
  }, []);

  // Monitor sidebar height and adjust visible next blocks
  // Use a ref to track if initial calculation is done to avoid "jumping"
  const initialCalcDone = useRef(false);
  
  useEffect(() => {
    if (!isPlaying) {
      initialCalcDone.current = false;
      return;
    }
    
    if (!scrollContainerRef.current) return;

    const updateMaxBlocks = () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      // Use requestAnimationFrame to batch DOM reads/writes and avoid layout thrashing
      requestAnimationFrame(() => {
        const availableHeight = container.clientHeight;
        // Each piece preview is approximately 48px (including gap)
        const pieceHeight = 52;
        const headerHeight = 60; // Hold label + piece + divider
        const nextLabelHeight = 20;
        
        const availableForPieces = availableHeight - headerHeight - nextLabelHeight;
        const optimalBlocks = Math.max(1, Math.min(5, Math.floor(availableForPieces / pieceHeight)));
        
        setMaxNextBlocks(optimalBlocks);
        initialCalcDone.current = true;
      });
    };

    // Delay initial calculation slightly to allow layout to stabilize
    const timeoutId = setTimeout(updateMaxBlocks, 50);
    
    const resizeObserver = new ResizeObserver(() => {
      if (initialCalcDone.current) {
        updateMaxBlocks();
      }
    });
    resizeObserver.observe(scrollContainerRef.current);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [isPlaying]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        const triggerButton = document.querySelector('[data-testid="button-user-menu"]');
        if (triggerButton && !triggerButton.contains(event.target as Node)) {
          setProfileOpen(false);
        }
      }
    };

    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileOpen, setProfileOpen]);

  const { data: adminCheck } = useQuery<{ isAdmin: boolean; role: string | null }>({
    queryKey: ["/api/admin/check"],
    enabled: isAuthenticated,
  });

  const baseMenuItems: Array<{ icon: typeof User; label: string; page: PageType; testId: string }> = [
    { icon: User, label: t('nav.profile'), page: 'account', testId: 'menu-account' },
    { icon: Crown, label: t('nav.premium'), page: 'premium', testId: 'menu-premium' },
    { icon: Settings, label: t('settings.settings'), page: 'more', testId: 'menu-settings' },
  ];
  
  const menuItems = adminCheck?.isAdmin 
    ? [...baseMenuItems, { icon: Shield, label: t('nav.admin', 'Admin'), page: 'admin' as PageType, testId: 'menu-admin' }]
    : baseMenuItems;

  // Calculate offsets to match header spacing
  const topOffset = 'calc(3.5rem + 1rem)'; // 56px header + 16px margin = 72px
  const adBannerHeight = 80; // h-20 = 80px
  const margin = 16;
  
  // Calculate bottom offset based on actual ad banner presence in DOM
  const getBottomOffset = () => {
    if (!adBannerVisible) {
      // No ad banner - just margin from bottom
      return `${margin}px`;
    }
    
    // Ad banner visible: AdBanner + margin
    return `${adBannerHeight + margin}px`;
  };
  
  const bottomOffset = getBottomOffset();

  return (
    <div 
      className="fixed left-4 z-50 transition-all duration-300 ease-out"
      style={{ 
        top: topOffset,
        bottom: bottomOffset,
      }}
      data-testid="floating-sidebar"
    >
      <div 
        className={`
          flex flex-col gap-2 h-full overflow-y-auto overflow-x-hidden
          bg-white/5 backdrop-blur-md
          rounded-2xl border-0
          transition-all duration-300 ease-out
          ${isPlaying ? 'p-3' : 'p-2'}
          ${expanded ? 'w-52' : isPlaying ? 'w-24' : 'w-14'}
        `}
        style={{ 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none',
        }}
      >
        <Button
          variant="ghost"
          onClick={() => navigateTo('landing')}
          className="w-full h-10 rounded-xl px-0 overflow-visible flex-shrink-0"
          data-testid="button-home"
        >
          <div className={`flex items-center w-full ${expanded ? '' : 'justify-center'}`}>
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
              <Gamepad2 className="w-5 h-5 text-primary" />
            </div>
            <div 
              className={`overflow-hidden transition-all duration-300 ease-out ${
                expanded ? 'w-[140px] opacity-100' : 'w-0 opacity-0'
              }`}
            >
              <span className="whitespace-nowrap text-sm font-bold tracking-tight">TETMEER</span>
            </div>
          </div>
        </Button>

        <div 
          className={`transition-all duration-300 ease-out overflow-hidden flex-shrink-0 ${
            canGoBack ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <Button
            variant="ghost"
            onClick={() => canGoBack && goBack()}
            className="w-full h-10 rounded-xl px-0 overflow-visible"
            data-testid="button-sidebar-back"
          >
            <div className={`flex items-center w-full ${expanded ? '' : 'justify-center'}`}>
              <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </div>
              <div 
                className={`overflow-hidden transition-all duration-300 ease-out ${
                  expanded ? 'w-[140px] opacity-100' : 'w-0 opacity-0'
                }`}
              >
                <span className="whitespace-nowrap text-sm">{t('common.back', '뒤로')}</span>
              </div>
            </div>
          </Button>
        </div>

        <div 
          ref={scrollContainerRef} 
          className={`flex-1 overflow-y-hidden flex flex-col gap-2 py-2 transition-opacity duration-300 ${isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none absolute'}`}
        >
          <div className="flex flex-col items-center gap-1">
            <span className={`text-[10px] uppercase tracking-wider text-muted-foreground font-medium transition-all duration-300 ${expanded ? 'opacity-100' : 'opacity-100'}`}>
              {t('game.hold')}
            </span>
            <PiecePreview piece={gamePieces.holdPiece} size="sm" />
          </div>
          <div className="h-px bg-white/10 mx-2" />
          <div className="flex flex-col items-center gap-1">
            <span className={`text-[10px] uppercase tracking-wider text-muted-foreground font-medium transition-all duration-300 ${expanded ? 'opacity-100' : 'opacity-100'}`}>
              {t('game.next')}
            </span>
            {gamePieces.pieceQueue.slice(0, maxNextBlocks).map((piece, index) => (
              <div key={index} className="flex-shrink-0">
                <PiecePreview piece={piece} size="sm" />
              </div>
            ))}
          </div>
        </div>

        <div className={`flex-1 ${isPlaying ? 'hidden' : ''}`} />

        <Button
          variant="ghost"
          onClick={toggleExpanded}
          className="w-full h-10 rounded-xl px-0 overflow-visible flex-shrink-0"
          data-testid="button-toggle-sidebar"
        >
          <div className={`flex items-center w-full ${expanded ? '' : 'justify-center'}`}>
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
              <ChevronLeft className={`w-5 h-5 transition-transform duration-300 ${expanded ? '' : 'rotate-180'}`} />
            </div>
            <div 
              className={`overflow-hidden transition-all duration-300 ease-out ${
                expanded ? 'w-[140px] opacity-100' : 'w-0 opacity-0'
              }`}
            >
              <span className="whitespace-nowrap text-sm">{t('nav.collapse', '접기')}</span>
            </div>
          </div>
        </Button>

        <div className={`flex-shrink-0 ${isPlaying ? 'hidden' : ''}`}>
          <SidebarButton
            icon={<Megaphone className="w-5 h-5" />}
            label={t('nav.announcements', '공지사항')}
            expanded={expanded}
            variant={isActive('announcements') ? 'secondary' : 'ghost'}
            onClick={() => navigateTo('announcements')}
          />
        </div>

        <div className={`flex-shrink-0 ${isPlaying ? 'hidden' : ''}`}>
          <NotificationDropdown expanded={expanded} />
        </div>

        <div className={`flex-shrink-0 ${isPlaying ? 'hidden' : ''}`}>
          <DMButton expanded={expanded} />
        </div>

        <div className={`flex-shrink-0 ${isPlaying ? 'hidden' : ''}`}>
          <LanguageToggle expanded={expanded} />
        </div>

        <div className={`flex-shrink-0 ${isPlaying ? 'hidden' : ''}`}>
          <ThemeToggle expanded={expanded} />
        </div>

        <div className={`flex-shrink-0 ${isPlaying ? 'hidden' : ''}`}>
          {isLoading ? (
            <div className="w-10 h-10 rounded-xl bg-muted animate-pulse self-center" />
          ) : isAuthenticated && user ? (
            <Button 
              variant="ghost" 
              className="w-full h-10 rounded-xl px-0 overflow-visible"
              onClick={() => setProfileOpen(!profileOpen)}
              data-testid="button-user-menu"
            >
              <div className="flex items-center w-full">
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || 'User'} />
                    <AvatarFallback className="text-xs">
                      {user.firstName?.[0] || user.email?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div 
                  className={`overflow-hidden transition-all duration-300 ease-out ${
                    expanded ? 'w-[140px] opacity-100' : 'w-0 opacity-0'
                  }`}
                >
                  <span className="whitespace-nowrap text-sm">{user.firstName || 'User'}</span>
                </div>
              </div>
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="w-full h-10 rounded-xl px-0 overflow-visible"
              data-testid="button-login"
              onClick={() => loginWithGoogle()}
            >
              <div className="flex items-center w-full">
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                  <LogIn className="w-5 h-5" />
                </div>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-out ${
                    expanded ? 'w-[140px] opacity-100' : 'w-0 opacity-0'
                  }`}
                >
                  <span className="whitespace-nowrap text-sm">{t('nav.login')}</span>
                </div>
              </div>
            </Button>
          )}
        </div>
      </div>

      {isAuthenticated && user && createPortal(
        <div
          ref={panelRef}
          className={`
            fixed z-50 
            bg-white/5 backdrop-blur-md
            border-0
            rounded-2xl shadow-2xl
            transition-[opacity,transform,left] duration-300 ease-out
            ${profileOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}
          `}
          style={{ 
            left: expanded ? '240px' : '88px',
            top: topOffset,
            bottom: bottomOffset,
            width: '320px'
          }}
        >
          <div className="flex flex-col h-full">
            <div className="p-4 border-b-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{t('nav.profile', '프로필')}</h2>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="w-8 h-8 rounded-lg"
                  onClick={() => setProfileOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={user.profileImageUrl || undefined} />
                  <AvatarFallback>{user.firstName?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              <div className="space-y-1">
                {menuItems.map((item) => (
                  <button
                    key={item.page}
                    onClick={() => {
                      navigateTo(item.page);
                      setProfileOpen(false);
                    }}
                    className="w-full p-3 rounded-xl text-left transition-colors duration-200 flex items-center gap-3 hover:bg-white/10"
                    data-testid={item.testId}
                  >
                    <item.icon className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2 border-t-0">
              <button
                onClick={() => {
                  logout();
                  setProfileOpen(false);
                }}
                className="w-full p-3 rounded-xl text-left transition-colors duration-200 flex items-center gap-3 hover:bg-white/10 text-red-400"
                data-testid="menu-logout"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">{t('nav.logout')}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <DMPanel expanded={expanded} />
    </div>
  );
}
