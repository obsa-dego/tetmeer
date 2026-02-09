import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ThemeToggleProps {
  expanded?: boolean;
}

export function ThemeToggle({ expanded = false }: ThemeToggleProps) {
  const { t } = useTranslation();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = stored === 'dark' || (!stored && prefersDark);
    
    setIsDark(shouldBeDark);
    document.documentElement.classList.toggle('dark', shouldBeDark);
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    document.documentElement.classList.toggle('dark', newIsDark);
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light');
  };

  return (
    <Button
      variant="ghost"
      onClick={toggleTheme}
      className="w-full h-10 rounded-xl px-0 overflow-visible"
      data-testid="button-theme-toggle"
    >
      <div className="flex items-center w-full">
        <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </div>
        <div 
          className={`overflow-hidden transition-all duration-300 ease-out ${
            expanded ? 'w-[140px] opacity-100' : 'w-0 opacity-0'
          }`}
        >
          <span className="whitespace-nowrap text-sm">
            {isDark ? t('settings.lightMode', '라이트 모드') : t('settings.darkMode', '다크 모드')}
          </span>
        </div>
      </div>
    </Button>
  );
}
