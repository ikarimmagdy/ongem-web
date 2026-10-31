import type { ReactNode } from 'react';

export type Status = 'success' | 'pending' | 'failure' | 'info' | 'neutral';

export function StatusChip({ status, children }: { status: Status; children: ReactNode }) {
  return (
    <span className={`og-chip og-chip--${status}`} data-status={status}>
      <span className="og-chip__dot" aria-hidden="true" />
      {children}
    </span>
  );
}
