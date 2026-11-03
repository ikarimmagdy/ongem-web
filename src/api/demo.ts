import { permissionsOf, Permission, type OnGemApi } from './client';
import {
  OPS,
  demoAccounts,
  demoApplication,
  demoCards,
  demoDisclosures,
  demoMe,
  demoPayments,
  demoRecipients,
  demoStatement,
  demoStatements,
  demoTickets,
  demoTransactions,
  disclosureBody,
  usd,
} from './demoData';
import { DemoAssistant } from '../assistant/demoAssistant';
import { ApiError } from './errors';
import { REVERIFICATION_CANCELLED } from './reverify';
import type {
  Account,
  RecordedEvent,
  Application,
  Card,
  CardWidgetKind,
  CardWidgetSession,
  CreatePayment,
  CreateRecipient,
  Me,
  OpenTicket,
  OwnerIdentity,
  Payment,
  TicketDetail,
} from './types';

export interface DemoOptions {
  me?: Me;
  /** Step-up in demo mode: the same dialog as live, any six digits; false when cancelled. */
  stepUp?: (purpose: string) => Promise<boolean>;
  now?: () => string;
  /** The company picked in the switcher (G-69); null is the person's default. */
  companyId?: string | null;
}

/**
 * Demo mode (OG-030): ongem-app's DemoOnGemApi in TypeScript. Sample data that follows ongem-core's shapes, roles and
 * step-up; nothing leaves the browser and nothing is stored.
 */
export class DemoOnGemApi implements OnGemApi {
  readonly kind = 'demo' as const;
  private accountsState: Account[] = demoAccounts();
  private recipientsState = demoRecipients();
  private paymentsState: Payment[] = demoPayments();
  private cardsState: Card[] = demoCards();
  private applicationState: Application = demoApplication();
  private disclosuresState = demoDisclosures();
  private ticketsState: TicketDetail[] = demoTickets();
  private seq = 0;
  readonly stepUps: string[] = [];
  /** Demo recording stays in memory: events are masked but never leave the browser. */
  readonly recorded: RecordedEvent[] = [];
  readonly assistant = new DemoAssistant(this);
  /** Every call the screens made, for the tests. */
  readonly calls: string[] = [];
  private readonly me_: Me;
  private readonly now: () => string;

  constructor(private readonly opts: DemoOptions = {}) {
    const me = opts.me ?? demoMe;
    this.me_ = opts.companyId ? { ...me, companyId: opts.companyId } : me;
    this.now = opts.now ?? (() => '2026-10-29T15:00:00Z');
  }

  private next(prefix: string) {
    this.seq += 1;
    return `${prefix}_demo_new_${this.seq}`;
  }

  private get role() {
    const m = this.me_.memberships;
    return (m.find((x) => x.companyId === this.me_.companyId) ?? m[0])?.role ?? 'VIEWER';
  }

  private require(permission: string) {
    if (!permissionsOf(this.role).has(permission))
      throw new ApiError(403, 'forbidden', 'Your role does not allow this.');
  }

  private async stepUp(purpose: string) {
    this.stepUps.push(purpose);
    if (!this.opts.stepUp) return;
    if (!(await this.opts.stepUp(purpose))) {
      throw new ApiError(
        403,
        REVERIFICATION_CANCELLED,
        'You did not confirm it is you, so nothing was changed.',
      );
    }
  }

  private notFound(what: string): never {
    throw new ApiError(404, `${what}_not_found`);
  }

  private log<T>(name: string, v: T): Promise<T> {
    this.calls.push(name);
    return Promise.resolve(structuredClone(v));
  }

  get companyId(): string | null {
    return this.opts.companyId ?? null;
  }

  /** A fresh demo client for another company of the person: the sample data starts again, nothing is carried over. */
  forCompany(companyId: string | null): DemoOnGemApi {
    return new DemoOnGemApi({ ...this.opts, companyId });
  }

  me = async () => this.log('me', this.me_);
  accounts = async () => this.log('accounts', this.accountsState);

  account = async (id: string) =>
    this.log('account', this.accountsState.find((a) => a.id === id) ?? this.notFound('account'));

  transactions = async (accountId: string, limit: number) => {
    await this.account(accountId);
    const today = this.paymentsState
      .filter((p) => p.createdAt === this.now() && p.state !== 'DRAFT')
      .flatMap((p) => [
        ...(p.fromAccountId === accountId
          ? [
              {
                id: `txn_${p.id}`,
                stage: 'PENDING',
                direction: 'DEBIT',
                amount: p.amount,
                rail: p.rail,
                origin: 'ONGEM',
                effectiveDate: '2026-10-29',
              },
            ]
          : []),
        ...(p.toAccountId === accountId
          ? [
              {
                id: `txn_${p.id}_in`,
                stage: 'POSTED',
                direction: 'CREDIT',
                amount: p.amount,
                rail: p.rail,
                origin: 'ONGEM',
                effectiveDate: '2026-10-29',
              },
            ]
          : []),
      ]);
    return this.log(
      'transactions',
      [...today, ...(demoTransactions[accountId] ?? [])].slice(0, Math.min(100, Math.max(1, limit))),
    );
  };

