import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportButton } from '@/components/ExportButton';

// Mock the platform detector so each test can pick a branch deterministically.
vi.mock('@/util/platform', () => ({
  isIOSSafari: vi.fn(() => false),
}));

import { isIOSSafari } from '@/util/platform';

describe('<ExportButton />', () => {
  let printSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.mocked(isIOSSafari).mockReturnValue(false);
    printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
  });
  afterEach(() => {
    printSpy.mockRestore();
  });

  it('renders an accessible Export PDF button', () => {
    render(<ExportButton />);
    expect(screen.getByRole('button', { name: /export pdf/i })).toBeInTheDocument();
  });

  it('non-iOS: click calls window.print() immediately', async () => {
    const user = userEvent.setup();
    render(<ExportButton />);
    await user.click(screen.getByRole('button', { name: /export pdf/i }));
    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('iOS Safari: click opens the print-guide dialog instead of printing', async () => {
    vi.mocked(isIOSSafari).mockReturnValue(true);
    const user = userEvent.setup();
    render(<ExportButton />);
    await user.click(screen.getByRole('button', { name: /export pdf/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/saving as pdf on iphone/i)).toBeInTheDocument();
    expect(printSpy).not.toHaveBeenCalled();
  });

  it('iOS guide: Continue triggers print on the next tick', async () => {
    vi.mocked(isIOSSafari).mockReturnValue(true);
    const user = userEvent.setup();
    render(<ExportButton />);
    await user.click(screen.getByRole('button', { name: /export pdf/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    // triggerPrint uses setTimeout(window.print, 0) to let the modal unmount,
    // so wait for the queued microtask to flush.
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
  });
});
