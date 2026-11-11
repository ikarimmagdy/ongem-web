import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { DemoOnGemApi } from '../api/demo';
import { demoMe } from '../api/demoData';
import { ApiError } from '../api/errors';
import type { Me } from '../api/types';
import { setLocale, t } from '../i18n';
import { asPhone, renderApp } from './render';

/** OG-035: information structure and Home (spec ongem-engineering/specs/OG-035-app-structure-home). */

const asRole = (role: string) =>
  new DemoOnGemApi({ me: { ...demoMe, memberships: demoMe.memberships.map((m) => ({ ...m, role })) } });

const withState = (companyState: 'FROZEN' | 'CLOSING' | 'CLOSED') =>
  new DemoOnGemApi({
    me: { ...demoMe, memberships: demoMe.memberships.map((m) => ({ ...m, companyState })) },
  });

const twoCompanies: Me = {
  ...demoMe,
  memberships: [
    ...demoMe.memberships,
    {
      id: 'mbr_demo_gulf',
      companyId: 'cmp_demo_gulf',
      companyName: 'Gulf Trading FZE',
      role: 'VIEWER',
      state: 'ACTIVE',
    },
  ],
};

/** A company with nothing waiting: account open, no approvals, no card alert, no unread notice. */
function quiet() {
  const api = new DemoOnGemApi();
  const base = api.applications.bind(api);
  api.applications = async () => (await base()).map((a) => ({ ...a, state: 'ACTIVE' }));
  api.payments = async () => ({ items: [], next: null });
  api.cards = async () => ({ items: [], next: null });
  api.notifications = async () => ({ items: [], unread: 0 });
  return api;
}

const count = (needle: string) => (document.body.textContent ?? '').split(needle).length - 1;

describe('OG-035 R1: the company shows once, as the switcher', () => {
  it('AC_R1_1 the company name appears once, at the top of the side bar, and not in the top bar', async () => {
    renderApp('/');
    await screen.findByTestId('home-total');
    await waitFor(() => expect(screen.getByTestId('side-company')).toHaveTextContent('Northwind Labs LLC'));
    expect(count('Northwind Labs LLC')).toBe(1);
    expect(document.querySelector('header.fw-topbar')).not.toHaveTextContent('Northwind Labs LLC');
  });

  it('AC_R1_1 on a phone the name starts the top bar, once', async () => {
    const undo = asPhone();
    try {
      renderApp('/');
      await screen.findByTestId('home-total');
      await waitFor(() => expect(screen.getByTestId('top-company')).toHaveTextContent('Northwind Labs LLC'));
      expect(count('Northwind Labs LLC')).toBe(1);
      expect(screen.queryByTestId('side-company')).not.toBeInTheDocument();
    } finally {
      undo();
    }
  });

  it('AC_R1_2 with two companies the switcher at the top of the side bar lists both and a pick returns to Home', async () => {
    renderApp('/payments', { api: new DemoOnGemApi({ me: twoCompanies }) });
    const switcher = await screen.findByTestId('company-switcher');
    expect(switcher.closest('[data-testid="side-company"]')).not.toBeNull();
    await userEvent.click(switcher);
    const options = within(await screen.findByTestId('company-options'));
    expect(options.getAllByRole('button')).toHaveLength(2);
    await userEvent.click(screen.getByTestId('company-option-cmp_demo_gulf'));
    await waitFor(() => expect(screen.getByTestId('company-switcher')).toHaveTextContent('Gulf Trading FZE'));
    expect(await screen.findByTestId('home-balance')).toBeInTheDocument();
  });
});

