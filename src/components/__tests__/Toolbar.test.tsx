import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toolbar } from '@/components/Toolbar';
import { EMPTY_ACTIVE, type ActiveMarks } from '@/lib/editor-active-types';
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
  insertLink: vi.fn(),
}));

import { toggleBold, toggleHeading } from '@/lib/editor-commands';

function makeViewStub() {
  // Just enough surface for Toolbar's selectionText(view) helper —
  // commands are mocked above so we don't need a real dispatch path.
  return {
    state: {
      selection: { main: { from: 0, to: 0 } },
      doc: { sliceString: () => '' },
    },
  } as unknown as EditorView;
}

describe('<Toolbar />', () => {
  it('renders 12 grouped formatting buttons', () => {
    render(<Toolbar view={null} />);
    const buttons = screen.getAllByRole('button');
    // 4 inline + 3 headings + 3 list shapes + 1 quote + 1 link = 12
    expect(buttons).toHaveLength(12);
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

  describe('roving-tabindex a11y', () => {
    it('places only the first button in the tab order initially', () => {
      render(<Toolbar view={makeViewStub()} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toHaveAttribute('tabindex', '0');
      for (let i = 1; i < buttons.length; i++) {
        expect(buttons[i]).toHaveAttribute('tabindex', '-1');
      }
    });

    it('ArrowRight moves focus and tab order to the next button', async () => {
      const user = userEvent.setup();
      render(<Toolbar view={makeViewStub()} />);
      const buttons = screen.getAllByRole('button');
      buttons[0].focus();
      await user.keyboard('{ArrowRight}');
      expect(buttons[1]).toHaveFocus();
      expect(buttons[1]).toHaveAttribute('tabindex', '0');
      expect(buttons[0]).toHaveAttribute('tabindex', '-1');
    });

    it('End jumps to the last button', async () => {
      const user = userEvent.setup();
      render(<Toolbar view={makeViewStub()} />);
      const buttons = screen.getAllByRole('button');
      buttons[0].focus();
      await user.keyboard('{End}');
      expect(buttons[buttons.length - 1]).toHaveFocus();
    });
  });

  describe('external dialog open request', () => {
    it('openRequest="link" opens the link dialog and clears via onConsume', () => {
      const onConsume = vi.fn();
      render(<Toolbar view={makeViewStub()} openRequest="link" onConsumeOpenRequest={onConsume} />);
      expect(screen.getByRole('dialog', { name: /insert link/i })).toBeInTheDocument();
      expect(onConsume).toHaveBeenCalledTimes(1);
    });
  });
});
