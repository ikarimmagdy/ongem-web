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
  { to: '/cards', id: 'cards' },
  { to: '/team', id: 'team' },
  { to: '/documents', id: 'documents' },
  { to: '/support', id: 'support' },
  { to: '/settings', id: 'settings' },
].map(withLabel);

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
