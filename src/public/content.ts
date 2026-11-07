/**
 * Every word of the public site (OG-032), in one place so pages and tests read the same source. Capabilities are the
 * ones built in ongem-core and the founder apps; anything with code that is not switched on is marked Coming soon.
 * No customer logos, stats, prices or reviews: OnGem has no public source for them yet.
 */

export type ArtName =
  | 'accounts'
  | 'payments'
  | 'topup'
  | 'cards'
  | 'approvals'
  | 'recipients'
  | 'support'
  | 'assistant'
  | 'notifications';

export interface Capability {
  id: ArtName;
  title: string;
  summary: string;
  points: string[];
  soon?: string[];
}

export const PUBLIC_PATHS = ['/', '/product', '/security', '/partners'] as const;
export type PublicPath = (typeof PUBLIC_PATHS)[number];

export function isPublicPath(path: string): path is PublicPath {
  return (PUBLIC_PATHS as readonly string[]).includes(path);
}

export const PAGE_META: Record<PublicPath, { title: string; description: string }> = {
  '/': {
    title: 'OnGem: business banking for founders',
    description:
      'Open a US business account held at Piermont Bank, pay by ACH, issue virtual cards and approve every payment, from the web or your phone.',
  },
  '/product': {
    title: 'Product: accounts, payments, cards and approvals | OnGem',
    description:
      'What OnGem does today: business accounts and statements, ACH and scheduled payments, top-ups, virtual cards, approvals, recipients and support.',
  },
  '/security': {
    title: 'Security: how OnGem protects your money and data | OnGem',
    description:
      'Money held at the bank, a second sign-in step before money moves, second-person approvals, a tamper-evident audit trail and card numbers OnGem never sees.',
  },
  '/partners': {
    title: 'Partners: open an account from the company you just formed | OnGem',
    description:
      'Founders who form their company with GenZone apply to OnGem with their company details already filled in.',
  },
};

export const NAV_LINKS: Array<{ to: PublicPath; label: string }> = [
  { to: '/product', label: 'Product' },
  { to: '/security', label: 'Security' },
  { to: '/partners', label: 'Partners' },
];

export const HERO = {
  eyebrow: 'Business banking for founders',
  title: 'Run your company’s money in one calm place',
  lede: 'A US business account held at Piermont Bank, ACH and scheduled payments, virtual cards and approvals that keep two sets of eyes on every payment. On the web and on your phone.',
  primary: 'Get started',
  secondary: 'Sign in',
};

export const BANK_STATEMENT =
  'OnGem is a financial technology company, not a bank. Banking services are provided by Piermont Bank through Synctera.¹';

export const CAPABILITIES: Capability[] = [
  {
    id: 'accounts',
    title: 'Business accounts and statements',
    summary: 'See the balance the bank holds, every transaction and a monthly statement for each account.',
    points: [
      'Balances read from the bank, checked against OnGem every night',
      'Monthly statements to download',
      'Move money between your own accounts',
    ],
  },
  {
    id: 'payments',
    title: 'ACH and scheduled payments',
    summary: 'Pay suppliers by ACH and follow each payment from sent to settled or returned.',
    points: [
      'One-off and repeating payments you can pause, resume or cancel',
      'The next payment date always in view',
      'Returns explained in plain words',
    ],
    soon: ['Domestic wires', 'International payments'],
  },
  {
    id: 'topup',
    title: 'Top up from your other bank',
    summary: 'Link your account at another bank and pull money in by ACH debit.',
    points: [
      'A second person approves each top-up before the bank pulls it',
      'Limits per top-up, per day and per month',
    ],
    soon: ['Instant verification of your other bank account'],
  },
  {
    id: 'cards',
    title: 'Virtual cards',
    summary: 'Issue virtual cards for your team and freeze one in a tap.',
    points: [
      'Card number and PIN shown in the bank’s own secure window, never stored by OnGem',
      'Freeze and unfreeze any time',
      'Ask about a card payment from the card itself',
    ],
  },
  {
    id: 'approvals',
    title: 'Approvals and limits',
    summary: 'Every payment above your threshold waits for a second person before it moves.',
    points: [
      'The person who creates a payment can never approve it',
      'Limits that follow your company’s risk level at the bank',
      'One-person company? OnGem approves instead, so you are never stuck',
    ],
  },
  {
    id: 'recipients',
    title: 'Recipients you can trust',
    summary: 'Save the people and companies you pay, checked before the first payment goes out.',
    points: ['Screened before use', 'Changes to bank details reviewed before money moves'],
  },
  {
    id: 'support',
    title: 'Support that knows your account',
    summary: 'Raise a ticket with files and follow the reply in the app, including card disputes.',
    points: ['Linked to the bank’s case when the bank needs to act', 'Every update in one thread'],
  },
  {
    id: 'notifications',
    title: 'Notices that matter',
    summary: 'An inbox for payments, approvals, cards and your application, with your own choices.',
    points: ['Payment sent, settled or returned', 'Approvals waiting for you'],
    soon: ['Email and text message alerts'],
  },
  {
    id: 'assistant',
    title: 'An assistant that drafts, you decide',
    summary:
      'Ask about your money in plain words. It can draft a payment or a ticket, and only you can send it.',
    points: ['Reads your data, never moves money on its own'],
    soon: ['Available to every founder'],
  },
];

