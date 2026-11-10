import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoOnGemApi, type DemoOptions } from '../api/demo';
import { demoMe } from '../api/demoData';
import { LiveOnGemApi } from '../api/live';
import { MemoryDeviceKeys } from '../api/device';
import type { Me } from '../api/types';
import { ApiError, errorText } from '../api/errors';
import { renderApp } from './render';

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
    {
      id: 'mbr_demo_gone',
      companyId: 'cmp_demo_gone',
      companyName: 'Former Partners LLC',
      role: 'OWNER',
      state: 'REMOVED',
    },
  ],
};

/** A demo client that keeps every client the switcher makes, to see what each one loaded. */
class Spy extends DemoOnGemApi {
  constructor(
    opts: DemoOptions,
    readonly made: Spy[] = [],
  ) {
    super(opts);
  }
  override forCompany(companyId: string | null): Spy {
    const next = new Spy({ me: twoCompanies, companyId }, this.made);
    this.made.push(next);
    return next;
  }
}

describe('company switcher (G-69)', () => {
  it('is not shown with one company AC-R4.1', async () => {
    renderApp('/');
    expect(await screen.findByTestId('home-company')).toHaveTextContent('Northwind Labs LLC');
    expect(screen.queryByTestId('company-switcher')).not.toBeInTheDocument();
  });

  it('lists the active companies and switching reloads every screen for the picked company AC-R4.2', async () => {
    const api = new Spy({ me: twoCompanies });
    renderApp('/payments', { api });
    const switcher = await screen.findByTestId('company-switcher');
    expect(switcher).toHaveTextContent('Northwind Labs LLC');
    await userEvent.click(switcher);
    const options = within(await screen.findByTestId('company-options'));
    expect(options.getAllByRole('button')).toHaveLength(2);
    expect(options.queryByText('Former Partners LLC')).not.toBeInTheDocument();
    expect(screen.getByTestId('company-option-cmp_demo_northwind')).toHaveAttribute('aria-current', 'true');
    await userEvent.click(screen.getByTestId('company-option-cmp_demo_gulf'));

    await waitFor(() => expect(screen.getByTestId('company-switcher')).toHaveTextContent('Gulf Trading FZE'));
    expect(api.made.map((a) => a.companyId)).toEqual(['cmp_demo_gulf']);
    const gulf = api.made[0]!;
    // A new client: Home is loaded again from it, the old client's answers are not reused.
    await waitFor(() => expect(gulf.calls).toEqual(expect.arrayContaining(['me', 'accounts'])));
    expect(await screen.findByTestId('home-company')).toHaveTextContent('Gulf Trading FZE');
    expect(screen.getByTestId('home-company')).toHaveTextContent('Viewer');
  });
});

describe('live client company header (G-69)', () => {
  it('sends X-Company-Id only for a picked company AC-R4.2', async () => {
    const sent: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      sent.push({ url, headers: init.headers as Record<string, string> });
      const body = url.endsWith('/v1/devices/challenge')
        ? { challengeId: 'ch_1', nonce: 'bm9uY2U' }
        : url.endsWith('/v1/devices')
          ? { id: 'dev_1' }
          : [];
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const base = new LiveOnGemApi({
      baseUrl: '',
      fetchImpl,
      getToken: () => Promise.resolve('t'),
      reverify: () => Promise.resolve(true),
    });
    await base.accounts();
    const gulf = base.forCompany('cmp_gulf');
    await gulf.accounts();
    await gulf.forCompany(null).accounts();
    expect(sent.map((s) => s.headers['X-Company-Id'])).toEqual([undefined, 'cmp_gulf', undefined]);
    expect(gulf.companyId).toBe('cmp_gulf');
  });
});

const aeMe: Me = {
  ...demoMe,
  companyId: 'cmp_ae_dune',
  memberships: [
    {
      id: 'mbr_ae_dune',
      companyId: 'cmp_ae_dune',
      companyName: 'Dune Holdings LLC',
      role: 'OWNER',
      state: 'ACTIVE',
      companyState: 'ACTIVE',
      unreadNotices: 0,
    },
  ],
};

