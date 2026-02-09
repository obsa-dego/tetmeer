import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Mail, MessageSquare, Send } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function Contact() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    subject: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: '문의가 접수되었습니다',
      description: '빠른 시일 내에 답변드리겠습니다.'
    });
    setFormData({ email: '', subject: '', message: '' });
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">문의하기</h1>
          <p className="text-muted-foreground">
            게임 관련 문의나 제안사항이 있으시면 아래 양식을 통해 연락해주세요.
          </p>
        </div>

        <Card className="bg-black/40 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              문의 양식
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">이메일</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    className="pl-10 bg-white/5 border-white/10"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">제목</label>
                <Input
                  type="text"
                  placeholder="문의 제목을 입력해주세요"
                  className="bg-white/5 border-white/10"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                  data-testid="input-subject"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">내용</label>
                <Textarea
                  placeholder="문의 내용을 자세히 적어주세요"
                  className="bg-white/5 border-white/10 min-h-[150px]"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                  data-testid="input-message"
                />
              </div>

              <Button type="submit" className="w-full" data-testid="button-submit">
                <Send className="w-4 h-4 mr-2" />
                문의 보내기
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/10">
          <h3 className="font-medium mb-2">기타 연락처</h3>
          <p className="text-sm text-muted-foreground">
            이메일: support@tetrix.game
          </p>
        </div>
      </main>
    </div>
  );
}
