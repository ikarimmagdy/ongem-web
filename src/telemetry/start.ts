// OG-037 R9: the lazy half of the browser telemetry. Loaded after first paint by `index.ts`.
import { onCLS, onINP, onLCP, type Metric } from 'web-vitals';
import { takeErrors, type EarlyError, type TelemetryConfig } from './index';
import {
  logsBody,
  metricsBody,
  pathTemplate,
  scrubMessage,
  scrubStack,
  spanId,
  traceId,
  traceparent,
  tracesBody,
  type Attrs,
  type HistogramPoint,
  type LogRecord,
  type Span,
} from './otlp';

/** The OnGem API hosts a browser call may carry a `traceparent` to (ongem-core accepts it; CORS allows it). */
export const PROPAGATE_HOSTS = ['api-dev.ongem.com', 'api.ongem.com'];

export interface ApiCall {
  /** The path after the API base, as a template. */
  template: string;
  /** Whether the call may carry `traceparent`. */
  propagate: boolean;
  /** A UAE API: nothing about it, or after it, may reach the US collector (ADR-0054). */
  uae: boolean;
}

/** Whether a URL is a call to the OnGem API, and how it is reported. Other URLs are never traced. */
export function apiCall(
  url: URL,
  origin: string,
  config: Pick<TelemetryConfig, 'apiPrefix'>,
): ApiCall | null {
  const prefix = config.apiPrefix;
  if (url.origin === origin && prefix && (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)))
    return {
      template: pathTemplate(url.pathname.slice(prefix.length) || '/', '{id}'),
      propagate: true,
      uae: false,
    };
  const host = url.hostname;
  if (url.protocol !== 'https:' || !/(^|\.)ongem\.com$/.test(host) || !/^api[.-]/.test(host)) return null;
  const uae = host.split('.').includes('ae');
  return {
    template: pathTemplate(url.pathname, '{id}'),
    propagate: !uae && PROPAGATE_HOSTS.includes(host),
    uae,
  };
}

const MAX_QUEUE = 200;
const BATCH = 50;

type Signal = 'traces' | 'logs' | 'metrics';
type Item = { ns: string } & (
  { s: 'traces'; v: Span } | { s: 'logs'; v: LogRecord } | { s: 'metrics'; v: HistogramPoint }
);

/** Batches items per signal and namespace, posts them as OTLP JSON, backs off on failure and keeps at most 200. */
export class Exporter {
  private queue: Item[] = [];
  private wait = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sending = false;

  constructor(
    private readonly config: TelemetryConfig,
    private readonly post: (url: string, body: string) => Promise<boolean>,
  ) {}

  resource(ns: string): Attrs {
    return {
      'service.name': this.config.service,
      'service.version': this.config.version,
      'deployment.environment': this.config.environment,
      'deployment.environment.name': this.config.environment,
      'telemetry.sdk.name': 'ongem-browser-otlp',
      'telemetry.sdk.language': 'webjs',
      ...(ns ? { 'service.namespace': ns } : {}),
    };
  }

  add(item: Item) {
    this.queue.push(item);
    if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE);
    if (this.queue.length >= BATCH && !this.wait) void this.flush();
    else this.schedule(5000);
  }

  get size() {
    return this.queue.length;
  }

  private schedule(ms: number) {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, ms);
  }

  /** Sends everything queued, one request per signal and namespace. */
  async flush(): Promise<void> {
    if (this.sending || !this.queue.length) return;
    this.sending = true;
    const items = this.queue.splice(0);
    const groups = new Map<string, Item[]>();
    for (const i of items) groups.set(`${i.s}|${i.ns}`, [...(groups.get(`${i.s}|${i.ns}`) ?? []), i]);
    const failed: Item[] = [];
    for (const [key, group] of groups) {
      const [signal, ns] = key.split('|') as [Signal, string];
      const res = this.resource(ns);
      const values = group.map((g) => g.v);
      const body =
        signal === 'traces'
          ? tracesBody(res, values as Span[])
          : signal === 'logs'
            ? logsBody(res, values as LogRecord[])
            : metricsBody(res, values as HistogramPoint[]);
      let ok = false;
      try {
        ok = await this.post(`${this.config.endpoint}/v1/${signal}`, JSON.stringify(body));
      } catch {
        ok = false;
      }
      if (!ok) failed.push(...group);
    }
    this.sending = false;
    if (failed.length) {
      this.queue.unshift(...failed);
      if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE);
      this.wait = Math.min(this.wait ? this.wait * 2 : 2000, 300000);
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.schedule(this.wait);
    } else {
      this.wait = 0;
      if (this.queue.length) this.schedule(5000);
    }
  }
}

/** POST with no cookies or credentials; `keepalive` lets the last batch leave as the page is hidden. */
export function poster(fetchImpl: typeof fetch) {
  return async (url: string, body: string) => {
    const res = await fetchImpl(url, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      mode: 'cors',
      keepalive: body.length < 60000,
    });
    // A refusal other than a throttle or an outage will not get better: drop the batch rather than retry it.
    return res.ok || (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429);
  };
}

