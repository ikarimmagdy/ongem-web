// OG-037 R9: the only telemetry code in the first-load bundle. It keeps uncaught errors from the first moments in a
// small queue and loads the exporter (`start.ts`, its own chunk) once the page has loaded and the browser is idle, so
// telemetry never competes with the first paint.

export interface TelemetryConfig {
  service: string;
  /** Collector base URL, such as https://otel-dev.platform.ongem.com; blank switches telemetry off. */
  endpoint: string;
  environment: string;
  version: string;
  /** Share of page loads, route changes and API calls traced (0 to 1); errors are always sent. */
  sampling: number;
  /** Paths after which a segment is a secret even when it reads as a word (`invite/:token`). */
  secretAfter: string[];
  /** The same-origin API path the app calls (`/api-dev`, proxied to the API), or none. */
  apiPrefix: string;
  /** Demo mode sends errors only, under service.namespace demo (sample data, nobody's data). */
  demo: () => boolean;
}

/** The dev collector while no other one exists; a production build gets none unless VITE_OTEL_ENDPOINT says so. */
export const DEV_ENDPOINT = 'https://otel-dev.platform.ongem.com';

export function telemetryConfig(
  env: Record<string, string | boolean | undefined>,
  app: { service: string; version: string; secretAfter?: string[]; demo?: () => boolean },
): TelemetryConfig {
  const str = (k: string) => (typeof env[k] === 'string' ? (env[k] as string).trim() : undefined);
  const production = str('VITE_ENVIRONMENT') === 'production';
  const set = str('VITE_OTEL_ENDPOINT');
  // ADR-0054: UAE telemetry never reaches the US collector, so an AE build sends nothing until a UAE collector exists.
  const uae = (str('VITE_REGION') ?? '').toUpperCase() === 'AE';
  const endpoint = uae ? '' : (set ?? (production ? '' : DEV_ENDPOINT)).replace(/\/+$/, '');
  const sampling = Number(str('VITE_OTEL_SAMPLING') ?? '1');
  const api = str('VITE_API_BASE_URL') || '/api-dev';
  return {
    service: app.service,
    endpoint: /^https:\/\//.test(endpoint) ? endpoint : '',
    environment: str('VITE_OTEL_ENVIRONMENT') || (production ? 'prod' : 'dev'),
    version: app.version,
    sampling: Number.isFinite(sampling) ? Math.min(1, Math.max(0, sampling)) : 1,
    secretAfter: app.secretAfter ?? [],
    apiPrefix: api.startsWith('/') ? api.replace(/\/+$/, '') : '',
    demo: app.demo ?? (() => false),
  };
}

export interface EarlyError {
  time: number;
  type: string;
  message: string;
  stack?: string;
  path: string;
  /** true for an unhandled promise rejection. */
  rejection: boolean;
}

const early: EarlyError[] = [];
let sink: ((e: EarlyError) => void) | null = null;

function toError(reason: unknown, rejection: boolean): EarlyError {
  const err = reason instanceof Error ? reason : null;
  return {
    time: Date.now(),
    type: err?.name || (rejection ? 'UnhandledRejection' : 'Error'), // content-check: ignore
    message: err?.message ?? (typeof reason === 'string' ? reason : ''),
    stack: err?.stack,
    path: location.pathname,
    rejection,
  };
}

function capture(e: EarlyError) {
  if (sink) sink(e);
  else if (early.length < 20) early.push(e);
}

/** Called by `start.ts`: hands over the queued errors and takes every later one. */
export function takeErrors(next: (e: EarlyError) => void) {
  sink = next;
  early.splice(0).forEach(next);
}

/** Listens for uncaught errors now and loads the exporter after load and idle. Does nothing without an endpoint. */
export function startTelemetry(config: TelemetryConfig) {
  if (!config.endpoint || typeof window === 'undefined') return;
  window.addEventListener('error', (ev) => capture(toError(ev.error ?? ev.message, false)));
  window.addEventListener('unhandledrejection', (ev) => capture(toError(ev.reason, true)));
  const load = () =>
    void import('./start')
      .then((m) => m.start(config))
      .catch(() => {
        /* telemetry is never worth an error of its own */
      });
  const idle = () =>
    'requestIdleCallback' in window
      ? window.requestIdleCallback(load, { timeout: 5000 })
      : setTimeout(load, 2000);
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
}
