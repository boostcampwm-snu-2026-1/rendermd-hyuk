'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileDown, Loader } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { isIOSSafari } from '@/util/platform';
import styles from './ExportButton.module.css';

export function ExportButton() {
  const [showGuide, setShowGuide] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  // Tracks whether the mouse/touch started ON the backdrop, so a click-drag
  // from modal interior to backdrop doesn't accidentally close the dialog.
  const backdropPointerDownRef = useRef(false);

  const closeGuide = useCallback(() => setShowGuide(false), []);
  useFocusTrap({ active: showGuide, containerRef: modalRef, onEscape: closeGuide });

  // Initial focus belongs on the primary action (Continue). Defer via rAF
  // so iOS Safari doesn't silently reject focus() during the modal's
  // display-block transition.
  useEffect(() => {
    if (!showGuide) return;
    const rafId = requestAnimationFrame(() => continueButtonRef.current?.focus());
    return () => cancelAnimationFrame(rafId);
  }, [showGuide]);

  // True while we've called window.print() and the browser hasn't yet
  // returned the focus to us — used to render a small spinner so a
  // multi-MB document doesn't feel frozen during the 5-10s print
  // dialog spin-up.
  const [preparing, setPreparing] = useState(false);

  const callPrint = () => {
    // Some sandboxed iframes / PWAs throw on window.print(). Failing
    // silently leaves the user wondering why nothing happened — log so
    // the next debugging session has a trail (dev only; production
    // consoles stay clean).
    try {
      window.print();
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[ExportButton] window.print() rejected', err);
      }
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
