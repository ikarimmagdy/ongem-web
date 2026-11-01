import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { OnGemApi } from '../api/client';
import { DemoOnGemApi } from '../api/demo';
import type { AssistantDraft } from '../api/types';
import { matches, routeFor } from '../assistant/drafts';
import { AuthProvider, type AuthSession } from '../auth';
import { SessionProvider, useSession } from '../session';
import { renderApp } from './render';

const slow = <T,>(f: () => Promise<T>) => new Promise<T>((r) => setTimeout(() => r(f()), 20));

async function ask(text: string) {
  if (!screen.queryByTestId('assistant-panel'))
    await userEvent.click(await screen.findByTestId('assistant-open'));
  await userEvent.type(screen.getByTestId('assistant-input'), text);
  await userEvent.click(screen.getByTestId('assistant-send'));
  const turns = await screen.findAllByTestId('assistant-turn');
  return turns[turns.length - 1]!;
}

const draft = (kind: string, params: Record<string, unknown>): AssistantDraft => ({
  id: 'adr_1',
  kind,
  operations: [],
  params,
  summary: 's',
  state: 'OPEN',
});

describe('review fixes: payments and drafts', () => {
  it('WEB-COR-01 a retry after a failed send sends the same payment, and a double click creates one', async () => {
    let answers = [false, true];
    const api = new DemoOnGemApi({ stepUp: () => Promise.resolve(answers.shift() ?? true) });
    const create = vi.spyOn(api, 'createPayment');
    const send = vi.spyOn(api, 'sendPayment');
    renderApp('/payments/new', { api });
    await userEvent.selectOptions(await screen.findByTestId('payment-recipient'), 'rcp_demo_acme');
    await userEvent.type(screen.getByTestId('payment-amount'), '40.00');
    await userEvent.click(screen.getByTestId('payment-review-button'));
    await userEvent.click(await screen.findByTestId('payment-send'));
    expect(
      await screen.findByText('You did not confirm it is you, so nothing was changed.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('payment-send'));
    await screen.findByTestId('payment-detail');
    expect(create).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]![0]).toBe(send.mock.calls[1]![0]);

    answers = [true];
    create.mockClear();
    await userEvent.click(screen.getByTestId('new-payment'));
    await userEvent.selectOptions(await screen.findByTestId('payment-recipient'), 'rcp_demo_acme');
    await userEvent.type(screen.getByTestId('payment-amount'), '41.00');
    await userEvent.click(screen.getByTestId('payment-review-button'));
    const button = await screen.findByTestId('payment-send');
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    await screen.findByTestId('payment-detail');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('WEB-COR-02 the payments list and the cards list show the change right after it', async () => {
    const api = new DemoOnGemApi({ stepUp: () => Promise.resolve(true) });
    renderApp('/payments/new', { api });
    await userEvent.selectOptions(await screen.findByTestId('payment-recipient'), 'rcp_demo_acme');
    await userEvent.type(screen.getByTestId('payment-amount'), '42.00');
    await userEvent.click(screen.getByTestId('payment-review-button'));
    await userEvent.click(await screen.findByTestId('payment-send'));
    await screen.findByTestId('payment-detail');
    const sent = (await api.payments()).items[0]!;
    expect(await screen.findByTestId(`payment-${sent.id}`)).toBeInTheDocument();

    await userEvent.click(screen.getAllByTestId('nav-cards')[0]!);
    await userEvent.click(await screen.findByTestId('card-crd_demo_dana'));
    await userEvent.click(await screen.findByTestId('card-freeze'));
    await screen.findByTestId('card-unfreeze');
    await waitFor(() =>
      expect(within(screen.getByTestId('card-crd_demo_dana')).getByText('Frozen')).toBeInTheDocument(),
    );
  });

  it('WEB-COR-03 a double click on reply, confirm, accept or archive sends once', async () => {
    const api = new DemoOnGemApi({ stepUp: () => Promise.resolve(true) });
    const real = api.replyToTicket.bind(api);
    const reply = vi.spyOn(api, 'replyToTicket');
    reply.mockImplementation((id, body) => slow(() => real(id, body)));
    const { unmount } = renderApp('/support/tkt_demo_1', { api });
    await userEvent.type(await screen.findByTestId('ticket-reply'), 'Thanks');
    const send = screen.getByTestId('ticket-reply-send');
    act(() => {
      fireEvent.click(send);
      fireEvent.click(send);
    });
    await waitFor(() => expect(screen.getByTestId('ticket-reply')).toHaveValue(''));
    expect(reply).toHaveBeenCalledTimes(1);
    unmount();

    const realConfirm = api.confirmApplication.bind(api);
    const confirm = vi.spyOn(api, 'confirmApplication');
    confirm.mockImplementation((id) => slow(() => realConfirm(id)));
    const archive = vi.spyOn(api, 'archiveRecipient');
    const view = renderApp('/onboarding', { api });
    await userEvent.type(await screen.findByTestId('owner-ssn-own_demo_dana'), '123456789');
    await userEvent.click(screen.getByTestId('owner-ssn-save-own_demo_dana'));
    const button = await screen.findByTestId('application-confirm');
    await waitFor(() => expect(button).toBeEnabled());
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    await screen.findByTestId('disclosure-dsv_demo_esign');
    expect(confirm).toHaveBeenCalledTimes(1);
    view.unmount();

    renderApp('/recipients', { api });
    const [first] = await screen.findAllByRole('button', { name: /^Archive / });
    act(() => {
      fireEvent.click(first!);
      fireEvent.click(first!);
    });
    await waitFor(() => expect(archive).toHaveBeenCalledTimes(1));
  });

  it('WEB-SEC-03 draft values are checked and encoded, and a prefill that is not an option is not submitted', async () => {
    expect(routeFor(draft('CARD_FREEZE', { cardId: '../payments/new?amount=999999' }))).toBe('/cards');
    expect(routeFor(draft('CARD_FREEZE', { cardId: 'crd_1' }))).toBe('/cards/crd_1');
    expect(routeFor(draft('TICKET_REPLY', { ticketId: '//evil.example', body: 'hi' }))).toBe('/support');
    expect(
      routeFor(draft('PAYMENT', { recipientId: 'rcp_1', amountMinor: '1e9', fromAccountId: '\\evil' })),
    ).toBe('/payments/new?kind=ach&recipient=rcp_1');
    for (const kind of ['PAYMENT', 'INTERNAL_TRANSFER', 'RECIPIENT_ADD', 'CARD_FREEZE', 'TICKET_REPLY', 'X'])
      expect(routeFor(draft(kind, { cardId: 'javascript:alert(1)', ticketId: 'a/b' }))).toMatch(/^\/[a-z]/);

    const api = new DemoOnGemApi({ stepUp: () => Promise.resolve(true) });
    renderApp(`/payments/new?kind=ach&from=acc_other_company&recipient=rcp_other_company&amount=abc`, {
      api,
    });
    expect(await screen.findByTestId('payment-recipient')).toHaveValue('');
    expect(screen.getByTestId('payment-from')).toHaveValue('acc_demo_ops');
    expect(screen.getByTestId('payment-amount')).toHaveValue('');
    expect(screen.getByTestId('payment-review-button')).toBeDisabled();
  });

  it('WEB-SEC-03 assistant output renders as text: no markup, no link, no script', async () => {
    class Hostile extends DemoOnGemApi {
      sendAssistantMessage: OnGemApi['sendAssistantMessage'] = async () => ({
        id: 'atn_x',
        seq: 1,
        text: 'hi',
        reply:
          '<img src=x onerror="window.__pwned=1"> [click](javascript:window.__pwned=1) <a href="javascript:1">a</a>',
        outcome: 'ANSWERED',
        reads: [],
        draft: { ...draft('CARD_FREEZE', { cardId: '<script>' }), summary: '<b onclick="x()">Freeze</b>' },
        provider: 'stub',
        model: 'm',
        latencyMs: 0,
      });
    }
    renderApp('/', { api: new Hostile() });
    const turn = await ask('hi');
    expect(turn.querySelector('img, a, script, b, iframe')).toBeNull();
    expect(within(turn).getByTestId('assistant-reply')).toHaveTextContent('<img src=x onerror=');
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it('WEB-SEC-04 a draft is confirmed only by the action it drafted', async () => {
    expect(matches(draft('CARD_FREEZE', { cardId: 'crd_a' }), { cardId: 'crd_b' })).toBe(false);
    expect(matches(draft('CARD_FREEZE', { cardId: 'crd_a' }), { cardId: 'crd_a' })).toBe(true);
    expect(
      matches(draft('PAYMENT', { amountMinor: 2500, recipientId: null }), {
        amountMinor: 2500,
        recipientId: 'r',
      }),
    ).toBe(true);

    const api = new DemoOnGemApi({ stepUp: () => Promise.resolve(true) });
    renderApp('/', { api });
    const turn = await ask('Send $25 to Acme Supplies');
    await userEvent.click(within(turn).getByTestId('assistant-review'));
    const amount = await screen.findByTestId('payment-amount');
    await userEvent.clear(amount);
    await userEvent.type(amount, '30.00');
    await userEvent.click(screen.getByTestId('payment-review-button'));
    await userEvent.click(await screen.findByTestId('payment-send'));
    await screen.findByTestId('payment-detail');
    expect(api.calls).not.toContain('confirmAssistantDraft');
    expect([...api.assistant.drafts.values()][0]!.state).toBe('OPEN');
  });

  it('WEB-COR-04 the live client stays the same while the auth value changes for the same person', async () => {
    const seen: OnGemApi[] = [];
    function Probe() {
      const { api } = useSession();
      useEffect(() => {
        seen.push(api);
      }, [api]);
      return null;
    }
    const auth = (): AuthSession => ({
      available: true,
      loaded: true,
      signedIn: true,
      user: { id: 'user_1', name: 'Dana' },
      getToken: () => Promise.resolve('t'),
      signOut: () => Promise.resolve(),
    });
    const tree = (a: AuthSession) => (
      <AuthProvider value={a}>
        <MemoryRouter>
          <SessionProvider>
            <Probe />
          </SessionProvider>
        </MemoryRouter>
      </AuthProvider>
    );
    const { rerender } = render(tree(auth()));
    rerender(tree(auth()));
    rerender(tree(auth()));
    expect(seen).toHaveLength(1);
    expect(seen[0]!.kind).toBe('live');
    rerender(tree({ ...auth(), user: { id: 'user_2', name: 'Lee' } }));
    expect(seen).toHaveLength(2);
  });
});