  statements = async (accountId: string) => {
    await this.account(accountId);
    return this.log('statements', demoStatements);
  };

  statement = async (accountId: string, period: string) => {
    await this.account(accountId);
    if (!demoStatements.some((s) => s.period === period)) this.notFound('statement');
    return this.log('statement', demoStatement(accountId, period));
  };

  recipients = async () =>
    this.log(
      'recipients',
      this.recipientsState.filter((r) => r.status === 'ACTIVE'),
    );

  createRecipient = async (r: CreateRecipient) => {
    this.require(Permission.RECIPIENT_MANAGE);
    await this.stepUp('recipient');
    const created = {
      id: this.next('rcp'),
      kind: r.kind,
      name: r.name.trim(),
      accountLast4: r.accountNumber.slice(-4),
      routingNumber: r.routingNumber,
      accountType: r.accountType,
      screening: 'PENDING',
      status: 'ACTIVE',
      createdAt: this.now(),
    };
    this.recipientsState = [...this.recipientsState, created];
    return this.log('createRecipient', created);
  };

  archiveRecipient = async (id: string) => {
    this.require(Permission.RECIPIENT_MANAGE);
    const r = this.recipientsState.find((x) => x.id === id) ?? this.notFound('recipient');
    const archived = { ...r, status: 'ARCHIVED' };
    this.recipientsState = this.recipientsState.map((x) => (x.id === id ? archived : x));
    return this.log('archiveRecipient', archived);
  };

  payments = async (cursor?: string | null, limit = 20) => {
    const all = [...this.paymentsState].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    const start = cursor ? Number(cursor) : 0;
    const next = start + limit < all.length ? String(start + limit) : null;
    return this.log('payments', { items: all.slice(start, start + limit), next });
  };

  payment = async (id: string) =>
    this.log('payment', this.paymentsState.find((p) => p.id === id) ?? this.notFound('payment'));

  createPayment = async (r: CreatePayment) => {
    this.require(Permission.PAYMENT_CREATE);
    await this.account(r.fromAccountId);
    if (r.amountMinor <= 0)
      throw new ApiError(422, 'validation_failed', 'The amount must be more than zero.');
    if (r.recipientId && !this.recipientsState.some((x) => x.id === r.recipientId))
      this.notFound('recipient');
    const p: Payment = {
      id: this.next('pay'),
      state: 'DRAFT',
      rail: r.rail,
      achTiming: r.achTiming,
      amount: usd(r.amountMinor),
      fromAccountId: r.fromAccountId,
      recipientId: r.recipientId,
      toAccountId: r.toAccountId,
      reference: r.reference,
      createdAt: this.now(),
      timeline: [{ from: null, to: 'DRAFT', at: this.now() }],
    };
    this.paymentsState = [p, ...this.paymentsState];
    return this.log('createPayment', p);
  };

  sendPayment = async (id: string) => {
    this.require(Permission.PAYMENT_CREATE);
    const p = this.paymentsState.find((x) => x.id === id) ?? this.notFound('payment');
    await this.stepUp('payment');
    const from = this.accountsState.find((a) => a.id === p.fromAccountId);
    if ((from?.balance?.available.amountMinor ?? 0) < p.amount.amountMinor) {
      throw new ApiError(409, 'insufficient_funds', 'The available balance does not cover this payment.');
    }
    const internal = Boolean(p.toAccountId);
    const state = internal ? 'SETTLED' : 'SUBMITTED';
    const sent: Payment = {
      ...p,
      state,
      providerReference: internal ? null : `ach_${p.id.slice(-6)}`,
      timeline: [
        ...p.timeline,
        { from: 'DRAFT', to: 'PRECHECKED', at: this.now() },
        { from: 'PRECHECKED', to: state, at: this.now() },
      ],
    };
    this.paymentsState = this.paymentsState.map((x) => (x.id === id ? sent : x));
    this.accountsState = this.accountsState.map((a) => {
      const delta =
        a.id === p.fromAccountId ? -p.amount.amountMinor : a.id === p.toAccountId ? p.amount.amountMinor : 0;
      if (!delta || !a.balance) return a;
      const posted = internal ? a.balance.posted.amountMinor + delta : a.balance.posted.amountMinor;
      return {
        ...a,
        balance: {
          ...a.balance,
          posted: usd(posted),
          available: usd(a.balance.available.amountMinor + delta),
        },
      };
    });
    return this.log('sendPayment', sent);
  };

