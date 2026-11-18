import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { DemoOnGemApi } from '../api/demo';
import { demoMe } from '../api/demoData';
import { OG054_CODES } from '../api/errors';
import { chooseOption, renderApp } from './render';

/** OG-054 multi-currency on the founder web (contract ongem-engineering/outputs/review/og054-2026-11-19/multi-currency-api.md). */

const PROVIDER_NAMES = /simulator|synctera|ruya|globalsim|mock/i;

const demo = (role = 'OWNER') =>
  new DemoOnGemApi({
    stepUp: () => Promise.resolve(true),
    me: { ...demoMe, memberships: demoMe.memberships.map((m) => ({ ...m, role })) },
  });

describe('OG-054 currency accounts', () => {
  it('OG054_open_currency_account an owner opens EUR with step-up and sees its IBAN, BIC and the bank the API names', async () => {
    const api = demo();
    renderApp('/accounts', { api });
    await userEvent.click(await screen.findByTestId('accounts-open-currency'));
    await chooseOption(await screen.findByTestId('currency-account-currency'), 'EUR');
    expect(screen.getByTestId('currency-account-institution')).toHaveTextContent(
      'Harbour Global Bank (sample)',
    );
    await userEvent.click(screen.getByTestId('currency-account-submit'));
    const done = await screen.findByTestId('currency-account-opened');
    expect(await within(done).findByTestId('receiving-iban')).toHaveTextContent('DE89 3704 0044 0532 0130 00');
    expect(within(done).getByTestId('receiving-bic')).toHaveTextContent('HGBKDEFFXXX');
    expect(within(done).getByTestId('receiving-iban-copy')).toBeInTheDocument();
    expect(done.textContent).not.toMatch(/FDIC/);
    expect(done.textContent).not.toMatch(PROVIDER_NAMES);
    expect(api.stepUps).toContain('account_open');
    expect(api.calls).toContain('openCurrencyAccount');
  });

  it('OG054_open_owner_only an admin does not see Open a currency account', async () => {
    renderApp('/accounts', { api: demo('ADMIN') });
    await screen.findByTestId('accounts-list');
    await waitFor(() => expect(screen.queryByTestId('accounts-open-currency')).not.toBeInTheDocument());
  });

  it('OG054_flag_off nothing multi-currency shows when the API says it is off', async () => {
    const api = demo();
    api.currencyAccountOptions = async () => ({ enabled: false, items: [] });
    api.corridors = async () => [];
    renderApp('/payments', { api });
    await screen.findByTestId('payments-tabs');
    await screen.findByTestId('payments-list');
    expect(screen.queryByTestId('payments-tab-international')).not.toBeInTheDocument();
    renderApp('/accounts', { api });
    await screen.findByTestId('accounts-list');
    expect(screen.queryByTestId('accounts-open-currency')).not.toBeInTheDocument();
  });

  it('OG054_receiving_details a GBP account shows its sort code and account number only when asked', async () => {
    const api = demo();
    const gbp = await api.openCurrencyAccount({ currency: 'GBP' });
    renderApp(`/accounts/${gbp.id}`, { api });
    expect(await screen.findByTestId('account-institution')).toHaveTextContent(
      'Harbour Global Bank (sample)',
    );
    expect(screen.queryByTestId('receiving-sort-code')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('receiving-show'));
    expect(await screen.findByTestId('receiving-sort-code')).toHaveTextContent('608371');
    expect(screen.getByTestId('receiving-account-number')).toHaveTextContent('41927730');
    expect(screen.queryByTestId('receiving-iban')).not.toBeInTheDocument();
  });
});

describe('OG-054 international recipients', () => {
  it('OG054_recipient_validation checks the IBAN before any call, saves with step-up and shows the last 4 only', async () => {
    const api = demo();
    renderApp('/payments/recipients', { api });
    await userEvent.click(await screen.findByTestId('intl-add'));
    await chooseOption(screen.getByTestId('intl-corridor'), 'cor_us_de_eur_sepa');
    await userEvent.type(screen.getByTestId('intl-name'), 'Beispiel AG');
    await userEvent.type(screen.getByTestId('intl-iban'), 'DE88370400440532013000');
    await userEvent.click(screen.getByTestId('intl-save'));
    expect(await screen.findByText(/Check the IBAN/)).toBeInTheDocument();
    expect(await screen.findByText('This is needed for this country.')).toBeInTheDocument();
    expect(api.calls).not.toContain('createInternationalRecipient');
    await userEvent.clear(screen.getByTestId('intl-iban'));
    await userEvent.type(screen.getByTestId('intl-iban'), 'DE89 3704 0044 0532 0130 00');
    await userEvent.type(screen.getByTestId('intl-bic'), 'cobadeffxxx');
    await userEvent.click(screen.getByTestId('intl-save'));
    await waitFor(() => expect(api.calls).toContain('createInternationalRecipient'));
    expect(api.stepUps).toContain('recipient');
    const list = await screen.findByTestId('intl-recipients-list');
    await waitFor(() => expect(list).toHaveTextContent('Beispiel AG'));
    expect(list).toHaveTextContent('•••• 3000');
    expect(list.textContent).not.toContain('370400440532');
  });

  it('OG054_recipient_archive archives a recipient abroad', async () => {
    const api = demo();
    renderApp('/payments/recipients', { api });
    await userEvent.click(await screen.findByTestId('intl-archive-rci_demo_thames'));
    await waitFor(() =>
      expect(screen.queryByTestId('intl-recipient-rci_demo_thames')).not.toBeInTheDocument(),
    );
    expect((await api.internationalRecipient('rci_demo_thames')).status).toBe('ARCHIVED');
  });
});

