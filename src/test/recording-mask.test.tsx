import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { record } from 'rrweb';
import { DemoOnGemApi } from '../api/demo';
import {
  OPS,
  demoAccounts,
  demoCards,
  demoPayments,
  demoRecipients,
  demoStatement,
  demoTransactions,
} from '../api/demoData';
import { formatMinor, minorToDecimal } from '../lib/format';
import { EventQueue, RRWEB_OPTIONS } from '../recording/Recorder';
import { maskHref } from '../recording/mask';
import { asPhone, renderApp } from './render';

/** Every string value in the recorded events, so ids and timestamps cannot match a secret by accident. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
  return out;
}

const TYPED = {
  routing: '021000021',
  account: '000123456789',
  ssn: '123456789',
  amount: '2,345.67',
  code: '246810',
};

/** The raw values the sensitive screens show or take: balances, amounts, last fours, routing, account and SSN. */
function secrets(): string[] {
  const amounts = [
    ...demoAccounts().flatMap((a) => (a.balance ? [a.balance.available, a.balance.posted] : [])),
    ...Object.values(demoTransactions).flatMap((ts) => ts.map((t) => t.amount)),
    ...demoPayments().map((p) => p.amount),
    demoStatement(OPS, '2026-09').opening,
    demoStatement(OPS, '2026-09').closing,
  ];
  const last4 = [
    ...demoAccounts().map((a) => a.last4),
    ...demoCards().map((c) => c.last4),
    ...demoRecipients().map((r) => r.accountLast4),
  ].filter((x): x is string => Boolean(x));
  return [
    ...new Set([
      ...amounts.map((a) => formatMinor(a).replace('US$', '')),
      ...amounts.filter((a) => a.amountMinor >= 1000).map((a) => minorToDecimal(a)),
      ...last4,
      ...demoRecipients()
        .map((r) => r.routingNumber)
        .filter((x): x is string => Boolean(x)),
      ...Object.values(TYPED),
      '6789',
    ]),
  ];
}

async function recordWhile(route: string, walk: () => Promise<void>) {
  const api = new DemoOnGemApi({ stepUp: () => Promise.resolve(true) });
  const queue = new EventQueue({ recordEvents: () => Promise.resolve({ stored: 0 }) }, () => null);
  const { unmount } = renderApp(route, { api });
  const stop = record({ ...RRWEB_OPTIONS, emit: (e) => queue.rrweb(e) });
  await walk();
  await new Promise((r) => setTimeout(r, 20));
  stop?.();
  unmount();
  return [...queue.pending];
}

describe('recording masks every sensitive screen (OG-031 R6)', () => {
  // OG-035 R9: the floating assistant button is the phone's way in; these tests open it there.
  let undoPhone: () => void = () => undefined;
  beforeEach(() => {
    undoPhone = asPhone();
  });
  afterEach(() => undoPhone());

  it('WEB-SEC-01 no raw balance, amount, number or identity value in recorded rrweb events', async () => {
    const events = [
      ...(await recordWhile('/', async () => {
        await screen.findByTestId('home-total');
      })),
      ...(await recordWhile('/accounts/acc_demo_ops', async () => {
        await screen.findByTestId('accounts-list');
        await screen.findByTestId('account-detail');
        await screen.findAllByText(/September 2026 statement/); // FA-041: the month by name
        await userEvent.click(screen.getByTestId('statement-2026-09'));
        await screen.findByTestId('statement-view');
      })),
      ...(await recordWhile('/payments/new', async () => {
        await screen.findByTestId('payment-form');
        await userEvent.selectOptions(screen.getByTestId('payment-recipient'), 'rcp_demo_acme');
        await userEvent.type(screen.getByTestId('payment-amount'), TYPED.amount);
        await userEvent.click(screen.getByTestId('payment-review-button'));
        await screen.findByTestId('payment-review');
        await userEvent.click(screen.getByTestId('payment-send'));
        await screen.findByTestId('payment-detail');
      })),
      ...(await recordWhile('/recipients', async () => {
        await userEvent.click(await screen.findByTestId('recipient-add'));
        await userEvent.type(screen.getByTestId('recipient-name'), 'Globex LLC');
        await userEvent.type(screen.getByTestId('recipient-routing'), TYPED.routing);
        await userEvent.type(screen.getByTestId('recipient-account'), TYPED.account);
        await userEvent.click(screen.getByTestId('recipient-save'));
        await screen.findByText('Globex LLC', { selector: 'strong' });
      })),
      ...(await recordWhile('/cards/crd_demo_dana', async () => {
        await screen.findByTestId('card-detail');
      })),
      ...(await recordWhile('/onboarding', async () => {
        await userEvent.type(await screen.findByTestId('owner-ssn-own_demo_dana'), TYPED.ssn);
        await userEvent.click(screen.getByTestId('owner-ssn-save-own_demo_dana'));
        await screen.findAllByText('ID ending 6789', { selector: 'span' });
      })),
      ...(await recordWhile('/', async () => {
        await userEvent.click(await screen.findByTestId('assistant-open'));
        for (const ask of [
          'What is my balance?',
          'Show my cards',
          'Show my recipients',
          'Send $25 to Acme',
        ]) {
          await userEvent.type(screen.getByTestId('assistant-input'), ask);
          await userEvent.click(screen.getByTestId('assistant-send'));
          await screen.findAllByTestId('assistant-turn');
        }
        await screen.findByText(/US\$126,100\.16 available/);
      })),
    ];
    expect(events.length).toBeGreaterThan(20);
    const recorded = strings(events.map((e) => e.payload));
    expect(recorded.join('\n')).toContain('Operating');
    for (const secret of secrets()) {
      const hits = recorded.filter((s) => s.includes(secret));
      expect(hits, `"${secret}" was recorded`).toEqual([]);
    }
    expect(recorded.join('\n')).not.toMatch(/US\$\s?\d/);
  }, 30_000);

  it('WEB-SEC-02 the recorded page URL drops the query that prefills a form', () => {
    const queue = new EventQueue({ recordEvents: () => Promise.resolve({ stored: 0 }) }, () => null);
    queue.rrweb({
      type: 4,
      data: {
        href: 'https://web.ongem.com/payments/new?kind=ach&recipient=rcp_1&amount=250000#x',
        width: 1,
        height: 1,
      },
      timestamp: 1,
    });
    queue.rrweb({ type: 3, data: { source: 2 }, timestamp: 2 });
    const [meta, other] = queue.pending;
    expect(meta!.payload).toEqual({
      type: 4,
      data: { href: 'https://web.ongem.com/payments/new', width: 1, height: 1 },
      timestamp: 1,
    });
    expect(other!.payload).toEqual({ type: 3, data: { source: 2 }, timestamp: 2 });
    expect(maskHref('/support/tkt_1?reply=call 5551234567')).toBe('/support/tkt_1');
  });
});
