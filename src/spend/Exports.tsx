import { useState } from 'react';
import { Button, Card, EmptyState, Field, KeyValue, Notice, Select, useToast } from '../design-system';
import { t } from '../i18n';
import { formatBankDate, formatDate, formatMinor } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { DateInput, Load } from '../screens/common';
import { lastFullMonth } from '../screens/ExportActivity';
import { spendOf, type ExportView } from './api';
import { excludedLabel, formatName, isCode, spendErrorText } from './common';

/** The contract's rule (422 period_invalid): the end not before the start, at most 366 days. */
export function spendPeriodValid(from: string, to: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return false;
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1 <= 366;
}

const monthEnd = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
};

/** One export: its lines, total, what it left out and why, and the short-lived download link. */
function ExportResult({ x, onFresh }: { x: ExportView; onFresh(): void }) {
  return (
    <div className="fw-thread" data-testid="spend-export-result">
      <p role="status" aria-live="polite">
        <strong>
          {t('app.spend.exports.result', {
            lines: x.lineCount,
            from: formatBankDate(x.from),
            to: formatBankDate(x.to),
          })}
        </strong>
      </p>
      <KeyValue
        items={[
          { label: t('app.spend.exports.format'), value: formatName(x.format) },
          { label: t('app.spend.exports.total'), value: <span data-mask="">{formatMinor(x.total)}</span> },
        ]}
      />
      {x.excluded.length > 0 && (
        <ul className="fw-list" data-testid="spend-export-excluded">
          {x.excluded.map((e) => (
            <li key={e.reason} className="fw-row">
              <span className="fw-row__main">
                {t('app.spend.exports.excluded_line', {
                  count: e.count,
                  amount: formatMinor(e.amount),
                  reason: excludedLabel(e.reason),
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
      {x.downloadUrl ? (
        <>
          <a
            className="og-btn og-btn--primary og-btn--md"
            href={x.downloadUrl}
            download={x.fileName}
            data-testid="spend-export-download"
          >
            {t('app.spend.exports.download', { file: x.fileName })}
          </a>
          {x.downloadExpiresAt && (
            <p className="fw-row__sub">
              {t('app.spend.exports.link_expires', { time: formatDate(x.downloadExpiresAt, { time: true }) })}
            </p>
          )}
        </>
      ) : x.lineCount === 0 ? (
        <Notice status="info">
          <span data-testid="spend-export-empty">{t('app.spend.exports.no_lines')}</span>
        </Notice>
      ) : (
        <Button variant="secondary" data-testid="spend-export-fresh" onClick={onFresh}>
          {t('app.spend.exports.fresh_link')}
        </Button>
      )}
    </div>
  );
}

/** Finance (spend:export): approved expenses of a period, once each, in a format the programme offers. */
export function ExportsScreen() {
  const { api } = useSession();
  const spend = spendOf(api);
  const toast = useToast();
  const month = lastFullMonth();
  const [from, setFrom] = useState(`${month}-01`);
  const [to, setTo] = useState(monthEnd(month));
  const [format, setFormat] = useState('');
  const [dateError, setDateError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<ExportView | null>(null);
  const settings = useAsync(() => spend.settings(), [api]);
  const list = useAsync(() => spend.exports(), [api]);
  const formats = settings.status === 'success' ? settings.data.exportFormats : [];
  const chosen = format || formats[0] || '';
  const open = (id: string) =>
    spend.exportOne(id).then(setShown, (e: unknown) => setError(spendErrorText(e)));
  return (
    <>
      <Card title={t('app.spend.exports.title')}>
        <form
          className="fw-thread"
          data-testid="spend-export-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            if (!spendPeriodValid(from, to)) return setDateError(true);
            setDateError(false);
            setBusy(true);
            try {
              const x = await spend.createExport({ from, to, format: chosen });
              setShown(x);
              toast.show(t('app.spend.exports.created'), 'success');
              list.reload();
            } catch (err) {
              if (isCode(err, 'period_invalid')) setDateError(true);
              else setError(spendErrorText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>{t('app.spend.exports.intro')}</p>
          <Field
            label={t('app.spend.exports.from')}
            error={dateError ? t('app.spend.error.period_invalid') : undefined}
          >
            <DateInput data-testid="spend-export-from" value={from} onChange={setFrom} />
          </Field>
          <Field label={t('app.spend.exports.to')}>
            <DateInput data-testid="spend-export-to" value={to} onChange={setTo} />
          </Field>
          <Load state={settings} label="spend exports">
            {() =>
              formats.length ? (
                <Field label={t('app.spend.exports.format')}>
                  <Select
                    data-testid="spend-export-format"
                    value={chosen}
                    onChange={setFormat}
                    options={formats.map((f) => ({ value: f, label: formatName(f) }))}
                  />
                </Field>
              ) : (
                <Notice status="info">{t('app.spend.exports.no_formats')}</Notice>
              )
            }
          </Load>
          {error && (
            <Notice status="failure">
              <span data-testid="spend-export-error">{error}</span>
            </Notice>
          )}
          <div className="fw-actions">
            <Button type="submit" data-testid="spend-export-create" disabled={busy || !chosen}>
              {t('app.spend.exports.create')}
            </Button>
          </div>
        </form>
        {shown && <ExportResult x={shown} onFresh={() => open(shown.id)} />}
      </Card>
      <Card title={t('app.spend.exports.recent')}>
        <Load state={list} label="spend exports">
          {(xs) =>
            xs.length === 0 ? (
              <EmptyState title={t('app.spend.exports.none')} />
            ) : (
              <ul className="fw-list" data-testid="spend-export-list">
                {xs.map((x) => (
                  <li key={x.id}>
                    <button
                      className="fw-row"
                      data-testid={`spend-export-${x.id}`}
                      onClick={() => open(x.id)}
                    >
                      <span className="fw-row__main">
                        {t('app.spend.exports.row', {
                          from: formatBankDate(x.from),
                          to: formatBankDate(x.to),
                        })}
                        <span className="fw-row__sub">
                          {t('app.spend.exports.row_sub', {
                            format: formatName(x.format),
                            lines: x.lineCount,
                          })}
                        </span>
                      </span>
                      <span data-mask="">{formatMinor(x.total)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          }
        </Load>
      </Card>
    </>
  );
}
