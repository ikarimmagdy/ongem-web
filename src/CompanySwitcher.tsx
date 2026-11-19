import { useState } from 'react';
import { Button, Modal, Notice, StatusChip } from './design-system';
import type { Membership, MyInvite } from './api/types';
import { errorText } from './api/errors';
import { formatDate } from './lib/format';
import { human } from './screens/common';
import { t } from './i18n';

/** A region's name in the switcher (OG-023 R12). */
export function regionName(region: string | undefined): string {
  return region === 'AE' ? t('app.shell.region.ae') : t('app.shell.region.us');
}

/** The mark of a company that is not ACTIVE (OG-023 R13), or null. */
export function stateMark(m: Membership | undefined): string | null {
  switch (m?.companyState) {
    case 'FROZEN':
      return t('app.shell.company_state.frozen');
    case 'CLOSING':
      return t('app.shell.company_state.closing');
    case 'CLOSED':
      return t('app.shell.company_state.closed');
    default:
      return null;
  }
}

/**
 * The company switcher (G-69, OG-023), the same on web, iOS and Android: a button in the top bar with the current
 * company's name, opening "Switch company" with each company the person is an active member of in either region, its
 * role, region, lifecycle mark and unread notices, and a mark on the current one. Shown only with more than one
 * company. When a region did not answer, a notice says some companies could not be loaded (R12). OG-023 4.5:
 * invitations waiting for the person show as Accept invite rows, so a second company is joined without the link; the
 * switcher shows with one company when an invitation waits.
 */
export function CompanySwitcher({
  companies,
  current,
  onPick,
  partial = false,
  invites = [],
  onAccept,
}: {
  companies: Membership[];
  current: Membership | undefined;
  onPick(companyId: string, region: string | null): void;
  partial?: boolean;
  invites?: MyInvite[];
  onAccept?(invite: MyInvite): Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accept = async (invite: MyInvite) => {
    if (!onAccept || accepting) return;
    setAccepting(invite.id);
    setError(null);
    try {
      await onAccept(invite);
      setOpen(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setAccepting(null);
    }
  };
  const name = (m: Membership) => m.companyName ?? t('app.shell.company');
  const regions = new Set(companies.map((m) => m.region).filter(Boolean));
  const manyRegions = regions.size > 1;
  const partialNote = partial && (
    <span className="fw-row__sub" role="status" data-testid="companies-partial">
      {t('app.shell.companies_partial')}
    </span>
  );
  if (companies.length < 2 && invites.length === 0)
    return (
      <>
        <span className="fw-company">{current?.companyName}</span>
        {partialNote}
      </>
    );
  const currentEntry = companies.find((m) => m.companyId === current?.companyId);
  const unreadElsewhere = companies
    .filter((m) => m.companyId !== current?.companyId)
    .reduce((n, m) => n + (m.unreadNotices ?? 0), 0);
  const currentName = current ? name(current) : t('app.shell.company');
  return (
    <>
      <button
        type="button"
        className="fw-switcher"
        data-testid="company-switcher"
        aria-haspopup="dialog"
        aria-label={t('app.shell.switch_company_label_region', {
          company: currentName,
          region: regionName(currentEntry?.region ?? current?.region),
          unread: String(unreadElsewhere),
        })}
        onClick={() => setOpen(true)}
      >
        <span className="fw-switcher__name">{currentName}</span>
        {invites.length > 0 && (
          <span className="fw-bell__count" data-testid="switcher-invites" aria-hidden="true">
            {invites.length}
          </span>
        )}
        {unreadElsewhere > 0 && (
          <span className="fw-bell__count" data-testid="switcher-unread" aria-hidden="true">
            {unreadElsewhere}
          </span>
        )}
        <span aria-hidden="true" className="fw-switcher__chevron" />
      </button>
      {partialNote}
      <Modal
        open={open}
        title={t('app.shell.switch_company')}
        onClose={() => setOpen(false)}
        closeLabel={t('app.common.close')}
      >
        {partialNote}
        <ul className="fw-list" data-testid="company-options">
          {companies.map((m) => {
            const isCurrent = m.companyId === current?.companyId;
            const mark = stateMark(m);
            const unread = m.unreadNotices ?? 0;
            return (
              <li key={m.companyId}>
                <button
                  type="button"
                  className={isCurrent ? 'fw-row is-active' : 'fw-row'}
                  data-testid={`company-option-${m.companyId}`}
                  data-region={m.region}
                  aria-current={isCurrent ? 'true' : undefined}
                  onClick={() => {
                    setOpen(false);
                    if (!isCurrent) onPick(m.companyId, m.region ?? null);
                  }}
                >
                  <span className="fw-row__main">
                    <span>{name(m)}</span>
                    <span className="fw-row__sub">
                      {human(m.role)}
                      {(manyRegions || m.region === 'AE') && m.region ? ` · ${regionName(m.region)}` : ''}
                    </span>
                  </span>
                  {mark && (
                    <span data-testid={`company-state-${m.companyId}`}>
                      <StatusChip status="neutral">{mark}</StatusChip>
                    </span>
                  )}
                  {unread > 0 && (
                    <span className="fw-row__sub" data-testid={`company-unread-${m.companyId}`}>
                      {t('app.shell.unread', { count: String(unread) })}
                    </span>
                  )}
                  {isCurrent && <span className="fw-row__sub">{t('app.shell.current')}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {invites.length > 0 && (
          <>
            <h3 className="fw-nav__heading">{t('app.shell.invites_waiting')}</h3>
            <ul className="fw-list" data-testid="company-invites">
              {invites.map((i) => (
                <li key={i.id} className="fw-row" data-testid={`company-invite-${i.id}`}>
                  <span className="fw-row__main">
                    <span>{i.companyName}</span>
                    <span className="fw-row__sub">
                      {i.invitedByName
                        ? t('app.shell.invite_by', { name: i.invitedByName, role: human(i.role) })
                        : t('app.shell.invite_role', { role: human(i.role) })}
                    </span>
                    <span className="fw-row__sub">
                      {t('app.shell.invite_expires', { date: formatDate(i.expiresAt) })}
                    </span>
                  </span>
                  <Button
                    variant="secondary"
                    data-testid={`accept-invite-${i.id}`}
                    disabled={accepting !== null}
                    onClick={() => void accept(i)}
                  >
                    {t('app.shell.accept_invite')}
                  </Button>
                </li>
              ))}
            </ul>
            {error && <Notice status="failure">{error}</Notice>}
          </>
        )}
      </Modal>
    </>
  );
}
