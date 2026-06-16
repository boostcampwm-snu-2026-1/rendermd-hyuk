/**
 * Canonicalize "compact" block math so remark-math actually recognizes it.
 *
 * Background:
 *   remark-math (micromark-extension-math) treats the opening `$$` as a
 *   fence whose remainder of the line is an info string, and expects the
 *   closing `$$` to sit on its own line (or after meta-only content).
 *
 *   That means this — a common shape in LLM output — parses incorrectly:
 *
 *       $$\begin{aligned}
 *       x &= 1 \\
 *       y &= 2
 *       \end{aligned}$$
 *
 *   `\begin{aligned}` is consumed as the info string, and
 *   `\end{aligned}$$` is not a valid closing fence, so the math value
 *   becomes `x &= 1 \\\ny &= 2\n\end{aligned}$$`. KaTeX then errors.
 *
 *   The canonical form remark-math wants:
 *
 *       $$
 *       \begin{aligned}
 *       x &= 1 \\
 *       y &= 2
 *       \end{aligned}
 *       $$
 *
 * This preprocessor walks the markdown source, skipping fenced code blocks
 * and inline-code spans, and rewrites compact `$$...$$` pairs (those that
 * span newlines or contain a `\begin{...}` / `\end{...}` environment) into
 * the canonical block form.
 *
 * What we DON'T touch:
 *   - `$$short$$` on one line with no environment — leave as inline display.
 *   - `$$...$$` inside fenced code blocks — that's literal content.
 *   - `$$...$$` inside inline `code` spans — same.
 */

import { splitCodeAndText } from './split-code-text';

export function canonicalizeBlockMath(src: string): string {
  return splitCodeAndText(src)
    .map((c) => (c.kind === 'code' ? c.value : transformTextChunk(c.value)))
    .join('\n');
}

function transformTextChunk(text: string): string {
  // Within a non-code region, also skip inline code spans (`...`) so we
  // never touch a literal $$ inside backticks.
  const parts: string[] = [];
  const inlineCodeRe = /`+[^`\n]*`+/g;
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = inlineCodeRe.exec(text))) {
    parts.push(rewriteMath(text.slice(lastEnd, m.index)));
    parts.push(m[0]);
    lastEnd = m.index + m[0].length;
  }
  parts.push(rewriteMath(text.slice(lastEnd)));
  return parts.join('');
}

// Non-greedy pair match of $$...$$ that can span newlines. Inner
// length is capped at 16384 to match editor-math-decoration's
// RE_BLOCK_DOLLAR — a single unclosed `$$` should not drag the engine
// across megabytes of pasted text.
const BLOCK_MATH_PAIR = /\$\$([\s\S]{1,16384}?)\$\$/g;
const HAS_ENV = /\\(?:begin|end)\{/;

function rewriteMath(segment: string): string {
  return segment.replace(BLOCK_MATH_PAIR, (full, inner: string, offset: number) => {
    const hasNewline = inner.includes('\n');
    const hasEnv = HAS_ENV.test(inner);

    // "Alone on its own line" — preceded by start-of-segment or `\n`
    // (allowing trailing spaces in between), and followed by `\n` or
    // end-of-segment. This is what the user intends when they paste
    // `$$ E = mc^2 $$` on a line by itself — remark-math otherwise
    // treats compact `$$x$$` as inline display, no `.katex-display`
    // gets emitted, and our math-align toggle has nothing to act on.
    //
    // We only normalize the alone-on-line case so legitimate inline
    // uses like `prefix text $$x$$ suffix text` stay unchanged.
    const beforeText = segment.slice(0, offset);
    const afterText = segment.slice(offset + full.length);
    const aloneOnLine = /(^|\n)[ \t]*$/.test(beforeText) && /^[ \t]*(\n|$)/.test(afterText);

    if (!hasNewline && !hasEnv && !aloneOnLine) {
      // Mid-line, single-line `$$x$$` — leave as-is. Treated as inline
      // display by remark-math (which is its own quirk, but not the
      // preprocessor's job).
      return full;
    }
    // Strip whitespace at the boundaries; remark-math is whitespace-strict
    // about the fence lines.
    const trimmed = inner.replace(/^\s+|\s+$/g, '');
    // Pad with blank lines so the math block is a separate root-level
    // element even if it was previously glued to an adjacent paragraph.
    return `\n\n$$\n${trimmed}\n$$\n\n`;
  });
}
