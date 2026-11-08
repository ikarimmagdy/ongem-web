import { dateLocale, getLocale, t, tn } from '../i18n/store';

/**
 * A bank date (2026-12-01) as 1 Dec 2026, read as a calendar day: no time zone can move it to another day. In Arabic
 * the month is named in Arabic, with Latin digits (OG-033 R10).
 */
export function formatDay(day: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? '');
  if (!m) return '';
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (getLocale() === 'ar')
    return new Intl.DateTimeFormat(dateLocale(), {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  const month = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' }).format(date);
  return `${Number(m[3])} ${month} ${m[1]}`;
}

/** How often, in words: Every day, Every 2 weeks, Every month. */
export function frequencyText(frequency: string, interval: number): string {
  const unit = ({ DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month' } as Record<string, string>)[
    frequency.toUpperCase()
  ];
  if (!unit) return t('app.schedules.every_unit', { count: interval, unit: frequency.toLowerCase() });
  return tn(`app.schedules.every_${unit}`, interval);
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
