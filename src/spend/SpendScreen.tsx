import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Permission } from '../api/client';
import { Card, EmptyState, KeyValue, Notice, PageHeader, Skeleton, StatusChip } from '../design-system';
import { t } from '../i18n';
import { formatBankDate } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { Amt, Load } from '../screens/common';
import { useSpendAccess } from './access';
import { spendOf } from './api';
import { SpendTabs, stateLabel, spendStatus, type SpendTab } from './common';
import { EmployeesScreen } from './Employees';
import { ExpenseDetail, ExpensesScreen } from './Expenses';
import { ExportsScreen } from './Exports';
import { MyCard, MyClaim, MyExpenseDetail, MyExpenses, MyReceipts } from './MySpend';
import { PolicyScreen } from './Policy';
import { ReceiptsScreen } from './Receipts';
import { TeamsScreen } from './Teams';

const FINANCE_TABS: SpendTab[] = [
  { id: 'overview', to: '/spend' },
  { id: 'expenses', to: '/spend/expenses' },
  { id: 'employees', to: '/spend/employees' },
  { id: 'teams', to: '/spend/teams' },
  { id: 'receipts', to: '/spend/receipts' },
  { id: 'policy', to: '/spend/policy' },
  { id: 'exports', to: '/spend/exports' },
];

const EMPLOYEE_TABS: SpendTab[] = [
  { id: 'my_card', to: '/spend/me' },
  { id: 'my_expenses', to: '/spend/me/expenses' },
  { id: 'my_receipts', to: '/spend/me/receipts' },
  { id: 'claim', to: '/spend/me/claim' },
];

/** The tab a spend route belongs to. */
export function spendTabOf(pathname: string): string {
  const rest = pathname.replace(/^\/spend\/?/, '');
  if (rest.startsWith('me/expenses')) return 'my_expenses';
  if (rest.startsWith('me/receipts')) return 'my_receipts';
  if (rest.startsWith('me/claim')) return 'claim';
  if (rest.startsWith('me')) return 'my_card';
  const head = rest.split('/')[0];
  return FINANCE_TABS.find((x) => x.id === head)?.id ?? 'overview';
}

/**
 * OG-087 spend management (contract WS outputs/review/og087-2026-11-28/spend-api.md): finance screens for people with
 * spend:view, the employee view for a person who is an employee here. Shown only while the programme is ACTIVE.
 */
export function SpendScreen() {
  const { can } = useSession();
  const spend = useSpendAccess();
  const { pathname } = useLocation();
  const mine = pathname.startsWith('/spend/me');
  if (spend.loading) return <Skeleton label={t('app.spend.loading')} />;
  if (!spend.on || (!spend.finance && !spend.employee)) {
    return (
      <>
        <PageHeader title={t('app.spend.title')} />
        <Card>
          <EmptyState title={t('app.spend.off_title')}>
            <p data-testid="spend-off">{t('app.spend.off_text')}</p>
          </EmptyState>
        </Card>
      </>
    );
  }
  const exportsOn = can(Permission.SPEND_EXPORT);
  const financeTabs = [
    ...FINANCE_TABS.filter((x) => x.id !== 'exports' || exportsOn),
    ...(spend.employee ? [{ id: 'my_spend', to: '/spend/me' }] : []),
  ];
  const showMine = mine || !spend.finance;
  const tabs = showMine
    ? [...(spend.finance ? [{ id: 'back_finance', to: '/spend' }] : []), ...EMPLOYEE_TABS]
    : financeTabs;
  const current = spendTabOf(pathname);
  return (
    <>
      <PageHeader title={showMine ? t('app.spend.my_title') : t('app.spend.title')} />
      <SpendTabs tabs={tabs} current={current} label={t('app.spend.tabs_label')} />
      <div className="fw-tab-panel" data-testid={`spend-panel-${current}`}>
        <Routes>
          {spend.finance ? (
            <>
              <Route index element={<Overview />} />
              <Route path="expenses" element={<ExpensesScreen />} />
              <Route path="expenses/:id" element={<ExpenseDetail />} />
              <Route path="employees" element={<EmployeesScreen />} />
              <Route path="employees/:id" element={<EmployeesScreen />} />
              <Route path="teams" element={<TeamsScreen />} />
              <Route path="receipts" element={<ReceiptsScreen />} />
              <Route path="policy" element={<PolicyScreen />} />
              {exportsOn && <Route path="exports" element={<ExportsScreen />} />}
            </>
          ) : (
            <Route index element={<Navigate to="/spend/me" replace />} />
          )}
          {spend.employee && (
            <>
              <Route path="me" element={<MyCard />} />
              <Route path="me/expenses" element={<MyExpenses />} />
              <Route path="me/expenses/:id" element={<MyExpenseDetail />} />
              <Route path="me/receipts" element={<MyReceipts />} />
              <Route path="me/claim" element={<MyClaim />} />
            </>
          )}
          <Route path="*" element={<Navigate to={spend.finance ? '/spend' : '/spend/me'} replace />} />
        </Routes>
      </div>
    </>
  );
}

