import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useState } from 'react';
import { Select } from '../design-system';
import { renderApp } from './render';

// OG-051: the open and low items of the OG-050 web register (ongem-engineering/outputs/review/og050-2026-11-17/web).

const root = join(__dirname, '..', '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

function Chooser() {
  const [v, setV] = useState('');
  return (
    <Select
      data-testid="pick"
      aria-label="Recipient"
      value={v}
      onChange={setV}
      options={[
        { value: '', label: 'Choose a recipient' },
        { value: 'a', label: 'Acme' },
      ]}
    />
  );
}

describe('OG-051 web register follow-up', () => {
  it('W_12_a_select_placeholder_is_muted_and_a_choice_is_not', () => {
    render(<Chooser />);
    const value = screen.getByTestId('pick').querySelector('.og-select__value')!;
    expect(value).toHaveClass('og-select__value--placeholder');
    expect(read('src/design-system/styles.css')).toMatch(
      /\.og-select__value--placeholder \{\s*color: var\(--color-text-muted\);/,
    );
  });

  it('W_13_post_and_legal_titles_step_from_32_to_44_px', () => {
    expect(read('src/public/public.css')).toMatch(
      /\.pub-display--page \{\s*font-size: clamp\(var\(--font-size-3xl\), 4vw, var\(--font-size-4xl\)\);/,
    );
  });

  it('W_15_the_demo_badge_is_info_not_pending', async () => {
    renderApp('/');
    const badge = await screen.findByTestId('env-badge');
    expect(badge).toHaveClass('og-env--mock');
    const rule = read('src/app-shell.css').match(/\.fw-shell \.og-env--mock \{[^}]*\}/)![0];
    expect(rule).toMatch(/--color-status-info-bg/);
    expect(rule).not.toMatch(/pending/);
  });

  it('W_16_the_language_choice_is_one_segmented_control', async () => {
    renderApp('/settings');
    const en = await screen.findByTestId('language-en');
    expect(en).toHaveClass('fw-lang__option');
    expect(en).not.toHaveClass('og-btn');
    expect(en).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('language-ar')).toHaveAttribute('aria-checked', 'false');
  });

  it('W_17_two_links_in_one_line_keep_a_gap', () => {
    expect(read('src/public/public.css')).toMatch(
      /p\.pub-more \{\s*flex-wrap: wrap;\s*column-gap: var\(--space-sm\);/,
    );
  });

  it('W_18_scheduled_and_top_up_amounts_carry_the_currency', async () => {
    renderApp('/payments/schedules');
    const amount = await screen.findByTestId('schedule-amount');
    expect(amount.closest('.fw-prefixed')).toHaveTextContent('US$');
  });

  it('RD_15_home_sections_have_no_eyebrow_repeating_the_heading', async () => {
    renderApp('/', { mode: 'none' });
    const row = await screen.findByTestId('feature-row-payments');
    expect(row.querySelector('.pub-eyebrow')).toBeNull();
  });
});
