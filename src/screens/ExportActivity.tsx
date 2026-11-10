import { useEffect, useRef, useState } from 'react';
import { Permission } from '../api/client';
import { ApiError, errorText } from '../api/errors';
import type { ExportRun } from '../api/types';
import { Button, Card, Field, Input, Notice, Select, StatusChip } from '../design-system';
import { t } from '../i18n';
import { formatDate } from '../lib/format';
import { useSession } from '../session';
import { stateStatus } from './common';

/** How often a run being prepared is read again; tests shorten it. */
export const exportTiming = { pollMs: 2000 };

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** The last full calendar month before [today], YYYY-MM. */
export function lastFullMonth(today: Date = new Date()): string {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}

/** The same rule as ongem-core (R1): an end not before the start, not after today, at most 366 days. */
export function periodValid(from: string, to: string, today: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return false;
  if (to < from || to > isoDay(today)) return false;
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
  return days <= 366;
}

function refusedText(reason: string | null) {
  return reason === 'statement_mismatch'
    ? t('app.exports.refused_statement_mismatch')
    : t('app.exports.refused_other');
}

/** One run's state: Preparing, Ready with the download, Refused or Failed. The title is announced when it changes. */
function RunState({ run, onLink }: { run: ExportRun; onLink: () => void }) {
  const title =
    run.state === 'DONE'
      ? t('app.exports.ready')
      : run.state === 'REFUSED'
        ? t('app.exports.refused')
        : run.state === 'FAILED'
          ? t('app.exports.state.failed')
          : t('app.exports.preparing');
  return (
    <div className="fw-thread" data-testid={`export-run-${run.state.toLowerCase()}`}>
      <p role="status" aria-live="polite" data-testid="export-state">
        <strong>{title}</strong>
      </p>
      {(run.state === 'QUEUED' || run.state === 'RUNNING') && (
        <p>
          {run.cutoffAt
            ? t('app.exports.preparing_cutoff', { time: formatDate(run.cutoffAt, { time: true }) })
            : t('app.exports.preparing_text')}
        </p>
      )}
      {run.state === 'DONE' && (
        <>
          <p>
            {t('app.exports.ready_text', {
              lines: run.lineCount ?? 0,
              from: formatDate(run.from),
              to: formatDate(run.to),
            })}
          </p>
          {run.link ? (
            <>
              <a
                className="og-btn og-btn--primary og-btn--md"
                href={run.link.url}
                download={run.fileName ?? undefined}
                data-testid="export-download"
              >
                {t('app.exports.download', { file: run.fileName ?? '' })}
              </a>
              <p className="fw-row__sub">
                {t('app.exports.link_expires', { time: formatDate(run.link.expiresAt, { time: true }) })}
              </p>
            </>
          ) : null}
          <Button variant="secondary" data-testid="export-link-again" onClick={onLink}>
            {t('app.exports.link_again')}
          </Button>
        </>
      )}
      {run.state === 'REFUSED' && <Notice status="failure">{refusedText(run.reason)}</Notice>}
      {run.state === 'FAILED' && <Notice status="failure">{t('app.exports.failed')}</Notice>}
    </div>
  );
}

/**
 * OG-024 R16: Export activity on the account screen. A member with `export:create` (an owner) picks a period (last full
 * month by default, or dates) and a format and confirms; the run is prepared in the background and read again until it
 * is Ready, Refused or Failed. A member without the permission sees why instead of the form.
 */
