// content-check: data (sample people, merchants, amounts and ids, the same as ongem-core's SpendDemo seed)
import { permissionsOf, Permission } from '../api/client';
import { ApiError } from '../api/errors';
import type { Amount, CardWidgetKind, CardWidgetSession, Me } from '../api/types';
import { samplePdf } from '../api/samplePdf';
import type {
  CardSummary,
  ClaimBody,
  CodingBody,
  EmployeeView,
  ExpenseFilter,
  ExpenseView,
  ExportView,
  Page,
  PolicyOverview,
  PolicyVersionView,
  ProgramView,
  ReceiptHints,
  ReceiptView,
  SpendBackend,
  SpendMeView,
  SpendPolicy,
  SpendSettings,
  TeamView,
} from './api';

/** What a spend step-up confirms in the demo dialog (the same actions as live). */
export type SpendStepUp =
  | { action: 'card_freeze' | 'card_unfreeze'; last4?: string }
  | { action: 'spend_card_issue'; payee?: string }
  | { action: 'spend_policy_approve' | 'spend_policy_reject' };

export interface DemoSpendDeps {
  log<T>(name: string, v: T): Promise<T>;
  stepUp(purpose: string, detail: SpendStepUp): Promise<void>;
  role(): string;
  personId(): string;
  /** The signed-in person's name, as the core answers `decidedByName`. */
  personName?(): string | null;
  now(): string;
  /** Spend is on for this company (Northwind Labs LLC, as the core's demo seed switches it on). */
  active(): boolean;
  /** `?state=spend_review`: an approved and a waiting expense, an unmatched receipt and a proposal by another person. */
  review?(): boolean;
}

const CURRENCY = 'USD';
const usd = (amountMinor: number): Amount => ({ amountMinor, currency: CURRENCY });

/** The programme setting's seeded default (ongem-core `spend.programme`, US). */
export const DEMO_SPEND_SETTINGS: SpendSettings = {
  taxCodes: ['NONE', 'SALES_TAX'],
  receiptMaxBytes: 10_485_760,
  receiptTypes: ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'],
  exportFormats: ['CSV', 'QUICKBOOKS', 'XERO'],
  ceilings: { perTransaction: usd(1_000_000), monthly: usd(5_000_000) },
  categories: ['travel', 'software', 'meals', 'office', 'other'],
};

const MATCH_WINDOW_DAYS = 3;

export function defaultPolicy(): SpendPolicy {
  return {
    currency: CURRENCY,
    receiptRequiredAboveMinor: 5000,
    perTransactionLimitMinor: 100_000,
    monthlyLimitMinor: 500_000,
    categories: [
      { key: 'travel', glAccount: '6100' },
      { key: 'software', glAccount: '6200' },
      { key: 'meals', glAccount: '6300' },
      { key: 'office', glAccount: '6400' },
      { key: 'other', glAccount: '6900' },
    ],
    autoApproveInPolicy: true,
    claimsNeedApproval: true,
    selfApproval: false,
    selfApprovalMaxMinor: 0,
    receiptReminderHours: 48,
    teams: {},
    employees: {},
  };
}

/** The person an employee of the demo is, for `/demo?demo=employee` (Lea Fontaine, linked). */
export const DEMO_EMPLOYEE_PERSON = 'prn_demo_lea';

export const demoEmployeeMe: Me = {
  personId: DEMO_EMPLOYEE_PERSON,
  tenantId: 'ten_demo',
  companyId: 'cmp_demo_northwind',
  email: 'lea.fontaine@northwind.example',
  legalFirstName: 'Lea',
  legalLastName: 'Fontaine',
  providerState: 'ACCEPTED',
  memberships: [
    {
      id: 'mbr_demo_lea',
      companyId: 'cmp_demo_northwind',
      companyName: 'Northwind Labs LLC',
      role: 'EMPLOYEE',
      state: 'ACTIVE',
      companyStatus: 'OPEN',
    },
  ],
  issuer: 'customer',
} as Me;

interface DemoEmployee extends EmployeeView {
  personId: string | null;
}

const TEAMS: TeamView[] = [
  {
    id: 'spt_demo_eng',
    name: 'Engineering',
    state: 'ACTIVE',
    employees: 0,
    createdAt: '2026-10-27T09:00:00Z',
  },
  { id: 'spt_demo_sales', name: 'Sales', state: 'ACTIVE', employees: 0, createdAt: '2026-10-27T09:00:01Z' },
];

function card(id: string, last4: string, createdAt: string): CardSummary {
  return { id, last4, state: 'ACTIVE', frozenBy: null, createdAt };
}

function employee(
  id: string,
  first: string,
  last: string,
  teamId: string,
  last4: string,
  createdAt: string,
): DemoEmployee {
  return {
    id,
    firstName: first,
    lastName: last,
    emailHint: `${first[0]!.toLowerCase()}***@northwind.example`,
    teamId,
    teamName: TEAMS.find((t) => t.id === teamId)!.name,
    state: 'INVITED',
    linked: false,
    card: card(`crd_demo_${first.toLowerCase()}`, last4, createdAt),
    limits: { perTransaction: usd(100_000), monthly: usd(500_000) },
    createdAt,
    personId: null,
  };
}

