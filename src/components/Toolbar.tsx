'use client';

import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  type LucideIcon,
} from 'lucide-react';
import type { EditorView } from '@codemirror/view';
import {
  toggleBold,
  toggleItalic,
  toggleStrike,
  toggleInlineCode,
  toggleHeading,
  toggleBulletList,
  toggleOrderedList,
  toggleTodo,
  toggleQuote,
} from '@/lib/editor-commands';
import type { ActiveMarks } from '@/lib/editor-active-types';
import { EMPTY_ACTIVE } from '@/lib/editor-active-types';
import styles from './Toolbar.module.css';

interface ToolbarProps {
  view: EditorView | null;
  active?: ActiveMarks;
}

interface ButtonSpec {
  key: string;
  icon: LucideIcon;
  label: string;
  shortcut: string;
  run: (view: EditorView) => boolean;
  isActive: (a: ActiveMarks) => boolean;
}

// Grouped left-to-right by mental category: inline marks, headings, list
// shapes, quote. Order within a group follows visual frequency.
const GROUPS: ButtonSpec[][] = [
  [
    {
      key: 'bold',
      icon: Bold,
      label: 'Bold',
      shortcut: 'Ctrl+B',
      run: toggleBold,
      isActive: (a) => a.bold,
    },
    {
      key: 'italic',
      icon: Italic,
      label: 'Italic',
      shortcut: 'Ctrl+I',
      run: toggleItalic,
      isActive: (a) => a.italic,
    },
    {
      key: 'strike',
      icon: Strikethrough,
      label: 'Strikethrough',
      shortcut: 'Ctrl+Shift+S',
      run: toggleStrike,
      isActive: (a) => a.strike,
    },
    {
      key: 'code',
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
      icon: Heading1,
      label: 'Heading 1',
      shortcut: 'Ctrl+Shift+1',
      run: toggleHeading(1),
      isActive: (a) => a.heading === 1,
    },
    {
      key: 'h2',
      icon: Heading2,
      label: 'Heading 2',
      shortcut: 'Ctrl+Shift+2',
      run: toggleHeading(2),
      isActive: (a) => a.heading === 2,
    },
    {
      key: 'h3',
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
      icon: List,
      label: 'Bullet list',
      shortcut: 'Ctrl+Shift+8',
      run: toggleBulletList,
      isActive: (a) => a.bullet,
    },
    {
      key: 'ordered',
      icon: ListOrdered,
      label: 'Numbered list',
      shortcut: 'Ctrl+Shift+7',
      run: toggleOrderedList,
      isActive: (a) => a.ordered,
    },
    {
      key: 'todo',
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
      icon: Quote,
      label: 'Quote',
      shortcut: 'Ctrl+Shift+.',
      run: toggleQuote,
      isActive: (a) => a.quote,
    },
  ],
];

export function Toolbar({ view, active = EMPTY_ACTIVE }: ToolbarProps) {
  const disabled = view == null;
  return (
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
            const isActive = b.isActive(active);
            const Icon = b.icon;
            return (
              <button
                key={b.key}
                type="button"
                className={styles.button}
                aria-label={b.label}
                aria-pressed={isActive}
                disabled={disabled}
                title={`${b.label} (${b.shortcut})`}
                onMouseDown={(e) => {
                  // Prevent the button from stealing focus from the editor —
                  // if the editor loses focus, view.dispatch still works but
                  // the user's caret blinks elsewhere, which feels broken.
                  e.preventDefault();
                }}
                onClick={() => {
                  if (view) b.run(view);
                }}
              >
                <Icon size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
