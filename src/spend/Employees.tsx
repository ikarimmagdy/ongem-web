import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Permission } from '../api/client';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  KeyValue,
  Modal,
  Notice,
  Select,
  StatusChip,
  useToast,
} from '../design-system';
import { t } from '../i18n';
import { formatDate } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { REGION } from '../region';
import { useSession } from '../session';
import { Amt, FilterChips, Last4, Load } from '../screens/common';
import { EMPLOYEE_STATES, spendOf, type CardBody, type EmployeeView, type TeamView } from './api';
import { fullName, isCode, spendErrorText, spendStatus, stateLabel } from './common';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Employees, newest first, with the invite form; `/spend/employees/:id` opens one with its actions and card. */
export function EmployeesScreen() {
  const { id } = useParams();
  const { api, can } = useSession();
  const spend = spendOf(api);
  const [state, setState] = useState('all');
  const teams = useAsync(() => spend.teams(), [api]);
  const list = useAsync(() => spend.employees(state === 'all' ? {} : { state }), [api, state]);
  const teamList = teams.status === 'success' ? teams.data.filter((x) => x.state === 'ACTIVE') : [];
  if (id) return <EmployeeDetail id={id} teams={teamList} onChanged={list.reload} />;
  const invite = can(Permission.SPEND_MANAGE) && can(Permission.MEMBER_INVITE);
  return (
    <>
      {invite && <InviteEmployee teams={teamList} onDone={list.reload} />}
      <Card title={t('app.spend.employees.title')}>
        <FilterChips
          label={t('app.spend.employees.filter_label')}
          testId="employee-filter"
          value={state}
          onChange={setState}
          options={[
            { id: 'all', label: t('app.spend.filter.all') },
            ...EMPLOYEE_STATES.map((s) => ({ id: s, label: stateLabel(s) })),
          ]}
        />
        <Load state={list} label="spend employees">
          {(people) =>
            people.length === 0 ? (
              <EmptyState title={t('app.spend.employees.empty')}>
                <p>{t('app.spend.employees.empty_text')}</p>
              </EmptyState>
            ) : (
              <ul className="fw-list" data-testid="employee-list">
                {people.map((e) => (
                  <li key={e.id}>
                    <Link
                      className="fw-row"
                      to={`/spend/employees/${encodeURIComponent(e.id)}`}
                      data-testid={`employee-${e.id}`}
                    >
                      <span className="fw-row__main">
                        <strong>{fullName(e)}</strong>
                        <span className="fw-row__sub">
                          {[e.teamName ?? t('app.spend.employees.no_team'), e.emailHint].join(' · ')}
                        </span>
                      </span>
                      {e.card ? (
                        <Last4 value={e.card.last4} />
                      ) : (
                        <span>{t('app.spend.employees.no_card')}</span>
                      )}
                      <StatusChip status={spendStatus(e.state)}>{stateLabel(e.state)}</StatusChip>
                    </Link>
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

function teamOptions(teams: TeamView[]) {
  return [
    { value: '', label: t('app.spend.employees.no_team') },
    ...teams.map((x) => ({ value: x.id, label: x.name })),
  ];
}

/** Creating an employee invites their email with the EMPLOYEE role; the invite email is sent by the core. */
function InviteEmployee({ teams, onDone }: { teams: TeamView[]; onDone(): void }) {
  const { api } = useSession();
  const toast = useToast();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', teamId: '' });
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.firstName.trim() && form.lastName.trim() && EMAIL.test(form.email.trim());
  return (
    <Card title={t('app.spend.employees.invite_title')}>
      <form
        className="fw-thread"
        data-testid="employee-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (!valid) return setInvalid(true);
          setInvalid(false);
          setBusy(true);
          try {
            const created = await spendOf(api).createEmployee({
              firstName: form.firstName.trim(),
              lastName: form.lastName.trim(),
              email: form.email.trim(),
              ...(form.teamId ? { teamId: form.teamId } : {}),
            });
            toast.show(t('app.spend.employees.invited', { name: fullName(created) }), 'success');
            setForm({ firstName: '', lastName: '', email: '', teamId: '' });
            onDone();
          } catch (err) {
            setError(spendErrorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>{t('app.spend.employees.invite_text')}</p>
        <Field
          label={t('app.spend.employees.first_name')}
          error={invalid && !form.firstName.trim() ? t('app.spend.employees.required') : undefined}
        >
          <Input
            data-testid="employee-first"
            value={form.firstName}
            maxLength={80}
            onChange={(e) => set('firstName')(e.target.value)}
          />
        </Field>
        <Field
          label={t('app.spend.employees.last_name')}
          error={invalid && !form.lastName.trim() ? t('app.spend.employees.required') : undefined}
        >
          <Input
            data-testid="employee-last"
            value={form.lastName}
            maxLength={80}
            onChange={(e) => set('lastName')(e.target.value)}
          />
        </Field>
        <Field
          label={t('app.spend.employees.email')}
          error={
            invalid && !EMAIL.test(form.email.trim()) ? t('app.spend.employees.email_invalid') : undefined
          }
        >
          <Input
            data-testid="employee-email"
            type="email"
            autoComplete="off"
            value={form.email}
            onChange={(e) => set('email')(e.target.value)}
          />
        </Field>
        <Field label={t('app.spend.employees.team')}>
          <Select
            data-testid="employee-team"
            value={form.teamId}
            onChange={set('teamId')}
            options={teamOptions(teams)}
          />
        </Field>
        {error && (
          <Notice status="failure">
            <span data-testid="employee-error">{error}</span>
          </Notice>
        )}
        <div className="fw-actions">
          <Button type="submit" data-testid="employee-invite" disabled={busy}>
            {t('app.spend.employees.invite')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function EmployeeDetail({ id, teams, onChanged }: { id: string; teams: TeamView[]; onChanged(): void }) {
  const { api, can } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const spend = spendOf(api);
  const manage = can(Permission.SPEND_MANAGE);
  const one = useAsync(() => spend.employee(id), [api, id]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOffboard, setConfirmOffboard] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const act = async (work: () => Promise<EmployeeView>, message: (e: EmployeeView) => string) => {
    setBusy(true);
    setError(null);
    try {
      const e = await work();
      toast.show(message(e), 'success');
      one.reload();
      onChanged();
    } catch (err) {
      setError(spendErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="ghost" className="fw-back" onClick={() => navigate('/spend/employees')}>
        {t('app.spend.employees.back')}
      </Button>
      <Load state={one} label="spend employees">
        {(e) => {
          const live = e.card && ['ACTIVE', 'FROZEN', 'PENDING'].includes(e.card.state);
          return (
            <>
              <Card title={fullName(e)} data-testid="employee-detail">
                <KeyValue
                  items={[
                    {
                      label: t('app.spend.employees.state'),
                      value: (
                        <StatusChip status={spendStatus(e.state)}>
                          <span data-testid="employee-state">{stateLabel(e.state)}</span>
                        </StatusChip>
                      ),
                    },
                    { label: t('app.spend.employees.email'), value: e.emailHint },
                    {
                      label: t('app.spend.employees.linked'),
                      value: e.linked
                        ? t('app.spend.employees.linked_yes')
                        : t('app.spend.employees.linked_no'),
                    },
                    {
                      label: t('app.spend.limits.per_transaction'),
                      value: e.limits.perTransaction ? (
                        <Amt value={e.limits.perTransaction} />
                      ) : (
                        t('app.spend.limits.none')
                      ),
                    },
                    {
                      label: t('app.spend.limits.monthly'),
                      value: e.limits.monthly ? <Amt value={e.limits.monthly} /> : t('app.spend.limits.none'),
                    },
                    { label: t('app.spend.employees.since'), value: formatDate(e.createdAt) },
                  ]}
                />
                {manage && e.state !== 'OFFBOARDED' && (
                  <Field label={t('app.spend.employees.team')}>
                    <Select
                      data-testid="employee-move"
                      value={e.teamId ?? ''}
                      onChange={(teamId) =>
                        act(
                          () => spend.moveEmployee(e.id, teamId),
                          (x) => t('app.spend.employees.moved', { name: fullName(x) }),
                        )
                      }
                      options={teamOptions(teams)}
                    />
                  </Field>
                )}
                {manage && (
                  <div className="fw-actions">
                    {(e.state === 'ACTIVE' || e.state === 'INVITED') && (
                      <Button
                        variant="secondary"
                        data-testid="employee-suspend"
                        disabled={busy}
                        onClick={() =>
                          act(
                            () => spend.employeeAction(e.id, 'suspend'),
                            (x) => t('app.spend.employees.suspended', { name: fullName(x) }),
                          )
                        }
                      >
                        {t('app.spend.employees.suspend')}
                      </Button>
                    )}
                    {e.state === 'SUSPENDED' && (
                      <Button
                        variant="secondary"
                        data-testid="employee-reactivate"
                        disabled={busy}
                        onClick={() =>
                          act(
                            () => spend.employeeAction(e.id, 'reactivate'),
                            (x) => t('app.spend.employees.reactivated', { name: fullName(x) }),
                          )
                        }
                      >
                        {t('app.spend.employees.reactivate')}
                      </Button>
                    )}
                    {e.state !== 'OFFBOARDED' && (
                      <Button
                        variant="danger"
                        data-testid="employee-offboard"
                        disabled={busy}
                        onClick={() => setConfirmOffboard(true)}
                      >
                        {t('app.spend.employees.offboard')}
                      </Button>
                    )}
                  </div>
                )}
                {e.state === 'OFFBOARDED' && (
                  <p className="fw-row__sub">{t('app.spend.employees.offboarded_note')}</p>
                )}
              </Card>
              <Card title={t('app.spend.card.title')} data-testid="employee-card">
                {e.card ? (
                  <KeyValue
                    items={[
                      { label: t('app.spend.card.number'), value: <Last4 value={e.card.last4} /> },
                      {
                        label: t('app.spend.card.state'),
                        value: (
                          <StatusChip status={spendStatus(e.card.state)}>
                            <span data-testid="employee-card-state">{stateLabel(e.card.state)}</span>
                          </StatusChip>
                        ),
                      },
                      ...(e.card.frozenBy
                        ? [
                            {
                              label: t('app.spend.card.frozen_by'),
                              value: t(`app.spend.card.frozen_by_${e.card.frozenBy.toLowerCase()}`),
                            },
                          ]
                        : []),
                    ]}
                  />
                ) : (
                  <p data-testid="employee-no-card">{t('app.spend.card.none')}</p>
                )}
                {manage && e.card?.state === 'ACTIVE' && (
                  <Button
                    variant="secondary"
                    data-testid="employee-card-freeze"
                    disabled={busy}
                    onClick={() =>
                      act(
                        () => spend.setEmployeeCardFrozen(e.id, true),
                        () => t('app.spend.card.frozen_done'),
                      )
                    }
                  >
                    {t('app.spend.card.freeze')}
                  </Button>
                )}
                {manage && e.card?.state === 'FROZEN' && e.state !== 'OFFBOARDED' && (
                  <Button
                    variant="secondary"
                    data-testid="employee-card-unfreeze"
                    disabled={busy}
                    onClick={() =>
                      act(
                        () => spend.setEmployeeCardFrozen(e.id, false),
                        () => t('app.spend.card.unfrozen_done'),
                      )
                    }
                  >
                    {t('app.spend.card.unfreeze')}
                  </Button>
                )}
                {manage && !live && (e.state === 'ACTIVE' || e.state === 'INVITED') && (
                  <Button data-testid="employee-card-issue" onClick={() => setIssuing(true)}>
                    {t('app.spend.card.issue')}
                  </Button>
                )}
              </Card>
              {error && (
                <Notice status="failure">
                  <span data-testid="employee-error">{error}</span>
                </Notice>
              )}
              <Modal
                open={confirmOffboard}
                title={t('app.spend.employees.offboard_title', { name: fullName(e) })}
                onClose={() => setConfirmOffboard(false)}
                footer={
                  <>
                    <Button variant="secondary" onClick={() => setConfirmOffboard(false)}>
                      {t('app.common.cancel')}
                    </Button>
                    <Button
                      variant="danger"
                      data-testid="employee-offboard-confirm"
                      onClick={() => {
                        setConfirmOffboard(false);
                        void act(
                          () => spend.employeeAction(e.id, 'offboard'),
                          (x) => t('app.spend.employees.offboarded', { name: fullName(x) }),
                        );
                      }}
                    >
                      {t('app.spend.employees.offboard')}
                    </Button>
                  </>
                }
              >
                <p>{t('app.spend.employees.offboard_text')}</p>
              </Modal>
              {issuing && (
                <IssueCard
                  employee={e}
                  onClose={() => setIssuing(false)}
                  onIssued={(x) => {
                    setIssuing(false);
                    toast.show(
                      t('app.spend.card.issued', { name: fullName(x), last4: x.card?.last4 ?? '' }),
                      'success',
                    );
                    one.reload();
                    onChanged();
                  }}
                />
              )}
            </>
          );
        }}
      </Load>
    </>
  );
}

/**
 * Issue a card (step-up): the date of birth and address go to the bank and are never kept here or in the core. One
 * Idempotency-Key per issue, reused when the bank was unavailable and the issue is tried again.
 */
function IssueCard({
  employee,
  onClose,
  onIssued,
}: {
  employee: EmployeeView;
  onClose(): void;
  onIssued(e: EmployeeView): void;
}) {
  const { api } = useSession();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [f, setF] = useState({ dob: '', line1: '', city: '', region: '', postalCode: '', phone: '' });
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const required = ['dob', 'line1', 'city', 'region', 'postalCode'] as const;
  const missing = (k: (typeof required)[number]) => invalid && !f[k].trim();
  const submit = async () => {
    setError(null);
    if (required.some((k) => !f[k].trim())) return setInvalid(true);
    setInvalid(false);
    const body: CardBody = {
      dateOfBirth: f.dob,
      address: {
        line1: f.line1.trim(),
        city: f.city.trim(),
        region: f.region.trim(),
        postalCode: f.postalCode.trim(),
        country: REGION,
      },
      ...(f.phone.trim() ? { phone: f.phone.trim() } : {}),
    };
    setBusy(true);
    try {
      onIssued(await spendOf(api).issueCard(employee.id, body, key));
    } catch (e) {
      const again = isCode(e, 'bank_unavailable');
      setRetry(again);
      if (!again) setKey(crypto.randomUUID());
      setError(spendErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      title={t('app.spend.card.issue_title', { name: fullName(employee) })}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('app.common.cancel')}
          </Button>
          <Button data-testid="card-issue-confirm" disabled={busy} onClick={submit}>
            {retry ? t('app.common.try_again') : t('app.spend.card.issue')}
          </Button>
        </>
      }
    >
      <p>{t('app.spend.card.issue_text')}</p>
      <Field
        label={t('app.spend.card.dob')}
        error={missing('dob') ? t('app.spend.employees.required') : undefined}
      >
        <Input
          data-testid="card-dob"
          type="date"
          autoComplete="off"
          value={f.dob}
          onChange={(e) => set('dob')(e.target.value)}
        />
      </Field>
      <Field
        label={t('app.spend.card.line1')}
        error={missing('line1') ? t('app.spend.employees.required') : undefined}
      >
        <Input
          data-testid="card-line1"
          autoComplete="off"
          value={f.line1}
          onChange={(e) => set('line1')(e.target.value)}
        />
      </Field>
      <Field
        label={t('app.spend.card.city')}
        error={missing('city') ? t('app.spend.employees.required') : undefined}
      >
        <Input
          data-testid="card-city"
          autoComplete="off"
          value={f.city}
          onChange={(e) => set('city')(e.target.value)}
        />
      </Field>
      <Field
        label={t('app.spend.card.region')}
        error={missing('region') ? t('app.spend.employees.required') : undefined}
      >
        <Input
          data-testid="card-region"
          autoComplete="off"
          value={f.region}
          onChange={(e) => set('region')(e.target.value)}
        />
      </Field>
      <Field
        label={t('app.spend.card.postal_code')}
        error={missing('postalCode') ? t('app.spend.employees.required') : undefined}
      >
        <Input
          data-testid="card-postal"
          autoComplete="off"
          value={f.postalCode}
          onChange={(e) => set('postalCode')(e.target.value)}
        />
      </Field>
      <Field label={t('app.spend.card.phone')} hint={t('app.spend.card.phone_hint')}>
        <Input
          data-testid="card-phone"
          type="tel"
          autoComplete="off"
          value={f.phone}
          onChange={(e) => set('phone')(e.target.value)}
        />
      </Field>
      {error && (
        <Notice status="failure">
          <span data-testid="card-issue-error">{error}</span>
        </Notice>
      )}
    </Modal>
  );
}