/** Overview: what waits for a decision, what employees still have to submit, receipts to match, the policy in force. */
function Overview() {
  const { api, can } = useSession();
  const spend = spendOf(api);
  const data = useAsync(async () => {
    const [pending, open, receipts, policy] = await Promise.all([
      spend.expenses({ state: 'PENDING_APPROVAL' }, null, 100),
      spend.expenses({ state: 'OPEN' }, null, 100),
      spend.receipts(),
      spend.policy(),
    ]);
    return { pending, open, receipts, policy };
  }, [api]);
  const count = (p: { items: unknown[]; next?: string | null }) =>
    p.next ? t('app.spend.overview.many', { count: p.items.length }) : String(p.items.length);
  return (
    <Load state={data} label="spend">
      {({ pending, open, receipts, policy }) => (
        <>
          <Card title={t('app.spend.overview.title')} data-testid="spend-overview">
            <KeyValue
              items={[
                {
                  label: t('app.spend.overview.waiting'),
                  value: (
                    <Link to="/spend/expenses?state=PENDING_APPROVAL" data-testid="spend-count-pending">
                      {count(pending)}
                    </Link>
                  ),
                },
                {
                  label: t('app.spend.overview.open'),
                  value: (
                    <Link to="/spend/expenses?state=OPEN" data-testid="spend-count-open">
                      {count(open)}
                    </Link>
                  ),
                },
                {
                  label: t('app.spend.overview.unmatched'),
                  value: (
                    <Link to="/spend/receipts" data-testid="spend-count-receipts">
                      {receipts.length}
                    </Link>
                  ),
                },
                {
                  label: t('app.spend.overview.policy'),
                  value: policy.active
                    ? t('app.spend.policy.version', { version: policy.active.version })
                    : t('app.spend.policy.none'),
                },
              ]}
            />
            {policy.proposed && (
              <Notice status="pending">
                <Link to="/spend/policy" data-testid="spend-overview-proposal">
                  {t('app.spend.overview.proposal', { version: policy.proposed.version })}
                </Link>
              </Notice>
            )}
          </Card>
          <Card title={t('app.spend.overview.waiting_title')}>
            {pending.items.length === 0 ? (
              <EmptyState title={t('app.spend.overview.nothing_waiting')} />
            ) : (
              <ul className="fw-list" data-testid="spend-waiting">
                {pending.items.slice(0, 5).map((x) => (
                  <li key={x.id}>
                    <Link className="fw-row" to={`/spend/expenses/${encodeURIComponent(x.id)}`}>
                      <span className="fw-row__main">
                        <strong>{x.merchant ?? x.employeeName}</strong>
                        <span className="fw-row__sub">
                          {x.employeeName} · {formatBankDate(x.spentOn)}
                        </span>
                      </span>
                      <Amt value={x.amount} />
                      <StatusChip status={spendStatus(x.state)}>{stateLabel(x.state)}</StatusChip>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {!can(Permission.SPEND_APPROVE) && pending.items.length > 0 && (
              <p className="fw-row__sub">{t('app.spend.overview.no_approve')}</p>
            )}
          </Card>
        </>
      )}
    </Load>
  );
}
