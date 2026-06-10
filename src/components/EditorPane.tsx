'use client';

import CodeMirror, { type Extension } from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap } from '@codemirror/view';
import {
  toggleBold,
  toggleItalic,
  toggleStrike,
  toggleInlineCode,
  toggleHeading,
  toggleBulletList,
  toggleOrderedList,
  toggleTodo,
  toggleQuote,
} from '@/lib/editor-commands';
import { getActiveMarks } from '@/lib/editor-active';
import type { ActiveMarks } from '@/lib/editor-active-types';
import styles from './EditorPane.module.css';

// Keyboard shortcuts mirror the toolbar button order. Inline marks use
// the conventional Ctrl/Cmd+letter; block toggles use Ctrl+Shift+key so
// they don't collide with browser/system bindings.
const FORMAT_KEYMAP = keymap.of([
  { key: 'Mod-b', run: toggleBold },
  { key: 'Mod-i', run: toggleItalic },
  { key: 'Mod-Shift-s', run: toggleStrike },
  { key: 'Mod-e', run: toggleInlineCode },
  { key: 'Mod-Shift-1', run: toggleHeading(1) },
  { key: 'Mod-Shift-2', run: toggleHeading(2) },
  { key: 'Mod-Shift-3', run: toggleHeading(3) },
  { key: 'Mod-Shift-8', run: toggleBulletList },
  { key: 'Mod-Shift-7', run: toggleOrderedList },
  { key: 'Mod-Shift-t', run: toggleTodo },
  { key: 'Mod-Shift-.', run: toggleQuote },
]);

// Soft-wrap long lines. Two reasons:
//   1. Conventional behavior for prose / markdown editors (iA Writer, Typora).
//   2. With short content, no wrap = .cm-scroller has no overflow, so wheel
//      events fall through to the .editor wrapper (overflow:hidden) and the
//      trackpad feels dead. Wrapping keeps the scroller authoritative.
const EXTENSIONS: Extension[] = [markdown(), EditorView.lineWrapping, FORMAT_KEYMAP];

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
  /**
   * Fires once when CodeMirror finishes mounting the EditorView. The
   * parent stores the ref so the Toolbar can dispatch commands without
   * the EditorPane having to know about it.
   */
  onCreateEditor?: (view: EditorView) => void;
  /**
   * Fires on every selection/doc change with the freshly-computed active
   * formatting marks. We do the syntax-tree read in here (not in the
   * parent) so `@codemirror/language` stays out of the main route chunk.
   */
  onActiveMarksChange?: (active: ActiveMarks) => void;
}

export function EditorPane({
  value,
  onChange,
  dark = false,
  onCreateEditor,
  onActiveMarksChange,
}: EditorPaneProps) {
  return (
    <div className={styles.wrapper}>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={EXTENSIONS}
        basicSetup={BASIC_SETUP}
        theme={dark ? oneDark : 'light'}
        height="100%"
        onCreateEditor={(view) => {
          onCreateEditor?.(view);
          onActiveMarksChange?.(getActiveMarks(view.state));
        }}
        onUpdate={(update) => {
          if (update.selectionSet || update.docChanged) {
            onActiveMarksChange?.(getActiveMarks(update.state));
          }
        }}
      />
    </div>
  );
}
