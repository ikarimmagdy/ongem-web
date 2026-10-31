import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  actions?: ReactNode;
  tone?: 'default' | 'sunken' | 'tint-blue' | 'tint-violet' | 'tint-mint';
}

export function Card({ title, actions, tone = 'default', className, children, ...rest }: CardProps) {
  return (
    <section className={['og-card', `og-card--${tone}`, className].filter(Boolean).join(' ')} {...rest}>
      {(title || actions) && (
        <header className="og-card__header">
          {title && <h2 className="og-card__title">{title}</h2>}
          {actions && <div className="og-card__actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
