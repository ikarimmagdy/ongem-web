import { Link } from 'react-router-dom';
import { Card, KeyValue, Notice, PageHeader, StatusChip } from '../design-system';
import { formatDate, formatMinor } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { currentMembership } from '../lib/company';
import { applicationSentence, paymentLabel } from '../lib/states';
import { useSession } from '../session';
import { REGION_CONFIG } from '../region';
import { AcctLast4, Amt, Load, human, stateStatus } from './common';

/** Home leads with the money (UI review 2026-11-07, OG-030 R-UX-6): the total, where it sits, and what to do next. */
export function HomeScreen() {
  const { api } = useSession();
  const accounts = useAsync(() => api.accounts(), [api]);
  const apps = useAsync(() => api.applications(), [api]);
  const me = useAsync(() => api.me(), [api]);
  const recent = useAsync(() => api.payments(null, 5), [api]);
  const person = me.status === 'success' ? me.data : null;
  const membership = currentMembership(person);
  const bankState = person?.providerState ?? 'NOT_SUBMITTED';
  const company = membership?.companyName ?? undefined;
  return (
    <>
      <PageHeader
        title={person?.legalFirstName ? `Hello, ${person.legalFirstName}` : 'Hello'}
        subtitle={
          <span data-testid="home-company-name">{company ?? "Your company's money at a glance."}</span>
        }
      />
      {apps.status === 'success' && apps.data[0] && apps.data[0].state !== 'ACTIVE' && (
        <Notice
          status="info"
          action={
            <Link className="og-btn og-btn--secondary og-btn--md" to="/onboarding">
              Continue your application
            </Link>
          }
        >
          <span data-testid="home-application">{applicationSentence(apps.data[0].state)}</span>
        </Notice>
      )}
      <Load state={accounts} label="accounts">
        {(list) => {
          const total = list.reduce((s, a) => s + (a.balance?.available.amountMinor ?? 0), 0);
          return (
            <Card title="Available across your accounts" data-testid="home-balance">
              <p className="og-money og-money--xl" data-mask="" data-testid="home-total">
                {formatMinor({ amountMinor: total, currency: list[0]?.currency ?? REGION_CONFIG.currency })}
              </p>
              {list.length > 0 && (
                <ul className="fw-breakdown" data-testid="home-breakdown">
                  {list.map((a) => (
                    <li key={a.id}>
                      <Link className="fw-breakdown__row" to={`/accounts/${a.id}`}>
                        <span className="fw-row__main">
                          <span>{a.name}</span>
                          <span className="fw-row__sub">
                            <AcctLast4 value={a.last4} />
                          </span>
                        </span>
                        {a.balance && <Amt value={a.balance.available} />}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="fw-actions" data-testid="home-actions">
                <Link className="og-btn og-btn--primary og-btn--md" to="/payments/new">
                  New payment
                </Link>
                <Link className="og-btn og-btn--secondary og-btn--md" to="/payments/top-up">
                  Add money
                </Link>
                <Link className="og-btn og-btn--secondary og-btn--md" to="/support/new">
                  Ask for help
                </Link>
              </div>
            </Card>
          );
        }}
      </Load>
      <div className="fw-home-grid" data-testid="home-grid">
        <Card title="Recent payments" data-testid="home-recent">
          <Load state={recent} label="payments">
            {(page) =>
              page.items.length ? (
                <ul className="fw-list">
                  {page.items.map((p) => (
                    <li key={p.id}>
                      <Link className="fw-row" to={`/payments/${p.id}`}>
                        <span className="fw-row__main">
                          <strong>{paymentLabel(p.state)}</strong>
                          <span className="fw-row__sub">{p.createdAt ? formatDate(p.createdAt) : ''}</span>
                        </span>
                        <Amt value={p.amount} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="fw-row__sub">No payments yet.</p>
              )
            }
          </Load>
          <Link className="og-btn og-btn--ghost og-btn--md" to="/payments">
            All payments
          </Link>
        </Card>
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
      </div>
    </>
  );
}
