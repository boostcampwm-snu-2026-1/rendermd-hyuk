import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDraftStorage } from '@/hooks/useDraftStorage';

const STORAGE_KEY = 'rendermd:draft';

describe('useDraftStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns the fallback value before any save', () => {
    const { result } = renderHook(() => useDraftStorage('hello'));
    expect(result.current.value).toBe('hello');
    expect(result.current.status).toBe('idle');
  });

  it('restores from localStorage on mount when a draft exists', () => {
    localStorage.setItem(STORAGE_KEY, 'saved content');
    const { result } = renderHook(() => useDraftStorage('fallback'));
    expect(result.current.value).toBe('saved content');
    // Stay 'idle' on restore — user hasn't typed yet.
    expect(result.current.status).toBe('idle');
  });

  it('debounces writes and transitions idle → saving → saved', () => {
    const { result } = renderHook(() => useDraftStorage('initial'));

    act(() => {
      result.current.setValue('typed');
    });

    expect(result.current.value).toBe('typed');
    expect(result.current.status).toBe('saving');
    // Not yet flushed to storage.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.status).toBe('saved');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('typed');
  });

  it('coalesces rapid keystrokes into a single write', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useDraftStorage('initial'));

    act(() => {
      result.current.setValue('a');
      result.current.setValue('ab');
      result.current.setValue('abc');
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEY, 'abc');
  });

  it('transitions to error when setItem throws (quota exceeded)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    const { result } = renderHook(() => useDraftStorage('initial'));

    act(() => {
      result.current.setValue('big');
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.status).toBe('error');
  });

  it('retry() re-attempts the write and clears error on success', () => {
    let throwOnce = true;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((_k, _v) => {
      if (throwOnce) {
        throwOnce = false;
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
    });

    const { result } = renderHook(() => useDraftStorage('initial'));

    act(() => {
      result.current.setValue('big');
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.status).toBe('error');

    act(() => {
      result.current.retry();
    });
    expect(result.current.status).toBe('saved');
  });

  it('flushes pending write on pagehide', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useDraftStorage('initial'));

    act(() => {
      result.current.setValue('unsaved');
    });
    expect(setItemSpy).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    // Unload path writes synchronously but intentionally skips the
    // 'saving' → 'saved' status flip — the tab is going away, and
    // setState during teardown is either lost or warned about.
    expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEY, 'unsaved');
    expect(result.current.status).toBe('saving');
  });

  it('syncs from another tab via storage event', () => {
    const { result } = renderHook(() => useDraftStorage('initial'));

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: 'from another tab',
          oldValue: null,
        }),
      );
    });

    expect(result.current.value).toBe('from another tab');
    expect(result.current.status).toBe('saved');
  });

  it('storage event cancels a pending local debounce (no peer-value clobber)', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useDraftStorage('initial'));

    // Local user types — pending debounce armed.
    act(() => {
      result.current.setValue('local typing');
    });
    expect(result.current.status).toBe('saving');

    // Peer tab writes BEFORE our debounce fires.
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: 'peer write',
          oldValue: 'initial',
        }),
      );
    });

    // Advance past the original debounce window.
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // The pending write should have been cancelled; our setItem must NOT
    // have fired with the stale 'local typing'.
    expect(setItemSpy).not.toHaveBeenCalledWith(STORAGE_KEY, 'local typing');
    expect(result.current.value).toBe('peer write');
  });

  it('ignores storage events for unrelated keys', () => {
    const { result } = renderHook(() => useDraftStorage('initial'));

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'something:else',
          newValue: 'irrelevant',
        }),
      );
    });

    expect(result.current.value).toBe('initial');
  });
});
