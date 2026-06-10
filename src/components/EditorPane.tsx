'use client';

import { useMemo } from 'react';
import CodeMirror, { type Extension } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap } from '@codemirror/view';
import { autocompletion } from '@codemirror/autocomplete';
import { mathDecorationPlugin } from '@/lib/editor-math-decoration';
import {
  toggleBold,
  toggleBulletList,
  toggleHeading,
  toggleInlineCode,
  toggleItalic,
  toggleOrderedList,
  toggleQuote,
  toggleStrike,
  toggleTodo,
} from '@/lib/editor-commands';
import { getActiveMarks } from '@/lib/editor-active';
import type { ActiveMarks } from '@/lib/editor-active-types';
import { slashCompletionSource } from '@/lib/editor-slash-completions';
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

// `/` slash menu — autocomplete tooltip with block templates. `override`
// replaces the default completion source so we don't get noisy
// word-completions in prose mode; activateOnTyping keeps the popup live
// as the user filters with /h, /li, etc.
const SLASH_MENU = autocompletion({
  override: [slashCompletionSource],
  activateOnTyping: true,
  closeOnBlur: true,
});

/*
 * Selection styling injected through CodeMirror's own theme system.
 *
 * Why not just put this in themes.css like everything else? Because
 * CodeMirror runtime-injects its theme rules with a hashed class prefix
 * (`.ͼ4 .cm-line ::selection { background-color: transparent !important }`).
 * Our static `.cm-line ::selection { ... !important }` ties on
 * specificity (0,2,1) and loses on load order — CM's rule is appended
 * later. Within-line drag-select therefore fell back to a transparent
 * native selection over a JS-painted layer using the system `highlight`
 * color, which on Light themes is nearly invisible.
 *
 * Going through `EditorView.theme` means our rule ALSO gets the hashed
 * prefix and sits in the same stylesheet as CM's — and since we add it
 * AFTER CM's own theme in the extension array, it wins the cascade.
 *
 * Color uses var(--accent) at 40 % so it tracks every theme.
 */
const SELECTION_THEME = EditorView.theme({
  '.cm-content ::selection, .cm-line ::selection, .cm-line::selection': {
    background: 'color-mix(in srgb, var(--accent) 40%, transparent) !important',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection:not(:empty)':
    {
      background: 'color-mix(in srgb, var(--accent) 40%, transparent) !important',
    },
});

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
  /** Mod-K from inside the editor — open the link-insert dialog. */
  onInsertLinkRequest?: () => void;
}

export function EditorPane({
  value,
  onChange,
  dark = false,
  onCreateEditor,
  onActiveMarksChange,
  onInsertLinkRequest,
}: EditorPaneProps) {
  // Dialog-opening shortcuts need access to the parent's callbacks, so
  // their keymap can't be a module constant like FORMAT_KEYMAP. Memoize
  // it so CodeMirror only reconfigures when the callbacks actually
  // change.
  const extensions = useMemo<Extension[]>(() => {
    const dialogKeys = keymap.of([
      {
        key: 'Mod-k',
        run: () => {
          if (onInsertLinkRequest == null) return false;
          onInsertLinkRequest();
          return true;
        },
      },
    ]);
    return [
      // base: markdownLanguage activates GFM (tables / strikethrough /
      // task lists / autolinks) in the editor's source highlighting so
      // the editor visually matches what the preview will render.
      markdown({ base: markdownLanguage }),
      mathDecorationPlugin,
      EditorView.lineWrapping,
      FORMAT_KEYMAP,
      SLASH_MENU,
      dialogKeys,
      // Must come AFTER the editor's color theme (oneDark / default
      // light) so our hashed selection rule appends later and wins the
      // tie on specificity (0,2,1) — see SELECTION_THEME comment.
      SELECTION_THEME,
    ];
  }, [onInsertLinkRequest]);

  return (
    <div className={styles.wrapper}>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
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
