'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Classification of the last save failure so the UI can show a helpful
 * cause hint instead of a generic "Save failed".
 */
export type SaveErrorKind = 'quota' | 'unavailable' | 'unknown';

const STORAGE_KEY = 'rendermd:draft';
const DEBOUNCE_MS = 500;

interface UseDraftStorageReturn {
  value: string;
  setValue: (next: string) => void;
  status: SaveStatus;
  /** Populated when status === 'error'; null otherwise. */
  errorKind: SaveErrorKind | null;
  /** Re-attempt a write that previously failed (e.g. after QuotaExceededError). */
  retry: () => void;
  /** Synchronously commit any pending debounced write (e.g. on Cmd/Ctrl+S). */
  flush: () => void;
}

function readStorage(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

interface WriteResult {
  ok: boolean;
  errorKind: SaveErrorKind | null;
}

function classifyError(err: unknown): SaveErrorKind {
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    // QuotaExceededError or NS_ERROR_DOM_QUOTA_REACHED (Firefox)
    if (err.name === 'QuotaExceededError' || err.code === 22) return 'quota';
    if (err.name === 'SecurityError') return 'unavailable';
  }
  return 'unknown';
}

function writeStorage(value: string): WriteResult {
  if (typeof localStorage === 'undefined') {
    return { ok: false, errorKind: 'unavailable' };
  }
  try {
    localStorage.setItem(STORAGE_KEY, value);
    return { ok: true, errorKind: null };
  } catch (err) {
    return { ok: false, errorKind: classifyError(err) };
  }
}

/**
 * Persists the markdown draft to localStorage with a debounced write.
 *
 * Hardening on top of the basic debounce:
 *   - **pagehide / beforeunload**: flushes any pending write so a tab close
 *     during the 500ms debounce window doesn't drop the keystroke.
 *   - **storage event**: if another tab writes the same key, mirror the new
 *     value here (last-write-wins; the proposal scopes to single-document).
 *   - **retry()**: lets the UI re-attempt a write after a QuotaExceededError
 *     (e.g. the user freed space and clicked "Retry").
 *   - **errorKind**: classifies the failure so the UI can show a cause
 *     hint instead of a generic "Save failed".
 *
 * SSR/hydration: returns `fallback` on first render to match the build-time
 * pre-render. After mount, restores from localStorage.
 */
export function useDraftStorage(fallback: string): UseDraftStorageReturn {
  const [value, setValueState] = useState<string>(fallback);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorKind, setErrorKind] = useState<SaveErrorKind | null>(null);

  // Refs hold the latest pending write so handlers (pagehide / unmount) can
  // flush synchronously without going through a render.
  const pendingValueRef = useRef<string>(fallback);
  const hasPendingWriteRef = useRef<boolean>(false);
  const timerRef = useRef<number | null>(null);

  // Load saved draft once after mount.
  //
  // Static export bakes `fallback` into the SSR HTML, so the hydrated
  // tree starts with `value = fallback` regardless of any localStorage
  // restore that ran in the pre-React inline path. Read once on mount
  // and lift the saved string into React state.
  useEffect(() => {
    const saved = readStorage();
    if (saved === null) return;
    pendingValueRef.current = saved;
    // Restore-after-hydration is the intent of this effect — the setter
    // call IS the contract. Stay 'idle': the user hasn't typed yet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValueState(saved);
  }, []);

  const applyWriteResult = useCallback((res: WriteResult) => {
    hasPendingWriteRef.current = !res.ok;
    setStatus(res.ok ? 'saved' : 'error');
    setErrorKind(res.ok ? null : res.errorKind);
  }, []);

  // Write-only flush — no UI side effects. Used by paths that run
  // during unload (`pagehide` / `beforeunload`) and during unmount,
  // where a queued `setState('saving'/'saved')` is either lost or
  // warns about updating an unmounted component.
  const writeOnlyFlush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!hasPendingWriteRef.current) return;
    // Synchronous write — writeStorage is localStorage.setItem; no
    // async hops. If the write fails (quota / private mode) there's
    // nothing the user can do at unload time anyway; swallow.
    writeStorage(pendingValueRef.current);
    hasPendingWriteRef.current = false;
  }, []);

  // Synchronous flush with UI feedback — the manual-save entry point
  // (Cmd/Ctrl+S). If nothing is pending we still flip 'saving' →
  // 'saved' briefly so the user gets visible confirmation that their
  // explicit action was acknowledged.
  const flushPending = useCallback(() => {
    if (!hasPendingWriteRef.current) {
      setStatus('saving');
      window.setTimeout(() => setStatus('saved'), 120);
      return;
    }
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    applyWriteResult(writeStorage(pendingValueRef.current));
  }, [applyWriteResult]);

  useEffect(() => {
    window.addEventListener('pagehide', writeOnlyFlush);
    window.addEventListener('beforeunload', writeOnlyFlush);
    return () => {
      window.removeEventListener('pagehide', writeOnlyFlush);
      window.removeEventListener('beforeunload', writeOnlyFlush);
    };
  }, [writeOnlyFlush]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      if (e.newValue === null || e.newValue === pendingValueRef.current) return;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setValueState(e.newValue);
      pendingValueRef.current = e.newValue;
      hasPendingWriteRef.current = false;
      setStatus('saved');
      setErrorKind(null);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  useEffect(() => {
    return () => {
      // Unmount path: write the buffered value to storage but DON'T
      // touch React state — setters on an unmounted component are
      // either lost (strict mode) or warned about, and the user
      // can't see status updates after the component is gone anyway.
      writeOnlyFlush();
    };
  }, [writeOnlyFlush]);

  const setValue = useCallback(
    (next: string) => {
      setValueState(next);
      pendingValueRef.current = next;
      hasPendingWriteRef.current = true;
      setStatus('saving');
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        applyWriteResult(writeStorage(next));
      }, DEBOUNCE_MS);
    },
    [applyWriteResult],
  );

  const retry = useCallback(() => {
    setStatus('saving');
    applyWriteResult(writeStorage(pendingValueRef.current));
  }, [applyWriteResult]);

  return { value, setValue, status, errorKind, retry, flush: flushPending };
}
