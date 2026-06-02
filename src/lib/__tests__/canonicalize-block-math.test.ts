import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import type { Root } from 'mdast';
import { canonicalizeBlockMath } from '@/lib/canonicalize-block-math';

function parseToMath(md: string): { type: string; value?: string }[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processor = (unified as any)().use(remarkParse).use(remarkMath);
  const tree = processor.parse(md) as Root;
  // Walk the tree and collect math nodes (both block and inline).
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

describe('canonicalizeBlockMath', () => {
  it('reformats a compact $$\\begin{aligned}...\\end{aligned}$$ block', () => {
    const src = `text before
$$\\begin{aligned}
x &= 1 \\\\
y &= 2
\\end{aligned}$$
text after`;
    const out = canonicalizeBlockMath(src);
    // The canonical block must have $$ on its own line on both ends.
    expect(out).toMatch(/\n\$\$\n\\begin\{aligned\}/);
    expect(out).toMatch(/\\end\{aligned\}\n\$\$\n/);
    // And remark-math now picks it up as a math node with clean value.
    const math = parseToMath(out);
    expect(math).toHaveLength(1);
    expect(math[0].type).toBe('math');
    expect(math[0].value).toBe('\\begin{aligned}\nx &= 1 \\\\\ny &= 2\n\\end{aligned}');
  });

  it('reformats $$ that wraps multi-line content without an environment', () => {
    const src = `$$
a + b
= c
$$`;
    // Already canonical — must remain a valid math block.
    const out = canonicalizeBlockMath(src);
    const math = parseToMath(out);
    expect(math).toHaveLength(1);
    expect(math[0].value).toBe('a + b\n= c');
  });

  it('leaves single-line $$x$$ without an environment alone', () => {
    // This is "inline display" math; remark-math doesn't parse it as a
    // math node anyway, but we should not corrupt the source either.
    const src = `before $$E = mc^2$$ after`;
    expect(canonicalizeBlockMath(src)).toBe(src);
  });

  it('leaves inline $x$ math untouched', () => {
    const src = `inline $E = mc^2$ here`;
    expect(canonicalizeBlockMath(src)).toBe(src);
  });

  it('skips $$ inside fenced code blocks', () => {
    const src = `\`\`\`md
$$\\begin{aligned}
x &= 1
\\end{aligned}$$
\`\`\``;
    expect(canonicalizeBlockMath(src)).toBe(src);
  });

  it('skips $$ inside tilde-fenced code blocks', () => {
    const src = `~~~
$$\\begin{aligned}
x &= 1
\\end{aligned}$$
~~~`;
    expect(canonicalizeBlockMath(src)).toBe(src);
  });

  it('skips $$ inside inline code spans', () => {
    const src = `Try writing \`$$x^2$$\` for display math.`;
    expect(canonicalizeBlockMath(src)).toBe(src);
  });

  it('handles multiple math blocks in one document', () => {
    const src = `first
$$\\begin{aligned}a &= 1\\end{aligned}$$
middle
$$
b = 2
$$
last`;
    const out = canonicalizeBlockMath(src);
    const math = parseToMath(out);
    expect(math).toHaveLength(2);
    expect(math[0].value).toBe('\\begin{aligned}a &= 1\\end{aligned}');
    expect(math[1].value).toBe('b = 2');
  });

  it('does not merge two separate $$..$$ pairs', () => {
    // Non-greedy matching: $$ a $$ b $$ c $$ should pair (a) and (c),
    // not swallow b into one big block.
    const src = `$$a$$ b $$c$$`;
    // None of these contain a newline or env, so the source is unchanged.
    expect(canonicalizeBlockMath(src)).toBe(src);
  });
});
