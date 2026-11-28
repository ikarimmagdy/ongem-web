import { ACCEPTANCE_ENABLED } from './acceptance/api';
import { t } from './i18n/store';
import { brand } from './lib/brand';

export interface NavEntry {
  to: string;
  id: string;
  end?: boolean;
  readonly label: string;
}

const withLabel = (n: { to: string; id: string; end?: boolean }): NavEntry => ({
  ...n,
  get label() {
    return t(`app.nav.${n.id}`);
  },
});

/** The side bar on wide screens (OG-035 R8); `id` names the test id `nav-<id>` and the content key `app.nav.<id>`. */
export const NAV: NavEntry[] = [
  { to: '/', id: 'home', end: true },
  { to: '/accounts', id: 'accounts' },
  { to: '/payments', id: 'payments' },
  // OG-039 Get paid: only in a build with payment acceptance on (VITE_ACCEPTANCE_ENABLED, never AE).
  ...(ACCEPTANCE_ENABLED ? [{ to: '/get-paid', id: 'get_paid' }] : []),
  { to: '/cards', id: 'cards' },
  // OG-087: shown only while the company's spend programme is ACTIVE (the shell asks GET /v1/spend/program).
  { to: '/spend', id: 'spend' },
  { to: '/team', id: 'team' },
  { to: '/documents', id: 'documents' },
  { to: '/support', id: 'support' },
  { to: '/settings', id: 'settings' },
].map(withLabel);

/** OG-087: the entries an EMPLOYEE sees (their card, expenses and receipts, and their settings), nothing else. */
export const EMPLOYEE_NAV = new Set(['spend', 'settings']);

/** OG-087: the phone tab bar for an EMPLOYEE. */
export const EMPLOYEE_TABS: NavEntry[] = [
  { to: '/spend/me', id: 'my_card', end: true },
  { to: '/spend/me/expenses', id: 'my_expenses' },
  { to: '/spend/me/receipts', id: 'my_receipts' },
  { to: '/more', id: 'more' },
].map(withLabel);

/** OG-040: the side menu in groups (a heading where it helps, `app.nav.group.<id>`; null is a group without one). */
export const NAV_GROUPS: { id: string | null; ids: string[] }[] = [
  { id: null, ids: ['home'] },
  { id: 'money', ids: ['accounts', 'payments', 'get_paid', 'cards', 'spend'] },
  { id: 'company', ids: ['team', 'documents'] },
  { id: null, ids: ['support', 'settings'] },
];

/** The phone tab bar (OG-035 R8): Pay sits in the centre and opens Send. */
export const PHONE_TABS: NavEntry[] = [
  { to: '/', id: 'home', end: true },
  { to: '/accounts', id: 'accounts' },
  { to: '/payments/new', id: 'pay' },
  { to: '/cards', id: 'cards' },
  { to: '/more', id: 'more' },
].map(withLabel);

/** What More lists on a phone (OG-035 R8), before Sign out. */
export const MORE: NavEntry[] = [
  ...(ACCEPTANCE_ENABLED ? [{ to: '/get-paid', id: 'get_paid' }] : []),
  { to: '/spend', id: 'spend' },
  { to: '/support', id: 'support' },
  { to: '/team', id: 'team' },
  { to: '/documents', id: 'documents' },
  { to: '/settings', id: 'settings' },
  { to: '/notifications', id: 'notifications' },
].map(withLabel);

/** The page name for the browser tab, by route (WCAG 2.4.2); content keys `app.nav.title.<page>`. */
const TITLES: [RegExp, string][] = [
  [/^\/$/, 'home'],
  [/^\/accounts/, 'accounts'],
  [/^\/payments\/new/, 'new_payment'],
  [/^\/payments\/top-up/, 'add_money'],
  [/^\/payments\/schedules/, 'schedules'],
  [/^\/payments\/recipients/, 'recipients'],
  [/^\/payments\/approvals/, 'approvals'],
  [/^\/payments\/convert/, 'convert'],
  [/^\/payments\/abroad/, 'abroad'],
  [/^\/payments\/(international|movements)/, 'international'],
  [/^\/payments/, 'payments'],
  [/^\/recipients/, 'recipients'],
  [/^\/get-paid/, 'get_paid'],
  [/^\/cards/, 'cards'],
  [/^\/spend\/me/, 'my_spend'],
  [/^\/spend/, 'spend'],
  [/^\/team/, 'team'],
  [/^\/documents/, 'documents'],
  [/^\/more/, 'more'],
  [/^\/onboarding/, 'onboarding'],
  [/^\/support\/new/, 'new_request'],
  [/^\/support/, 'support'],
  [/^\/settings/, 'settings'],
  [/^\/notifications/, 'notifications'],
];

export function pageTitle(pathname: string): string {
  const page = TITLES.find(([re]) => re.test(pathname))?.[1];
  return page ? t(`app.nav.title.${page}`) : brand().names.product;
}
