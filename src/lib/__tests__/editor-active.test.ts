import { describe, it, expect } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { getActiveMarks } from '@/lib/editor-active';

function stateAt(doc: string, cursor: number) {
  return EditorState.create({
    doc,
    selection: EditorSelection.cursor(cursor),
    extensions: [markdown()],
  });
}

describe('getActiveMarks', () => {
  it('reports bold inside **text**', () => {
    const s = stateAt('**hello** world', 4);
    expect(getActiveMarks(s).bold).toBe(true);
  });

  it('reports italic inside _text_', () => {
    const s = stateAt('_italic_ word', 3);
    expect(getActiveMarks(s).italic).toBe(true);
  });

  it('reports inlineCode inside `code`', () => {
    const s = stateAt('use `code` here', 6);
    expect(getActiveMarks(s).inlineCode).toBe(true);
  });

  it('returns heading=1 on an H1 line', () => {
    const s = stateAt('# Title', 3);
    expect(getActiveMarks(s).heading).toBe(1);
  });

  it('returns heading=2 on an H2 line', () => {
    const s = stateAt('## sub', 4);
    expect(getActiveMarks(s).heading).toBe(2);
  });

  it('returns heading=null on a plain line', () => {
    const s = stateAt('plain text', 3);
    expect(getActiveMarks(s).heading).toBe(null);
  });

  it('reports bullet on a `- ` line', () => {
    const s = stateAt('- item', 3);
    expect(getActiveMarks(s).bullet).toBe(true);
  });

  it('does NOT report bullet on a todo line', () => {
    const m = getActiveMarks(stateAt('- [ ] task', 6));
    expect(m.bullet).toBe(false);
    expect(m.todo).toBe(true);
  });

  it('reports ordered on `1. ` line', () => {
    expect(getActiveMarks(stateAt('1. one', 3)).ordered).toBe(true);
  });

  it('reports quote on `> ` line', () => {
    expect(getActiveMarks(stateAt('> cite', 3)).quote).toBe(true);
  });

  it('returns all-empty marks on plain text with cursor at 0', () => {
    const m = getActiveMarks(stateAt('plain', 0));
    expect(m.bold).toBe(false);
    expect(m.italic).toBe(false);
    expect(m.inlineCode).toBe(false);
    expect(m.heading).toBe(null);
    expect(m.bullet).toBe(false);
    expect(m.todo).toBe(false);
    expect(m.quote).toBe(false);
  });
});