function purchase(
  id: string,
  e: DemoEmployee,
  amountMinor: number,
  merchant: string,
  spentOn: string,
  receiptId: string | null = null,
): ExpenseView {
  return {
    id,
    employeeId: e.id,
    employeeName: `${e.firstName} ${e.lastName}`,
    teamId: e.teamId,
    source: 'CARD',
    cardId: e.card?.id ?? null,
    amount: usd(amountMinor),
    merchant,
    spentOn,
    postedAt: `${spentOn}T16:00:00Z`,
    state: 'OPEN',
    receipt: receiptId ? 'ATTACHED' : amountMinor > 5000 ? 'MISSING' : 'NOT_REQUIRED',
    receiptId,
    category: null,
    taxCode: null,
    vat: null,
    note: null,
    reasons: [],
    policyVersion: null,
    submittedAt: null,
    decidedBy: null,
    decidedByName: null,
    decidedAt: null,
    decisionNote: null,
    overLimit: false,
    createdAt: `${spentOn}T16:00:00Z`,
  };
}

function receipt(id: string, x: ExpenseView, file: string): ReceiptView {
  return {
    id,
    employeeId: x.employeeId,
    employeeName: x.employeeName,
    expenseId: x.id,
    state: 'MATCHED',
    matchRule: 'ATTACHED',
    fileName: file,
    contentType: 'application/pdf',
    sizeBytes: 812,
    hintAmount: x.amount,
    hintDate: x.spentOn,
    hintMerchant: x.merchant ?? null,
    createdAt: `${x.spentOn}T18:00:00Z`,
    candidates: [],
  };
}

const days = (a: string, b: string) =>
  Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;

/**
 * OG-087 demo spend: Northwind Labs LLC as ongem-core's `POST /v1/ops/spend/demo-seed` leaves it (Engineering and Sales;
 * Lea Fontaine, Tom Bergstrom and Sam Iverson invited with cards; seven card purchases; receipts for Lea's coffee and
 * Tom's office supplies; policy version 1 from the programme default). The rules follow the core's: four-eyes on
 * policies and expenses, submit checks, receipt matching by amount and date, exports of approved expenses once.
 */
export class DemoSpend implements SpendBackend {
  private teamsState: TeamView[] = structuredClone(TEAMS);
  private employeesState: DemoEmployee[] = [];
  private expensesState: ExpenseView[] = [];
  private receiptsState: ReceiptView[] = [];
  private versions: PolicyVersionView[] = [];
  private exportsState: ExportView[] = [];
  private seq = 0;
  private seeded = false;

  constructor(private readonly d: DemoSpendDeps) {}

  /** Seeded on first use: the demo client that owns it knows its person only once it is built. */
  private seed() {
    if (this.seeded) return;
    this.seeded = true;
    const d = this.d;
    const lea = employee('emp_demo_lea', 'Lea', 'Fontaine', 'spt_demo_eng', '4417', '2026-10-27T09:01:00Z');
    const tom = employee('emp_demo_tom', 'Tom', 'Bergstrom', 'spt_demo_eng', '5523', '2026-10-27T09:02:00Z');
    const sam = employee('emp_demo_sam', 'Sam', 'Iverson', 'spt_demo_sales', '6631', '2026-10-27T09:03:00Z');
    if (d.personId() === DEMO_EMPLOYEE_PERSON)
      Object.assign(lea, { state: 'ACTIVE', linked: true, personId: DEMO_EMPLOYEE_PERSON });
    this.employeesState = [sam, tom, lea];
    this.expensesState = [
      purchase('exp_demo_1', lea, 4_250, 'Figma', '2026-10-27'),
      purchase('exp_demo_2', lea, 12_999, 'Delta Air Lines', '2026-10-27'),
      purchase('exp_demo_3', lea, 7_800, 'Blue Bottle Coffee', '2026-10-28', 'rct_demo_1'),
      purchase('exp_demo_4', tom, 2_350, 'Staples', '2026-10-28', 'rct_demo_2'),
      purchase('exp_demo_5', tom, 64_900, 'Apple Store', '2026-10-28'),
      purchase('exp_demo_6', sam, 18_400, 'Hilton Hotels', '2026-10-29'),
      purchase('exp_demo_7', sam, 3_100, 'Uber', '2026-10-29'),
    ];
    this.receiptsState = [
      receipt('rct_demo_2', this.expensesState[3]!, 'staples.pdf'),
      receipt('rct_demo_1', this.expensesState[2]!, 'blue-bottle-coffee.pdf'),
    ];
    this.versions = [
      {
        version: 1,
        state: 'ACTIVE',
        policy: defaultPolicy(),
        reason: null,
        proposedBy: 'system',
        proposedByName: null,
        decidedBy: 'system',
        decidedByName: null,
        decidedAt: '2026-10-27T09:00:00Z',
        createdAt: '2026-10-27T09:00:00Z',
      },
    ];
    if (d.review?.()) this.addReview(sam);
  }

