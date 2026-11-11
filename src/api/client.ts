import type {
  Account,
  AssistantDraft,
  AssistantTurn,
  Conversation,
  IdCapture,
  IdDocument,
  RecordedEvent,
  RecordingSession,
  Application,
  Card,
  CardPage,
  CardWidgetKind,
  CardWidgetSession,
  CreatePayment,
  CreateTopUp,
  CreateSchedule,
  PaymentSchedule,
  FundingSource,
  LinkFundingSource,
  CreateRecipient,
  DisclosureEventView,
  DisclosureText,
  Me,
  OpenTicket,
  Owner,
  OwnerIdentity,
  Payment,
  PaymentPage,
  Recipient,
  RequiredDisclosure,
  Statement,
  StatementRef,
  ExportLink,
  ExportRequest,
  ExportRun,
  TicketDetail,
  TicketSummary,
  Transaction,
  DeviceView,
  Inbox,
  InviteAccepted,
  InviteCreated,
  InviteView,
  NotificationPreferences,
  PreferenceChange,
} from './types';
import type { Whereami } from './live';

/** The customer API as the founder web uses it: call for call the same as ongem-app's OnGemApi.kt. */
export interface OnGemApi {
  readonly kind: 'demo' | 'live';
  /** The company every call of this client runs in (X-Company-Id, G-69); null is the person's default company. */
  readonly companyId: string | null;
  /** A new client for [companyId], so nothing the screens loaded for the previous company is reused (G-69). */
  forCompany(companyId: string | null): OnGemApi;
  /** OG-023 R12: the region whose API this client calls (US or AE). */
  readonly region: string;
  /**
   * The same person on [region]'s API, in their default company there; null when this build knows no API for that
   * region. The client's own region answers itself.
   */
  forRegion(region: string): OnGemApi | null;
  /**
   * OG-022 R2, R25: where the person's company lives, asked before anything else on a region that may not know the
   * person; it writes nothing and binds no device. No company and no region means that region does not hold them.
   */
  whereami(): Promise<Whereami>;
  /** OG-023 R6: the company's invitations, newest first (member:invite). */
  invites(companyId: string): Promise<InviteView[]>;
  /** A role no wider than the caller's; the token and link come back this once. 409 invite_exists. */
  createInvite(companyId: string, request: { email: string; role: string }): Promise<InviteCreated>;
  revokeInvite(companyId: string, inviteId: string): Promise<InviteView>;
  /** OG-023 R7: 410 invite_not_valid, 403 invite_email_mismatch, 409 membership_limit. */
  acceptInvite(token: string): Promise<InviteAccepted>;
  me(): Promise<Me>;
  /** FA-029: the person's bound devices (GET /v1/devices), newest first. */
  devices(): Promise<DeviceView[]>;
  /** FA-029: signs a device out for good (DELETE /v1/devices/{id}); its next call is refused. */
  revokeDevice(id: string): Promise<void>;
  accounts(): Promise<Account[]>;
  account(id: string): Promise<Account>;
  /** Newest first; the API pages by limit (1 to 100), so the next page asks for a longer list. */
  transactions(accountId: string, limit: number): Promise<Transaction[]>;
  statements(accountId: string): Promise<StatementRef[]>;
  statement(accountId: string, period: string): Promise<Statement>;
  /** OG-024: queues an export of the account's posted activity; 202 with the run (QUEUED). Needs export:create. */
  requestExport(accountId: string, request: ExportRequest): Promise<ExportRun>;
  /** Newest first, without links. */
  exports(accountId: string): Promise<ExportRun[]>;
  /** One run; a DONE run carries a fresh 15 minute link. */
  exportRun(accountId: string, runId: string): Promise<ExportRun>;
  /** A fresh link to a DONE run's file (429 rate_limited over the hourly limit). */
  exportLink(accountId: string, runId: string): Promise<ExportLink>;
  recipients(): Promise<Recipient[]>;
  /** Step-up: a 403 reverification_required is answered before this returns. */
  createRecipient(request: CreateRecipient): Promise<Recipient>;
  archiveRecipient(id: string): Promise<Recipient>;
  payments(cursor?: string | null, limit?: number): Promise<PaymentPage>;
  payment(id: string): Promise<Payment>;
  createPayment(request: CreatePayment): Promise<Payment>;
  /** Step-up, the same Idempotency-Key on the retry. */
  sendPayment(id: string): Promise<Payment>;
  /** A second person approves a payment waiting in PENDING_APPROVAL (not its maker); step-up. */
  approvePayment(id: string): Promise<Payment>;
  /** A second person declines it; it ends REJECTED and nothing moves. */
  rejectPayment(id: string): Promise<Payment>;
  /** G-40: the company's own accounts at other banks, not removed, newest first. */
  fundingSources(): Promise<FundingSource[]>;
  /** One, read again at the bank: an UNVERIFIED one becomes VERIFIED once the bank holds it so. */
  fundingSource(id: string): Promise<FundingSource>;
  /** Step-up. Typed in, so it starts UNVERIFIED. */
  linkFundingSource(request: LinkFundingSource): Promise<FundingSource>;
  /** Step-up. A top-up already sent is not affected. */
  removeFundingSource(id: string): Promise<FundingSource>;
  /** Step-up. An ACH debit from a VERIFIED funding source; the answer is the payment, often PENDING_APPROVAL. */
  createTopUp(request: CreateTopUp): Promise<Payment>;
  /** G-120: the company's scheduled payments, newest first, without their runs. */
  schedules(): Promise<PaymentSchedule[]>;
  /** One schedule with its latest runs. */
  schedule(id: string): Promise<PaymentSchedule>;
  /** Step-up. ACH only until the bank confirms scheduled internal transfers (Q-128). */
  createSchedule(request: CreateSchedule): Promise<PaymentSchedule>;
  pauseSchedule(id: string): Promise<PaymentSchedule>;
  /** Step-up. Active again from today; dates passed while paused are not made. */
  resumeSchedule(id: string): Promise<PaymentSchedule>;
  cancelSchedule(id: string): Promise<PaymentSchedule>;
  cards(cursor?: string | null): Promise<CardPage>;
  card(id: string): Promise<Card>;
  setCardFrozen(id: string, frozen: boolean): Promise<Card>;
  /** Step-up: a five minute token for the bank's card widget; never stored. */
  cardWidget(id: string, kind: CardWidgetKind): Promise<CardWidgetSession>;
  applications(): Promise<Application[]>;
  application(id: string): Promise<Application>;
  putOwnerIdentity(applicationId: string, ownerId: string, identity: OwnerIdentity): Promise<Owner>;
  confirmApplication(id: string): Promise<Application>;
  submitApplication(id: string): Promise<Application>;
  /**
   * G-111: starts the caller's own ID capture; `captureUrl` is in this answer only. With [sendSms] the bank also texts
   * the link to the phone it holds.
   */
  startIdCapture(applicationId: string, document: IdDocument, sendSms: boolean): Promise<IdCapture>;
  /** The caller's own capture sessions, newest first. */
  idCaptures(applicationId: string): Promise<IdCapture[]>;
  /** One session, its status read again from the bank. */
  idCapture(applicationId: string, captureId: string): Promise<IdCapture>;
  requiredDisclosures(): Promise<RequiredDisclosure[]>;
  disclosureText(versionId: string): Promise<DisclosureText>;
  recordDisclosure(versionId: string, kind: string): Promise<DisclosureEventView>;
  tickets(): Promise<TicketSummary[]>;
  ticket(id: string): Promise<TicketDetail>;
  openTicket(request: OpenTicket): Promise<TicketDetail>;
  replyToTicket(id: string, body: string): Promise<TicketDetail>;
  attachToTicket(id: string, file: File): Promise<TicketDetail>;
  // OG-014: the person's notices and notification choices; nothing here moves money, so no step-up.
  /** Newest first, in the company the person acts in; `unread` only unread ones. */
  notifications(opts?: { unread?: boolean; limit?: number }): Promise<Inbox>;
  readNotification(id: string): Promise<Inbox>;
  readAllNotifications(): Promise<Inbox>;
  notificationPreferences(): Promise<NotificationPreferences>;
  /** 422 mandatory_kind when email is turned off for a mandatory kind. */
  setNotificationPreferences(kinds: PreferenceChange[]): Promise<NotificationPreferences>;
  /** OG-033 R10: the person's language for notices (PUT /v1/me/preferences). */
  setLocale(locale: 'en' | 'ar'): Promise<void>;
  /** International form (E.164); a 6-digit code is sent to it. */
  setSmsNumber(number: string): Promise<NotificationPreferences>;
  /** 422 sms_code_invalid or sms_code_expired, 429 sms_code_locked. */
  verifySmsNumber(code: string): Promise<NotificationPreferences>;
  // OG-031: the assistant (reads and drafts only) and screen and action recording.
  startConversation(channel: string, recordingSessionId?: string | null): Promise<Conversation>;
  sendAssistantMessage(conversationId: string, text: string): Promise<AssistantTurn>;
  rateAssistantTurn(turnId: string, rating: 'UP' | 'DOWN'): Promise<AssistantTurn>;
  /** The founder did the drafted action in the normal screen; step-up for money, card and recipient kinds. */
  confirmAssistantDraft(draftId: string, resultRef: string): Promise<AssistantDraft>;
  abandonAssistantDraft(draftId: string): Promise<AssistantDraft>;
  startRecording(platform: string, appVersion?: string): Promise<RecordingSession>;
  recordEvents(sessionId: string, events: RecordedEvent[]): Promise<{ stored: number }>;
}

