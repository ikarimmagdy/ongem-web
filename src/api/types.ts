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
  routingNumber: string;
  accountType: string;
  screening: string;
  status: string;
  createdAt?: string | null;
}

/** POST /v1/recipients. Built when the form is sent; never kept in screen state. */
export interface CreateRecipient {
  kind: string;
  name: string;
  accountNumber: string;
  routingNumber: string;
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
  reference?: string | null;
  providerReference?: string | null;
  failureCode?: string | null;
  timeline: PaymentTransition[];
  createdAt?: string | null;
  returnCode?: string | null;
  returnReason?: string | null;
}

export interface PaymentPage {
  items: Payment[];
  next?: string | null;
}

export interface CreatePayment {
  fromAccountId: string;
  recipientId?: string | null;
  toAccountId?: string | null;
  rail: 'ACH' | 'BOOK';
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
