import type { ReactNode } from 'react';
import type { Status } from './StatusChip';

export function Notice({
  status = 'info',
  children,
  action,
}: {
  status?: Status;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`og-notice og-notice--${status}`} role={status === 'failure' ? 'alert' : 'status'}>
      <div className="og-notice__text">{children}</div>
      {action && <div className="og-notice__action">{action}</div>}
    </div>
  );
}