  cards = async () => {
    this.require(Permission.CARD_MANAGE);
    return this.log('cards', { items: this.cardsState, next: null });
  };

  card = async (id: string) => {
    this.require(Permission.CARD_MANAGE);
    return this.log('card', this.cardsState.find((c) => c.id === id) ?? this.notFound('card'));
  };

  setCardFrozen = async (id: string, frozen: boolean) => {
    this.require(Permission.CARD_MANAGE);
    const c = this.cardsState.find((x) => x.id === id) ?? this.notFound('card');
    if (frozen && c.state !== 'ACTIVE')
      throw new ApiError(409, 'card_not_active', 'Only an active card can be frozen.');
    if (!frozen && c.state !== 'FROZEN')
      throw new ApiError(409, 'card_not_frozen', 'The card is not frozen.');
    await this.stepUp('card');
    const changed = { ...c, state: frozen ? 'FROZEN' : 'ACTIVE', updatedAt: this.now() };
    this.cardsState = this.cardsState.map((x) => (x.id === id ? changed : x));
    return this.log('setCardFrozen', changed);
  };

  /** The simulator's widget: no bank script, so the screen draws sample data (never a real card number). */
  cardWidget = async (id: string, kind: CardWidgetKind): Promise<CardWidgetSession> => {
    this.require(Permission.CARD_MANAGE);
    const c = this.cardsState.find((x) => x.id === id) ?? this.notFound('card');
    const ok = kind === 'ACTIVATE' ? c.state === 'PENDING' : c.state === 'ACTIVE' || c.state === 'FROZEN';
    if (!ok) throw new ApiError(409, 'card_not_active', "This card's details are not available.");
    await this.stepUp('card_details');
    return this.log('cardWidget', {
      cardId: id,
      kind,
      token: `demo-widget-${id}`,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      environment: 'simulator',
      scriptUrl: null,
      element: null,
      last4: c.last4,
    });
  };

  private static progress = ['SUBMITTED', 'VERIFYING', 'MORE_INFO', 'IN_REVIEW', 'APPROVED', 'ACTIVE'];

  /** Each read after submit moves the demo application one step toward the bank's decision. */
  private advance(): Application {
    const i = DemoOnGemApi.progress.indexOf(this.applicationState.state);
    if (i >= 0 && i < DemoOnGemApi.progress.length - 1) {
      this.applicationState = { ...this.applicationState, state: DemoOnGemApi.progress[i + 1]! };
    }
    return this.applicationState;
  }

  applications = async () => this.log('applications', [this.advance()]);

  application = async (id: string) => {
    if (id !== this.applicationState.id) this.notFound('application');
    return this.log('application', this.advance());
  };

  putOwnerIdentity = async (appId: string, ownerId: string, identity: OwnerIdentity) => {
    this.require(Permission.ONBOARDING_MANAGE);
    const app = this.applicationState;
    if (app.id !== appId) this.notFound('application');
    const digits = identity.number.replace(/\D/g, '');
    if (digits.length !== 9) throw new ApiError(422, 'validation_failed', 'An SSN has 9 digits.');
    const owner = app.owners.find((o) => o.id === ownerId) ?? this.notFound('owner');
    const updated = {
      ...owner,
      idType: identity.idType,
      idLast4: digits.slice(-4),
      idCountry: identity.country,
    };
    this.applicationState = {
      ...app,
      owners: app.owners.map((o) => (o.id === ownerId ? updated : o)),
      requirements: app.requirements.filter((r) => r !== `owner_id_missing:${ownerId}`),
    };
    return this.log('putOwnerIdentity', updated);
  };

  confirmApplication = async (id: string) => {
    const app = this.applicationState;
    if (id !== app.id) this.notFound('application');
    if (app.requirements.length)
      throw new ApiError(409, 'requirements_incomplete', "An owner's ID is missing.");
    if (app.state !== 'COLLECTING') throw new ApiError(409, 'invalid_state');
    this.applicationState = {
      ...app,
      state: 'READY_FOR_DISCLOSURES',
      owners: app.owners.map((o) => ({ ...o, atBank: true })),
    };
    return this.log('confirmApplication', this.applicationState);
  };

  submitApplication = async (id: string) => {
    const app = this.applicationState;
    if (id !== app.id) this.notFound('application');
    if (this.disclosuresState.some((d) => !d.acknowledged))
      throw new ApiError(409, 'disclosure_not_accepted', 'Accept every disclosure first.');
    if (app.state !== 'READY_FOR_DISCLOSURES') throw new ApiError(409, 'invalid_state');
    this.applicationState = { ...app, state: 'SUBMITTED' };
    return this.log('submitApplication', this.applicationState);
  };

