import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { useAuth } from '@/hooks/use-auth';
import { loginWithGoogle } from '@/lib/auth-utils';
import { useSidebar } from '@/contexts/SidebarContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { useQuery } from '@tanstack/react-query';
import { useRef, useCallback, useEffect, useState } from 'react';
import { 
  Gamepad2, Trophy, Play, Star, Crown, Settings, Palette, 
  Volume2, Globe, Swords, User, ChevronRight, Medal, Zap,
  Share2, Users, Clock, ShoppingCart
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Premium parallax card component with mouse-follow effects
function ParallaxCard({ 
  children, 
  className = "",
  disabled = false
}: { 
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();
  const isHovering = useRef(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !cardRef.current) return;
    
    isHovering.current = true;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    
    // Calculate mouse position relative to card center (-1 to 1)
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    
    // Cancel previous animation frame
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    rafRef.current = requestAnimationFrame(() => {
      if (!cardRef.current) return;
      
      // Subtle rotation (max 3 degrees)
      const rotateX = -y * 3;
      const rotateY = x * 3;
      
      // Apply transform
      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(4px)`;
      
      // Update spotlight position
      const spotX = ((e.clientX - rect.left) / rect.width) * 100;
      const spotY = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--spot-x', `${spotX}%`);
      card.style.setProperty('--spot-y', `${spotY}%`);
      card.style.setProperty('--spot-opacity', '1');
    });
  }, [disabled]);

  const handleMouseLeave = useCallback(() => {
    isHovering.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    if (cardRef.current) {
      cardRef.current.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
      cardRef.current.style.setProperty('--spot-opacity', '0');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className={`parallax-card ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transition: 'transform 0.15s ease-out',
        transformStyle: 'preserve-3d',
        willChange: 'transform',
        ['--spot-x' as string]: '50%',
        ['--spot-y' as string]: '50%',
        ['--spot-opacity' as string]: '0',
      }}
    >
      {children}
      {/* Spotlight overlay */}
      <div 
        className="pointer-events-none absolute inset-0 rounded-lg z-20 transition-opacity duration-300"
        style={{
          background: 'radial-gradient(400px circle at var(--spot-x) var(--spot-y), rgba(255,255,255,0.06), transparent 40%)',
          opacity: 'var(--spot-opacity)',
        }}
      />
    </div>
  );
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  score: number;
  userId: string;
}

function DotPattern({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute bottom-0 right-0 w-32 h-32 opacity-30">
        {Array.from({ length: 8 }).map((_, row) => (
          <div key={row} className="flex justify-end gap-1">
            {Array.from({ length: 8 - row }).map((_, col) => (
              <div
                key={col}
                className="w-1.5 h-1.5 rounded-full bg-current"
                style={{ opacity: 0.3 + (row + col) * 0.08 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function WavePattern({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <svg className="absolute bottom-0 right-0 w-full h-full opacity-20" viewBox="0 0 200 100" preserveAspectRatio="none">
        <path d="M0 50 Q50 30 100 50 T200 50 V100 H0 Z" fill="currentColor" />
        <path d="M0 60 Q50 40 100 60 T200 60 V100 H0 Z" fill="currentColor" opacity="0.5" />
        <path d="M0 70 Q50 50 100 70 T200 70 V100 H0 Z" fill="currentColor" opacity="0.3" />
      </svg>
    </div>
  );
}

function GridPattern({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)`,
        backgroundSize: '20px 20px'
      }} />
    </div>
  );
}

interface UserProfile {
  highScore: number;
  totalGamesPlayed: number;
  totalLinesCleared: number;
  totalPlayTime: number;
  isPremium: boolean;
}


function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

export default function Landing() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { expanded, notificationOpen, languageOpen, profileOpen } = useSidebar();
  const { navigateTo } = useNavigation();
  const anyPanelOpen = notificationOpen || languageOpen || profileOpen;
  const { t } = useTranslation();
  const gridRef = useRef<HTMLDivElement>(null);
  const globalRafRef = useRef<number>();
  const [globalOffset, setGlobalOffset] = useState({ x: 0, y: 0 });

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['/api/profile'],
    enabled: isAuthenticated,
  });

  const { data: leaderboardData } = useQuery<{ entries: LeaderboardEntry[] }>({
    queryKey: ['/api/leaderboard?filter=allTime&mode=marathon'],
    enabled: isAuthenticated,
  });

  const userRank = leaderboardData?.entries?.findIndex(
    entry => entry.userId === user?.id
  );
  const userRankDisplay = userRank !== undefined && userRank >= 0 ? userRank + 1 : null;

  // Global parallax effect for the entire grid
  const handleGlobalMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!gridRef.current) return;
    
    if (globalRafRef.current) cancelAnimationFrame(globalRafRef.current);
    
    globalRafRef.current = requestAnimationFrame(() => {
      if (!gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      
      // Calculate mouse position relative to center (-1 to 1)
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      
      // Very subtle movement (max 3px)
      setGlobalOffset({
        x: x * 3,
        y: y * 3
      });
    });
  }, []);

  const handleGlobalMouseLeave = useCallback(() => {
    if (globalRafRef.current) cancelAnimationFrame(globalRafRef.current);
    setGlobalOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    return () => {
      if (globalRafRef.current) cancelAnimationFrame(globalRafRef.current);
    };
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden relative">
      <Header />
      
      <main 
        className={`fixed overflow-hidden flex flex-col transition-all duration-300 ease-out ${anyPanelOpen ? 'blur-md pointer-events-none' : ''}`}
        style={{ 
          left: expanded ? '240px' : '88px',
          top: 'calc(3.5rem + 1rem)',
          bottom: '1rem',
          right: '1rem'
        }}
      >
        <div 
          ref={gridRef}
          className="flex-1 grid grid-cols-4 grid-rows-4 gap-3 min-h-0" 
            style={{ 
              perspective: '1000px',
              transform: `translate(${globalOffset.x}px, ${globalOffset.y}px)`,
              transition: 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)'
            }}
            onMouseMove={handleGlobalMouseMove}
            onMouseLeave={handleGlobalMouseLeave}
          >
            {/* Enter Game - Always available */}
            <ParallaxCard className="row-span-2 h-full">
              <div className="block h-full cursor-pointer" onClick={() => navigateTo('game')}>
                <Card className="h-full bg-zinc-900/90 border-0 cursor-pointer flex flex-col justify-center relative overflow-hidden">
                  <DotPattern className="text-primary" />
                  <CardContent className="p-5 flex flex-col items-start justify-between h-full relative z-10">
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">{t('landing.normalMatchDesc', 'Start playing TETMEER')}</p>
                      <h3 className="text-xl font-bold text-white">{t('landing.normalMatch', 'Normal Match')}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-xs text-green-500">{t('landing.ready', 'Ready')}</span>
                    </div>
                    <Button variant="outline" size="sm" className="mt-2 bg-zinc-800/50 border-zinc-700">
                      {t('landing.play', 'Play')} <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </ParallaxCard>

            {/* Ranked Mode */}
            <ParallaxCard className="row-span-2 h-full">
              <div className="block h-full cursor-pointer" onClick={() => navigateTo('ranked')}>
                <Card className="h-full bg-zinc-900/90 border-0 cursor-pointer flex flex-col justify-center relative overflow-hidden">
                  <GridPattern className="text-purple-500" />
                  <CardContent className="p-5 flex flex-col items-start justify-between h-full relative z-10">
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">{t('landing.rankedDesc', 'Compete and climb ranks')}</p>
                      <h3 className="text-xl font-bold text-white">{t('landing.rankedMatch', 'Ranked Match')}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-xs text-purple-500">{t('landing.competitive', 'Competitive')}</span>
                    </div>
                    <Button variant="outline" size="sm" className="mt-2 bg-zinc-800/50 border-zinc-700">
                      {t('landing.compete', 'Compete')} <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </ParallaxCard>

            {/* Leaderboard - Login required */}
            <ParallaxCard className="row-span-2 h-full" disabled={!isAuthenticated}>
              {isAuthenticated ? (
                <div className="block h-full cursor-pointer" onClick={() => navigateTo('leaderboard')}>
                  <Card className="h-full bg-zinc-900/90 border-0 cursor-pointer relative overflow-hidden hover-elevate">
                    <WavePattern className="text-yellow-500" />
                    <CardContent className="p-4 h-full flex flex-col justify-between relative z-10">
                      <div>
                        <p className="text-xs text-zinc-500">{t('landing.leaderboardDesc', 'Global rankings')}</p>
                        <h3 className="text-lg font-bold text-white mt-1">{t('nav.leaderboard', 'Leaderboard')}</h3>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        {userRankDisplay ? (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border border-yellow-500/30">
                              <span className="text-sm font-bold text-yellow-400">#{userRankDisplay}</span>
                            </div>
                            <span className="text-xs text-zinc-400">{t('landing.yourRank', 'Your Rank')}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Medal className="w-5 h-5 text-zinc-500" />
                            <span className="text-xs text-zinc-400">{t('landing.playToRank', 'Play to rank')}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Trophy className="w-4 h-4 text-yellow-500" />
                          <span className="text-xs text-yellow-500">{t('landing.top100', 'Top 100')}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card className="h-full bg-zinc-900/90 border-0 cursor-not-allowed relative overflow-hidden opacity-60">
                  <WavePattern className="text-yellow-500" />
                  <CardContent className="p-4 h-full flex flex-col justify-between relative z-10">
                    <div>
                      <p className="text-xs text-zinc-500">{t('landing.leaderboardDesc', 'Global rankings')}</p>
                      <h3 className="text-lg font-bold text-white mt-1">{t('nav.leaderboard', 'Leaderboard')}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-zinc-500" />
                      <span className="text-xs text-zinc-500">{t('landing.loginRequired', 'Login required')}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </ParallaxCard>

            {/* Social - Direct Messages */}
            <ParallaxCard className="row-span-2 h-full" disabled={!isAuthenticated}>
              {isAuthenticated ? (
                <div className="block h-full cursor-pointer" onClick={() => navigateTo('social')}>
                  <Card className="h-full bg-zinc-900/90 border-0 cursor-pointer relative overflow-hidden hover-elevate">
                    <WavePattern className="text-pink-500" />
                    <CardContent className="p-4 h-full flex flex-col justify-between relative z-10">
                      <div>
                        <p className="text-xs text-zinc-500">{t('landing.socialDesc', 'Share & connect')}</p>
                        <h3 className="text-lg font-bold text-white mt-1">{t('landing.social', 'Social')}</h3>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-pink-500" />
                          <span className="text-xs text-pink-400">{t('landing.active', 'Active')}</span>
                        </div>
                        <Share2 className="w-4 h-4 text-pink-400" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card className="h-full bg-zinc-900/90 border-0 relative overflow-hidden opacity-50">
                  <WavePattern className="text-pink-500" />
                  <CardContent className="p-4 h-full flex flex-col justify-between relative z-10">
                    <div>
                      <p className="text-xs text-zinc-500">{t('landing.socialDesc', 'Share & connect')}</p>
                      <h3 className="text-lg font-bold text-white mt-1">{t('landing.social', 'Social')}</h3>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-zinc-500" />
                        <span className="text-xs text-zinc-400">{t('landing.loginRequired', 'Login required')}</span>
                      </div>
                      <Share2 className="w-4 h-4 text-zinc-400" />
                    </div>
                  </CardContent>
                </Card>
              )}
            </ParallaxCard>

            {/* Profile / Sign In - Conditional based on auth status */}
            <ParallaxCard className="row-span-2 h-full" disabled={!isAuthenticated}>
              {isAuthenticated ? (
                <div className="block h-full cursor-pointer" onClick={() => navigateTo('account')}>
                  <Card className="h-full bg-zinc-900/90 border-0 cursor-pointer relative overflow-hidden">
                    {user?.profileImageUrl && (
                      <div 
                        className="absolute inset-0 bg-cover bg-center opacity-30"
                        style={{ backgroundImage: `url(${user.profileImageUrl})` }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/40" />
                    <CardContent className="p-4 h-full flex flex-col justify-between relative z-10">
                      <div>
                        <p className="text-xs text-zinc-500">{t('landing.welcomeBack', 'Welcome back')}</p>
                        <h3 className="text-lg font-bold text-white">{user?.firstName || user?.nickname || t('common.player', 'Player')}</h3>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <p className="text-xs text-zinc-500">{t('stats.highScore', 'Best')}</p>
                            <p className="text-sm font-mono text-zinc-300">{formatNumber(profile?.highScore || 0)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-zinc-500">{t('stats.totalGames', 'Games')}</p>
                            <p className="text-sm font-mono text-zinc-300">{profile?.totalGamesPlayed || 0}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="block h-full cursor-pointer" onClick={() => loginWithGoogle()}>
                  <Card className="h-full bg-zinc-900/90 border-0 cursor-pointer relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10" />
                    <CardContent className="p-4 h-full flex flex-col justify-between relative z-10">
                      <div>
                        <p className="text-xs text-zinc-500">{t('landing.signInDesc', 'Save your progress')}</p>
                        <h3 className="text-lg font-bold text-white">{t('landing.signIn', 'Sign In')}</h3>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Star className="w-5 h-5 text-primary" />
                          <span className="text-xs text-primary">{t('landing.unlockFeatures', 'Unlock features')}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </ParallaxCard>

            {/* Wild Match - Disabled */}
            <ParallaxCard className="row-span-2 h-full" disabled={true}>
              <Card className="h-full bg-zinc-900/90 border-0 relative overflow-hidden opacity-50 cursor-not-allowed">
                <DotPattern className="text-orange-500" />
                <CardContent className="p-4 h-full flex flex-col justify-between relative z-10">
                  <div>
                    <p className="text-xs text-zinc-500">{t('landing.wildMatchDesc', 'Battle random players')}</p>
                    <h3 className="text-lg font-bold text-white mt-1">{t('modes.wildMatch', 'Wild Match')}</h3>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-zinc-500" />
                      <span className="text-xs text-zinc-500">{t('landing.comingSoon', 'Coming Soon')}</span>
                    </div>
                    <Swords className="w-4 h-4 text-zinc-500" />
                  </div>
                </CardContent>
              </Card>
            </ParallaxCard>

            {/* Settings - Requires login (now redirects to Account page) */}
            <ParallaxCard className="row-span-2 h-full" disabled={!isAuthenticated}>
              {isAuthenticated ? (
                <div className="block h-full cursor-pointer" onClick={() => navigateTo('account')}>
                  <Card className="h-full bg-zinc-900/90 border-0 cursor-pointer relative overflow-hidden">
                    <DotPattern className="text-cyan-500" />
                    <CardContent className="p-4 h-full flex flex-col justify-between relative z-10">
                      <div>
                        <p className="text-xs text-zinc-500">{t('settings.settingsDesc', 'Interface & controls')}</p>
                        <h4 className="text-base font-bold text-white mt-1">{t('settings.settings', 'Settings')}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs text-cyan-400">{t('landing.configure', 'Configure')}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card className="h-full bg-zinc-900/90 border-0 relative overflow-hidden opacity-50">
                  <DotPattern className="text-cyan-500" />
                  <CardContent className="p-4 h-full flex flex-col justify-between relative z-10">
                    <div>
                      <p className="text-xs text-zinc-500">{t('settings.settingsDesc', 'Interface & controls')}</p>
                      <h4 className="text-base font-bold text-white mt-1">{t('settings.settings', 'Settings')}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-zinc-500" />
                      <span className="text-xs text-zinc-500">{t('landing.loginRequired', 'Login required')}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </ParallaxCard>

            {/* Premium - Login required */}
            <ParallaxCard className="h-full" disabled={!isAuthenticated}>
              {isAuthenticated ? (
                <div className="block h-full cursor-pointer" onClick={() => navigateTo('premium')}>
                  <Card className="h-full bg-zinc-900/90 border-0 cursor-pointer relative overflow-hidden hover-elevate">
                    <GridPattern className="text-purple-500" />
                    <CardContent className="p-4 h-full flex flex-col justify-between relative z-10">
                      <div>
                        <p className="text-xs text-zinc-500">{t('landing.premiumDesc', 'Unlock features')}</p>
                        <h4 className="text-base font-bold text-white mt-1">{t('nav.premium', 'Premium')}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-purple-400" />
                        <span className="text-xs text-purple-400">{profile?.isPremium ? t('landing.active', 'Active') : t('landing.available', 'Available')}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card className="h-full bg-zinc-900/90 border-0 cursor-not-allowed relative overflow-hidden opacity-60">
                  <GridPattern className="text-purple-500" />
                  <CardContent className="p-4 h-full flex flex-col justify-between relative z-10">
                    <div>
                      <p className="text-xs text-zinc-500">{t('landing.premiumDesc', 'Unlock features')}</p>
                      <h4 className="text-base font-bold text-white mt-1">{t('nav.premium', 'Premium')}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-zinc-500" />
                      <span className="text-xs text-zinc-500">{t('landing.loginRequired', 'Login required')}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </ParallaxCard>

            {/* Shop - Available for all */}
            <ParallaxCard className="h-full">
              <div className="block h-full cursor-pointer" onClick={() => navigateTo('shop')}>
                <Card className="h-full bg-zinc-900/90 border-0 cursor-pointer relative overflow-hidden hover-elevate">
                  <DotPattern className="text-emerald-500" />
                  <CardContent className="p-4 h-full flex flex-col justify-between relative z-10">
                    <div>
                      <p className="text-xs text-zinc-500">Skins & Badges</p>
                      <h4 className="text-base font-bold text-white mt-1">{t('nav.shop', 'Shop')}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs text-emerald-500">Trade</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ParallaxCard>
        </div>
      </main>
    </div>
  );
}