/** Builds the error log record: the type, a scrubbed message, the stack and the route template, never a URL. */
export function errorRecord(e: EarlyError, route: string, demo: boolean): LogRecord {
  return {
    time: e.time,
    severity: 17,
    body: e.type,
    attributes: {
      'exception.type': e.type,
      'exception.message': scrubMessage(e.message),
      ...(e.stack ? { 'exception.stacktrace': scrubStack(e.stack) ?? '' } : {}),
      'exception.escaped': true,
      'app.route': route,
      'app.unhandled_rejection': e.rejection,
      'app.demo': demo,
    },
  };
}

let started = false;

export function start(config: TelemetryConfig, win: Window & typeof globalThis = window) {
  if (started || !config.endpoint) return;
  started = true;
  const original = win.fetch.bind(win);
  const exporter = new Exporter(config, poster(original));
  const route = (path = win.location.pathname) => pathTemplate(path, ':id', config.secretAfter);
  const ns = () => (config.demo() ? 'demo' : '');
  const sampled = () => Math.random() < config.sampling;
  // Recording stops after a call to a UAE API and starts again with the next US one (the company moved region).
  let paused = false;
  let pageTrace = traceId();

  takeErrors((e) => {
    if (!paused) exporter.add({ s: 'logs', ns: ns(), v: errorRecord(e, route(e.path), config.demo()) });
  });

  const span = (v: Span) => {
    if (!paused && !config.demo()) exporter.add({ s: 'traces', ns: '', v });
  };

  // The document load, from the navigation timing entry.
  const nav = win.performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (nav && sampled()) {
    const origin = win.performance.timeOrigin;
    span({
      traceId: pageTrace,
      spanId: spanId(),
      name: `documentLoad ${route()}`,
      kind: 1,
      start: origin + nav.startTime,
      end: origin + (nav.loadEventEnd || nav.domComplete || nav.responseEnd),
      attributes: {
        'app.route': route(),
        'app.ttfb_ms': Math.round(nav.responseStart),
        'app.dom_content_loaded_ms': Math.round(nav.domContentLoadedEventEnd),
        'app.navigation_type': nav.type,
      },
    });
  }

  // Route changes: one span per change of route template, ended after the next two frames.
  let current = route();
  const changed = () => {
    const next = route();
    if (next === current) return;
    const from = current;
    current = next;
    pageTrace = traceId();
    if (!sampled()) return;
    const begin = Date.now();
    const trace = pageTrace;
    const end = () =>
      span({
        traceId: trace,
        spanId: spanId(),
        name: `routeChange ${next}`,
        kind: 1,
        start: begin,
        end: Date.now(),
        attributes: { 'app.route': next, 'app.route.from': from },
      });
    if (win.requestAnimationFrame) win.requestAnimationFrame(() => win.requestAnimationFrame(end));
    else end();
  };
  for (const m of ['pushState', 'replaceState'] as const) {
    const orig = win.history[m].bind(win.history);
    win.history[m] = (...args: Parameters<History['pushState']>) => {
      orig(...args);
      changed();
    };
  }
  win.addEventListener('popstate', changed);

  // API calls: a client span with the path template, and `traceparent` to the OnGem API.
  win.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let call: ApiCall | null = null;
    try {
      const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      call = apiCall(new URL(href, win.location.href), win.location.origin, config);
    } catch {
      call = null;
    }
    if (!call) return original(input, init);
    paused = call.uae;
    if (call.uae || config.demo() || !sampled()) return original(input, init);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const trace = pageTrace;
    const id = spanId();
    if (call.propagate) {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      headers.set('traceparent', traceparent(trace, id));
      init = { ...init, headers };
    }
    const begin = Date.now();
    const attributes: Attrs = {
      'http.request.method': method,
      'url.template': call.template,
      'app.route': route(),
    };
    try {
      const res = await original(input, init);
      span({
        traceId: trace,
        spanId: id,
        name: `${method} ${call.template}`,
        kind: 3,
        start: begin,
        end: Date.now(),
        attributes: { ...attributes, 'http.response.status_code': res.status },
        error: res.status >= 400,
      });
      return res;
    } catch (e) {
      span({
        traceId: trace,
        spanId: id,
        name: `${method} ${call.template}`,
        kind: 3,
        start: begin,
        end: Date.now(),
        attributes: { ...attributes, 'error.type': e instanceof Error ? e.name : 'Error' }, // content-check: ignore
        error: true,
      });
      throw e;
    }
  };

  // Web vitals as histograms (names the SigNoz dashboard reads: web.vitals.lcp, .inp, .cls).
  const vital = (m: Metric) => {
    if (paused || config.demo()) return;
    exporter.add({
      s: 'metrics',
      ns: '',
      v: {
        name: `web.vitals.${m.name.toLowerCase()}`,
        unit: m.name === 'CLS' ? '1' : 'ms',
        value: m.value,
        time: Date.now(),
        attributes: { route: route(), 'app.vitals.rating': m.rating },
      },
    });
  };
  onLCP(vital);
  onCLS(vital);
  onINP(vital);

  const leave = () => {
    if (win.document.visibilityState === 'hidden') void exporter.flush();
  };
  win.document.addEventListener('visibilitychange', leave);
  win.addEventListener('pagehide', () => void exporter.flush());
}
