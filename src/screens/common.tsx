import type { ReactNode } from 'react';
import { errorText } from '../api/errors';
import type { Amount } from '../api/types';
import { Button, Notice, Skeleton, type Status } from '../design-system';
import { formatMinor } from '../lib/format';
import { has, t } from '../i18n';
import { REGION_CONFIG } from '../region';
import type { AsyncState } from '../lib/useAsync';

/** Loading, error and success states for one read (every screen has them, the console's rule). */
export function Load<T>({
  state,
  label,
  children,
}: {
  state: AsyncState<T> & { reload(): void };
  /** What is loading, such as `accounts`: the skeleton reads `app.common.loading.<label>`. */
  label: string;
  children(data: T): ReactNode;
}) {
  if (state.status === 'loading') {
    const k = `app.common.loading.${label.replace(/ /g, '_')}`;
    return <Skeleton label={has(k) ? t(k) : t('app.common.loading.other', { what: label })} />;
  }
  if (state.status === 'error') {
    return (
      <Notice
        status="failure"
        action={
          <Button variant="secondary" onClick={state.reload}>
            {t('app.common.try_again')}
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

/** A bank account's last four (an IBAN's in the AE build, OG-022 R18), masked in recordings. */
export function AcctLast4({ value }: { value?: string | null }) {
  return value ? <span data-mask="">{REGION_CONFIG.accountMask(value)}</span> : null;
}

/**
 * One tone per state across the app (FA-007, Brand V2): blue while money is on its way (sending, sent, the bank
 * reviewing), green when it is done (settled, active), amber when it waits for someone (approval, a step to finish), red
 * when it failed or came back, slate when it is paused (frozen).
 */
const PROCESSING = [
  'SUBMITTED',
  'SENT',
  'SENDING',
  'PRECHECKED',
  'BANK_REVIEW',
  'PROCESSING',
  'QUEUED',
  'RUNNING',
];

export function stateStatus(state: string): Status {
  const s = state.toUpperCase();
  if (PROCESSING.includes(s)) return 'info';
  if (
    ['SETTLED', 'ACTIVE', 'OPEN', 'CLEAR', 'RESOLVED', 'APPROVED', 'CONFIRMED', 'ACCEPTED', 'DONE'].includes(
      s,
    )
  )
    return 'success';
  if (['RETURNED', 'FAILED', 'REFUSED', 'BLOCKED', 'CLOSED', 'REJECTED', 'CANCELLED'].includes(s))
    return 'failure';
  if (['FROZEN', 'SUSPENDED', 'ARCHIVED', 'PAUSED'].includes(s)) return 'neutral';
  return 'pending';
}

/** An API word (a role, a status, a category) in the reader's language: `app.state.word.<word>`, else as written. */
export const human = (s: string) => {
  const k = `app.state.word.${s.toLowerCase()}`;
  return has(k) ? t(k) : s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
};
