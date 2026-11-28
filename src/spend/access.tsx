import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Permission } from '../api/client';
import { useAsync } from '../lib/useAsync';
import { EMPLOYEE_NAV } from '../nav';
import { useSession } from '../session';
import { spendOf, type SpendMeView } from './api';

export interface SpendAccess {
  /** The programme is ACTIVE for this company (GET /v1/spend/program); OFF, SUSPENDED or no answer hide spend. */
  on: boolean;
  /** Finance screens: the person holds spend:view. */
  finance: boolean;
  /** The person's own employee profile (GET /v1/spend/me), null when they are not an employee here. */
  employee: SpendMeView | null;
  /** The role is EMPLOYEE: the shell shows the employee view and nothing else. */
  employeeOnly: boolean;
  loading: boolean;
  reload(): void;
}

const OFF: SpendAccess = {
  on: false,
  finance: false,
  employee: null,
  employeeOnly: false,
  loading: false,
  reload: () => undefined,
};

const Ctx = createContext<SpendAccess>(OFF);

/** OG-087: reads once per company whether spend is on and who the person is in it, for the menu and the screens. */
export function SpendAccessProvider({ children }: { children: ReactNode }) {
  const { api, can, role } = useSession();
  const finance = can(Permission.SPEND_VIEW);
  const own = can(Permission.SPEND_OWN);
  const asks = finance || own;
  const state = useAsync(async () => {
    if (!asks) return { on: false, employee: null };
    const spend = spendOf(api);
    const program = await spend.program().catch(() => null);
    if (program?.state !== 'ACTIVE') return { on: false, employee: null };
    if (!own) return { on: true, employee: null };
    // 404 employee_not_found: a member who is not an employee; any other failure also hides the employee view.
    const employee = await spend.me().catch(() => null);
    return { on: true, employee };
  }, [api, asks, own]);
  const value = useMemo<SpendAccess>(
    () => ({
      on: state.status === 'success' && state.data.on,
      finance: finance && state.status === 'success' && state.data.on,
      employee: state.status === 'success' ? state.data.employee : null,
      employeeOnly: (role ?? '').toUpperCase() === 'EMPLOYEE',
      loading: state.status === 'loading' && asks,
      reload: state.reload,
    }),
    [state, finance, role, asks],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSpendAccess(): SpendAccess {
  return useContext(Ctx);
}

/** OG-087: whether a menu entry shows: spend only while it is on; an EMPLOYEE sees their spend and settings only. */
export function navShown(id: string, spend: SpendAccess): boolean {
  if (spend.employeeOnly && !EMPLOYEE_NAV.has(id)) return false;
  if (id === 'spend') return spend.on && (spend.finance || !!spend.employee);
  return true;
}
