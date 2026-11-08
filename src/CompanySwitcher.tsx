import { useState } from 'react';
import { Modal } from './design-system';
import type { Membership } from './api/types';
import { human } from './screens/common';
import { t } from './i18n';

/**
 * The company switcher (G-69), the same on web, iOS and Android: a button in the top bar with the current company's
 * name, opening "Switch company" with each company the person is an active member of, its role and a mark on the
 * current one. Shown only with more than one company.
 */
export function CompanySwitcher({
  companies,
  current,
  onPick,
}: {
  companies: Membership[];
  current: Membership | undefined;
  onPick(companyId: string): void;
}) {
  const [open, setOpen] = useState(false);
  if (companies.length < 2) return <span className="fw-company">{current?.companyName}</span>;
  const name = (m: Membership) => m.companyName ?? t('app.shell.company');
  return (
    <>
      <button
        type="button"
        className="fw-switcher"
        data-testid="company-switcher"
        aria-haspopup="dialog"
        aria-label={t('app.shell.switch_company_label', {
          company: current ? name(current) : t('app.shell.company'),
        })}
        onClick={() => setOpen(true)}
      >
        <span className="fw-switcher__name">{current ? name(current) : t('app.shell.company')}</span>
        <span aria-hidden="true" className="fw-switcher__chevron" />
      </button>
      <Modal open={open} title={t('app.shell.switch_company')} onClose={() => setOpen(false)}>
        <ul className="fw-list" data-testid="company-options">
          {companies.map((m) => {
            const isCurrent = m.companyId === current?.companyId;
            return (
              <li key={m.companyId}>
                <button
                  type="button"
                  className={isCurrent ? 'fw-row is-active' : 'fw-row'}
                  data-testid={`company-option-${m.companyId}`}
                  aria-current={isCurrent ? 'true' : undefined}
                  onClick={() => {
                    setOpen(false);
                    if (!isCurrent) onPick(m.companyId);
                  }}
                >
                  <span className="fw-row__main">
                    <span>{name(m)}</span>
                    <span className="fw-row__sub">{human(m.role)}</span>
                  </span>
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
