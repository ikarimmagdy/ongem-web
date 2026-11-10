/** The customer API's shapes, as ongem-app's models read them (shared/.../model/*.kt). Money is always minor units. */
export interface Amount {
  amountMinor: number;
  currency: string;
  display?: string;
}

export interface Membership {
  id: string;
  companyId: string;
  companyName?: string;
  role: string;
  state: string;
  companyStatus?: string;
  /** OG-023 R13: the company's lifecycle state; FROZEN, CLOSING and CLOSED open read-only. */
  companyState?: CompanyState;
  /** OG-023 R14: unread notices of this person in this company. */
  unreadNotices?: number;
  /** OG-023 R12: the region whose API answered this membership; set by the client when it merges both regions. */
  region?: string;
}

export type CompanyState = 'ACTIVE' | 'FROZEN' | 'CLOSING' | 'CLOSED';

/** OG-023 R6: an invitation to the company, as the inviting members see it. */
export interface InviteView {
  id: string;
  email: string;
  role: string;
  state: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
  invitedBy: string;
}

/** The answer to a new invitation: the token and its link come back this once only. */
export interface InviteCreated {
  invite: InviteView;
  token: string;
  acceptUrl: string;
}

/** OG-023 R7: the membership an accepted invitation made. */
export interface InviteAccepted {
  membershipId: string;
  companyId: string;
  companyName?: string | null;
  role: string;
}

export interface Me {
  personId: string;
  tenantId: string;
  companyId?: string | null;
  email?: string | null;
  legalFirstName?: string | null;
  legalLastName?: string | null;
  providerState?: string;
  memberships: Membership[];
  issuer?: string | null;
}

export interface Balance {
  posted: Amount;
  available: Amount;
  asOf: string;
  stale?: boolean;
}

export interface Account {
  id: string;
  name: string;
  last4?: string | null;
  status: string;
  currency: string;
  balance?: Balance | null;
}

export interface Transaction {
  id: string;
  stage: string;
  direction: string;
  amount: Amount;
  rail?: string | null;
  origin: string;
  effectiveDate?: string | null;
  postedAt?: string | null;
}

export interface StatementRef {
  period: string;
}

export interface StatementLine {
  date?: string | null;
  direction: string;
  amount: Amount;
  rail?: string | null;
}

export interface Statement {
  period: string;
  opening: Amount;
  closing: Amount;
  transactions: StatementLine[];
}

export interface Recipient {
  id: string;
  kind: string;
  name: string;
  accountLast4: string;
  /** US only; an AE recipient is paid by IBAN, of which only the last four come back. */
  routingNumber?: string | null;
  accountType: string;
  screening: string;
  status: string;
  createdAt?: string | null;
}

/** POST /v1/recipients. Built when the form is sent; never kept in screen state. */
export interface CreateRecipient {
  kind: string;
  name: string;
  /** US: account and routing number. AE (OG-022 R18): the UAE IBAN instead. */
  accountNumber?: string;
  routingNumber?: string;
  iban?: string;
  accountType: string;
}

export interface PaymentTransition {
  from?: string | null;
  to: string;
  at: string;
}

export interface Payment {
  id: string;
  state: string;
  rail: string;
  achTiming?: string | null;
  amount: Amount;
  fromAccountId: string;
  recipientId?: string | null;
  toAccountId?: string | null;
  /** OG-023 R11: set on a transfer to an account of another of the person's companies. */
  toCompanyId?: string | null;
  reference?: string | null;
  providerReference?: string | null;
  failureCode?: string | null;
  timeline: PaymentTransition[];
  createdAt?: string | null;
  returnCode?: string | null;
  returnReason?: string | null;
  /** G-40: set on a top-up, an ACH debit from the company's own account at another bank into `fromAccountId`. */
  fundingSourceId?: string | null;
  /**
   * Q-091: who approves a payment in PENDING_APPROVAL. COMPANY: another person of the company; ONGEM: OnGem ops,
   * because nobody but its maker can approve. Absent in any other state.
   */
  approvalBy?: 'COMPANY' | 'ONGEM' | null;
}

/**
 * G-40: the company's own account at another bank, for top-ups. UNVERIFIED (typed in; the bank has not verified it, so
 * nothing can be pulled from it yet), VERIFIED (top-ups allowed) or REMOVED. Only the last four digits come back.
 */
