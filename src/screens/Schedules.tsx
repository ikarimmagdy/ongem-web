import { useRef, useState } from 'react';
import { Permission } from '../api/client';
import { errorText } from '../api/errors';
import type { Account, PaymentSchedule, Recipient } from '../api/types';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Notice,
  Select,
  StatusChip,
  type Status,
} from '../design-system';
import { decimalToMinor, formatMinor } from '../lib/format';
import { T, has, t } from '../i18n';
import { formatDay, frequencyText, today } from '../lib/schedule';
import { useAsync } from '../lib/useAsync';
import { REGION_CONFIG } from '../region';
import { useSession } from '../session';
import { Amt, Load } from './common';

/** A schedule's state in words, the same as the app's (G-120). */
export function scheduleState(state: string): { status: Status; text: string } {
  switch (state.toUpperCase()) {
    case 'ACTIVE':
      return { status: 'success', text: t('app.schedules.state.active') };
    case 'PAUSED':
      return { status: 'neutral', text: t('app.schedules.state.paused') };
    case 'CANCELLED':
      return { status: 'failure', text: t('app.schedules.state.cancelled') };
    default:
      return { status: 'neutral', text: t('app.schedules.state.finished') };
  }
}

/** When the next payment goes, in words. */
export function nextRunText(s: PaymentSchedule): string {
  if (s.state === 'PAUSED') return t('app.schedules.next.paused');
  if (s.state === 'ACTIVE' && s.nextRunOn)
    return t('app.schedules.next.on', { date: formatDay(s.nextRunOn) });
  return t('app.schedules.next.none');
}

/** A run's state in words; a state the web does not know shows as the API sends it. */
const runText = (state: string) => {
  const key = `app.schedules.run.${state.toLowerCase()}`;
  return has(key) ? t(key) : state;
};