  private addReview(sam: DemoEmployee) {
    const coffee = this.expensesState[2]!;
    Object.assign(coffee, {
      category: 'meals',
      taxCode: 'NONE',
      state: 'APPROVED',
      policyVersion: 1,
      submittedAt: '2026-10-28T19:00:00Z',
      decidedBy: 'policy:v1',
      decidedAt: '2026-10-28T19:00:00Z',
    });
    const claim = purchase('exp_demo_8', sam, 1_800, 'Corner Bistro', '2026-10-29');
    Object.assign(claim, {
      source: 'CLAIM',
      cardId: null,
      postedAt: null,
      receipt: 'NOT_REQUIRED',
      category: 'meals',
      note: 'Lunch with a client',
      state: 'PENDING_APPROVAL',
      reasons: ['claim'],
      policyVersion: 1,
      submittedAt: '2026-10-29T13:00:00Z',
    });
    this.expensesState.push(claim);
    this.receiptsState.unshift({
      id: 'rct_demo_3',
      employeeId: sam.id,
      employeeName: `${sam.firstName} ${sam.lastName}`,
      expenseId: null,
      state: 'UNMATCHED',
      matchRule: null,
      fileName: 'hilton-folio.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1_204,
      hintAmount: usd(18_000),
      hintDate: '2026-10-29',
      hintMerchant: 'Hilton Hotels',
      createdAt: '2026-10-29T14:00:00Z',
      candidates: ['exp_demo_6'],
    });
    this.versions.unshift({
      version: 2,
      state: 'PROPOSED',
      policy: { ...defaultPolicy(), perTransactionLimitMinor: 150_000, receiptRequiredAboveMinor: 7_500 },
      reason: 'Travel costs went up',
      proposedBy: 'prn_demo_priya',
      proposedByName: 'Priya Shah',
      decidedBy: null,
      decidedByName: null,
      decidedAt: null,
      createdAt: '2026-10-29T10:00:00Z',
    });
  }

  private next(prefix: string) {
    this.seq += 1;
    return `${prefix}_demo_new_${this.seq}`;
  }

  private gate() {
    this.seed();
    if (!this.d.active()) throw new ApiError(409, 'spend_not_enabled');
  }

  private require(p: string) {
    this.gate();
    if (!permissionsOf(this.d.role()).has(p)) throw new ApiError(403, 'forbidden');
  }

  private inForce(): PolicyVersionView {
    return this.versions.find((v) => v.state === 'ACTIVE')!;
  }

  private view(e: DemoEmployee): EmployeeView {
    const rest: EmployeeView = { ...e };
    const p = this.inForce().policy;
    const own = p.employees[e.id] ?? {};
    const team = (e.teamId && p.teams[e.teamId]) || {};
    const per = own.perTransactionMinor ?? team.perTransactionMinor ?? p.perTransactionLimitMinor;
    const month = own.monthlyMinor ?? team.monthlyMinor ?? p.monthlyLimitMinor;
    return {
      ...rest,
      teamName: this.teamsState.find((t) => t.id === e.teamId)?.name ?? null,
      limits: { perTransaction: per ? usd(per) : null, monthly: month ? usd(month) : null },
    };
  }

  private findEmployee(id: string) {
    return this.employeesState.find((e) => e.id === id) ?? this.missing('employee');
  }

  private findExpense(id: string) {
    return this.expensesState.find((e) => e.id === id) ?? this.missing('expense');
  }

  private missing(what: string): never {
    throw new ApiError(404, `${what}_not_found`);
  }

  private withCounts(t: TeamView): TeamView {
    return {
      ...t,
      employees: this.employeesState.filter((e) => e.teamId === t.id && e.state !== 'OFFBOARDED').length,
    };
  }

  private self(): DemoEmployee | null {
    return this.employeesState.find((e) => e.personId === this.d.personId()) ?? null;
  }

  private mine(): DemoEmployee {
    this.require(Permission.SPEND_OWN);
    const me = this.self();
    if (!me) throw new ApiError(404, 'employee_not_found');
    return me;
  }

  program = async () => {
    this.seed();
    const p: ProgramView = this.d.active()
      ? {
          state: 'ACTIVE',
          fundingAccountId: 'acc_demo_ops',
          currency: CURRENCY,
          policyVersion: this.inForce().version,
          updatedAt: '2026-10-27T09:00:00Z',
        }
      : { state: 'OFF' };
    return this.d.log('spendProgram', p);
  };

  settings = async () => {
    this.gate();
    return this.d.log('spendSettings', DEMO_SPEND_SETTINGS);
  };

  teams = async () => {
    this.require(Permission.SPEND_VIEW);
    return this.d.log(
      'spendTeams',
      this.teamsState.map((t) => this.withCounts(t)),
    );
  };

  createTeam = async (name: string) => {
    this.require(Permission.SPEND_MANAGE);
    const n = name.trim();
    if (!n || n.length > 80) throw new ApiError(422, 'validation_failed');
    if (this.teamsState.some((t) => t.state === 'ACTIVE' && t.name.toLowerCase() === n.toLowerCase()))
      throw new ApiError(409, 'team_exists');
    const t: TeamView = {
      id: this.next('spt'),
      name: n,
      state: 'ACTIVE',
      employees: 0,
      createdAt: this.d.now(),
    };
    this.teamsState.push(t);
    return this.d.log('spendCreateTeam', t);
  };

  updateTeam = async (id: string, patch: { name?: string; state?: 'ARCHIVED' }) => {
    this.require(Permission.SPEND_MANAGE);
    const t = this.teamsState.find((x) => x.id === id) ?? this.missing('team');
    if (t.state === 'ARCHIVED') throw new ApiError(409, 'invalid_transition');
    if (patch.name !== undefined) {
      const n = patch.name.trim();
      if (!n) throw new ApiError(422, 'validation_failed');
      if (
        this.teamsState.some(
          (x) => x.id !== id && x.state === 'ACTIVE' && x.name.toLowerCase() === n.toLowerCase(),
        )
      )
        throw new ApiError(409, 'team_exists');
      t.name = n;
    }
    if (patch.state === 'ARCHIVED') t.state = 'ARCHIVED';
    return this.d.log('spendUpdateTeam', this.withCounts(t));
  };

