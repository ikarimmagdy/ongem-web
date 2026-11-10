import { invitableRoles, permissionsOf, Permission, type OnGemApi } from './client';
import {
  OPS,
  demoAccounts,
  demoApplication,
  demoCards,
  demoDisclosures,
  demoFundingSources,
  demoMe,
  demoPayments,
  demoRecipients,
  demoStatement,
  demoStatements,
  demoTickets,
  demoTransactions,
  disclosureBody,
  money,
  demoNotices,
  demoPreferences,
  demoInviteCompany,
} from './demoData';
import { DemoAssistant } from '../assistant/demoAssistant';
import { ApiError } from './errors';
import { t } from '../i18n/store';
import { normaliseIban, uaeIbanValid } from '../lib/iban';
import { nthRun } from '../lib/schedule';
import { IS_AE, REGION, REGION_CONFIG } from '../region';
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
  CreateTopUp,
  CreateSchedule,
  FundingSource,
  PaymentSchedule,
  IdCapture,
  LinkFundingSource,
  IdDocument,
  InviteView,
  Me,
  OpenTicket,
  OwnerIdentity,
  Payment,
  TicketDetail,
  NoticeView,
  NotificationPreferences,
  PreferenceChange,
} from './types';

export interface DemoOptions {
  me?: Me;
  /** Step-up in demo mode: the same dialog as live, any six digits; false when cancelled. */
  stepUp?: (purpose: string) => Promise<boolean>;
  now?: () => string;
  /** The company picked in the switcher (G-69); null is the person's default. */
  companyId?: string | null;
  /** The application to start from (tests); the sample one otherwise. */
  application?: Application;
  /** Who approves a new top-up (Q-091): ONGEM shows a one-person company (`/sign-in?demo=solo`). */
  approvalBy?: 'COMPANY' | 'ONGEM';
  /** OG-023 R12: the region this demo client stands for (the build's region by default). */
  region?: string;
  /** The person as another region's API answers them, or 'down' when that region does not answer (tests). */
  regions?: Partial<Record<string, Me | 'down'>>;
}

