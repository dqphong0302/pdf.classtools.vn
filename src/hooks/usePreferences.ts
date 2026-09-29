import { useEffect, useState } from 'react';

export type Locale = 'vi' | 'en';
type Theme = 'light' | 'dark';

// Storage can throw (blocked cookies, some private modes); preferences are optional.
function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

const getInitialTheme = (): Theme => {
  const stored = readPref('classtools-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'light';
};

export function usePreferences() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [locale, setLocale] = useState<Locale>(() =>
    readPref('classtools-locale') === 'en' ? 'en' : 'vi'
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writePref('classtools-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#10162d' : '#f7f5ef'
    );
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    writePref('classtools-locale', locale);
  }, [locale]);

  return {
    theme,
    locale,
    toggleTheme: () => setTheme((value) => (value === 'light' ? 'dark' : 'light')),
    toggleLocale: () => setLocale((value) => (value === 'vi' ? 'en' : 'vi'))
  };
}
