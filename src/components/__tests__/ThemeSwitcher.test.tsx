import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, THEME_STORAGE_KEY } from '@/contexts/ThemeContext';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

function renderWithProvider() {
  return render(
    <ThemeProvider>
      <ThemeSwitcher />
    </ThemeProvider>,
  );
}

describe('<ThemeSwitcher />', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('exposes all four themes as options', () => {
    renderWithProvider();
    const labels = Array.from(screen.getByRole('combobox').querySelectorAll('option')).map(
      (o) => o.textContent,
    );
    expect(labels).toEqual(['Light', 'Dark', 'Sepia', 'High contrast']);
  });

  it('selecting an option writes data-theme on <html> AND localStorage', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.selectOptions(screen.getByRole('combobox'), 'dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('starts from the theme already on <html data-theme> (FOUC-free init)', () => {
    document.documentElement.dataset.theme = 'sepia';
    renderWithProvider();
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('sepia');
  });
});
