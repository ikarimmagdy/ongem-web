import type { Amount, Card, NoticeView, Payment } from '../api/types';

/** The four application steps on Home (OG-035 R5); content keys `app.home.steps.<id>`. */
export const APPLICATION_STEPS = ['sign_in', 'company', 'bank', 'open'] as const;
export type ApplicationStepId = (typeof APPLICATION_STEPS)[number];

const BANK = ['SUBMITTED', 'VERIFYING', 'IN_REVIEW', 'PENDING_BANK', 'REJECTED'];
const OPENING = ['APPROVED', 'PROVISIONING'];

/**
 * The current step (1 to 4) of an application in [state], or null once the account is open. Signing in is always done;
 * everything before the bank has it is About your company.
 */
export function applicationStep(state: string | null | undefined): number | null {
  const s = (state ?? '').toUpperCase();
  if (s === 'ACTIVE') return null;
  if (OPENING.includes(s)) return 4;
  if (BANK.includes(s)) return 3;
  return 2;
}

export type NeedItem =
  | { kind: 'approval'; id: string; amount: Amount; payee: string; to: string }
  | { kind: 'application'; id: string; step: ApplicationStepId; to: string }
  | { kind: 'card'; id: string; state: 'FROZEN' | 'PENDING'; last4: string; to: string }
  | { kind: 'notice'; id: string; title: string; to: string };

export const MAX_APPROVALS = 5;
export const MAX_NOTICES = 3;

/**
 * What waits on this person (OG-035 R3), in order: approvals they may give, the application step left, card alerts,
 * unread notices. A payment OnGem approves (Q-091) is not theirs to approve.
 */
export function needsItems(input: {
  payments: Payment[];
  canApprove: boolean;
  payee(p: Payment): string;
  applicationState?: string | null;
  applicationId?: string | null;
  cards: Card[];
  notices: NoticeView[];
  /** FA-025: the screen a notice's link opens; without it a notice opens the inbox. */
  noticeTo?(link: string | null): string | null;
}): NeedItem[] {
  const out: NeedItem[] = [];
  if (input.canApprove)
    for (const p of input.payments
      .filter((x) => x.state === 'PENDING_APPROVAL' && x.approvalBy !== 'ONGEM')
      .slice(0, MAX_APPROVALS))
      out.push({
        kind: 'approval',
        id: p.id,
        amount: p.amount,
        payee: input.payee(p),
        to: `/payments/${p.id}`,
      });
  if (input.applicationId) {
    const step = applicationStep(input.applicationState);
    if (step !== null)
      out.push({
        kind: 'application',
        id: input.applicationId,
        step: APPLICATION_STEPS[step - 1] ?? 'company',
        to: '/onboarding',
      });
  }
  for (const c of input.cards)
    if (c.state === 'FROZEN' || c.state === 'PENDING')
      out.push({ kind: 'card', id: c.id, state: c.state, last4: c.last4, to: `/cards/${c.id}` });
  // FA-026: a notice about something already listed here (the approval it announces) is not listed twice.
  const listed = new Set(out.map((x) => x.to));
  for (const n of input.notices.filter((x) => !x.readAt)) {
    if (out.filter((x) => x.kind === 'notice').length >= MAX_NOTICES) break;
    const to = input.noticeTo?.(n.link) ?? '/notifications';
    if (listed.has(to)) continue;
    out.push({ kind: 'notice', id: n.id, title: n.title, to });
  }
  return out;
}
