import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { remarkPageBreak } from '@/lib/remark-page-break';
import { canonicalizeBlockMath } from '@/lib/canonicalize-block-math';
import { normalizeLatexDelimiters } from '@/lib/normalize-latex-delimiters';
import styles from './PreviewPane.module.css';

const REMARK_PLUGINS = [remarkGfm, remarkMath, remarkPageBreak];
const REHYPE_PLUGINS = [rehypeKatex, rehypeHighlight];

interface PreviewPaneProps {
  markdown: string;
}

export function PreviewPane({ markdown }: PreviewPaneProps) {
  // Two-stage normalization before remark-math sees the markdown:
  //   1. `\[ \]` / `\( \)` → `$$ $$` / `$ $`  — LaTeX-standard delims
  //      (what most LLMs emit). remark-math 6 ignores them otherwise.
  //   2. Compact `$$...$$` (multi-line content glued onto the fence
  //      lines) → canonical `\n$$\n...\n$$\n` form so remark-math
  //      treats it as a math block.
  // Order matters: bracket form might also be compact, so we run
  // delimiter translation first, then the fence rescue.
  const normalized = useMemo(
    () => canonicalizeBlockMath(normalizeLatexDelimiters(markdown)),
    [markdown],
  );
  return (
    <article className={styles.article}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
        {normalized}
      </ReactMarkdown>
    </article>
  );
}
