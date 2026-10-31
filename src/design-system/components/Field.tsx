import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>;
}

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : children;
  return (
    <div className="og-field">
      <label className="og-field__label" htmlFor={id}>
        {label}
      </label>
      {control}
      {hint && (
        <p className="og-field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="og-field__error" id={errId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
