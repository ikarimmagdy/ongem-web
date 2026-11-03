import { MemoryDeviceKeys, proofMessage } from '../api/device';
import { LiveOnGemApi } from '../api/live';

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
