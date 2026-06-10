/**
 * Format commands for the editor toolbar.
 *
 * Each command is a pure function `(view: EditorView) => boolean` — the
 * CodeMirror command signature. They operate via `view.dispatch` so the
 * transaction goes through CodeMirror's normal update flow (undo
 * history, syntax-tree refresh, view update listeners).
 *
 * Two shape families:
 *   - Inline-wrap (bold, italic, strike, inline-code): wrap selection
 *     with a paired marker, or unwrap if already wrapped. Empty
 *     selection inserts the markers and places the cursor between them
 *     so the user can keep typing inside the new format.
 *   - Block-prefix (heading 1-3, bullet/ordered list, todo, quote):
 *     toggle a leading marker on each line that intersects the
 *     selection. Re-applying the same level strips it; switching levels
 *     replaces the previous prefix.
 *
 * The block-prefix family is selection-aware: if the user has multiple
 * lines selected, every line gets the toggle decision based on the
 * FIRST line's current state (consistent with how Notion / Typora /
 * iA Writer behave — predictable rather than per-line individual).
 */

import type { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import type { ChangeSpec, EditorState, SelectionRange } from '@codemirror/state';

// ─── Inline wraps ──────────────────────────────────────────────────────

function wrapInline(view: EditorView, marker: string): boolean {
  const { state } = view;
  const changes: ChangeSpec[] = [];
  const newRanges: SelectionRange[] = [];
  const m = marker;
  const m2 = m.length;

  for (const range of state.selection.ranges) {
    const text = state.doc.sliceString(range.from, range.to);
    const before = state.doc.sliceString(Math.max(0, range.from - m2), range.from);
    const after = state.doc.sliceString(range.to, Math.min(state.doc.length, range.to + m2));

    if (text.length === 0) {
      // Empty selection — insert paired markers and place cursor between.
      changes.push({ from: range.from, insert: m + m });
      const cursor = range.from + m2;
      newRanges.push(EditorSelection.cursor(cursor));
      continue;
    }

    // Already wrapped INSIDE the selection (`**bold**` selected fully).
    if (text.startsWith(m) && text.endsWith(m) && text.length >= m2 * 2) {
      changes.push({ from: range.from, to: range.to, insert: text.slice(m2, text.length - m2) });
      newRanges.push(EditorSelection.range(range.from, range.to - m2 * 2));
      continue;
    }

    // Wrapped JUST OUTSIDE the selection (markers adjacent in the doc).
    if (before === m && after === m) {
      changes.push({ from: range.from - m2, to: range.from, insert: '' });
      changes.push({ from: range.to, to: range.to + m2, insert: '' });
      newRanges.push(EditorSelection.range(range.from - m2, range.to - m2));
      continue;
    }

    // Plain wrap.
    changes.push({ from: range.from, insert: m });
    changes.push({ from: range.to, insert: m });
    newRanges.push(EditorSelection.range(range.from + m2, range.to + m2));
  }

  if (changes.length === 0) return false;
  view.dispatch({
    changes,
    selection: EditorSelection.create(newRanges),
    userEvent: 'input.format',
  });
  view.focus();
  return true;
}

export const toggleBold = (view: EditorView): boolean => wrapInline(view, '**');
export const toggleItalic = (view: EditorView): boolean => wrapInline(view, '_');
export const toggleStrike = (view: EditorView): boolean => wrapInline(view, '~~');
export const toggleInlineCode = (view: EditorView): boolean => wrapInline(view, '`');

// ─── Block prefixes ────────────────────────────────────────────────────

interface BlockPrefixConfig {
  /** RegExp that captures the current prefix; the match must be at line start. */
  detect: RegExp;
  /** Function that returns the prefix to apply (line-number aware for ordered list). */
  apply: (lineIndex: number) => string;
  /** When a line already has THIS prefix, toggling removes it. */
  matchesSelf?: (existing: string) => boolean;
}

function getSelectedLineRange(state: EditorState): { firstLine: number; lastLine: number } {
  const main = state.selection.main;
  return {
    firstLine: state.doc.lineAt(main.from).number,
    lastLine: state.doc.lineAt(main.to).number,
  };
}

function applyBlockPrefix(view: EditorView, cfg: BlockPrefixConfig): boolean {
  const { state } = view;
  const { firstLine, lastLine } = getSelectedLineRange(state);
  const first = state.doc.line(firstLine);
  const firstMatch = first.text.match(cfg.detect);
  const selfRule = cfg.matchesSelf ?? (() => true);
  const isRemove = firstMatch !== null && selfRule(firstMatch[0]);

  const changes: ChangeSpec[] = [];
  for (let n = firstLine; n <= lastLine; n++) {
    const line = state.doc.line(n);
    const existing = line.text.match(cfg.detect);
    const stripped = existing ? line.text.slice(existing[0].length) : line.text;
    const next = isRemove ? stripped : cfg.apply(n - firstLine) + stripped;
    if (next !== line.text) {
      changes.push({ from: line.from, to: line.to, insert: next });
    }
  }
  if (changes.length === 0) return false;
  view.dispatch({ changes, userEvent: 'input.format' });
  view.focus();
  return true;
}

// Detects ANY heading prefix (#, ##, ###, …) so switching levels strips
// the previous one cleanly.
const ANY_HEADING_RE = /^#{1,6} /;

export const toggleHeading =
  (level: 1 | 2 | 3) =>
  (view: EditorView): boolean =>
    applyBlockPrefix(view, {
      detect: ANY_HEADING_RE,
      apply: () => '#'.repeat(level) + ' ',
      // Only treat as a "remove" toggle if the existing prefix is the
      // SAME level the user clicked. Different level → switch, not remove.
      matchesSelf: (existing) => existing === '#'.repeat(level) + ' ',
    });

export const toggleBulletList = (view: EditorView): boolean =>
  applyBlockPrefix(view, {
    detect: /^- (?!\[[ x]\] )/,
    apply: () => '- ',
  });

export const toggleOrderedList = (view: EditorView): boolean =>
  applyBlockPrefix(view, {
    detect: /^\d+\. /,
    apply: (i) => `${i + 1}. `,
  });

export const toggleTodo = (view: EditorView): boolean =>
  applyBlockPrefix(view, {
    detect: /^- \[[ x]\] /,
    apply: () => '- [ ] ',
  });

export const toggleQuote = (view: EditorView): boolean =>
  applyBlockPrefix(view, {
    detect: /^> /,
    apply: () => '> ',
  });

// ─── Insert commands ───────────────────────────────────────────────────

/**
 * Insert (or wrap, when there's a selection) a markdown link.
 *   - With no selection at cursor pos P:
 *       insert `[text](url)` and leave the caret AFTER the closing `)`.
 *   - With a selection covering "hello":
 *       wrap to `[hello](url)` keeping the original text as the visible
 *       part. `text` arg is ignored when the doc already has content
 *       inside the wrap range (preserves the user's typing).
 */
export function insertLink(view: EditorView, url: string, text: string): boolean {
  const { state } = view;
  const range = state.selection.main;
  const existing = state.doc.sliceString(range.from, range.to);
  const visible = existing.length > 0 ? existing : text;
  const inserted = `[${visible}](${url})`;
  const cursor = range.from + inserted.length;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: inserted },
    selection: { anchor: cursor },
    userEvent: 'input.insert.link',
  });
  view.focus();
  return true;
}
