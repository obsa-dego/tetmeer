import { Header } from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/contexts/NavigationContext';
import { ArrowLeft, Megaphone, Calendar, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Announcement {
  id: string;
  title: string;
  content: string;
  date: Date;
  type: 'update' | 'event' | 'maintenance' | 'notice';
}

const dummyAnnouncements: Announcement[] = [
  {
    id: '1',
    title: 'TETMEER v2.1.0 업데이트 안내',
    content: '새로운 게임 모드와 기능이 추가되었습니다. Zone 모드에서 시간을 멈추고 콤보를 쌓아보세요!',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24),
    type: 'update'
  },
  {
    id: '2',
    title: '주말 이벤트: 더블 XP!',
    content: '이번 주말 동안 모든 게임에서 획득하는 경험치가 2배로 적용됩니다.',
    date: new Date(Date.now() - 1000 * 60 * 60 * 48),
    type: 'event'
  },
  {
    id: '3',
    title: '서버 점검 안내',
    content: '서비스 안정화를 위한 정기 점검이 예정되어 있습니다. (12/25 03:00 ~ 05:00 KST)',
    date: new Date(Date.now() - 1000 * 60 * 60 * 72),
    type: 'maintenance'
  },
  {
    id: '4',
    title: '시즌 2 시작!',
    content: '새로운 시즌이 시작되었습니다. 랭크를 올리고 시즌 보상을 획득하세요!',
    date: new Date(Date.now() - 1000 * 60 * 60 * 96),
    type: 'notice'
  },
];

const typeColors = {
  update: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  event: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  maintenance: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  notice: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const typeLabels = {
  update: '업데이트',
  event: '이벤트',
  maintenance: '점검',
  notice: '공지',
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export default function Announcements() {
  const { t } = useTranslation();
  const { navigateTo } = useNavigation();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" data-testid="button-back" onClick={() => navigateTo('landing')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">{t('nav.announcements', '공지사항')}</h1>
          </div>
        </div>

        <div className="space-y-4 max-w-3xl">
          {dummyAnnouncements.map((announcement) => (
            <Card 
              key={announcement.id}
              data-testid={`card-announcement-${announcement.id}`}
              className="bg-black/40 border-white/10 hover-elevate transition-colors cursor-pointer group"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${typeColors[announcement.type]}`}>
                        {typeLabels[announcement.type]}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(announcement.date)}
                      </span>
                    </div>
                    <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors" data-testid={`text-announcement-title-${announcement.id}`}>
                      {announcement.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {announcement.content}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
