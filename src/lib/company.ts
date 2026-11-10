import type { OnGemApi } from '../api/client';
import type { CompanyState, Me, Membership } from '../api/types';

/** The membership of the company this answer runs in (G-69): the picked or default company, else the first one. */
export function currentMembership(me: Me | null | undefined): Membership | undefined {
  if (!me) return undefined;
  return (
    me.memberships.find((m) => m.companyId === me.companyId) ??
    me.memberships.find((m) => m.state === 'ACTIVE') ??
    me.memberships[0]
  );
}

/** The companies the person can switch to: their ACTIVE memberships. */
export function switchable(me: Me | null | undefined): Membership[] {
  return me?.memberships.filter((m) => m.state === 'ACTIVE') ?? [];
}

/** The regions OnGem serves (ADR-0050); the switcher asks each one this build has an API for. */
export const REGIONS = ['US', 'AE'] as const;

export interface Companies {
  items: Membership[];
  /** True when a region did not answer: its companies are missing from [items] (OG-023 R12). */
  partial: boolean;
  /** The person's default company in the home region, where a request without X-Company-Id runs. */
  defaultCompanyId: string | null;
}

/**
 * OG-023 R12: the person's ACTIVE companies in every region, from each region's own GET /v1/me with the same sign-in,
 * each marked with its region. The client joins them; no server sees the other region's companies (ADR-0050).
 */
export async function loadCompanies(home: OnGemApi): Promise<Companies> {
  const clients = REGIONS.map((r) => (r === home.region ? home : home.forRegion(r))).filter(
    (c): c is OnGemApi => c !== null,
  );
  // OG-022 R25, N4: another region is asked whereami first, which writes nothing there; only a region that holds the
  // person (a company or a region in the answer) is then asked GET /v1/me, so no person record is made where they are
  // unknown. A region that does not hold them is skipped without a notice.
  const answers = await Promise.allSettled(
    clients.map(async (c) => {
      if (c === home) return c.me();
      const w = await c.whereami();
      return w.companyId || w.region ? c.me() : null;
    }),
  );
  const seen = new Set<string>();
  const items: Membership[] = [];
  answers.forEach((a, i) => {
    if (a.status !== 'fulfilled' || !a.value) return;
    for (const m of switchable(a.value)) {
      if (seen.has(m.companyId)) continue;
      seen.add(m.companyId);
      items.push({ ...m, region: clients[i]!.region });
    }
  });
  const partial = answers.some((a) => a.status === 'rejected');
  if (!items.length && partial) {
    const failed = answers.find((a) => a.status === 'rejected') as PromiseRejectedResult;
    throw failed.reason;
  }
  const first = answers[clients.indexOf(home)];
  const defaultCompanyId = first?.status === 'fulfilled' ? (first.value?.companyId ?? null) : null;
  return { items, partial, defaultCompanyId };
}

/** The company's lifecycle state, ACTIVE when the API does not say (OG-023 R13). */
export function companyState(m: Membership | undefined): CompanyState {
  return m?.companyState ?? 'ACTIVE';
}