/** A demo account of a company other than the person's default carries the company in its id, so ids never clash. */
const COMPANY_SUFFIX = /_(cmp_[A-Za-z0-9_]+)$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Submitted and not yet decided: the bank may still ask for an ID document (ongem-core FounderDocv.OPEN). */
const CAPTURE_OPEN = ['SUBMITTED', 'VERIFYING', 'MORE_INFO', 'IN_REVIEW', 'EDD', 'PENDING_BANK'];

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
  private applicationState: Application;
  private captures: IdCapture[] = [];
  private fundingState: FundingSource[] = demoFundingSources();
  private schedulesState: PaymentSchedule[] = [];
  /** A schedule's next occurrence (from 0), as ongem-core keeps it. */
  private occurrence = new Map<string, number>();
  private disclosuresState = demoDisclosures();
  /** Who approves a new top-up (Q-091): COMPANY in the demo, ONGEM to show a one-person company. */
  approvalBy: 'COMPANY' | 'ONGEM' = 'COMPANY';
  private ticketsState: TicketDetail[] = demoTickets();
  private noticesState: NoticeView[] = demoNotices();
  private preferencesState: NotificationPreferences = {
    kinds: demoPreferences(),
    smsNumberLast4: null,
    smsVerified: false,
  };
  /** The demo SMS code: any 6 digits but 000000, which the demo answers as wrong. */
  private smsPending = false;
  private seq = 0;
  readonly stepUps: string[] = [];
  /** Demo recording stays in memory: events are masked but never leave the browser. */
  readonly recorded: RecordedEvent[] = [];
  readonly assistant = new DemoAssistant(this);
  /** Every call the screens made, for the tests. */
  readonly calls: string[] = [];
  private me_: Me;
  private readonly home: string | null;
  private invitesState: InviteView[] = [];
  private readonly now: () => string;

  constructor(private readonly opts: DemoOptions = {}) {
    const me = opts.me ?? demoMe;
    this.home = me.companyId ?? null;
    this.me_ = opts.companyId ? { ...me, companyId: opts.companyId } : me;
    this.now = opts.now ?? (() => '2026-10-29T15:00:00Z');
    this.applicationState = opts.application ?? demoApplication();
    if (opts.approvalBy) this.approvalBy = opts.approvalBy;
    const company = opts.companyId;
    if (company && company !== this.home)
      this.accountsState = this.accountsState.map((a) => ({ ...a, id: `${a.id}_${company}` }));
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
      throw new ApiError(403, 'forbidden', t('app.demo.error.forbidden'));
  }

  private async stepUp(purpose: string) {
    this.stepUps.push(purpose);
    if (!this.opts.stepUp) return;
    if (!(await this.opts.stepUp(purpose))) {
      throw new ApiError(403, REVERIFICATION_CANCELLED, t('app.demo.error.reverification_cancelled'));
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
    return new DemoOnGemApi({ ...this.opts, me: { ...this.me_, companyId: this.home }, companyId });
  }

  get region(): string {
    return this.opts.region ?? REGION;
  }

  /** OG-023 R12: the person in another region's demo, when the test gave one; a region marked down never answers. */
  forRegion(region: string): DemoOnGemApi | null {
    if (region === this.region) return this.forCompany(null);
    const other = this.opts.regions?.[region];
    if (!other) return null;
    if (other === 'down') {
      const down = new DemoOnGemApi({ ...this.opts, region, regions: {} });
      down.me = () => Promise.reject(new ApiError(0, 'network'));
      return down;
    }
    return new DemoOnGemApi({ ...this.opts, me: other, region, companyId: null, regions: {} });
  }

  invites = async () => {
    this.require(Permission.MEMBER_INVITE);
    return this.log('invites', this.invitesState);
  };

  createInvite = async (_company: string, r: { email: string; role: string }) => {
    this.require(Permission.MEMBER_INVITE);
    const email = r.email.trim();
    if (!EMAIL.test(email)) throw new ApiError(422, 'validation_failed', t('app.team.email_error'));
    if (!invitableRoles(this.role).includes(r.role.toUpperCase())) throw new ApiError(403, 'forbidden');
    if (this.invitesState.some((i) => i.state === 'PENDING' && i.email.toLowerCase() === email.toLowerCase()))
      throw new ApiError(409, 'invite_exists');
    const invite: InviteView = {
      id: this.next('inv'),
      email,
      role: r.role.toUpperCase(),
      state: 'PENDING',
      expiresAt: new Date(Date.parse(this.now()) + 7 * 86_400_000).toISOString(),
      createdAt: this.now(),
      invitedBy: this.me_.personId,
    };
    this.invitesState = [invite, ...this.invitesState];
    const token = `demo_invite_${this.seq}`;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return this.log('createInvite', { invite, token, acceptUrl: `${origin}/invite/${token}` });
  };

  revokeInvite = async (_company: string, id: string) => {
    this.require(Permission.MEMBER_INVITE);
    const i = this.invitesState.find((x) => x.id === id) ?? this.notFound('invite');
    if (i.state !== 'PENDING') throw new ApiError(409, 'invalid_transition');
    const revoked: InviteView = { ...i, state: 'REVOKED' };
    this.invitesState = this.invitesState.map((x) => (x.id === id ? revoked : x));
    return this.log('revokeInvite', revoked);
  };

  /** Any `demo_invite_` token joins the sample company once; anything else is an invitation no longer valid. */
  acceptInvite = async (token: string) => {
    const { companyId, companyName } = demoInviteCompany;
    if (!token.startsWith('demo_invite') || this.me_.memberships.some((m) => m.companyId === companyId))
      throw new ApiError(410, 'invite_not_valid');
    const membership = {
      id: this.next('mbr'),
      companyId,
      companyName,
      role: 'MEMBER',
      state: 'ACTIVE',
      companyState: 'ACTIVE' as const,
      unreadNotices: 0,
    };
    this.me_ = { ...this.me_, memberships: [...this.me_.memberships, membership] };
    return this.log('acceptInvite', { membershipId: membership.id, companyId, companyName, role: 'MEMBER' });
  };

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
    if (IS_AE && !uaeIbanValid(r.iban ?? ''))
      throw new ApiError(422, 'iban_invalid', t('app.demo.error.iban_format'));
    await this.stepUp('recipient');
    const created = {
      id: this.next('rcp'),
      kind: r.kind,
      name: r.name.trim(),
      accountLast4: (IS_AE ? normaliseIban(r.iban ?? '') : (r.accountNumber ?? '')).slice(-4),
      routingNumber: r.routingNumber ?? null,
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
    if (r.amountMinor <= 0) throw new ApiError(422, 'validation_failed', t('app.demo.error.amount_zero'));
    if (r.recipientId && !this.recipientsState.some((x) => x.id === r.recipientId))
      this.notFound('recipient');
    const toCompanyId = this.destination(r);
    const p: Payment = {
      id: this.next('pay'),
      state: 'DRAFT',
      rail: r.rail,
      achTiming: r.achTiming,
      amount: money(r.amountMinor),
      fromAccountId: r.fromAccountId,
      recipientId: r.recipientId,
      toAccountId: r.toAccountId,
      toCompanyId,
      reference: r.reference,
      createdAt: this.now(),
      timeline: [{ from: null, to: 'DRAFT', at: this.now() }],
    };
    this.paymentsState = [p, ...this.paymentsState];
    return this.log('createPayment', p);
  };

  /**
   * OG-023 R11: an INTERNAL transfer to an account of another of the person's companies (its id carries the company, or
   * none for their default company); null for one of this company's own accounts. 409 destination_not_allowed for a
   * company the person is not an active member of.
   */
  private destination(r: CreatePayment): string | null {
    if (!r.toAccountId || this.accountsState.some((a) => a.id === r.toAccountId)) return null;
    if (r.rail !== 'INTERNAL') this.notFound('account');
    const company = COMPANY_SUFFIX.exec(r.toAccountId)?.[1] ?? this.home;
    const here = this.me_.companyId;
    const member = this.me_.memberships.some(
      (m) => m.companyId === company && m.companyId !== here && m.state === 'ACTIVE',
    );
    if (!member) throw new ApiError(409, 'destination_not_allowed');
    return company;
  }

  sendPayment = async (id: string) => {
    this.require(Permission.PAYMENT_CREATE);
    const p = this.paymentsState.find((x) => x.id === id) ?? this.notFound('payment');
    await this.stepUp('payment');
    const from = this.accountsState.find((a) => a.id === p.fromAccountId);
    if ((from?.balance?.available.amountMinor ?? 0) < p.amount.amountMinor) {
      throw new ApiError(409, 'insufficient_funds', t('app.demo.error.insufficient_funds'));
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
          posted: money(posted),
          available: money(a.balance.available.amountMinor + delta),
        },
      };
    });
    return this.log('sendPayment', sent);
  };

  /** A second person approves; demo mode is one person, so the maker check is the API's own (self_approval_forbidden). */
  approvePayment = async (id: string) => {
    this.require(Permission.PAYMENT_APPROVE);
    const p = this.paymentsState.find((x) => x.id === id) ?? this.notFound('payment');
    if (p.state !== 'PENDING_APPROVAL')
      throw new ApiError(409, 'payment_not_pending_approval', t('app.demo.error.not_pending_approval'));
    await this.stepUp('payment');
    const sent: Payment = {
      ...p,
      state: 'SUBMITTED',
      approvalBy: null,
      providerReference: `ach_${p.id.slice(-6)}`,
      timeline: [
        ...p.timeline,
        { from: 'PENDING_APPROVAL', to: 'PRECHECKED', at: this.now() },
        { from: 'PRECHECKED', to: 'SUBMITTED', at: this.now() },
      ],
    };
    this.paymentsState = this.paymentsState.map((x) => (x.id === id ? sent : x));
    return this.log('approvePayment', sent);
  };

  rejectPayment = async (id: string) => {
    this.require(Permission.PAYMENT_APPROVE);
    const p = this.paymentsState.find((x) => x.id === id) ?? this.notFound('payment');
    if (p.state !== 'PENDING_APPROVAL')
      throw new ApiError(409, 'payment_not_pending_approval', t('app.demo.error.not_pending_approval'));
    const rejected: Payment = {
      ...p,
      state: 'REJECTED',
      approvalBy: null,
      timeline: [...p.timeline, { from: 'PENDING_APPROVAL', to: 'REJECTED', at: this.now() }],
    };
    this.paymentsState = this.paymentsState.map((x) => (x.id === id ? rejected : x));
    return this.log('rejectPayment', rejected);
  };

  fundingSources = async () => {
    this.require(Permission.PAYMENT_VIEW);
    return this.log(
      'fundingSources',
      this.fundingState.filter((f) => f.state !== 'REMOVED'),
    );
  };

  /** Demo: the bank verifies a typed-in account the next time it is read. */
  fundingSource = async (id: string) => {
    this.require(Permission.PAYMENT_VIEW);
    const f = this.fundingState.find((x) => x.id === id) ?? this.notFound('funding_source');
    const read = f.state === 'UNVERIFIED' ? { ...f, state: 'VERIFIED', verifiedAt: this.now() } : f;
    this.fundingState = this.fundingState.map((x) => (x.id === id ? read : x));
    return this.log('fundingSource', read);
  };

  linkFundingSource = async (r: LinkFundingSource) => {
    this.require(Permission.RECIPIENT_MANAGE);
    await this.account(r.accountId);
    const number = IS_AE ? normaliseIban(r.iban ?? '') : (r.accountNumber ?? '').replace(/\D/g, '');
    if (IS_AE && (!uaeIbanValid(number) || !r.ownerName.trim()))
      throw new ApiError(422, 'iban_invalid', t('app.demo.error.iban_and_name'));
    if (
      !IS_AE &&
      (!/^\d{9}$/.test(r.routingNumber ?? '') ||
        number.length < 4 ||
        number.length > 17 ||
        !r.ownerName.trim())
    )
      throw new ApiError(422, 'validation_failed', t('app.demo.error.routing_account_name'));
    await this.stepUp('funding_source');
    const f: FundingSource = {
      id: this.next('fsrc'),
      accountId: r.accountId,
      method: 'MANUAL',
      aggregator: null,
      nickname: r.nickname?.trim() || null,
      last4: number.slice(-4),
      routingNumber: r.routingNumber ?? null,
      accountType: r.accountType,
      state: 'UNVERIFIED',
      createdAt: this.now(),
      verifiedAt: null,
    };
    this.fundingState = [f, ...this.fundingState];
    return this.log('linkFundingSource', f);
  };

  removeFundingSource = async (id: string) => {
    this.require(Permission.RECIPIENT_MANAGE);
    const f = this.fundingState.find((x) => x.id === id) ?? this.notFound('funding_source');
    await this.stepUp('funding_source');
    const removed = { ...f, state: 'REMOVED' };
    this.fundingState = this.fundingState.map((x) => (x.id === id ? removed : x));
    return this.log('removeFundingSource', removed);
  };

  /** Like ongem-core: approval is required by default, so a top-up waits in PENDING_APPROVAL. */
  createTopUp = async (r: CreateTopUp) => {
    this.require(Permission.PAYMENT_CREATE);
    const f = this.fundingState.find((x) => x.id === r.fundingSourceId && x.state !== 'REMOVED');
    if (!f) this.notFound('funding_source');
    await this.account(r.toAccountId);
    if (r.amountMinor <= 0) throw new ApiError(422, 'validation_failed', t('app.demo.error.amount_positive'));
    if (f.state !== 'VERIFIED') throw new ApiError(409, 'funding_source_not_verified');
    if (r.amountMinor > REGION_CONFIG.topUpLimit) throw new ApiError(409, 'limit_exceeded');
    await this.stepUp('payment');
    const p: Payment = {
      id: this.next('pay'),
      state: 'PENDING_APPROVAL',
      rail: REGION_CONFIG.scheduleRail,
      achTiming: IS_AE ? null : 'STANDARD',
      amount: money(r.amountMinor),
      fromAccountId: r.toAccountId,
      recipientId: null,
      toAccountId: null,
      fundingSourceId: f.id,
      approvalBy: this.approvalBy,
      reference: r.reference ?? null,
      createdAt: this.now(),
      timeline: [
        { from: null, to: 'DRAFT', at: this.now() },
        { from: 'DRAFT', to: 'PENDING_APPROVAL', at: this.now() },
      ],
    };
    this.paymentsState = [p, ...this.paymentsState];
    return this.log('createTopUp', p);
  };

  /** The date of occurrence [k], or null once the schedule has ended (count reached, or on or after endDate). */
  private runDate(s: PaymentSchedule, k: number): string | null {
    if (s.count != null && k >= s.count) return null;
    const d = nthRun(s.startDate, s.frequency, s.interval, k);
    return s.endDate && d >= s.endDate ? null : d;
  }

  private moveSchedule(id: string, to: string, change: (s: PaymentSchedule) => PaymentSchedule = (s) => s) {
    const s = this.schedulesState.find((x) => x.id === id) ?? this.notFound('schedule');
    const moves: Record<string, string[]> = {
      ACTIVE: ['PAUSED', 'CANCELLED'],
      PAUSED: ['ACTIVE', 'CANCELLED'],
    };
    if (!(moves[s.state] ?? []).includes(to))
      throw new ApiError(
        409,
        'invalid_transition',
        t('app.demo.error.schedule_state', { state: s.state.toLowerCase() }),
      );
    const moved = change({ ...s, state: to });
    this.schedulesState = this.schedulesState.map((x) => (x.id === id ? moved : x));
    return moved;
  }

  schedules = async () => {
    this.require(Permission.PAYMENT_VIEW);
    return this.log(
      'schedules',
      this.schedulesState.map((s) => ({ ...s, runs: [] })),
    );
  };

  schedule = async (id: string) => {
    this.require(Permission.PAYMENT_VIEW);
    return this.log('schedule', this.schedulesState.find((s) => s.id === id) ?? this.notFound('schedule'));
  };

  createSchedule = async (r: CreateSchedule) => {
    this.require(Permission.PAYMENT_CREATE);
    await this.account(r.fromAccountId);
    if (r.rail !== REGION_CONFIG.scheduleRail) throw new ApiError(422, 'capability_unavailable');
    const recipient = this.recipientsState.find((x) => x.id === r.recipientId) ?? this.notFound('recipient');
    if (recipient.screening === 'BLOCKED') throw new ApiError(409, 'recipient_blocked');
    const today = this.now().slice(0, 10);
    if (
      r.amountMinor <= 0 ||
      r.interval < 1 ||
      r.startDate < today ||
      (r.endDate && r.endDate <= r.startDate)
    )
      throw new ApiError(422, 'validation_failed', t('app.demo.error.schedule_fields'));
    await this.stepUp('payment');
    const s: PaymentSchedule = {
      id: this.next('psch'),
      fromAccountId: r.fromAccountId,
      recipientId: r.recipientId,
      rail: REGION_CONFIG.scheduleRail,
      amount: money(r.amountMinor),
      reference: r.reference ?? null,
      frequency: r.frequency,
      interval: r.interval,
      startDate: r.startDate,
      endDate: r.endDate ?? null,
      count: r.count ?? null,
      state: 'ACTIVE',
      nextRunOn: r.startDate,
      runsMade: 0,
      createdAt: this.now(),
      runs: [],
    };
    this.occurrence.set(s.id, 0);
    this.schedulesState = [s, ...this.schedulesState];
    return this.log('createSchedule', s);
  };

  pauseSchedule = async (id: string) => {
    this.require(Permission.PAYMENT_CREATE);
    return this.log('pauseSchedule', this.moveSchedule(id, 'PAUSED'));
  };

  /** Active again from today: dates that passed while paused are not made. */
  resumeSchedule = async (id: string) => {
    this.require(Permission.PAYMENT_CREATE);
    await this.stepUp('payment');
    const today = this.now().slice(0, 10);
    return this.log(
      'resumeSchedule',
      this.moveSchedule(id, 'ACTIVE', (s) => {
        let k = this.occurrence.get(id) ?? 0;
        let d = this.runDate(s, k);
        while (d && d < today) d = this.runDate(s, ++k);
        this.occurrence.set(id, k);
        return d ? { ...s, nextRunOn: d } : { ...s, state: 'COMPLETED', nextRunOn: null };
      }),
    );
  };

  cancelSchedule = async (id: string) => {
    this.require(Permission.PAYMENT_CREATE);
    return this.log(
      'cancelSchedule',
      this.moveSchedule(id, 'CANCELLED', (s) => ({ ...s, nextRunOn: null })),
    );
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
      throw new ApiError(409, 'card_not_active', t('app.demo.error.card_not_active'));
    if (!frozen && c.state !== 'FROZEN')
      throw new ApiError(409, 'card_not_frozen', t('app.demo.error.card_not_frozen'));
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
    if (!ok) throw new ApiError(409, 'card_not_active', t('app.demo.error.card_details_unavailable'));
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
    const kind = REGION_CONFIG.ownerIds.find((k) => k.idType === identity.idType);
    const digits =
      kind?.numeric === false ? identity.number.trim().toUpperCase() : identity.number.replace(/\D/g, '');
    if (!kind?.pattern.test(digits))
      throw new ApiError(422, 'validation_failed', kind?.error ?? t('app.demo.error.id_number'));
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
      throw new ApiError(409, 'requirements_incomplete', t('app.demo.error.owner_id_missing'));
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
      throw new ApiError(409, 'disclosure_not_accepted', t('app.demo.error.disclosures_first'));
    if (app.state !== 'READY_FOR_DISCLOSURES') throw new ApiError(409, 'invalid_state');
    this.applicationState = { ...app, state: 'SUBMITTED' };
    return this.log('submitApplication', this.applicationState);
  };

  /** The founder's own owner record; demo mode has no capture page, so `captureUrl` stays empty. */
  startIdCapture = async (id: string, document: IdDocument, sendSms: boolean) => {
    this.require(Permission.ONBOARDING_MANAGE);
    const app = this.applicationState;
    if (id !== app.id) this.notFound('application');
    if (!CAPTURE_OPEN.includes(app.state))
      throw new ApiError(409, 'invalid_state', t('app.demo.error.capture_closed'));
    const owner = app.owners.find((o) => o.founder) ?? this.notFound('owner');
    const at = this.now();
    const capture: IdCapture = {
      id: this.next('cap'),
      ownerId: owner.id,
      document,
      stage: 'WAITING',
      kycStatus: null,
      smsRequested: sendSms,
      createdAt: at,
      updatedAt: at,
      captureUrl: null,
    };
    this.captures = [capture, ...this.captures];
    return this.log('startIdCapture', capture);
  };

  idCaptures = async (id: string) => {
    this.require(Permission.ONBOARDING_MANAGE);
    if (id !== this.applicationState.id) this.notFound('application');
    return this.log('idCaptures', this.captures);
  };

  /** Each read moves the demo session one step: photos received, then the bank's answer. */
  idCapture = async (id: string, captureId: string) => {
    this.require(Permission.ONBOARDING_MANAGE);
    if (id !== this.applicationState.id) this.notFound('application');
    const c = this.captures.find((x) => x.id === captureId) ?? this.notFound('capture');
    const next: IdCapture =
      c.stage === 'WAITING'
        ? { ...c, stage: 'CAPTURED' }
        : c.stage === 'CAPTURED'
          ? { ...c, stage: 'VERIFIED', kycStatus: 'ACCEPTED' }
          : c;
    this.captures = this.captures.map((x) => (x.id === c.id ? next : x));
    return this.log('idCapture', next);
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

  private inbox(unread = false, limit = 50) {
    const items = this.noticesState.filter((n) => !unread || !n.readAt).slice(0, limit);
    return { items, unread: this.noticesState.filter((n) => !n.readAt).length };
  }

  notifications = async (opts?: { unread?: boolean; limit?: number }) =>
    this.log('notifications', this.inbox(opts?.unread ?? false, opts?.limit ?? 50));

  readNotification = async (id: string) => {
    if (!this.noticesState.some((n) => n.id === id)) this.notFound('notice');
    this.noticesState = this.noticesState.map((n) =>
      n.id === id && !n.readAt ? { ...n, readAt: this.now() } : n,
    );
    return this.log('readNotification', this.inbox());
  };

  readAllNotifications = async () => {
    this.noticesState = this.noticesState.map((n) => (n.readAt ? n : { ...n, readAt: this.now() }));
    return this.log('readAllNotifications', this.inbox());
  };

  notificationPreferences = async () => this.log('notificationPreferences', this.preferencesState);

  locale: 'en' | 'ar' = 'en';
  setLocale = async (locale: 'en' | 'ar') => {
    this.locale = locale;
    await this.log('setLocale', locale);
  };

  setNotificationPreferences = async (kinds: PreferenceChange[]) => {
    const known = new Map(this.preferencesState.kinds.map((k) => [k.kind, k]));
    for (const c of kinds) {
      const k = known.get(c.kind);
      if (!k)
        throw new ApiError(422, 'validation_failed', t('app.demo.error.unknown_kind', { kind: c.kind }));
      if (k.mandatory && c.email === false)
        throw new ApiError(422, 'mandatory_kind', t('app.demo.error.mandatory_kind'));
      if (c.sms && !this.preferencesState.smsVerified)
        throw new ApiError(422, 'validation_failed', t('app.demo.error.sms_verify_first'));
    }
    this.preferencesState = {
      ...this.preferencesState,
      kinds: this.preferencesState.kinds.map((k) => {
        const c = kinds.find((x) => x.kind === k.kind);
        return c ? { ...k, email: c.email ?? k.email, sms: c.sms ?? k.sms } : k;
      }),
    };
    return this.log('setNotificationPreferences', this.preferencesState);
  };

  setSmsNumber = async (number: string) => {
    if (!/^\+[1-9]\d{7,14}$/.test(number.trim()))
      throw new ApiError(422, 'sms_number_invalid', t('app.demo.error.sms_number_format'));
    this.smsPending = true;
    this.preferencesState = {
      ...this.preferencesState,
      smsNumberLast4: number.trim().slice(-4),
      smsVerified: false,
      kinds: this.preferencesState.kinds.map((k) => ({ ...k, sms: false })),
    };
    return this.log('setSmsNumber', this.preferencesState);
  };

  verifySmsNumber = async (code: string) => {
    if (!this.smsPending || !/^\d{6}$/.test(code) || code === '000000')
      throw new ApiError(422, 'sms_code_invalid', t('app.demo.error.sms_code_invalid'));
    this.smsPending = false;
    this.preferencesState = { ...this.preferencesState, smsVerified: true };
    return this.log('verifySmsNumber', this.preferencesState);
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
    return (
      [this.me_.legalFirstName, this.me_.legalLastName].filter(Boolean).join(' ') || t('app.demo.member')
    );
  }

  openTicket = async (r: OpenTicket) => {
    if (!r.subject.trim() || !r.body.trim())
      throw new ApiError(422, 'validation_failed', t('app.demo.error.ticket_fields'));
    const created: TicketDetail = {
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
    this.ticketsState = [created, ...this.ticketsState];
    return this.log('openTicket', created);
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
    if (file.size > 10 * 1024 * 1024)
      throw new ApiError(422, 'file_too_large', t('app.demo.error.file_too_large'));
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
