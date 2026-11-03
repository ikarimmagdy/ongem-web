import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoOnGemApi, type DemoOptions } from '../api/demo';
import { demoMe } from '../api/demoData';
import { LiveOnGemApi } from '../api/live';
import type { Me } from '../api/types';
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
  it('is not shown with one company', async () => {
    renderApp('/');
    expect(await screen.findByTestId('home-company')).toHaveTextContent('Northwind Labs LLC');
    expect(screen.queryByTestId('company-switcher')).not.toBeInTheDocument();
  });

  it('lists the active companies and switching reloads every screen for the picked company', async () => {
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
  it('sends X-Company-Id only for a picked company', async () => {
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
