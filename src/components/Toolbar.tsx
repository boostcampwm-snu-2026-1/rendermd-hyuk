'use client';

import { useState } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  type LucideIcon,
} from 'lucide-react';
import type { EditorView } from '@codemirror/view';
import {
  insertImage,
  insertLink,
  toggleBold,
  toggleBulletList,
  toggleHeading,
  toggleInlineCode,
  toggleItalic,
  toggleOrderedList,
  toggleQuote,
  toggleStrike,
  toggleTodo,
} from '@/lib/editor-commands';
import type { ActiveMarks } from '@/lib/editor-active-types';
import { EMPTY_ACTIVE } from '@/lib/editor-active-types';
import { InsertDialog, type InsertKind } from './InsertDialog';
import styles from './Toolbar.module.css';

interface ToolbarProps {
  view: EditorView | null;
  active?: ActiveMarks;
}

type ToggleButtonSpec = {
  key: string;
  kind: 'toggle';
  icon: LucideIcon;
  label: string;
  shortcut: string;
  run: (view: EditorView) => boolean;
  isActive: (a: ActiveMarks) => boolean;
};

type DialogButtonSpec = {
  key: string;
  kind: 'dialog';
  icon: LucideIcon;
  label: string;
  shortcut: string;
  open: InsertKind;
};

type ButtonSpec = ToggleButtonSpec | DialogButtonSpec;

// Grouped left-to-right by mental category: inline marks, headings,
// lists, quote, insert. Order within a group follows visual frequency.
const GROUPS: ButtonSpec[][] = [
  [
    {
      key: 'bold',
      kind: 'toggle',
      icon: Bold,
      label: 'Bold',
      shortcut: 'Ctrl+B',
      run: toggleBold,
      isActive: (a) => a.bold,
    },
    {
      key: 'italic',
      kind: 'toggle',
      icon: Italic,
      label: 'Italic',
      shortcut: 'Ctrl+I',
      run: toggleItalic,
      isActive: (a) => a.italic,
    },
    {
      key: 'strike',
      kind: 'toggle',
      icon: Strikethrough,
      label: 'Strikethrough',
      shortcut: 'Ctrl+Shift+S',
      run: toggleStrike,
      isActive: (a) => a.strike,
    },
    {
      key: 'code',
      kind: 'toggle',
      icon: Code,
      label: 'Inline code',
      shortcut: 'Ctrl+E',
      run: toggleInlineCode,
      isActive: (a) => a.inlineCode,
    },
  ],
  [
    {
      key: 'h1',
      kind: 'toggle',
      icon: Heading1,
      label: 'Heading 1',
      shortcut: 'Ctrl+Shift+1',
      run: toggleHeading(1),
      isActive: (a) => a.heading === 1,
    },
    {
      key: 'h2',
      kind: 'toggle',
      icon: Heading2,
      label: 'Heading 2',
      shortcut: 'Ctrl+Shift+2',
      run: toggleHeading(2),
      isActive: (a) => a.heading === 2,
    },
    {
      key: 'h3',
      kind: 'toggle',
      icon: Heading3,
      label: 'Heading 3',
      shortcut: 'Ctrl+Shift+3',
      run: toggleHeading(3),
      isActive: (a) => a.heading === 3,
    },
  ],
  [
    {
      key: 'bullet',
      kind: 'toggle',
      icon: List,
      label: 'Bullet list',
      shortcut: 'Ctrl+Shift+8',
      run: toggleBulletList,
      isActive: (a) => a.bullet,
    },
    {
      key: 'ordered',
      kind: 'toggle',
      icon: ListOrdered,
      label: 'Numbered list',
      shortcut: 'Ctrl+Shift+7',
      run: toggleOrderedList,
      isActive: (a) => a.ordered,
    },
    {
      key: 'todo',
      kind: 'toggle',
      icon: ListTodo,
      label: 'To-do',
      shortcut: 'Ctrl+Shift+T',
      run: toggleTodo,
      isActive: (a) => a.todo,
    },
  ],
  [
    {
      key: 'quote',
      kind: 'toggle',
      icon: Quote,
      label: 'Quote',
      shortcut: 'Ctrl+Shift+.',
      run: toggleQuote,
      isActive: (a) => a.quote,
    },
  ],
  [
    {
      key: 'link',
      kind: 'dialog',
      icon: LinkIcon,
      label: 'Insert link',
      shortcut: 'Ctrl+K',
      open: 'link',
    },
    {
      key: 'image',
      kind: 'dialog',
      icon: ImageIcon,
      label: 'Insert image',
      shortcut: 'Ctrl+Shift+I',
      open: 'image',
    },
  ],
];

function selectionText(view: EditorView | null): string {
  if (view == null) return '';
  const { state } = view;
  const range = state.selection.main;
  return state.doc.sliceString(range.from, range.to);
}

export function Toolbar({ view, active = EMPTY_ACTIVE }: ToolbarProps) {
  const disabled = view == null;
  const [openDialog, setOpenDialog] = useState<InsertKind | null>(null);
  const [initialText, setInitialText] = useState('');

  const handleDialogSubmit = (url: string, text: string) => {
    if (view != null) {
      if (openDialog === 'link') insertLink(view, url, text);
      else if (openDialog === 'image') insertImage(view, url, text);
    }
    setOpenDialog(null);
  };

  return (
    <>
      <div
        className={styles.toolbar}
        role="toolbar"
        aria-label="Formatting"
        aria-disabled={disabled || undefined}
        data-print="hide"
      >
        {GROUPS.map((group, groupIndex) => (
          <div key={groupIndex} className={styles.group} role="group">
            {group.map((b) => {
              const isActive = b.kind === 'toggle' ? b.isActive(active) : false;
              const Icon = b.icon;
              return (
                <button
                  key={b.key}
                  type="button"
                  className={styles.button}
                  aria-label={b.label}
                  aria-pressed={b.kind === 'toggle' ? isActive : undefined}
                  disabled={disabled}
                  title={`${b.label} (${b.shortcut})`}
                  onMouseDown={(e) => {
                    // Prevent the button from stealing focus from the editor —
                    // if the editor loses focus, view.dispatch still works but
                    // the user's caret blinks elsewhere, which feels broken.
                    e.preventDefault();
                  }}
                  onClick={() => {
                    if (view == null) return;
                    if (b.kind === 'toggle') {
                      b.run(view);
                    } else {
                      setInitialText(selectionText(view));
                      setOpenDialog(b.open);
                    }
                  }}
                >
                  <Icon size={16} strokeWidth={2} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {openDialog != null && (
        <InsertDialog
          kind={openDialog}
          initialText={initialText}
          onCancel={() => setOpenDialog(null)}
          onSubmit={handleDialogSubmit}
        />
      )}
    </>
  );
}
