'use client';

import { AlertCircle, Check, Loader, RotateCcw } from 'lucide-react';
import type { SaveErrorKind, SaveStatus as Status } from '@/hooks/useDraftStorage';
import styles from './SaveStatus.module.css';

const LABELS: Record<Status, string> = {
  idle: 'Draft',
  saving: 'Saving',
  saved: 'Saved',
  error: 'Save failed',
};

const ERROR_HINT: Record<SaveErrorKind, string> = {
  quota: 'Storage full — clear some space, then retry.',
  unavailable: 'Browser storage is unavailable (private mode?).',
  unknown: 'Could not write to local storage.',
};

interface SaveStatusProps {
  status: Status;
  errorKind?: SaveErrorKind | null;
  onRetry?: () => void;
}

function StatusIcon({ status }: { status: Status }) {
  if (status === 'saving') {
    return <Loader size={14} strokeWidth={2.25} className={styles.spin} aria-hidden="true" />;
  }
  if (status === 'saved') {
    return <Check size={14} strokeWidth={2.25} aria-hidden="true" />;
  }
  if (status === 'error') {
    return <AlertCircle size={14} strokeWidth={2.25} aria-hidden="true" />;
  }
  return <span className={styles.dotPlaceholder} aria-hidden="true" />;
}

export function SaveStatusIndicator({ status, errorKind, onRetry }: SaveStatusProps) {
  const hint = status === 'error' ? (ERROR_HINT[errorKind ?? 'unknown'] ?? null) : null;
  // Two-region pattern: the always-visible status indicator stays put
  // for sighted users, and a sibling aria-live region only contains text
  // for states we WANT announced (saved / error). Toggling `aria-live`
  // on the same node is unreliable across screen readers — keeping the
  // live region permanently mounted with stable polite priority and
  // mutating its content is what NVDA / JAWS handle robustly.
  const announcement =
    status === 'saved'
      ? 'Draft saved'
      : status === 'error'
        ? `Save failed: ${ERROR_HINT[errorKind ?? 'unknown']}`
        : '';
  return (
    <>
      <span className={`${styles.indicator} ${styles[status]}`}>
        <StatusIcon status={status} />
        <span className={styles.text}>{LABELS[status]}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
        {status === 'error' && onRetry && (
          <button
            type="button"
            className={styles.retryBtn}
            onClick={onRetry}
            aria-label="Retry save"
          >
            <RotateCcw size={12} strokeWidth={2.25} aria-hidden="true" />
            <span className={styles.retryText}>Retry</span>
          </button>
        )}
      </span>
      <span role="status" aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {announcement}
      </span>
    </>
  );
}
