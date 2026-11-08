import { t } from '../../i18n/store';

export function Skeleton({ lines = 3, label: given }: { lines?: number; label?: string }) {
  const label = given ?? t('app.ds.loading');
  return (
    <div className="og-skeleton" role="status" aria-label={label} aria-busy="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="og-skeleton__line" />
      ))}
      <span className="og-visually-hidden">{label}</span>
    </div>
  );
}
