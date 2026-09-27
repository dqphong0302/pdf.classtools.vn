import { useEffect, useState } from 'react';

export type Locale = 'vi' | 'en';
type Theme = 'light' | 'dark';

const getInitialTheme = (): Theme => {
  const stored = localStorage.getItem('classtools-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'light';
};

export function usePreferences() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [locale, setLocale] = useState<Locale>(() =>
    localStorage.getItem('classtools-locale') === 'en' ? 'en' : 'vi'
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('classtools-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#10162d' : '#f7f5ef'
    );
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem('classtools-locale', locale);
  }, [locale]);

  return {
    theme,
    locale,
    toggleTheme: () => setTheme((value) => (value === 'light' ? 'dark' : 'light')),
    toggleLocale: () => setLocale((value) => (value === 'vi' ? 'en' : 'vi'))
  };
}
