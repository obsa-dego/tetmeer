import { useRef, useCallback, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/contexts/NavigationContext';
import { ArrowLeft, Bell, Trophy, Gift, Star, Zap, Crown, Users, Check, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { useMomentumScroll } from '@/hooks/use-momentum-scroll';

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
  achievement: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  gift: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  rank: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  system: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  social: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  premium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
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

export default function Notifications() {
  const { t } = useTranslation();
  const { navigateTo } = useNavigation();
  const { user } = useAuth();
  const audioContextRef = useRef<AudioContext | null>(null);

  const notifications = user ? getDummyNotifications() : [];
  const unreadCount = notifications.filter(n => !n.read).length;

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
    
    oscillator.frequency.setValueAtTime(600 + Math.random() * 250, ctx.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.02, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.08);
  }, []);

  const handleNotificationHover = useCallback((id: string) => {
    if (lastHoveredId.current !== id) {
      lastHoveredId.current = id;
      playHoverSound();
    }
  }, [playHoverSound]);

  const { containerRef, handlers } = useMomentumScroll({
    friction: 0.95,
  });

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" data-testid="button-back" onClick={() => navigateTo('landing')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Bell className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold">{t('nav.notifications', '알림')}</h1>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full" data-testid="badge-unread-count">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>
          
          {notifications.length > 0 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-xs" data-testid="button-mark-all-read">
                <Check className="w-3 h-3 mr-1" />
                {t('notifications.markAllRead', '모두 읽음')}
              </Button>
              <Button variant="outline" size="sm" className="text-xs text-destructive" data-testid="button-clear-all">
                <Trash2 className="w-3 h-3 mr-1" />
                {t('notifications.clearAll', '모두 삭제')}
              </Button>
            </div>
          )}
        </div>

        <div 
          ref={containerRef}
          {...handlers}
          className="space-y-3 max-w-3xl max-h-[calc(100vh-200px)] overflow-y-auto pr-2 cursor-grab select-none"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.2) transparent',
            touchAction: 'none',
          }}
        >
          {notifications.length === 0 ? (
            <Card className="bg-black/40 border-white/10" data-testid="card-empty-notifications">
              <CardContent className="p-12 text-center">
                <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground" data-testid="text-empty-notifications">{t('notifications.empty', '알림이 없습니다')}</p>
              </CardContent>
            </Card>
          ) : (
            notifications.map((notification, index) => {
              const Icon = notificationIcons[notification.type];
              const colorClasses = notificationColors[notification.type];
              
              return (
                <Card 
                  key={notification.id}
                  data-testid={`card-notification-${notification.id}`}
                  onMouseEnter={() => handleNotificationHover(notification.id)}
                  className={`border transition-all duration-300 cursor-pointer hover-elevate ${
                    !notification.read 
                      ? 'bg-primary/5 border-primary/20' 
                      : 'bg-black/40 border-white/10'
                  }`}
                  style={{
                    animationDelay: `${index * 50}ms`
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 ${colorClasses}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{notification.title}</span>
                          {!notification.read && (
                            <span className="w-2 h-2 bg-primary rounded-full" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
                        <span className="text-xs text-muted-foreground/60">{formatTimeAgo(notification.timestamp)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
