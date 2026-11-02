import type { ReactNode } from 'react';
import { errorText } from '../api/errors';
import type { Amount } from '../api/types';
import { Button, Notice, Skeleton, type Status } from '../design-system';
import { formatMinor } from '../lib/format';
import type { AsyncState } from '../lib/useAsync';

/** Loading, error and success states for one read (every screen has them, the console's rule). */
export function Load<T>({
  state,
  label,
  children,
}: {
  state: AsyncState<T> & { reload(): void };
  label: string;
  children(data: T): ReactNode;
}) {
  if (state.status === 'loading') return <Skeleton label={`Loading ${label}`} />;
  if (state.status === 'error') {
    return (
      <Notice
        status="failure"
        action={
          <Button variant="secondary" onClick={state.reload}>
            Try again
          </Button>
        }
      >
        {errorText(state.error)}
      </Notice>
    );
  }
  return <>{children(state.data)}</>;
}

/** Money from minor units; masked in recordings at capture (data-mask, OG-031 R6). */
export function Amt({ value }: { value: Amount }) {
  return (
    <span className="og-money" data-mask="">
      {formatMinor(value)}
    </span>
  );
}

/** An account or card number's last four, masked in recordings. */
export function Last4({ value }: { value?: string | null }) {
  return value ? <span data-mask="">•••• {value}</span> : null;
}

export function stateStatus(state: string): Status {
  const s = state.toUpperCase();
  if (
    ['SETTLED', 'SENT', 'ACTIVE', 'OPEN', 'CLEAR', 'RESOLVED', 'APPROVED', 'CONFIRMED', 'ACCEPTED'].includes(
      s,
    )
  )
    return 'success';
  if (['RETURNED', 'FAILED', 'REFUSED', 'BLOCKED', 'CLOSED', 'REJECTED', 'CANCELLED'].includes(s))
    return 'failure';
  if (['FROZEN', 'SUSPENDED', 'ARCHIVED'].includes(s)) return 'neutral';
  return 'pending';
}

export const human = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
