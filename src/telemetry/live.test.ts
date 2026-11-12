import { describe, expect, it, vi } from 'vitest';
import { DEV_ENDPOINT, telemetryConfig } from './index';
import { pathTemplate, spanId, traceId } from './otlp';
import { errorRecord, Exporter } from './start';

/**
 * OG-037 AC-R9.1 against the real dev collector, from the test runner (a server sends no Origin, so CORS does not
 * apply). Runs only with ONGEM_OTEL_LIVE=1: `ONGEM_OTEL_LIVE=1 npx vitest run src/telemetry/live.test.ts`.
 */
describe.skipIf(process.env.ONGEM_OTEL_LIVE !== '1')('OG-037 live export', () => {
  it('an error log, a failed API call span and the web vitals reach the dev collector AC_R9_1', async () => {
    // The suite's setup pins the clock; the collector needs today's time.
    vi.useRealTimers();
    const config = telemetryConfig(
      { VITE_OTEL_ENDPOINT: DEV_ENDPOINT },
      { service: process.env.ONGEM_OTEL_SERVICE ?? 'ongem-web', version: 'og037-live' },
    );
    const statuses: number[] = [];
    const exporter = new Exporter(config, async (url, body) => {
      const res = await fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
      statuses.push(res.status);
      return res.ok;
    });
    const trace = traceId();
    const now = Date.now();
    exporter.add({
      s: 'logs',
      ns: '',
      v: errorRecord(
        {
          time: now,
          type: 'TypeError',
          message: 'og037 live check for jane@example.com 123456789',
          stack:
            'TypeError: og037\n    at check (https://app-dev.platform.ongem.com/assets/start.js?x=1:1:20)',
          path: '/payments/pay_og037live',
          rejection: false,
        },
        pathTemplate('/payments/pay_og037live'),
        false,
      ),
    });
    exporter.add({
      s: 'traces',
      ns: '',
      v: {
        traceId: trace,
        spanId: spanId(),
        name: 'GET /v1/payments/{id}',
        kind: 3,
        start: now - 120,
        end: now,
        attributes: {
          'http.request.method': 'GET',
          'url.template': '/v1/payments/{id}',
          'http.response.status_code': 500,
          'app.route': '/payments/:id',
        },
        error: true,
      },
    });
    for (const [name, unit, value] of [
      ['lcp', 'ms', 1800],
      ['inp', 'ms', 120],
      ['cls', '1', 0.04],
    ] as const)
      exporter.add({
        s: 'metrics',
        ns: '',
        v: { name: `web.vitals.${name}`, unit, value, time: now, attributes: { route: '/payments/:id' } },
      });
    await exporter.flush();
    console.log(
      `og037-live service=${config.service} trace=${trace} at=${new Date(now).toISOString()} ${statuses}`,
    );
    expect(statuses).toEqual([200, 200, 200]);
    expect(exporter.size).toBe(0);
  });
});
