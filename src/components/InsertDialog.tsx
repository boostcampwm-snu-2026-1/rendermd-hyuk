'use client';

import { useEffect, useId, useRef, useState } from 'react';
import styles from './InsertDialog.module.css';

export type InsertKind = 'link' | 'image';

interface InsertDialogProps {
  kind: InsertKind;
  /** Default value for the visible text (link text / image alt). */
  initialText?: string;
  onCancel: () => void;
  onSubmit: (url: string, text: string) => void;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function InsertDialog({ kind, initialText = '', onCancel, onSubmit }: InsertDialogProps) {
  const urlId = useId();
  const textId = useId();
  const errorId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLFormElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const backdropPointerDownRef = useRef(false);

  const [url, setUrl] = useState('');
  const [text, setText] = useState(initialText);
  const [urlError, setUrlError] = useState<string | null>(null);

  const title = kind === 'link' ? 'Insert link' : 'Insert image';
  const textLabel = kind === 'link' ? 'Link text' : 'Alt text';
  const textPlaceholder = kind === 'link' ? 'visible link text' : 'description for screen readers';
  const submitLabel = 'Insert';

  useEffect(() => {
    // Restore focus to the previously-focused element on close — usually
    // the toolbar button that opened the dialog.
    previousFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    urlInputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
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
  }, [onCancel]);

  const description =
    kind === 'link'
      ? 'Enter a URL and optional visible text. The selected editor text becomes the link.'
      : 'Enter an image URL and alternative text for screen readers.';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${urlId}-title`}
      aria-describedby={descId}
      className={styles.backdrop}
      onPointerDown={(e) => {
        backdropPointerDownRef.current = e.target === e.currentTarget;
      }}
      onPointerUp={(e) => {
        if (backdropPointerDownRef.current && e.target === e.currentTarget) {
          onCancel();
        }
        backdropPointerDownRef.current = false;
      }}
      onPointerCancel={() => {
        backdropPointerDownRef.current = false;
      }}
    >
      <form
        ref={dialogRef}
        className={styles.modal}
        data-print="hide"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmedUrl = url.trim();
          if (trimmedUrl.length === 0) {
            setUrlError('URL is required.');
            urlInputRef.current?.focus();
            return;
          }
          setUrlError(null);
          onSubmit(trimmedUrl, text);
        }}
      >
        <h2 id={`${urlId}-title`} className={styles.title}>
          {title}
        </h2>
        <p id={descId} className={styles.srOnly}>
          {description}
        </p>
        <div className={styles.field}>
          <label htmlFor={urlId} className={styles.label}>
            URL
          </label>
          <input
            ref={urlInputRef}
            id={urlId}
            type="url"
            inputMode="url"
            autoComplete="off"
            className={styles.input}
            placeholder="https://example.com"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (urlError != null) setUrlError(null);
            }}
            aria-invalid={urlError != null || undefined}
            aria-describedby={urlError ? errorId : undefined}
          />
          {urlError && (
            <span id={errorId} role="alert" className={styles.error}>
              {urlError}
            </span>
          )}
        </div>
        <div className={styles.field}>
          <label htmlFor={textId} className={styles.label}>
            {textLabel}
          </label>
          <input
            id={textId}
            type="text"
            className={styles.input}
            placeholder={textPlaceholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={styles.primary}>
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
