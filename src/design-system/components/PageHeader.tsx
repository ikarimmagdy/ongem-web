import type { ReactNode } from 'react';

export function PageHeader({
  title,
  eyebrow,
  subtitle,
  actions,
  chips,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  chips?: ReactNode;
}) {
  return (
    <header className="og-page-header">
      <div>
        {eyebrow && <p className="og-eyebrow">{eyebrow}</p>}
        <div className="og-page-header__title-row">
          <h1 className="og-page-header__title">{title}</h1>
          {chips && <div className="og-page-header__chips">{chips}</div>}
        </div>
        {subtitle && <p className="og-page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="og-page-header__actions">{actions}</div>}
    </header>
  );
}
