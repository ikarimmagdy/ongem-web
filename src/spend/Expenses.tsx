import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Permission } from '../api/client';
import {
  Button,
  Card,
  EmptyState,
  Field,
  KeyValue,
  Modal,
  Notice,
  Select,
  StatusChip,
  Table,
  TextArea,
  useToast,
} from '../design-system';
import { t } from '../i18n';
import { decimalToMinor, formatBankDate, formatDate, minorToDecimal } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { Amt, DateInput, FilterChips, Load, PrefixedInput, currencyPrefix } from '../screens/common';
import { useSpendAccess } from './access';
import { EXPENSE_STATES, spendOf, type CodingBody, type ExpenseFilter, type ExpenseView } from './api';
import {
  categoryLabel,
  reasonLabel,
  receiptLabel,
  saveBlob,
  spendErrorText,
  spendStatus,
  stateLabel,
  taxLabel,
} from './common';

/** Expenses per page; tests shorten it. */
export const expensePaging = { size: 25 };

/** Who decided: the policy itself (`policy:v<N>`), the person the API names, or a person. */
export function decidedByText(by: string, name?: string | null): string {
  const m = /^policy:v(\d+)$/.exec(by);
  if (m) return t('app.spend.expense.decided_by_policy', { version: m[1]! });
  return name ? t('app.spend.expense.decided_by_name', { name }) : t('app.spend.expense.decided_by_person');
}

/** The facts of one expense, the same for finance and for the employee. */
export function ExpenseFacts({ x }: { x: ExpenseView }) {
  return (
    <>
      <KeyValue
        items={[
          { label: t('app.spend.expense.amount'), value: <Amt value={x.amount} /> },
          { label: t('app.spend.expense.merchant'), value: x.merchant ?? t('app.spend.expense.none') },
          { label: t('app.spend.expense.employee'), value: x.employeeName },
          { label: t('app.spend.expense.date'), value: formatBankDate(x.spentOn) },
          {
            label: t('app.spend.expense.source'),
            value:
              x.source === 'CLAIM' ? t('app.spend.expense.source_claim') : t('app.spend.expense.source_card'),
          },
          {
            label: t('app.spend.expense.state'),
            value: (
              <StatusChip status={spendStatus(x.state)}>
                <span data-testid="expense-state">{stateLabel(x.state)}</span>
              </StatusChip>
            ),
          },
          {
            label: t('app.spend.expense.receipt'),
            value: (
              <StatusChip status={spendStatus(x.receipt)}>
                <span data-testid="expense-receipt">{receiptLabel(x.receipt)}</span>
              </StatusChip>
            ),
          },
          {
            label: t('app.spend.expense.category'),
            value: x.category ? categoryLabel(x.category) : t('app.spend.expense.none'),
          },
          {
            label: t('app.spend.expense.tax_code'),
            value: x.taxCode ? taxLabel(x.taxCode) : t('app.spend.expense.none'),
          },
          {
            label: t('app.spend.expense.vat'),
            value: x.vat ? <Amt value={x.vat} /> : t('app.spend.expense.none'),
          },
          { label: t('app.spend.expense.note'), value: x.note ?? t('app.spend.expense.none') },
          ...(x.policyVersion
            ? [
                {
                  label: t('app.spend.expense.policy'),
                  value: t('app.spend.policy.version', { version: x.policyVersion }),
                },
              ]
            : []),
          ...(x.decidedBy && x.decidedAt
            ? [
                {
                  label: t('app.spend.expense.decided'),
                  value: `${decidedByText(x.decidedBy, x.decidedByName)}, ${formatDate(x.decidedAt, { time: true })}`,
                },
              ]
            : []),
          ...(x.decisionNote ? [{ label: t('app.spend.expense.decision_note'), value: x.decisionNote }] : []),
        ]}
      />
      {x.reasons.length > 0 && (
        <Notice status="pending">
          <span data-testid="expense-reasons">
            {t('app.spend.expense.reasons', { reasons: x.reasons.map(reasonLabel).join(', ') })}
          </span>
        </Notice>
      )}
      {x.overLimit && (
        <Notice status="failure">
          <span data-testid="expense-over-limit">{t('app.spend.expense.over_limit')}</span>
        </Notice>
      )}
    </>
  );
}

