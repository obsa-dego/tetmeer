import { Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/contexts/NavigationContext';

export function Header() {
  const { navigateTo } = useNavigation();
  
  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-black from-80% to-transparent pb-2">
        <div className="h-14 px-6 flex items-center justify-between w-full">
          <div 
            onClick={() => navigateTo('landing')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer" 
            data-testid="link-home"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Gamepad2 className="w-5 h-5 text-primary" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">TETMEER</span>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-sm" 
              data-testid="link-contact"
              onClick={() => navigateTo('contact')}
            >
              문의하기
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-sm" 
              data-testid="link-more"
              onClick={() => navigateTo('more')}
            >
              더보기
            </Button>
          </div>
        </div>
      </header>
      <div className="h-14" />
    </>
  );
}