function useOnce() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const run = async (f: () => Promise<void>) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await f();
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/** A schedule's latest runs, read when opened. */
function Runs({ id }: { id: string }) {
  const { api } = useSession();
  const detail = useAsync(() => api.schedule(id), [api, id]);
  return (
    <Load state={detail} label={t('app.schedules.loading.runs')}>
      {(s) =>
        s.runs.length ? (
          <ul className="fw-list" data-testid={`schedule-runs-${id}`}>
            {s.runs.map((r) => (
              <li key={r.id} className="fw-row">
                <span>{formatDay(r.runOn)}</span>
                <span>
                  {runText(r.state)}
                  {r.failureCode ? ` (${r.failureCode})` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p data-testid={`schedule-runs-${id}`}>{t('app.schedules.runs.none')}</p>
        )
      }
    </Load>
  );
}

function ScheduleRow({
  s,
  accounts,
  recipients,
  onChanged,
}: {
  s: PaymentSchedule;
  accounts: Account[];
  recipients: Recipient[];
  onChanged(): void;
}) {
  const { api, can } = useSession();
  const { busy, error, run } = useOnce();
  const [open, setOpen] = useState(false);
  const st = scheduleState(s.state);
  const from = accounts.find((a) => a.id === s.fromAccountId);
  const act = (f: () => Promise<unknown>) =>
    void run(async () => {
      await f();
    }).then((ok) => ok && onChanged());
  const manage = can(Permission.PAYMENT_CREATE);
  return (
    <li className="fw-row" data-testid={`schedule-${s.id}`}>
      <span className="fw-row__main">
        <strong>
          {recipients.find((r) => r.id === s.recipientId)?.name ?? t('app.schedules.recipient')}
        </strong>
        <span className="fw-row__sub">
          <Amt value={s.amount} /> · {frequencyText(s.frequency, s.interval)}
          {from ? ` · ${t('app.schedules.from_account', { account: from.name })}` : ''}
        </span>
        <span className="fw-row__sub" data-testid={`schedule-next-${s.id}`}>
          {nextRunText(s)}
        </span>
        {error && <Notice status="failure">{error}</Notice>}
        {open && <Runs id={s.id} />}
      </span>
      <span className="fw-row__main">
        <StatusChip status={st.status}>
          <span data-testid={`schedule-state-${s.id}`}>{st.text}</span>
        </StatusChip>
        <div className="fw-actions">
          <Button
            size="sm"
            variant="ghost"
            data-testid={`schedule-runs-toggle-${s.id}`}
            onClick={() => setOpen((x) => !x)}
          >
            {open ? t('app.schedules.runs.hide') : t('app.schedules.runs.show')}
          </Button>
          {manage && s.state === 'ACTIVE' && (
            <Button
              size="sm"
              variant="secondary"
              data-testid={`schedule-pause-${s.id}`}
              disabled={busy}
              onClick={() => act(() => api.pauseSchedule(s.id))}
            >
              {t('app.schedules.pause')}
            </Button>
          )}
          {manage && s.state === 'PAUSED' && (
            <Button
              size="sm"
              variant="secondary"
              data-testid={`schedule-resume-${s.id}`}
              disabled={busy}
              onClick={() => act(() => api.resumeSchedule(s.id))}
            >
              {t('app.schedules.resume')}
            </Button>
          )}
          {manage && (s.state === 'ACTIVE' || s.state === 'PAUSED') && (
            <Button
              size="sm"
              variant="ghost"
              data-testid={`schedule-cancel-${s.id}`}
              disabled={busy}
              onClick={() => act(() => api.cancelSchedule(s.id))}
            >
              {t('app.schedules.cancel')}
            </Button>
          )}
        </div>
      </span>
    </li>
  );
}

type Ends = 'never' | 'count' | 'date';

/** A new scheduled ACH: who, how much, how often, from when and until when; made with step-up. */
function NewSchedule({
  accounts,
  recipients,
  onCreated,
}: {
  accounts: Account[];
  recipients: Recipient[];
  onCreated(): void;
}) {
  const { api } = useSession();
  const { busy, error, run } = useOnce();
  const payable = recipients.filter((r) => r.screening !== 'BLOCKED');
  const [from, setFrom] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('MONTHLY');
  const [interval, setEvery] = useState('1');
  const [start, setStart] = useState(today());
  const [ends, setEnds] = useState<Ends>('never');
  const [count, setCount] = useState('12');
  const [end, setEnd] = useState('');
  const [reference, setReference] = useState('');
  const fromId = accounts.some((a) => a.id === from) ? from : (accounts[0]?.id ?? '');
  const recipientId = payable.some((r) => r.id === recipient) ? recipient : '';
  const minor = decimalToMinor(amount, REGION_CONFIG.currency);
  const every = Number(interval);
  const times = Number(count);
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(start) && start >= today();
  const endOk =
    ends === 'never' ||
    (ends === 'count' && Number.isInteger(times) && times >= 1) ||
    (ends === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(end) && end > start);
  const valid = Boolean(
    fromId && recipientId && minor && Number.isInteger(every) && every >= 1 && dateOk && endOk,
  );
  const create = () =>
    run(async () => {
      if (!minor) return;
      await api.createSchedule({
        fromAccountId: fromId,
        recipientId,
        rail: REGION_CONFIG.scheduleRail,
        amountMinor: minor,
        currency: REGION_CONFIG.currency,
        frequency,
        interval: every,
        startDate: start,
        endDate: ends === 'date' ? end : null,
        count: ends === 'count' ? times : null,
        reference: reference.trim() || null,
      });
      setAmount('');
      setReference('');
      onCreated();
    });
  return (
    <Card title={t('app.schedules.form.title')} data-testid="schedule-form">
      <p>{t('app.schedules.form.intro', { how: REGION_CONFIG.scheduleAs })}</p>
      <form
        className="fw-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) void create();
        }}
      >
        <Field label={t('app.schedules.form.from')}>
          <Select
            data-testid="schedule-from"
            value={fromId}
            onChange={(e) => setFrom(e.target.value)}
            options={accounts.map((a) => ({
              value: a.id,
              label: t('app.payments.form.account_ending', { name: a.name, last4: a.last4 ?? '' }),
            }))}
          />
        </Field>
        <Field
          label={t('app.schedules.recipient')}
          hint={!payable.length ? t('app.schedules.form.recipient_first') : undefined}
        >
          <Select
            data-testid="schedule-recipient"
            value={recipientId}
            onChange={(e) => setRecipient(e.target.value)}
            options={[
              { value: '', label: t('app.schedules.form.choose_recipient') },
              ...payable.map((r) => ({ value: r.id, label: r.name })),
            ]}
          />
        </Field>
        <Field
          label={REGION_CONFIG.amountLabel}
          error={amount && !minor ? t('app.schedules.form.amount_error') : undefined}
        >
          <Input
            data-testid="schedule-amount"
            data-mask=""
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label={t('app.schedules.form.how_often')}>
          <Select
            data-testid="schedule-frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as 'DAILY' | 'WEEKLY' | 'MONTHLY')}
            options={[
              { value: 'DAILY', label: t('app.schedules.form.days') },
              { value: 'WEEKLY', label: t('app.schedules.form.weeks') },
              { value: 'MONTHLY', label: t('app.schedules.form.months') },
            ]}
          />
        </Field>
        <Field
          label={t('app.schedules.form.every')}
          hint={
            Number.isInteger(every) && every >= 1
              ? frequencyText(frequency, every)
              : t('app.schedules.form.whole_number')
          }
        >
          <Input
            data-testid="schedule-interval"
            inputMode="numeric"
            value={interval}
            onChange={(e) => setEvery(e.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <Field
          label={t('app.schedules.form.first_on')}
          error={start && !dateOk ? t('app.schedules.form.start_error') : undefined}
        >
          <Input
            data-testid="schedule-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field label={t('app.schedules.form.ends')}>
          <Select
            data-testid="schedule-ends"
            value={ends}
            onChange={(e) => setEnds(e.target.value as Ends)}
            options={[
              { value: 'never', label: t('app.schedules.form.ends_never') },
              { value: 'count', label: t('app.schedules.form.ends_count') },
              { value: 'date', label: t('app.schedules.form.ends_date') },
            ]}
          />
        </Field>
        {ends === 'count' && (
          <Field label={t('app.schedules.form.count')}>
            <Input
              data-testid="schedule-count"
              inputMode="numeric"
              value={count}
              onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
        )}
        {ends === 'date' && (
          <Field
            label={t('app.schedules.form.end')}
            error={end && !endOk ? t('app.schedules.form.end_error') : undefined}
          >
            <Input
              data-testid="schedule-end"
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
        )}
        <Field label={t('app.schedules.form.reference')}>
          <Input
            data-testid="schedule-reference"
            maxLength={80}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </Field>
        {minor && valid && (
          <p data-testid="schedule-summary">
            <T
              k="app.schedules.form.summary"
              vars={{
                amount: (
                  <span data-mask="">
                    {formatMinor({ amountMinor: minor, currency: REGION_CONFIG.currency })}
                  </span>
                ),
                frequency: frequencyText(frequency, every).toLowerCase(),
                date: formatDay(start),
              }}
            />
          </p>
        )}
        {error && <Notice status="failure">{error}</Notice>}
        <div className="fw-actions">
          <Button type="submit" data-testid="schedule-save" disabled={!valid || busy}>
            {t('app.schedules.form.save')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * G-120, scheduled payments OnGem runs itself: the company's schedules with how often, the next payment date and the
 * state; pause, resume (step-up) and cancel; the payments each made; and a new scheduled ACH (step-up). Scheduled
 * transfers between own accounts wait on the bank (Q-128).
 */
export function Schedules() {
  const { api, can } = useSession();
  const [n, setN] = useState(0);
  const refresh = () => setN((x) => x + 1);
  const list = useAsync(() => api.schedules(), [api, n]);
  const accounts = useAsync(() => api.accounts(), [api]);
  const recipients = useAsync(() => api.recipients(), [api]);
  const accs = accounts.status === 'success' ? accounts.data.filter((a) => a.status === 'ACTIVE') : [];
  const recs = recipients.status === 'success' ? recipients.data : [];
  return (
    <div className="fw-stack" data-testid="schedules">
      <Card title={t('app.schedules.title')}>
        <Load state={list} label={t('app.schedules.loading.list')}>
          {(items) =>
            items.length ? (
              <ul className="fw-list" data-testid="schedules-list">
                {items.map((s) => (
                  <ScheduleRow key={s.id} s={s} accounts={accs} recipients={recs} onChanged={refresh} />
                ))}
              </ul>
            ) : (
              <EmptyState title={t('app.schedules.empty.title')}>{t('app.schedules.empty.text')}</EmptyState>
            )
          }
        </Load>
      </Card>
      {can(Permission.PAYMENT_CREATE) && recipients.status === 'success' && accs.length > 0 && (
        <NewSchedule accounts={accs} recipients={recs} onCreated={refresh} />
      )}
    </div>
  );
}
