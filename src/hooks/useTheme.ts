import { useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'frugallm-theme';

export function getInitialTheme(): Theme {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme === 'dark' || storedTheme === 'light') {
        return storedTheme;
      }
    }
  } catch {
    // Fallback if localStorage is restricted
  }
  return 'dark';
}

export function applyThemeToDOM(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark', 'theme-ebony');
    root.classList.remove('light', 'theme-linen');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.add('light', 'theme-linen');
    root.classList.remove('dark', 'theme-ebony');
    root.setAttribute('data-theme', 'light');
  }
}

let globalTheme: Theme = getInitialTheme();
const listeners = new Set<(t: Theme) => void>();

function updateGlobalTheme(next: Theme) {
  globalTheme = next;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    }
  } catch {
    // Ignore storage errors
  }
  applyThemeToDOM(next);
  listeners.forEach((fn) => fn(next));
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_STORAGE_KEY && (e.newValue === 'dark' || e.newValue === 'light')) {
      updateGlobalTheme(e.newValue);
    }
  });
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const initial = getInitialTheme();
    globalTheme = initial;
    applyThemeToDOM(initial);
    return initial;
  });

  useEffect(() => {
    const listener = (newTheme: Theme) => {
      setThemeState(newTheme);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    updateGlobalTheme(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const next: Theme = globalTheme === 'dark' ? 'light' : 'dark';
    updateGlobalTheme(next);
  }, []);

  return {
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme,
  };
}
