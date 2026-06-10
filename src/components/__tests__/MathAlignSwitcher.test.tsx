import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MathAlignProvider, MATH_ALIGN_STORAGE_KEY } from '@/contexts/MathAlignContext';
import { MathAlignSwitcher } from '@/components/MathAlignSwitcher';

function renderWithProvider() {
  return render(
    <MathAlignProvider>
      <MathAlignSwitcher />
    </MathAlignProvider>,
  );
}

describe('<MathAlignSwitcher />', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-math-align');
  });

  it('exposes Center and Left options', () => {
    renderWithProvider();
    const labels = Array.from(screen.getByRole('combobox').querySelectorAll('option')).map(
      (o) => o.textContent,
    );
    expect(labels).toEqual(['Center', 'Left']);
  });

  it('selecting Left writes data-math-align on <html> AND localStorage', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.selectOptions(screen.getByRole('combobox'), 'left');
    expect(document.documentElement.dataset.mathAlign).toBe('left');
    expect(localStorage.getItem(MATH_ALIGN_STORAGE_KEY)).toBe('left');
  });

  it('starts from the value already on <html data-math-align> (FOUC-free init)', () => {
    document.documentElement.dataset.mathAlign = 'left';
    renderWithProvider();
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('left');
  });
});
