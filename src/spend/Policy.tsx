import { useState } from 'react';
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
  StatusChip,
  TextArea,
  useToast,
} from '../design-system';
import { t } from '../i18n';
import { decimalToMinor, formatDate, formatMinor, minorToDecimal } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { Load, PrefixedInput, currencyPrefix } from '../screens/common';
import { spendOf, type LimitsView, type PolicyVersionView, type SpendPolicy, type TeamView } from './api';
import { categoryLabel, isCode, spendErrorText, spendStatus, stateLabel } from './common';

const KEY = /^[a-z][a-z0-9_]{0,31}$/;

const money = (minor: number | null | undefined, currency: string) =>
  minor == null ? t('app.spend.limits.none') : formatMinor({ amountMinor: minor, currency });

const yesNo = (v: boolean) => (v ? t('app.spend.policy.yes') : t('app.spend.policy.no'));

/** The rules of one policy version, as a list a person reads. */
function PolicyRules({ p, teams }: { p: SpendPolicy; teams: TeamView[] }) {
  const teamRules = Object.entries(p.teams);
  return (
    <>
      <KeyValue
        items={[
          {
            label: t('app.spend.policy.receipt_above'),
            value: money(p.receiptRequiredAboveMinor, p.currency),
          },
          {
            label: t('app.spend.limits.per_transaction'),
            value: money(p.perTransactionLimitMinor, p.currency),
          },
          { label: t('app.spend.limits.monthly'), value: money(p.monthlyLimitMinor, p.currency) },
          {
            label: t('app.spend.policy.categories'),
            value: p.categories
              .map((c) =>
                t('app.spend.policy.category_gl', { category: categoryLabel(c.key), gl: c.glAccount }),
              )
              .join(', '),
          },
          { label: t('app.spend.policy.auto_approve'), value: yesNo(p.autoApproveInPolicy) },
          { label: t('app.spend.policy.claims_approval'), value: yesNo(p.claimsNeedApproval) },
          {
            label: t('app.spend.policy.self_approval'),
            value: p.selfApproval
              ? t('app.spend.policy.self_approval_up_to', {
                  amount: money(p.selfApprovalMaxMinor, p.currency),
                })
              : yesNo(false),
          },
          {
            label: t('app.spend.policy.reminder'),
            value: t('app.spend.policy.hours', { hours: p.receiptReminderHours }),
          },
        ]}
      />
      {teamRules.length > 0 && (
        <ul className="fw-list" data-testid="policy-team-rules">
          {teamRules.map(([id, l]) => (
            <li key={id} className="fw-row">
              <span className="fw-row__main">
                <strong>{teams.find((x) => x.id === id)?.name ?? id}</strong>
                <span className="fw-row__sub">
                  {t('app.spend.policy.team_limits', {
                    per: money(l.perTransactionMinor, p.currency),
                    monthly: money(l.monthlyMinor, p.currency),
                  })}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const proposer = (v: PolicyVersionView, me: string | null) =>
  v.proposedBy === me
    ? t('app.spend.policy.by_you')
    : v.proposedBy === 'system'
      ? t('app.spend.policy.by_programme')
      : (v.proposedByName ?? t('app.spend.policy.by_someone'));

/**
 * The policy in force, the proposal waiting and earlier versions. One person proposes (spend:manage), a different person
 * approves or rejects (spend:approve, step-up); the proposer may withdraw. The page says who may decide.
 */
export function PolicyScreen() {
  const { api, can } = useSession();
  const spend = spendOf(api);
  const toast = useToast();
  const overview = useAsync(() => spend.policy(), [api]);
  const settings = useAsync(() => spend.settings(), [api]);
  const teams = useAsync(() => spend.teams(), [api]);
  const me = useAsync(() => api.me(), [api]);
  const personId = me.status === 'success' ? me.data.personId : null;
  const teamList = teams.status === 'success' ? teams.data : [];
  const [proposing, setProposing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async (work: () => Promise<PolicyVersionView>, message: string) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      toast.show(message, 'success');
      overview.reload();
    } catch (e) {
      setError(spendErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Load state={overview} label="spend policy">
      {(o) => {
        const proposal = o.proposed;
        const mine = !!proposal && proposal.proposedBy === personId;
        return (
          <>
            <Card
              title={
                o.active
                  ? t('app.spend.policy.active_title', { version: o.active.version })
                  : t('app.spend.policy.title')
              }
              data-testid="policy-active"
            >
              {o.active ? (
                <>
                  <p className="fw-row__sub">
                    {t('app.spend.policy.in_force_since', {
                      date: formatDate(o.active.decidedAt ?? o.active.createdAt),
                      by: proposer(o.active, personId),
                    })}
                  </p>
                  <PolicyRules p={o.active.policy} teams={teamList} />
                </>
              ) : (
                <EmptyState title={t('app.spend.policy.none')} />
              )}
              {can(Permission.SPEND_MANAGE) && !proposal && o.active && !proposing && (
                <div className="fw-actions">
                  <Button data-testid="policy-propose" onClick={() => setProposing(true)}>
                    {t('app.spend.policy.propose')}
                  </Button>
                </div>
              )}
            </Card>
            {proposing && o.active && settings.status === 'success' && (
              <ProposeForm
                base={o.active.policy}
                ceilings={settings.data.ceilings}
                categories={settings.data.categories}
                teams={teamList.filter((x) => x.state === 'ACTIVE')}
                onCancel={() => setProposing(false)}
                onDone={() => {
                  setProposing(false);
                  toast.show(t('app.spend.policy.proposed_done'), 'success');
                  overview.reload();
                }}
              />
            )}
            {proposal && (
              <Card
                title={t('app.spend.policy.proposed_title', { version: proposal.version })}
                data-testid="policy-proposed"
              >
                <p>
                  {t('app.spend.policy.proposed_by', {
                    by: proposer(proposal, personId),
                    date: formatDate(proposal.createdAt),
                  })}
                </p>
                {proposal.reason && (
                  <p data-testid="policy-reason">
                    {t('app.spend.policy.reason_line', { reason: proposal.reason })}
                  </p>
                )}
                <PolicyRules p={proposal.policy} teams={teamList} />
                <Notice status="info">
                  <span data-testid="policy-four-eyes">
                    {mine ? t('app.spend.policy.four_eyes_mine') : t('app.spend.policy.four_eyes')}
                  </span>
                </Notice>
                <div className="fw-actions">
                  {!mine && can(Permission.SPEND_APPROVE) && (
                    <>
                      <Button
                        data-testid="policy-approve"
                        disabled={busy}
                        onClick={() =>
                          act(
                            () => spend.decidePolicy(proposal.version, true),
                            t('app.spend.policy.approved_done'),
                          )
                        }
                      >
                        {t('app.spend.policy.approve')}
                      </Button>
                      <Button
                        variant="danger"
                        data-testid="policy-reject"
                        disabled={busy}
                        onClick={() => setRejecting(true)}
                      >
                        {t('app.spend.policy.reject')}
                      </Button>
                    </>
                  )}
                  {mine && can(Permission.SPEND_MANAGE) && (
                    <Button
                      variant="secondary"
                      data-testid="policy-withdraw"
                      disabled={busy}
                      onClick={() =>
                        act(
                          () => spend.withdrawPolicy(proposal.version),
                          t('app.spend.policy.withdrawn_done'),
                        )
                      }
                    >
                      {t('app.spend.policy.withdraw')}
                    </Button>
                  )}
                </div>
                {!mine && !can(Permission.SPEND_APPROVE) && (
                  <p className="fw-row__sub" data-testid="policy-no-approve">
                    {t('app.spend.policy.no_approve')}
                  </p>
                )}
              </Card>
            )}
            {error && (
              <Notice status="failure">
                <span data-testid="policy-error">{error}</span>
              </Notice>
            )}
            <Card title={t('app.spend.policy.history')}>
              <ul className="fw-list" data-testid="policy-versions">
                {o.versions.map((v) => (
                  <li key={v.version} className="fw-row">
                    <span className="fw-row__main">
                      <strong>{t('app.spend.policy.version', { version: v.version })}</strong>
                      <span className="fw-row__sub">
                        {t('app.spend.policy.proposed_by', {
                          by: proposer(v, personId),
                          date: formatDate(v.createdAt),
                        })}
                      </span>
                    </span>
                    <StatusChip status={spendStatus(v.state)}>{stateLabel(v.state)}</StatusChip>
                  </li>
                ))}
              </ul>
            </Card>
            {proposal && (
              <Modal
                open={rejecting}
                title={t('app.spend.policy.reject_title', { version: proposal.version })}
                onClose={() => setRejecting(false)}
                footer={
                  <>
                    <Button variant="secondary" onClick={() => setRejecting(false)}>
                      {t('app.common.cancel')}
                    </Button>
                    <Button
                      variant="danger"
                      data-testid="policy-reject-confirm"
                      disabled={busy}
                      onClick={() => {
                        setRejecting(false);
                        void act(
                          () => spend.decidePolicy(proposal.version, false, note),
                          t('app.spend.policy.rejected_done'),
                        );
                      }}
                    >
                      {t('app.spend.policy.reject')}
                    </Button>
                  </>
                }
              >
                <Field label={t('app.spend.policy.reject_note')}>
                  <TextArea
                    data-testid="policy-reject-note"
                    maxLength={500}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Field>
              </Modal>
            )}
          </>
        );
      }}
    </Load>
  );
}

const asText = (minor: number | null | undefined, currency: string) =>
  minor == null ? '' : minorToDecimal({ amountMinor: minor, currency });

type Problems = Partial<Record<string, string>>;

/** Checks a proposal against the programme's ceilings, as ongem-core does, before it is sent. */
export function policyProblems(p: SpendPolicy, ceilings: LimitsView): Problems {
  const out: Problems = {};
  const per = ceilings.perTransaction?.amountMinor;
  const month = ceilings.monthly?.amountMinor;
  const limit = (field: string, v: number | null | undefined, ceiling: number | undefined) => {
    if (v == null) return;
    if (v <= 0) out[field] = t('app.spend.policy.error.positive');
    else if (ceiling != null && v > ceiling)
      out[field] = t('app.spend.policy.error.ceiling', {
        ceiling: formatMinor({ amountMinor: ceiling, currency: p.currency }),
      });
  };
  limit('perTransaction', p.perTransactionLimitMinor, per);
  limit('monthly', p.monthlyLimitMinor, month);
  Object.entries(p.teams).forEach(([id, l]) => {
    limit(`team.${id}.per`, l.perTransactionMinor, per);
    limit(`team.${id}.monthly`, l.monthlyMinor, month);
  });
  if (p.receiptRequiredAboveMinor < 0) out.receipt = t('app.spend.policy.error.not_negative');
  if (!(p.receiptReminderHours >= 1 && p.receiptReminderHours <= 720))
    out.reminder = t('app.spend.policy.error.reminder');
  if (p.selfApproval && p.selfApprovalMaxMinor < 0) out.selfMax = t('app.spend.policy.error.not_negative');
  if (!p.categories.length) out.categories = t('app.spend.policy.error.categories');
  else if (new Set(p.categories.map((c) => c.key)).size !== p.categories.length)
    out.categories = t('app.spend.policy.error.duplicate');
  else if (p.categories.some((c) => !KEY.test(c.key) || !c.glAccount.trim() || c.glAccount.length > 32))
    out.categories = t('app.spend.policy.error.category_rule');
  return out;
}

function ProposeForm({
  base,
  ceilings,
  categories: catalogue,
  teams,
  onCancel,
  onDone,
}: {
  base: SpendPolicy;
  ceilings: LimitsView;
  categories: string[];
  teams: TeamView[];
  onCancel(): void;
  onDone(): void;
}) {
  const { api } = useSession();
  const cur = base.currency;
  const [receipt, setReceipt] = useState(asText(base.receiptRequiredAboveMinor, cur));
  const [per, setPer] = useState(asText(base.perTransactionLimitMinor, cur));
  const [month, setMonth] = useState(asText(base.monthlyLimitMinor, cur));
  const [cats, setCats] = useState(base.categories.map((c) => ({ ...c })));
  const [auto, setAuto] = useState(base.autoApproveInPolicy);
  const [claims, setClaims] = useState(base.claimsNeedApproval);
  const [self, setSelf] = useState(base.selfApproval);
  const [selfMax, setSelfMax] = useState(asText(base.selfApprovalMaxMinor, cur));
  const [reminder, setReminder] = useState(String(base.receiptReminderHours));
  const [teamLimits, setTeamLimits] = useState<Record<string, { per: string; monthly: string }>>(() =>
    Object.fromEntries(
      teams.map((x) => [
        x.id,
        {
          per: asText(base.teams[x.id]?.perTransactionMinor, cur),
          monthly: asText(base.teams[x.id]?.monthlyMinor, cur),
        },
      ]),
    ),
  );
  const [reason, setReason] = useState('');
  const [problems, setProblems] = useState<Problems>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const minor = (s: string) => (s.trim() ? decimalToMinor(s.trim(), cur) : null);

  const build = (): SpendPolicy | null => {
    const parsed = { receipt: minor(receipt), per: minor(per), month: minor(month), selfMax: minor(selfMax) };
    const bad: Problems = {};
    if (receipt.trim() === '' || parsed.receipt === null) bad.receipt = t('app.spend.policy.error.amount');
    if (per.trim() && parsed.per === null) bad.perTransaction = t('app.spend.policy.error.amount');
    if (month.trim() && parsed.month === null) bad.monthly = t('app.spend.policy.error.amount');
    if (self && selfMax.trim() && parsed.selfMax === null) bad.selfMax = t('app.spend.policy.error.amount');
    const teamRules: SpendPolicy['teams'] = {};
    for (const [id, l] of Object.entries(teamLimits)) {
      const p = minor(l.per);
      const m = minor(l.monthly);
      if (l.per.trim() && p === null) bad[`team.${id}.per`] = t('app.spend.policy.error.amount');
      if (l.monthly.trim() && m === null) bad[`team.${id}.monthly`] = t('app.spend.policy.error.amount');
      if (p != null || m != null) teamRules[id] = { perTransactionMinor: p, monthlyMinor: m };
    }
    const policy: SpendPolicy = {
      ...base,
      receiptRequiredAboveMinor: parsed.receipt ?? 0,
      perTransactionLimitMinor: parsed.per,
      monthlyLimitMinor: parsed.month,
      categories: cats.map((c) => ({ key: c.key.trim(), glAccount: c.glAccount.trim() })),
      autoApproveInPolicy: auto,
      claimsNeedApproval: claims,
      selfApproval: self,
      selfApprovalMaxMinor: self ? (parsed.selfMax ?? 0) : 0,
      receiptReminderHours: /^\d+$/.test(reminder.trim()) ? Number(reminder.trim()) : 0,
      teams: teamRules,
    };
    const all = { ...policyProblems(policy, ceilings), ...bad };
    setProblems(all);
    return Object.keys(all).length ? null : policy;
  };

  const ceilingHint = (c?: { amountMinor: number; currency: string } | null) =>
    c ? t('app.spend.policy.ceiling_hint', { ceiling: formatMinor(c) }) : undefined;

  return (
    <Card title={t('app.spend.policy.propose_title')} data-testid="policy-form">
      <form
        className="fw-thread"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const policy = build();
          if (!policy) return;
          setBusy(true);
          try {
            await spendOf(api).proposePolicy(policy, reason);
            onDone();
          } catch (err) {
            setError(
              isCode(err, 'policy_invalid') ? t('app.spend.error.policy_invalid') : spendErrorText(err),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>{t('app.spend.policy.propose_text')}</p>
        <Field label={t('app.spend.policy.receipt_above')} error={problems.receipt}>
          <PrefixedInput
            prefix={currencyPrefix()}
            data-testid="policy-receipt"
            inputMode="decimal"
            value={receipt}
            onChange={(e) => setReceipt(e.target.value)}
          />
        </Field>
        <Field
          label={t('app.spend.limits.per_transaction')}
          hint={ceilingHint(ceilings.perTransaction)}
          error={problems.perTransaction}
        >
          <PrefixedInput
            prefix={currencyPrefix()}
            data-testid="policy-per"
            inputMode="decimal"
            value={per}
            onChange={(e) => setPer(e.target.value)}
          />
        </Field>
        <Field
          label={t('app.spend.limits.monthly')}
          hint={ceilingHint(ceilings.monthly)}
          error={problems.monthly}
        >
          <PrefixedInput
            prefix={currencyPrefix()}
            data-testid="policy-monthly"
            inputMode="decimal"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </Field>
        <fieldset className="fw-fieldset">
          <legend>{t('app.spend.policy.categories')}</legend>
          {cats.map((c, i) => (
            <div className="fw-actions" key={i}>
              <Field
                label={t('app.spend.policy.category_key')}
                hint={catalogue.includes(c.key) ? categoryLabel(c.key) : undefined}
              >
                <Input
                  data-testid={`policy-cat-key-${i}`}
                  value={c.key}
                  maxLength={32}
                  onChange={(e) =>
                    setCats((xs) => xs.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))
                  }
                />
              </Field>
              <Field label={t('app.spend.policy.gl_account')}>
                <Input
                  data-testid={`policy-cat-gl-${i}`}
                  value={c.glAccount}
                  maxLength={32}
                  onChange={(e) =>
                    setCats((xs) => xs.map((x, j) => (j === i ? { ...x, glAccount: e.target.value } : x)))
                  }
                />
              </Field>
              <Button
                size="sm"
                variant="ghost"
                data-testid={`policy-cat-remove-${i}`}
                onClick={() => setCats((xs) => xs.filter((_, j) => j !== i))}
              >
                {t('app.spend.policy.remove_category')}
              </Button>
            </div>
          ))}
          {problems.categories && (
            <Notice status="failure">
              <span data-testid="policy-cat-error">{problems.categories}</span>
            </Notice>
          )}
          <Button
            size="sm"
            variant="secondary"
            data-testid="policy-cat-add"
            onClick={() => setCats((xs) => [...xs, { key: '', glAccount: '' }])}
          >
            {t('app.spend.policy.add_category')}
          </Button>
        </fieldset>
        <label className="fw-consent__accept">
          <input
            type="checkbox"
            data-testid="policy-auto"
            checked={auto}
            onChange={(e) => setAuto(e.target.checked)}
          />
          <span>{t('app.spend.policy.auto_approve')}</span>
        </label>
        <label className="fw-consent__accept">
          <input
            type="checkbox"
            data-testid="policy-claims"
            checked={claims}
            onChange={(e) => setClaims(e.target.checked)}
          />
          <span>{t('app.spend.policy.claims_approval')}</span>
        </label>
        <label className="fw-consent__accept">
          <input
            type="checkbox"
            data-testid="policy-self"
            checked={self}
            onChange={(e) => setSelf(e.target.checked)}
          />
          <span>{t('app.spend.policy.self_approval')}</span>
        </label>
        {self && (
          <Field label={t('app.spend.policy.self_max')} error={problems.selfMax}>
            <PrefixedInput
              prefix={currencyPrefix()}
              data-testid="policy-self-max"
              inputMode="decimal"
              value={selfMax}
              onChange={(e) => setSelfMax(e.target.value)}
            />
          </Field>
        )}
        <Field
          label={t('app.spend.policy.reminder')}
          hint={t('app.spend.policy.reminder_hint')}
          error={problems.reminder}
        >
          <Input
            data-testid="policy-reminder"
            inputMode="numeric"
            value={reminder}
            onChange={(e) => setReminder(e.target.value.replace(/\D/g, ''))}
          />
        </Field>
        {teams.length > 0 && (
          <fieldset className="fw-fieldset">
            <legend>{t('app.spend.policy.team_limits_title')}</legend>
            {teams.map((x) => (
              <div className="fw-actions" key={x.id}>
                <Field
                  label={t('app.spend.policy.team_per', { team: x.name })}
                  error={problems[`team.${x.id}.per`]}
                >
                  <PrefixedInput
                    prefix={currencyPrefix()}
                    data-testid={`policy-team-per-${x.id}`}
                    inputMode="decimal"
                    value={teamLimits[x.id]?.per ?? ''}
                    onChange={(e) =>
                      setTeamLimits((l) => ({
                        ...l,
                        [x.id]: { per: e.target.value, monthly: l[x.id]?.monthly ?? '' },
                      }))
                    }
                  />
                </Field>
                <Field
                  label={t('app.spend.policy.team_monthly', { team: x.name })}
                  error={problems[`team.${x.id}.monthly`]}
                >
                  <PrefixedInput
                    prefix={currencyPrefix()}
                    data-testid={`policy-team-monthly-${x.id}`}
                    inputMode="decimal"
                    value={teamLimits[x.id]?.monthly ?? ''}
                    onChange={(e) =>
                      setTeamLimits((l) => ({
                        ...l,
                        [x.id]: { per: l[x.id]?.per ?? '', monthly: e.target.value },
                      }))
                    }
                  />
                </Field>
              </div>
            ))}
          </fieldset>
        )}
        <Field label={t('app.spend.policy.reason')}>
          <TextArea
            data-testid="policy-reason-input"
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        {error && (
          <Notice status="failure">
            <span data-testid="policy-form-error">{error}</span>
          </Notice>
        )}
        <div className="fw-actions">
          <Button type="submit" data-testid="policy-submit" disabled={busy}>
            {t('app.spend.policy.submit')}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            {t('app.common.cancel')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