  employees = async (filter: { teamId?: string; state?: string } = {}) => {
    this.require(Permission.SPEND_VIEW);
    const list = this.employeesState
      .filter(
        (e) => (!filter.teamId || e.teamId === filter.teamId) && (!filter.state || e.state === filter.state),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return this.d.log(
      'spendEmployees',
      list.map((e) => this.view(e)),
    );
  };

  employee = async (id: string) => {
    this.require(Permission.SPEND_VIEW);
    return this.d.log('spendEmployee', this.view(this.findEmployee(id)));
  };

  createEmployee = async (body: { firstName: string; lastName: string; email: string; teamId?: string }) => {
    this.require(Permission.SPEND_MANAGE);
    if (!permissionsOf(this.d.role()).has(Permission.MEMBER_INVITE)) throw new ApiError(403, 'forbidden');
    const first = body.firstName.trim();
    const last = body.lastName.trim();
    const email = body.email.trim().toLowerCase();
    if (!first || !last || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      throw new ApiError(422, 'validation_failed');
    if (body.teamId && !this.teamsState.some((t) => t.id === body.teamId && t.state === 'ACTIVE'))
      throw new ApiError(404, 'team_not_found');
    const hint = `${email[0]}***@${email.split('@')[1]}`;
    if (
      this.employeesState.some(
        (e) => e.emailHint === hint && e.firstName === first && e.state !== 'OFFBOARDED',
      )
    )
      throw new ApiError(409, 'employee_exists');
    const e: DemoEmployee = {
      id: this.next('emp'),
      firstName: first,
      lastName: last,
      emailHint: hint,
      teamId: body.teamId || null,
      teamName: null,
      state: 'INVITED',
      linked: false,
      card: null,
      limits: {},
      createdAt: this.d.now(),
      personId: null,
    };
    this.employeesState.unshift(e);
    return this.d.log('spendCreateEmployee', this.view(e));
  };

  moveEmployee = async (id: string, teamId: string) => {
    this.require(Permission.SPEND_MANAGE);
    const e = this.findEmployee(id);
    if (e.state === 'OFFBOARDED') throw new ApiError(409, 'employee_not_active');
    if (teamId && !this.teamsState.some((t) => t.id === teamId && t.state === 'ACTIVE'))
      throw new ApiError(404, 'team_not_found');
    e.teamId = teamId || null;
    return this.d.log('spendMoveEmployee', this.view(e));
  };

  employeeAction = async (id: string, action: 'suspend' | 'reactivate' | 'offboard') => {
    this.require(Permission.SPEND_MANAGE);
    const e = this.findEmployee(id);
    const ok =
      action === 'suspend'
        ? e.state === 'ACTIVE' || e.state === 'INVITED'
        : action === 'reactivate'
          ? e.state === 'SUSPENDED'
          : e.state !== 'OFFBOARDED';
    if (!ok) throw new ApiError(409, 'invalid_transition');
    if (action === 'reactivate') e.state = e.linked ? 'ACTIVE' : 'INVITED';
    else {
      e.state = action === 'suspend' ? 'SUSPENDED' : 'OFFBOARDED';
      if (e.card && e.card.state === 'ACTIVE') e.card = { ...e.card, state: 'FROZEN', frozenBy: 'CARD' };
    }
    return this.d.log('spendEmployeeAction', this.view(e));
  };

  issueCard: SpendBackend['issueCard'] = async (id, body) => {
    this.require(Permission.SPEND_MANAGE);
    const e = this.findEmployee(id);
    if (e.state === 'SUSPENDED' || e.state === 'OFFBOARDED') throw new ApiError(409, 'employee_not_active');
    if (e.card && ['ACTIVE', 'FROZEN', 'PENDING'].includes(e.card.state))
      throw new ApiError(409, 'card_exists');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dateOfBirth) || !body.address.line1.trim())
      throw new ApiError(422, 'validation_failed');
    await this.d.stepUp('spend_card', { action: 'spend_card_issue', payee: `${e.firstName} ${e.lastName}` });
    // The date of birth and address go to the bank and are not kept, here as in the core.
    e.card = card(this.next('crd'), String(7000 + this.seq).slice(-4), this.d.now());
    return this.d.log('spendIssueCard', this.view(e));
  };

  setEmployeeCardFrozen = async (id: string, frozen: boolean) => {
    this.require(Permission.SPEND_MANAGE);
    const e = this.findEmployee(id);
    const c = e.card ?? this.missing('card');
    e.card = await this.freeze(c, frozen);
    return this.d.log('spendEmployeeCardFrozen', this.view(e));
  };

  private async freeze(c: CardSummary, frozen: boolean): Promise<CardSummary> {
    if (frozen && c.state !== 'ACTIVE') throw new ApiError(409, 'card_not_active');
    if (!frozen && c.state !== 'FROZEN') throw new ApiError(409, 'card_not_frozen');
    if (!frozen && c.frozenBy && c.frozenBy !== 'CARD') throw new ApiError(409, 'frozen_by_other');
    await this.d.stepUp('card', { action: frozen ? 'card_freeze' : 'card_unfreeze', last4: c.last4 });
    return { ...c, state: frozen ? 'FROZEN' : 'ACTIVE', frozenBy: frozen ? 'CARD' : null };
  }

