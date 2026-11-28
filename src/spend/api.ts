import type { OnGemApi } from '../api/client';
import { ApiError } from '../api/errors';
import type { Amount, CardWidgetKind, CardWidgetSession } from '../api/types';

/** OG-087 spend management: the shapes of the contract (WS outputs/review/og087-2026-11-28/spend-api.md). */
export type ProgramState = 'OFF' | 'ACTIVE' | 'SUSPENDED';
export type TeamState = 'ACTIVE' | 'ARCHIVED';
export type EmployeeState = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'OFFBOARDED';
export type PolicyState = 'PROPOSED' | 'ACTIVE' | 'SUPERSEDED' | 'REJECTED' | 'WITHDRAWN';
export type ExpenseState = 'OPEN' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXPORTED';
export type ReceiptStatus = 'NOT_REQUIRED' | 'MISSING' | 'ATTACHED';

export const EXPENSE_STATES: ExpenseState[] = [
  'OPEN',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'EXPORTED',
];
export const EMPLOYEE_STATES: EmployeeState[] = ['INVITED', 'ACTIVE', 'SUSPENDED', 'OFFBOARDED'];

export interface ProgramView {
  state: ProgramState;
  fundingAccountId?: string | null;
  currency?: string | null;
  policyVersion?: number | null;
  updatedAt?: string | null;
}

export interface LimitsView {
  perTransaction?: Amount | null;
  monthly?: Amount | null;
}

export interface SpendSettings {
  taxCodes: string[];
  receiptMaxBytes: number;
  receiptTypes: string[];
  exportFormats: string[];
  ceilings: LimitsView;
  categories: string[];
}

export interface TeamView {
  id: string;
  name: string;
  state: TeamState;
  employees: number;
  createdAt: string;
}

export interface CardSummary {
  id: string;
  last4: string;
  state: string;
  frozenBy?: string | null;
  createdAt: string;
}

export interface EmployeeView {
  id: string;
  /** The person linked once they signed in; null while INVITED. */
  personId?: string | null;
  firstName: string;
  lastName: string;
  emailHint: string;
  teamId?: string | null;
  teamName?: string | null;
  state: EmployeeState;
  linked: boolean;
  card?: CardSummary | null;
  limits: LimitsView;
  createdAt: string;
}

export interface SpendMeView {
  employee: EmployeeView;
  companyId: string;
  receiptsNeeded: number;
  toSubmit: number;
  monthSpent: Amount;
  policy: {
    version: number;
    receiptRequiredAbove: Amount;
    categories: string[];
    taxCodes: string[];
    receiptReminderHours: number;
  };
}

export interface LimitRule {
  perTransactionMinor?: number | null;
  monthlyMinor?: number | null;
}

export interface SpendPolicy {
  currency: string;
  receiptRequiredAboveMinor: number;
  perTransactionLimitMinor?: number | null;
  monthlyLimitMinor?: number | null;
  categories: { key: string; glAccount: string }[];
  autoApproveInPolicy: boolean;
  claimsNeedApproval: boolean;
  selfApproval: boolean;
  selfApprovalMaxMinor: number;
  receiptReminderHours: number;
  teams: Record<string, LimitRule>;
  employees: Record<string, LimitRule>;
}