describe('company switcher across regions (OG-023)', () => {
  it('lists companies from both regions AC-R12.1', async () => {
    const api = new DemoOnGemApi({ regions: { AE: aeMe } });
    renderApp('/', { api });
    const switcher = await screen.findByTestId('company-switcher');
    expect(switcher).toHaveAccessibleName(/Northwind Labs LLC in United States/);
    await userEvent.click(switcher);
    const options = within(await screen.findByTestId('company-options'));
    expect(options.getAllByRole('button')).toHaveLength(2);
    const ae = screen.getByTestId('company-option-cmp_ae_dune');
    expect(ae).toHaveAttribute('data-region', 'AE');
    expect(ae).toHaveTextContent('Dune Holdings LLC');
    expect(ae).toHaveTextContent('United Arab Emirates');
    expect(screen.getByTestId('company-option-cmp_demo_northwind')).toHaveTextContent('United States');
  });

  it('a UAE pick calls only the UAE base URL AC-R12.2', async () => {
    const US = 'https://api-dev.ongem.com';
    const AE = 'https://api-dev.ae.platform.ongem.com';
    const usMe: Me = {
      ...demoMe,
      memberships: demoMe.memberships.map((m) => ({ ...m, companyState: 'ACTIVE' as const })),
    };
    const sent: Array<{ url: string; company?: string }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      sent.push({ url, company: headers['X-Company-Id'] });
      const path = url.replace(/^https:\/\/[^/]+/, '').split('?')[0]!;
      const body =
        path === '/v1/me'
          ? url.startsWith(AE)
            ? aeMe
            : usMe
          : path === '/v1/notifications'
            ? { items: [], unread: 0 }
            : path.startsWith('/v1/payments') || path === '/v1/recipients' || path === '/v1/cards'
              ? { items: [], next: null }
              : path === '/v1/whereami'
                ? { companyId: 'cmp_ae_dune', region: 'AE', apiBaseUrl: AE }
                : [];
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const api = new LiveOnGemApi({
      baseUrl: US,
      region: 'US',
      regionBases: { US, AE },
      fetchImpl,
      getToken: () => Promise.resolve('t'),
      reverify: () => Promise.resolve(true),
    });
    renderApp('/', { api });
    await userEvent.click(await screen.findByTestId('company-switcher'));
    await userEvent.click(await screen.findByTestId('company-option-cmp_ae_dune'));
    await waitFor(() =>
      expect(screen.getByTestId('company-switcher')).toHaveTextContent('Dune Holdings LLC'),
    );
    await waitFor(() =>
      expect(sent.some((s) => s.company === 'cmp_ae_dune' && s.url === `${AE}/v1/accounts`)).toBe(true),
    );
    const forDune = sent.filter((s) => s.company === 'cmp_ae_dune');
    expect(forDune.length).toBeGreaterThan(1);
    expect(forDune.every((s) => s.url.startsWith(AE))).toBe(true);
    // The US API is only asked for the person's own US memberships, never for the UAE company.
    expect(sent.filter((s) => s.url.startsWith(US)).every((s) => s.company === undefined)).toBe(true);
  });

  it('one region down still lists the other AC-R12.3', async () => {
    const api = new DemoOnGemApi({ me: twoCompanies, regions: { AE: 'down' } });
    renderApp('/', { api });
    const switcher = await screen.findByTestId('company-switcher');
    expect(await screen.findByTestId('companies-partial')).toHaveTextContent(
      'Some of your companies could not be loaded.',
    );
    await userEvent.click(switcher);
    const options = within(await screen.findByTestId('company-options'));
    expect(options.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByTestId('company-option-cmp_demo_gulf')).toBeInTheDocument();
  });

  it('a closed company is marked and read-only AC-R13.1', async () => {
    const closed: Me = {
      ...twoCompanies,
      memberships: twoCompanies.memberships.map((m) =>
        m.companyId === 'cmp_demo_northwind' ? { ...m, companyState: 'CLOSED' as const } : m,
      ),
    };
    const api = new DemoOnGemApi({ me: closed });
    renderApp('/payments', { api });
    expect(await screen.findByTestId('company-read-only')).toHaveTextContent('This company is closed.');
    // The owner keeps reading, but no write action is offered in a closed company.
    expect(await screen.findByTestId('scheduled')).toBeInTheDocument();
    expect(screen.queryByTestId('new-payment')).not.toBeInTheDocument();
    expect(screen.queryByTestId('add-money')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('company-switcher'));
    expect(screen.getByTestId('company-state-cmp_demo_northwind')).toHaveTextContent('Closed');
    expect(screen.queryByTestId('company-state-cmp_demo_gulf')).not.toBeInTheDocument();
  });

  it('a frozen company is marked frozen and read-only AC-R13.1', async () => {
    const frozen: Me = {
      ...twoCompanies,
      memberships: twoCompanies.memberships.map((m) =>
        m.companyId === 'cmp_demo_northwind' ? { ...m, companyState: 'FROZEN' as const } : m,
      ),
    };
    renderApp('/payments', { api: new DemoOnGemApi({ me: frozen }) });
    expect(await screen.findByTestId('company-read-only')).toHaveTextContent('This company is frozen.');
    expect(screen.queryByTestId('new-payment')).not.toBeInTheDocument();
  });

  it('the switcher shows each company unread notices AC-R14.1', async () => {
    const unread: Me = {
      ...twoCompanies,
      memberships: twoCompanies.memberships.map((m) =>
        m.companyId === 'cmp_demo_gulf' ? { ...m, unreadNotices: 3 } : m,
      ),
    };
    renderApp('/', { api: new DemoOnGemApi({ me: unread }) });
    const switcher = await screen.findByTestId('company-switcher');
    expect(screen.getByTestId('switcher-unread')).toHaveTextContent('3');
    expect(switcher).toHaveAccessibleName(/Unread notices in your companies: 3/);
    await userEvent.click(switcher);
    expect(screen.getByTestId('company-unread-cmp_demo_gulf')).toHaveTextContent('3 unread');
    expect(screen.queryByTestId('company-unread-cmp_demo_northwind')).not.toBeInTheDocument();
  });

  it('the switcher is reachable by keyboard and announces the current company N6', async () => {
    renderApp('/', { api: new DemoOnGemApi({ me: twoCompanies }) });
    const switcher = await screen.findByTestId('company-switcher');
    switcher.focus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('company-option-cmp_demo_northwind')).toHaveAttribute('aria-current', 'true');
  });
});

