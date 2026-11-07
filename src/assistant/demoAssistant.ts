import type { OnGemApi } from '../api/client';
import type { AssistantDraft, AssistantTurn } from '../api/types';
import { formatMinor } from '../lib/format';
import { maskText } from '../recording/mask';
import { IS_AE, REGION_CONFIG } from '../region';

type Reads = Pick<
  OnGemApi,
  'accounts' | 'recipients' | 'payments' | 'cards' | 'tickets' | 'applications' | 'transactions'
>;

/**
 * Demo mode's assistant: the same deterministic intents as ongem-core's stub model, answered from the demo data. Like the
 * real one it only reads and drafts; nothing it does changes the demo's state.
 */
export class DemoAssistant {
  private seq = 0;
  readonly drafts = new Map<string, AssistantDraft>();

  constructor(private readonly api: Reads) {}

  private id(p: string) {
    this.seq += 1;
    return `${p}_demo_${this.seq}`;
  }

  private draft(kind: string, params: Record<string, unknown>, summary: string): AssistantDraft {
    const d: AssistantDraft = { id: this.id('adr'), kind, operations: [], params, summary, state: 'OPEN' };
    this.drafts.set(d.id, d);
    return d;
  }

  async answer(text: string): Promise<AssistantTurn> {
    const t = text.toLowerCase();
    const reads: AssistantTurn['reads'] = [];
    const read = <T>(tool: string, op: string, f: () => Promise<T>) => {
      reads.push({ tool, operationId: op, ok: true });
      return f();
    };
    let reply: string;
    let outcome = 'ANSWERED';
    let draft: AssistantDraft | null = null;
    const amount = /\$?\s?(\d[\d,]*(?:\.\d{1,2})?)/.exec(t);
    const minor = amount ? Math.round(Number(amount[1]!.replace(/,/g, '')) * 100) : 0;
    if (/\breply\b/.test(t) && t.includes('ticket')) {
      // TICKET_REPLY as ongem-core's stub drafts it: the first open ticket and the text after a colon (APP-QUAL-03).
      const ts = await read('list_tickets', 'listTickets', () => this.api.tickets());
      const open = ts.find((x) => x.status !== 'RESOLVED' && x.status !== 'CLOSED');
      const body = maskText((text.includes(':') ? text.slice(text.indexOf(':') + 1) : text).trim());
      draft = this.draft(
        'TICKET_REPLY',
        { ticketId: open?.id, body },
        `Reply to "${open?.subject ?? 'your ticket'}".`,
      );
      reply = `I drafted this for our support team: ${draft.summary} Review it in Support and send it there.`;
      outcome = 'DRAFTED';
    } else if (/\b(human|person|someone|talk to|complain)\b/.test(t)) {
      draft = this.draft(
        'SUPPORT_TICKET',
        { subject: 'Help from the assistant', category: 'OTHER', body: maskText(text) },
        `Open a support ticket for our team: "${maskText(text)}".`,
      );
      reply = `I drafted this for our support team: ${draft.summary} Review it in Support and send it there.`;
      outcome = 'HANDOFF';
    } else if (t.includes('freeze')) {
      const unfreeze = t.includes('unfreeze');
      const cards = (await read('list_cards', 'listCards', () => this.api.cards())).items;
      const c = cards.find((x) => x.state === (unfreeze ? 'FROZEN' : 'ACTIVE'));
      draft = this.draft(
        unfreeze ? 'CARD_UNFREEZE' : 'CARD_FREEZE',
        { cardId: c?.id, last4: c?.last4 },
        `${unfreeze ? 'Unfreeze' : 'Freeze'} the card ending ${c?.last4 ?? 'you choose'}.`,
      );
      reply = `I drafted this for you: ${draft.summary} Review it and confirm it on the screen I open; nothing happens until you do.`;
      outcome = 'DRAFTED';
    } else if (/\b(add|new)\b/.test(t) && /recipient|payee/.test(t)) {
      const name = /(?:named|called)\s+(.+)$/i.exec(text)?.[1]?.trim();
      draft = this.draft(
        'RECIPIENT_ADD',
        { name },
        `Add ${name ?? 'a new recipient'}. ${REGION_CONFIG.recipientDraftHint}`,
      );
      reply = `I drafted this for you: ${draft.summary} Review it and confirm it on the screen I open; nothing happens until you do.`;
      outcome = 'DRAFTED';
    } else if (/\b(send|pay|transfer|move)\b/.test(t) && minor > 0) {
      const accounts = await read('list_accounts', 'listAccounts', () => this.api.accounts());
      const recipients = await read('list_recipients', 'listRecipients', () => this.api.recipients());
      const target =
        /\bto\s+(.+)$/i
          .exec(text)?.[1]
          ?.replace(/[.!?]$/, '')
          .toLowerCase() ?? '';
      const from = accounts[0]!;
      const toAcc = accounts.find(
        (a) =>
          a.id !== from.id &&
          target &&
          (target.includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(target)),
      );
      const shown = formatMinor({ amountMinor: minor, currency: REGION_CONFIG.currency });
      if (toAcc) {
        draft = this.draft(
          'INTERNAL_TRANSFER',
          {
            fromAccountId: from.id,
            toAccountId: toAcc.id,
            amountMinor: minor,
            currency: REGION_CONFIG.currency,
          },
          `Move ${shown} from ${from.name} to ${toAcc.name}.`,
        );
      } else {
        const r = recipients.find(
          (x) => target && (target.includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(target)),
        );
        draft = this.draft(
          'PAYMENT',
          {
            fromAccountId: from.id,
            recipientId: r?.id,
            amountMinor: minor,
            currency: REGION_CONFIG.currency,
          },
          `Send ${shown} by ${REGION_CONFIG.paymentRail(REGION_CONFIG.rails[0]!.rail)} from ${from.name} to ${r?.name ?? 'a recipient you choose'}.`,
        );
      }
      reply = `I drafted this for you: ${draft.summary} Review it and confirm it on the screen I open; nothing happens until you do.`;
      outcome = 'DRAFTED';
    } else if (t.includes('payment')) {
      const page = await read('list_payments', 'listPayments', () => this.api.payments(null, 5));
      reply =
        'Here are your payments:\n' +
        page.items
          .slice(0, 5)
          .map((p) => `- ${formatMinor(p.amount)}: ${p.state}`)
          .join('\n');
    } else if (t.includes('card')) {
      const cards = (await read('list_cards', 'listCards', () => this.api.cards())).items;
      reply =
        'Here are your cards:\n' +
        cards.map((c) => `- Card ending ${c.last4} (${c.holderName}): ${c.state}`).join('\n');
    } else if (/recipient|payee/.test(t)) {
      const rs = await read('list_recipients', 'listRecipients', () => this.api.recipients());
      reply =
        'Here are your recipients:\n' +
        rs
          .map(
            (r) =>
              `- ${r.name} (${IS_AE ? 'IBAN' : 'account'} ending ${r.accountLast4}): screening ${r.screening}`,
          )
          .join('\n');
    } else if (t.includes('ticket')) {
      const ts = await read('list_tickets', 'listTickets', () => this.api.tickets());
      reply = 'Here are your support tickets:\n' + ts.map((x) => `- ${x.subject}: ${x.status}`).join('\n');
    } else if (/application|onboarding/.test(t)) {
      const [app] = await read('list_applications', 'listApplications', () => this.api.applications());
      reply = `Your application is ${app?.state.toLowerCase().replace(/_/g, ' ') ?? 'not started'}.`;
    } else if (/balance|how much|available/.test(t)) {
      const accounts = await read('list_accounts', 'listAccounts', () => this.api.accounts());
      reply =
        'Here are your accounts:\n' +
        accounts
          .map(
            (a) =>
              `- ${a.name} ${REGION_CONFIG.accountMask(a.last4 ?? '')}: ${a.balance ? `${formatMinor(a.balance.available)} available` : 'no balance yet'}`,
          )
          .join('\n');
    } else {
      reply =
        'I can check your balances, payments, recipients, cards, support tickets and your application, and I can draft a payment, ' +
        'a transfer between your accounts, a card freeze, a recipient or a support ticket for you to review and confirm. ' +
        'Nothing changes until you confirm it yourself.';
      outcome = 'UNRESOLVED';
    }
    return {
      id: this.id('atn'),
      seq: this.seq,
      text: maskText(text),
      reply,
      outcome,
      reads,
      draft,
      provider: 'stub',
      model: 'ongem-demo-stub',
      latencyMs: 0,
    };
  }

  decide(id: string, state: 'CONFIRMED' | 'ABANDONED', resultRef?: string): AssistantDraft {
    const d = this.drafts.get(id);
    if (!d || d.state !== 'OPEN') throw new Error('draft_not_open');
    const next = { ...d, state, resultRef: resultRef ?? null };
    this.drafts.set(id, next);
    return next;
  }
}