describe('OG-035 R2: a compact balance card', () => {
  it('AC_R2_1 title, total, accounts, then actions, in that order, the total aligned to the start', async () => {
    renderApp('/');
    const card = await screen.findByTestId('home-balance');
    const total = await within(card).findByTestId('home-total');
    const list = await within(card).findByTestId('home-breakdown');
    const actions = within(card).getByTestId('home-actions');
    const title = within(card).getByRole('heading', { name: t('app.home.available') });
    expect(title.compareDocumentPosition(total) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(total.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(list.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(total).toHaveClass('fw-total');
    const css = readFileSync('src/app-shell.css', 'utf8');
    expect(css).toMatch(/\.fw-total \{[^}]*text-align: start;/);
    expect(
      within(actions)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['New payment', 'Add money', 'Ask for help']);
  });

  it('AC_R2_2 a Viewer sees Ask for help only; a frozen company has no New payment or Add money', async () => {
    const { unmount } = renderApp('/', { api: asRole('VIEWER') });
    let actions = await screen.findByTestId('home-actions');
    await screen.findByTestId('home-total');
    expect(
      within(actions)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Ask for help']);
    unmount();
    renderApp('/', { api: withState('FROZEN') });
    await screen.findByTestId('company-read-only');
    actions = await screen.findByTestId('home-actions');
    expect(within(actions).queryByTestId('home-new-payment')).toBeNull();
    expect(within(actions).queryByTestId('home-add-money')).toBeNull();
  });

  it('AC_R2_3 on a phone the actions are one grid row of equal columns (layout checked at 390 px in e2e)', () => {
    const css = readFileSync('src/app-shell.css', 'utf8');
    const phone = css.slice(css.indexOf('@media (max-width: 900px)'));
    expect(phone).toMatch(
      /\.fw-home-actions \{\s*display: grid;\s*grid-auto-flow: column;\s*grid-auto-columns: minmax\(0, 1fr\);/,
    );
  });
});

describe('OG-035 R3: Needs you', () => {
  it('AC_R3_1 nothing waiting says Nothing needs you', async () => {
    renderApp('/', { api: quiet() });
    const needs = await screen.findByTestId('home-needs');
    expect(await within(needs).findByTestId('needs-empty')).toHaveTextContent('Nothing needs you');
  });

  it('AC_R3_2 an approver sees the waiting payment with Review, which opens it with Approve and Decline', async () => {
    renderApp('/');
    const item = await screen.findByTestId('need-approval-pay_demo_approval');
    expect(item).toHaveTextContent('Approve US$4,200.00 to Harbor Rent Co');
    await userEvent.click(within(item).getByRole('link', { name: 'Review' }));
    const detail = await screen.findByTestId('payment-detail');
    expect(within(detail).getByTestId('payment-approve')).toBeInTheDocument();
    expect(within(detail).getByTestId('payment-reject')).toBeInTheDocument();
  });

  it('AC_R3_2 a role without payment:approve gets no approval item', async () => {
    renderApp('/', { api: asRole('MEMBER') });
    await screen.findByTestId('needs-list');
    expect(screen.queryByTestId('need-approval-pay_demo_approval')).not.toBeInTheDocument();
  });

  it('AC_R3_3 the application, a frozen card and unread notices each have one action to their screen', async () => {
    renderApp('/');
    const app = await screen.findByTestId('need-application-app_demo_northwind');
    expect(app).toHaveTextContent('Your application: About your company');
    expect(within(app).getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/onboarding');
    const frozen = await screen.findByTestId('need-card-crd_demo_ops');
    expect(frozen).toHaveTextContent('Card ending 8830 is frozen');
    expect(within(frozen).getByRole('link', { name: 'Open card' })).toHaveAttribute(
      'href',
      '/cards/crd_demo_ops',
    );
    const notices = (await screen.findAllByTestId(/^need-notice-/)).map((n) => within(n).getByRole('link'));
    expect(notices.length).toBe(2);
    for (const l of notices) {
      expect(l).toHaveTextContent('Read');
      expect(l).toHaveAttribute('href', '/notifications');
    }
  });

  it('AC_R3_3 a card waiting for activation is listed', async () => {
    const api = new DemoOnGemApi();
    const base = api.cards.bind(api);
    api.cards = async () => {
      const page = await base();
      return {
        ...page,
        items: page.items.map((c) => (c.state === 'ACTIVE' ? { ...c, state: 'PENDING' } : c)),
      };
    };
    renderApp('/', { api });
    expect(await screen.findByTestId('need-card-crd_demo_dana')).toHaveTextContent(
      'Card ending 5521 is waiting to be activated',
    );
  });

  it('AC_R3_4 a failed read leaves what loaded, an error line and Try again', async () => {
    const api = new DemoOnGemApi();
    const base = api.cards.bind(api);
    let fail = true;
    api.cards = () => (fail ? Promise.reject(new ApiError(503, 'bank_unavailable')) : base());
    renderApp('/', { api });
    expect(await screen.findByTestId('needs-error')).toHaveTextContent('Some items could not be loaded.');
    expect(screen.getByTestId('need-approval-pay_demo_approval')).toBeInTheDocument();
    expect(screen.queryByTestId('need-card-crd_demo_ops')).not.toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByTestId('needs-retry'));
    expect(await screen.findByTestId('need-card-crd_demo_ops')).toBeInTheDocument();
    expect(screen.queryByTestId('needs-error')).not.toBeInTheDocument();
  });

  it('AC_R3_5 the source order is balance, Needs you, recent payments; a wide grid puts Needs you in the end column', async () => {
    renderApp('/');
    const balance = await screen.findByTestId('home-balance');
    const needs = screen.getByTestId('home-needs');
    const recent = screen.getByTestId('home-recent');
    expect(balance.compareDocumentPosition(needs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(needs.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const css = readFileSync('src/app-shell.css', 'utf8');
    expect(css).toMatch(
      /@media \(min-width: 1024px\) \{\s*\.fw-home \{[^}]*'balance needs'\s*'recent needs'/,
    );
  });
});

describe('OG-035 R4: recent payments by payee', () => {
  it('AC_R4_1 payee and amount first, then a status badge and the date', async () => {
    renderApp('/');
    const row = await screen.findByTestId('recent-pay_demo_approval');
    await waitFor(() => expect(row).toHaveTextContent('Harbor Rent Co'));
    const [first, second] = row.querySelectorAll('.fw-row__line');
    expect(first).toHaveTextContent('Harbor Rent Co');
    expect(first).toHaveTextContent('US$4,200.00');
    expect(second!.querySelector('.og-chip')).toHaveTextContent('Waiting for approval');
    expect(second).toHaveTextContent('29 Oct 2026');
    const transfer = await screen.findByTestId('recent-pay_demo_2');
    await waitFor(() => expect(transfer.querySelector('.fw-row__payee')).toHaveTextContent('Tax reserve'));
  });
});

describe('OG-035 R5: application progress by step', () => {
  const withApp = (state: string) => {
    const api = new DemoOnGemApi();
    const base = api.applications.bind(api);
    api.applications = async () => (await base()).map((a) => ({ ...a, state }));
    return api;
  };

  it('AC_R5_1 COLLECTING is About your company, SUBMITTED is The bank decides, ACTIVE has no banner', async () => {
    const first = renderApp('/');
    const steps = await screen.findByTestId('home-application');
    expect(within(steps).getByTestId('application-current')).toHaveTextContent(
      'Step 2 of 4: About your company',
    );
    expect(steps.querySelector('[aria-current="step"]')).toHaveAttribute('data-step', 'company');
    expect(steps).toHaveTextContent('We need a few details from you to finish your application.');
    expect(within(steps).getByTestId('application-action')).toHaveAttribute('href', '/onboarding');
    first.unmount();
    const second = renderApp('/', { api: withApp('SUBMITTED') });
    expect(await screen.findByTestId('application-current')).toHaveTextContent(
      'Step 3 of 4: The bank decides',
    );
    second.unmount();
    renderApp('/', { api: withApp('ACTIVE') });
    await screen.findByTestId('home-total');
    await screen.findByTestId('needs-list');
    expect(screen.queryByTestId('home-application')).not.toBeInTheDocument();
  });

  it('AC_R5_2 the action follows the text in the source, and a phone stacks it under the text', () => {
    const css = readFileSync('src/app-shell.css', 'utf8');
    const phone = css.slice(css.indexOf('@media (max-width: 900px)'));
    expect(phone).toMatch(/\.fw-appsteps \{\s*flex-direction: column;/);
  });
});

describe('OG-035 R6: Payments tabs', () => {
  const tabs = () =>
    within(screen.getByTestId('payments-tabs'))
      .getAllByRole('link')
      .map((a) => a.textContent);

  it('AC_R6_1 an owner sees six tabs, the current one marked', async () => {
    renderApp('/payments/schedules');
    await screen.findByTestId('payments-tabs');
    expect(tabs()).toEqual([
      'All payments',
      'Send',
      'Scheduled',
      'Recipients',
      'Add money',
      'Waiting for approval',
    ]);
    expect(screen.getByTestId('payments-tab-scheduled')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('payments-tab-all')).not.toHaveAttribute('aria-current');
  });

  it('AC_R6_2 a member has no Waiting for approval tab, and its route says why', async () => {
    renderApp('/payments/approvals', { api: asRole('MEMBER') });
    expect(await screen.findByTestId('approvals-denied')).toHaveTextContent(
      'Your role does not approve payments.',
    );
    expect(tabs()).not.toContain('Waiting for approval');
  });

  it('AC_R6_3 the old routes open their tabs; /recipients keeps its query', async () => {
    const r = renderApp('/recipients?add=1');
    expect(await screen.findByTestId('add-recipient')).toBeInTheDocument();
    expect(screen.getByTestId('payments-tab-recipients')).toHaveAttribute('aria-current', 'page');
    r.unmount();
    for (const [route, tab, testId] of [
      ['/payments/new', 'send', 'payment-review-button'],
      ['/payments/top-up', 'add_money', 'topup'],
      ['/payments/schedules', 'scheduled', 'schedules'],
    ] as const) {
      const { unmount } = renderApp(route);
      expect(await screen.findByTestId(testId)).toBeInTheDocument();
      expect(screen.getByTestId(`payments-tab-${tab}`)).toHaveAttribute('aria-current', 'page');
      unmount();
    }
  });

  it('AC_R6_4 Waiting for approval lists the payment and Approve moves it on; with none it says so', async () => {
    const api = new DemoOnGemApi();
    renderApp('/payments/approvals', { api });
    const row = await screen.findByTestId('approval-pay_demo_approval');
    await waitFor(() => expect(row).toHaveTextContent('Harbor Rent Co'));
    await userEvent.click(within(row).getByTestId('payment-approve'));
    expect(await screen.findByText('Nothing is waiting for your approval')).toBeInTheDocument();
    expect((await api.payment('pay_demo_approval')).state).not.toBe('PENDING_APPROVAL');
  });
});

describe('OG-035 R7: Team and Documents', () => {
  it('AC_R7_1 Team lists the person, the invitations and the form; Settings has no invitations', async () => {
    const r = renderApp('/team');
    expect(await screen.findByTestId('team-you')).toHaveTextContent('Dana Rivera');
    expect(screen.getByTestId('team-you')).toHaveTextContent('Owner');
    expect(await screen.findByTestId('settings-team')).toHaveTextContent('Invitations');
    expect(await screen.findByTestId('invite-email')).toBeInTheDocument();
    r.unmount();
    const s = renderApp('/settings');
    await screen.findByTestId('settings-language');
    expect(screen.queryByTestId('settings-team')).not.toBeInTheDocument();
    s.unmount();
    renderApp('/team', { api: asRole('APPROVER') });
    expect(await screen.findByTestId('team-no-invite')).toHaveTextContent(
      'Owners and admins can invite people',
    );
    expect(await screen.findByTestId('team-you')).toHaveTextContent('Approver');
  });

  it('AC_R7_2 Documents lists statements by account, exports and agreements, each opening', async () => {
    renderApp('/documents');
    const statements = await screen.findByTestId('documents-statements');
    const open = await within(statements).findByTestId('documents-statement-acc_demo_ops-2026-09');
    await userEvent.click(open);
    expect(await screen.findByTestId('statement-view')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    const exports = screen.getByTestId('documents-exports');
    expect(within(exports).getByRole('heading', { name: t('app.exports.title') })).toBeInTheDocument();
    const agreements = screen.getByTestId('documents-disclosures');
    const read = (await within(agreements).findAllByRole('button', { name: 'Read' }))[0]!;
    await userEvent.click(read);
    expect(await screen.findByTestId('documents-disclosure-text')).not.toBeEmptyDOMElement();
  });
});

describe('OG-035 R8: phone tabs and More', () => {
  it('AC_R8_1 a phone tab bar is Home, Accounts, Pay, Cards, More, and Pay opens Send', async () => {
    const undo = asPhone();
    try {
      renderApp('/');
      const bar = await screen.findByTestId('bottom-nav');
      expect(
        within(bar)
          .getAllByRole('link')
          .map((a) => a.textContent),
      ).toEqual(['Home', 'Accounts', 'Pay', 'Cards', 'More']);
      await userEvent.click(within(bar).getByTestId('tab-pay'));
      expect(await screen.findByTestId('payment-review-button')).toBeInTheDocument();
      expect(screen.getByTestId('payments-tab-send')).toHaveAttribute('aria-current', 'page');
    } finally {
      undo();
    }
  });

  it('AC_R8_2 More links Support, Team, Documents, Settings and Notifications with the unread count, and Sign out', async () => {
    renderApp('/more');
    const list = await screen.findByTestId('more-list');
    expect(
      within(list)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    ).toEqual(['/support', '/team', '/documents', '/settings', '/notifications']);
    expect(await screen.findByTestId('more-unread')).toHaveTextContent('2 unread');
    await userEvent.click(screen.getByTestId('more-sign-out'));
    expect(await screen.findByTestId('explore-demo')).toBeInTheDocument();
  });

  it('AC_R8_3 a wide side bar has the eight entries', async () => {
    renderApp('/');
    const side = document.querySelector('.fw-side nav') as HTMLElement;
    await screen.findByTestId('home-total');
    expect(
      within(side)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Home', 'Accounts', 'Payments', 'Cards', 'Team', 'Documents', 'Support', 'Settings']);
  });
});

describe('OG-035 R9: assistant and command search', () => {
  it('AC_R9_1 on a phone a floating button outside the top bar and tab bar opens the assistant', async () => {
    const undo = asPhone();
    try {
      renderApp('/');
      const fab = await screen.findByTestId('assistant-open');
      expect(fab.closest('header')).toBeNull();
      expect(fab.closest('[data-testid="bottom-nav"]')).toBeNull();
      expect(fab).toHaveAccessibleName('Open the assistant');
      await userEvent.click(fab);
      expect(await screen.findByTestId('assistant-panel')).toBeInTheDocument();
      expect(screen.queryByTestId('command-search-open')).not.toBeInTheDocument();
    } finally {
      undo();
    }
  });

  it('AC_R9_2 Ctrl K opens the search; it finds an account and Enter opens it; Escape returns focus', async () => {
    renderApp('/');
    const button = await screen.findByTestId('command-search-open');
    await userEvent.keyboard('{Control>}k{/Control}');
    const input = await screen.findByTestId('command-search-input');
    expect(input).toHaveAttribute('role', 'combobox');
    await userEvent.type(input, 'tax');
    expect(await screen.findByRole('option', { name: /Tax reserve/ })).toBeInTheDocument();
    const firstAccount = (await screen.findAllByTestId(/^search-option-account-/))[0]!;
    expect(firstAccount).toHaveAttribute('aria-selected', 'true');
    expect(input.getAttribute('aria-activedescendant')).toBe(firstAccount.id);
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByTestId('account-detail')).toHaveTextContent('Tax reserve');
    await userEvent.click(button);
    await screen.findByTestId('command-search-input');
    await userEvent.type(screen.getByTestId('command-search-input'), 'harbor');
    expect(await screen.findByTestId('search-option-recipient-rcp_demo_harbor')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('command-search')).not.toBeInTheDocument());
    expect(button).toHaveFocus();
  });

  it('AC_R9_3 Ask the assistant opens it and sends the query', async () => {
    const api = new DemoOnGemApi();
    renderApp('/', { api });
    await userEvent.click(await screen.findByTestId('command-search-open'));
    await userEvent.type(await screen.findByTestId('command-search-input'), 'Show my cards');
    await userEvent.click(screen.getByTestId('search-option-ask'));
    expect(await screen.findByTestId('assistant-panel')).toBeInTheDocument();
    const turn = await screen.findByTestId('assistant-turn');
    expect(turn).toHaveTextContent('Show my cards');
    expect(api.calls).toContain('sendAssistantMessage');
  });
});

describe('OG-035 R10: permissions, read-only, Arabic', () => {
  it('AC_R10_1 a frozen company shows the banner and offers no Send, Add money, approvals or approval item', async () => {
    renderApp('/payments', { api: withState('FROZEN') });
    expect(await screen.findByTestId('company-read-only')).toBeInTheDocument();
    await screen.findByTestId('payments-tabs');
    await waitFor(() => expect(screen.queryByTestId('payments-tab-send')).not.toBeInTheDocument());
    expect(screen.queryByTestId('payments-tab-add_money')).not.toBeInTheDocument();
    expect(screen.queryByTestId('payments-tab-approvals')).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByTestId('nav-home')[0]!);
    await screen.findByTestId('needs-list');
    expect(screen.queryByTestId('need-approval-pay_demo_approval')).not.toBeInTheDocument();
  });

  it('AC_R10_2 Arabic lays the new structure out right to left with Arabic words', async () => {
    await act(() => setLocale('ar'));
    renderApp('/');
    await waitFor(() => expect(document.documentElement).toHaveAttribute('dir', 'rtl'));
    expect(await screen.findByText('بحاجة إليك')).toBeInTheDocument();
    expect(screen.getByText('ابحث أو اسأل')).toBeInTheDocument();
    expect(await screen.findByTestId('application-current')).toHaveTextContent('الخطوة 2 من 4: عن شركتك');
    const css = readFileSync('src/app-shell.css', 'utf8');
    expect(css).not.toMatch(
      /(?<![-\w])(left|right)\s*:|margin-(left|right)|padding-(left|right)|border-(left|right)/,
    );
  });
});

describe('OG-035 R11: content keys', () => {
  it('AC_R11_1 every new key is in both regions in English and Arabic, without dashes', () => {
    const keys = [
      ...readFileSync('src/screens/NeedsYou.tsx', 'utf8').matchAll(/'(app\.home\.needs\.[a-z_]+)'/g),
      ...readFileSync('src/nav.ts', 'utf8').matchAll(/'(app\.nav\.[a-z_.]+)'/g),
    ].map((m) => m[1]!);
    const fixed = [
      'app.nav.team',
      'app.nav.documents',
      'app.nav.pay',
      'app.nav.more',
      'app.nav.notifications',
      'app.payments.tabs.approvals',
      'app.search.ask',
      'app.home.steps.current',
      'app.team.invitations',
      'app.documents.disclosures',
      'app.more.unread',
      'app.assistant.fab_label',
    ];
    for (const region of ['us', 'ae']) {
      const seed = JSON.parse(readFileSync(`content-seed/${region}/web_app.json`, 'utf8')) as {
        entries: Array<{ key: string; en: string; ar: string }>;
      };
      const byKey = new Map(seed.entries.map((e) => [e.key, e]));
      for (const k of [...keys, ...fixed]) {
        const e = byKey.get(k);
        expect(e, `${region} ${k}`).toBeDefined();
        expect(e!.en.length).toBeGreaterThan(0);
        expect(e!.ar.length).toBeGreaterThan(0);
        expect(`${e!.en}${e!.ar}`).not.toMatch(/[–—]/);
      }
    }
  });
});
