/**
 * Fixed-size placeholder for header switchers loaded via next/dynamic
 * (ssr: false). Without these, the header is empty on first paint and
 * each switcher pops into place at a different moment — the brand
 * section jumps left, the toolbar reflows.
 *
 * Dimensions match the eventual switcher size so there's zero layout
 * shift on hand-off.
 */
import styles from './HeaderSlotPlaceholder.module.css';

interface HeaderSlotPlaceholderProps {
  /** Approximate width of the eventual switcher (px). */
  width: number;
}

export function HeaderSlotPlaceholder({ width }: HeaderSlotPlaceholderProps) {
  return <div className={styles.slot} style={{ width }} aria-hidden="true" />;
}
