import { describe, it, expect } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { _buildForTest } from '@/lib/editor-math-decoration';

/**
 * Build a headless EditorView large enough that its visibleRanges
 * cover the whole doc — the plugin scans by viewport, so for tests
 * we want one big visible span.
 */
function viewFor(doc: string): EditorView {
  const state = EditorState.create({ doc, selection: EditorSelection.cursor(0) });
  const parent = document.createElement('div');
  parent.style.width = '800px';
  parent.style.height = '4000px';
  document.body.appendChild(parent);
  return new EditorView({ state, parent });
}

interface Range {
  from: number;
  to: number;
  classes: string;
}

function ranges(view: EditorView): Range[] {
  const set = _buildForTest(view);
  const out: Range[] = [];
  const cursor = set.iter();
  while (cursor.value != null) {
    const cls = (cursor.value.spec as { class?: string }).class ?? '';
    out.push({ from: cursor.from, to: cursor.to, classes: cls });
    cursor.next();
  }
  return out;
}

describe('mathDecorationPlugin', () => {
  it('marks `$x$` inline math', () => {
    const r = ranges(viewFor('hello $E = mc^2$ world'));
    expect(r.length).toBe(1);
    expect(r[0]).toMatchObject({ from: 6, to: 16, classes: expect.stringContaining('inline') });
  });

  it('marks `\\(x\\)` inline math', () => {
    const r = ranges(viewFor('text \\(\\pi\\) more'));
    expect(r.length).toBe(1);
    expect(r[0].classes).toContain('inline');
  });

  it('marks `$$...$$` block math (multi-line)', () => {
    const r = ranges(viewFor('before\n$$\nE = mc^2\n$$\nafter'));
    expect(r.length).toBe(1);
    expect(r[0].classes).toContain('block');
  });

  it('marks `\\[ ... \\]` block math (multi-line)', () => {
    const r = ranges(viewFor('intro\n\\[\nx + y = z\n\\]\nbody'));
    expect(r.length).toBe(1);
    expect(r[0].classes).toContain('block');
  });

  it('marks bare `\\begin{aligned}...\\end{aligned}` as an env range', () => {
    const r = ranges(viewFor('preface\n\\begin{aligned}\na &= b\n\\end{aligned}\nbody'));
    expect(r.length).toBe(1);
    expect(r[0].classes).toContain('env');
  });

  it('handles two inline matches on the same line', () => {
    const r = ranges(viewFor('left $a$ middle $b$ right'));
    expect(r.length).toBe(2);
    expect(r[0].classes).toContain('inline');
    expect(r[1].classes).toContain('inline');
  });

  it('keeps the block range and skips the inline `$x$` it would otherwise contain', () => {
    const r = ranges(viewFor('$$a = $b$ + c$$'));
    expect(r.length).toBe(1);
    expect(r[0].classes).toContain('block');
  });

  it('produces no decoration for plain prose', () => {
    expect(ranges(viewFor('just words here'))).toHaveLength(0);
  });
});
