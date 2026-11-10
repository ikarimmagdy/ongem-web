import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
import { formatDate } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { t } from '../i18n';
import { REGION_CONFIG } from '../region';
import { AcctLast4, Amt, Load, human, stateStatus } from './common';
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

function Balance({ a }: { a: Account }) {
  if (!a.balance) return <span className="fw-row__sub">{t('app.accounts.no_balance')}</span>;
  return (
    <span className="fw-row__main">
      <Amt value={a.balance.available} />
      {a.balance.stale && (
        <span className="fw-stale" data-testid={`stale-${a.id}`}>
          {t('app.accounts.stale_last_known', { time: formatDate(a.balance.asOf, { time: true }) })}
        </span>
      )}
    </span>
  );
}

function AccountDetail({ id }: { id: string }) {
  const { api } = useSession();
  const [limit, setLimit] = useState(PAGE);
  const account = useAsync(() => api.account(id), [api, id]);
  const txns = useAsync(() => api.transactions(id, limit), [api, id, limit]);
  const statements = useAsync(() => api.statements(id).catch(() => []), [api, id]);
  const [statement, setStatement] = useState<Statement | null>(null);
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
          <Card title={t('app.accounts.transactions')}>
            <Load state={txns} label="transactions">
              {(rows) => (
                <>
                  <Table
                    caption={t('app.accounts.transactions_caption')}
                    rows={rows}
                    rowKey={(tx) => tx.id}
                    empty={t('app.accounts.no_transactions')}
                    columns={[
                      {
                        key: 'date',
                        header: t('app.accounts.col_date'),
                        render: (tx) => (tx.effectiveDate ? formatDate(tx.effectiveDate) : ''),
                      },
                      {
                        key: 'what',
                        header: t('app.accounts.col_description'),
                        render: (tx) => describeTransaction(tx),
                      },
                      { key: 'stage', header: t('app.accounts.status'), render: (tx) => human(tx.stage) },
                      {
                        key: 'amount',
                        header: t('app.accounts.col_amount'),
                        align: 'end',
                        render: (tx) => (
                          <span>
                            {tx.direction === 'CREDIT' ? '+' : '-'}
                            <Amt value={tx.amount} />
                          </span>
                        ),
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
                          {t('app.accounts.statement_period', { period: s.period })}
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
          <Modal
            open={Boolean(statement)}
            title={t('app.accounts.statement_period', { period: statement?.period ?? '' })}
            onClose={() => setStatement(null)}
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
                      render: (l) => (l.date ? formatDate(l.date) : ''),
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
  return (
    <>
      <PageHeader
        title={t('app.accounts.title')}
        subtitle={t('app.accounts.subtitle')}
        actions={<Link to="/recipients">{t('app.accounts.recipients_link')}</Link>}
      />
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
            <Button variant="ghost" className="fw-back" onClick={() => navigate('/accounts')}>
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
