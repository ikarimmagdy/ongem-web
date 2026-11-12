import { Link } from 'react-router-dom';
import { Button, Card, EmptyState, Notice, Skeleton } from '../design-system';
import { formatMinor } from '../lib/format';
import type { NeedItem } from '../lib/needs';
import { t } from '../i18n';

function text(item: NeedItem): string {
  switch (item.kind) {
    case 'approval':
      return t('app.home.needs.approval', { amount: formatMinor(item.amount), payee: item.payee });
    case 'application':
      return t('app.home.needs.application', { step: t(`app.home.steps.${item.step}`) });
    case 'card':
      return item.state === 'FROZEN'
        ? t('app.home.needs.card_frozen', { last4: item.last4 })
        : t('app.home.needs.card_pending', { last4: item.last4 });
    case 'notice':
      return item.title;
  }
}

/** FA-026: each action says its outcome. */
function action(item: NeedItem): string {
  switch (item.kind) {
    case 'approval':
      return t('app.home.needs.review');
    case 'application':
      return t('app.home.needs.continue');
    case 'card':
      return item.state === 'FROZEN' ? t('app.home.needs.unfreeze') : t('app.home.needs.activate');
    case 'notice':
      return t('app.home.needs.read');
  }
}

/** OG-040: the order is the priority (lib/needs.ts); the mark says how urgent: money waiting, then a step, then news. */
const TONE: Record<NeedItem['kind'], string> = {
  approval: 'urgent',
  application: 'step',
  card: 'step',
  notice: 'news',
};

/**
 * What waits on this person (OG-035 R3), each with one action. Shows what loaded; a read that failed leaves an error line
 * with Try again, and nothing waiting says so.
 */
export function NeedsYou({
  items,
  loading,
  failed,
  onRetry,
}: {
  items: NeedItem[];
  loading: boolean;
  failed: boolean;
  onRetry(): void;
}) {
  return (
    <Card
      title={t('app.home.needs.title')}
      className="fw-needs"
      data-testid="home-needs"
      actions={
        items.length > 0 ? (
          <span className="fw-needs__count" aria-hidden="true">
            {items.length}
          </span>
        ) : undefined
      }
    >
      {items.length > 0 && (
        <ul className="fw-needs__list" data-testid="needs-list">
          {items.map((item) => (
            <li
              key={`${item.kind}-${item.id}`}
              className={`fw-needs__item fw-needs__item--${TONE[item.kind]}`}
              data-testid={`need-${item.kind}-${item.id}`}
            >
              <span className="fw-needs__mark" aria-hidden="true" />
              <span
                className="fw-needs__text"
                data-mask={item.kind === 'approval' || item.kind === 'card' ? '' : undefined}
              >
                {text(item)}
              </span>
              <Link
                className="og-btn og-btn--secondary og-btn--sm fw-needs__action"
                to={item.to}
                data-testid={`need-action-${item.kind}-${item.id}`}
              >
                {action(item)}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {loading && <Skeleton label={t('app.home.needs.loading')} />}
      {failed && (
        <Notice
          status="failure"
          action={
            <Button variant="secondary" size="sm" onClick={onRetry} data-testid="needs-retry">
              {t('app.common.try_again')}
            </Button>
          }
        >
          <span data-testid="needs-error">{t('app.home.needs.error')}</span>
        </Notice>
      )}
      {!loading && !failed && items.length === 0 && (
        <div data-testid="needs-empty">
          <EmptyState title={t('app.home.needs.empty')}>{t('app.home.needs.empty_text')}</EmptyState>
        </div>
      )}
    </Card>
  );
}
