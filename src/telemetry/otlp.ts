// OG-037 R9: OpenTelemetry for the browser as OTLP/HTTP JSON, written by hand so the lazy chunk stays a few kB.
// Nothing here may carry personal data: routes are templates, API paths keep only their words, messages are scrubbed.

export type Attr = string | number | boolean;
export type Attrs = Record<string, Attr>;

const hex = (bytes: number) => {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
};
export const traceId = () => hex(16);
export const spanId = () => hex(8);
export const traceparent = (trace: string, span: string, sampled = true) =>
  `00-${trace}-${span}-${sampled ? '01' : '00'}`;

/** Epoch milliseconds (fractional) as OTLP nanoseconds, a decimal string. */
export const nanos = (ms: number) => (BigInt(Math.round(ms * 1000)) * 1000n).toString();

/** A path segment that is a word ("payments", "top-up") or an API version stays; ids, tokens, keys and numbers do not. */
const WORD = /^[a-z]+(-[a-z]+)*$/;

/** A path as a template: no query or fragment, and every segment that is not a plain word becomes `placeholder`. */
export function pathTemplate(path: string, placeholder = ':id', secretAfter: string[] = []): string {
  const clean = path.split(/[?#]/)[0] ?? '';
  const segs = clean.split('/');
  const out = segs.map((s, i) => {
    if (!s) return s;
    if (i > 0 && secretAfter.includes(segs[i - 1] ?? '')) return placeholder;
    return (WORD.test(s) && s.length <= 32) || /^v\d{1,2}$/.test(s) ? s : placeholder;
  });
  return out.join('/') || '/';
}

/** An error message without emails, long digit runs, tokens or URLs, cut to 300 characters. */
export function scrubMessage(message: string): string {
  return message
    .replace(/https?:\/\/[^\s'")]+/g, '<url>')
    .replace(/[^\s@'"<>]+@[^\s@'"<>]+\.[a-z]{2,}/gi, '<email>')
    .replace(/\b(eyJ[\w-]+\.[\w-]+\.[\w-]+|[A-Za-z0-9_-]{32,})\b/g, '<token>')
    .replace(/\d[\d\s-]{3,}\d|\d{4,}/g, '<n>')
    .slice(0, 300);
}

const FRAME = /^\s*(at\s.*|[\w$.<>]*@)?\(?https?:\/\/\S+:\d+:\d+\)?$/;

/** A stack trace with no query strings or fragments on its script URLs, at most 40 lines. */
export function scrubStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  return stack
    .split('\n')
    .slice(0, 40)
    .map((l) =>
      // A frame keeps its script URL and position (without query or fragment); any other line is message text.
      FRAME.test(l) ? l.replace(/(https?:\/\/[^\s?#)]+)[?#][^\s:)]*/g, '$1') : scrubMessage(l),
    )
    .join('\n');
}

const value = (v: Attr) =>
  typeof v === 'string'
    ? { stringValue: v }
    : typeof v === 'boolean'
      ? { boolValue: v }
      : Number.isInteger(v)
        ? { intValue: String(v) }
        : { doubleValue: v };
export const kv = (a: Attrs) => Object.entries(a).map(([key, v]) => ({ key, value: value(v) }));

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  /** 1 internal, 2 server, 3 client. */
  kind: number;
  start: number;
  end: number;
  attributes: Attrs;
  error?: boolean;
}

export interface LogRecord {
  time: number;
  /** 17 ERROR, 21 FATAL. */
  severity: number;
  body: string;
  attributes: Attrs;
  traceId?: string;
  spanId?: string;
}

export interface HistogramPoint {
  name: string;
  unit: string;
  value: number;
  time: number;
  attributes: Attrs;
}

const scope = { name: 'ongem-browser-telemetry', version: '1' };

export function tracesBody(resource: Attrs, spans: Span[]) {
  return {
    resourceSpans: [
      {
        resource: { attributes: kv(resource) },
        scopeSpans: [
          {
            scope,
            spans: spans.map((s) => ({
              traceId: s.traceId,
              spanId: s.spanId,
              ...(s.parentSpanId ? { parentSpanId: s.parentSpanId } : {}),
              name: s.name,
              kind: s.kind,
              startTimeUnixNano: nanos(s.start),
              endTimeUnixNano: nanos(Math.max(s.end, s.start)),
              attributes: kv(s.attributes),
              status: { code: s.error ? 2 : 0 },
            })),
          },
        ],
      },
    ],
  };
}

export function logsBody(resource: Attrs, records: LogRecord[]) {
  return {
    resourceLogs: [
      {
        resource: { attributes: kv(resource) },
        scopeLogs: [
          {
            scope,
            logRecords: records.map((r) => ({
              timeUnixNano: nanos(r.time),
              observedTimeUnixNano: nanos(r.time),
              severityNumber: r.severity,
              severityText: r.severity >= 21 ? 'FATAL' : 'ERROR',
              body: { stringValue: r.body },
              attributes: kv(r.attributes),
              ...(r.traceId ? { traceId: r.traceId, spanId: r.spanId } : {}),
            })),
          },
        ],
      },
    ],
  };
}

/** Bucket bounds: milliseconds for LCP and INP, a ratio for CLS. */
export const BOUNDS: Record<string, number[]> = {
  ms: [100, 200, 500, 1000, 1500, 2000, 2500, 3000, 4000, 6000, 10000],
  '1': [0.01, 0.05, 0.1, 0.15, 0.25, 0.5, 1],
};

/** One delta histogram data point per measurement (web vitals are reported once per page view). */
export function metricsBody(resource: Attrs, points: HistogramPoint[]) {
  return {
    resourceMetrics: [
      {
        resource: { attributes: kv(resource) },
        scopeMetrics: [
          {
            scope,
            metrics: points.map((p) => {
              const bounds = BOUNDS[p.unit] ?? BOUNDS.ms ?? [];
              const counts = bounds.map(() => '0').concat('0');
              const at = bounds.findIndex((b) => p.value <= b);
              counts[at < 0 ? bounds.length : at] = '1';
              return {
                name: p.name,
                unit: p.unit,
                histogram: {
                  aggregationTemporality: 1,
                  dataPoints: [
                    {
                      startTimeUnixNano: nanos(p.time),
                      timeUnixNano: nanos(p.time),
                      count: '1',
                      sum: p.value,
                      min: p.value,
                      max: p.value,
                      bucketCounts: counts,
                      explicitBounds: bounds,
                      attributes: kv(p.attributes),
                    },
                  ],
                },
              };
            }),
          },
        ],
      },
    ],
  };
}
