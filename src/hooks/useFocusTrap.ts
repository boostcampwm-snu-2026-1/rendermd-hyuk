'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Tab-cycle focus trap + Esc-to-close for modal dialogs.
 *
 * Behaviour while `active`:
 *   - Stash the previously-focused element so we can restore it on close.
 *   - Lock body scroll so the page underneath doesn't move when the user
 *     interacts with the dialog.
 *   - Intercept Tab / Shift+Tab and wrap inside the container, including
 *     the case where focus has escaped (clicked iframe, opened devtools)
 *     and needs to be re-anchored.
 *   - Intercept Escape and invoke `onEscape`.
 *
 * On cleanup:
 *   - Restore body scroll.
 *   - Restore the previously-focused element if it's still in the DOM.
 *     If it has been removed (its host re-mounted), fall back to
 *     `document.body.focus()` so the document doesn't end up with focus
 *     stranded on `<body>` silently.
 *
 * Replaces the hand-rolled trap that was duplicated in `ExportButton`
 * and `InsertDialog` — bug fixes (like the stale-element focus restore
 * and the re-anchor branch) only have to land here.
 */

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface UseFocusTrapOptions {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onEscape: () => void;
}

export function useFocusTrap({ active, containerRef, onEscape }: UseFocusTrapOptions) {
  useEffect(() => {
    if (!active) return;

    const previousFocus = (document.activeElement as HTMLElement) ?? null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape();
        return;
      }
      if (e.key !== 'Tab') return;

      const container = containerRef.current;
      if (!container) return;
      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      // Focus might have escaped the container (e.g. user clicked an
      // iframe, opened devtools, or focus landed on a portal that
      // doesn't visually live inside `containerRef`). Re-anchor before
      // trapping the cycle.
      if (!container.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
        return;
      }

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus();
      } else {
        // The previously-focused element has left the DOM — fall back
        // to body so focus doesn't end up stranded on nothing.
        document.body.focus?.();
      }
    };
  }, [active, containerRef, onEscape]);
}