  policy = async () => {
    this.require(Permission.SPEND_VIEW);
    const o: PolicyOverview = {
      active: this.inForce(),
      proposed: this.versions.find((v) => v.state === 'PROPOSED') ?? null,
      versions: [...this.versions].sort((a, b) => b.version - a.version),
    };
    return this.d.log('spendPolicy', o);
  };

  proposePolicy = async (policy: SpendPolicy, reason?: string) => {
    this.require(Permission.SPEND_MANAGE);
    if (this.versions.some((v) => v.state === 'PROPOSED')) throw new ApiError(409, 'policy_pending');
    const ceil = DEMO_SPEND_SETTINGS.ceilings;
    const limits = [
      { perTransactionMinor: policy.perTransactionLimitMinor, monthlyMinor: policy.monthlyLimitMinor },
      ...Object.values(policy.teams),
      ...Object.values(policy.employees),
    ];
    // The core's checks, each with its problem code (`problems[].code`).
    const problems = [
      policy.currency !== CURRENCY && 'currency_not_programme',
      policy.receiptRequiredAboveMinor < 0 && 'receipt_threshold_negative',
      (policy.receiptReminderHours < 1 || policy.receiptReminderHours > 720) && 'reminder_hours_out_of_range',
      policy.selfApprovalMaxMinor < 0 && 'self_approval_max_negative',
      !policy.categories.length && 'categories_empty',
      new Set(policy.categories.map((c) => c.key)).size !== policy.categories.length && 'category_duplicate',
      limits.some((l) => (l.perTransactionMinor ?? 1) <= 0 || (l.monthlyMinor ?? 1) <= 0) &&
        'limit_not_positive',
      limits.some((l) => (l.perTransactionMinor ?? 0) > ceil.perTransaction!.amountMinor) &&
        'per_transaction_over_ceiling',
      limits.some((l) => (l.monthlyMinor ?? 0) > ceil.monthly!.amountMinor) && 'monthly_over_ceiling',
      Object.keys(policy.teams).some((id) => !this.teamsState.some((x) => x.id === id)) && 'unknown_team',
      Object.keys(policy.employees).some((id) => !this.employeesState.some((x) => x.id === id)) &&
        'unknown_employee',
    ].filter((c): c is string => !!c);
    if (problems.length)
      throw new ApiError(
        422,
        'policy_invalid',
        undefined,
        undefined,
        undefined,
        problems.map((code) => ({ code })),
      );
    const v: PolicyVersionView = {
      version: Math.max(...this.versions.map((x) => x.version)) + 1,
      state: 'PROPOSED',
      policy: structuredClone(policy),
      reason: reason?.trim() || null,
      proposedBy: this.d.personId(),
      proposedByName: this.d.personName?.() ?? null,
      decidedBy: null,
      decidedByName: null,
      decidedAt: null,
      createdAt: this.d.now(),
    };
    this.versions.unshift(v);
    return this.d.log('spendProposePolicy', v);
  };

  decidePolicy = async (version: number, approve: boolean) => {
    this.require(Permission.SPEND_APPROVE);
    const v = this.versions.find((x) => x.version === version) ?? this.missing('policy');
    if (v.state !== 'PROPOSED') throw new ApiError(409, 'invalid_transition');
    if (v.proposedBy === this.d.personId()) throw new ApiError(403, 'self_approval_forbidden');
    await this.d.stepUp('spend_policy', { action: approve ? 'spend_policy_approve' : 'spend_policy_reject' });
    if (approve) {
      const old = this.inForce();
      old.state = 'SUPERSEDED';
    }
    v.state = approve ? 'ACTIVE' : 'REJECTED';
    v.decidedBy = this.d.personId();
    v.decidedByName = this.d.personName?.() ?? null;
    v.decidedAt = this.d.now();
    return this.d.log('spendDecidePolicy', v);
  };

  withdrawPolicy = async (version: number) => {
    this.require(Permission.SPEND_MANAGE);
    const v = this.versions.find((x) => x.version === version) ?? this.missing('policy');
    if (v.state !== 'PROPOSED') throw new ApiError(409, 'invalid_transition');
    if (v.proposedBy !== this.d.personId()) throw new ApiError(403, 'forbidden');
    v.state = 'WITHDRAWN';
    v.decidedBy = this.d.personId();
    v.decidedByName = this.d.personName?.() ?? null;
    v.decidedAt = this.d.now();
    return this.d.log('spendWithdrawPolicy', v);
  };

