'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark' | 'sepia' | 'hc';

export const THEMES: ReadonlyArray<{ id: Theme; label: string }> = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'hc', label: 'High contrast' },
];

// NOTE: Keep THEME_STORAGE_KEY and the Theme literal union in sync with the
// inline init script in src/app/layout.tsx (it runs before React loads and
// cannot import this module).
export const THEME_STORAGE_KEY = 'rendermd:theme';
const DEFAULT_THEME: Theme = 'light';

export function isTheme(value: string | null | undefined): value is Theme {
  return value === 'light' || value === 'dark' || value === 'sepia' || value === 'hc';
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): Theme {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const candidate = document.documentElement.dataset.theme;
  return isTheme(candidate) ? candidate : DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy initializer is the FAST path — on a normal load the inline head
  // script has already set data-theme by the time React renders, so the
  // first paint matches the saved theme with no flash.
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  // SAFETY NET: with static export, the SSR build runs without `document`
  // and bakes `theme='light'` into the HTML. On hydration React preserves
  // the SSR initial state (the lazy initializer is NOT re-run if the
  // hydrated tree matches), so without this effect the React state stays
  // 'light' even when the inline script set <html data-theme='dark'>.
  // The functional setter form makes the update a no-op when nothing
  // changed — so re-running the effect (StrictMode in dev) is idempotent.
  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (!isTheme(current)) return;
    // Bridges a pre-React inline script's DOM state into React state on
    // first paint after hydration — the canonical use case for this rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState((prev) => (current !== prev ? current : prev));
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Quota / privacy-mode failures: theme still applies in-session.
    }
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be called inside <ThemeProvider>');
  }
  return ctx;
}