/** What a company role may do, mirroring ongem-core's Role (identity/access/Access.kt) and ongem-app's Permissions. */
export const Permission = {
  ACCOUNT_VIEW: 'account:view',
  PAYMENT_VIEW: 'payment:view',
  PAYMENT_CREATE: 'payment:create',
  PAYMENT_APPROVE: 'payment:approve',
  RECIPIENT_MANAGE: 'recipient:manage',
  CARD_MANAGE: 'card:manage',
  ONBOARDING_MANAGE: 'onboarding:manage',
  MEMBER_INVITE: 'member:invite',
  /** OG-024: export an account's activity; OWNER only (ongem-core seeds it for OWNER alone). */
  EXPORT_CREATE: 'export:create',
} as const;

/** The permissions a FROZEN, CLOSING or CLOSED company keeps (OG-023 R13): reading only. */
export const READ_ONLY = new Set<string>([Permission.ACCOUNT_VIEW, Permission.PAYMENT_VIEW]);

/** The roles, widest first, as ongem-core's Role lists them. */
export const ROLES = ['OWNER', 'ADMIN', 'APPROVER', 'MEMBER', 'VIEWER'] as const;

/** The roles [role] may invite to (OG-023 R6): those granting nothing [role] does not hold. */
export function invitableRoles(role: string | null | undefined): string[] {
  const mine = permissionsOf(role);
  return ROLES.filter((r) => [...permissionsOf(r)].every((p) => mine.has(p)));
}

export function permissionsOf(role: string | null | undefined): Set<string> {
  const p = Permission;
  switch ((role ?? '').toUpperCase()) {
    case 'OWNER':
      return new Set(Object.values(p));
    case 'ADMIN':
      return new Set([
        p.MEMBER_INVITE,
        p.RECIPIENT_MANAGE,
        p.PAYMENT_CREATE,
        p.PAYMENT_VIEW,
        p.CARD_MANAGE,
        p.ACCOUNT_VIEW,
      ]);
    case 'APPROVER':
      return new Set([p.PAYMENT_APPROVE, p.PAYMENT_VIEW, p.ACCOUNT_VIEW]);
    case 'MEMBER':
      return new Set([p.PAYMENT_CREATE, p.PAYMENT_VIEW, p.RECIPIENT_MANAGE, p.ACCOUNT_VIEW]);
    case 'VIEWER':
      return new Set([p.ACCOUNT_VIEW, p.PAYMENT_VIEW]);
    default:
      return new Set();
  }
}