describe('OG-054 convert', () => {
  it('OG054_convert_quote shows rate, provider fee and OnGem margin apart, then accepts and tracks the movement in transit', async () => {
    const api = demo();
    api.fx.stepMs = 1e9;
    const usd = await api.openCurrencyAccount({ currency: 'USD' });
    const eur = await api.openCurrencyAccount({ currency: 'EUR' });
    renderApp(`/payments/convert?from=acc_demo_ops&to=${eur.id}`, { api });
    await userEvent.type(await screen.findByTestId('convert-amount'), '1000');
    await userEvent.click(screen.getByTestId('convert-quote'));
    expect(await screen.findByTestId('fx-quote-rate')).toHaveTextContent('1 USD = 0.92 EUR');
    expect(screen.getByTestId('fx-quote-fee')).toHaveTextContent('US$2.50');
    expect(screen.getByTestId('fx-quote-margin')).toHaveTextContent('US$4.00');
    expect(screen.getByTestId('fx-quote-total')).toHaveTextContent('US$1,006.50');
    expect(screen.getByTestId('fx-quote-receive')).toHaveTextContent('EUR 920.00');
    expect(screen.getByTestId('fx-quote-expiry')).toHaveTextContent(/held for \d+ s/);
    expect(screen.getByTestId('convert-via')).toHaveTextContent(usd.name);
    await userEvent.click(screen.getByTestId('convert-accept'));
    const detail = await screen.findByTestId('movement-detail');
    expect(api.stepUps.filter((s) => s === 'payment').length).toBeGreaterThanOrEqual(2);
    expect(within(detail).getByTestId('movement-status-line')).toHaveTextContent('In transit');
    expect(within(detail).getByTestId('movement-legs')).toHaveTextContent('In transit between your banks');
    expect(within(detail).getByTestId('leg-first_party')).toBeInTheDocument();
    expect(detail.textContent).not.toMatch(PROVIDER_NAMES);
  });

  it('OG054_convert_cross_bank_needs_own_account says which account to open first', async () => {
    const api = demo();
    const eur = await api.openCurrencyAccount({ currency: 'EUR' });
    renderApp(`/payments/convert?from=acc_demo_ops&to=${eur.id}`, { api });
    expect(await screen.findByTestId('convert-via-missing')).toHaveTextContent(
      'first open a USD account at Harbour Global Bank (sample)',
    );
  });

  it('OG054_quote_expiry an expired price cannot be accepted, only renewed', async () => {
    const api = demo();
    api.fx.quoteTtlMs = 0;
    await api.openCurrencyAccount({ currency: 'USD' });
    const eur = await api.openCurrencyAccount({ currency: 'EUR' });
    renderApp(`/payments/convert?from=acc_demo_ops&to=${eur.id}`, { api });
    await userEvent.type(await screen.findByTestId('convert-amount'), '10');
    await userEvent.click(screen.getByTestId('convert-quote'));
    expect(await screen.findByTestId('fx-quote-expiry')).toHaveTextContent('This price has expired');
    expect(screen.queryByTestId('convert-accept')).not.toBeInTheDocument();
    expect(screen.getByTestId('convert-requote')).toBeInTheDocument();
  });
});

