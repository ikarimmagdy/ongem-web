export function Skeleton({ lines = 3, label = 'Loading' }: { lines?: number; label?: string }) {
  return (
    <div className="og-skeleton" role="status" aria-label={label} aria-busy="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="og-skeleton__line" />
      ))}
      <span className="og-visually-hidden">{label}</span>
    </div>
  );
}
