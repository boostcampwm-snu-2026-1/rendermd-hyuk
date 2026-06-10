import { describe, it, expect } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
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

/**
 * Build a fresh headless EditorView with the given doc and selection.
 * `select` accepts either a [from, to] tuple or a `cursorAt` shorthand.
 */
function makeView(doc: string, select: [number, number] | { cursor: number } = { cursor: 0 }) {
  const selection =
    'cursor' in select
      ? EditorSelection.cursor(select.cursor)
      : EditorSelection.range(select[0], select[1]);
  const state = EditorState.create({ doc, selection, extensions: [markdown()] });
  // Headless EditorView — no DOM mount needed for command tests.
  const view = new EditorView({ state, parent: document.createElement('div') });
  return view;
}

function expectDoc(view: EditorView, expected: string) {
  expect(view.state.doc.toString()).toBe(expected);
}

describe('inline wrap commands', () => {
  it('toggleBold wraps a plain selection', () => {
    const v = makeView('hello world', [0, 5]);
    toggleBold(v);
    expectDoc(v, '**hello** world');
  });

  it('toggleBold on empty selection inserts paired ** and parks cursor inside', () => {
    const v = makeView('xy', { cursor: 1 });
    toggleBold(v);
    expectDoc(v, 'x****y');
    expect(v.state.selection.main.head).toBe(3);
  });

  it('toggleBold unwraps when the selection itself is the wrapped text', () => {
    const v = makeView('**hello** world', [0, 9]); // selects `**hello**`
    toggleBold(v);
    expectDoc(v, 'hello world');
  });

  it('toggleBold unwraps when markers sit just outside the selection', () => {
    const v = makeView('**hello** world', [2, 7]); // selects `hello` inside the markers
    toggleBold(v);
    expectDoc(v, 'hello world');
  });

  it('toggleItalic uses underscore form', () => {
    const v = makeView('hi', [0, 2]);
    toggleItalic(v);
    expectDoc(v, '_hi_');
  });

  it('toggleStrike uses ~~', () => {
    const v = makeView('hi', [0, 2]);
    toggleStrike(v);
    expectDoc(v, '~~hi~~');
  });

  it('toggleInlineCode uses backticks', () => {
    const v = makeView('foo', [0, 3]);
    toggleInlineCode(v);
    expectDoc(v, '`foo`');
  });
});

describe('block-prefix commands', () => {
  it('toggleHeading(1) on a plain line adds `# `', () => {
    const v = makeView('hello', { cursor: 0 });
    toggleHeading(1)(v);
    expectDoc(v, '# hello');
  });

  it('toggleHeading(1) on an existing H1 removes it', () => {
    const v = makeView('# hello', { cursor: 2 });
    toggleHeading(1)(v);
    expectDoc(v, 'hello');
  });

  it('toggleHeading(2) on an H1 SWITCHES level instead of removing', () => {
    const v = makeView('# hello', { cursor: 2 });
    toggleHeading(2)(v);
    expectDoc(v, '## hello');
  });

  it('toggleBulletList adds `- ` to a plain line', () => {
    const v = makeView('alpha\nbeta', { cursor: 0 });
    toggleBulletList(v);
    expectDoc(v, '- alpha\nbeta');
  });

  it('toggleBulletList toggles off when first line already has `- `', () => {
    const v = makeView('- alpha\n- beta', [0, 14]);
    toggleBulletList(v);
    expectDoc(v, 'alpha\nbeta');
  });

  it('toggleBulletList does NOT match a todo line', () => {
    const v = makeView('- [ ] task\nplain', [0, 16]);
    toggleBulletList(v);
    // Todo line should not be treated as a bullet; both lines get a fresh `- `.
    expectDoc(v, '- - [ ] task\n- plain');
  });

  it('toggleOrderedList numbers selected lines sequentially', () => {
    const v = makeView('a\nb\nc', [0, 5]);
    toggleOrderedList(v);
    expectDoc(v, '1. a\n2. b\n3. c');
  });

  it('toggleTodo adds `- [ ] ` to a plain line', () => {
    const v = makeView('write tests', { cursor: 0 });
    toggleTodo(v);
    expectDoc(v, '- [ ] write tests');
  });

  it('toggleTodo removes existing todo prefix (both checked and unchecked)', () => {
    const v = makeView('- [x] done', { cursor: 7 });
    toggleTodo(v);
    expectDoc(v, 'done');
  });

  it('toggleQuote adds `> `', () => {
    const v = makeView('quoted', { cursor: 0 });
    toggleQuote(v);
    expectDoc(v, '> quoted');
  });
});
