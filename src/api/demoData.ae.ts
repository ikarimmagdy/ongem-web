import type {
  Account,
  Amount,
  Application,
  Card,
  FundingSource,
  Me,
  NoticeView,
  Payment,
  Recipient,
  StatementLine,
  TicketDetail,
  Transaction,
} from './types';

/**
 * The AE build's demo data (OG-022 R18): UAE companies with AED amounts, UAE IBANs (only the last four kept), Aani,
 * UAEFTS and book transfers, owners with Emirates ID. Same ids and shapes as demoData.ts. Fictional only.
 */
export const aed = (amountMinor: number): Amount => ({ amountMinor, currency: 'AED' });

const OPS = 'acc_demo_ops';
const TAX = 'acc_demo_tax';
const PAYROLL = 'acc_demo_payroll';

export const demoMe: Me = {
  personId: 'prn_demo_founder',
  tenantId: 'ten_demo',
  companyId: 'cmp_demo_northwind',
  email: 'layla.founder@example.com',
  legalFirstName: 'Layla',
  legalLastName: 'Al Mansoori',
  providerState: 'ACCEPTED',
  memberships: [
    {
      id: 'mbr_demo_owner',
      companyId: 'cmp_demo_northwind',
      companyName: 'Dune Trading LLC',
      role: 'OWNER',
      state: 'ACTIVE',
      companyStatus: 'OPEN',
    },
  ],
  issuer: 'customer',
};

const asOf = '2026-10-29T14:40:00Z';

export const demoAccounts = (): Account[] => [
  {
    id: OPS,
    name: 'Operating',
    last4: '6789',
    status: 'ACTIVE',
    currency: 'AED',
    balance: { posted: aed(47_150_000), available: aed(46_290_000), asOf },
  },
  {
    id: TAX,
    name: 'VAT reserve',
    last4: '2345',
    status: 'ACTIVE',
    currency: 'AED',
    balance: { posted: aed(9_175_000), available: aed(9_175_000), asOf },
  },
  {
    id: PAYROLL,
    name: 'Payroll',
    last4: '0042',
    status: 'ACTIVE',
    currency: 'AED',
    balance: { posted: aed(3_100_000), available: aed(3_100_000), asOf: '2026-10-28T23:10:00Z', stale: true },
  },
];

export const demoTransactions: Record<string, Transaction[]> = {
  [OPS]: Array.from({ length: 36 }, (_, i) => {
    const n = i + 1;
    const day = 29 - Math.floor((n - 1) / 2);
    const credit = n % 3 === 0;
    return {
      id: `txn_demo_${n}`,
      stage: n <= 2 ? 'PENDING' : 'POSTED',
      direction: credit ? 'CREDIT' : 'DEBIT',
      amount: aed(credit ? 1_650_000 + n * 3_500 : 45_000 + n * 2_650),
      rail: n % 5 === 0 ? 'CARD' : n % 2 ? 'AANI' : 'UAEFTS',
      origin: 'PROVIDER',
      effectiveDate: `2026-10-${String(day).padStart(2, '0')}`,
    };
  }),
  [TAX]: [
    {
      id: 'txn_demo_tax_1',
      stage: 'POSTED',
      direction: 'CREDIT',
      amount: aed(1_835_000),
      rail: 'BOOK',
      origin: 'ONGEM',
      effectiveDate: '2026-10-25',
    },
  ],
  [PAYROLL]: [],
};

export const statementLines = (period: string): StatementLine[] => [
  { date: `${period}-03`, direction: 'CREDIT', amount: aed(5_500_000), rail: 'UAEFTS' },
  { date: `${period}-11`, direction: 'DEBIT', amount: aed(310_500), rail: 'CARD' },
  { date: `${period}-19`, direction: 'CREDIT', amount: aed(3_300_000), rail: 'AANI' },
  { date: `${period}-27`, direction: 'DEBIT', amount: aed(735_000), rail: 'AANI' },
];

export const statementOpening = (period: string) => aed(period === '2026-09' ? 36_225_000 : 26_420_000);
export const statementClosing = (period: string) => aed(period === '2026-09' ? 43_979_500 : 36_225_000);

