import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PreviewPane } from '@/components/PreviewPane';

describe('<PreviewPane />', () => {
  it('renders markdown headings and inline emphasis', () => {
    const { container } = render(<PreviewPane markdown={`# Title\n\nA **bold** word.`} />);
    const h1 = container.querySelector('h1');
    expect(h1?.textContent).toBe('Title');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
  });

  it('renders block math from $$ ... $$ via KaTeX', () => {
    const { container } = render(<PreviewPane markdown={`$$\nE = mc^2\n$$`} />);
    expect(container.querySelector('.katex-display')).not.toBeNull();
  });

  it('renders bracket-delimited block math \\[ ... \\] (preprocessor)', () => {
    const { container } = render(<PreviewPane markdown={`\\[\nE = mc^2\n\\]`} />);
    expect(container.querySelector('.katex-display')).not.toBeNull();
  });

  it('renders compact bracket+env via the chained preprocessors', () => {
    const src = `\\[\\begin{aligned}\nx &= 1 \\\\\ny &= 2\n\\end{aligned}\\]`;
    const { container } = render(<PreviewPane markdown={src} />);
    expect(container.querySelector('.katex-display')).not.toBeNull();
  });

  it('renders paren-delimited inline math \\( ... \\)', () => {
    const { container } = render(<PreviewPane markdown={`text \\(\\pi\\) more`} />);
    // Inline math is .katex without .katex-display wrapper.
    const inline = Array.from(container.querySelectorAll('.katex')).filter(
      (el) => !el.closest('.katex-display'),
    );
    expect(inline.length).toBeGreaterThan(0);
  });

  it('highlights fenced code via highlight.js classes', () => {
    const src = '```ts\nconst x: number = 1;\n```';
    const { container } = render(<PreviewPane markdown={src} />);
    expect(container.querySelector('pre code.hljs, pre code[class*="language-"]')).not.toBeNull();
  });

  it('emits the page-break div for the marker', () => {
    const { container } = render(
      <PreviewPane markdown={`before\n\n<!-- page-break -->\n\nafter`} />,
    );
    expect(container.querySelector('.rendermd-page-break')).not.toBeNull();
  });

  it('does NOT render $$ ... $$ inside fenced code blocks as math', () => {
    const src = '```md\n$$ E = mc^2 $$\n```';
    const { container } = render(<PreviewPane markdown={src} />);
    expect(container.querySelector('.katex-display')).toBeNull();
  });
});
