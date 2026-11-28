import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { errorText } from '../api/errors';
import type { Inbox, NoticeView } from '../api/types';
import { Button, Card, EmptyState, Notice, PageHeader } from '../design-system';
import { formatDate } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { FilterChips, Load } from './common';
import { categoryLabel } from './NotificationChoices';
import { T, t, tn } from '../i18n';

/** Fired after a notice is read, so the bell counts again without a page change. */
export const NOTICES_CHANGED = 'og:notices-changed';

/**
 * The screen a notice's link names (ongem-core Templates: `payments/<id>`, `payments/<id>/approve`,
 * `payment-schedules/<id>`, `cards/<id>`, `support/<id>`, `settings/devices` ...), as a route of this app; null when
 * it names nothing here.
 */
export function noticeRoute(link: string | null): string | null {
  if (!link) return null;
  const [head, id] = link.replace(/^\/+/, '').split('/');
  switch (head) {
    case 'payments':
      return !id || id === 'limits' ? '/payments' : `/payments/${encodeURIComponent(id)}`;
    case 'payment-schedules':
      return '/payments/schedules';
    case 'cards':
      return id ? `/cards/${encodeURIComponent(id)}` : '/cards';
    case 'support':
      return id ? `/support/${encodeURIComponent(id)}` : '/support';
    case 'accounts':
      return id ? `/accounts/${encodeURIComponent(id)}` : '/accounts';
    case 'movements':
      return id ? `/payments/movements/${encodeURIComponent(id)}` : '/payments/international';
    case 'get-paid':
      return '/get-paid';
    case 'spend': {
      // OG-087: `spend/expenses/<id>`, `spend/me/expenses/<id>`, `spend/policy`.
      const path = link.replace(/^\/+/, '');
      return /^spend(\/(me\/)?expenses\/[\w-]+|\/me|\/policy)?$/.test(path) ? `/${path}` : '/spend';
    }
    case 'team':
      return '/team';
    case 'onboarding':
      return '/onboarding';
    case 'settings':
      return '/settings';
    default:
      return null;
  }
}

const BELL = 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9'; // content-check: ignore (SVG path)

/**
 * The bell in the top bar: the unread count (GET /v1/notifications/unread-count), read again on each page change, when
 * the window gets focus and after a notice is read.
 */
export function NoticeBell() {
  const { api } = useSession();
  const location = useLocation();
  const [n, setN] = useState(0);
  useEffect(() => {
    const again = () => setN((x) => x + 1);
    window.addEventListener(NOTICES_CHANGED, again);
    window.addEventListener('focus', again);
    return () => {
      window.removeEventListener(NOTICES_CHANGED, again);
      window.removeEventListener('focus', again);
    };
  }, []);
  const count = useAsync(() => api.unreadCount(), [api, location.pathname, n]);
  const unread = count.status === 'success' ? count.data : 0;
  const label = unread ? t('app.notifications.bell_unread', { count: unread }) : t('app.notifications.title');
  return (
    <Link to="/notifications" className="fw-bell" aria-label={label} data-testid="notice-bell">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d={BELL} />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread > 0 && (
        <span className="fw-bell__count" data-testid="notice-bell-count">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}

function Row({
  n,
  onOpen,
  onRead,
}: {
  n: NoticeView;
  onOpen(n: NoticeView): void;
  onRead(n: NoticeView): void;
}) {
  return (
    <li className="fw-notice">
      <button
        className={`fw-row${n.readAt ? '' : ' is-unread'}`}
        data-testid={`notice-${n.id}`}
        onClick={() => onOpen(n)}
      >
        <span className="fw-row__main">
          <strong>
            {!n.readAt && <span className="og-visually-hidden">{t('app.notifications.unread_prefix')} </span>}
            {n.title}
          </strong>
          <span>{n.body}</span>
          <span className="fw-row__sub">
            {n.category ? `${categoryLabel(n.category)} · ` : ''}
            {formatDate(n.occurredAt, { time: true })}
          </span>
        </span>
      </button>
      {!n.readAt && (
        <Button
          variant="ghost"
          data-testid={`notice-read-${n.id}`}
          aria-label={t('app.notifications.mark_read_label', { title: n.title })}
          onClick={() => onRead(n)}
        >
          {t('app.notifications.mark_read')}
        </Button>
      )}
    </li>
  );
}

/** OG-014 inbox (M-3-R31): newest first, read when opened, then the screen the notice is about. */
export function NotificationsScreen() {
  const { api } = useSession();
  const navigate = useNavigate();
  const [n, setN] = useState(0);
  const inbox = useAsync(() => api.notifications(), [api, n]);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const once = async (f: () => Promise<Inbox>) => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setError(null);
    try {
      const r = await f();
      window.dispatchEvent(new Event(NOTICES_CHANGED));
      setN((x) => x + 1);
      return r;
    } catch (e) {
      setError(errorText(e));
      return null;
    } finally {
      inFlight.current = false;
    }
  };
  const open = async (notice: NoticeView) => {
    if (!notice.readAt) await once(() => api.readNotification(notice.id));
    const to = noticeRoute(notice.link);
    if (to) navigate(to);
  };
  const unread = inbox.status === 'success' ? inbox.data.unread : 0;
  // OG-014: one category at a time, from the categories the inbox holds.
  const [category, setCategory] = useState('all');
  const categories =
    inbox.status === 'success'
      ? [...new Set(inbox.data.items.map((x) => x.category).filter((c): c is string => !!c))]
      : [];
  return (
    <>
      <PageHeader
        title={t('app.notifications.title')}
        subtitle={unread ? tn('app.notifications.unread', unread) : t('app.notifications.all_read')}
        actions={
          <Button
            variant="secondary"
            data-testid="notices-read-all"
            disabled={!unread}
            onClick={() => void once(() => api.readAllNotifications())}
          >
            {t('app.notifications.mark_all_read')}
          </Button>
        }
      />
      {error && <Notice status="failure">{error}</Notice>}
      {categories.length > 1 && (
        <FilterChips
          label={t('app.notifications.filter_label')}
          testId="notice-filter"
          value={category}
          onChange={setCategory}
          options={[
            { id: 'all', label: t('app.notifications.filter_all') },
            ...categories.map((c) => ({ id: c, label: categoryLabel(c) })),
          ]}
        />
      )}
      <Card>
        <Load state={inbox} label="notifications">
          {(box) => {
            const shown = box.items.filter((x) => category === 'all' || x.category === category);
            return shown.length ? (
              <ul className="fw-list" data-testid="notices-list">
                {shown.map((x) => (
                  <Row
                    key={x.id}
                    n={x}
                    onOpen={(v) => void open(v)}
                    onRead={(v) => void once(() => api.readNotification(v.id))}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState title={t('app.notifications.empty_title')}>
                {t('app.notifications.empty_text')}
              </EmptyState>
            );
          }}
        </Load>
      </Card>
      <p className="fw-row__sub">
        <T
          k="app.notifications.choose"
          vars={{ settings: <Link to="/settings">{t('app.nav.settings')}</Link> }}
        />
      </p>
    </>
  );
}
