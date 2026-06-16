/**
 * Read the CodeMirror syntax tree at the current cursor and report
 * which formatting marks are active. The toolbar uses this to highlight
 * the buttons that match the cursor's current formatting context, the
 * same affordance users expect from Notion / Typora / Google Docs.
 *
 * Inline marks (bold/italic/strike/inline-code) are read from the
 * markdown syntax tree shipped by `@codemirror/lang-markdown` — exact
 * because the parser already decides where each mark starts and ends.
 *
 * Block marks (heading level, list, todo, quote) are read by inspecting
 * the LINE TEXT for the start-of-line prefix. The syntax tree would
 * also expose these as nodes, but a regex on the line is simpler and
 * stays consistent with how applyBlockPrefix in editor-commands.ts
 * decides what to toggle.
 */

import type { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { ActiveMarks } from './editor-active-types';

// Structural subset of @lezer/common's SyntaxNode that covers the two
// surfaces we use (name, parent). Importing the real type would mean
// adding @lezer/common as a direct dep just for a type — the structural
// match here is enough for type safety and TypeScript will catch a name
// rename via the read sites in `getActiveMarks`.
interface SyntaxNodeShape {
  name: string;
  parent: SyntaxNodeShape | null;
}

export function getActiveMarks(state: EditorState): ActiveMarks {
  const pos = state.selection.main.head;
  const tree = syntaxTree(state);

  // Walk inline ancestors at the cursor. resolveInner finds the deepest
  // node containing pos; we climb its parent chain checking node names.
  let node: SyntaxNodeShape | null = tree.resolveInner(pos, -1);
  let bold = false;
  let italic = false;
  let strike = false;
  let inlineCode = false;
  while (node) {
    switch (node.name) {
      case 'StrongEmphasis':
        bold = true;
        break;
      case 'Emphasis':
        italic = true;
        break;
      case 'Strikethrough':
        strike = true;
        break;
      case 'InlineCode':
        inlineCode = true;
        break;
    }
    node = node.parent;
  }

  // Block prefixes — read line text at the cursor.
  const lineText = state.doc.lineAt(pos).text;
  const headingMatch = /^(#{1,3}) /.exec(lineText);
  const heading = headingMatch ? (headingMatch[1].length as 1 | 2 | 3) : null;
  const todo = /^- \[[ x]\] /.test(lineText);
  // Bullet detection must NOT fire on a todo line — todo is a more
  // specific shape that starts with `- `. matchesSelf in commands has
  // the same precedence rule.
  const bullet = !todo && /^- (?!\[[ x]\] )/.test(lineText);
  const ordered = /^\d+\. /.test(lineText);
  const quote = lineText.startsWith('> ');

  return { bold, italic, strike, inlineCode, heading, bullet, ordered, todo, quote };
}
