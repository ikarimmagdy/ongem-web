import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, errorText } from '../api/errors';
import type { Status } from '../design-system';
import { has, t } from '../i18n';

/** Every error code of the spend contract, new and reused, with its own sentence `app.spend.error.<code>`. */
export const SPEND_ERROR_CODES = [
  'spend_not_enabled',
  'team_exists',
  'employee_exists',
  'card_exists',
  'team_not_found',
  'employee_not_found',
  'expense_not_found',
  'receipt_not_found',
  'export_not_found',
  'policy_not_found',
  'employee_not_active',
  'policy_invalid',
  'policy_pending',
  'self_approval_forbidden',
  'category_required',
  'receipt_required',
  'receipt_too_large',
  'receipt_type_unsupported',
  'duplicate_receipt',
  'receipt_matched',
  'expense_has_receipt',
  'receipt_employee_mismatch',
  'reason_required',
  'demo_unavailable',
  'forbidden',
  'validation_failed',
  'invalid_transition',
  'account_not_found',
  'account_not_transactable',
  'bank_rejected',
  'bank_unavailable',
  'card_not_found',
  'card_not_active',
  'card_not_frozen',
  'frozen_by_other',
  'period_invalid',
  'format_unavailable',
] as const;

const CODES = new Set<string>(SPEND_ERROR_CODES);

/** The sentence for a failed spend call: the spend wording of its code, else the app's general one. */
export function spendErrorText(e: unknown): string {
  if (e instanceof ApiError && e.code && CODES.has(e.code)) return t(`app.spend.error.${e.code}`);
  return errorText(e);
}

/** Every `problems[].code` of 422 `policy_invalid`, with its own sentence `app.spend.policy.problem.<code>`. */
export const POLICY_PROBLEM_CODES = [
  'malformed',
  'currency_not_programme',
  'receipt_threshold_negative',
  'reminder_hours_out_of_range',
  'self_approval_max_negative',
  'categories_empty',
  'category_duplicate',
  'category_key_invalid',
  'category_ledger_invalid',
  'limit_not_positive',
  'per_transaction_over_ceiling',
  'monthly_over_ceiling',
  'unknown_team',
  'unknown_employee',
] as const;

const PROBLEMS = new Set<string>(POLICY_PROBLEM_CODES);

/** The sentences for a refused policy: one per known problem code, in order and once each; none for other errors. */
export function policyProblemTexts(e: unknown): string[] {
  if (!(e instanceof ApiError) || e.code !== 'policy_invalid') return [];
  const codes = [...new Set((e.problems ?? []).map((p) => p.code).filter((c) => PROBLEMS.has(c)))];
  return codes.map((c) => t(`app.spend.policy.problem.${c}`));
}

/** True when [e] is the API's [code]. */
export const isCode = (e: unknown, code: string) => e instanceof ApiError && e.code === code;

const word = (prefix: string, value: string) => {
  const k = `${prefix}.${value.toLowerCase()}`;
  return has(k) ? t(k) : value;
};

/** A state of the spend contract (programme, team, employee, card, policy version, expense, receipt). */
export const stateLabel = (s: string) => word('app.spend.state', s);
/** A category by key; a key the content does not know shows as the key (the contract's rule). */
export const categoryLabel = (k: string) => word('app.spend.category', k);
export const taxLabel = (c: string) => word('app.spend.tax', c);
export const reasonLabel = (r: string) => word('app.spend.reason', r);
export const receiptLabel = (r: string) => word('app.spend.receipt', r);
export const matchLabel = (r: string) => word('app.spend.match', r);
export const excludedLabel = (r: string) => word('app.spend.export.excluded', r);
export const formatName = (f: string) => word('app.spend.export.format', f);

/** One tone per spend state: green done, amber waiting for someone, red refused, slate paused or closed. */
export function spendStatus(s: string): Status {
  switch (s.toUpperCase()) {
    case 'ACTIVE':
    case 'APPROVED':
    case 'MATCHED':
    case 'ATTACHED':
    case 'NOT_REQUIRED':
      return 'success';
    case 'EXPORTED':
      return 'info';
    case 'REJECTED':
    case 'CANCELLED':
    case 'MISSING':
      return 'failure';
    case 'FROZEN':
    case 'SUSPENDED':
    case 'OFFBOARDED':
    case 'ARCHIVED':
    case 'SUPERSEDED':
    case 'WITHDRAWN':
      return 'neutral';
    default:
      return 'pending';
  }
}

/** Saves a file the API answered, under its own name; the bytes are never kept. */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface SpendTab {
  id: string;
  to: string;
}

/** The spend section's tabs, links like the Payments tabs; the current one is scrolled into view on a phone. */
export function SpendTabs({ tabs, current, label }: { tabs: SpendTab[]; current: string; label: string }) {
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [current]);
  return (
    <nav className="fw-tabs" aria-label={label} data-testid="spend-tabs">
      <ul className="fw-tabs__list" ref={list}>
        {tabs.map((x) => (
          <li key={x.id}>
            <Link
              to={x.to}
              className={`fw-tabs__tab${x.id === current ? ' is-active' : ''}`}
              aria-current={x.id === current ? 'page' : undefined}
              data-testid={`spend-tab-${x.id}`}
            >
              {t(`app.spend.tab.${x.id}`)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A full name from first and last. */
export const fullName = (e: { firstName: string; lastName: string }) => `${e.firstName} ${e.lastName}`;
