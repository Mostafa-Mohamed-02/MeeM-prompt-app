import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'en' | 'ar' | 'es' | 'fr' | 'hi' | 'it';

type Translations = { [key: string]: string };

interface LocalizationContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  translations: Translations;
  t: (key: string) => string;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

const defaultLanguage: Language = 'en';

export const LocalizationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    // Check for saved language in localStorage or default
    const savedLang = localStorage.getItem('language');
    return (savedLang as Language) || defaultLanguage;
  });
  const [translations, setTranslations] = useState<Translations>({});

  useEffect(() => {
    const fetchTranslations = async () => {
      try {
        const response = await fetch(`/locales/${language}.json`);
        if (!response.ok) {
          throw new Error(`Could not load ${language}.json`);
        }
        const data = await response.json();
        setTranslations(data);
        localStorage.setItem('language', language);
      } catch (error) {
        console.error('Failed to fetch translations:', error);
        // Fallback to English if the selected language file fails
        if (language !== 'en') {
          setLanguage('en');
        }
      }
    };

    fetchTranslations();
  }, [language]);

  const t = (key: string): string => {
    return translations[key] || key;
  };

  const value = {
    language,
    setLanguage,
    translations,
    t,
  };

  return (
    <LocalizationContext.Provider value={value}>
      {Object.keys(translations).length > 0 ? children : null /* Render children only when translations are loaded */}
    </LocalizationContext.Provider>
  );
};

export const useLocalization = (): LocalizationContextType => {
  const context = useContext(LocalizationContext);
  if (context === undefined) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
};
