import { Link } from 'react-router-dom';
import { Card, KeyValue, Notice, PageHeader, StatusChip } from '../design-system';
import { formatMinor } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { currentMembership } from '../lib/company';
import { useSession } from '../session';
import { Load, human, stateStatus } from './common';

export function HomeScreen() {
  const { api } = useSession();
  const accounts = useAsync(() => api.accounts(), [api]);
  const apps = useAsync(() => api.applications(), [api]);
  const me = useAsync(() => api.me(), [api]);
  const person = me.status === 'success' ? me.data : null;
  const membership = currentMembership(person);
  const bankState = person?.providerState ?? 'NOT_SUBMITTED';
  return (
    <>
      <PageHeader
        title={person?.legalFirstName ? `Hello, ${person.legalFirstName}` : 'Hello'}
        subtitle="Your company's money at a glance."
      />
      {membership && (
        <Card title="Your company" data-testid="home-company">
          <KeyValue
            items={[
              { label: 'Company', value: membership.companyName ?? membership.companyId },
              { label: 'Your role', value: human(membership.role) },
              {
                label: 'Identity at the bank',
                value: (
                  <StatusChip status={stateStatus(bankState)}>
                    <span data-testid="home-verification">{human(bankState)}</span>
                  </StatusChip>
                ),
              },
            ]}
          />
        </Card>
      )}
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
