import { NavLink } from 'react-router-dom';
import { Button, PageHeader } from '../design-system';
import { useAsync } from '../lib/useAsync';
import { MORE } from '../nav';
import { t } from '../i18n';
import { useSession } from '../session';

/** More on a phone (OG-035 R8): Support, Team, Documents, Settings, Notifications with the unread count, Sign out. */
export function MoreScreen() {
  const { api, mode, leave } = useSession();
  const inbox = useAsync(() => api.notifications({ unread: true, limit: 1 }), [api]);
  const unread = inbox.status === 'success' ? inbox.data.unread : 0;
  return (
    <>
      <PageHeader title={t('app.more.title')} />
      <nav aria-label={t('app.more.title')}>
        <ul className="fw-list fw-more" data-testid="more-list">
          {MORE.map((n) => (
            <li key={n.to}>
              <NavLink to={n.to} className="fw-row fw-more__row" data-testid={`more-${n.id}`}>
                <span className="fw-row__main">
                  <strong>{n.label}</strong>
                </span>
                {n.id === 'notifications' && unread > 0 && (
                  <span className="fw-bell__count fw-more__count" data-testid="more-unread">
                    {t('app.more.unread', { count: unread })}
                  </span>
                )}
                <span aria-hidden="true" className="fw-more__chevron" />
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="fw-actions">
        <Button variant="secondary" data-testid="more-sign-out" onClick={leave}>
          {mode === 'demo' ? t('app.settings.leave_demo') : t('app.common.sign_out')}
        </Button>
      </div>
    </>
  );
}
