'use client';

import { useId } from 'react';
import { Sigma } from 'lucide-react';
import { isMathAlign, MATH_ALIGNS, useMathAlign } from '@/contexts/MathAlignContext';
import styles from './MathAlignSwitcher.module.css';

export function MathAlignSwitcher() {
  const { align, setAlign } = useMathAlign();
  const id = useId();

  return (
    <div className={styles.wrapper}>
      <label htmlFor={id} className={styles.label}>
        <Sigma size={14} strokeWidth={2} aria-hidden="true" />
        <span className={styles.labelText}>Math</span>
      </label>
      <select
        id={id}
        className={styles.select}
        value={align}
        onChange={(event) => {
          const next = event.target.value;
          if (isMathAlign(next)) setAlign(next);
        }}
      >
        {MATH_ALIGNS.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>
    </div>
  );
}
