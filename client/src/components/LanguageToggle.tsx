import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Globe, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/contexts/SidebarContext';

const languages = [
  { code: 'en', name: 'English' },
  { code: 'ko', name: '한국어' },
  { code: 'ja', name: '日本語' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
] as const;

interface LanguageToggleProps {
  expanded?: boolean;
}

export function LanguageToggle({ expanded = false }: LanguageToggleProps) {
  const { i18n, t } = useTranslation();
  const { languageOpen, setLanguageOpen, expanded: sidebarExpanded } = useSidebar();
  const panelRef = useRef<HTMLDivElement>(null);

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('preferredLanguage', langCode);
    setLanguageOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        const triggerButton = document.querySelector('[data-testid="button-language-toggle"]');
        if (triggerButton && !triggerButton.contains(event.target as Node)) {
          setLanguageOpen(false);
        }
      }
    };

    if (languageOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [languageOpen, setLanguageOpen]);

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setLanguageOpen(!languageOpen)}
        className="w-full h-10 rounded-xl px-0 overflow-visible"
        data-testid="button-language-toggle"
      >
        <div className="flex items-center w-full">
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div 
            className={`overflow-hidden transition-all duration-300 ease-out ${
              expanded ? 'w-[140px] opacity-100' : 'w-0 opacity-0'
            }`}
          >
            <span className="whitespace-nowrap text-sm">
              {t(`language.${i18n.language}`, i18n.language.toUpperCase())}
            </span>
          </div>
        </div>
      </Button>

      {createPortal(
        <div
          ref={panelRef}
          className={`
            fixed z-50 
            bg-[#0d0d0d]
            border border-white/10 
            rounded-2xl shadow-2xl
            transition-[opacity,transform,left] duration-300 ease-out
            ${languageOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}
          `}
          style={{ 
            left: sidebarExpanded ? '240px' : '88px',
            top: 'calc(3.5rem + 0.5rem + 1rem)',
            bottom: '1rem',
            width: '320px'
          }}
        >
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-semibold">{t('settings.language', '언어')}</h2>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="w-8 h-8 rounded-lg"
                  onClick={() => setLanguageOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">선호하는 언어를 선택하세요</p>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              <div className="space-y-1">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`w-full p-3 rounded-xl text-left transition-colors duration-200 flex items-center justify-between hover:bg-white/10 ${
                      i18n.language === lang.code ? 'bg-white/10' : ''
                    }`}
                    data-testid={`menu-item-language-${lang.code}`}
                  >
                    <span className="text-sm font-medium">{lang.name}</span>
                    {i18n.language === lang.code && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