/** Downloads an expense's receipt file (finance or the employee's own). */
export function ReceiptDownload({ receiptId, own }: { receiptId: string; own?: boolean }) {
  const { api } = useSession();
  const [phase, setPhase] = useState<'idle' | 'busy' | 'failed'>('idle');
  return (
    <>
      <Button
        variant="secondary"
        data-testid="expense-receipt-download"
        disabled={phase === 'busy'}
        onClick={async () => {
          setPhase('busy');
          try {
            const spend = spendOf(api);
            const blob = await (own ? spend.myReceiptFile(receiptId) : spend.receiptFile(receiptId));
            saveBlob(blob, `receipt-${receiptId}`);
            setPhase('idle');
          } catch {
            setPhase('failed');
          }
        }}
      >
        {t('app.spend.expense.receipt_download')}
      </Button>
      {phase === 'failed' && (
        <Notice status="failure">{t('app.spend.expense.receipt_download_failed')}</Notice>
      )}
    </>
  );
}

/** Finance: every expense, newest spend date first, filtered by state, employee, team and dates, paged by keyset. */
export function ExpensesScreen() {
  const { api } = useSession();
  const navigate = useNavigate();
  const spend = spendOf(api);
  const [search, setSearch] = useSearchParams();
  const state = search.get('state') ?? '';
  const [employeeId, setEmployeeId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const cursor = cursors[cursors.length - 1] ?? null;
  const filter: ExpenseFilter = {
    ...(state ? { state } : {}),
    ...(employeeId ? { employeeId } : {}),
    ...(teamId ? { teamId } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
  const key = JSON.stringify(filter);
  const page = useAsync(() => spend.expenses(filter, cursor, expensePaging.size), [api, key, cursor]);
  const people = useAsync(() => spend.employees(), [api]);
  const teams = useAsync(() => spend.teams(), [api]);
  const restart =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setCursors([null]);
    };
  const datesBad = Boolean(from && to && to < from);
  return (
    <Card title={t('app.spend.expenses.title')}>
      <div className="fw-thread">
        <FilterChips
          label={t('app.spend.expenses.filter_label')}
          testId="expense-filter"
          value={state || 'all'}
          onChange={(id) => {
            const next = new URLSearchParams(search);
            if (id === 'all') next.delete('state');
            else next.set('state', id);
            setSearch(next, { replace: true });
            setCursors([null]);
          }}
          options={[
            { id: 'all', label: t('app.spend.filter.all') },
            ...EXPENSE_STATES.map((s) => ({ id: s, label: stateLabel(s) })),
          ]}
        />
        <div className="fw-filters-row">
          <Field label={t('app.spend.expenses.employee')}>
            <Select
              data-testid="expense-employee"
              value={employeeId}
              onChange={restart(setEmployeeId)}
              options={[
                { value: '', label: t('app.spend.expenses.anyone') },
                ...(people.status === 'success'
                  ? people.data.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))
                  : []),
              ]}
            />
          </Field>
          <Field label={t('app.spend.expenses.team')}>
            <Select
              data-testid="expense-team"
              value={teamId}
              onChange={restart(setTeamId)}
              options={[
                { value: '', label: t('app.spend.expenses.any_team') },
                ...(teams.status === 'success'
                  ? teams.data.map((x) => ({ value: x.id, label: x.name }))
                  : []),
              ]}
            />
          </Field>
          <Field
            label={t('app.spend.expenses.from')}
            error={datesBad ? t('app.spend.expenses.dates_invalid') : undefined}
          >
            <DateInput data-testid="expense-from" value={from} onChange={restart(setFrom)} />
          </Field>
          <Field label={t('app.spend.expenses.to')}>
            <DateInput data-testid="expense-to" value={to} onChange={restart(setTo)} />
          </Field>
        </div>
        <Load state={page} label="spend expenses">
          {(p) => (
            <>
              <Table
                caption={t('app.spend.expenses.title')}
                hideCaption
                stack
                rows={p.items}
                rowKey={(x) => x.id}
                onRowClick={(x) => navigate(`/spend/expenses/${encodeURIComponent(x.id)}`)}
                empty={<EmptyState title={t('app.spend.expenses.empty')} />}
                columns={[
                  {
                    key: 'date',
                    header: t('app.spend.expense.date'),
                    render: (x) => formatBankDate(x.spentOn),
                  },
                  {
                    key: 'merchant',
                    header: t('app.spend.expense.merchant'),
                    render: (x) => (
                      <span data-testid={`expense-row-${x.id}`}>
                        {x.merchant ?? t('app.spend.expense.none')}
                      </span>
                    ),
                  },
                  { key: 'employee', header: t('app.spend.expense.employee'), render: (x) => x.employeeName },
                  {
                    key: 'receipt',
                    header: t('app.spend.expense.receipt'),
                    render: (x) => receiptLabel(x.receipt),
                  },
                  {
                    key: 'state',
                    header: t('app.spend.expense.state'),
                    render: (x) => (
                      <StatusChip status={spendStatus(x.state)}>{stateLabel(x.state)}</StatusChip>
                    ),
                  },
                  {
                    key: 'amount',
                    header: t('app.spend.expense.amount'),
                    align: 'end',
                    render: (x) => <Amt value={x.amount} />,
                  },
                ]}
              />
              <div className="fw-actions" data-testid="expense-paging">
                {cursors.length > 1 && (
                  <Button
                    variant="secondary"
                    data-testid="expense-previous"
                    onClick={() => setCursors((c) => c.slice(0, -1))}
                  >
                    {t('app.spend.expenses.previous')}
                  </Button>
                )}
                {p.next && (
                  <Button
                    variant="secondary"
                    data-testid="expense-next"
                    onClick={() => setCursors((c) => [...c, p.next!])}
                  >
                    {t('app.spend.expenses.next')}
                  </Button>
                )}
              </div>
            </>
          )}
        </Load>
      </div>
    </Card>
  );
}

