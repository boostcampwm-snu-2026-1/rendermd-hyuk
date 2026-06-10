/**
 * Type-only side of editor-active. Lives in its own module so consumers
 * that just need the shape (page.tsx, Toolbar) don't drag the runtime
 * dep on `@codemirror/language` (syntaxTree, ~60 kB) into the main
 * route chunk. The real `getActiveMarks` reader lives in editor-active.ts
 * and is only imported from inside the lazy-loaded EditorPane chunk.
 */

export interface ActiveMarks {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  inlineCode: boolean;
  heading: 1 | 2 | 3 | null;
  bullet: boolean;
  ordered: boolean;
  todo: boolean;
  quote: boolean;
}

export const EMPTY_ACTIVE: ActiveMarks = {
  bold: false,
  italic: false,
  strike: false,
  inlineCode: false,
  heading: null,
  bullet: false,
  ordered: false,
  todo: false,
  quote: false,
};
