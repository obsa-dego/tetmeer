import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Bell, X, Gift, Trophy, Star, Zap, Crown, Users, CheckCheck, Maximize2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { loginWithGoogle } from '@/lib/auth-utils';
import { useMomentumScroll } from '@/hooks/use-momentum-scroll';
import { useSidebar } from '@/contexts/SidebarContext';
import { useNavigation } from '@/contexts/NavigationContext';

interface Notification {
  id: string;
  type: 'achievement' | 'gift' | 'rank' | 'system' | 'social' | 'premium';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

const notificationIcons = {
  achievement: Trophy,
  gift: Gift,
  rank: Star,
  system: Zap,
  social: Users,
  premium: Crown,
};

const notificationColors = {
  achievement: 'text-yellow-400 bg-yellow-400/10',
  gift: 'text-emerald-400 bg-emerald-400/10',
  rank: 'text-purple-400 bg-purple-400/10',
  system: 'text-blue-400 bg-blue-400/10',
  social: 'text-cyan-400 bg-cyan-400/10',
  premium: 'text-amber-400 bg-amber-400/10',
};

function getDummyNotifications(): Notification[] {
  return [
    { id: '1', type: 'achievement', title: '업적 달성!', message: '첫 번째 게임에서 10줄 클리어!', timestamp: new Date(Date.now() - 1000 * 60 * 5), read: false },
    { id: '2', type: 'gift', title: '선물 도착', message: '일일 보상을 받았습니다.', timestamp: new Date(Date.now() - 1000 * 60 * 30), read: false },
    { id: '3', type: 'rank', title: '랭크 상승', message: '실버 II에서 실버 I로 승급했습니다!', timestamp: new Date(Date.now() - 1000 * 60 * 60), read: false },
    { id: '4', type: 'system', title: '시스템 공지', message: '새로운 게임 모드가 추가되었습니다.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), read: true },
    { id: '5', type: 'social', title: '친구 초대', message: 'Player123님이 친구 요청을 보냈습니다.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3), read: true },
    { id: '6', type: 'premium', title: '프리미엄 혜택', message: '프리미엄 회원 전용 스킨이 추가되었습니다.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), read: true },
    { id: '7', type: 'achievement', title: '연속 기록!', message: '5일 연속 로그인 달성!', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), read: true },
    { id: '8', type: 'rank', title: '시즌 보상', message: '시즌 1 보상을 수령하세요.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48), read: true },
    { id: '9', type: 'gift', title: '이벤트 보상', message: '주말 이벤트 참여 보상이 도착했습니다.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72), read: true },
    { id: '10', type: 'system', title: '업데이트 완료', message: 'v2.1.0 업데이트가 적용되었습니다.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 96), read: true },
  ];
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  return `${diffDays}일 전`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', { 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });
}

interface NotificationDropdownProps {
  expanded?: boolean;
}

export function NotificationDropdown({ expanded = false }: NotificationDropdownProps) {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { notificationOpen, setNotificationOpen, expanded: sidebarExpanded } = useSidebar();
  const { navigateTo } = useNavigation();
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const audioContextRef = useRef<AudioContext | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  
  const notifications = isAuthenticated ? getDummyNotifications() : [];
  const unreadNotifications = notifications.filter(n => !n.read);
  const readNotifications = notifications.filter(n => n.read);
  const unreadCount = unreadNotifications.length;

  const displayedNotifications = activeTab === 'unread' ? unreadNotifications : notifications;

  const lastHoveredId = useRef<string | null>(null);

  const playHoverSound = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.setValueAtTime(700 + Math.random() * 300, ctx.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.025, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.06);
  }, []);

  const handleNotificationHover = useCallback((id: string) => {
    if (lastHoveredId.current !== id) {
      lastHoveredId.current = id;
      playHoverSound();
    }
  }, [playHoverSound]);

  const { containerRef, handlers } = useMomentumScroll({
    friction: 0.94,
  });

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        const triggerButton = document.querySelector('[data-testid="nav-notifications"]');
        if (triggerButton && !triggerButton.contains(event.target as Node)) {
          setNotificationOpen(false);
        }
      }
    };

    if (notificationOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notificationOpen, setNotificationOpen]);

  const groupNotificationsByDate = (notifs: Notification[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: { label: string; notifications: Notification[] }[] = [];
    
    const todayNotifs = notifs.filter(n => {
      const d = new Date(n.timestamp);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });
    
    const yesterdayNotifs = notifs.filter(n => {
      const d = new Date(n.timestamp);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === yesterday.getTime();
    });
    
    const olderNotifs = notifs.filter(n => {
      const d = new Date(n.timestamp);
      d.setHours(0, 0, 0, 0);
      return d.getTime() < yesterday.getTime();
    });

    if (todayNotifs.length > 0) {
      groups.push({ label: '오늘', notifications: todayNotifs });
    }
    if (yesterdayNotifs.length > 0) {
      groups.push({ label: '어제', notifications: yesterdayNotifs });
    }
    if (olderNotifs.length > 0) {
      groups.push({ label: '이전', notifications: olderNotifs });
    }

    return groups;
  };

  const notificationGroups = groupNotificationsByDate(displayedNotifications);

  const handleToggle = () => {
    if (!isAuthenticated) {
      loginWithGoogle();
      return;
    }
    setNotificationOpen(!notificationOpen);
  };

  return (
    <>
      <Button 
        variant="ghost" 
        className="w-full h-10 rounded-xl px-0 overflow-visible"
        onClick={handleToggle}
        data-testid="nav-notifications"
      >
        <div className="flex items-center w-full">
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 relative">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span 
                className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold"
                data-testid="badge-unread-count"
              >
                {unreadCount}
              </span>
            )}
          </div>
          <div 
            className={`overflow-hidden transition-all duration-300 ease-out ${
              expanded ? 'w-[140px] opacity-100' : 'w-0 opacity-0'
            }`}
          >
            <span className="whitespace-nowrap text-sm">{t('nav.notifications', '알림')}</span>
          </div>
        </div>
      </Button>

      {createPortal(
        <div
          ref={panelRef}
          className={`
            fixed z-50 
            bg-white/5 backdrop-blur-md
            border-0
            rounded-2xl shadow-2xl
            transition-[opacity,transform,left] duration-300 ease-out
            ${notificationOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}
          `}
          style={{ 
            left: sidebarExpanded ? '240px' : '88px',
            top: 'calc(3.5rem + 0.5rem + 1rem)',
            bottom: '1rem',
            width: '320px'
          }}
        >
          <div className="flex flex-col h-full">
            <div className="p-4 border-b-0">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-semibold">{t('nav.notifications', 'Notifications')}</h2>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="w-8 h-8 rounded-lg"
                    onClick={() => {
                      navigateTo('notifications');
                      setNotificationOpen(false);
                    }}
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="w-8 h-8 rounded-lg"
                    onClick={() => setNotificationOpen(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">최신 알림을 확인하세요</p>
            </div>

            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      activeTab === 'all' 
                        ? 'bg-white/10 text-white font-medium' 
                        : 'text-muted-foreground hover:text-white hover:bg-white/5'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => setActiveTab('unread')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
                      activeTab === 'unread' 
                        ? 'bg-white/10 text-white font-medium' 
                        : 'text-muted-foreground hover:text-white hover:bg-white/5'
                    }`}
                  >
                    읽지 않음
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </div>
                {unreadCount > 0 && (
                  <button className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                    <CheckCheck className="w-3 h-3" />
                    모두 읽음 처리
                  </button>
                )}
              </div>
            </div>

            <div 
              ref={containerRef}
              {...handlers}
              className="flex-1 overflow-y-auto cursor-grab select-none"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.2) transparent',
                touchAction: 'none',
              }}
            >
              {displayedNotifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm" data-testid="notifications-empty">
                  {activeTab === 'unread' 
                    ? '읽지 않은 알림이 없습니다'
                    : t('notifications.empty', '알림이 없습니다')
                  }
                </div>
              ) : (
                <div className="p-2">
                  {notificationGroups.map((group) => (
                    <div key={group.label} className="mb-4">
                      <div className="px-2 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {group.label}
                      </div>
                      <div className="space-y-1">
                        {group.notifications.map((notification) => {
                          const Icon = notificationIcons[notification.type];
                          const colorClass = notificationColors[notification.type];
                          
                          return (
                            <div 
                              key={notification.id}
                              data-testid={`notification-item-${notification.id}`}
                              onMouseEnter={() => handleNotificationHover(notification.id)}
                              className={`p-3 rounded-xl transition-colors duration-200 cursor-pointer hover:bg-white/10 ${
                                !notification.read ? 'bg-white/5' : ''
                              }`}
                            >
                              <div className="flex gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                                  <Icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="text-sm font-medium line-clamp-2">{notification.title}</span>
                                    {!notification.read && (
                                      <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-1.5" />
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{notification.message}</p>
                                  <span className="text-xs text-muted-foreground/60 mt-1 block">
                                    {formatDate(notification.timestamp)} | {formatTimeAgo(notification.timestamp)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
