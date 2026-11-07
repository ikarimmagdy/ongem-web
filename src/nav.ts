export const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/accounts', label: 'Accounts' },
  { to: '/payments', label: 'Payments' },
  { to: '/cards', label: 'Cards' },
  { to: '/support', label: 'Support' },
  { to: '/settings', label: 'Settings' },
];

/** The page name for the browser tab, by route (WCAG 2.4.2). */
const TITLES: [RegExp, string][] = [
  [/^\/$/, 'Home'],
  [/^\/accounts/, 'Accounts'],
  [/^\/payments\/new/, 'New payment'],
  [/^\/payments\/top-up/, 'Add money'],
  [/^\/payments\/schedules/, 'Scheduled payments'],
  [/^\/payments/, 'Payments'],
  [/^\/recipients/, 'Recipients'],
  [/^\/cards/, 'Cards'],
  [/^\/onboarding/, 'Your application'],
  [/^\/support\/new/, 'New request'],
  [/^\/support/, 'Support'],
  [/^\/settings/, 'Settings'],
  [/^\/notifications/, 'Notifications'],
];

export function pageTitle(pathname: string): string {
  return TITLES.find(([re]) => re.test(pathname))?.[1] ?? 'OnGem';
}
