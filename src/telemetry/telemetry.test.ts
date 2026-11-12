import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEV_ENDPOINT, telemetryConfig, type TelemetryConfig } from './index';
import {
  logsBody,
  metricsBody,
  pathTemplate,
  scrubMessage,
  scrubStack,
  traceparent,
  tracesBody,
} from './otlp';
import { apiCall, errorRecord, Exporter, poster } from './start';

const config = (over: Partial<TelemetryConfig> = {}): TelemetryConfig => ({
  ...telemetryConfig({ VITE_OTEL_ENDPOINT: DEV_ENDPOINT }, { service: 'ongem-web', version: '0.1.0+abc' }),
  ...over,
});

describe('OG-037 R9 founder web telemetry', () => {
  afterEach(() => vi.useRealTimers());

  it('routes and API paths are templates with no ids, tokens or query strings AC_R9_1', () => {
    expect(pathTemplate('/payments/pay_8f2a91c0?tab=sent#x')).toBe('/payments/:id');
    expect(pathTemplate('/accounts/acc_123/statements')).toBe('/accounts/:id/statements');
    expect(pathTemplate('/invite/abcdefgh', ':id', ['invite'])).toBe('/invite/:id');
    expect(pathTemplate('/payments/top-up')).toBe('/payments/top-up');
    expect(pathTemplate('/v1/companies/cmp_bad078ed36794af3adcf/members', '{id}')).toBe(
      '/v1/companies/{id}/members',
    );
    expect(pathTemplate('/support/karim@ongem.com')).toBe('/support/:id');
  });

  it('error messages and stacks lose emails, numbers, tokens and URLs AC_R9_1', () => {
    const m = scrubMessage(
      'no user jane.doe@example.com acct 123456789 at https://app-dev.platform.ongem.com/x?company=cmp_1 token eyJhbGciOi.eyJzdWIiOi.c2ln',
    );
    expect(m).not.toMatch(/jane|123456789|company=|eyJ/);
    expect(
      scrubStack('TypeError: x\n    at f (https://app-dev.platform.ongem.com/assets/a.js?v=1:1:20)'),
    ).toBe('TypeError: x\n    at f (https://app-dev.platform.ongem.com/assets/a.js:1:20)');
  });

  it('an uncaught error is an OTLP log with the type, scrubbed message, stack and route template AC_R9_1', () => {
    const rec = errorRecord(
      {
        time: 1_700_000_000_000,
        type: 'TypeError',
        message: 'bad id acc_99887766 for a@b.co',
        stack: 'TypeError: bad\n at x (https://app-dev.platform.ongem.com/assets/i.js?q=1:2:3)',
        path: '/accounts/acc_99887766',
        rejection: false,
      },
      pathTemplate('/accounts/acc_99887766'),
      false,
    );
    const body = logsBody({ 'service.name': 'ongem-web' }, [rec]);
    const json = JSON.stringify(body);
    expect(json).not.toMatch(/99887766|a@b\.co|q=1/);
    const log = body.resourceLogs[0]!.scopeLogs[0]!.logRecords[0]!;
    expect(log.severityNumber).toBe(17);
    expect(log.timeUnixNano).toBe('1700000000000000000');
    expect(log.attributes).toContainEqual({ key: 'app.route', value: { stringValue: '/accounts/:id' } });
    expect(log.attributes).toContainEqual({ key: 'exception.type', value: { stringValue: 'TypeError' } });
  });

  it('API calls: traceparent only to the OnGem API, nothing for other hosts, UAE APIs pause AC_R9_1', () => {
    const origin = 'https://app-dev.platform.ongem.com';
    const c = config();
    expect(apiCall(new URL('/api-dev/v1/payments/pay_1?limit=5', origin), origin, c)).toEqual({
      template: '/v1/payments/{id}',
      propagate: true,
      uae: false,
    });
    expect(apiCall(new URL('https://api-dev.ongem.com/v1/me'), origin, c)?.propagate).toBe(true);
    expect(apiCall(new URL('https://api-dev.ae.platform.ongem.com/v1/me'), origin, c)).toEqual({
      template: '/v1/me',
      propagate: false,
      uae: true,
    });
    expect(apiCall(new URL('https://clerk.ongem.com/v1/client'), origin, c)).toBeNull();
    expect(apiCall(new URL('https://api.synctera.com/v0/x'), origin, c)).toBeNull();
    expect(apiCall(new URL('/assets/x.js', origin), origin, c)).toBeNull();
    expect(traceparent('a'.repeat(32), 'b'.repeat(16))).toBe(`00-${'a'.repeat(32)}-${'b'.repeat(16)}-01`);
  });

  it('is off without an endpoint, for an AE build and for a production build without its own AC_R9_1', () => {
    const app = { service: 'ongem-web', version: '1' };
    expect(telemetryConfig({}, app).endpoint).toBe(DEV_ENDPOINT);
    expect(telemetryConfig({ VITE_OTEL_ENDPOINT: '' }, app).endpoint).toBe('');
    expect(telemetryConfig({ VITE_REGION: 'AE', VITE_OTEL_ENDPOINT: DEV_ENDPOINT }, app).endpoint).toBe('');
    expect(telemetryConfig({ VITE_ENVIRONMENT: 'production' }, app).endpoint).toBe('');
    expect(telemetryConfig({ VITE_OTEL_ENDPOINT: 'http://insecure.example' }, app).endpoint).toBe('');
    expect(telemetryConfig({ VITE_OTEL_SAMPLING: '0.25' }, app).sampling).toBe(0.25);
  });

  it('spans and web vitals are valid OTLP JSON with the resource of the build AC_R9_1', () => {
    const ex = new Exporter(config(), async () => true);
    const res = ex.resource('');
    expect(res).toMatchObject({
      'service.name': 'ongem-web',
      'service.version': '0.1.0+abc',
      'deployment.environment': 'dev',
    });
    const t = tracesBody(res, [
      {
        traceId: 'a'.repeat(32),
        spanId: 'b'.repeat(16),
        name: 'GET /v1/me',
        kind: 3,
        start: 1000,
        end: 1500.5,
        attributes: { 'http.response.status_code': 500 },
        error: true,
      },
    ]);
    const span = t.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;
    expect(span.status.code).toBe(2);
    expect(span.endTimeUnixNano).toBe('1500500000');
    expect(span.attributes).toContainEqual({ key: 'http.response.status_code', value: { intValue: '500' } });
    const m = metricsBody(res, [
      { name: 'web.vitals.lcp', unit: 'ms', value: 2300, time: 1000, attributes: {} },
    ]);
    const h = m.resourceMetrics[0]!.scopeMetrics[0]!.metrics[0]!.histogram;
    expect(h.dataPoints[0]!.bucketCounts.length).toBe(h.dataPoints[0]!.explicitBounds.length + 1);
    expect(h.dataPoints[0]!.bucketCounts[6]).toBe('1');
  });

  it('batches per signal, backs off on failure and keeps at most 200 items AC_R9_1', async () => {
    vi.useFakeTimers();
    const posts: string[] = [];
    let up = false;
    const ex = new Exporter(config(), async (url) => {
      posts.push(url);
      return up;
    });
    const log = { s: 'logs' as const, ns: '', v: { time: 1, severity: 17, body: 'E', attributes: {} } };
    for (let i = 0; i < 250; i++) ex.add(log);
    await vi.advanceTimersByTimeAsync(0);
    expect(ex.size).toBeLessThanOrEqual(200);
    expect(posts.length).toBe(1);
    expect(posts[0]).toBe(`${DEV_ENDPOINT}/v1/logs`);
    await vi.advanceTimersByTimeAsync(1999);
    expect(posts.length).toBe(1);
    up = true;
    await vi.advanceTimersByTimeAsync(1);
    expect(posts.length).toBe(2);
    expect(ex.size).toBe(0);
  });

  it('posts with no credentials and drops a batch the collector refuses AC_R9_1', async () => {
    const calls: RequestInit[] = [];
    const post = poster((async (_u: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init ?? {});
      return new Response(null, { status: 400 });
    }) as typeof fetch);
    expect(await post(`${DEV_ENDPOINT}/v1/logs`, '{}')).toBe(true);
    expect(calls[0]).toMatchObject({ method: 'POST', credentials: 'omit', mode: 'cors' });
  });

  it('the CSP lets the app reach the collector AC_R9_1', () => {
    const p = JSON.parse(readFileSync('security-headers.json', 'utf8'));
    expect(p.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy).toMatch(
      /connect-src [^;]*https:\/\/otel-dev\.platform\.ongem\.com/,
    );
  });
});
