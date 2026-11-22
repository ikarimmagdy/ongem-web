import { ApiError } from '../api/errors';
import type { AcceptanceAmount } from './api';

/**
 * OG-058 the buyer's side of a pay link: ongem-core's public paths, no sign-in. No Authorization header and no cookies;
 * the token is only ever in the path. Every Pay tap has one Idempotency-Key, and a 202 `acceptance_outcome_unknown` is
 * asked again with the same key, so a card is charged at most once.
 */

export type PublicPayState = 'OPEN' | 'PAID' | 'EXPIRED' | 'REVOKED' | 'UNAVAILABLE';

/** GET /v1/public/pay-links/{token}: what the page and the card form need; `client` only while OPEN. */
export interface PublicPayLink {
  state: PublicPayState;
  title: string;
  amount: AcceptanceAmount;
  merchantDisplayName: string;
  expiresAt: string;
  provider: 'stripe';
  environment: 'sandbox' | 'production';
  client?: {
    publishableKey: string;
    connectedAccountId: string | null;
    mode: 'payment';
    amountMinor: string;
    currency: string;
    paymentMethodCreation: 'manual';
    paymentMethodTypes: string;
  };
}

export type PayStatus = 'SUCCEEDED' | 'PENDING' | 'AUTHORIZED' | 'REQUIRES_ACTION' | 'FAILED';

export interface PublicConfirm {
  paymentId: string;
  status: PayStatus;
  clientSecret: string | null;
  failureCode: string | null;
  linkState: PublicPayState;
}

export interface PublicPayment {
  paymentId: string;
  status: PayStatus;
  failureCode: string | null;
  linkState: PublicPayState;
}

const OUTCOME_UNKNOWN = 'acceptance_outcome_unknown';

/** Where the public calls go and how; tests replace the fetch and shorten the waits. */
export const publicPayConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || '/api-dev',
  fetchImpl: ((input, init) => fetch(input, init)) as typeof fetch,
  retryMs: [1000, 2000, 4000],
};

const path = (token: string) => `/v1/public/pay-links/${encodeURIComponent(token)}`;

async function send<T>(
  method: 'GET' | 'POST',
  p: string,
  body?: unknown,
  key?: string,
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {
    Accept: 'application/json, application/problem+json', // content-check: ignore (media types)
  };
  if (key) headers['Idempotency-Key'] = key;
  if (body !== undefined) headers['Content-Type'] = 'application/json'; // content-check: ignore (media type)
  let res: Response;
  try {
    res = await publicPayConfig.fetchImpl(publicPayConfig.baseUrl.replace(/\/$/, '') + p, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const problem = (data ?? {}) as { code?: string; detail?: string };
    throw new ApiError(res.status, problem.code ?? null, problem.detail);
  }
  return { status: res.status, data: data as T };
}

export const publicPay = {
  read: async (token: string): Promise<PublicPayLink> => (await send<PublicPayLink>('GET', path(token))).data,

  /** [key] is the Pay tap's own; a retry of the same tap passes it again. */
  confirm: async (
    token: string,
    confirmationToken: string,
    buyerEmail: string | null,
    key: string,
  ): Promise<PublicConfirm> => {
    const body = { confirmationToken, buyerEmail, returnUrl: null };
    for (let i = 0; ; i += 1) {
      const r = await send<PublicConfirm & { code?: string }>('POST', `${path(token)}/confirm`, body, key);
      if (r.status !== 202 && r.data?.code !== OUTCOME_UNKNOWN) return r.data;
      const wait = publicPayConfig.retryMs[i];
      if (wait === undefined) throw new ApiError(202, OUTCOME_UNKNOWN);
      await new Promise((ok) => setTimeout(ok, wait));
    }
  },

  /** After 3D Secure: the core reads the payment again from the processor. */
  payment: async (token: string, paymentId: string): Promise<PublicPayment> =>
    (await send<PublicPayment>('GET', `${path(token)}/payments/${encodeURIComponent(paymentId)}`)).data,
};
