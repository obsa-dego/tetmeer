import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigation, PageType } from '@/contexts/NavigationContext';
import { 
  FileText, 
  Shield, 
  HelpCircle, 
  Info, 
  ExternalLink,
  Github,
  Twitter,
  BookOpen
} from 'lucide-react';

const moreLinks: Array<{ title: string; description: string; icon: typeof FileText; page: PageType }> = [
  {
    title: '이용약관',
    description: '서비스 이용에 관한 약관을 확인하세요',
    icon: FileText,
    page: 'terms'
  },
  {
    title: '개인정보처리방침',
    description: '개인정보 수집 및 이용에 관한 정책',
    icon: Shield,
    page: 'privacy'
  },
  {
    title: '자주 묻는 질문',
    description: '게임 및 서비스 관련 FAQ',
    icon: HelpCircle,
    page: 'faq'
  },
  {
    title: '게임 정보',
    description: 'TETMEER 게임에 대한 자세한 정보',
    icon: Info,
    page: 'about'
  },
  {
    title: '공략',
    description: '기술 사용법과 점수 산출 공식 안내',
    icon: BookOpen,
    page: 'strategy'
  }
];

const socialLinks = [
  { name: 'GitHub', icon: Github, href: 'https://github.com' },
  { name: 'Twitter', icon: Twitter, href: 'https://twitter.com' }
];

export default function More() {
  const { navigateTo } = useNavigation();
  
  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">더보기</h1>
          <p className="text-muted-foreground">
            TETMEER에 대한 추가 정보와 링크를 확인하세요.
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {moreLinks.map((item) => (
            <Card 
              key={item.page}
              className="bg-black/40 border-white/10 cursor-pointer transition-colors hover:bg-white/5"
              data-testid={`link-${item.page}`}
              onClick={() => navigateTo(item.page)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-black/40 border-white/10">
          <CardHeader>
            <CardTitle className="text-lg">소셜 미디어</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center transition-colors hover:bg-white/10"
                  data-testid={`link-social-${social.name.toLowerCase()}`}
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>TETMEER v1.0.0</p>
          <p className="mt-1">© 2024 TETMEER. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
}