export const demoFundingSources = (): FundingSource[] => [
  {
    id: 'fsrc_demo_main',
    accountId: OPS,
    method: 'MANUAL',
    aggregator: null,
    nickname: 'Main bank',
    last4: '4321',
    routingNumber: null,
    accountType: 'CURRENT',
    state: 'VERIFIED',
    createdAt: '2026-10-20T09:00:00Z',
    verifiedAt: '2026-10-20T09:00:00Z',
  },
];

export const demoRecipients = (): Recipient[] => [
  {
    id: 'rcp_demo_acme',
    kind: 'BUSINESS',
    name: 'Saffron Packaging LLC',
    accountLast4: '6789',
    accountType: 'CURRENT',
    screening: 'CLEAR',
    status: 'ACTIVE',
    createdAt: '2026-10-02T10:00:00Z',
  },
  {
    id: 'rcp_demo_harbor',
    kind: 'BUSINESS',
    name: 'Marina Office Rentals',
    accountLast4: '2345',
    accountType: 'CURRENT',
    screening: 'CLEAR',
    status: 'ACTIVE',
    createdAt: '2026-09-12T10:00:00Z',
  },
  {
    id: 'rcp_demo_new',
    kind: 'INDIVIDUAL',
    name: 'Nadia Karimi',
    accountLast4: '0042',
    accountType: 'SAVINGS',
    screening: 'PENDING',
    status: 'ACTIVE',
    createdAt: '2026-10-28T10:00:00Z',
  },
];

const t = (from: string | null, to: string, at: string) => ({ from, to, at });

export const demoPayments = (): Payment[] => [
  {
    id: 'pay_demo_1',
    state: 'SENT',
    rail: 'UAEFTS',
    amount: aed(459_000),
    fromAccountId: OPS,
    recipientId: 'rcp_demo_acme',
    reference: 'Invoice 1042',
    providerReference: 'fts_demo_77a1',
    createdAt: '2026-10-27T07:02:00Z',
    timeline: [
      t(null, 'DRAFT', '2026-10-27T07:02:00Z'),
      t('DRAFT', 'PRECHECKED', '2026-10-27T07:03:00Z'),
      t('PRECHECKED', 'SUBMITTED', '2026-10-27T07:03:10Z'),
      t('SUBMITTED', 'SENT', '2026-10-27T09:00:00Z'),
    ],
  },
  {
    id: 'pay_demo_2',
    state: 'SETTLED',
    rail: 'BOOK',
    amount: aed(1_835_000),
    fromAccountId: OPS,
    toAccountId: TAX,
    reference: 'Q4 VAT reserve',
    createdAt: '2026-10-25T07:00:00Z',
    timeline: [t(null, 'DRAFT', '2026-10-25T07:00:00Z'), t('DRAFT', 'SETTLED', '2026-10-25T07:00:05Z')],
  },
  {
    id: 'pay_demo_3',
    state: 'RETURNED',
    rail: 'AANI',
    amount: aed(1_140_000),
    fromAccountId: OPS,
    recipientId: 'rcp_demo_harbor',
    reference: 'October rent',
    providerReference: 'aani_demo_51c9',
    createdAt: '2026-10-24T06:30:00Z',
    failureCode: 'AC01',
    returnCode: 'AC01',
    returnReason: 'Incorrect account number',
    timeline: [
      t(null, 'DRAFT', '2026-10-24T06:30:00Z'),
      t('DRAFT', 'SUBMITTED', '2026-10-24T06:31:00Z'),
      t('SUBMITTED', 'SETTLED', '2026-10-24T06:31:04Z'),
      t('SETTLED', 'RETURNED', '2026-10-26T10:12:00Z'),
    ],
  },
  ...Array.from({ length: 23 }, (_, i): Payment => {
    const n = i + 4;
    return {
      id: `pay_demo_${n}`,
      state: 'SETTLED',
      rail: n % 2 ? 'AANI' : 'UAEFTS',
      amount: aed(75_000 + n * 4_500),
      fromAccountId: OPS,
      recipientId: 'rcp_demo_acme',
      reference: `Order ${n}`,
      createdAt: `2026-10-${String(23 - Math.floor(n / 2)).padStart(2, '0')}T06:00:00Z`,
      timeline: [],
    };
  }),
];

