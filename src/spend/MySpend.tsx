import { useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { CardWidgetSession } from '../api/types';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  KeyValue,
  Notice,
  Select,
  StatusChip,
  TextArea,
  useToast,
} from '../design-system';
import { t, tn } from '../i18n';
import { decimalToMinor, formatBankDate, formatDate, formatMinor, minorToDecimal } from '../lib/format';
import { today } from '../lib/schedule';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { CardWidget } from '../screens/CardWidget';
import { Amt, DateInput, FilterChips, Last4, Load, PrefixedInput, currencyPrefix } from '../screens/common';
import { useSpendAccess } from './access';
import { EXPENSE_STATES, spendOf, type ExpenseView, type ReceiptView, type SpendMeView } from './api';
import { CodingForm, ExpenseFacts, expensePaging, ReceiptDownload } from './Expenses';
import { ReceiptHintsLine } from './Receipts';
import {
  categoryLabel,
  isCode,
  matchLabel,
  receiptLabel,
  spendErrorText,
  spendStatus,
  stateLabel,
} from './common';

/** The employee's own profile, read again on each screen so counts follow what they just did. */
function useMe() {
  const { api } = useSession();
  return useAsync(() => spendOf(api).me(), [api]);
}

function NeedsBanner({ me }: { me: SpendMeView }) {
  if (!me.receiptsNeeded && !me.toSubmit) return null;
  return (
    <Notice status="pending">
      <span data-testid="spend-needs">
        {me.receiptsNeeded > 0 && (
          <Link to="/spend/me/expenses?state=OPEN">
            {tn('app.spend.me.receipts_needed', me.receiptsNeeded)}
          </Link>
        )}{' '}
        {me.toSubmit > 0 && tn('app.spend.me.to_submit', me.toSubmit)}
      </span>
    </Notice>
  );
}

/** My card: last four, state, freeze and unfreeze (step-up), details through the bank's widget, limits and hints. */
export function MyCard() {
  const { api } = useSession();
  const spend = spendOf(api);
  const toast = useToast();
  const me = useMe();
  const [widget, setWidget] = useState<CardWidgetSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      if (done) toast.show(done, 'success');
      me.reload();
    } catch (e) {
      setError(spendErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Load state={me} label="spend card">
      {(m) => {
        const c = m.employee.card;
        return (
          <>
            <NeedsBanner me={m} />
            <Card title={t('app.spend.me.card_title')} data-testid="my-card">
              {c ? (
                <>
                  <KeyValue
                    items={[
                      { label: t('app.spend.card.number'), value: <Last4 value={c.last4} /> },
                      {
                        label: t('app.spend.card.state'),
                        value: (
                          <StatusChip status={spendStatus(c.state)}>
                            <span data-testid="my-card-state">{stateLabel(c.state)}</span>
                          </StatusChip>
                        ),
                      },
                      ...(c.frozenBy && c.frozenBy !== 'CARD'
                        ? [
                            {
                              label: t('app.spend.card.frozen_by'),
                              value: t(`app.spend.card.frozen_by_${c.frozenBy.toLowerCase()}`),
                            },
                          ]
                        : []),
                    ]}
                  />
                  <div className="fw-actions">
                    {c.state === 'ACTIVE' && (
                      <Button
                        variant="secondary"
                        data-testid="my-card-freeze"
                        disabled={busy}
                        onClick={() =>
                          run(() => spend.setMyCardFrozen(true), t('app.spend.card.frozen_done'))
                        }
                      >
                        {t('app.spend.card.freeze')}
                      </Button>
                    )}
                    {c.state === 'FROZEN' &&
                      (!c.frozenBy || c.frozenBy === 'CARD') &&
                      m.employee.state === 'ACTIVE' && (
                        <Button
                          variant="secondary"
                          data-testid="my-card-unfreeze"
                          disabled={busy}
                          onClick={() =>
                            run(() => spend.setMyCardFrozen(false), t('app.spend.card.unfrozen_done'))
                          }
                        >
                          {t('app.spend.card.unfreeze')}
                        </Button>
                      )}
                    {(c.state === 'ACTIVE' || c.state === 'FROZEN') && (
                      <Button
                        variant="ghost"
                        data-testid="my-card-reveal"
                        disabled={busy}
                        onClick={() => run(() => spend.myCardWidget('REVEAL').then(setWidget))}
                      >
                        {t('app.spend.me.show_details')}
                      </Button>
                    )}
                  </div>
                  {widget && <CardWidget session={widget} onClose={() => setWidget(null)} />}
                </>
              ) : (
                <EmptyState title={t('app.spend.me.no_card')}>
                  <p data-testid="my-no-card">{t('app.spend.me.no_card_text')}</p>
                </EmptyState>
              )}
              {error && (
                <Notice status="failure">
                  <span data-testid="my-card-error">{error}</span>
                </Notice>
              )}
            </Card>
            <Card title={t('app.spend.me.limits_title')}>
              <KeyValue
                items={[
                  { label: t('app.spend.me.month_spent'), value: <Amt value={m.monthSpent} /> },
                  {
                    label: t('app.spend.limits.per_transaction'),
                    value: m.employee.limits.perTransaction ? (
                      <Amt value={m.employee.limits.perTransaction} />
                    ) : (
                      t('app.spend.limits.none')
                    ),
                  },
                  {
                    label: t('app.spend.limits.monthly'),
                    value: m.employee.limits.monthly ? (
                      <Amt value={m.employee.limits.monthly} />
                    ) : (
                      t('app.spend.limits.none')
                    ),
                  },
                  {
                    label: t('app.spend.policy.receipt_above'),
                    value: (
                      <span data-testid="my-receipt-threshold">
                        {formatMinor(m.policy.receiptRequiredAbove)}
                      </span>
                    ),
                  },
                  {
                    label: t('app.spend.me.team'),
                    value: m.employee.teamName ?? t('app.spend.employees.no_team'),
                  },
                ]}
              />
              <p className="fw-row__sub">
                {t('app.spend.me.reminder_hint', { hours: m.policy.receiptReminderHours })}
              </p>
            </Card>
          </>
        );
      }}
    </Load>
  );
}