describe('OG-054 send abroad', () => {
  it('OG054_abroad_flow corridor, recipient, an amount in KWD with three decimals inside the limits, quote, accept', async () => {
    const api = demo();
    api.fx.stepMs = 1e9;
    await api.createInternationalRecipient({
      corridorId: 'cor_us_kw_kwd_swift',
      kind: 'BUSINESS',
      name: 'Gulf Trading Co',
      country: 'KW',
      currency: 'KWD',
      scheme: 'IBAN',
      iban: 'KW81CBKU0000000000001234560101',
      bic: 'CBKUKWKW',
      address: { line1: 'Street 1', city: 'Kuwait City', postalCode: '13001', country: 'KW' },
    });
    renderApp('/payments/abroad', { api });
    await chooseOption(await screen.findByTestId('abroad-corridor'), 'cor_us_kw_kwd_swift');
    expect(screen.getByTestId('abroad-limits')).toHaveTextContent('KWD 10.000 to KWD 15,000.000');
    await userEvent.click(screen.getByTestId('abroad-next-corridor'));
    await chooseOption(await screen.findByTestId('abroad-recipient'), /Gulf Trading Co/);
    await userEvent.click(screen.getByTestId('abroad-next-recipient'));
    const amount = await screen.findByTestId('abroad-amount');
    await userEvent.type(amount, '5.1234');
    expect(await screen.findByText(/no more decimals than it has/)).toBeInTheDocument();
    await userEvent.clear(amount);
    await userEvent.type(amount, '5');
    expect(await screen.findByText('The smallest payment here is KWD 10.000.')).toBeInTheDocument();
    await userEvent.clear(amount);
    await userEvent.type(amount, '20.5');
    await userEvent.click(screen.getByTestId('abroad-quote'));
    expect(await screen.findByTestId('fx-quote-receive')).toHaveTextContent('KWD 20.500');
    await userEvent.click(screen.getByTestId('abroad-accept'));
    const detail = await screen.findByTestId('movement-detail');
    expect(within(detail).getByTestId('leg-remittance')).toHaveTextContent(
      'Pay KWD 20.500 to Gulf Trading Co',
    );
    expect(within(detail).getByTestId('movement-status-line')).toHaveTextContent('On its way');
    expect(api.calls).toEqual(
      expect.arrayContaining(['createQuote', 'acceptQuote', 'createMovement', 'submitMovement']),
    );
  });

  it('OG054_approval a second person approves a payment abroad; the maker cannot approve their own', async () => {
    const api = demo();
    renderApp('/payments/movements/mov_demo_abroad_approval', { api });
    expect(await screen.findByTestId('movement-status-line')).toHaveTextContent('Waiting for approval');
    await userEvent.click(screen.getByTestId('movement-approve'));
    await waitFor(() => expect(screen.getByTestId('movement-status-line')).not.toHaveTextContent('Waiting'));
    expect(api.stepUps).toContain('payment');
    const q = await api.createQuote({
      sellCurrency: 'USD',
      buyCurrency: 'EUR',
      side: 'BUY',
      amountMinor: 2_000_000,
      corridorId: 'cor_us_de_eur_sepa',
    });
    await api.acceptQuote(q.id);
    const m = await api.createMovement({
      intent: 'PAY_ABROAD',
      fromAccountId: 'acc_demo_ops',
      corridorId: 'cor_us_de_eur_sepa',
      recipientId: 'rci_demo_muster',
      quoteId: q.id,
    });
    expect((await api.submitMovement(m.id)).state).toBe('PENDING_APPROVAL');
    await expect(api.approveMovement(m.id)).rejects.toMatchObject({ code: 'self_approval_forbidden' });
  });

  it('OG054_receipt shows the FX lines, the corridor and the recipient by last 4 only', async () => {
    renderApp('/payments/movements/mov_demo_abroad_settled', { api: demo() });
    await userEvent.click(await screen.findByTestId('movement-receipt'));
    const r = await screen.findByTestId('movement-receipt-view');
    expect(within(r).getByTestId('receipt-recipient')).toHaveTextContent('Muster GmbH •••• 3000');
    expect(within(r).getByTestId('receipt-corridor')).toHaveTextContent('SEPA to Germany');
    expect(within(r).getByTestId('fx-margin')).toBeInTheDocument();
    expect(within(r).getByTestId('fx-fee')).toBeInTheDocument();
    expect(within(r).getByTestId('receipt-quote')).toHaveTextContent('fxq_demo_settled');
  });

  it('OG054_fx_on_transactions a converted line carries its rate, fee and margin and opens the movement', async () => {
    renderApp('/accounts/acc_demo_ops', { api: demo() });
    const line = await screen.findByTestId('txn-fx-txn_mov_demo_abroad_settled_out');
    expect(line).toHaveTextContent('1 USD = 0.92 EUR');
    expect(line).toHaveTextContent('OnGem margin');
    expect(within(line).getByRole('link')).toHaveAttribute(
      'href',
      '/payments/movements/mov_demo_abroad_settled',
    );
  });
});

describe('OG-054 error copy', () => {
  for (const region of ['us', 'ae'])
    it(`OG054_errors_${region} every error code of the contract has English and Arabic copy`, () => {
      const seed = JSON.parse(readFileSync(`content-seed/${region}/web_app.json`, 'utf8')) as {
        entries: { key: string; en: string; ar: string }[];
      };
      const byKey = new Map(seed.entries.map((e) => [e.key, e]));
      for (const code of [
        ...OG054_CODES,
        'forbidden',
        'reverification_required',
        'self_approval_forbidden',
      ]) {
        const e = byKey.get(`app.errors.${code}`);
        expect(e?.en, code).toBeTruthy();
        expect(e?.ar, code).toMatch(/[؀-ۿ]/);
      }
    });
});
