import type { CardWidgetKind } from './types';

/** The customer endpoints, one place, the same as ongem-app's ApiPaths. */
const q = encodeURIComponent;

export const paths = {
  me: '/v1/me',
  accounts: '/v1/accounts',
  account: (id: string) => `/v1/accounts/${q(id)}`,
  transactions: (id: string, limit: number) => `/v1/accounts/${q(id)}/transactions?limit=${limit}`,
  statements: (id: string) => `/v1/accounts/${q(id)}/statements`,
  statement: (id: string, period: string) => `/v1/accounts/${q(id)}/statements/${q(period)}`,
  recipients: '/v1/recipients',
  recipientPage: (cursor?: string | null) =>
    `/v1/recipients?limit=100${cursor ? `&cursor=${q(cursor)}` : ''}`,
  recipient: (id: string) => `/v1/recipients/${q(id)}`,
  payments: (cursor: string | null | undefined, limit: number) =>
    `/v1/payments?limit=${limit}${cursor ? `&cursor=${q(cursor)}` : ''}`,
  createPayment: '/v1/payments',
  payment: (id: string) => `/v1/payments/${q(id)}`,
  sendPayment: (id: string) => `/v1/payments/${q(id)}/send`,
  approvePayment: (id: string) => `/v1/payments/${q(id)}/approve`,
  rejectPayment: (id: string) => `/v1/payments/${q(id)}/reject`,
  fundingSources: '/v1/funding-sources',
  fundingSource: (id: string) => `/v1/funding-sources/${q(id)}`,
  topUps: '/v1/top-ups',
  cards: (cursor?: string | null) => `/v1/cards${cursor ? `?cursor=${q(cursor)}` : ''}`,
  card: (id: string) => `/v1/cards/${q(id)}`,
  cardWidget: (id: string, kind: CardWidgetKind) => `/v1/cards/${q(id)}/widget-token?kind=${kind}`,
  cardFreeze: (id: string, frozen: boolean) => `/v1/cards/${q(id)}/${frozen ? 'freeze' : 'unfreeze'}`,
  applications: '/v1/onboarding/applications',
  application: (id: string) => `/v1/onboarding/applications/${q(id)}`,
  ownerIdentity: (id: string, owner: string) =>
    `/v1/onboarding/applications/${q(id)}/owners/${q(owner)}/identity`,
  confirm: (id: string) => `/v1/onboarding/applications/${q(id)}/confirm`,
  submit: (id: string) => `/v1/onboarding/applications/${q(id)}/submit`,
  idCaptures: (id: string) => `/v1/onboarding/applications/${q(id)}/docv`,
  idCapture: (id: string, capture: string) => `/v1/onboarding/applications/${q(id)}/docv/${q(capture)}`,
  disclosuresRequired: '/v1/disclosures/required',
  disclosureVersion: (id: string) => `/v1/disclosures/versions/${q(id)}`,
  disclosureEvents: '/v1/disclosures/events',
  tickets: '/v1/support/tickets',
  ticket: (id: string) => `/v1/support/tickets/${q(id)}`,
  ticketMessages: (id: string) => `/v1/support/tickets/${q(id)}/messages`,
  ticketAttachments: (id: string) => `/v1/support/tickets/${q(id)}/attachments`,
  conversations: '/v1/assistant/conversations',
  messages: (id: string) => `/v1/assistant/conversations/${q(id)}/messages`,
  turnFeedback: (id: string) => `/v1/assistant/turns/${q(id)}/feedback`,
  confirmDraft: (id: string) => `/v1/assistant/drafts/${q(id)}/confirm`,
  abandonDraft: (id: string) => `/v1/assistant/drafts/${q(id)}/abandon`,
  recordingSessions: '/v1/recording/sessions',
  recordingEvents: (id: string) => `/v1/recording/sessions/${q(id)}/events`,
} as const;
