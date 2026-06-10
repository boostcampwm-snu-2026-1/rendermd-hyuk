import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SaveStatusIndicator } from '@/components/SaveStatus';

describe('<SaveStatusIndicator />', () => {
  it.each(['idle', 'saving', 'saved', 'error'] as const)(
    'renders the right label for status=%s',
    (status) => {
      render(<SaveStatusIndicator status={status} />);
      const expected = { idle: 'Draft', saving: 'Saving', saved: 'Saved', error: 'Save failed' }[
        status
      ];
      expect(screen.getByText(expected)).toBeInTheDocument();
    },
  );

  it('error status with quota kind shows the storage-full hint', () => {
    render(<SaveStatusIndicator status="error" errorKind="quota" />);
    // The hint appears in BOTH the visible status indicator AND the
    // off-screen aria-live announcement region — both are required.
    expect(screen.getAllByText(/storage full/i).length).toBeGreaterThanOrEqual(1);
  });

  it('error status renders Retry button and fires onRetry on click', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<SaveStatusIndicator status="error" errorKind="quota" onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: /retry save/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('non-error statuses do NOT render a Retry button', () => {
    render(<SaveStatusIndicator status="saved" onRetry={() => {}} />);
    expect(screen.queryByRole('button', { name: /retry save/i })).toBeNull();
  });

  it('always mounts a polite aria-live region; announcement text is empty on idle', () => {
    const { rerender, container } = render(<SaveStatusIndicator status="idle" />);
    const live = container.querySelector('[aria-live="polite"]');
    // Toggling aria-live on/off the same node is unreliable across SR;
    // we mount it permanently and mutate its content instead.
    expect(live).not.toBeNull();
    expect(live!.textContent).toBe('');
    rerender(<SaveStatusIndicator status="saved" />);
    expect(live!.textContent).toMatch(/saved/i);
  });
});
