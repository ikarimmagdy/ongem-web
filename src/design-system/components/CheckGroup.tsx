import type { ReactNode } from 'react';

export interface CheckOption<T extends string> {
  value: T;
  label: string;
}

/** Checkboxes in a fieldset with a legend; `value` is the ticked options. */
export function CheckGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  hint,
}: {
  legend: ReactNode;
  options: CheckOption<T>[];
  value: T[];
  onChange(next: T[]): void;
  hint?: ReactNode;
}) {
  return (
    <fieldset className="og-fieldset">
      <legend>{legend}</legend>
      {hint && <p className="og-field__hint">{hint}</p>}
      {options.map((o) => (
        <label key={o.value} className="og-check">
          <input
            type="checkbox"
            checked={value.includes(o.value)}
            onChange={(e) =>
              onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))
            }
          />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
