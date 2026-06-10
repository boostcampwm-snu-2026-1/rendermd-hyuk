import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toolbar } from '@/components/Toolbar';
import { EMPTY_ACTIVE, type ActiveMarks } from '@/lib/editor-active';
import type { EditorView } from '@codemirror/view';

// Mock the command module so click verification doesn't require a
// fully-formed EditorState. Command behaviour is covered separately in
// editor-commands.test.ts; here we only assert wiring.
vi.mock('@/lib/editor-commands', () => ({
  toggleBold: vi.fn(),
  toggleItalic: vi.fn(),
  toggleStrike: vi.fn(),
  toggleInlineCode: vi.fn(),
  toggleHeading: vi.fn(() => vi.fn()),
  toggleBulletList: vi.fn(),
  toggleOrderedList: vi.fn(),
  toggleTodo: vi.fn(),
  toggleQuote: vi.fn(),
}));

import { toggleBold, toggleHeading } from '@/lib/editor-commands';

function makeViewStub() {
  return {} as EditorView;
}

describe('<Toolbar />', () => {
  it('renders 11 grouped formatting buttons', () => {
    render(<Toolbar view={null} />);
    const buttons = screen.getAllByRole('button');
    // 4 inline + 3 headings + 3 list shapes + 1 quote = 11
    expect(buttons).toHaveLength(11);
  });

  it('all buttons are disabled until the EditorView ref is wired', () => {
    render(<Toolbar view={null} />);
    for (const btn of screen.getAllByRole('button')) {
      expect(btn).toBeDisabled();
    }
  });

  it('aria-pressed reflects active marks', () => {
    const active: ActiveMarks = { ...EMPTY_ACTIVE, bold: true, heading: 2 };
    render(<Toolbar view={makeViewStub()} active={active} />);
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Italic' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Heading 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Heading 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('clicking Bold invokes toggleBold with the EditorView', async () => {
    const user = userEvent.setup();
    const view = makeViewStub();
    render(<Toolbar view={view} />);
    await user.click(screen.getByRole('button', { name: 'Bold' }));
    expect(toggleBold).toHaveBeenCalledWith(view);
  });

  it('clicking Heading 2 invokes the heading factory with level 2', async () => {
    const user = userEvent.setup();
    render(<Toolbar view={makeViewStub()} />);
    await user.click(screen.getByRole('button', { name: 'Heading 2' }));
    expect(toggleHeading).toHaveBeenCalledWith(2);
  });

  it('has role=toolbar with an accessible name', () => {
    render(<Toolbar view={null} />);
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeInTheDocument();
  });

  it('carries data-print="hide" so it does not appear in PDF', () => {
    render(<Toolbar view={null} />);
    expect(screen.getByRole('toolbar')).toHaveAttribute('data-print', 'hide');
  });
});
