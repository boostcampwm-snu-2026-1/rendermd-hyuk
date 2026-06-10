/**
 * Translate LaTeX-standard math delimiters into the `$` / `$$` forms
 * that remark-math actually recognizes.
 *
 *   \[ ... \]   →   $$ ... $$   (display / block math)
 *   \( ... \)   →   $  ...  $   (inline math)
 *
 * Background:
 *   remark-math (v6) only matches dollar-sign delimiters. The LaTeX
 *   standard delimiters `\[ \]` and `\( \)` go straight through as
 *   plain text — every LLM that outputs them (the common form for
 *   ChatGPT, Claude, Gemini) ends up with a raw `\[...\]` block in
 *   the preview instead of rendered math.
 *
 *   Rather than swap to a different math plugin (changes parsing
 *   surface area, breaks existing `$$` users), we normalize the
 *   delimiter shape here before remark-math sees the source.
 *
 * Why this runs BEFORE canonicalize-block-math:
 *   After normalization, a compact `\[\begin{aligned}...\end{aligned}\]`
 *   becomes `$$\begin{aligned}...\end{aligned}$$`, which then needs
 *   the canonicalizer's "put $$ on its own line" rescue. Chaining the
 *   two preprocessors gives us full coverage of LLM-output shapes.
 *
 * What we DON'T touch:
 *   - `\[...\]` inside fenced code blocks — literal LaTeX in code.
 *   - `\[...\]` inside inline `code` spans — same.
 *   - Escaped `\\[` (preceded by a backslash). LaTeX uses `\\` for a
 *     literal backslash, so `\\[` is "backslash, then [" and not a
 *     delimiter.
 */

const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})/;

export function normalizeLatexDelimiters(src: string): string {
  // Split into code / non-code chunks (same approach as
  // canonicalize-block-math, kept duplicated rather than abstracted
  // because the two passes have different state needs).
  const chunks: { kind: 'code' | 'text'; value: string }[] = [];
  const lines = src.split('\n');
  let i = 0;
  let buf: string[] = [];

  while (i < lines.length) {
    const open = lines[i].match(FENCE_OPEN);
    if (open) {
      if (buf.length) {
        chunks.push({ kind: 'text', value: buf.join('\n') });
        buf = [];
      }
      const fenceChar = open[2][0];
      const fenceMin = open[2].length;
      const closeRe = new RegExp(`^ {0,3}${fenceChar === '`' ? '`' : '~'}{${fenceMin},}\\s*$`);
      const block: string[] = [lines[i]];
      i++;
      while (i < lines.length) {
        block.push(lines[i]);
        if (closeRe.test(lines[i])) {
          i++;
          break;
        }
        i++;
      }
      chunks.push({ kind: 'code', value: block.join('\n') });
      continue;
    }
    buf.push(lines[i]);
    i++;
  }
  if (buf.length) chunks.push({ kind: 'text', value: buf.join('\n') });

  return chunks.map((c) => (c.kind === 'code' ? c.value : transformTextChunk(c.value))).join('\n');
}

function transformTextChunk(text: string): string {
  const parts: string[] = [];
  const inlineCodeRe = /`+[^`\n]*`+/g;
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = inlineCodeRe.exec(text))) {
    parts.push(rewriteDelims(text.slice(lastEnd, m.index)));
    parts.push(m[0]);
    lastEnd = m.index + m[0].length;
  }
  parts.push(rewriteDelims(text.slice(lastEnd)));
  return parts.join('');
}

// `(?<!\\)` rejects an escaped backslash before the delimiter. `\\[`
// in source is LaTeX for "literal [" and should NOT become `$$`.
// Non-greedy `[\s\S]+?` so multiple bracket pairs in one chunk don't
// merge into one giant block.
const BRACKET_BLOCK = /(?<!\\)\\\[([\s\S]+?)(?<!\\)\\\]/g;
const PAREN_INLINE = /(?<!\\)\\\(([\s\S]+?)(?<!\\)\\\)/g;

function rewriteDelims(segment: string): string {
  return segment
    .replace(BRACKET_BLOCK, (_full, inner: string) => `$$${inner}$$`)
    .replace(PAREN_INLINE, (_full, inner: string) => `$${inner}$`);
}