  private page(list: ExpenseView[], cursor?: string | null, limit = 50): Page<ExpenseView> {
    const sorted = [...list].sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.id.localeCompare(a.id));
    const start = cursor ? Number(cursor.replace('demo:', '')) || 0 : 0;
    const items = sorted.slice(start, start + limit);
    return { items, next: start + limit < sorted.length ? `demo:${start + limit}` : null };
  }

  expenses = async (f: ExpenseFilter, cursor?: string | null, limit?: number) => {
    this.require(Permission.SPEND_VIEW);
    const list = this.expensesState.filter(
      (x) =>
        (!f.employeeId || x.employeeId === f.employeeId) &&
        (!f.teamId || x.teamId === f.teamId) &&
        (!f.state || x.state === f.state) &&
        (!f.from || x.spentOn >= f.from) &&
        (!f.to || x.spentOn <= f.to),
    );
    return this.d.log('spendExpenses', this.page(list, cursor, limit));
  };

  expense = async (id: string) => {
    this.require(Permission.SPEND_VIEW);
    return this.d.log('spendExpense', this.findExpense(id));
  };

  private code(x: ExpenseView, c: CodingBody) {
    const p = this.inForce().policy;
    if (c.category != null && c.category !== '' && !p.categories.some((k) => k.key === c.category))
      throw new ApiError(422, 'validation_failed');
    if (c.taxCode != null && c.taxCode !== '' && !DEMO_SPEND_SETTINGS.taxCodes.includes(c.taxCode))
      throw new ApiError(422, 'validation_failed');
    if (c.vatMinor != null && (c.vatMinor < 0 || c.vatMinor > x.amount.amountMinor))
      throw new ApiError(422, 'validation_failed');
    if (c.note != null && c.note.length > 500) throw new ApiError(422, 'validation_failed');
    if (c.category !== undefined) x.category = c.category || null;
    if (c.taxCode !== undefined) x.taxCode = c.taxCode || null;
    if (c.vatMinor !== undefined) x.vat = c.vatMinor == null ? null : usd(c.vatMinor);
    if (c.note !== undefined) x.note = c.note?.trim() || null;
  }

  recode = async (id: string, coding: CodingBody) => {
    this.require(Permission.SPEND_MANAGE);
    const x = this.findExpense(id);
    if (x.state === 'EXPORTED' || x.state === 'REJECTED') throw new ApiError(409, 'invalid_transition');
    this.code(x, coding);
    return this.d.log('spendRecode', x);
  };

  decideExpense = async (id: string, approve: boolean, note?: string) => {
    this.require(Permission.SPEND_APPROVE);
    const x = this.findExpense(id);
    if (x.state !== 'PENDING_APPROVAL') throw new ApiError(409, 'invalid_transition');
    if (!approve && !note?.trim()) throw new ApiError(422, 'reason_required');
    const owner = this.employeesState.find((e) => e.id === x.employeeId);
    if (owner?.personId && owner.personId === this.d.personId()) {
      const p = this.inForce().policy;
      if (!approve || !p.selfApproval || x.amount.amountMinor > p.selfApprovalMaxMinor)
        throw new ApiError(403, 'self_approval_forbidden');
    }
    x.state = approve ? 'APPROVED' : 'REJECTED';
    x.decidedBy = this.d.personId();
    x.decidedByName = this.d.personName?.() ?? null;
    x.decidedAt = this.d.now();
    x.decisionNote = note?.trim() || null;
    return this.d.log('spendDecideExpense', x);
  };

  receipts = async () => {
    this.require(Permission.SPEND_VIEW);
    return this.d.log(
      'spendReceipts',
      this.receiptsState.filter((r) => r.state === 'UNMATCHED'),
    );
  };

  private attach(r: ReceiptView, x: ExpenseView, rule: 'ATTACHED' | 'AMOUNT_DATE' | 'MANUAL') {
    if (r.state === 'MATCHED') throw new ApiError(409, 'receipt_matched');
    if (x.receiptId) throw new ApiError(409, 'expense_has_receipt');
    Object.assign(r, { state: 'MATCHED', matchRule: rule, expenseId: x.id, candidates: [] });
    x.receiptId = r.id;
    x.receipt = 'ATTACHED';
  }

  matchReceipt = async (id: string, expenseId: string) => {
    this.require(Permission.SPEND_MANAGE);
    const r = this.receiptsState.find((x) => x.id === id) ?? this.missing('receipt');
    const x = this.findExpense(expenseId);
    if (x.employeeId !== r.employeeId) throw new ApiError(409, 'receipt_employee_mismatch');
    this.attach(r, x, 'MANUAL');
    return this.d.log('spendMatchReceipt', r);
  };

  private file(r: ReceiptView): Blob {
    return new Blob([samplePdf(`${r.fileName} ${r.hintMerchant ?? ''}`)], { type: r.contentType });
  }

  receiptFile = async (id: string) => {
    this.require(Permission.SPEND_VIEW);
    const r = this.receiptsState.find((x) => x.id === id) ?? this.missing('receipt');
    await this.d.log('spendReceiptFile', null);
    return this.file(r);
  };

  exports = async () => {
    this.require(Permission.SPEND_EXPORT);
    return this.d.log(
      'spendExports',
      this.exportsState.map((x) => ({ ...x, downloadUrl: null, downloadExpiresAt: null })),
    );
  };

  createExport = async (body: { from: string; to: string; format: string }) => {
    this.require(Permission.SPEND_EXPORT);
    const span = days(body.from, body.to) + 1;
    if (!(body.from <= body.to) || span > 366 || body.to > this.d.now().slice(0, 10))
      throw new ApiError(422, 'period_invalid');
    if (!DEMO_SPEND_SETTINGS.exportFormats.includes(body.format))
      throw new ApiError(422, 'format_unavailable');
    const inPeriod = this.expensesState.filter((x) => x.spentOn >= body.from && x.spentOn <= body.to);
    const lines = inPeriod.filter((x) => x.state === 'APPROVED');
    const left = (s: string) => inPeriod.filter((x) => x.state === s);
    const excluded = (
      [
        ['not_submitted', left('OPEN')],
        ['pending_approval', left('PENDING_APPROVAL')],
      ] as const
    )
      .filter(([, xs]) => xs.length)
      .map(([reason, xs]) => ({
        reason,
        count: xs.length,
        amount: usd(xs.reduce((n, x) => n + x.amount.amountMinor, 0)),
      }));
    lines.forEach((x) => (x.state = 'EXPORTED'));
    const ext = body.format === 'CSV' ? 'csv' : `${body.format.toLowerCase()}.csv`;
    const csv = [
      'Date,Employee,Merchant,Category,Amount,Currency,Expense id',
      ...lines.map((x) =>
        [
          x.spentOn,
          x.employeeName,
          x.merchant ?? '',
          x.category ?? '',
          (x.amount.amountMinor / 100).toFixed(2),
          x.amount.currency,
          x.id,
        ].join(','),
      ),
    ].join('\n');
    const view: ExportView = {
      id: this.next('spx'),
      from: body.from,
      to: body.to,
      format: body.format,
      lineCount: lines.length,
      total: usd(lines.reduce((n, x) => n + x.amount.amountMinor, 0)),
      excluded,
      fileName: `spend-${body.from}-${body.to}.${ext}`,
      createdAt: this.d.now(),
      downloadUrl: lines.length ? `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}` : null,
      downloadExpiresAt: lines.length ? new Date(Date.parse(this.d.now()) + 10 * 60_000).toISOString() : null,
    };
    this.exportsState.unshift(view);
    return this.d.log('spendCreateExport', view);
  };

  exportOne = async (id: string) => {
    this.require(Permission.SPEND_EXPORT);
    const x = this.exportsState.find((e) => e.id === id) ?? this.missing('export');
    return this.d.log('spendExport', x);
  };

  me = async () => {
    const me = this.mine();
    const p = this.inForce();
    const own = this.expensesState.filter((x) => x.employeeId === me.id);
    const month = this.d.now().slice(0, 7);
    const view: SpendMeView = {
      employee: this.view(me),
      companyId: 'cmp_demo_northwind',
      receiptsNeeded: own.filter((x) => x.state === 'OPEN' && x.receipt === 'MISSING').length,
      toSubmit: own.filter((x) => x.state === 'OPEN').length,
      monthSpent: usd(
        own
          .filter((x) => x.source === 'CARD' && x.spentOn.startsWith(month))
          .reduce((n, x) => n + x.amount.amountMinor, 0),
      ),
      policy: {
        version: p.version,
        receiptRequiredAbove: usd(p.policy.receiptRequiredAboveMinor),
        categories: p.policy.categories.map((c) => c.key),
        taxCodes: DEMO_SPEND_SETTINGS.taxCodes,
        receiptReminderHours: p.policy.receiptReminderHours,
      },
    };
    return this.d.log('spendMe', view);
  };

  myCard = async () => {
    const me = this.mine();
    return this.d.log('spendMyCard', me.card ?? this.missing('card'));
  };

  setMyCardFrozen = async (frozen: boolean) => {
    const me = this.mine();
    me.card = await this.freeze(me.card ?? this.missing('card'), frozen);
    return this.d.log('spendMyCardFrozen', me.card);
  };

  /** The simulator's widget: no bank script, so the screen draws sample data (never a real card number). */
  myCardWidget = async (kind: CardWidgetKind): Promise<CardWidgetSession> => {
    const me = this.mine();
    const c = me.card ?? this.missing('card');
    if (c.state !== 'ACTIVE' && c.state !== 'FROZEN') throw new ApiError(409, 'card_not_active');
    return this.d.log('spendMyCardWidget', {
      cardId: c.id,
      kind,
      token: `demo-widget-${c.id}`,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      environment: 'simulator',
      scriptUrl: null,
      element: null,
      last4: c.last4,
    } as CardWidgetSession);
  };

  myExpenses = async (state?: string, cursor?: string | null, limit?: number) => {
    const me = this.mine();
    const list = this.expensesState.filter((x) => x.employeeId === me.id && (!state || x.state === state));
    return this.d.log('spendMyExpenses', this.page(list, cursor, limit));
  };

  private myOne(id: string) {
    const me = this.mine();
    const x = this.expensesState.find((e) => e.id === id && e.employeeId === me.id);
    return x ?? this.missing('expense');
  }

  myExpense = async (id: string) => this.d.log('spendMyExpense', this.myOne(id));

  codeMyExpense = async (id: string, coding: CodingBody) => {
    const x = this.myOne(id);
    if (x.state !== 'OPEN') throw new ApiError(409, 'invalid_transition');
    this.code(x, coding);
    return this.d.log('spendCodeMyExpense', x);
  };

  submitMyExpense = async (id: string) => {
    const x = this.myOne(id);
    const me = this.mine();
    if (x.state !== 'OPEN') throw new ApiError(409, 'invalid_transition');
    if (!x.category) throw new ApiError(409, 'category_required');
    const v = this.inForce();
    const p = v.policy;
    if (!x.receiptId && x.amount.amountMinor > p.receiptRequiredAboveMinor && x.source === 'CARD')
      throw new ApiError(409, 'receipt_required');
    const view = this.view(me);
    const month = x.spentOn.slice(0, 7);
    const before = this.expensesState
      .filter(
        (e) => e.employeeId === me.id && e.id !== x.id && e.source === 'CARD' && e.spentOn.startsWith(month),
      )
      .reduce((n, e) => n + e.amount.amountMinor, 0);
    const reasons = [
      view.limits.perTransaction && x.amount.amountMinor > view.limits.perTransaction.amountMinor
        ? 'over_transaction_limit'
        : null,
      view.limits.monthly &&
      x.source === 'CARD' &&
      before + x.amount.amountMinor > view.limits.monthly.amountMinor
        ? 'over_monthly_limit'
        : null,
      p.categories.some((c) => c.key === x.category) ? null : 'category_not_allowed',
      x.source === 'CLAIM' && p.claimsNeedApproval ? 'claim' : null,
    ].filter((r): r is string => !!r);
    const auto = !reasons.length && p.autoApproveInPolicy;
    Object.assign(x, {
      state: auto ? 'APPROVED' : 'PENDING_APPROVAL',
      reasons,
      policyVersion: v.version,
      submittedAt: this.d.now(),
      decidedBy: auto ? `policy:v${v.version}` : null,
      decidedAt: auto ? this.d.now() : null,
    });
    return this.d.log('spendSubmitMyExpense', x);
  };

  claim = async (body: ClaimBody) => {
    const me = this.mine();
    if (
      !(body.amountMinor > 0) ||
      body.currency !== CURRENCY ||
      !body.merchant.trim() ||
      body.merchant.trim().length > 120 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.spentOn) ||
      body.spentOn > this.d.now().slice(0, 10)
    )
      throw new ApiError(422, 'validation_failed');
    const x = purchase(this.next('exp'), me, body.amountMinor, body.merchant.trim(), body.spentOn);
    Object.assign(x, {
      source: 'CLAIM',
      cardId: null,
      postedAt: null,
      receipt:
        body.amountMinor > this.inForce().policy.receiptRequiredAboveMinor ? 'MISSING' : 'NOT_REQUIRED',
      category: body.category || null,
      note: body.note?.trim() || null,
      createdAt: this.d.now(),
    });
    this.expensesState.push(x);
    return this.d.log('spendClaim', x);
  };

  myReceipts = async () => {
    const me = this.mine();
    const ids = new Set(this.expensesState.filter((x) => x.employeeId === me.id).map((x) => x.id));
    return this.d.log(
      'spendMyReceipts',
      this.receiptsState.filter((r) => (r.expenseId && ids.has(r.expenseId)) || r.id.includes('_mine_')),
    );
  };

  uploadReceipt = async (file: File, hints: ReceiptHints) => {
    const me = this.mine();
    if (file.size > DEMO_SPEND_SETTINGS.receiptMaxBytes) throw new ApiError(413, 'receipt_too_large');
    if (!DEMO_SPEND_SETTINGS.receiptTypes.includes(file.type))
      throw new ApiError(415, 'receipt_type_unsupported');
    const same = this.receiptsState.find((r) => r.fileName === file.name && r.sizeBytes === file.size);
    if (same) throw new ApiError(409, 'duplicate_receipt');
    const r: ReceiptView = {
      id: `rct_mine_${this.next('r')}`,
      employeeId: me.id,
      employeeName: `${me.firstName} ${me.lastName}`,
      expenseId: null,
      state: 'UNMATCHED',
      matchRule: null,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      hintAmount: hints.amountMinor ? usd(hints.amountMinor) : null,
      hintDate: hints.date ?? null,
      hintMerchant: hints.merchant ?? null,
      createdAt: this.d.now(),
      candidates: [],
    };
    const open = this.expensesState.filter(
      (x) => x.employeeId === me.id && x.state === 'OPEN' && !x.receiptId,
    );
    if (hints.expenseId) {
      const x = open.find((e) => e.id === hints.expenseId);
      if (!x) {
        const any = this.expensesState.find((e) => e.id === hints.expenseId && e.employeeId === me.id);
        if (!any) this.missing('expense');
        throw new ApiError(409, any.receiptId ? 'expense_has_receipt' : 'invalid_transition');
      }
      this.receiptsState.unshift(r);
      this.attach(r, x, 'ATTACHED');
    } else {
      const hits = open.filter(
        (x) =>
          hints.amountMinor === x.amount.amountMinor &&
          (!hints.date || days(hints.date, x.spentOn) <= MATCH_WINDOW_DAYS),
      );
      this.receiptsState.unshift(r);
      if (hits.length === 1) this.attach(r, hits[0]!, 'AMOUNT_DATE');
      else r.candidates = (hits.length ? hits : open).map((x) => x.id);
    }
    return this.d.log('spendUploadReceipt', r);
  };

  matchMyReceipt = async (id: string, expenseId: string) => {
    this.mine();
    const r = this.receiptsState.find((x) => x.id === id) ?? this.missing('receipt');
    const x = this.myOne(expenseId);
    if (x.state !== 'OPEN') throw new ApiError(409, 'invalid_transition');
    this.attach(r, x, 'MANUAL');
    return this.d.log('spendMatchMyReceipt', r);
  };

  myReceiptFile = async (id: string) => {
    this.mine();
    const r = this.receiptsState.find((x) => x.id === id) ?? this.missing('receipt');
    await this.d.log('spendMyReceiptFile', null);
    return this.file(r);
  };
}
