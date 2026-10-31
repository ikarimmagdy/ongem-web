import { ApiError } from './errors';
import { LiveOnGemApi } from './live';

type Sent = { url: string; method: string; headers: Record<string, string> };

function fake(...answers: Array<[number, unknown]>) {
  const sent: Sent[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    sent.push({ url, method: init.method ?? 'GET', headers: init.headers as Record<string, string> });
    const [status, body] = answers.shift() ?? [200, {}];
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { sent, fetchImpl };
}

describe('live client (OG-030 R8)', () => {
  it('reverification_retries_with_same_key_AC_R8_2', async () => {
    const { sent, fetchImpl } = fake(
      [
        403,
        { code: 'reverification_required', reverification: { level: 'second_factor', afterMinutes: 10 } },
      ],
      [202, { id: 'pay_1', state: 'SUBMITTED' }],
    );
    const tokens: Array<boolean | undefined> = [];
    let asked = 0;
    const api = new LiveOnGemApi({
      baseUrl: '/api-dev',
      fetchImpl,
      newKey: () => 'key-1',
      getToken: (o) => {
        tokens.push(o?.fresh);
        return Promise.resolve(o?.fresh ? 'fresh' : 'stale');
      },
      reverify: () => {
        asked += 1;
        return Promise.resolve(true);
      },
    });
    const p = await api.sendPayment('pay_1');
    expect(p.state).toBe('SUBMITTED');
    expect(asked).toBe(1);
    expect(sent.map((s) => s.headers['Idempotency-Key'])).toEqual(['key-1', 'key-1']);
    expect(sent.map((s) => s.headers.Authorization)).toEqual(['Bearer stale', 'Bearer fresh']);
    expect(sent[0]!.url).toBe('/api-dev/v1/payments/pay_1/send');
  });

  it('a cancelled reverification sends nothing more AC_R8_2', async () => {
    const { sent, fetchImpl } = fake([403, { code: 'reverification_required' }]);
    const api = new LiveOnGemApi({
      baseUrl: '',
      fetchImpl,
      getToken: () => Promise.resolve('t'),
      reverify: () => Promise.resolve(false),
    });
    await expect(api.setCardFrozen('crd_1', true)).rejects.toMatchObject({
      code: 'reverification_cancelled',
    });
    expect(sent).toHaveLength(1);
  });

  it('refreshes_once_on_401_AC_R8_2', async () => {
    const { sent, fetchImpl } = fake([401, { code: 'unauthenticated' }], [200, []]);
    const api = new LiveOnGemApi({
      baseUrl: '',
      fetchImpl,
      getToken: (o) => Promise.resolve(o?.fresh ? 'b' : 'a'),
      reverify: () => Promise.resolve(true),
    });
    expect(await api.accounts()).toEqual([]);
    expect(sent.map((s) => s.headers.Authorization)).toEqual(['Bearer a', 'Bearer b']);
    expect(sent[0]!.headers['Idempotency-Key']).toBeUndefined();
    const mfa = fake([401, { code: 'mfa_required' }]);
    const api2 = new LiveOnGemApi({
      baseUrl: '',
      fetchImpl: mfa.fetchImpl,
      getToken: () => Promise.resolve('a'),
      reverify: () => Promise.resolve(true),
    });
    await expect(api2.me()).rejects.toBeInstanceOf(ApiError);
    expect(mfa.sent).toHaveLength(1);
  });
});

describe('live client sends no cookies', () => {
  it('WEB-SEC-06 every call omits credentials and carries only the bearer', async () => {
    const inits: RequestInit[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      inits.push(init);
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as unknown as typeof fetch;
    const api = new LiveOnGemApi({
      baseUrl: '/api-dev',
      fetchImpl,
      getToken: () => Promise.resolve('tok'),
      reverify: () => Promise.resolve(true),
    });
    await api.accounts();
    await api.sendPayment('pay_1');
    expect(inits.map((i) => i.credentials)).toEqual(['omit', 'omit']);
    expect(inits.every((i) => (i.headers as Record<string, string>).Authorization === 'Bearer tok')).toBe(
      true,
    );
  });
});
