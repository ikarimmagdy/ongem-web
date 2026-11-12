import { ACCEPTANCE_ENABLED } from './acceptance/api';
import { t } from './i18n/store';

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
  { to: '/team', id: 'team' },
  { to: '/documents', id: 'documents' },
  { to: '/support', id: 'support' },
  { to: '/settings', id: 'settings' },
].map(withLabel);

/** OG-040: the side menu in groups (a heading where it helps, `app.nav.group.<id>`; null is a group without one). */
export const NAV_GROUPS: { id: string | null; ids: string[] }[] = [
  { id: null, ids: ['home'] },
  { id: 'money', ids: ['accounts', 'payments', 'get_paid', 'cards'] },
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
  [/^\/payments/, 'payments'],
  [/^\/recipients/, 'recipients'],
  [/^\/get-paid/, 'get_paid'],
  [/^\/cards/, 'cards'],
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
  return page ? t(`app.nav.title.${page}`) : 'OnGem';
}