/** My expenses: the receipts-needed line, a state filter and the list, paged by keyset. */
export function MyExpenses() {
  const { api } = useSession();
  const navigate = useNavigate();
  const spend = spendOf(api);
  const me = useMe();
  const [search] = useSearchParams();
  const initial = search.get('state') ?? 'all';
  const [state, setState] = useState(initial);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const cursor = cursors[cursors.length - 1] ?? null;
  const page = useAsync(
    () => spend.myExpenses(state === 'all' ? undefined : state, cursor, expensePaging.size),
    [api, state, cursor],
  );
  return (
    <>
      {me.status === 'success' && <NeedsBanner me={me.data} />}
      <Card title={t('app.spend.me.expenses_title')}>
        <FilterChips
          label={t('app.spend.expenses.filter_label')}
          testId="my-expense-filter"
          value={state}
          onChange={(s) => {
            setState(s);
            setCursors([null]);
          }}
          options={[
            { id: 'all', label: t('app.spend.filter.all') },
            ...EXPENSE_STATES.map((s) => ({ id: s, label: stateLabel(s) })),
          ]}
        />
        <Load state={page} label="spend expenses">
          {(p) =>
            p.items.length === 0 ? (
              <EmptyState title={t('app.spend.me.no_expenses')}>
                <p>{t('app.spend.me.no_expenses_text')}</p>
              </EmptyState>
            ) : (
              <>
                <ul className="fw-list" data-testid="my-expense-list">
                  {p.items.map((x) => (
                    <li key={x.id}>
                      <button
                        className="fw-row"
                        data-testid={`my-expense-${x.id}`}
                        onClick={() => navigate(`/spend/me/expenses/${encodeURIComponent(x.id)}`)}
                      >
                        <span className="fw-row__main">
                          <strong>{x.merchant ?? t('app.spend.expense.none')}</strong>
                          <span className="fw-row__sub">
                            {[formatBankDate(x.spentOn), receiptLabel(x.receipt)].join(' · ')}
                          </span>
                        </span>
                        <Amt value={x.amount} />
                        <StatusChip status={spendStatus(x.state)}>{stateLabel(x.state)}</StatusChip>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="fw-actions">
                  {cursors.length > 1 && (
                    <Button
                      variant="secondary"
                      data-testid="my-expense-previous"
                      onClick={() => setCursors((c) => c.slice(0, -1))}
                    >
                      {t('app.spend.expenses.previous')}
                    </Button>
                  )}
                  {p.next && (
                    <Button
                      variant="secondary"
                      data-testid="my-expense-next"
                      onClick={() => setCursors((c) => [...c, p.next!])}
                    >
                      {t('app.spend.expenses.next')}
                    </Button>
                  )}
                </div>
              </>
            )
          }
        </Load>
      </Card>
    </>
  );
}

/**
 * Receipt upload with the amount and date as hints (there is no reading of the file yet). From an expense the hints are
 * filled from it and the receipt is attached to it; otherwise the core matches by amount and date or leaves it unmatched.
 */
function ReceiptUpload({ expense, onDone }: { expense?: ExpenseView; onDone(r: ReceiptView): void }) {
  const { api } = useSession();
  const spend = spendOf(api);
  const settings = useAsync(() => spend.settings(), [api]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState(expense ? minorToDecimal(expense.amount) : '');
  const [date, setDate] = useState(expense?.spentOn ?? '');
  const [merchant, setMerchant] = useState(expense?.merchant ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const s = settings.status === 'success' ? settings.data : null;
  const currency = expense?.amount.currency ?? s?.ceilings.perTransaction?.currency ?? null;
  return (
    <form
      className="fw-thread"
      data-testid="receipt-upload"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (!file) return setError(t('app.spend.upload.choose_file'));
        if (s && file.size > s.receiptMaxBytes) return setError(t('app.spend.error.receipt_too_large'));
        if (s && !s.receiptTypes.includes(file.type))
          return setError(t('app.spend.error.receipt_type_unsupported'));
        const amountMinor = amount.trim() && currency ? decimalToMinor(amount.trim(), currency) : null;
        if (amount.trim() && amountMinor === null) return setError(t('app.spend.upload.amount_invalid'));
        setBusy(true);
        try {
          const r = await spend.uploadReceipt(file, {
            ...(expense ? { expenseId: expense.id } : {}),
            ...(amountMinor != null && currency ? { amountMinor, currency } : {}),
            ...(date ? { date } : {}),
            ...(merchant.trim() ? { merchant: merchant.trim() } : {}),
          });
          setFile(null);
          if (fileRef.current) fileRef.current.value = '';
          onDone(r);
        } catch (err) {
          setError(spendErrorText(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field
        label={t('app.spend.upload.file')}
        hint={
          s ? t('app.spend.upload.file_hint', { size: Math.round(s.receiptMaxBytes / 1_048_576) }) : undefined
        }
      >
        <Input
          ref={fileRef}
          data-testid="receipt-file"
          type="file"
          accept={s?.receiptTypes.join(',')}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </Field>
      <Field label={t('app.spend.upload.amount')} hint={t('app.spend.upload.hint_text')}>
        <PrefixedInput
          prefix={currencyPrefix()}
          data-testid="receipt-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <Field label={t('app.spend.upload.date')}>
        <DateInput data-testid="receipt-date" value={date} onChange={setDate} />
      </Field>
      <Field label={t('app.spend.upload.merchant')}>
        <Input
          data-testid="receipt-merchant"
          maxLength={120}
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
        />
      </Field>
      {error && (
        <Notice status="failure">
          <span data-testid="receipt-upload-error">{error}</span>
        </Notice>
      )}
      <div className="fw-actions">
        <Button type="submit" data-testid="receipt-upload-submit" disabled={busy}>
          {t('app.spend.upload.submit')}
        </Button>
      </div>
    </form>
  );
}

/** One of my expenses: code it, add its receipt and submit while it is OPEN; afterwards what was decided. */
export function MyExpenseDetail() {
  const { id = '' } = useParams();
  const { api } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const access = useSpendAccess();
  const spend = spendOf(api);
  const one = useAsync(() => spend.myExpense(id), [api, id]);
  const me = useMe();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const policy = me.status === 'success' ? me.data.policy : access.employee?.policy;
  return (
    <>
      <Button variant="ghost" className="fw-back" onClick={() => navigate('/spend/me/expenses')}>
        {t('app.spend.me.back')}
      </Button>
      <Load state={one} label="spend expenses">
        {(x) => (
          <>
            <Card title={x.merchant ?? t('app.spend.expense.none')} data-testid="my-expense-detail">
              <ExpenseFacts x={x} />
              {x.receiptId && <ReceiptDownload receiptId={x.receiptId} own />}
            </Card>
            {x.state === 'OPEN' && (
              <>
                <Card title={t('app.spend.me.code_title')}>
                  <CodingForm
                    key={`${x.category}-${x.taxCode}-${x.note}`}
                    x={x}
                    categories={policy?.categories ?? []}
                    taxCodes={policy?.taxCodes ?? []}
                    testId="coding"
                    onSave={async (c) => {
                      setError(null);
                      try {
                        await spend.codeMyExpense(x.id, c);
                        toast.show(t('app.spend.expense.recoded'), 'success');
                        one.reload();
                      } catch (e) {
                        setError(spendErrorText(e));
                      }
                    }}
                  />
                </Card>
                {!x.receiptId && (
                  <Card title={t('app.spend.me.add_receipt')}>
                    {x.receipt === 'MISSING' && (
                      <p data-testid="my-receipt-required">
                        {policy
                          ? t('app.spend.me.receipt_required_above', {
                              amount: formatMinor(policy.receiptRequiredAbove),
                            })
                          : t('app.spend.error.receipt_required')}
                      </p>
                    )}
                    <ReceiptUpload
                      expense={x}
                      onDone={() => {
                        toast.show(t('app.spend.upload.attached'), 'success');
                        one.reload();
                        me.reload();
                      }}
                    />
                  </Card>
                )}
                <Card title={t('app.spend.me.submit_title')}>
                  <p>{t('app.spend.me.submit_text')}</p>
                  <div className="fw-actions">
                    <Button
                      data-testid="my-expense-submit"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setError(null);
                        try {
                          const done = await spend.submitMyExpense(x.id);
                          toast.show(
                            done.state === 'APPROVED'
                              ? t('app.spend.me.submitted_approved')
                              : t('app.spend.me.submitted_waiting'),
                            'success',
                          );
                          one.reload();
                          me.reload();
                          access.reload();
                        } catch (e) {
                          setError(spendErrorText(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {t('app.spend.me.submit')}
                    </Button>
                  </div>
                </Card>
              </>
            )}
            {error && (
              <Notice status="failure">
                <span data-testid="my-expense-error">{error}</span>
              </Notice>
            )}
          </>
        )}
      </Load>
    </>
  );
}

/** What happened to an upload: matched (how), or unmatched with the expenses it could be, matched by hand here. */
function MatchResult({ r, onMatched }: { r: ReceiptView; onMatched(): void }) {
  const { api } = useSession();
  const spend = spendOf(api);
  const open = useAsync(
    () => spend.myExpenses('OPEN', null, 100).then((p) => p.items.filter((x) => !x.receiptId)),
    [api, r.id],
  );
  const [choice, setChoice] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (r.state === 'MATCHED')
    return (
      <Notice status="success">
        <span data-testid="receipt-result-matched">
          {t('app.spend.upload.matched', { how: matchLabel(r.matchRule ?? 'MANUAL') })}
        </span>
      </Notice>
    );
  const pool = open.status === 'success' ? open.data : [];
  const candidates = pool.filter((x) => r.candidates.includes(x.id));
  const options = (candidates.length ? candidates : pool).map((x) => ({
    value: x.id,
    label: t('app.spend.me.match_option', {
      merchant: x.merchant ?? t('app.spend.expense.none'),
      amount: formatMinor(x.amount),
      date: formatBankDate(x.spentOn),
    }),
  }));
  const picked = choice || options[0]?.value || '';
  return (
    <div className="fw-thread" data-testid="receipt-result-unmatched">
      <Notice status="pending">{t('app.spend.upload.unmatched')}</Notice>
      {options.length ? (
        <div className="fw-actions">
          <Field
            label={candidates.length ? t('app.spend.receipts.candidates') : t('app.spend.receipts.any_open')}
          >
            <Select
              data-testid={`my-receipt-pick-${r.id}`}
              value={picked}
              onChange={setChoice}
              options={options}
            />
          </Field>
          <Button
            data-testid={`my-receipt-match-${r.id}`}
            onClick={async () => {
              setError(null);
              try {
                await spend.matchMyReceipt(r.id, picked);
                onMatched();
              } catch (e) {
                setError(spendErrorText(e));
              }
            }}
          >
            {t('app.spend.receipts.match')}
          </Button>
        </div>
      ) : (
        <p className="fw-row__sub">{t('app.spend.receipts.nothing_to_match')}</p>
      )}
      {error && <Notice status="failure">{error}</Notice>}
    </div>
  );
}

/** My receipts: upload one, see whether it matched, match an unmatched one by hand. */
export function MyReceipts() {
  const { api } = useSession();
  const spend = spendOf(api);
  const toast = useToast();
  const list = useAsync(() => spend.myReceipts(), [api]);
  const [last, setLast] = useState<ReceiptView | null>(null);
  return (
    <>
      <Card title={t('app.spend.me.upload_title')}>
        <p>{t('app.spend.me.upload_text')}</p>
        <ReceiptUpload
          onDone={(r) => {
            setLast(r);
            list.reload();
          }}
        />
        {last && (
          <MatchResult
            key={`${last.id}-${last.state}`}
            r={last}
            onMatched={() => {
              toast.show(t('app.spend.receipts.matched'), 'success');
              setLast({ ...last, state: 'MATCHED', matchRule: 'MANUAL' });
              list.reload();
            }}
          />
        )}
      </Card>
      <Card title={t('app.spend.me.receipts_title')}>
        <Load state={list} label="spend receipts">
          {(xs) =>
            xs.length === 0 ? (
              <EmptyState title={t('app.spend.me.no_receipts')} />
            ) : (
              <ul className="fw-list" data-testid="my-receipt-list">
                {xs.map((r) => (
                  <li key={r.id} className="fw-row" data-testid={`my-receipt-${r.id}`}>
                    <span className="fw-row__main">
                      <strong>{r.fileName}</strong>
                      <ReceiptHintsLine r={r} />
                      <span className="fw-row__sub">
                        {r.state === 'MATCHED' && r.matchRule
                          ? t('app.spend.me.receipt_matched_how', {
                              how: matchLabel(r.matchRule),
                              date: formatDate(r.createdAt),
                            })
                          : t('app.spend.receipts.uploaded', { date: formatDate(r.createdAt) })}
                      </span>
                    </span>
                    <StatusChip status={spendStatus(r.state)}>{stateLabel(r.state)}</StatusChip>
                  </li>
                ))}
              </ul>
            )
          }
        </Load>
      </Card>
    </>
  );
}

/** A claim for money paid out of pocket: amount in the policy's currency, merchant, a day not in the future. */
export function MyClaim() {
  const { api } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const me = useMe();
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Load state={me} label="spend card">
      {(m) => {
        const currency = m.policy.receiptRequiredAbove.currency;
        return (
          <Card title={t('app.spend.claim.title')}>
            <form
              className="fw-thread"
              data-testid="claim-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                const minor = decimalToMinor(amount.trim(), currency);
                const bad: Record<string, string> = {};
                if (minor === null || minor <= 0) bad.amount = t('app.spend.claim.amount_invalid');
                if (!merchant.trim()) bad.merchant = t('app.spend.employees.required');
                if (!date || date > today()) bad.date = t('app.spend.claim.date_invalid');
                setProblems(bad);
                if (Object.keys(bad).length) return;
                setBusy(true);
                try {
                  const x = await spendOf(api).claim({
                    amountMinor: minor!,
                    currency,
                    merchant: merchant.trim(),
                    spentOn: date,
                    ...(category ? { category } : {}),
                    ...(note.trim() ? { note: note.trim() } : {}),
                  });
                  toast.show(t('app.spend.claim.created'), 'success');
                  navigate(`/spend/me/expenses/${encodeURIComponent(x.id)}`);
                } catch (err) {
                  setError(
                    isCode(err, 'validation_failed') ? t('app.spend.claim.invalid') : spendErrorText(err),
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>{t('app.spend.claim.intro')}</p>
              <Field label={t('app.spend.claim.amount')} error={problems.amount}>
                <PrefixedInput
                  prefix={currencyPrefix()}
                  data-testid="claim-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
              <Field label={t('app.spend.claim.merchant')} error={problems.merchant}>
                <Input
                  data-testid="claim-merchant"
                  maxLength={120}
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                />
              </Field>
              <Field label={t('app.spend.claim.date')} error={problems.date}>
                <DateInput data-testid="claim-date" value={date} onChange={setDate} />
              </Field>
              <Field label={t('app.spend.expense.category')}>
                <Select
                  data-testid="claim-category"
                  value={category}
                  onChange={setCategory}
                  options={[
                    { value: '', label: t('app.spend.expense.choose_category') },
                    ...m.policy.categories.map((k) => ({ value: k, label: categoryLabel(k) })),
                  ]}
                />
              </Field>
              <Field label={t('app.spend.expense.note')} hint={t('app.spend.expense.note_hint')}>
                <TextArea
                  data-testid="claim-note"
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
              {error && (
                <Notice status="failure">
                  <span data-testid="claim-error">{error}</span>
                </Notice>
              )}
              <div className="fw-actions">
                <Button type="submit" data-testid="claim-submit" disabled={busy}>
                  {t('app.spend.claim.submit')}
                </Button>
              </div>
            </form>
          </Card>
        );
      }}
    </Load>
  );
}
