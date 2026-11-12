import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Account, Statement, Transaction } from '../api/types';
import { errorText } from '../api/errors';
import {
  Button,
  Card,
  EmptyState,
  KeyValue,
  Modal,
  Notice,
  PageHeader,
  StatusChip,
  Table,
} from '../design-system';
import { formatBankDate, formatDate, formatMinor, formatPeriod } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { T, t } from '../i18n';
import { REGION_CONFIG } from '../region';
import { AcctLast4, Amt, FilterChips, Load, human, stateStatus } from './common';
import { ExportActivity } from './ExportActivity';
import { SplitHint } from './SplitHint';

const PAGE = 20;

/**
 * A transaction's line: the API sends no counterparty, and `origin` (ONGEM or PROVIDER) says who recorded it, which is
 * not a description; the rail and the direction are what the founder can read.
 */
export function describeTransaction(tx: Pick<Transaction, 'rail' | 'direction'>): string {
  const rails: Record<string, string> = REGION_CONFIG.railNames;
  const rail = tx.rail ? (rails[tx.rail] ?? human(tx.rail)) : t('app.accounts.txn_unknown_rail');
  return t(tx.direction === 'CREDIT' ? 'app.accounts.txn_in' : 'app.accounts.txn_out', { rail });
}

/** Formatted money with a break point between the currency and the number, for a table cell where money may wrap. */
function moneyText(text: string): ReactNode {
  const i = text.search(/\d/);
  return i > 0 ? (
    <>
      {text.slice(0, i)}
      <wbr />
      {text.slice(i)}
    </>
  ) : (
    text
  );
}

/** An amount with its sign, tight and isolated left to right, so Arabic never moves the minus after it (FA-048). */
function SignedAmt({ credit, value }: { credit: boolean; value: Transaction['amount'] }) {
  return (
    <bdi dir="ltr" className="og-money" data-mask="">
      {credit ? '+' : '\u2212'}
      {moneyText(formatMinor(value))}
    </bdi>
  );
}

function Balance({ a }: { a: Account }) {
  if (!a.balance) return <span className="fw-row__sub">{t('app.accounts.no_balance')}</span>;
  return (
    <span className="fw-row__main">
      <Amt value={a.balance.available} />
      {a.balance.stale && (
        <span className="fw-stale" data-testid={`stale-${a.id}`}>
          <T
            k="app.accounts.stale_last_known"
            vars={{ time: <bdi dir="ltr">{formatDate(a.balance.asOf, { time: true })}</bdi> }}
          />
        </span>
      )}
    </span>
  );
}

/** A statement's opening and closing balance and its lines, in a dialog (account detail and Documents, OG-035 R7). */
export function StatementModal({ statement, onClose }: { statement: Statement | null; onClose(): void }) {
  return (
    <Modal
      open={Boolean(statement)}
      title={t('app.accounts.statement_period', { period: formatPeriod(statement?.period ?? '') })}
      onClose={onClose}
    >
      {statement && (
        <div data-testid="statement-view">
          <KeyValue
            items={[
              { label: t('app.accounts.opening_balance'), value: <Amt value={statement.opening} /> },
              { label: t('app.accounts.closing_balance'), value: <Amt value={statement.closing} /> },
            ]}
          />
          <Table
            caption={t('app.accounts.statement_lines')}
            rows={statement.transactions.map((l, i) => ({ ...l, i }))}
            rowKey={(l) => String(l.i)}
            columns={[
              {
                key: 'date',
                header: t('app.accounts.col_date'),
                render: (l) => (l.date ? formatBankDate(l.date) : ''),
              },
              {
                key: 'dir',
                header: t('app.accounts.col_in_or_out'),
                render: (l) => t(l.direction === 'CREDIT' ? 'app.accounts.in' : 'app.accounts.out'),
              },
              {
                key: 'amount',
                header: t('app.accounts.col_amount'),
                align: 'end',
                render: (l) => <Amt value={l.amount} />,
              },
            ]}
          />
        </div>
      )}
    </Modal>
  );
}

