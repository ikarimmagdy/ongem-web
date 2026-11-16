import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DatePicker } from './DatePicker';
import { Field } from './Field';

const LABELS = { choose: 'Choose a date', previousMonth: 'Previous month', nextMonth: 'Next month' };

function Picker({ initial = '', onPick }: { initial?: string; onPick?: (d: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <Field label="First payment">
      <DatePicker
        value={v}
        onChange={(d) => {
          setV(d);
          onPick?.(d);
        }}
        format={(d) => `day ${d}`}
        labels={LABELS}
        locale="en-GB"
        today="2026-11-17"
      />
    </Field>
  );
}

const focusedDay = () => (document.activeElement as HTMLElement).dataset.day;

describe('OG-050 DatePicker', () => {
  it('is a labelled button that names the chosen day or asks for one', () => {
    const { unmount } = render(<Picker />);
    expect(screen.getByRole('button', { name: 'First payment' })).toHaveTextContent('Choose a date');
    unmount();
    render(<Picker initial="2026-12-01" />);
    expect(screen.getByRole('button', { name: 'First payment' })).toHaveTextContent('day 2026-12-01');
  });

  it('opens on today, picks a day with the mouse and closes', async () => {
    const picked: string[] = [];
    render(<Picker onPick={(d) => picked.push(d)} />);
    await userEvent.click(screen.getByRole('button', { name: 'First payment' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('November 2026');
    expect(focusedDay()).toBe('2026-11-17');
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('December 2026');
    await userEvent.click(screen.getByRole('button', { name: /\b1 December 2026$/ }));
    expect(picked).toEqual(['2026-12-01']);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'First payment' })).toHaveFocus();
  });

  it('moves by day, week and month from the keyboard and chooses with Enter', async () => {
    const picked: string[] = [];
    render(<Picker initial="2026-01-31" onPick={(d) => picked.push(d)} />);
    await userEvent.click(screen.getByRole('button', { name: 'First payment' }));
    expect(focusedDay()).toBe('2026-01-31');
    await userEvent.keyboard('{PageDown}');
    expect(focusedDay()).toBe('2026-02-28');
    await userEvent.keyboard('{ArrowDown}');
    expect(focusedDay()).toBe('2026-03-07');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(focusedDay()).toBe('2026-03-05');
    await userEvent.keyboard('{Enter}');
    expect(picked).toEqual(['2026-03-05']);
  });

  it('mirrors the arrow keys right to left', async () => {
    document.documentElement.dir = 'rtl';
    try {
      render(<Picker initial="2026-03-05" />);
      await userEvent.click(screen.getByRole('button', { name: 'First payment' }));
      await userEvent.keyboard('{ArrowLeft}');
      expect(focusedDay()).toBe('2026-03-06');
    } finally {
      document.documentElement.dir = '';
    }
  });

  it('Escape closes without choosing and returns to the button', async () => {
    const picked: string[] = [];
    render(<Picker initial="2026-03-05" onPick={(d) => picked.push(d)} />);
    const button = screen.getByRole('button', { name: 'First payment' });
    await userEvent.click(button);
    await userEvent.keyboard('{ArrowRight}{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button).toHaveFocus();
    expect(picked).toEqual([]);
  });
});
