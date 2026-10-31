import type {
  Account,
  Amount,
  Application,
  Card,
  Me,
  Payment,
  Recipient,
  RequiredDisclosure,
  Statement,
  TicketDetail,
  Transaction,
} from './types';

/** Demo mode's sample data, ported from ongem-app's DemoData.kt (same ids, names and amounts). Fictional only. */
export const usd = (amountMinor: number): Amount => ({ amountMinor, currency: 'USD' });

export const OPS = 'acc_demo_ops';
export const TAX = 'acc_demo_tax';
export const PAYROLL = 'acc_demo_payroll';

export const demoMe: Me = {
  personId: 'prn_demo_founder',
  tenantId: 'ten_demo',
  companyId: 'cmp_demo_northwind',
  email: 'dana.founder@example.com',
  legalFirstName: 'Dana',
  legalLastName: 'Rivera',
  providerState: 'ACCEPTED',
  memberships: [
    { id: 'mbr_demo_owner', companyId: 'cmp_demo_northwind', companyName: 'Northwind Labs LLC', role: 'OWNER', state: 'ACTIVE', companyStatus: 'OPEN' },
  ],
  issuer: 'customer',
};

const asOf = '2026-10-29T14:40:00Z';

export const demoAccounts = (): Account[] => [
  { id: OPS, name: 'Operating', last4: '4821', status: 'OPEN', currency: 'USD', balance: { posted: usd(12_845_016), available: usd(12_610_016), asOf } },
  { id: TAX, name: 'Tax reserve', last4: '9034', status: 'OPEN', currency: 'USD', balance: { posted: usd(2_500_000), available: usd(2_500_000), asOf } },
  {
    id: PAYROLL,
    name: 'Payroll',
    last4: '1177',
    status: 'OPEN',
    currency: 'USD',
    balance: { posted: usd(845_000), available: usd(845_000), asOf: '2026-10-28T23:10:00Z', stale: true },
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
      amount: usd(credit ? 450_000 + n * 1_000 : 12_500 + n * 731),
      rail: n % 5 === 0 ? 'CARD' : 'ACH',
      origin: credit ? 'Customer payment' : n % 5 === 0 ? 'Card purchase' : 'ACH to supplier',
      effectiveDate: `2026-10-${String(day).padStart(2, '0')}`,
    };
  }),
  [TAX]: [
    { id: 'txn_demo_tax_1', stage: 'POSTED', direction: 'CREDIT', amount: usd(500_000), rail: 'BOOK', origin: 'Transfer from Operating', effectiveDate: '2026-10-25' },
  ],
  [PAYROLL]: [],
};

export const demoStatements = [{ period: '2026-09' }, { period: '2026-08' }];

export function demoStatement(accountId: string, period: string): Statement {
  const lines = [
    { date: `${period}-03`, direction: 'CREDIT', amount: usd(1_500_000), rail: 'ACH' },
    { date: `${period}-11`, direction: 'DEBIT', amount: usd(84_600), rail: 'CARD' },
    { date: `${period}-19`, direction: 'CREDIT', amount: usd(900_000), rail: 'ACH' },
    { date: `${period}-27`, direction: 'DEBIT', amount: usd(200_000), rail: 'ACH' },
  ];
  return {
    period,
    opening: usd(period === '2026-09' ? 9_870_000 : 7_200_000),
    closing: usd(period === '2026-09' ? 11_985_400 : 9_870_000),
    transactions: accountId === OPS ? lines : lines.slice(0, 1),
  };
}

export const demoRecipients = (): Recipient[] => [
  { id: 'rcp_demo_acme', kind: 'BUSINESS', name: 'Acme Supplies LLC', accountLast4: '6789', routingNumber: '021000021', accountType: 'CHECKING', screening: 'CLEAR', status: 'ACTIVE', createdAt: '2026-10-02T10:00:00Z' },
  { id: 'rcp_demo_harbor', kind: 'BUSINESS', name: 'Harbor Rent Co', accountLast4: '4410', routingNumber: '011000015', accountType: 'CHECKING', screening: 'CLEAR', status: 'ACTIVE', createdAt: '2026-09-12T10:00:00Z' },
  { id: 'rcp_demo_new', kind: 'INDIVIDUAL', name: 'Sam Contractor', accountLast4: '0042', routingNumber: '021000021', accountType: 'SAVINGS', screening: 'PENDING', status: 'ACTIVE', createdAt: '2026-10-28T10:00:00Z' },
];

const t = (from: string | null, to: string, at: string) => ({ from, to, at });

