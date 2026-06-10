import { describe, it, expect } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import { slashCompletionSource } from '@/lib/editor-slash-completions';

function ctx(doc: string, pos: number, explicit = false) {
  const state = EditorState.create({ doc, selection: EditorSelection.cursor(pos) });
  return new CompletionContext(state, pos, explicit);
}

describe('slashCompletionSource', () => {
  it('opens the menu after typing `/h` at line start', () => {
    const r = slashCompletionSource(ctx('/h', 2));
    expect(r).not.toBeNull();
    expect(r!.from).toBe(0);
    expect(r!.options.length).toBeGreaterThanOrEqual(8);
  });

  it('does NOT auto-open with bare `/` (no filter yet)', () => {
    const r = slashCompletionSource(ctx('/', 1));
    expect(r).toBeNull();
  });

  it('DOES open with bare `/` when explicit (Ctrl-Space)', () => {
    const r = slashCompletionSource(ctx('/', 1, true));
    expect(r).not.toBeNull();
    expect(r!.from).toBe(0);
  });

  it('opens after leading whitespace (nested list situation)', () => {
    const r = slashCompletionSource(ctx('   /co', 6));
    expect(r).not.toBeNull();
    // `from` is the slash position, not the line start.
    expect(r!.from).toBe(3);
  });

  it('rejects `/` mid-line (not at line start)', () => {
    const r = slashCompletionSource(ctx('text /co', 8));
    expect(r).toBeNull();
  });

  it('rejects `/` on a non-empty later line correctly', () => {
    // cursor on line 2, after some text on that line — should reject
    const r = slashCompletionSource(ctx('a\nb /h', 6));
    expect(r).toBeNull();
  });

  it('opens at line start on a later line', () => {
    // cursor on line 2 right after a `/word`
    const r = slashCompletionSource(ctx('a\n/h', 4));
    expect(r).not.toBeNull();
    expect(r!.from).toBe(2);
  });

  it('includes the expected core block templates', () => {
    const r = slashCompletionSource(ctx('/', 1, true));
    const labels = r!.options.map((o) => o.label);
    for (const want of [
      '/heading 1',
      '/heading 2',
      '/heading 3',
      '/bullet list',
      '/numbered list',
      '/to-do',
      '/quote',
      '/code',
      '/divider',
      '/table',
    ]) {
      expect(labels).toContain(want);
    }
  });
});
