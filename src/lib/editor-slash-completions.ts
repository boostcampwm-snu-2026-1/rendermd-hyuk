/**
 * `/` slash menu for the markdown editor.
 *
 * Users who don't speak markdown can type `/` at the start of a line
 * (or after leading whitespace) and pick a block template from an
 * autocomplete popup — the same affordance Notion / Linear / Slack
 * popularized. The popup uses @codemirror/autocomplete's built-in
 * tooltip + keyboard navigation, so no custom UI surface is needed
 * for the menu itself.
 *
 * Detection rule: `/` immediately after optional leading whitespace,
 * with an optional word being typed after it. So:
 *
 *   "/" → menu opens
 *   "  /" → menu opens (inside a nested list)
 *   "/he" → menu opens, filters to "/heading 1/2/3"
 *   "x /code" → does NOT open (not at line start)
 *
 * On accept, the trigger range (`/...`) is replaced by the chosen
 * template. Block templates with a multi-line body (code fence,
 * divider) leave the cursor on the editable line inside.
 */

import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

interface SlashItem {
  /** Label shown in the popup (e.g. "/heading 1"). */
  label: string;
  /** Short hint shown to the right (e.g. "# Heading"). */
  detail: string;
  /** Plain text inserted in place of the trigger. */
  insert: string;
  /**
   * Optional cursor offset (chars from `insertedStart`) — used by
   * templates whose useful caret position isn't at the end of the
   * inserted text (e.g. code fences place the caret BETWEEN the
   * fence lines).
   */
  cursorOffset?: number;
}

const ITEMS: SlashItem[] = [
  { label: '/heading 1', detail: '# ', insert: '# ' },
  { label: '/heading 2', detail: '## ', insert: '## ' },
  { label: '/heading 3', detail: '### ', insert: '### ' },
  { label: '/bullet list', detail: '- ', insert: '- ' },
  { label: '/numbered list', detail: '1. ', insert: '1. ' },
  { label: '/to-do', detail: '- [ ] ', insert: '- [ ] ' },
  { label: '/quote', detail: '> ', insert: '> ' },
  { label: '/code', detail: '```', insert: '```\n\n```\n', cursorOffset: 4 },
  { label: '/divider', detail: '---', insert: '---\n' },
  {
    label: '/table',
    detail: 'GFM table',
    insert: '| col1 | col2 |\n| --- | --- |\n|  |  |\n',
    cursorOffset: 36,
  },
];

const TRIGGER_RE = /^\s*\/(\w*)$/;

export function slashCompletionSource(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const beforeCursor = line.text.slice(0, context.pos - line.from);
  const match = TRIGGER_RE.exec(beforeCursor);
  if (!match) return null;

  // Only open the menu automatically while the user is actively typing
  // a query — open it explicitly (Ctrl-Space) when they just typed `/`
  // with no follow-up character. Without this guard, the popup also
  // appears when the line ends with `/` in pasted content and the
  // cursor lands there accidentally.
  if (!context.explicit && match[1].length === 0) return null;

  const start = context.pos - match[1].length - 1;
  return {
    from: start,
    to: context.pos,
    // Keep the menu open as the user keeps typing a word.
    validFor: /^\/\w*$/,
    options: ITEMS.map((item) => ({
      label: item.label,
      detail: item.detail,
      apply: (view, _completion, from, to) => {
        const insertEnd = from + item.insert.length;
        const cursor = item.cursorOffset != null ? from + item.cursorOffset : insertEnd;
        view.dispatch({
          changes: { from, to, insert: item.insert },
          selection: { anchor: cursor },
          userEvent: 'input.complete',
        });
      },
    })),
  };
}
