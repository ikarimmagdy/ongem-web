import { Link } from 'react-router-dom';
import { Card, Notice, PageHeader } from '../design-system';
import { formatMinor } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { Load, human } from './common';

export function HomeScreen() {
  const { api } = useSession();
  const accounts = useAsync(() => api.accounts(), [api]);
  const apps = useAsync(() => api.applications(), [api]);
  return (
    <>
      <PageHeader title="Home" subtitle="Your company's money at a glance." />
      {apps.status === 'success' && apps.data[0] && apps.data[0].state !== 'ACTIVE' && (
        <Notice status="info" action={<Link to="/onboarding">Continue</Link>}>
          Your account application is {human(apps.data[0].state)}.
        </Notice>
      )}
      <Load state={accounts} label="accounts">
        {(list) => {
          const total = list.reduce((s, a) => s + (a.balance?.available.amountMinor ?? 0), 0);
          return (
            <Card title="Available across your accounts">
              <p className="og-money og-money--xl" data-mask="" data-testid="home-total">
                {formatMinor({ amountMinor: total, currency: list[0]?.currency ?? 'USD' })}
              </p>
              <div className="fw-actions">
                <Link to="/accounts">Accounts</Link>
                <Link to="/payments/new">New payment</Link>
                <Link to="/support/new">Ask for help</Link>
              </div>
            </Card>
          );
        }}
      </Load>
    </>
  );
}