export const demoCards = (): Card[] => [
  {
    id: 'crd_demo_dana',
    holderName: 'Layla Al Mansoori',
    fundingAccountId: OPS,
    form: 'VIRTUAL',
    last4: '5521',
    state: 'ACTIVE',
    createdAt: '2026-10-03T09:00:00Z',
  },
  {
    id: 'crd_demo_ops',
    holderName: 'Arjun Mehta',
    fundingAccountId: OPS,
    form: 'PHYSICAL',
    last4: '8830',
    state: 'FROZEN',
    createdAt: '2026-09-21T09:00:00Z',
  },
];

export const demoApplication = (): Application => ({
  id: 'app_demo_northwind',
  companyId: 'cmp_demo_northwind',
  state: 'COLLECTING',
  owners: [
    {
      id: 'own_demo_dana',
      ref: 'o1',
      name: 'Layla Al Mansoori',
      ownershipPercent: 60,
      controlRole: 'Managing director',
      founder: true,
      atBank: false,
    },
    {
      id: 'own_demo_lee',
      ref: 'o2',
      name: 'Omar Haddad',
      ownershipPercent: 40,
      controlRole: null,
      founder: false,
      idType: 'EMIRATES_ID',
      idLast4: '4561',
      idCountry: 'AE',
      atBank: false,
    },
  ],
  requirements: ['owner_id_missing:own_demo_dana'],
});

export const demoTickets = (): TicketDetail[] => [
  {
    ticket: {
      id: 'tkt_demo_1',
      subject: 'Card for a new hire',
      category: 'CARD',
      status: 'IN_REVIEW',
      createdAt: '2026-10-27T10:00:00Z',
      updatedAt: '2026-10-28T12:00:00Z',
    },
    messages: [
      {
        id: 'msg_demo_1',
        authorKind: 'MEMBER',
        authorName: 'Layla Al Mansoori',
        body: 'Can we get a virtual card for our new designer?',
        at: '2026-10-27T10:00:00Z',
      },
      {
        id: 'msg_demo_2',
        authorKind: 'OPS',
        authorName: 'OnGem support',
        body: 'Yes. Add them as a cardholder and we will issue it.',
        at: '2026-10-28T12:00:00Z',
      },
    ],
    attachments: [],
  },
  {
    ticket: {
      id: 'tkt_demo_2',
      subject: 'Statement for September',
      category: 'ACCOUNT',
      status: 'RESOLVED',
      createdAt: '2026-10-20T10:00:00Z',
      updatedAt: '2026-10-21T09:00:00Z',
    },
    resolution: 'Statement shared in the app.',
    messages: [
      {
        id: 'msg_demo_3',
        authorKind: 'MEMBER',
        authorName: 'Layla Al Mansoori',
        body: 'Where do I find the September statement?',
        at: '2026-10-20T10:00:00Z',
      },
      {
        id: 'msg_demo_4',
        authorKind: 'OPS',
        authorName: 'OnGem support',
        body: 'Accounts, Operating, Statements, September 2026.',
        at: '2026-10-21T09:00:00Z',
      },
    ],
    attachments: [],
  },
];

export const demoNotices = (): NoticeView[] => [
  {
    id: 'ntc_demo_3',
    kind: 'APPROVAL_WAITING',
    title: 'A payment needs your approval',
    body: 'A payment of AED 9,000.00 is waiting for a second person to approve it.',
    link: 'payments/pay_demo_2/approve',
    mandatory: false,
    occurredAt: '2026-10-29T14:20:00Z',
    createdAt: '2026-10-29T14:20:01Z',
    readAt: null,
  },
  {
    id: 'ntc_demo_2',
    kind: 'SUPPORT_UPDATE',
    title: 'Your support request has an answer',
    body: 'OnGem replied to your request.',
    link: 'support/tkt_demo_1',
    mandatory: false,
    occurredAt: '2026-10-29T10:05:00Z',
    createdAt: '2026-10-29T10:05:01Z',
    readAt: null,
  },
  {
    id: 'ntc_demo_1',
    kind: 'PAYMENT_SETTLED',
    title: 'Payment completed',
    body: 'Your payment of AED 4,590.00 has completed.',
    link: 'payments/pay_demo_1',
    mandatory: false,
    occurredAt: '2026-10-28T16:00:00Z',
    createdAt: '2026-10-28T16:00:01Z',
    readAt: '2026-10-28T16:30:00Z',
  },
];