export const HOME_CARDS: ArtName[] = ['accounts', 'payments', 'cards', 'approvals'];

export const STEPS = [
  { title: 'Create your sign-in', text: 'Use your email and a second sign-in step.' },
  {
    title: 'Tell us about your company',
    text: 'Owners, documents and the bank’s disclosures, step by step.',
  },
  { title: 'The bank decides', text: 'Piermont Bank verifies your business and its owners.' },
  { title: 'Your account opens', text: 'Fund it, add recipients and issue cards.' },
];

export const SECURITY = [
  {
    title: 'Your money stays at the bank',
    text: 'Deposits are held at Piermont Bank. OnGem shows the bank’s balance and never holds your funds.¹',
  },
  {
    title: 'A second step before money moves',
    text: 'Payments, card details and changes to your team ask you to confirm it is you, again.',
  },
  {
    title: 'Two people for every larger payment',
    text: 'The maker and the approver are always different people, and the rules are kept per company.',
  },
  {
    title: 'A trail that cannot be rewritten',
    text: 'Every change is written to an audit log where each entry seals the one before it.',
  },
  {
    title: 'Card numbers OnGem never sees',
    text: 'Card details open in the bank’s secure window, so they never pass through OnGem.',
  },
  {
    title: 'Protected in transit and at rest',
    text: 'Encrypted connections, encrypted storage, a web application firewall and data kept per company.',
  },
];

export const PARTNER = {
  title: 'Formed your company with GenZone?',
  text: 'GenZone sends your company’s details to OnGem when you ask it to. You review them, add what is missing and submit. No retyping what you already gave.',
  points: [
    'Company and owner details arrive prefilled',
    'You accept the bank’s disclosures yourself',
    'The bank makes the decision, as for every founder',
  ],
  apiTitle: 'For partners',
  apiText:
    'Company formation and licensing firms connect through OnGem’s Partner API: they submit applications, see their progress and never see a founder’s banking data.',
};

export const FINAL_CTA = {
  title: 'Open your business account',
  text: 'It takes a few minutes to start. The bank tells you its decision.',
};

export const DISCLOSURES_NOTE = 'Draft for legal review. Not approved for publication.';

export const DISCLOSURES = [
  'OnGem is a financial technology company, not a bank. Banking services are provided by Piermont Bank, Member FDIC, through Synctera.',
  'OnGem cards are issued by Piermont Bank.',
  'Deposit insurance covers the failure of an insured bank, up to the applicable limits, once funds are on deposit at Piermont Bank. Conditions apply.',
  'Features marked Coming soon are in development and not yet available.',
];

/** Headings and short labels used around the content above. */
export const LABELS = {
  skip: 'Skip to content',
  homeLink: 'OnGem home',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  lightTheme: 'Use light theme',
  darkTheme: 'Use dark theme',
  comingSoon: 'Coming soon',
  disclosures: 'Disclosures',
  homeWhat: 'Everything a young company needs to move money well',
  seeHow: 'See how it works',
  homeShotTitle: 'Built for the founder at a desk and on the move',
  homeShotText:
    'The same accounts, payments and cards on the web and in the iPhone and Android app, with the same approvals and the same second sign-in step.',
  homeSteps: 'From sign-up to an open account',
  homeSecurity: 'Security that stays out of your way',
  securityLink: 'How we protect your money',
  partnerLink: 'How partner onboarding works',
  productTitle: 'What OnGem does today',
  securityTitle: 'How OnGem protects your money',
};

/** The parties behind every account, named as plain text (no third-party logos), with the bank statement beside them. */
export const TRUST = {
  label: 'Who does what',
  parties: [
    { name: 'Piermont Bank', role: 'holds your deposits and issues your cards¹' },
    { name: 'Synctera', role: 'connects OnGem to the bank' },
    { name: 'GenZone', role: 'sends the companies it forms, prefilled' },
  ],
};

