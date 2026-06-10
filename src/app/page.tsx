'use client';

import { useCallback, useDeferredValue, useState } from 'react';
import dynamic from 'next/dynamic';
import type { EditorView } from '@codemirror/view';
import type { InsertKind } from '@/components/InsertDialog';
import { ExportButton } from '@/components/ExportButton';
import { EditorPaneLoader } from '@/components/EditorPaneLoader';
import { Logo } from '@/components/Logo';
import { PreviewPaneLoader } from '@/components/PreviewPaneLoader';
import { SaveStatusIndicator } from '@/components/SaveStatus';
import { TabSwitcher, type Tab } from '@/components/TabSwitcher';
import { useTheme } from '@/contexts/ThemeContext';
import { useDraftStorage } from '@/hooks/useDraftStorage';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { type ActiveMarks, EMPTY_ACTIVE } from '@/lib/editor-active-types';
import styles from './page.module.css';

// CodeMirror is ~200 kB; defer behind dynamic import.
const EditorPane = dynamic(() => import('@/components/EditorPane').then((m) => m.EditorPane), {
  ssr: false,
  loading: () => <EditorPaneLoader />,
});

// react-markdown + remark-gfm + remark-math + rehype-katex + rehype-highlight
// totals ~200 kB. Defer it too.
const PreviewPane = dynamic(() => import('@/components/PreviewPane').then((m) => m.PreviewPane), {
  ssr: false,
  loading: () => <PreviewPaneLoader />,
});

// ThemeSwitcher uses <select value={theme}>. SSR bakes in 'light' (no
// document at build time), and React 19 hydration doesn't reconcile a
// controlled select's selected option from the SSR-baked `selected=""`
// attribute. Client-only render side-steps the whole class of issue.
const ThemeSwitcher = dynamic(
  () => import('@/components/ThemeSwitcher').then((m) => m.ThemeSwitcher),
  { ssr: false },
);

// Same reason as ThemeSwitcher (controlled <select>).
const MathAlignSwitcher = dynamic(
  () => import('@/components/MathAlignSwitcher').then((m) => m.MathAlignSwitcher),
  { ssr: false },
);

// Toolbar pulls 11 lucide-react icons (~25 kB) + the @codemirror/state
// runtime (~12 kB) via editor-commands. Lazy-loading keeps the / route's
// First Load JS within the perf budget — the toolbar isn't usable before
// EditorPane (also lazy) mounts anyway.
const Toolbar = dynamic(() => import('@/components/Toolbar').then((m) => m.Toolbar), {
  ssr: false,
});

const DEFAULT_VALUE = `# Welcome to rendermd

Paste an LLM response on the left and watch it render on the right.

## Features

- **Bold**, *italic*, and \`inline code\`
- Lists, tables, blockquotes
- GFM task lists:
  - [x] Done
  - [ ] Todo
- ~~Strikethrough~~ and other GFM
- Math via KaTeX: $E = mc^2$

\`\`\`ts
function greet(name: string) {
  return \`hello, \${name}\`;
}
\`\`\`

> Click **Export PDF** to print the preview. Your draft autosaves to this browser.
`;

export default function Home() {
  const { value, setValue, status, errorKind, retry, flush } = useDraftStorage(DEFAULT_VALUE);
  // Defer the preview's input — typing stays smooth at 60 fps even on a
  // 1 MB document because React only re-runs the markdown → react-markdown
  // → KaTeX pipeline on an idle tick. The editor side always renders
  // against the eager `value`.
  const deferredMarkdown = useDeferredValue(value);
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('edit');
  // EditorView ref + derived active-marks drive the formatting toolbar.
  // Both are null/empty until CodeMirror's onCreateEditor fires.
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [activeMarks, setActiveMarks] = useState<ActiveMarks>(EMPTY_ACTIVE);
  // One-shot dialog-open request, set by EditorPane's Mod-K shortcut
  // and consumed by Toolbar. Cleared on the next render.
  const [dialogRequest, setDialogRequest] = useState<InsertKind | null>(null);
  const isDark = theme === 'dark';

  useKeyboardShortcuts({ onSave: flush });

  const openLinkDialog = useCallback(() => setDialogRequest('link'), []);
  const consumeDialogRequest = useCallback(() => setDialogRequest(null), []);

  return (
    <div className={styles.app} data-app>
      <header className={styles.header} data-print="hide">
        <div className={styles.brand}>
          <Logo size={22} className={styles.logo} title={null} />
          <h1 className={styles.wordmark}>rendermd</h1>
          <span className={styles.tagline}>markdown · preview · pdf</span>
        </div>
        <div className={styles.toolbar}>
          <SaveStatusIndicator status={status} errorKind={errorKind} onRetry={retry} />
          <MathAlignSwitcher />
          <ThemeSwitcher />
          <ExportButton />
        </div>
      </header>
      <TabSwitcher active={activeTab} onChange={setActiveTab} />
      <main className={styles.layout} data-app-main>
        <section
          className={styles.editor}
          aria-label="Markdown editor"
          data-print="hide"
          data-tab-active={activeTab === 'edit'}
        >
          <Toolbar
            view={editorView}
            active={activeMarks}
            openRequest={dialogRequest}
            onConsumeOpenRequest={consumeDialogRequest}
          />
          <EditorPane
            value={value}
            onChange={setValue}
            dark={isDark}
            onCreateEditor={setEditorView}
            onActiveMarksChange={setActiveMarks}
            onInsertLinkRequest={openLinkDialog}
          />
        </section>
        <section
          className={styles.preview}
          aria-label="Preview"
          data-print="target"
          data-tab-active={activeTab === 'preview'}
        >
          <PreviewPane markdown={deferredMarkdown} />
        </section>
      </main>
    </div>
  );
}