function AccountDetail({ id }: { id: string }) {
  const { api } = useSession();
  const [limit, setLimit] = useState(PAGE);
  const account = useAsync(() => api.account(id), [api, id]);
  const txns = useAsync(() => api.transactions(id, limit), [api, id, limit]);
  const statements = useAsync(() => api.statements(id).catch(() => []), [api, id]);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [direction, setDirection] = useState('all');
  const [statementError, setStatementError] = useState<string | null>(null);
  const openStatement = (period: string) => {
    setStatementError(null);
    api.statement(id, period).then(setStatement, (e: unknown) => setStatementError(errorText(e)));
  };
  return (
    <Load state={account} label="account">
      {(a) => (
        <div className="fw-thread" data-testid="account-detail">
          <Card
            title={
              <>
                {a.name} <AcctLast4 value={a.last4} />
              </>
            }
          >
            <KeyValue
              items={[
                {
                  label: t('app.accounts.available'),
                  value: a.balance ? <Amt value={a.balance.available} /> : t('app.accounts.not_known'),
                },
                {
                  label: t('app.accounts.posted'),
                  value: a.balance ? <Amt value={a.balance.posted} /> : t('app.accounts.not_known'),
                },
                {
                  label: t('app.accounts.status'),
                  value: <StatusChip status={stateStatus(a.status)}>{human(a.status)}</StatusChip>,
                },
              ]}
            />
            {a.balance?.stale && <p className="fw-stale">{t('app.accounts.stale_balance')}</p>}
          </Card>
          <Card
            title={t('app.accounts.transactions')}
            actions={
              <FilterChips
                label={t('app.accounts.filter_label')}
                testId="txn-filter"
                value={direction}
                onChange={setDirection}
                options={[
                  { id: 'all', label: t('app.payments.filter.all') },
                  { id: 'CREDIT', label: t('app.mobile.filter.in') },
                  { id: 'DEBIT', label: t('app.mobile.filter.out') },
                ]}
              />
            }
          >
            <Load state={txns} label="transactions">
              {(rows) => (
                <>
                  <Table
                    hideCaption
                    caption={t('app.accounts.transactions_caption')}
                    rows={direction === 'all' ? rows : rows.filter((tx) => tx.direction === direction)}
                    rowKey={(tx) => tx.id}
                    empty={t('app.accounts.no_transactions')}
                    columns={[
                      {
                        key: 'date',
                        header: t('app.accounts.col_date'),
                        render: (tx) => (tx.effectiveDate ? formatBankDate(tx.effectiveDate) : ''),
                      },
                      {
                        key: 'what',
                        header: t('app.accounts.col_description'),
                        // FA-011: who first (as the bank names them), how as secondary text; how alone without a name.
                        render: (tx) =>
                          tx.counterparty ? (
                            <span className="fw-txn" data-testid={`txn-counterparty-${tx.id}`}>
                              <span className="fw-txn__who" data-mask="">
                                {tx.counterparty}
                              </span>
                              <span className="fw-row__sub">{describeTransaction(tx)}</span>
                            </span>
                          ) : (
                            describeTransaction(tx)
                          ),
                      },
                      {
                        key: 'stage',
                        header: t('app.accounts.status'),
                        // FA-011: only a transaction not yet posted carries a chip; a posted one needs no word.
                        render: (tx) =>
                          tx.stage === 'POSTED' ? null : (
                            <StatusChip status={stateStatus(tx.stage)}>{human(tx.stage)}</StatusChip>
                          ),
                      },
                      {
                        key: 'amount',
                        header: t('app.accounts.col_amount'),
                        align: 'end',
                        // FA-011, FA-048: the sign sits against the amount (U+2212 minus) and the pair reads left to right.
                        render: (tx) => <SignedAmt credit={tx.direction === 'CREDIT'} value={tx.amount} />,
                      },
                    ]}
                  />
                  {rows.length >= limit && limit < 100 && (
                    <Button
                      variant="secondary"
                      data-testid="show-more"
                      onClick={() => setLimit(Math.min(100, limit + PAGE))}
                    >
                      {t('app.accounts.show_more')}
                    </Button>
                  )}
                </>
              )}
            </Load>
          </Card>
          <Card title={t('app.accounts.statements')}>
            <Load state={statements} label="statements">
              {(list) =>
                list.length ? (
                  <ul className="fw-list">
                    {list.map((s) => (
                      <li key={s.period}>
                        <button
                          className="fw-row"
                          data-testid={`statement-${s.period}`}
                          onClick={() => openStatement(s.period)}
                        >
                          {t('app.accounts.statement_period', { period: formatPeriod(s.period) })}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{t('app.accounts.no_statements')}</p>
                )
              }
            </Load>
            {statementError && <Notice status="failure">{statementError}</Notice>}
          </Card>
          <ExportActivity accountId={a.id} />
          <StatementModal statement={statement} onClose={() => setStatement(null)} />
        </div>
      )}
    </Load>
  );
}

export function AccountsScreen() {
  const { api } = useSession();
  const { id } = useParams();
  const navigate = useNavigate();
  const list = useAsync(() => api.accounts(), [api]);
  // FA-018: on a wide screen the first account opens at once instead of an empty detail column.
  const first = list.status === 'success' ? list.data[0]?.id : undefined;
  useEffect(() => {
    if (id || !first || typeof window.matchMedia !== 'function') return;
    if (window.matchMedia('(min-width: 901px)').matches) navigate(`/accounts/${first}`, { replace: true });
  }, [id, first, navigate]);
  return (
    <>
      <PageHeader title={t('app.accounts.title')} />
      <div className={`fw-split${id ? ' has-detail' : ''}`}>
        <div className="fw-split__list">
          <Load state={list} label="accounts">
            {(accounts) =>
              accounts.length ? (
                <ul className="fw-list" data-testid="accounts-list">
                  {accounts.map((a) => (
                    <li key={a.id}>
                      <button
                        className={`fw-row${a.id === id ? ' is-active' : ''}`}
                        data-testid={`account-${a.id}`}
                        onClick={() => navigate(`/accounts/${a.id}`)}
                      >
                        <span className="fw-row__main">
                          <strong>{a.name}</strong>
                          <span className="fw-row__sub">
                            <AcctLast4 value={a.last4} /> {human(a.status)}
                          </span>
                        </span>
                        <Balance a={a} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title={t('app.accounts.empty_title')}>{t('app.accounts.empty_text')}</EmptyState>
              )
            }
          </Load>
        </div>
        {id ? (
          <div>
            <Button variant="ghost" className="fw-back fw-split__back" onClick={() => navigate('/accounts')}>
              {t('app.accounts.back')}
            </Button>
            <AccountDetail id={id} />
          </div>
        ) : (
          <SplitHint title={t('app.accounts.hint_title')}>{t('app.accounts.hint_text')}</SplitHint>
        )}
      </div>
    </>
  );
}
