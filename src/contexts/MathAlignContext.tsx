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

export type MathAlign = 'center' | 'left';

export const MATH_ALIGNS: ReadonlyArray<{ id: MathAlign; label: string }> = [
  { id: 'center', label: 'Center' },
  { id: 'left', label: 'Left' },
];

// NOTE: Keep MATH_ALIGN_STORAGE_KEY and the MathAlign literal union in
// sync with the inline init script in src/app/layout.tsx (it runs before
// React loads and cannot import this module).
export const MATH_ALIGN_STORAGE_KEY = 'rendermd:math-align';
const DEFAULT_ALIGN: MathAlign = 'center';

export function isMathAlign(value: string | null | undefined): value is MathAlign {
  return value === 'center' || value === 'left';
}

interface MathAlignContextValue {
  align: MathAlign;
  setAlign: (a: MathAlign) => void;
}

const MathAlignContext = createContext<MathAlignContextValue | null>(null);

function readInitial(): MathAlign {
  if (typeof document === 'undefined') return DEFAULT_ALIGN;
  const candidate = document.documentElement.dataset.mathAlign;
  return isMathAlign(candidate) ? candidate : DEFAULT_ALIGN;
}

export function MathAlignProvider({ children }: { children: ReactNode }) {
  const [align, setAlignState] = useState<MathAlign>(readInitial);

  // Same SSR-state-mismatch safety net as ThemeContext: on static export
  // the build runs without `document` and bakes 'center' into the HTML.
  // React doesn't re-run the lazy initializer on hydration, so if the
  // inline script applied a different value we'd be stuck. Re-sync with
  // a functional setter so the update no-ops when nothing changed.
  useEffect(() => {
    const current = document.documentElement.dataset.mathAlign;
    if (!isMathAlign(current)) return;
    // Bridges a pre-React inline script's DOM state into React state on
    // first paint after hydration — the canonical use case for this rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAlignState((prev) => (current !== prev ? current : prev));
  }, []);

  const setAlign = useCallback((next: MathAlign) => {
    setAlignState(next);
    document.documentElement.dataset.mathAlign = next;
    try {
      localStorage.setItem(MATH_ALIGN_STORAGE_KEY, next);
    } catch {
      /* Quota / privacy-mode failures: align still applies in-session. */
    }
  }, []);

  const value = useMemo<MathAlignContextValue>(() => ({ align, setAlign }), [align, setAlign]);

  return <MathAlignContext.Provider value={value}>{children}</MathAlignContext.Provider>;
}

export function useMathAlign(): MathAlignContextValue {
  const ctx = useContext(MathAlignContext);
  if (!ctx) {
    throw new Error('useMathAlign must be called inside <MathAlignProvider>');
  }
  return ctx;
}