  requiredDisclosures = async () => this.log('requiredDisclosures', this.disclosuresState);

  disclosureText = async (versionId: string) => {
    const d = this.disclosuresState.find((x) => x.versionId === versionId) ?? this.notFound('disclosure');
    return this.log('disclosureText', {
      versionId,
      type: d.type,
      version: d.version,
      title: d.title,
      text: disclosureBody(d.title),
    });
  };

  recordDisclosure = async (versionId: string, kind: string) => {
    this.require(Permission.ONBOARDING_MANAGE);
    if (!this.disclosuresState.some((d) => d.versionId === versionId)) this.notFound('disclosure');
    if (kind === 'ACKNOWLEDGED') {
      this.disclosuresState = this.disclosuresState.map((d) =>
        d.versionId === versionId ? { ...d, acknowledged: true, recorded: true } : d,
      );
    }
    return this.log('recordDisclosure', { id: this.next('dse'), versionId, kind, syncState: 'SYNCED' });
  };

  tickets = async () =>
    this.log(
      'tickets',
      this.ticketsState.map((t) => t.ticket).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );

  ticket = async (id: string) =>
    this.log('ticket', this.ticketsState.find((t) => t.ticket.id === id) ?? this.notFound('ticket'));

  private update(id: string, change: (t: TicketDetail) => TicketDetail) {
    let out: TicketDetail | undefined;
    this.ticketsState = this.ticketsState.map((t) => (t.ticket.id === id ? (out = change(t)) : t));
    return out ?? this.notFound('ticket');
  }

  private get displayName() {
    return [this.me_.legalFirstName, this.me_.legalLastName].filter(Boolean).join(' ') || 'Company member';
  }

  openTicket = async (r: OpenTicket) => {
    if (!r.subject.trim() || !r.body.trim())
      throw new ApiError(422, 'validation_failed', 'A subject and a message are needed.');
    const t: TicketDetail = {
      ticket: {
        id: this.next('tkt'),
        subject: r.subject.trim(),
        category: r.category,
        status: 'RECEIVED',
        openedByName: this.displayName,
        createdAt: this.now(),
        updatedAt: this.now(),
      },
      messages: [
        {
          id: this.next('msg'),
          authorKind: 'MEMBER',
          authorName: this.displayName,
          body: r.body.trim(),
          at: this.now(),
        },
      ],
      attachments: [],
    };
    this.ticketsState = [t, ...this.ticketsState];
    return this.log('openTicket', t);
  };

  replyToTicket = async (id: string, body: string) =>
    this.log(
      'replyToTicket',
      this.update(id, (t) => ({
        ...t,
        ticket: { ...t.ticket, status: 'IN_REVIEW', updatedAt: this.now() },
        messages: [
          ...t.messages,
          {
            id: this.next('msg'),
            authorKind: 'MEMBER',
            authorName: this.displayName,
            body: body.trim(),
            at: this.now(),
          },
        ],
      })),
    );

  attachToTicket = async (id: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) throw new ApiError(422, 'file_too_large', 'Files can be up to 10 MB.');
    return this.log(
      'attachToTicket',
      this.update(id, (t) => ({
        ...t,
        ticket: { ...t.ticket, updatedAt: this.now() },
        attachments: [
          ...t.attachments,
          {
            id: this.next('att'),
            name: file.name,
            contentType: file.type || 'application/octet-stream',
            size: file.size,
            at: this.now(),
          },
        ],
      })),
    );
  };

  startConversation = async (channel: string) =>
    this.log('startConversation', { id: this.next('acv'), channel, startedAt: this.now(), turns: [] });

  sendAssistantMessage = async (_id: string, text: string) => {
    this.calls.push('sendAssistantMessage');
    return this.assistant.answer(text);
  };

  rateAssistantTurn = async (id: string, rating: 'UP' | 'DOWN') =>
    this.log('rateAssistantTurn', {
      id,
      seq: 0,
      text: '',
      reply: '',
      outcome: 'ANSWERED',
      reads: [],
      provider: 'stub',
      model: 'ongem-demo-stub',
      latencyMs: 0,
      rating,
    });

  confirmAssistantDraft = async (id: string, resultRef: string) =>
    this.log('confirmAssistantDraft', this.assistant.decide(id, 'CONFIRMED', resultRef));

  abandonAssistantDraft = async (id: string) =>
    this.log('abandonAssistantDraft', this.assistant.decide(id, 'ABANDONED'));

  startRecording = async (platform: string) => this.log('startRecording', { id: this.next('rss'), platform });

  recordEvents = async (_id: string, events: RecordedEvent[]) => {
    this.recorded.push(...events);
    return { stored: events.length };
  };
}

export const DEMO_DEFAULT_ACCOUNT = OPS;
