import type { Capability, PagePath, PublicPath } from './content';

/**
 * The AE build's words for the public site and sign-in (OG-022 R18), in the same shapes as content.ts. The bank is
 * named only as a licensed UAE bank until it agrees to be named. Money in AED, payments by Aani and UAEFTS.
 */

export const PAGE_META: Record<PagePath, { title: string; description: string }> = {
  '/': {
    title: 'OnGem: business banking for founders in the UAE',
    description:
      'Open a UAE business account held at a licensed UAE bank, pay by Aani and UAEFTS, issue virtual cards and approve every payment, from the web or your phone.',
  },
  '/product': {
    title: 'Product: accounts, payments, cards and approvals | OnGem',
    description:
      'What OnGem does today: business accounts in AED with a UAE IBAN, Aani, UAEFTS and scheduled payments, top-ups, virtual cards, approvals, recipients and support.',
  },
  '/security': {
    title: 'Security: how OnGem protects your money and data | OnGem',
    description:
      'Money held at the bank, a second sign-in step before money moves, second-person approvals, a tamper-evident audit trail and card numbers OnGem never sees.',
  },
  '/partners': {
    title: 'Partners: open an account from the company you just formed | OnGem',
    description:
      'Founders who form their company with an OnGem partner apply with their trade licence and company details already filled in.',
  },
};

export const NAV_LINKS: Array<{ to: PublicPath; label: string }> = [
  { to: '/product', label: 'Product' },
  { to: '/security', label: 'Security' },
  { to: '/partners', label: 'Partners' },
  { to: '/blog', label: 'Blog' },
];

export const HERO = {
  eyebrow: 'Business banking for founders in the UAE',
  title: 'Run your company’s money in one calm place',
  lede: 'A UAE business account in AED held at a licensed UAE bank, instant Aani payments, UAEFTS and scheduled payments, virtual cards and approvals that keep two sets of eyes on every payment. On the web and on your phone.',
  ledeShort: 'AED business accounts at a licensed UAE bank, with two-person approvals.',
  primary: 'Get started',
  secondary: 'Sign in',
  proof: [
    'Your money is held at a licensed UAE bank',
    'A second person approves larger payments',
    'Card numbers never reach OnGem',
  ],
};

export const BANK_STATEMENT =
  'OnGem is a financial technology company, not a bank. Banking services are provided by a licensed UAE bank.¹';

export const CAPABILITIES: Capability[] = [
  {
    id: 'accounts',
    title: 'Business accounts and statements',
    summary:
      'An AED account with its own UAE IBAN: the balance the bank holds, every transaction and a monthly statement.',
    points: [
      'Balances read from the bank, checked against OnGem every night',
      'Monthly statements to download',
      'Move money between your own accounts',
    ],
  },
  {
    id: 'payments',
    title: 'Aani, UAEFTS and scheduled payments',
    summary:
      'Pay suppliers to any UAE IBAN, instantly by Aani or by UAEFTS, and follow each payment from sent to settled or returned.',
    points: [
      'One-off and repeating payments you can pause, resume or cancel',
      'The next payment date always in view',
      'Returns explained in plain words',
    ],
    soon: ['International payments'],
  },
  {
    id: 'topup',
    title: 'Top up from your other bank',
    summary: 'Link your company’s account at another UAE bank by its IBAN and pull money in.',
    points: [
      'A second person approves each top-up before the bank pulls it',
      'Limits per top-up, per day and per month',
    ],
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
    summary:
      'Save the people and companies you pay by their UAE IBAN, checked before the first payment goes out.',
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

export const STEPS = [
  { title: 'Create your sign-in', text: 'Use your email and a second sign-in step.' },
  {
    title: 'Tell us about your company',
    text: 'Your trade licence and emirate, the owners with their Emirates ID or passport, and the bank’s disclosures.',
  },
  { title: 'The bank decides', text: 'A licensed UAE bank verifies your business and its owners.' },
  {
    title: 'Your account opens',
    text: 'An AED account with its UAE IBAN. Fund it, add recipients and issue cards.',
  },
];

export const SECURITY_BANK = {
  title: 'Your money stays at the bank',
  text: 'Deposits are held at a licensed UAE bank. OnGem shows the bank’s balance and never holds your funds.¹',
};

export const PARTNER = {
  title: 'Formed your company with an OnGem partner?',
  text: 'Your formation partner sends your trade licence and company details to OnGem when you ask it to. You review them, add what is missing and submit. No retyping what you already gave.',
  points: [
    'Trade licence, emirate and owner details arrive prefilled',
    'You accept the bank’s disclosures yourself',
    'The bank makes the decision, as for every founder',
  ],
  apiTitle: 'For partners',
  apiText:
    'Company formation and licensing firms connect through OnGem’s Partner API: they submit applications, see their progress and never see a founder’s banking data.',
};

export const DISCLOSURES = [
  'OnGem is a financial technology company, not a bank. Banking services are provided by a licensed UAE bank.',
  'Features marked Coming soon are in development and not yet available.',
];

export const TRUST = {
  label: 'Who does what',
  parties: [
    { name: 'A licensed UAE bank', role: 'holds your deposits in AED¹' },
    { name: 'OnGem', role: 'runs your accounts, payments and approvals' },
    { name: 'Formation partners', role: 'send the companies they form, prefilled' },
  ],
};

export const FEATURE_PAYMENTS = {
  title: 'Every payment, followed to the end',
  text: 'Pay instantly by Aani, by UAEFTS or move money between your accounts, and watch each payment go from sent to settled. A return is explained in plain words, never a code.',
};

export const FAQ_BANK = {
  q: 'Is OnGem a bank? Who holds my money?',
  a: 'No. OnGem is a financial technology company. Your deposits are held at a licensed UAE bank, which provides the accounts. OnGem shows you the bank’s balance and never holds your funds.¹',
};

export const FAQ_TOPUP = {
  q: 'How do I add money to my account?',
  a: 'Send money in to your account’s UAE IBAN by Aani or UAEFTS, or link your company’s account at another UAE bank and pull a top-up. The bank verifies the linked account first, and a second person approves each top-up before the bank pulls it.',
};

export const FAQ_PARTNER = {
  q: 'I formed my company with an OnGem partner. What changes?',
  a: 'When you ask it to, your partner sends your trade licence and company details to OnGem. You review them, add what is missing, accept the bank’s disclosures and submit. The bank makes its decision as it does for every founder.',
};

export const AUTH_LEDES = {
  signInLede:
    'Your AED accounts at a licensed UAE bank, your payments and your cards, with the same approvals on the web and on your phone.',
  signUpLede:
    'Create your sign-in, then tell us about your company and its trade licence. A licensed UAE bank decides on your account and OnGem shows you each step.',
};

export const PRODUCT_LEDE =
  'Business accounts in AED and statements, Aani, UAEFTS and scheduled payments, top-ups, virtual cards, approvals, recipients, support and notices, as they work today. Planned features are marked Coming soon.';
