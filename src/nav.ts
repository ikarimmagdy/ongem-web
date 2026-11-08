import { t } from './i18n/store';

/** The signed-in tabs; `id` names the tab's test id and its content key `app.nav.<id>`. */
const TABS = [
  { to: '/', id: 'home', end: true },
  { to: '/accounts', id: 'accounts' },
  { to: '/payments', id: 'payments' },
  { to: '/cards', id: 'cards' },
  { to: '/support', id: 'support' },
  { to: '/settings', id: 'settings' },
];

/** The tabs with their words in the reader's language. */
export const NAV: Array<{ to: string; id: string; end?: boolean; readonly label: string }> = TABS.map(
  (n) => ({
    ...n,
    get label() {
      return t(`app.nav.${n.id}`);
    },
  }),
);

/** The page name for the browser tab, by route (WCAG 2.4.2); content keys `app.nav.title.<page>`. */
const TITLES: [RegExp, string][] = [
  [/^\/$/, 'home'],
  [/^\/accounts/, 'accounts'],
  [/^\/payments\/new/, 'new_payment'],
  [/^\/payments\/top-up/, 'add_money'],
  [/^\/payments\/schedules/, 'schedules'],
  [/^\/payments/, 'payments'],
  [/^\/recipients/, 'recipients'],
  [/^\/cards/, 'cards'],
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
