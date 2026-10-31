import type { ReactNode } from 'react';
import type { Status } from './StatusChip';

export interface StepItem {
  id: string;
  label: ReactNode;
  /** The step's state in words, always shown, so colour is never the only signal. */
  statusText: string;
  status: Status;
  current?: boolean;
  meta?: ReactNode;
  detail?: ReactNode;
}

/** A vertical timeline of steps: marker, label, status in words, time and detail. */
export function Stepper({ items, label }: { items: StepItem[]; label: string }) {
  return (
    <ol className="og-steps" aria-label={label}>
      {items.map((s) => (
        <li
          key={s.id}
          className={`og-steps__item og-steps__item--${s.status}`}
          aria-current={s.current ? 'step' : undefined}
          data-step={s.id}
        >
          <span className="og-steps__marker" aria-hidden="true" />
          <div className="og-steps__body">
            <div className="og-steps__head">
              <span className="og-steps__label">{s.label}</span>
              <span className={`og-chip og-chip--${s.status}`} data-status={s.status}>
                <span className="og-chip__dot" aria-hidden="true" />
                {s.statusText}
              </span>
            </div>
            {s.meta && <div className="og-steps__meta">{s.meta}</div>}
            {s.detail && <div className="og-steps__detail">{s.detail}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
