import type { ReactNode } from 'react';
import { EmptyState } from '../design-system';

/** The detail column before anything is picked, on wide screens only (UX-17): no empty half page. */
export function SplitHint({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="fw-split__hint" data-testid="split-hint">
      <EmptyState title={title}>{children}</EmptyState>
    </div>
  );
}