describe('transfer between my companies (OG-023 R11, client)', () => {
  const owners: Me = {
    ...twoCompanies,
    memberships: twoCompanies.memberships.map((m) =>
      m.companyId === 'cmp_demo_gulf' ? { ...m, role: 'OWNER' } : m,
    ),
  };

  it('a transfer between my companies goes as INTERNAL to the other company account AC-R11.1', async () => {
    const api = new Spy({ me: owners });
    const created: Array<Parameters<DemoOnGemApi['createPayment']>[0]> = [];
    const create = api.createPayment;
    api.createPayment = (r) => {
      created.push(r);
      return create(r);
    };
    renderApp('/payments/new', { api });
    const kind = await screen.findByTestId('payment-kind');
    await waitFor(() =>
      expect(within(kind).getByRole('option', { name: 'Between my companies' })).toBeInTheDocument(),
    );
    await userEvent.selectOptions(kind, 'company');
    const to = await screen.findByTestId('payment-to-company-account');
    const option = within(to)
      .getAllByRole('option')
      .find((o) => o.textContent?.startsWith('Gulf Trading FZE, '))!;
    await userEvent.selectOptions(to, option);
    await userEvent.type(screen.getByTestId('payment-amount'), '25');
    await userEvent.click(screen.getByTestId('payment-review-button'));
    expect(await screen.findByTestId('payment-review')).toHaveTextContent('Gulf Trading FZE');
    await userEvent.click(screen.getByTestId('payment-send'));
    expect(await screen.findByTestId('payment-detail')).toHaveTextContent('Transfer between your companies');
    expect(created[0]).toMatchObject({ rail: 'INTERNAL', recipientId: null });
    expect(created[0]!.toAccountId).toMatch(/_cmp_demo_gulf$/);
  });

  it('a destination outside my companies is refused with destination_not_allowed AC-R11.2', async () => {
    const api = new DemoOnGemApi({ me: owners });
    await expect(
      api.createPayment({
        fromAccountId: (await api.accounts())[0]!.id,
        toAccountId: 'acc_x_cmp_stranger',
        rail: 'INTERNAL',
        amountMinor: 100,
        currency: 'USD',
      }),
    ).rejects.toMatchObject({ code: 'destination_not_allowed' });
    expect(errorText(new ApiError(409, 'destination_not_allowed'))).toBe(
      'You can transfer only to a company where you are an active member.',
    );
  });
});

describe('the switcher leaves no record where the person is unknown (OG-022 R25)', () => {
  it('a region whose whereami knows no company gets no me call AC-R12.1 N4', async () => {
    const US = 'https://api-dev.ongem.com';
    const AE = 'https://api-dev.ae.platform.ongem.com';
    const sent: Array<{ url: string; method: string }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      sent.push({ url, method: init.method ?? 'GET' });
      const path = url.replace(/^https:\/\/[^/]+/, '').split('?')[0]!;
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
      if (path === '/v1/devices/challenge') return json({ challengeId: 'dch_1', nonce: 'bm9uY2U' }, 201);
      if (path === '/v1/devices') return json({ id: 'dev_1' }, 201);
      if (path === '/v1/whereami')
        return json(
          url.startsWith(AE)
            ? { companyId: null, region: null, apiBaseUrl: null }
            : { companyId: 'cmp_demo_northwind', region: 'US', apiBaseUrl: US },
        );
      if (path === '/v1/me') return json(twoCompanies);
      if (path === '/v1/notifications') return json({ items: [], unread: 0 });
      if (path.startsWith('/v1/payments') || path === '/v1/recipients' || path === '/v1/cards')
        return json({ items: [], next: null });
      return json([]);
    }) as unknown as typeof fetch;
    const api = new LiveOnGemApi({
      baseUrl: US,
      region: 'US',
      regionBases: { US, AE },
      personId: 'user_1',
      deviceKeys: new MemoryDeviceKeys(),
      fetchImpl,
      getToken: () => Promise.resolve('t'),
      reverify: () => Promise.resolve(true),
    });
    renderApp('/', { api });
    await userEvent.click(await screen.findByTestId('company-switcher'));
    expect(within(await screen.findByTestId('company-options')).getAllByRole('button')).toHaveLength(2);
    await waitFor(() => expect(sent.some((s) => s.url === `${AE}/v1/whereami`)).toBe(true));
    const toAe = sent.filter((s) => s.url.startsWith(AE));
    expect(toAe.map((s) => s.url)).toEqual(toAe.map(() => `${AE}/v1/whereami`));
    expect(toAe.every((s) => s.method === 'GET')).toBe(true);
    // A region that simply does not hold the person is no failure: no notice.
    expect(screen.queryByTestId('companies-partial')).not.toBeInTheDocument();
  });
});
