import { useState } from 'react';
import { Permission } from '../api/client';
import { Button, Card, EmptyState, Field, Notice, Select, useToast } from '../design-system';
import { t } from '../i18n';
import { formatBankDate, formatDate, formatMinor } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { Amt, Load } from '../screens/common';
import { spendOf, type ExpenseView, type ReceiptView } from './api';
import { saveBlob, spendErrorText } from './common';

/** An expense as a pick in a match list: merchant, amount, date and who. */
export const expenseOption = (x: ExpenseView) => ({
  value: x.id,
  label: t('app.spend.receipts.option', {
    merchant: x.merchant ?? x.employeeName,
    amount: formatMinor(x.amount),
    date: formatBankDate(x.spentOn),
    name: x.employeeName,
  }),
});

/** What the uploader told about a receipt (there is no reading of the file yet): amount, date and merchant. */
export function ReceiptHintsLine({ r }: { r: ReceiptView }) {
  const parts = [
    r.hintAmount ? formatMinor(r.hintAmount) : null,
    r.hintDate ? formatBankDate(r.hintDate) : null,
    r.hintMerchant ?? null,
  ].filter(Boolean);
  return (
    <span className="fw-row__sub" data-mask="">
      {parts.length
        ? t('app.spend.receipts.hints', { hints: parts.join(', ') })
        : t('app.spend.receipts.no_hints')}
    </span>
  );
}

/** Finance: receipts no expense took on its own, with the expenses they could be, matched by hand (spend:manage). */
export function ReceiptsScreen() {
  const { api, can } = useSession();
  const spend = spendOf(api);
  const toast = useToast();
  const manage = can(Permission.SPEND_MANAGE);
  const receipts = useAsync(() => spend.receipts(), [api]);
  const open = useAsync(
    () => (manage ? spend.expenses({ state: 'OPEN' }, null, 100).then((p) => p.items) : Promise.resolve([])),
    [api, manage],
  );
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pool = (open.status === 'success' ? open.data : []).filter((x) => !x.receiptId);
  return (
    <Card title={t('app.spend.receipts.title')}>
      <p>{t('app.spend.receipts.intro')}</p>
      {error && (
        <Notice status="failure">
          <span data-testid="receipt-error">{error}</span>
        </Notice>
      )}
      <Load state={receipts} label="spend receipts">
        {(list) =>
          list.length === 0 ? (
            <EmptyState title={t('app.spend.receipts.empty')}>
              <p data-testid="receipts-empty">{t('app.spend.receipts.empty_text')}</p>
            </EmptyState>
          ) : (
            <ul className="fw-list" data-testid="receipt-list">
              {list.map((r) => {
                const candidates = pool.filter((x) => r.candidates.includes(x.id));
                const options = (candidates.length ? candidates : pool).map(expenseOption);
                const choice = picked[r.id] ?? options[0]?.value ?? '';
                return (
                  <li key={r.id} className="fw-row fw-row--stack" data-testid={`receipt-${r.id}`}>
                    <span className="fw-row__main">
                      <strong>{r.fileName}</strong>
                      <ReceiptHintsLine r={r} />
                      <span className="fw-row__sub">
                        {t('app.spend.receipts.uploaded', { date: formatDate(r.createdAt) })}
                      </span>
                      {r.hintAmount && <Amt value={r.hintAmount} />}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid={`receipt-download-${r.id}`}
                      onClick={() =>
                        spend.receiptFile(r.id).then(
                          (b) => saveBlob(b, r.fileName),
                          (e: unknown) => setError(spendErrorText(e)),
                        )
                      }
                    >
                      {t('app.spend.receipts.download')}
                    </Button>
                    {manage &&
                      (options.length ? (
                        <span className="fw-actions">
                          <Field
                            label={
                              candidates.length
                                ? t('app.spend.receipts.candidates')
                                : t('app.spend.receipts.any_open')
                            }
                          >
                            <Select
                              data-testid={`receipt-pick-${r.id}`}
                              value={choice}
                              onChange={(v) => setPicked((p) => ({ ...p, [r.id]: v }))}
                              options={options}
                            />
                          </Field>
                          <Button
                            size="sm"
                            data-testid={`receipt-match-${r.id}`}
                            disabled={busy || !choice}
                            onClick={async () => {
                              setBusy(true);
                              setError(null);
                              try {
                                await spend.matchReceipt(r.id, choice);
                                toast.show(t('app.spend.receipts.matched'), 'success');
                                receipts.reload();
                                open.reload();
                              } catch (e) {
                                setError(spendErrorText(e));
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            {t('app.spend.receipts.match')}
                          </Button>
                        </span>
                      ) : (
                        <span className="fw-row__sub">{t('app.spend.receipts.nothing_to_match')}</span>
                      ))}
                  </li>
                );
              })}
            </ul>
          )
        }
      </Load>
    </Card>
  );
}