export interface FundingSource {
  id: string;
  accountId: string;
  method: string;
  aggregator?: string | null;
  nickname?: string | null;
  last4: string;
  routingNumber?: string | null;
  accountType?: string | null;
  state: 'UNVERIFIED' | 'VERIFIED' | 'REMOVED' | string;
  createdAt: string;
  verifiedAt?: string | null;
}

/** POST /v1/funding-sources, typed in (MANUAL). The account number exists only inside this request. */
export interface LinkFundingSource {
  accountId: string;
  method: 'MANUAL';
  /** US: account and routing number. AE (OG-022 R18): the UAE IBAN instead. */
  accountNumber?: string;
  routingNumber?: string;
  iban?: string;
  accountType: 'CHECKING' | 'SAVINGS' | 'CURRENT';
  ownerName: string;
  nickname?: string | null;
}

/** G-120: one run of a schedule. DUE (waiting for its attempt or a retry), SENT (its payment was made), SKIPPED, FAILED or CANCELLED. */
export interface ScheduleRun {
  id: string;
  occurrence: number;
  runOn: string;
  state: string;
  attempts: number;
  paymentId?: string | null;
  failureCode?: string | null;
  nextAttemptAt?: string | null;
}

/**
 * G-120: a scheduled ACH that OnGem runs itself; each run is a payment through the normal path. ACTIVE, PAUSED,
 * CANCELLED or COMPLETED; `nextRunOn` is the next date a run is made (bank time), none when it will not run again.
 */
export interface PaymentSchedule {
  id: string;
  fromAccountId: string;
  recipientId: string;
  rail: string;
  amount: Amount;
  reference?: string | null;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | string;
  interval: number;
  startDate: string;
  endDate?: string | null;
  count?: number | null;
  state: string;
  nextRunOn?: string | null;
  runsMade: number;
  createdAt: string;
  runs: ScheduleRun[];
}

/** POST /v1/payment-schedules: ends on `endDate`, after `count` runs, or never (both empty). */
export interface CreateSchedule {
  fromAccountId: string;
  recipientId: string;
  rail: 'ACH' | 'UAEFTS';
  amountMinor: number;
  currency: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  interval: number;
  startDate: string;
  endDate?: string | null;
  count?: number | null;
  reference?: string | null;
}

/** POST /v1/top-ups. */
export interface CreateTopUp {
  fundingSourceId: string;
  toAccountId: string;
  amountMinor: number;
  currency: string;
  reference?: string | null;
}

export interface RecipientPage {
  items: Recipient[];
  next?: string | null;
}

export interface PaymentPage {
  items: Payment[];
  next?: string | null;
}

export interface CreatePayment {
  fromAccountId: string;
  recipientId?: string | null;
  toAccountId?: string | null;
  rail: 'ACH' | 'BOOK' | 'INTERNAL' | 'AANI' | 'UAEFTS';
  achTiming?: string | null;
  amountMinor: number;
  currency: string;
  reference?: string | null;
}

export interface Card {
  id: string;
  holderName: string;
  fundingAccountId: string;
  form: string;
  last4: string;
  state: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** The bank's card widgets: number, CVV and expiry; the PIN; setting the PIN; activating a physical card. */
export type CardWidgetKind = 'REVEAL' | 'GET_PIN' | 'SET_PIN' | 'ACTIVATE';

/**
 * A five minute session for the bank's widget (ongem-core `openCardWidget`). The number and PIN stay in the bank's
 * frame; `scriptUrl` and `element` are null for the simulator, which the app draws itself from sample data.
 */
export interface CardWidgetSession {
  cardId: string;
  kind: CardWidgetKind;
  token: string;
  expiresAt: string;
  environment: 'production' | 'sandbox' | 'simulator' | string;
  scriptUrl?: string | null;
  element?: string | null;
  last4: string;
}

export interface CardPage {
  items: Card[];
  next?: string | null;
}

export interface Owner {
  id: string;
  ref: string;
  name: string;
  ownershipPercent: number;
  controlRole?: string | null;
  founder: boolean;
  idType?: string | null;
  idLast4?: string | null;
  idCountry?: string | null;
  atBank: boolean;
}

export interface Application {
  id: string;
  companyId: string;
  state: string;
  owners: Owner[];
  requirements: string[];
}

/** The ID documents the bank's capture accepts (G-111). */
export type IdDocument = 'DRIVERS_LICENSE' | 'PASSPORT' | 'ID_CARD';

/**
 * The founder's own ID capture session (G-111, POST and GET /v1/onboarding/applications/{id}/docv). `stage` is WAITING
 * (no photos yet), CAPTURED (the bank is checking) or VERIFIED (`kycStatus` is the bank's answer). `captureUrl` comes back
 * once, in the answer to the start, and is never kept.
 */
export interface IdCapture {
  id: string;
  ownerId: string;
  document: IdDocument | string;
  stage: 'WAITING' | 'CAPTURED' | 'VERIFIED' | string;
  kycStatus: string | null;
  smsRequested: boolean;
  createdAt: string;
  updatedAt: string;
  captureUrl: string | null;
}

/** PUT .../owners/{ownerId}/identity. The number exists only inside this request. */
export interface OwnerIdentity {
  idType: string;
  number: string;
  country: string;
}

export interface RequiredDisclosure {
  versionId: string;
  type: string;
  version: string;
  title: string;
  sha256: string;
  subject: string;
  acknowledged: boolean;
  recorded: boolean;
}

export interface DisclosureText {
  versionId: string;
  type: string;
  version: string;
  title: string;
  text: string;
}

export interface DisclosureEventView {
  id: string;
  versionId: string;
  kind: string;
  syncState: string;
}

export interface TicketSummary {
  id: string;
  subject: string;
  category: string;
  status: string;
  openedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  authorKind: string;
  authorName: string;
  body: string;
  at: string;
}

export interface TicketAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  at: string;
}

