import { useState } from 'react';
import { Modal, StatusChip } from './design-system';
import type { Membership } from './api/types';
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
 * company. When a region did not answer, a notice says some companies could not be loaded (R12).
 */
export function CompanySwitcher({
  companies,
  current,
  onPick,
  partial = false,
}: {
  companies: Membership[];
  current: Membership | undefined;
  onPick(companyId: string, region: string | null): void;
  partial?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const name = (m: Membership) => m.companyName ?? t('app.shell.company');
  const regions = new Set(companies.map((m) => m.region).filter(Boolean));
  const manyRegions = regions.size > 1;
  const partialNote = partial && (
    <span className="fw-row__sub" role="status" data-testid="companies-partial">
      {t('app.shell.companies_partial')}
    </span>
  );
  if (companies.length < 2)
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
        {unreadElsewhere > 0 && (
          <span className="fw-bell__count" data-testid="switcher-unread" aria-hidden="true">
            {unreadElsewhere}
          </span>
        )}
        <span aria-hidden="true" className="fw-switcher__chevron" />
      </button>
      {partialNote}
      <Modal open={open} title={t('app.shell.switch_company')} onClose={() => setOpen(false)}>
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
      </Modal>
    </>
  );
}
