'use client';

import CodeMirror, { type Extension } from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import styles from './EditorPane.module.css';

// Soft-wrap long lines. Two reasons:
//   1. Conventional behavior for prose / markdown editors (iA Writer, Typora).
//   2. With short content, no wrap = .cm-scroller has no overflow, so wheel
//      events fall through to the .editor wrapper (overflow:hidden) and the
//      trackpad feels dead. Wrapping keeps the scroller authoritative.
const EXTENSIONS: Extension[] = [markdown(), EditorView.lineWrapping];

const BASIC_SETUP = {
  lineNumbers: true,
  foldGutter: true,
  highlightActiveLine: true,
  highlightSelectionMatches: false,
} as const;

interface EditorPaneProps {
  value: string;
  onChange: (next: string) => void;
  dark?: boolean;
}

export function EditorPane({ value, onChange, dark = false }: EditorPaneProps) {
  return (
    <div className={styles.wrapper}>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={EXTENSIONS}
        basicSetup={BASIC_SETUP}
        theme={dark ? oneDark : 'light'}
        height="100%"
      />
    </div>
  );
}