export interface TicketDetail {
  ticket: TicketSummary;
  resolution?: string | null;
  messages: TicketMessage[];
  attachments: TicketAttachment[];
}

export interface OpenTicket {
  subject: string;
  category: string;
  body: string;
}

/** OG-031: the assistant's answer for one message. It never ran a write; a draft waits for the founder. */
export interface AssistantDraft {
  id: string;
  kind: string;
  operations: string[];
  params: Record<string, unknown>;
  summary: string;
  state: 'OPEN' | 'CONFIRMED' | 'ABANDONED';
  resultRef?: string | null;
}

export interface AssistantTurn {
  id: string;
  seq: number;
  text: string;
  reply: string;
  outcome: string;
  reads: Array<{ tool: string; operationId: string; ok: boolean; errorCode?: string | null }>;
  draft?: AssistantDraft | null;
  provider: string;
  model: string;
  latencyMs: number;
  rating?: string | null;
}

export interface Conversation {
  id: string;
  channel: string;
  startedAt: string;
  turns: AssistantTurn[];
}

/** OG-031 R5: one recorded event, masked when it is created. */
export interface RecordedEvent {
  seq: number;
  at: string;
  type: 'SCREEN' | 'ACTION' | 'RRWEB';
  name?: string;
  props?: Record<string, unknown>;
  payload?: unknown;
}

export interface RecordingSession {
  id: string;
  platform: string;
}

/** OG-014: one notice in the person's inbox (`GET /v1/notifications`); `link` is a screen path such as `payments/<id>`. */
export interface NoticeView {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  mandatory: boolean;
  occurredAt: string;
  createdAt: string;
  readAt: string | null;
}

/** The inbox in the company the person acts in; `unread` is the count of unread notices. */
export interface Inbox {
  items: NoticeView[];
  unread: number;
}

export interface KindPreference {
  kind: string;
  label: string;
  mandatory: boolean;
  email: boolean;
  sms: boolean;
}

/** The person's notification choices; the SMS number shows its last 4 digits only. */
export interface NotificationPreferences {
  kinds: KindPreference[];
  smsNumberLast4: string | null;
  smsVerified: boolean;
}

/** A change to one kind; a field left out keeps its value. */
export interface PreferenceChange {
  kind: string;
  email?: boolean;
  sms?: boolean;
}

/** OG-024: an export run of an account's posted activity (contract exports-api.md). */
export type ExportState = 'QUEUED' | 'RUNNING' | 'DONE' | 'REFUSED' | 'FAILED';

export interface ExportLink {
  url: string;
  expiresAt: string;
}

export interface ExportRun {
  id: string;
  accountId: string;
  state: ExportState;
  from: string;
  to: string;
  format: string;
  /** statement_mismatch, format_unavailable, account_not_found or technical. */
  reason: string | null;
  cutoffAt: string | null;
  lineCount: number | null;
  sha256: string | null;
  fileName: string | null;
  reexportOf: string | null;
  requestedAt: string;
  finishedAt: string | null;
  /** A fresh link on a DONE run read by itself; null in a list. */
  link: ExportLink | null;
}

/** A month (YYYY-MM) or a range of posted dates, and a format. */
export interface ExportRequest {
  month?: string;
  from?: string;
  to?: string;
  format: string;
}