/** Large product rows on the home page, each with a real screen from demo mode (OG-032 R10). */
export const FEATURE_ROWS = [
  {
    id: 'payments',
    screen: 'payments',
    eyebrow: 'Payments',
    title: 'Every payment, followed to the end',
    text: 'Pay by ACH or move money between your accounts, and watch each payment go from sent to settled. A return is explained in plain words, never a code.',
    points: [
      'Repeating payments you can pause, resume or cancel',
      'Larger payments wait for a second person',
    ],
  },
  {
    id: 'cards',
    screen: 'cards',
    eyebrow: 'Cards',
    title: 'Virtual cards you control in a tap',
    text: 'Issue a virtual card, freeze it the moment something looks wrong and unfreeze it when you are sure. Card numbers open in the bank’s own secure window.',
    points: [
      'Card details close by themselves after a few minutes',
      'Ask about a card payment from the card',
    ],
  },
  {
    id: 'notifications',
    screen: 'notifications',
    eyebrow: 'Notices',
    title: 'Know what needs you, and nothing else',
    text: 'Payments sent and settled, approvals waiting for you, card changes and your application, in one inbox with your own choices.',
    points: ['The important ones can never be switched off', 'Email and text message alerts are coming soon'],
  },
] as const;

/**
 * Facts with a source each (OG-032 R11). Sources: CardWidget.tsx (card details close after 5 minutes); data protection
 * and privacy v3, approved 6 Nov 2026 (records kept 7 years after closure); hub Testing evidence, 7 Nov 2026 (1,189
 * automated tests with a recorded result, 0 failures); OG-014 notifications, ongem-core 72e7d83 (16 kinds of notice).
 */
export const FACTS = [
  { value: '5 min', label: 'Card details close by themselves', source: 'ongem-web CardWidget' },
  { value: '16', label: 'Kinds of notices you control', source: 'OG-014, ongem-core 72e7d83' },
  { value: '7 years', label: 'Records kept after an account closes', source: 'Data protection v3' },
  { value: '1,189', label: 'Automated tests behind every release', source: 'Testing evidence, 7 Nov 2026' },
];

/** Answers from how the product works today (OG-032 R12). */
export const FAQ = [
  {
    q: 'Is OnGem a bank? Who holds my money?',
    a: 'No. OnGem is a financial technology company. Your deposits are held at Piermont Bank, which provides the accounts through Synctera. OnGem shows you the bank’s balance and never holds your funds.¹',
  },
  {
    q: 'How do approvals work?',
    a: 'You set who can create and who can approve payments. Above your threshold a payment waits for a second person, and the person who created it can never approve it. If no one else in your company can approve, OnGem approves it, so a one-person company is never stuck.',
  },
  {
    q: 'How do I add money to my account?',
    a: 'Send money in to your account and routing numbers, or link your account at another bank and pull a top-up by ACH. The bank verifies the linked account first, and a second person approves each top-up before the bank pulls it.',
  },
  {
    q: 'Are there limits on payments and top-ups?',
    a: 'Yes. Limits apply per payment, per day and per month, and they follow your company’s risk level at the bank. If a payment would go over a limit, it does not move and the app tells you why.',
  },
  {
    q: 'Can I issue cards to my team?',
    a: 'Today you can issue virtual cards for the owners of your company, freeze and unfreeze them, and raise a dispute from a card. Cards for other team members are coming soon.',
  },
  {
    q: 'How do you protect my account?',
    a: 'Money moves only after a second sign-in step, larger payments need two people, every change is written to an audit trail that cannot be rewritten, and card numbers open in the bank’s window so they never pass through OnGem.',
  },
  {
    q: 'I formed my company with GenZone. What changes?',
    a: 'When you ask it to, GenZone sends your company’s details to OnGem. You review them, add what is missing, accept the bank’s disclosures and submit. The bank makes its decision as it does for every founder.',
  },
];

export const LABELS_V2 = {
  trustTitle: 'Banking you can trace',
  factsTitle: 'The small print, in numbers',
  faqTitle: 'Questions founders ask',
  productScreens: 'See it in the app',
};

/** Sign-in and sign-up: the same site frame as the public pages, the form beside a short reminder of what is inside. */
export const AUTH = {
  eyebrow: 'Business banking for founders',
  signInTitle: 'Sign in to OnGem',
  signUpTitle: 'Create your OnGem account',
  signInLede:
    'Your accounts at Piermont Bank, your payments and your cards, with the same approvals on the web and on your phone.',
  signUpLede:
    'Create your sign-in, then tell us about your company. Piermont Bank decides on your account and OnGem shows you each step.',
  points: [
    'A second sign-in step before money moves',
    'A second person approves larger payments',
    'Card numbers stay in the bank’s secure window',
  ],
  demo: 'Explore the demo',
  demoHint: 'Sample data only. Nothing you do in the demo reaches a bank.',
};

/** The product page's lede: what the page covers, without repeating its title (UX-07). */
export const PRODUCT_LEDE =
  'Business accounts and statements, ACH and scheduled payments, top-ups, virtual cards, approvals, recipients, support and notices, as they work today. Planned features are marked Coming soon.';
