import type { ComponentProps, ReactNode } from 'react';
import { errorText } from '../api/errors';
import type { Amount } from '../api/types';
import {
  Button,
  DatePicker,
  Input,
  Notice,
  Skeleton,
  type DatePickerProps,
  type Status,
} from '../design-system';
import { formatMinor } from '../lib/format';
import { dateLocale, has, t } from '../i18n';
import { IS_AE, REGION_CONFIG } from '../region';
import { formatDay, today } from '../lib/schedule';
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

/** OG-040: a compact filter above a list or table, one choice at a time (pressed buttons, so a screen reader hears it). */
export function FilterChips({
  label,
  options,
  value,
  onChange,
  testId,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange(id: string): void;
  testId: string;
}) {
  return (
    <div className="fw-filters" role="group" aria-label={label} data-testid={testId}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`fw-filter${o.id === value ? ' is-active' : ''}`}
          aria-pressed={o.id === value}
          data-testid={`${testId}-${o.id}`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** OG-050: a calendar day field (YYYY-MM-DD) on the design-system date picker, in the app's words and date style. */
export function DateInput(
  props: Omit<DatePickerProps, 'format' | 'labels' | 'locale' | 'weekStart' | 'today'>,
) {
  return (
    <DatePicker
      {...props}
      format={formatDay}
      labels={{
        choose: t('app.common.date.choose'),
        previousMonth: t('app.common.date.previous_month'),
        nextMonth: t('app.common.date.next_month'),
      }}
      locale={dateLocale()}
      weekStart={IS_AE ? 1 : 0}
      today={today()}
    />
  );
}

/** The amount field with the currency in front of it (FA-036), forwarding the field's id and aria to the input. */
export function PrefixedInput({ prefix, ...rest }: { prefix: string } & ComponentProps<typeof Input>) {
  return (
    <span className="fw-prefixed">
      <span className="fw-prefixed__prefix" aria-hidden="true">
        {prefix}
      </span>
      <Input {...rest} />
    </span>
  );
}

/** US$ or AED, as the amounts are written (from the money format, never typed in). */
export const currencyPrefix = () =>
  formatMinor({ amountMinor: 0, currency: REGION_CONFIG.currency })
    .replace(/[\d.,\s\u00a0]/g, '')
    .trim();
