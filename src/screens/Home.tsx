import { Link } from 'react-router-dom';
import { Permission } from '../api/client';
import { ApiError } from '../api/errors';
import { Card, EmptyState, PageHeader, StatusChip } from '../design-system';
import { formatDate, formatMinor } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { needsItems } from '../lib/needs';
import { paymentLabel } from '../lib/states';
import { useSession } from '../session';
import { t } from '../i18n';
import { REGION_CONFIG } from '../region';
import { ApplicationSteps } from './ApplicationSteps';
import { NeedsYou } from './NeedsYou';
import { noticeRoute } from './Notifications';
import { payeeName } from './Payments';
import { AcctLast4, Amt, Load, stateStatus } from './common';

/** Payments read once for recent payments and the approvals in Needs you (OG-035 R3, R4). */
export const HOME_PAYMENTS = 20;
const RECENT = 5;

/** A read the role may not make counts as nothing waiting, not as a failure. */
const orNone =
  <T,>(none: T) =>
  (e: unknown): T => {
    if (e instanceof ApiError && e.status === 403) return none;
    throw e;
  };

/**
 * Home (OG-035): the greeting, the application's steps while the account is not open, the balance card (total, accounts,
 * actions), what needs this person and recent payments by payee. Two columns on wide screens (CSS grid); on a phone
 * Needs you sits between the balance card and recent payments.
 */
export function HomeScreen() {
  const { api, can, companyState, mode } = useSession();
  const accounts = useAsync(() => api.accounts(), [api]);
  const apps = useAsync(() => api.applications(), [api]);
  const me = useAsync(() => api.me(), [api]);
  const payments = useAsync(() => api.payments(null, HOME_PAYMENTS), [api]);
  const recipients = useAsync(() => api.recipients().catch(orNone([])), [api]);
  const cards = useAsync(() => api.cards().catch(orNone({ items: [] })), [api]);
  const notices = useAsync(() => api.notifications({ unread: true, limit: 3 }).catch(orNone(null)), [api]);
  const person = me.status === 'success' ? me.data : null;
  const accs = accounts.status === 'success' ? accounts.data : [];
  const recs = recipients.status === 'success' ? recipients.data : [];
  const app = apps.status === 'success' ? apps.data[0] : undefined;
  const reads = [payments, apps, cards, notices];
  const items = needsItems({
    payments: payments.status === 'success' ? payments.data.items : [],
    canApprove: can(Permission.PAYMENT_APPROVE),
    payee: (p) => payeeName(p, accs, recs),
    applicationState: app?.state,
    applicationId: app?.id,
    cards: cards.status === 'success' ? cards.data.items : [],
    notices: notices.status === 'success' && notices.data ? notices.data.items : [],
    noticeTo: noticeRoute,
  });
  const canPay = can(Permission.PAYMENT_CREATE);
  const canAddMoney = can(Permission.PAYMENT_CREATE) && companyState === 'ACTIVE';
  return (
    <>
      <PageHeader
        title={
          person?.legalFirstName
            ? t('app.home.hello_name', { name: person.legalFirstName })
            : t('app.home.hello')
        }
      />
      {app && app.state !== 'ACTIVE' && <ApplicationSteps state={app.state} />}
      <div className="fw-home" data-testid="home-grid">
        <Card
          title={t('app.home.available')}
          className="fw-home__balance fw-hero"
          data-testid="home-balance"
          actions={
            mode === 'demo' ? (
              // FA-057: the same "Sample data" mark as the app's balance card.
              <span className="og-chip og-chip--neutral" data-testid="home-sample">
                {t('app.home.sample_data')}
              </span>
            ) : undefined
          }
        >
          <Load state={accounts} label="accounts">
            {(list) => {
              const total = list.reduce((s, a) => s + (a.balance?.available.amountMinor ?? 0), 0);
              return (
                <>
                  <p className="og-money og-money--xl fw-total" data-mask="" data-testid="home-total">
                    {formatMinor({
                      amountMinor: total,
                      currency: list[0]?.currency ?? REGION_CONFIG.currency,
                    })}
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
                </>
              );
            }}
          </Load>
          <div className="fw-home-actions" data-testid="home-actions">
            {canPay && (
              <Link
                className="og-btn og-btn--primary og-btn--md"
                to="/payments/new"
                data-testid="home-new-payment"
              >
                {t('app.home.new_payment')}
              </Link>
            )}
            {canAddMoney && (
              <Link
                className="og-btn og-btn--secondary og-btn--md"
                to="/payments/top-up"
                data-testid="home-add-money"
              >
                {t('app.home.add_money')}
              </Link>
            )}
            <Link className="og-btn og-btn--secondary og-btn--md" to="/support/new" data-testid="home-help">
              {t('app.home.ask_for_help')}
            </Link>
          </div>
        </Card>
        <div className="fw-home__needs">
          <NeedsYou
            items={items}
            loading={reads.some((r) => r.status === 'loading')}
            failed={reads.some((r) => r.status === 'error')}
            onRetry={() => reads.filter((r) => r.status === 'error').forEach((r) => r.reload())}
          />
        </div>
        {/* OG-040: recent payments as one table (RD-25: no frame inside the card), tabular figures at the end. */}
        <Card
          title={t('app.home.recent_payments')}
          className="fw-home__recent"
          data-testid="home-recent"
          actions={
            <Link className="fw-card-link" to="/payments">
              {t('app.home.all_payments')}
            </Link>
          }
        >
          <Load state={payments} label="payments">
            {(page) =>
              page.items.length ? (
                <table className="og-table fw-recent" data-testid="recent-list">
                  <thead>
                    <tr>
                      <th scope="col">{t('app.accounts.col_counterparty')}</th>
                      <th scope="col">{t('app.payments.detail.status')}</th>
                      <th scope="col">{t('app.accounts.col_date')}</th>
                      <th scope="col" className="og-num">
                        {t('app.accounts.col_amount')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.items.slice(0, RECENT).map((p) => (
                      <tr key={p.id} className="fw-recent__row" data-testid={`recent-${p.id}`}>
                        <td className="fw-recent__payee">
                          <Link className="fw-recent__link fw-row__payee" to={`/payments/${p.id}`}>
                            {payeeName(p, accs, recs)}
                          </Link>
                        </td>
                        <td className="fw-recent__status">
                          <StatusChip status={stateStatus(p.state)}>{paymentLabel(p.state)}</StatusChip>
                        </td>
                        <td className="fw-recent__date">{p.createdAt ? formatDate(p.createdAt) : ''}</td>
                        <td className="og-num fw-recent__amount">
                          <Amt value={p.amount} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState title={t('app.home.no_payments')} />
              )
            }
          </Load>
        </Card>
      </div>
    </>
  );
}