/** The coding form: category from the policy in force, tax code from the programme, VAT up to the amount, a note. */
export function CodingForm({
  x,
  categories,
  taxCodes,
  onSave,
  testId,
}: {
  x: ExpenseView;
  categories: string[];
  taxCodes: string[];
  onSave(c: CodingBody): Promise<void>;
  testId: string;
}) {
  const [category, setCategory] = useState(x.category ?? '');
  const [taxCode, setTaxCode] = useState(x.taxCode ?? '');
  const [vat, setVat] = useState(x.vat ? minorToDecimal(x.vat) : '');
  const [note, setNote] = useState(x.note ?? '');
  const [vatError, setVatError] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="fw-thread"
      data-testid={testId}
      onSubmit={async (e) => {
        e.preventDefault();
        const vatMinor = vat.trim() ? decimalToMinor(vat.trim(), x.amount.currency) : null;
        if (vat.trim() && (vatMinor === null || vatMinor < 0 || vatMinor > x.amount.amountMinor))
          return setVatError(true);
        setVatError(false);
        setBusy(true);
        try {
          await onSave({
            category: category || null,
            taxCode: taxCode || null,
            vatMinor,
            note: note.trim() || null,
          });
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label={t('app.spend.expense.category')}>
        <Select
          data-testid={`${testId}-category`}
          value={category}
          onChange={setCategory}
          options={[
            { value: '', label: t('app.spend.expense.choose_category') },
            ...categories.map((k) => ({ value: k, label: categoryLabel(k) })),
          ]}
        />
      </Field>
      <Field label={t('app.spend.expense.tax_code')}>
        <Select
          data-testid={`${testId}-tax`}
          value={taxCode}
          onChange={setTaxCode}
          options={[
            { value: '', label: t('app.spend.expense.choose_tax') },
            ...taxCodes.map((c) => ({ value: c, label: taxLabel(c) })),
          ]}
        />
      </Field>
      <Field
        label={t('app.spend.expense.vat')}
        hint={t('app.spend.expense.vat_hint')}
        error={vatError ? t('app.spend.expense.vat_invalid') : undefined}
      >
        <PrefixedInput
          prefix={currencyPrefix()}
          data-testid={`${testId}-vat`}
          inputMode="decimal"
          value={vat}
          onChange={(e) => setVat(e.target.value)}
        />
      </Field>
      <Field label={t('app.spend.expense.note')} hint={t('app.spend.expense.note_hint')}>
        <TextArea
          data-testid={`${testId}-note`}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <div className="fw-actions">
        <Button type="submit" variant="secondary" data-testid={`${testId}-save`} disabled={busy}>
          {t('app.spend.expense.save_coding')}
        </Button>
      </div>
    </form>
  );
}

/** Finance: one expense with recode (not once exported or rejected), approve and reject with a reason. */
export function ExpenseDetail() {
  const { id = '' } = useParams();
  const { api, can } = useSession();
  const access = useSpendAccess();
  const navigate = useNavigate();
  const toast = useToast();
  const spend = spendOf(api);
  const one = useAsync(() => spend.expense(id), [api, id]);
  // Own expense (I-12): the expense's employee is linked to the signed-in person (EmployeeView.personId).
  const employeeId = one.status === 'success' ? one.data.employeeId : null;
  const owner = useAsync(
    () => (employeeId ? spend.employee(employeeId) : Promise.resolve(null)),
    [api, employeeId],
  );
  const me = useAsync(() => api.me(), [api]);
  const policy = useAsync(() => spend.policy(), [api]);
  const settings = useAsync(() => spend.settings(), [api]);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [noteMissing, setNoteMissing] = useState(false);
  const [approveNote, setApproveNote] = useState('');
  const [busy, setBusy] = useState(false);
  const categories =
    policy.status === 'success' && policy.data.active
      ? policy.data.active.policy.categories.map((c) => c.key)
      : [];
  const taxCodes = settings.status === 'success' ? settings.data.taxCodes : [];
  const decide = async (approve: boolean) => {
    if (!approve && !note.trim()) return setNoteMissing(true);
    setBusy(true);
    setError(null);
    try {
      await spend.decideExpense(id, approve, approve ? approveNote : note);
      setRejecting(false);
      toast.show(approve ? t('app.spend.expense.approved') : t('app.spend.expense.rejected'), 'success');
      one.reload();
    } catch (e) {
      setRejecting(false);
      setError(spendErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="ghost" className="fw-back" onClick={() => navigate('/spend/expenses')}>
        {t('app.spend.expenses.back')}
      </Button>
      <Load state={one} label="spend expenses">
        {(x) => {
          const linked = owner.status === 'success' ? owner.data?.personId : null;
          const own =
            (!!linked && me.status === 'success' && linked === me.data.personId) ||
            access.employee?.employee.id === x.employeeId;
          const p = policy.status === 'success' ? policy.data.active?.policy : undefined;
          const selfOk = !!p && p.selfApproval && x.amount.amountMinor <= p.selfApprovalMaxMinor;
          const canDecide = can(Permission.SPEND_APPROVE) && x.state === 'PENDING_APPROVAL';
          return (
            <>
              <Card title={x.merchant ?? x.employeeName} data-testid="expense-detail">
                <ExpenseFacts x={x} />
                {x.receiptId && <ReceiptDownload receiptId={x.receiptId} />}
              </Card>
              {canDecide && (
                <Card title={t('app.spend.expense.decide_title')} data-testid="expense-decide">
                  {own && !selfOk ? (
                    <Notice status="info">
                      <span data-testid="expense-four-eyes">{t('app.spend.expense.four_eyes')}</span>
                    </Notice>
                  ) : (
                    <>
                      <Field label={t('app.spend.expense.approve_note')}>
                        <TextArea
                          data-testid="expense-approve-note"
                          maxLength={500}
                          value={approveNote}
                          onChange={(e) => setApproveNote(e.target.value)}
                        />
                      </Field>
                      <div className="fw-actions">
                        <Button data-testid="expense-approve" disabled={busy} onClick={() => decide(true)}>
                          {t('app.spend.expense.approve')}
                        </Button>
                        <Button
                          variant="danger"
                          data-testid="expense-reject"
                          disabled={busy || (own && !selfOk)}
                          onClick={() => setRejecting(true)}
                        >
                          {t('app.spend.expense.reject')}
                        </Button>
                      </div>
                    </>
                  )}
                </Card>
              )}
              {can(Permission.SPEND_MANAGE) && x.state !== 'EXPORTED' && x.state !== 'REJECTED' && (
                <Card title={t('app.spend.expense.recode_title')}>
                  <p className="fw-row__sub">{t('app.spend.expense.recode_text')}</p>
                  <CodingForm
                    key={`${x.id}-${x.category}-${x.taxCode}-${x.note}`}
                    x={x}
                    categories={categories}
                    taxCodes={taxCodes}
                    testId="recode"
                    onSave={async (c) => {
                      setError(null);
                      try {
                        await spend.recode(x.id, c);
                        toast.show(t('app.spend.expense.recoded'), 'success');
                        one.reload();
                      } catch (e) {
                        setError(spendErrorText(e));
                      }
                    }}
                  />
                </Card>
              )}
              {error && (
                <Notice status="failure">
                  <span data-testid="expense-error">{error}</span>
                </Notice>
              )}
              <Modal
                open={rejecting}
                title={t('app.spend.expense.reject_title')}
                onClose={() => setRejecting(false)}
                footer={
                  <>
                    <Button variant="secondary" onClick={() => setRejecting(false)}>
                      {t('app.common.cancel')}
                    </Button>
                    <Button
                      variant="danger"
                      data-testid="expense-reject-confirm"
                      disabled={busy}
                      onClick={() => decide(false)}
                    >
                      {t('app.spend.expense.reject')}
                    </Button>
                  </>
                }
              >
                <Field
                  label={t('app.spend.expense.reject_reason')}
                  error={noteMissing && !note.trim() ? t('app.spend.error.reason_required') : undefined}
                >
                  <TextArea
                    data-testid="expense-reject-note"
                    maxLength={500}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Field>
              </Modal>
            </>
          );
        }}
      </Load>
    </>
  );
}
