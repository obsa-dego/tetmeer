import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import koCommon from './locales/ko/common.json';
import jaCommon from './locales/ja/common.json';
import esCommon from './locales/es/common.json';
import deCommon from './locales/de/common.json';
import frCommon from './locales/fr/common.json';

const resources = {
  en: { common: enCommon },
  ko: { common: koCommon },
  ja: { common: jaCommon },
  es: { common: esCommon },
  de: { common: deCommon },
  fr: { common: frCommon },
};

const getStoredLanguage = (): string => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem('preferredLanguage') || 'en';
  }
  return 'en';
};

const savedLanguage = getStoredLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  });

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    if (window.localStorage) {
      localStorage.setItem('preferredLanguage', lng);
    }
    if (document?.documentElement) {
      document.documentElement.lang = lng;
    }
  }
});

if (typeof window !== 'undefined' && document?.documentElement) {
  document.documentElement.lang = savedLanguage;
}

export default i18n;
