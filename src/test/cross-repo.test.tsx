import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoOnGemApi } from '../api/demo';
import { MemoryDeviceKeys, registration } from '../api/device';
import { ApiError, errorText } from '../api/errors';
import { IN_PROGRESS_BACKOFF_MS, LiveOnGemApi } from '../api/live';
import { asPhone, renderApp } from './render';

type Sent = { url: string; method: string; headers: Record<string, string>; init: RequestInit };

/** A fake API: device binding answers by path, everything else from [answers] in order. */
function server(...answers: Array<[number, unknown]>) {
  const sent: Sent[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    sent.push({ url, method: init.method ?? 'GET', headers: init.headers as Record<string, string>, init });
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.endsWith('/v1/devices/challenge'))
      return json(201, { challengeId: 'dch_1', nonce: 'nonce-1', expiresAt: '2026-10-31T12:05:00Z' });
    if (url.endsWith('/v1/devices')) return json(201, { id: 'dev_1', platform: 'web', current: false });
    const [status, body] = answers.shift() ?? [200, {}];
    return json(status, body);
  }) as unknown as typeof fetch;
  return { sent, fetchImpl };
}

const client = (
  fetchImpl: typeof fetch,
  extra: Partial<ConstructorParameters<typeof LiveOnGemApi>[0]> = {},
) =>
  new LiveOnGemApi({
    baseUrl: '/api-dev',
    fetchImpl,
    personId: 'user_1',
    deviceKeys: new MemoryDeviceKeys(),
    getToken: () => Promise.resolve('tok'),
    reverify: () => Promise.resolve(true),
    sleep: () => Promise.resolve(),
    ...extra,
  });

const customerCalls = (sent: Sent[]) => sent.filter((s) => !s.url.includes('/v1/devices'));

