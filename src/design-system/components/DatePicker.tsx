import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
} from 'react';
import { useAnchor } from './useAnchor';
import { useDismiss } from './useDismiss';

export interface DatePickerLabels {
  /** Shown on the button while no day is chosen. */
  choose: string;
  previousMonth: string;
  nextMonth: string;
}

export interface DatePickerProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'value' | 'onChange' | 'type'
> {
  /** A calendar day as YYYY-MM-DD, or blank. */
  value: string;
  onChange(day: string): void;
  /** The chosen day in words, as the app writes dates (1 Dec 2026). */
  format(day: string): string;
  labels: DatePickerLabels;
  /** BCP 47 locale for the month and weekday names. */
  locale: string;
  /** First day of the week, 0 Sunday to 6 Saturday. */
  weekStart?: number;
  /** The day the calendar opens on when no day is chosen (today). */
  today: string;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const toDate = (day: string) => {
  const m = DAY.exec(day);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => {
  const d = toDate(day)!;
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
/** The same day [n] months on, or that month's last day when it is shorter. */
const addMonths = (day: string, n: number) => {
  const d = toDate(day)!;
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), last));
  return iso(target);
};

/** Six weeks of days around [day]'s month, starting on [weekStart]. */
function monthGrid(day: string, weekStart: number): string[][] {
  const d = toDate(day)!;
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const lead = (first.getUTCDay() - weekStart + 7) % 7;
  const start = iso(new Date(first.getTime() - lead * 86_400_000));
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)));
}

/**
 * OG-050: the one date picker, drawn from the theme instead of the browser's own calendar. The button names the chosen
 * day; it opens a calendar (WAI-ARIA APG date picker dialog): Arrow keys move by day and week (mirrored right to left),
 * Home and End to the week's ends, Page Up and Page Down by month (with Shift, by year), Enter or Space chooses, Escape
 * closes and returns to the button. Days are calendar days: no time zone can move one.
 */
export const DatePicker = forwardRef<HTMLButtonElement, DatePickerProps>(function DatePicker(
  { value, onChange, format, labels, locale, weekStart = 0, today, className, disabled, id: idProp, ...rest },
  ref,
) {
  const ownId = useId();
  const id = idProp ?? ownId;
  const panelId = `${id}-calendar`;
  const titleId = `${id}-month`;
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLTableElement>(null);
  useImperativeHandle(ref, () => button.current!);
  const valid = DAY.test(value);
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(valid ? value : today);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, root, button);
  useAnchor(open, button, panel, false);

  useEffect(() => {
    if (open) grid.current?.querySelector<HTMLElement>(`[data-day="${focus}"]`)?.focus();
  }, [open, focus]);

  const show = () => {
    setFocus(valid ? value : today);
    setOpen(true);
  };
  const pick = (day: string) => {
    setOpen(false);
    button.current?.focus();
    if (day !== value) onChange(day);
  };

  const keys = (e: KeyboardEvent<HTMLTableElement>) => {
    const rtl = e.currentTarget.closest('[dir]')?.getAttribute('dir') === 'rtl';
    const weekday = (toDate(focus)!.getUTCDay() - weekStart + 7) % 7;
    const move: Record<string, () => string> = {
      ArrowLeft: () => addDays(focus, rtl ? 1 : -1),
      ArrowRight: () => addDays(focus, rtl ? -1 : 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      Home: () => addDays(focus, -weekday),
      End: () => addDays(focus, 6 - weekday),
      PageUp: () => addMonths(focus, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focus, e.shiftKey ? 12 : 1),
    };
    if (move[e.key]) {
      e.preventDefault();
      setFocus(move[e.key]!());
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(focus);
    }
  };

  const monthName = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'long', year: 'numeric' });
  // Arabic short weekday names are whole words that do not fit a day's column; the narrow form is one letter.
  const dayName = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    weekday: locale.startsWith('ar') ? 'narrow' : 'short',
  });
  const dayFull = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'long' });
  const dayLong = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const dayNumber = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', day: 'numeric' });
  const weeks = monthGrid(focus, weekStart);
  const month = toDate(focus)!.getUTCMonth();

  return (
    <div
      className="og-select og-date"
      ref={root}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (open && next && !root.current?.contains(next)) close();
      }}
    >
      <button
        ref={button}
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        data-value={value}
        disabled={disabled}
        className={['og-input', 'og-select__button', className].filter(Boolean).join(' ')}
        onClick={() => (open ? setOpen(false) : show())}
        {...rest}
      >
        <span className={valid ? 'og-select__value' : 'og-select__value og-date__placeholder'}>
          {valid ? format(value) : labels.choose}
        </span>
        <svg className="og-select__chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
          <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
        </svg>
      </button>
      {open && (
        <div
          ref={panel}
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className="og-select__list og-date__panel"
        >
          <div className="og-date__head">
            <button
              type="button"
              className="og-date__nav"
              aria-label={labels.previousMonth}
              data-testid="date-previous-month"
              onClick={() => setFocus(addMonths(focus, -1))}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M10 4l-4 4 4 4" />
              </svg>
            </button>
            <p className="og-date__title" id={titleId} aria-live="polite">
              {monthName.format(toDate(focus)!)}
            </p>
            <button
              type="button"
              className="og-date__nav"
              aria-label={labels.nextMonth}
              data-testid="date-next-month"
              onClick={() => setFocus(addMonths(focus, 1))}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M6 4l4 4-4 4" />
              </svg>
            </button>
          </div>
          <table ref={grid} role="grid" aria-labelledby={titleId} className="og-date__grid" onKeyDown={keys}>
            <thead>
              <tr>
                {weeks[0]!.map((d) => (
                  <th key={d} scope="col" abbr={dayFull.format(toDate(d)!)}>
                    {dayName.format(toDate(d)!)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w[0]}>
                  {w.map((d) => {
                    const outside = toDate(d)!.getUTCMonth() !== month;
                    const cls = ['og-date__day', outside && 'is-outside', d === today && 'is-today']
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <td key={d} aria-selected={d === value}>
                        <button
                          type="button"
                          className={cls}
                          data-day={d}
                          tabIndex={d === focus ? 0 : -1}
                          aria-current={d === today ? 'date' : undefined}
                          aria-label={dayLong.format(toDate(d)!)}
                          onClick={() => pick(d)}
                        >
                          {dayNumber.format(toDate(d)!)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});