export const demoPayments = (): Payment[] => [
  {
    id: 'pay_demo_1', state: 'SENT', rail: 'ACH', amount: usd(125_000), fromAccountId: OPS, recipientId: 'rcp_demo_acme',
    reference: 'Invoice 1042', providerReference: 'ach_demo_77a1', createdAt: '2026-10-27T15:02:00Z',
    timeline: [t(null, 'DRAFT', '2026-10-27T15:02:00Z'), t('DRAFT', 'PRECHECKED', '2026-10-27T15:03:00Z'), t('PRECHECKED', 'SUBMITTED', '2026-10-27T15:03:10Z'), t('SUBMITTED', 'SENT', '2026-10-28T09:00:00Z')],
  },
  {
    id: 'pay_demo_2', state: 'SETTLED', rail: 'BOOK', amount: usd(500_000), fromAccountId: OPS, toAccountId: TAX,
    reference: 'Q4 tax reserve', createdAt: '2026-10-25T11:00:00Z',
    timeline: [t(null, 'DRAFT', '2026-10-25T11:00:00Z'), t('DRAFT', 'SETTLED', '2026-10-25T11:00:05Z')],
  },
  {
    id: 'pay_demo_3', state: 'RETURNED', rail: 'ACH', amount: usd(310_000), fromAccountId: OPS, recipientId: 'rcp_demo_harbor',
    reference: 'October rent', providerReference: 'ach_demo_51c9', createdAt: '2026-10-24T08:30:00Z',
    failureCode: 'R03', returnCode: 'R03', returnReason: 'No account, or unable to locate account',
    timeline: [t(null, 'DRAFT', '2026-10-24T08:30:00Z'), t('DRAFT', 'SUBMITTED', '2026-10-24T08:31:00Z'), t('SUBMITTED', 'SENT', '2026-10-24T16:00:00Z'), t('SENT', 'RETURNED', '2026-10-26T10:12:00Z')],
  },
  ...Array.from({ length: 23 }, (_, i): Payment => {
    const n = i + 4;
    return {
      id: `pay_demo_${n}`, state: 'SETTLED', rail: 'ACH', amount: usd(20_000 + n * 1_250), fromAccountId: OPS, recipientId: 'rcp_demo_acme',
      reference: `Order ${n}`, createdAt: `2026-10-${String(23 - Math.floor(n / 2)).padStart(2, '0')}T09:00:00Z`, timeline: [],
    };
  }),
];

export const demoCards = (): Card[] => [
  { id: 'crd_demo_dana', holderName: 'Dana Rivera', fundingAccountId: OPS, form: 'VIRTUAL', last4: '5521', state: 'ACTIVE', createdAt: '2026-10-03T09:00:00Z' },
  { id: 'crd_demo_ops', holderName: 'Alex Kim', fundingAccountId: OPS, form: 'PHYSICAL', last4: '8830', state: 'FROZEN', createdAt: '2026-09-21T09:00:00Z' },
];

export const demoApplication = (): Application => ({
  id: 'app_demo_northwind',
  companyId: 'cmp_demo_northwind',
  state: 'COLLECTING',
  owners: [
    { id: 'own_demo_dana', ref: 'o1', name: 'Dana Rivera', ownershipPercent: 60, controlRole: 'CEO', founder: true, atBank: false },
    { id: 'own_demo_lee', ref: 'o2', name: 'Lee Park', ownershipPercent: 40, controlRole: null, founder: false, idType: 'SSN', idLast4: '6789', idCountry: 'US', atBank: false },
  ],
  requirements: ['owner_id_missing:own_demo_dana'],
});

export const demoDisclosures = (): RequiredDisclosure[] => [
  { versionId: 'dsv_demo_esign', type: 'E_SIGN', version: '1.0', title: 'Consent to electronic records', sha256: 'e3b0c442', subject: 'PERSON', acknowledged: false, recorded: false },
  { versionId: 'dsv_demo_terms', type: 'ACCOUNT_TERMS', version: '1.0', title: 'Business account terms', sha256: 'a1b2c3d4', subject: 'BUSINESS', acknowledged: false, recorded: false },
];

export const disclosureBody = (title: string) =>
  `Sample text for demo mode. ${title}: the real text comes from the API and is shown here in full. You agree to receive ` +
  'records electronically, to keep your contact details current, and that this acceptance is recorded with its time and this device.';

export const demoTickets = (): TicketDetail[] => [
  {
    ticket: { id: 'tkt_demo_1', subject: 'Card for a new hire', category: 'CARD', status: 'IN_REVIEW', createdAt: '2026-10-27T10:00:00Z', updatedAt: '2026-10-28T12:00:00Z' },
    messages: [
      { id: 'msg_demo_1', authorKind: 'MEMBER', authorName: 'Dana Rivera', body: 'Can we get a virtual card for our new designer?', at: '2026-10-27T10:00:00Z' },
      { id: 'msg_demo_2', authorKind: 'OPS', authorName: 'OnGem support', body: 'Yes. Add them as a cardholder and we will issue it.', at: '2026-10-28T12:00:00Z' },
    ],
    attachments: [],
  },
  {
    ticket: { id: 'tkt_demo_2', subject: 'Statement for September', category: 'ACCOUNT', status: 'RESOLVED', createdAt: '2026-10-20T10:00:00Z', updatedAt: '2026-10-21T09:00:00Z' },
    resolution: 'Statement shared in the app.',
    messages: [
      { id: 'msg_demo_3', authorKind: 'MEMBER', authorName: 'Dana Rivera', body: 'Where do I find the September statement?', at: '2026-10-20T10:00:00Z' },
      { id: 'msg_demo_4', authorKind: 'OPS', authorName: 'OnGem support', body: 'Accounts, Operating, Statements, September 2026.', at: '2026-10-21T09:00:00Z' },
    ],
    attachments: [],
  },
];
