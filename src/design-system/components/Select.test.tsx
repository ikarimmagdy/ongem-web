import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';
import { Modal } from './Modal';
import { Select } from './Select';

const OPTIONS = [
  { value: 'ach', label: 'ACH' },
  { value: 'wire', label: 'Wire' },
  { value: 'book', label: 'Book transfer' },
  { value: 'check', label: 'Check' },
];

function Picker({ initial = 'ach', onPick }: { initial?: string; onPick?: (v: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <Field label="Method">
      <Select
        data-testid="method"
        options={OPTIONS}
        value={v}
        onChange={(x) => {
          setV(x);
          onPick?.(x);
        }}
      />
    </Field>
  );
}

describe('OG-050 Select', () => {
  it('is a labelled combobox showing the chosen option, closed at first', () => {
    render(<Picker initial="wire" />);
    const box = screen.getByRole('combobox', { name: 'Method' });
    expect(box).toHaveTextContent('Wire');
    expect(box).toHaveAttribute('aria-expanded', 'false');
    expect(box).toHaveAttribute('aria-haspopup', 'listbox');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('opens on click, marks the chosen option and picks with the mouse', async () => {
    const picked: string[] = [];
    render(<Picker onPick={(v) => picked.push(v)} />);
    const box = screen.getByRole('combobox');
    await userEvent.click(box);
    expect(box).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(4);
    expect(screen.getByRole('option', { name: 'ACH' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('option', { name: 'Check' }));
    expect(picked).toEqual(['check']);
    expect(box).toHaveTextContent('Check');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box).toHaveFocus();
  });

  it('works from the keyboard: arrows, Home, End, Enter, Escape and typing', async () => {
    const picked: string[] = [];
    render(<Picker onPick={(v) => picked.push(v)} />);
    const box = screen.getByRole('combobox');
    box.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(box).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'ACH' }).id);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(picked).toEqual(['book']);
    await userEvent.keyboard('{End}');
    expect(box).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Check' }).id);
    await userEvent.keyboard('{Home}');
    expect(box).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'ACH' }).id);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(picked).toEqual(['book']);
    await userEvent.keyboard('w');
    expect(box).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Wire' }).id);
    await userEvent.keyboard(' ');
    expect(picked).toEqual(['book', 'wire']);
  });

  it('closes on a press outside without choosing', async () => {
    const picked: string[] = [];
    render(
      <>
        <Picker onPick={(v) => picked.push(v)} />
        <p>Outside</p>
      </>,
    );
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByText('Outside'));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(picked).toEqual([]);
  });

  it('Escape inside a dialog closes the list, not the dialog', async () => {
    let closed = 0;
    render(
      <Modal open title="Send" onClose={() => closed++}>
        <Picker />
      </Modal>,
    );
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(closed).toBe(0);
    await userEvent.keyboard('{Escape}');
    expect(closed).toBe(1);
  });

  it('does not open when disabled', async () => {
    render(<Select aria-label="Method" options={OPTIONS} value="ach" onChange={() => undefined} disabled />);
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
