import { act, screen, waitFor, within } from '@testing-library/react';
import { DemoOnGemApi } from '../api/demo';
import { setLocale } from '../i18n';
import { renderApp } from './render';

/** OG-049: Home across accounts (architecture v7 s2, step 0.3). */

const currencies = (withTotal: boolean) =>
  new DemoOnGemApi({ scenario: withTotal ? 'currencies_total' : 'currencies' });

describe('OG-049 Home across accounts', () => {
  afterEach(async () => {
    await act(() => setLocale('en'));
  });

  it('every account row names the institution that holds it, from the content key', async () => {
    renderApp('/');
    await screen.findByTestId('home-total');
    for (const id of ['acc_demo_ops', 'acc_demo_tax', 'acc_demo_payroll'])
      expect(await screen.findByTestId(`home-institution-${id}`)).toHaveTextContent(
        'Piermont Bank, Member FDIC',
      );
  });

  it('one currency keeps its exact total and never asks the API for an indicative one', async () => {
    const api = new DemoOnGemApi();
    renderApp('/', { api });
    expect(await screen.findByTestId('home-total')).toHaveTextContent('US$159,550.16');
    expect(screen.queryByTestId('home-indicative')).not.toBeInTheDocument();
    expect(api.calls).not.toContain('accountsTotal');
  });

  it('across currencies with the total switched off there is no total, and a foreign balance names no home bank', async () => {
    const api = currencies(false);
    renderApp('/', { api });
    const list = await screen.findByTestId('home-breakdown');
    expect(within(list).getByText('EUR 11,500.00')).toBeInTheDocument();
    await waitFor(() => expect(api.calls).toContain('accountsTotal'));
    expect(screen.queryByTestId('home-total')).not.toBeInTheDocument();
    expect(screen.getByTestId('home-balance')).toHaveTextContent('Accounts');
    expect(screen.queryByTestId('home-institution-acc_demo_eur')).not.toBeInTheDocument();
    expect(screen.getByTestId('home-institution-acc_demo_ops')).toBeInTheDocument();
  });

  it('when the API returns the total it is labelled as indicative, with why', async () => {
    renderApp('/', { api: currencies(true) });
    const box = await screen.findByTestId('home-indicative');
    expect(within(box).getByTestId('home-total')).toHaveTextContent('US$172,050.66');
    expect(box).toHaveTextContent("Total in USD at today's indicative rates");
    expect(box).toHaveTextContent('An indication only. Money converts only at a rate you accept.');
  });

  it('a total the API cannot give leaves Home working without one', async () => {
    const api = currencies(true);
    api.accountsTotal = () => Promise.reject(new Error('down'));
    renderApp('/', { api });
    await screen.findByTestId('home-breakdown');
    await waitFor(() => expect(screen.getByTestId('home-balance')).toHaveTextContent('Accounts'));
    expect(screen.queryByTestId('home-total')).not.toBeInTheDocument();
  });

  it('no accounts shows a zero total and no rows', async () => {
    const api = new DemoOnGemApi();
    api.accounts = async () => [];
    renderApp('/', { api });
    expect(await screen.findByTestId('home-total')).toHaveTextContent('US$0.00');
    expect(screen.queryByTestId('home-breakdown')).not.toBeInTheDocument();
  });

  it('in Arabic the institution and the indicative label are Arabic content', async () => {
    await act(() => setLocale('ar'));
    renderApp('/', { api: currencies(true) });
    expect(await screen.findByTestId('home-institution-acc_demo_ops')).toHaveTextContent(
      'Piermont Bank، عضو FDIC',
    );
    expect(await screen.findByTestId('home-indicative')).toHaveTextContent(
      'الإجمالي بعملة USD بأسعار اليوم الاسترشادية',
    );
  });
});
