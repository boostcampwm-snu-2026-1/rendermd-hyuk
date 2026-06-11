/**
 * Split markdown source into a sequence of `code` / `text` chunks based
 * on CommonMark fenced-code-block boundaries.
 *
 * Used by the math-related preprocessors (`canonicalize-block-math`,
 * `normalize-latex-delimiters`) — both need to apply transformations to
 * text content while leaving fenced code blocks untouched. Sharing the
 * splitter here means a CommonMark conformance fix lands in one place
 * instead of two.
 *
 * Rules implemented:
 *   - A fence opens with up to 3 spaces of indent, then ≥3 backticks or
 *     ≥3 tildes (CommonMark §4.5).
 *   - A fence closes with the same char repeated at least the opening
 *     length, again up to 3 spaces of indent.
 *   - Lines that never reach a closer remain inside the code chunk
 *     (matching CommonMark — an unclosed fence runs to EOF).
 *
 * Out of scope:
 *   - Indented code blocks (4+ leading spaces). They're rare in
 *     LLM-pasted markdown and supporting them requires tracking
 *     blank-line context. Acceptable trade-off for now.
 *   - Inline `` ` `` spans — those have to be re-handled per
 *     transformation because their semantics depend on the consumer.
 */

const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})/;

export type CodeOrTextChunk = { kind: 'code' | 'text'; value: string };

export function splitCodeAndText(src: string): CodeOrTextChunk[] {
  const chunks: CodeOrTextChunk[] = [];
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
      const closeRe = new RegExp(`^ {0,3}${fenceChar}{${fenceMin},}\\s*$`);
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

  return chunks;
}
