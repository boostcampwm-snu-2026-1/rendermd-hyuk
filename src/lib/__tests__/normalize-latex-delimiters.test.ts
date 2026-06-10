import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import type { Root } from 'mdast';
import { normalizeLatexDelimiters } from '@/lib/normalize-latex-delimiters';
import { canonicalizeBlockMath } from '@/lib/canonicalize-block-math';

function parseToMath(md: string): { type: string; value?: string }[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processor = (unified as any)().use(remarkParse).use(remarkMath);
  const tree = processor.parse(md) as Root;
  const out: { type: string; value?: string }[] = [];
  function walk(node: { type: string; value?: string; children?: unknown[] }) {
    if (node.type === 'math' || node.type === 'inlineMath') {
      out.push({ type: node.type, value: node.value });
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child as { type: string; value?: string; children?: unknown[] });
      }
    }
  }
  walk(tree as unknown as { type: string; children?: unknown[] });
  return out;
}

describe('normalizeLatexDelimiters', () => {
  it('converts \\[ ... \\] block math to $$ ... $$', () => {
    const src = `before\n\\[\nE = mc^2\n\\]\nafter`;
    const out = normalizeLatexDelimiters(src);
    expect(out).toContain('$$');
    expect(out).not.toContain('\\[');
    const math = parseToMath(out);
    expect(math).toHaveLength(1);
    expect(math[0].type).toBe('math');
    expect(math[0].value).toBe('E = mc^2');
  });

  it('converts \\( ... \\) inline math to $ ... $', () => {
    const src = `text \\(E = mc^2\\) more`;
    const out = normalizeLatexDelimiters(src);
    expect(out).toBe('text $E = mc^2$ more');
    const math = parseToMath(out);
    expect(math).toHaveLength(1);
    expect(math[0].type).toBe('inlineMath');
    expect(math[0].value).toBe('E = mc^2');
  });

  it('handles compact \\[\\begin{aligned}...\\end{aligned}\\] when chained with canonicalize', () => {
    // This is the exact common LLM shape — bracket delimiters AND
    // compact fences. Each preprocessor on its own only handles half;
    // chained they cover both.
    const src = `\\[\\begin{aligned}\nx &= 1 \\\\\ny &= 2\n\\end{aligned}\\]`;
    const out = canonicalizeBlockMath(normalizeLatexDelimiters(src));
    const math = parseToMath(out);
    expect(math).toHaveLength(1);
    expect(math[0].type).toBe('math');
    expect(math[0].value).toBe('\\begin{aligned}\nx &= 1 \\\\\ny &= 2\n\\end{aligned}');
  });

  it('skips \\[ ... \\] inside fenced code blocks', () => {
    const src = `\`\`\`tex\n\\[\nE = mc^2\n\\]\n\`\`\``;
    expect(normalizeLatexDelimiters(src)).toBe(src);
  });

  it('skips \\( ... \\) inside inline code spans', () => {
    const src = `Try \`\\(x\\)\` for inline math.`;
    expect(normalizeLatexDelimiters(src)).toBe(src);
  });

  it('leaves escaped \\\\[ alone (not a delimiter)', () => {
    // `\\[` in markdown source is LaTeX for "literal [" — must not
    // become an opening $$. Sandwich a real delimiter on the same
    // line to make sure the negative lookbehind targets the right
    // character.
    const src = `not a delim: \\\\[ but this is: \\[ x \\]`;
    const out = normalizeLatexDelimiters(src);
    expect(out).toBe('not a delim: \\\\[ but this is: $$ x $$');
  });

  it('handles multiple bracket blocks in one document', () => {
    const src = `first\n\\[a = 1\\]\nbetween\n\\[b = 2\\]\nlast`;
    const out = normalizeLatexDelimiters(src);
    const math = parseToMath(out);
    expect(math).toHaveLength(2);
    expect(math[0].value).toBe('a = 1');
    expect(math[1].value).toBe('b = 2');
  });

  it('does not touch plain text without delimiters', () => {
    const src = `Just a normal paragraph with no math.`;
    expect(normalizeLatexDelimiters(src)).toBe(src);
  });
});
