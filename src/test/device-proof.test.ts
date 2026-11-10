import { MemoryDeviceKeys, proofMessage } from '../api/device';
import { LiveOnGemApi } from '../api/live';
import { ApiError, errorText } from '../api/errors';

type Sent = { url: string; headers: Record<string, string> };

describe('device proof (CORE-SEC-04)', () => {
  it('message matches ongem-core DeviceProofs, without the query', () => {
    expect(proofMessage('post', '/v1/payments/pay_1/send', 1762128000, 'dev_1', 'k-1')).toBe(
      'v1\nPOST\n/v1/payments/pay_1/send\n1762128000\ndev_1\nk-1',
    );
    expect(proofMessage('GET', '/v1/recipients?limit=100', 5, 'dev_1', null)).toBe(
      'v1\nGET\n/v1/recipients\n5\ndev_1\n',
    );
  });

  it('every call naming the device carries a proof that verifies with the bound key; binding calls carry none', async () => {
    const sent: Sent[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      sent.push({ url, headers: init.headers as Record<string, string> });
      const json = (status: number, body: unknown) =>
        new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
      if (url.endsWith('/v1/devices/challenge')) return json(201, { challengeId: 'dch_1', nonce: 'n' });
      if (url.endsWith('/v1/devices')) return json(201, { id: 'dev_1', platform: 'web' });
      return json(202, { id: 'pay_1', state: 'SUBMITTED' });
    }) as unknown as typeof fetch;
    const keys = new MemoryDeviceKeys();
    const api = new LiveOnGemApi({
      baseUrl: '/api-dev',
      fetchImpl,
      personId: 'user_1',
      deviceKeys: keys,
      newKey: () => 'key-1',
      getToken: () => Promise.resolve('tok'),
      reverify: () => Promise.resolve(true),
    });
    await api.sendPayment('pay_1');
    const call = sent.find((s) => s.url.endsWith('/v1/payments/pay_1/send'))!;
    expect(sent.filter((s) => s.url.includes('/v1/devices')).every((s) => !s.headers['X-Device-Proof'])).toBe(
      true,
    );
    const [version, seconds, signature] = call.headers['X-Device-Proof']!.split('.');
    expect(version).toBe('v1');
    expect(Math.abs(Number(seconds) - Date.now() / 1000)).toBeLessThan(5);
    const pair = await keys.get('user_1');
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.publicKey,
      Uint8Array.from(atob(signature!), (c) => c.charCodeAt(0)),
      new TextEncoder().encode(
        proofMessage('POST', '/v1/payments/pay_1/send', Number(seconds), 'dev_1', 'key-1'),
      ),
    );
    expect(ok).toBe(true);
  });
});

describe('refused device proofs (PT-01)', () => {
  /** A live client whose payment call answers the statuses in [answers], in order; binding answers dev_1, dev_2, ... */
  function client(answers: { status: number; code?: string }[]) {
    const sent: Sent[] = [];
    let bound = 0;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      sent.push({ url, headers: init.headers as Record<string, string> });
      const json = (status: number, body: unknown) =>
        new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
      if (url.endsWith('/v1/devices/challenge')) return json(201, { challengeId: 'dch_1', nonce: 'n' });
      if (url.endsWith('/v1/devices')) return json(201, { id: `dev_${++bound}`, platform: 'web' });
      const a = answers.shift() ?? { status: 202 };
      return a.code
        ? json(a.status, { code: a.code, detail: 'refused' })
        : json(a.status, { id: 'pay_1', state: 'SUBMITTED' });
    }) as unknown as typeof fetch;
    const keys = new MemoryDeviceKeys();
    const api = new LiveOnGemApi({
      baseUrl: '/api-dev',
      fetchImpl,
      personId: 'user_1',
      deviceKeys: keys,
      newKey: () => 'key-1',
      getToken: () => Promise.resolve('tok'),
      reverify: () => Promise.resolve(true),
    });
    const calls = () => sent.filter((s) => s.url.endsWith('/v1/payments/pay_1/send'));
    return { api, keys, calls, binds: () => sent.filter((s) => s.url.endsWith('/v1/devices')).length };
  }

  it('one refused proof is retried once with a fresh proof and the same key, on the same device', async () => {
    const c = client([{ status: 401, code: 'device_proof_invalid' }]);
    await c.api.sendPayment('pay_1');
    expect(c.calls()).toHaveLength(2);
    expect(
      c
        .calls()
        .every((s) => s.headers['X-Device-Id'] === 'dev_1' && s.headers['Idempotency-Key'] === 'key-1'),
    ).toBe(true);
    expect(c.binds()).toBe(1);
  });

  it('a second refusal binds this browser again with a new key and sends once more as the new device', async () => {
    const c = client([
      { status: 401, code: 'device_proof_required' },
      { status: 401, code: 'device_proof_invalid' },
    ]);
    const first = await c.keys.get('user_1');
    await c.api.sendPayment('pay_1');
    expect(c.binds()).toBe(2);
    expect(c.calls().map((s) => s.headers['X-Device-Id'])).toEqual(['dev_1', 'dev_1', 'dev_2']);
    expect(await c.keys.get('user_1')).not.toBe(first);
  });

  it('a third refusal stops with device_proof_invalid and tells the founder to check the clock and sign in again', async () => {
    const refused = { status: 401, code: 'device_proof_invalid' };
    const c = client([refused, refused, refused, refused]);
    const e = await c.api.sendPayment('pay_1').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).code).toBe('device_proof_invalid');
    expect(c.calls()).toHaveLength(3);
    expect(errorText(e)).toMatch(/date and time/);
    expect(errorText(new ApiError(401, 'device_proof_required'))).toMatch(/sign in again/);
  });
});
