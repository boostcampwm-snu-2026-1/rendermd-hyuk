import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { remarkPageBreak } from '@/lib/remark-page-break';
import { canonicalizeBlockMath } from '@/lib/canonicalize-block-math';
import styles from './PreviewPane.module.css';

const REMARK_PLUGINS = [remarkGfm, remarkMath, remarkPageBreak];
const REHYPE_PLUGINS = [rehypeKatex, rehypeHighlight];

interface PreviewPaneProps {
  markdown: string;
}

export function PreviewPane({ markdown }: PreviewPaneProps) {
  // Canonicalize compact `$$...$$` blocks (e.g. `$$\begin{aligned}...$$`
  // glued onto the same line as the content). remark-math can't parse
  // that shape, and it's a common LLM-output mistake — see the
  // preprocessor doc-comment for details.
  const normalized = useMemo(() => canonicalizeBlockMath(markdown), [markdown]);
  return (
    <article className={styles.article}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
        {normalized}
      </ReactMarkdown>
    </article>
  );
}
