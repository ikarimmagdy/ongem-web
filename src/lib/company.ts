import type { Me, Membership } from '../api/types';

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
