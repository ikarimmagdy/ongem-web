import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { errorText } from '../api/errors';
import type { Inbox, NoticeView } from '../api/types';
import { Button, Card, EmptyState, Notice, PageHeader } from '../design-system';
import { formatDate } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { Load } from './common';

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
      return '/accounts';
    case 'onboarding':
      return '/onboarding';
    case 'settings':
      return '/settings';
    default:
      return null;
  }
}

/** The bell in the top bar: the unread count, read again on each page change and after a notice is read. */
export function NoticeBell() {
  const { api } = useSession();
  const location = useLocation();
  const [n, setN] = useState(0);
  useEffect(() => {
    const again = () => setN((x) => x + 1);
    window.addEventListener(NOTICES_CHANGED, again);
    return () => window.removeEventListener(NOTICES_CHANGED, again);
  }, []);
  const inbox = useAsync(() => api.notifications({ unread: true, limit: 1 }), [api, location.pathname, n]);
  const unread = inbox.status === 'success' ? inbox.data.unread : 0;
  const label = unread ? `Notifications, ${unread} unread` : 'Notifications';
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
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
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

function Row({ n, onOpen }: { n: NoticeView; onOpen(n: NoticeView): void }) {
  return (
    <li>
      <button
        className={`fw-row${n.readAt ? '' : ' is-unread'}`}
        data-testid={`notice-${n.id}`}
        onClick={() => onOpen(n)}
      >
        <span className="fw-row__main">
          <strong>
            {!n.readAt && <span className="og-visually-hidden">Unread: </span>}
            {n.title}
          </strong>
          <span>{n.body}</span>
          <span className="fw-row__sub">{formatDate(n.occurredAt, { time: true })}</span>
        </span>
      </button>
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
  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : 'All read'}
        actions={
          <Button
            variant="secondary"
            data-testid="notices-read-all"
            disabled={!unread}
            onClick={() => void once(() => api.readAllNotifications())}
          >
            Mark all read
          </Button>
        }
      />
      {error && <Notice status="failure">{error}</Notice>}
      <Card>
        <Load state={inbox} label="notifications">
          {(box) =>
            box.items.length ? (
              <ul className="fw-list" data-testid="notices-list">
                {box.items.map((x) => (
                  <Row key={x.id} n={x} onOpen={(v) => void open(v)} />
                ))}
              </ul>
            ) : (
              <EmptyState title="No notifications yet">
                We tell you here when a payment moves, a card changes or support replies.
              </EmptyState>
            )
          }
        </Load>
      </Card>
      <p className="fw-row__sub">
        Choose what reaches you by email or SMS in <Link to="/settings">Settings</Link>.
      </p>
    </>
  );
}
