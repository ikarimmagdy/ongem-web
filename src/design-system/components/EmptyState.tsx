import type { ReactNode } from 'react';
import { CategoryIcon, type Category } from './CategoryIcon';

export function EmptyState({
  title,
  children,
  category,
  action,
}: {
  title: ReactNode;
  children?: ReactNode;
  category?: Category;
  action?: ReactNode;
}) {
  return (
    <div className="og-empty">
      {category && <CategoryIcon category={category} />}
      <p className="og-empty__title">{title}</p>
      {children && <div className="og-empty__body">{children}</div>}
      {action}
    </div>
  );
}
