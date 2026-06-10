/**
 * Editor-side syntax highlighting for math ranges.
 *
 * CodeMirror's markdown parser doesn't know about LaTeX — `$...$`,
 * `$$...$$`, `\(...\)`, and `\[...\]` all pass through as plain text,
 * even though our remark-math + preprocessor pipeline DOES render
 * them. From the user's POV the editor stops giving feedback at
 * exactly the spots they're most likely to want it (math is dense
 * to type and easy to miscount).
 *
 * Rather than write a full lezer-markdown extension (which would also
 * carry a syntax-tree representation we don't need), this plugin scans
 * the visible viewport with a small set of regexes and emits
 * Decoration marks. Cheap, scoped, and easy to extend.
 *
 * Patterns recognized:
 *   - $ ... $        inline (single line)
 *   - $$ ... $$      block (multi-line, paired non-greedy)
 *   - \( ... \)      inline (LaTeX standard)
 *   - \[ ... \]      block (LaTeX standard)
 *   - bare `\begin{aligned}...\end{aligned}` segments — light fallback
 *     when the user typed them without delimiters yet
 *
 * Patterns NOT recognized in the editor (yet):
 *   - $-signs inside fenced code blocks (the parser doesn't know about
 *     code fences in this scan; ranges inside a fence still get
 *     highlighted as math source). Acceptable for now — the preview
 *     pipeline correctly skips them.
 */

import { Decoration, type DecorationSet, EditorView, type ViewUpdate } from '@codemirror/view';
import { ViewPlugin } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

const INLINE_MATH = Decoration.mark({ class: 'cm-math cm-math-inline' });
const BLOCK_MATH = Decoration.mark({ class: 'cm-math cm-math-block' });
const ENV_MATH = Decoration.mark({ class: 'cm-math cm-math-env' });

/**
 * Single-line `$ ... $` — no whitespace immediately after `$open` or
 * before `$close`, no surrounding `$` (to avoid matching half of `$$`).
 * The capture is intentionally simple; complex Cases are rare in this
 * highlighter's scope (we don't need parse-tree perfection).
 */
const RE_INLINE_DOLLAR = /(?<!\$)\$(?!\$)(?!\s)([^$\n]+?)(?<!\s)\$(?!\$)/g;

/** `\( ... \)` inline. Backslash-pair, content can't span lines. */
const RE_INLINE_PAREN = /\\\(([^\n]+?)\\\)/g;

/** `$$ ... $$` block. Multi-line allowed; non-greedy on the inner. */
const RE_BLOCK_DOLLAR = /\$\$([\s\S]+?)\$\$/g;

/** `\[ ... \]` block. Multi-line allowed. */
const RE_BLOCK_BRACKET = /\\\[([\s\S]+?)\\\]/g;

/**
 * Bare `\begin{env}...\end{env}` outside any delimiters. The preview
 * preprocessor normalizes these to `$$...$$` on the fly, so a user
 * sometimes ends up with an env-only line they want feedback on.
 */
const RE_ENV_BARE = /\\begin\{([a-z*]+)\}([\s\S]+?)\\end\{\1\}/g;

interface Hit {
  from: number;
  to: number;
  deco: Decoration;
}

function build(view: EditorView): DecorationSet {
  const hits: Hit[] = [];
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    const push = (re: RegExp, deco: Decoration) => {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        hits.push({ from: from + m.index, to: from + m.index + m[0].length, deco });
      }
    };
    push(RE_BLOCK_DOLLAR, BLOCK_MATH);
    push(RE_BLOCK_BRACKET, BLOCK_MATH);
    push(RE_INLINE_DOLLAR, INLINE_MATH);
    push(RE_INLINE_PAREN, INLINE_MATH);
    push(RE_ENV_BARE, ENV_MATH);
  }
  hits.sort((a, b) => a.from - b.from || a.to - b.to);

  // Drop any overlap — keep the first hit when ranges intersect. This
  // matters because RE_BLOCK_DOLLAR's match contains $...$ pairs that
  // RE_INLINE_DOLLAR would also try to mark, and RangeSetBuilder
  // requires non-overlapping ranges sorted by start.
  const filtered: Hit[] = [];
  let lastTo = -1;
  for (const h of hits) {
    if (h.from >= lastTo) {
      filtered.push(h);
      lastTo = h.to;
    }
  }

  const builder = new RangeSetBuilder<Decoration>();
  for (const h of filtered) builder.add(h.from, h.to, h.deco);
  return builder.finish();
}

export const mathDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = build(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

// Exposed for unit tests — they construct a headless EditorView and
// assert the decoration ranges build correctly.
export const _buildForTest = build;
