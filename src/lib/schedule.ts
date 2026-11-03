const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A bank date (2026-12-01) as 1 Dec 2026, read as a calendar day: no time zone can move it to another day. */
export function formatDay(day: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? '');
  if (!m) return '';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** How often, in words: Every day, Every 2 weeks, Every month. */
export function frequencyText(frequency: string, interval: number): string {
  const unit =
    { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month' }[frequency.toUpperCase()] ?? frequency.toLowerCase();
  return interval > 1 ? `Every ${interval} ${unit}s` : `Every ${unit}`;
}

/**
 * The run after [day]: days and weeks add up; a month keeps the start's day of the month, or the month's last day when
 * it has fewer days (31 Jan, 28 Feb, 31 Mar), as ongem-core's ScheduleCalendar does.
 */
export function nthRun(start: string, frequency: string, interval: number, n: number): string {
  const [y, mo, d] = start.split('-').map(Number) as [number, number, number];
  if (frequency.toUpperCase() === 'MONTHLY') {
    const months = mo - 1 + interval * n;
    const year = y + Math.floor(months / 12);
    const month = months % 12;
    const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return iso(new Date(Date.UTC(year, month, Math.min(d, last))));
  }
  const days = (frequency.toUpperCase() === 'WEEKLY' ? 7 : 1) * interval * n;
  return iso(new Date(Date.UTC(y, mo - 1, d + days)));
}

/** Today in the browser's calendar, as a bank date. */
export function today(now: Date = new Date()): string {
  return iso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