export interface PolicyVersionView {
  version: number;
  state: PolicyState;
  policy: SpendPolicy;
  reason?: string | null;
  proposedBy: string;
  proposedByName?: string | null;
  decidedBy?: string | null;
  decidedByName?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

export interface PolicyOverview {
  active?: PolicyVersionView | null;
  proposed?: PolicyVersionView | null;
  versions: PolicyVersionView[];
}

export interface ExpenseView {
  id: string;
  employeeId: string;
  employeeName: string;
  teamId?: string | null;
  source: 'CARD' | 'CLAIM';
  cardId?: string | null;
  amount: Amount;
  merchant?: string | null;
  spentOn: string;
  postedAt?: string | null;
  state: ExpenseState;
  receipt: ReceiptStatus;
  receiptId?: string | null;
  category?: string | null;
  taxCode?: string | null;
  vat?: Amount | null;
  note?: string | null;
  reasons: string[];
  policyVersion?: number | null;
  submittedAt?: string | null;
  /** A person id, or `policy:v<N>` when the policy approved it. */
  decidedBy?: string | null;
  /** The deciding person's name; null when the policy decided or no name is known. */
  decidedByName?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  overLimit: boolean;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  next?: string | null;
}

export interface ReceiptView {
  id: string;
  /** Who uploaded it: a receipt matches only this employee's expenses. */
  employeeId: string;
  employeeName: string;
  expenseId?: string | null;
  state: 'UNMATCHED' | 'MATCHED';
  matchRule?: 'ATTACHED' | 'AMOUNT_DATE' | 'MANUAL' | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  hintAmount?: Amount | null;
  hintDate?: string | null;
  hintMerchant?: string | null;
  createdAt: string;
  candidates: string[];
}

export interface ExportView {
  id: string;
  from: string;
  to: string;
  format: string;
  lineCount: number;
  total: Amount;
  excluded: { reason: string; count: number; amount: Amount }[];
  fileName: string;
  createdAt: string;
  downloadUrl?: string | null;
  downloadExpiresAt?: string | null;
}

export interface CardBody {
  dateOfBirth: string;
  address: { line1: string; city: string; region: string; postalCode: string; country: string };
  phone?: string;
}

export interface CodingBody {
  category?: string | null;
  taxCode?: string | null;
  vatMinor?: number | null;
  note?: string | null;
}

export interface ClaimBody {
  amountMinor: number;
  currency: string;
  merchant: string;
  spentOn: string;
  category?: string;
  note?: string;
}

export interface ReceiptHints {
  expenseId?: string;
  amountMinor?: number;
  currency?: string;
  date?: string;
  merchant?: string;
}

export interface ExpenseFilter {
  employeeId?: string;
  teamId?: string;
  state?: string;
  from?: string;
  to?: string;
}

/** Everything the spend screens call; the live client and the demo answer the same. */
export interface SpendBackend {
  program(): Promise<ProgramView>;
  settings(): Promise<SpendSettings>;
  teams(): Promise<TeamView[]>;
  createTeam(name: string): Promise<TeamView>;
  updateTeam(id: string, patch: { name?: string; state?: 'ARCHIVED' }): Promise<TeamView>;
  employees(filter?: { teamId?: string; state?: string }): Promise<EmployeeView[]>;
  employee(id: string): Promise<EmployeeView>;
  createEmployee(body: {
    firstName: string;
    lastName: string;
    email: string;
    teamId?: string;
  }): Promise<EmployeeView>;
  moveEmployee(id: string, teamId: string): Promise<EmployeeView>;
  employeeAction(id: string, action: 'suspend' | 'reactivate' | 'offboard'): Promise<EmployeeView>;
  /** Step-up. [key] is reused when the same issue is tried again (503 bank_unavailable). */
  issueCard(id: string, body: CardBody, key?: string): Promise<EmployeeView>;
  /** Step-up. */
  setEmployeeCardFrozen(id: string, frozen: boolean): Promise<EmployeeView>;
  policy(): Promise<PolicyOverview>;
  proposePolicy(policy: SpendPolicy, reason?: string): Promise<PolicyVersionView>;
  /** Another person than the proposer, step-up. */
  decidePolicy(version: number, approve: boolean, note?: string): Promise<PolicyVersionView>;
  withdrawPolicy(version: number): Promise<PolicyVersionView>;
  expenses(filter: ExpenseFilter, cursor?: string | null, limit?: number): Promise<Page<ExpenseView>>;
  expense(id: string): Promise<ExpenseView>;
  recode(id: string, coding: CodingBody): Promise<ExpenseView>;
  decideExpense(id: string, approve: boolean, note?: string): Promise<ExpenseView>;
  receipts(): Promise<ReceiptView[]>;
  matchReceipt(id: string, expenseId: string): Promise<ReceiptView>;
  receiptFile(id: string): Promise<Blob>;
  exports(): Promise<ExportView[]>;
  createExport(body: { from: string; to: string; format: string }): Promise<ExportView>;
  exportOne(id: string): Promise<ExportView>;
  me(): Promise<SpendMeView>;
  myCard(): Promise<CardSummary>;
  /** Step-up. */
  setMyCardFrozen(frozen: boolean): Promise<CardSummary>;
  myCardWidget(kind: CardWidgetKind): Promise<CardWidgetSession>;
  myExpenses(state?: string, cursor?: string | null, limit?: number): Promise<Page<ExpenseView>>;
  myExpense(id: string): Promise<ExpenseView>;
  codeMyExpense(id: string, coding: CodingBody): Promise<ExpenseView>;
  submitMyExpense(id: string): Promise<ExpenseView>;
  claim(body: ClaimBody): Promise<ExpenseView>;
  myReceipts(): Promise<ReceiptView[]>;
  uploadReceipt(file: File, hints: ReceiptHints): Promise<ReceiptView>;
  matchMyReceipt(id: string, expenseId: string): Promise<ReceiptView>;
  myReceiptFile(id: string): Promise<Blob>;
}

const q = encodeURIComponent;
const BASE = '/v1/spend';

function query(params: Record<string, string | number | null | undefined>): string {
  const s = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${q(String(v))}`)
    .join('&');
  return s ? `?${s}` : '';
}

/** The spend endpoints, one place. */
export const spendPaths = {
  program: `${BASE}/program`,
  settings: `${BASE}/settings`,
  teams: `${BASE}/teams`,
  team: (id: string) => `${BASE}/teams/${q(id)}`,
  employees: (f: { teamId?: string; state?: string } = {}) => `${BASE}/employees${query(f)}`,
  employee: (id: string) => `${BASE}/employees/${q(id)}`,
  employeeAction: (id: string, action: string) => `${BASE}/employees/${q(id)}/${action}`,
  card: (id: string) => `${BASE}/employees/${q(id)}/card`,
  cardAction: (id: string, frozen: boolean) =>
    `${BASE}/employees/${q(id)}/card/${frozen ? 'freeze' : 'unfreeze'}`,
  policy: `${BASE}/policy`,
  versions: `${BASE}/policy/versions`,
  version: (v: number, action: 'approve' | 'reject' | 'withdraw') => `${BASE}/policy/versions/${v}/${action}`,
  expenses: (f: ExpenseFilter, cursor?: string | null, limit?: number) =>
    `${BASE}/expenses${query({ ...f, cursor, limit })}`,
  expense: (id: string) => `${BASE}/expenses/${q(id)}`,
  expenseAction: (id: string, approve: boolean) =>
    `${BASE}/expenses/${q(id)}/${approve ? 'approve' : 'reject'}`,
  receipts: `${BASE}/receipts`,
  receiptMatch: (id: string) => `${BASE}/receipts/${q(id)}/match`,
  receiptFile: (id: string) => `${BASE}/receipts/${q(id)}/file`,
  exports: `${BASE}/exports`,
  exportOne: (id: string) => `${BASE}/exports/${q(id)}`,
  me: `${BASE}/me`,
  myCard: `${BASE}/me/card`,
  myCardAction: (frozen: boolean) => `${BASE}/me/card/${frozen ? 'freeze' : 'unfreeze'}`,
  myWidget: (kind: CardWidgetKind) => `${BASE}/me/card/widget-token?kind=${kind}`,
  myExpenses: (state?: string, cursor?: string | null, limit?: number) =>
    `${BASE}/me/expenses${query({ state, cursor, limit })}`,
  myExpense: (id: string) => `${BASE}/me/expenses/${q(id)}`,
  mySubmit: (id: string) => `${BASE}/me/expenses/${q(id)}/submit`,
  myClaims: `${BASE}/me/expenses`,
  myReceipts: `${BASE}/me/receipts`,
  myReceiptMatch: (id: string) => `${BASE}/me/receipts/${q(id)}/match`,
  myReceiptFile: (id: string) => `${BASE}/me/receipts/${q(id)}/file`,
};

type Body = { json: unknown } | { form: FormData } | undefined;
type Caller = {
  call<T>(method: string, path: string, body?: Body, accept?: string, idempotencyKey?: string): Promise<T>;
};

const FILE_ACCEPT = '*/*';
const clampLimit = (n?: number) => (n === undefined ? undefined : Math.min(100, Math.max(1, n)));

/** The spend endpoints through the live client: bearer, a fresh Idempotency-Key per action, step-up retried once. */
export class LiveSpend implements SpendBackend {
  constructor(private readonly api: Caller) {}

  private get = <T>(path: string) => this.api.call<T>('GET', path);
  private post = <T>(path: string, json?: unknown, key?: string) =>
    this.api.call<T>('POST', path, json === undefined ? undefined : { json }, undefined, key);
  private patch = <T>(path: string, json: unknown) => this.api.call<T>('PATCH', path, { json });

  program = () => this.get<ProgramView>(spendPaths.program);
  settings = () => this.get<SpendSettings>(spendPaths.settings);
  teams = () => this.get<TeamView[]>(spendPaths.teams);
  createTeam = (name: string) => this.post<TeamView>(spendPaths.teams, { name });
  updateTeam = (id: string, patch: { name?: string; state?: 'ARCHIVED' }) =>
    this.patch<TeamView>(spendPaths.team(id), patch);
  employees = (filter: { teamId?: string; state?: string } = {}) =>
    this.get<EmployeeView[]>(spendPaths.employees(filter));
  employee = (id: string) => this.get<EmployeeView>(spendPaths.employee(id));
  createEmployee = (body: { firstName: string; lastName: string; email: string; teamId?: string }) =>
    this.post<EmployeeView>(spendPaths.employees(), body);
  moveEmployee = (id: string, teamId: string) =>
    this.patch<EmployeeView>(spendPaths.employee(id), { teamId });
  employeeAction = (id: string, action: 'suspend' | 'reactivate' | 'offboard') =>
    this.post<EmployeeView>(spendPaths.employeeAction(id, action));
  issueCard = (id: string, body: CardBody, key?: string) =>
    this.post<EmployeeView>(spendPaths.card(id), body, key);
  setEmployeeCardFrozen = (id: string, frozen: boolean) =>
    this.post<EmployeeView>(spendPaths.cardAction(id, frozen));
  policy = () => this.get<PolicyOverview>(spendPaths.policy);
  proposePolicy = (policy: SpendPolicy, reason?: string) =>
    this.post<PolicyVersionView>(spendPaths.versions, {
      policy,
      ...(reason?.trim() ? { reason: reason.trim() } : {}),
    });
  decidePolicy = (version: number, approve: boolean, note?: string) =>
    this.post<PolicyVersionView>(
      spendPaths.version(version, approve ? 'approve' : 'reject'),
      note?.trim() ? { note: note.trim() } : {},
    );
  withdrawPolicy = (version: number) => this.post<PolicyVersionView>(spendPaths.version(version, 'withdraw'));
  expenses = (filter: ExpenseFilter, cursor?: string | null, limit?: number) =>
    this.get<Page<ExpenseView>>(spendPaths.expenses(filter, cursor, clampLimit(limit)));
  expense = (id: string) => this.get<ExpenseView>(spendPaths.expense(id));
  recode = (id: string, coding: CodingBody) => this.patch<ExpenseView>(spendPaths.expense(id), coding);
  decideExpense = (id: string, approve: boolean, note?: string) =>
    this.post<ExpenseView>(spendPaths.expenseAction(id, approve), note?.trim() ? { note: note.trim() } : {});
  receipts = () => this.get<ReceiptView[]>(spendPaths.receipts);
  matchReceipt = (id: string, expenseId: string) =>
    this.post<ReceiptView>(spendPaths.receiptMatch(id), { expenseId });
  receiptFile = (id: string) =>
    this.api.call<Blob>('GET', spendPaths.receiptFile(id), undefined, FILE_ACCEPT);
  exports = () => this.get<ExportView[]>(spendPaths.exports);
  createExport = (body: { from: string; to: string; format: string }) =>
    this.post<ExportView>(spendPaths.exports, body);
  exportOne = (id: string) => this.get<ExportView>(spendPaths.exportOne(id));
  me = () => this.get<SpendMeView>(spendPaths.me);
  myCard = () => this.get<CardSummary>(spendPaths.myCard);
  setMyCardFrozen = (frozen: boolean) => this.post<CardSummary>(spendPaths.myCardAction(frozen));
  myCardWidget = (kind: CardWidgetKind) => this.get<CardWidgetSession>(spendPaths.myWidget(kind));
  myExpenses = (state?: string, cursor?: string | null, limit?: number) =>
    this.get<Page<ExpenseView>>(spendPaths.myExpenses(state, cursor, clampLimit(limit)));
  myExpense = (id: string) => this.get<ExpenseView>(spendPaths.myExpense(id));
  codeMyExpense = (id: string, coding: CodingBody) =>
    this.patch<ExpenseView>(spendPaths.myExpense(id), coding);
  submitMyExpense = (id: string) => this.post<ExpenseView>(spendPaths.mySubmit(id));
  claim = (body: ClaimBody) => this.post<ExpenseView>(spendPaths.myClaims, body);
  myReceipts = () => this.get<ReceiptView[]>(spendPaths.myReceipts);
  uploadReceipt = (file: File, hints: ReceiptHints) => {
    const form = new FormData();
    form.append('file', file, file.name);
    for (const [k, v] of Object.entries(hints))
      if (v !== undefined && v !== null && v !== '') form.append(k, String(v));
    return this.api.call<ReceiptView>('POST', spendPaths.myReceipts, { form });
  };
  matchMyReceipt = (id: string, expenseId: string) =>
    this.post<ReceiptView>(spendPaths.myReceiptMatch(id), { expenseId });
  myReceiptFile = (id: string) =>
    this.api.call<Blob>('GET', spendPaths.myReceiptFile(id), undefined, FILE_ACCEPT);
}

const OFF: ProgramView = { state: 'OFF' };

/** A demo client without spend answers OFF and refuses the rest, as the core does for a company without a programme. */
const off = new Proxy({} as SpendBackend, {
  get: (_t, name) =>
    name === 'program'
      ? () => Promise.resolve(OFF)
      : () => Promise.reject(new ApiError(409, 'spend_not_enabled')),
});

const live = new WeakMap<OnGemApi, SpendBackend>();

/** The spend calls of [api]: the live client's endpoints, or the demo's sample spend. */
export function spendOf(api: OnGemApi): SpendBackend {
  if (api.kind === 'live') {
    let s = live.get(api);
    if (!s) {
      s = new LiveSpend(api as unknown as Caller);
      live.set(api, s);
    }
    return s;
  }
  return (api as unknown as { spend?: SpendBackend }).spend ?? off;
}
