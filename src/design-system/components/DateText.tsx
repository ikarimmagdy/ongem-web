import { formatDate } from '../../lib/format';

export function DateText({
  value,
  time = false,
  timeZone,
}: {
  value: string;
  time?: boolean;
  timeZone?: string;
}) {
  return (
    <time className="og-date" dateTime={value}>
      {formatDate(value, { time, timeZone })}
    </time>
  );
}
