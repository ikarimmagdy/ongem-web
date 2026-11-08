import { Link } from 'react-router-dom';
import { Card, KeyValue, Notice, PageHeader, StatusChip } from '../design-system';
import { formatDate, formatMinor } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { currentMembership } from '../lib/company';
import { applicationSentence, paymentLabel } from '../lib/states';
import { useSession } from '../session';
import { t } from '../i18n';
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
        title={
          person?.legalFirstName
            ? t('app.home.hello_name', { name: person.legalFirstName })
            : t('app.home.hello')
        }
        subtitle={<span data-testid="home-company-name">{company ?? t('app.home.subtitle')}</span>}
      />
      {apps.status === 'success' && apps.data[0] && apps.data[0].state !== 'ACTIVE' && (
        <Notice
          status="info"
          action={
            <Link className="og-btn og-btn--secondary og-btn--md" to="/onboarding">
              {t('app.home.continue_application')}
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
            <Card title={t('app.home.available')} data-testid="home-balance">
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
                  {t('app.home.new_payment')}
                </Link>
                <Link className="og-btn og-btn--secondary og-btn--md" to="/payments/top-up">
                  {t('app.home.add_money')}
                </Link>
                <Link className="og-btn og-btn--secondary og-btn--md" to="/support/new">
                  {t('app.home.ask_for_help')}
                </Link>
              </div>
            </Card>
          );
        }}
      </Load>
      <div className="fw-home-grid" data-testid="home-grid">
        <Card title={t('app.home.recent_payments')} data-testid="home-recent">
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
                <p className="fw-row__sub">{t('app.home.no_payments')}</p>
              )
            }
          </Load>
          <Link className="og-btn og-btn--ghost og-btn--md" to="/payments">
            {t('app.home.all_payments')}
          </Link>
        </Card>
        {membership && (
          <Card title={t('app.home.your_company')} data-testid="home-company">
            <KeyValue
              items={[
                { label: t('app.home.company'), value: membership.companyName ?? membership.companyId },
                { label: t('app.home.your_role'), value: human(membership.role) },
                {
                  label: t('app.home.identity_at_bank'),
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
