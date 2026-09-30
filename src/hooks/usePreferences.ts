import { useSyncExternalStore } from 'react';

export type Locale = 'vi' | 'en';
type Theme = 'light' | 'dark';
interface Preferences {
  theme: Theme;
  locale: Locale;
}

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

// One shared store so the shell (which toggles) and every page (which reads) stay in sync.
let state: Preferences = {
  theme: readPref('classtools-theme') === 'dark' ? 'dark' : 'light',
  locale: readPref('classtools-locale') === 'en' ? 'en' : 'vi'
};
const listeners = new Set<() => void>();

function apply({ theme, locale }: Preferences) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.lang = locale;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#10162d' : '#f7f5ef');
}
apply(state);

function update(next: Partial<Preferences>) {
  state = { ...state, ...next };
  writePref('classtools-theme', state.theme);
  writePref('classtools-locale', state.locale);
  apply(state);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePreferences() {
  const { theme, locale } = useSyncExternalStore(subscribe, () => state);
  return {
    theme,
    locale,
    toggleTheme: () => update({ theme: theme === 'light' ? 'dark' : 'light' }),
    setLocale: (next: Locale) => update({ locale: next })
  };
}
