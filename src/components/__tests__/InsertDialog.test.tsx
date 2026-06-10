import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InsertDialog } from '@/components/InsertDialog';

describe('<InsertDialog />', () => {
  it('renders Insert link title for kind=link', () => {
    render(<InsertDialog kind="link" onCancel={() => {}} onSubmit={() => {}} />);
    expect(screen.getByRole('dialog', { name: /insert link/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Link text')).toBeInTheDocument();
  });

  it('renders Insert image title and Alt-text label for kind=image', () => {
    render(<InsertDialog kind="image" onCancel={() => {}} onSubmit={() => {}} />);
    expect(screen.getByRole('dialog', { name: /insert image/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Alt text')).toBeInTheDocument();
  });

  it('pre-fills the text field with `initialText`', () => {
    render(
      <InsertDialog kind="link" initialText="rendermd" onCancel={() => {}} onSubmit={() => {}} />,
    );
    expect((screen.getByLabelText('Link text') as HTMLInputElement).value).toBe('rendermd');
  });

  it('Insert button submits URL + text to onSubmit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<InsertDialog kind="link" onCancel={() => {}} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText('URL'), 'https://example.com');
    await user.type(screen.getByLabelText('Link text'), 'site');
    await user.click(screen.getByRole('button', { name: 'Insert' }));
    expect(onSubmit).toHaveBeenCalledWith('https://example.com', 'site');
  });

  it('Cancel button fires onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<InsertDialog kind="link" onCancel={onCancel} onSubmit={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape key fires onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<InsertDialog kind="link" onCancel={onCancel} onSubmit={() => {}} />);
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('empty URL does not submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<InsertDialog kind="link" onCancel={() => {}} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Insert' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
