import type {
  Account,
  AssistantDraft,
  AssistantTurn,
  Conversation,
  RecordedEvent,
  RecordingSession,
  Application,
  Card,
  CardPage,
  CardWidgetKind,
  CardWidgetSession,
  CreatePayment,
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
  TicketDetail,
  TicketSummary,
  Transaction,
} from './types';

/** The customer API as the founder web uses it: call for call the same as ongem-app's OnGemApi.kt. */
export interface OnGemApi {
  readonly kind: 'demo' | 'live';
  me(): Promise<Me>;
  accounts(): Promise<Account[]>;
  account(id: string): Promise<Account>;
  /** Newest first; the API pages by limit (1 to 100), so the next page asks for a longer list. */
  transactions(accountId: string, limit: number): Promise<Transaction[]>;
  statements(accountId: string): Promise<StatementRef[]>;
  statement(accountId: string, period: string): Promise<Statement>;
  recipients(): Promise<Recipient[]>;
  /** Step-up: a 403 reverification_required is answered before this returns. */
  createRecipient(request: CreateRecipient): Promise<Recipient>;
  archiveRecipient(id: string): Promise<Recipient>;
  payments(cursor?: string | null, limit?: number): Promise<PaymentPage>;
  payment(id: string): Promise<Payment>;
  createPayment(request: CreatePayment): Promise<Payment>;
  /** Step-up, the same Idempotency-Key on the retry. */
  sendPayment(id: string): Promise<Payment>;
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
  requiredDisclosures(): Promise<RequiredDisclosure[]>;
  disclosureText(versionId: string): Promise<DisclosureText>;
  recordDisclosure(versionId: string, kind: string): Promise<DisclosureEventView>;
  tickets(): Promise<TicketSummary[]>;
  ticket(id: string): Promise<TicketDetail>;
  openTicket(request: OpenTicket): Promise<TicketDetail>;
  replyToTicket(id: string, body: string): Promise<TicketDetail>;
  attachToTicket(id: string, file: File): Promise<TicketDetail>;
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
  RECIPIENT_MANAGE: 'recipient:manage',
  CARD_MANAGE: 'card:manage',
  ONBOARDING_MANAGE: 'onboarding:manage',
} as const;

export function permissionsOf(role: string | null | undefined): Set<string> {
  const p = Permission;
  switch ((role ?? '').toUpperCase()) {
    case 'OWNER':
      return new Set(Object.values(p));
    case 'ADMIN':
      return new Set([p.RECIPIENT_MANAGE, p.PAYMENT_CREATE, p.PAYMENT_VIEW, p.CARD_MANAGE, p.ACCOUNT_VIEW]);
    case 'APPROVER':
      return new Set([p.PAYMENT_VIEW, p.ACCOUNT_VIEW]);
    case 'MEMBER':
      return new Set([p.PAYMENT_CREATE, p.PAYMENT_VIEW, p.RECIPIENT_MANAGE, p.ACCOUNT_VIEW]);
    case 'VIEWER':
      return new Set([p.ACCOUNT_VIEW, p.PAYMENT_VIEW]);
    default:
      return new Set();
  }
}
