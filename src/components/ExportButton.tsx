'use client';

import { useEffect, useRef, useState } from 'react';
import { FileDown, Loader } from 'lucide-react';
import { isIOSSafari } from '@/util/platform';
import styles from './ExportButton.module.css';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ExportButton() {
  const [showGuide, setShowGuide] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  // Tracks whether the mouse/touch started ON the backdrop, so a click-drag
  // from modal interior to backdrop doesn't accidentally close the dialog.
  const backdropPointerDownRef = useRef(false);

  useEffect(() => {
    if (!showGuide) return;

    previousFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    continueButtonRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowGuide(false);
        return;
      }
      if (e.key !== 'Tab') return;

      const modal = modalRef.current;
      if (!modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      // Focus might have escaped the modal (e.g., user clicked an iframe).
      // Re-anchor inside before trapping.
      if (!modal.contains(document.activeElement)) {
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
      previousFocusRef.current?.focus?.();
    };
  }, [showGuide]);

  // True while we've called window.print() and the browser hasn't yet
  // returned the focus to us — used to render a small spinner so a
  // multi-MB document doesn't feel frozen during the 5-10s print
  // dialog spin-up.
  const [preparing, setPreparing] = useState(false);

  const callPrint = () => {
    // Some sandboxed iframes / PWAs throw on window.print(). Failing
    // silently leaves the user wondering why nothing happened — log so
    // the next debugging session has a trail.
    try {
      window.print();
    } catch (err) {
      console.warn('[ExportButton] window.print() rejected', err);
    } finally {
      setPreparing(false);
    }
  };

  const triggerPrint = () => {
    setShowGuide(false);
    setPreparing(true);
    // Defer to let the modal unmount + spinner paint before print
    // steals the main thread.
    setTimeout(callPrint, 0);
  };

  const handleClick = () => {
    if (isIOSSafari()) {
      setShowGuide(true);
      return;
    }
    setPreparing(true);
    setTimeout(callPrint, 0);
  };

  return (
    <>
      <button
        type="button"
        className={styles.button}
        onClick={handleClick}
        disabled={preparing}
        aria-label="Export as PDF"
        aria-busy={preparing || undefined}
      >
        {preparing ? (
          <Loader size={16} strokeWidth={2} aria-hidden="true" className={styles.spin} />
        ) : (
          <FileDown size={16} strokeWidth={2} aria-hidden="true" />
        )}
        {preparing ? 'Preparing…' : 'Export PDF'}
      </button>
      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="print-guide-title"
          className={styles.backdrop}
          onPointerDown={(e) => {
            backdropPointerDownRef.current = e.target === e.currentTarget;
          }}
          onPointerUp={(e) => {
            // Only close if BOTH down and up were on the backdrop — avoids
            // closing when the user starts a drag-select inside the modal
            // and releases on the backdrop.
            if (backdropPointerDownRef.current && e.target === e.currentTarget) {
              setShowGuide(false);
            }
            backdropPointerDownRef.current = false;
          }}
          onPointerCancel={() => {
            // iOS may cancel a pointer gesture mid-drag; without this reset
            // a stray later pointerup could spuriously close the modal.
            backdropPointerDownRef.current = false;
          }}
        >
          <div ref={modalRef} className={styles.modal} data-print="hide">
            <h2 id="print-guide-title" className={styles.title}>
              Saving as PDF on iPhone / iPad
            </h2>
            <ol className={styles.steps}>
              <li>
                Tap <b>Continue</b> below to open the print preview.
              </li>
              <li>Spread two fingers (pinch out) on the preview to expand it.</li>
              <li>
                Tap the share icon, then <b>Save to Files</b>.
              </li>
            </ol>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setShowGuide(false)}
              >
                Cancel
              </button>
              <button
                ref={continueButtonRef}
                type="button"
                className={styles.primary}
                onClick={triggerPrint}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
