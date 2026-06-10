import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabSwitcher } from '@/components/TabSwitcher';

describe('<TabSwitcher />', () => {
  it('marks the active tab via aria-pressed', () => {
    render(<TabSwitcher active="preview" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Preview' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('fires onChange with the clicked tab', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TabSwitcher active="edit" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(onChange).toHaveBeenCalledWith('preview');
  });

  it('is hidden from print via data-print="hide"', () => {
    render(<TabSwitcher active="edit" onChange={() => {}} />);
    expect(screen.getByRole('navigation')).toHaveAttribute('data-print', 'hide');
  });
});