describe('cross-repo follow-ups 2026-10-31', () => {
  // OG-035 R9: the floating assistant button is the phone's way in; these tests open it there.
  let undoPhone: () => void = () => undefined;
  beforeEach(() => {
    undoPhone = asPhone();
  });
  afterEach(() => undoPhone());

  it('CORE-SEC-03 every customer call carries X-Device-Id from a device bound once with a signed challenge', async () => {
    const { sent, fetchImpl } = server(
      [200, []],
      [200, { items: [] }],
      [202, { id: 'pay_1', state: 'SUBMITTED' }],
    );
    const api = client(fetchImpl);
    await api.accounts();
    await api.recipients();
    await api.sendPayment('pay_1');
    expect(customerCalls(sent).map((s) => s.headers['X-Device-Id'])).toEqual(['dev_1', 'dev_1', 'dev_1']);
    const binding = sent.filter((s) => s.url.includes('/v1/devices'));
    expect(binding.map((s) => s.url)).toEqual(['/api-dev/v1/devices/challenge', '/api-dev/v1/devices']);
    expect(binding.every((s) => s.headers['X-Device-Id'] === undefined)).toBe(true);
    const body = JSON.parse(String(binding[1]!.init.body)) as Record<string, string>;
    expect(body).toMatchObject({ challengeId: 'dch_1', platform: 'web' });
  });

  it('CORE-SEC-03 the registration signature verifies over the nonce with the SPKI key it sends', async () => {
    const pair = await new MemoryDeviceKeys().get('user_1');
    expect(pair.privateKey.extractable).toBe(false);
    const r = await registration(pair, { challengeId: 'dch_1', nonce: 'nonce-1' });
    const der = Uint8Array.from(atob(r.publicKey), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('spki', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
      'verify',
    ]);
    const sig = Uint8Array.from(atob(r.signature), (c) => c.charCodeAt(0));
    expect(sig).toHaveLength(64);
    expect(
      await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        sig,
        new TextEncoder().encode('nonce-1'),
      ),
    ).toBe(true);
  });

  it('CORE-SEC-03 a revoked device drops its key and says to sign in again; a failed binding still sends the call', async () => {
    const keys = new MemoryDeviceKeys();
    const forget = vi.spyOn(keys, 'forget');
    const revoked = server([401, { code: 'device_revoked' }]);
    await expect(client(revoked.fetchImpl, { deviceKeys: keys }).accounts()).rejects.toMatchObject({
      code: 'device_revoked',
    });
    expect(forget).toHaveBeenCalledWith('user_1');
    expect(errorText(new ApiError(401, 'device_revoked'))).toMatch(/Sign in again/);

    const sent: string[] = [];
    const refusing = (async (url: string, init: RequestInit) => {
      sent.push(`${url} ${(init.headers as Record<string, string>)['X-Device-Id'] ?? '-'}`);
      return url.includes('/v1/devices')
        ? new Response(JSON.stringify({ code: 'validation_failed' }), { status: 422 })
        : new Response('[]', { status: 200 });
    }) as unknown as typeof fetch;
    expect(await client(refusing).accounts()).toEqual([]);
    expect(sent.at(-1)).toBe('/api-dev/v1/accounts -');
  });

  it('WEB-SEC-06 the bearer is the only credential: no cookies, on binding calls too', async () => {
    const { sent, fetchImpl } = server([200, []]);
    await client(fetchImpl).accounts();
    expect(sent.map((s) => s.init.credentials)).toEqual(['omit', 'omit', 'omit']);
    expect(sent.every((s) => s.headers.Authorization === 'Bearer tok' && !('Cookie' in s.headers))).toBe(
      true,
    );
  });

  it('CORE-COR-02 409 idempotency_in_progress is retried with backoff and the same Idempotency-Key', async () => {
    const waits: number[] = [];
    const { sent, fetchImpl } = server(
      [409, { code: 'idempotency_in_progress' }],
      [409, { code: 'idempotency_in_progress' }],
      [202, { id: 'pay_1', state: 'SUBMITTED' }],
    );
    const api = client(fetchImpl, {
      newKey: () => 'key-1',
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });
    expect((await api.sendPayment('pay_1')).state).toBe('SUBMITTED');
    const sends = customerCalls(sent);
    expect(sends.map((s) => s.headers['Idempotency-Key'])).toEqual(['key-1', 'key-1', 'key-1']);
    expect(waits).toEqual(IN_PROGRESS_BACKOFF_MS.slice(0, 2));
  });

  it('CORE-COR-02 a request still in progress after every retry says so and that it will not run twice', async () => {
    const busy = Array.from({ length: IN_PROGRESS_BACKOFF_MS.length + 1 }, () => [
      409,
      { code: 'idempotency_in_progress' },
    ]) as Array<[number, unknown]>;
    const { sent, fetchImpl } = server(...busy);
    const err = await client(fetchImpl)
      .sendPayment('pay_1')
      .catch((e: unknown) => e);
    expect(customerCalls(sent)).toHaveLength(IN_PROGRESS_BACKOFF_MS.length + 1);
    expect(errorText(err)).toMatch(/still working on this request.*will not run twice/);
  });

  it('CORE-ASST-01 CORE-ASST-05 CORE-SEC-10 draft, step-up and permission refusals have clear messages', () => {
    expect(errorText(new ApiError(409, 'draft_result_mismatch'))).toMatch(
      /not the action the assistant drafted/,
    );
    expect(errorText(new ApiError(409, 'draft_not_open'))).toMatch(/expired or was already decided/);
    expect(errorText(new ApiError(403, 'reverification_required'))).toMatch(/confirm it is you/);
    expect(errorText(new ApiError(403, 'reverification_cancelled'))).toMatch(/nothing was changed/);
    expect(errorText(new ApiError(403, 'permission_denied'))).toMatch(/role does not allow/);
  });

  it('CORE-ASST-01 a refused draft confirm tells the founder why', async () => {
    const api = new DemoOnGemApi({ stepUp: () => Promise.resolve(true) });
    api.confirmAssistantDraft = () => Promise.reject(new ApiError(409, 'draft_not_open'));
    renderApp('/', { api });
    await userEvent.click(await screen.findByTestId('assistant-open'));
    await userEvent.type(screen.getByTestId('assistant-input'), 'Freeze my card');
    await userEvent.click(screen.getByTestId('assistant-send'));
    await userEvent.click(await screen.findByTestId('assistant-review'));
    await userEvent.click(await screen.findByTestId('card-freeze'));
    expect(await screen.findByText(/expired or was already decided/)).toBeInTheDocument();
  });

  it('CORE-ASST-08 assistant replies render as plain text: no link, image or markup element', async () => {
    const api = new DemoOnGemApi();
    api.sendAssistantMessage = async (_id, text) => ({
      id: 'atn_1',
      seq: 1,
      text,
      reply: '[pay here](javascript:alert(1)) ![x](https://evil.example/x.png) <b>bold</b>',
      outcome: 'ANSWERED',
      reads: [],
      draft: null,
      provider: 'stub',
      model: 'stub',
      latencyMs: 0,
    });
    renderApp('/', { api });
    await userEvent.click(await screen.findByTestId('assistant-open'));
    await userEvent.type(screen.getByTestId('assistant-input'), 'hi');
    await userEvent.click(screen.getByTestId('assistant-send'));
    const turn = (await screen.findAllByTestId('assistant-turn')).at(-1)!;
    expect(turn).toHaveTextContent('[pay here](javascript:alert(1))');
    expect(turn.querySelector('a, img, b')).toBeNull();
  });

  it('APP-QUAL-03 a TICKET_REPLY draft opens the ticket with the reply and is confirmed by sending it', async () => {
    const api = new DemoOnGemApi();
    renderApp('/', { api });
    await userEvent.click(await screen.findByTestId('assistant-open'));
    await userEvent.type(
      screen.getByTestId('assistant-input'),
      'Reply to my ticket: the card arrived, thank you',
    );
    await userEvent.click(screen.getByTestId('assistant-send'));
    const turn = (await screen.findAllByTestId('assistant-turn')).at(-1)!;
    const d = [...api.assistant.drafts.values()].at(-1)!;
    expect(d.kind).toBe('TICKET_REPLY');
    await userEvent.click(within(turn).getByTestId('assistant-review'));
    const reply = await screen.findByTestId('ticket-reply');
    expect(reply).toHaveValue('the card arrived, thank you');
    await userEvent.click(screen.getByTestId('ticket-reply-send'));
    await screen.findByText(/recorded that you confirmed it/);
    expect(api.assistant.drafts.get(d.id)!.state).toBe('CONFIRMED');
    expect(api.assistant.drafts.get(d.id)!.params).toMatchObject({
      ticketId: expect.stringMatching(/^tkt_/),
    });
  });
});