export function ExportActivity({ accountId }: { accountId: string }) {
  const { api, can } = useSession();
  const allowed = can(Permission.EXPORT_CREATE);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'month' | 'range'>('month');
  const month = lastFullMonth();
  const [from, setFrom] = useState(`${month}-01`);
  const [to, setTo] = useState(isoDay(new Date()));
  const [format, setFormat] = useState('CSV');
  const [dateError, setDateError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<ExportRun | null>(null);
  const [recent, setRecent] = useState<ExportRun[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!allowed) return;
    api.exports(accountId).then(setRecent, () => setRecent([]));
  }, [api, accountId, allowed]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const follow = (r: ExportRun) => {
    setRun(r);
    if (r.state === 'QUEUED' || r.state === 'RUNNING') {
      timer.current = setTimeout(() => {
        api.exportRun(accountId, r.id).then(follow, (e: unknown) => setError(errorText(e)));
      }, exportTiming.pollMs);
    } else {
      api.exports(accountId).then(setRecent, () => undefined);
    }
  };

  if (!allowed) {
    return (
      <Card title={t('app.exports.title')}>
        <p data-testid="export-no-permission">{t('app.exports.no_permission')}</p>
      </Card>
    );
  }

  const submit = () => {
    setError(null);
    if (mode === 'range' && !periodValid(from, to)) {
      setDateError(true);
      return;
    }
    setDateError(false);
    const request = mode === 'month' ? { month, format } : { from, to, format };
    api.requestExport(accountId, request).then(
      (r) => {
        setOpen(false);
        follow(r);
      },
      (e: unknown) => {
        if (e instanceof ApiError && e.code === 'period_invalid') setDateError(true);
        else if (e instanceof ApiError && e.code === 'format_unavailable')
          setError(t('app.exports.error.format_unavailable'));
        else setError(errorText(e));
      },
    );
  };

  const fresh = () => {
    if (!run) return;
    api.exportLink(accountId, run.id).then(
      (link) => setRun({ ...run, link }),
      (e: unknown) => setError(errorText(e)),
    );
  };

  return (
    <Card title={t('app.exports.title')}>
      <div className="fw-thread" data-testid="export-activity">
        <p>{t('app.exports.intro')}</p>
        {!open && (
          <Button data-testid="export-start" onClick={() => setOpen(true)}>
            {t('app.exports.start')}
          </Button>
        )}
        {open && (
          <form
            className="fw-thread"
            data-testid="export-form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Field label={t('app.exports.period')}>
              <Select
                data-testid="export-period"
                value={mode}
                onChange={(e) => setMode(e.target.value as 'month' | 'range')}
                options={[
                  { value: 'month', label: t('app.exports.period_last_month', { month }) },
                  { value: 'range', label: t('app.exports.period_custom') },
                ]}
              />
            </Field>
            {mode === 'range' && (
              <>
                <Field
                  label={t('app.exports.from')}
                  error={dateError ? t('app.exports.error.period_invalid') : undefined}
                >
                  <Input
                    type="date"
                    data-testid="export-from"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </Field>
                <Field label={t('app.exports.to')}>
                  <Input
                    type="date"
                    data-testid="export-to"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </Field>
              </>
            )}
            {mode === 'month' && dateError && (
              <Notice status="failure">{t('app.exports.error.period_invalid')}</Notice>
            )}
            <Field label={t('app.exports.format')}>
              <Select
                data-testid="export-format"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                options={[{ value: 'CSV', label: t('app.exports.format_csv') }]}
              />
            </Field>
            <div className="fw-row">
              <Button type="submit" data-testid="export-confirm">
                {t('app.exports.confirm')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t('app.exports.cancel')}
              </Button>
            </div>
          </form>
        )}
        {error && <Notice status="failure">{error}</Notice>}
        {run && <RunState run={run} onLink={fresh} />}
        <h3>{t('app.exports.recent')}</h3>
        {recent.length ? (
          <ul className="fw-list" data-testid="export-recent">
            {recent.map((r) => (
              <li key={r.id}>
                <button
                  className="fw-row"
                  data-testid={`export-open-${r.id}`}
                  onClick={() =>
                    api.exportRun(accountId, r.id).then(follow, (e: unknown) => setError(errorText(e)))
                  }
                >
                  <span className="fw-row__main">
                    {t('app.exports.row', { from: formatDate(r.from), to: formatDate(r.to) })}
                  </span>
                  <StatusChip status={stateStatus(r.state === 'DONE' ? 'SETTLED' : r.state)}>
                    {t(`app.exports.state.${r.state.toLowerCase()}`)}
                  </StatusChip>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('app.exports.no_recent')}</p>
        )}
      </div>
    </Card>
  );
}
