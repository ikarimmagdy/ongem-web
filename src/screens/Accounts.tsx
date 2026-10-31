import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Account, Statement } from '../api/types';
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
import { Amt, Last4, Load, human, stateStatus } from './common';

const PAGE = 20;

function Balance({ a }: { a: Account }) {
  if (!a.balance) return <span className="fw-row__sub">No balance from the bank yet</span>;
  return (
    <span className="fw-row__main">
      <Amt value={a.balance.available} />
      {a.balance.stale && (
        <span className="fw-stale" data-testid={`stale-${a.id}`}>
          The bank did not answer just now. Last known {formatDate(a.balance.asOf, { time: true })}.
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
                {a.name} <Last4 value={a.last4} />
              </>
            }
          >
            <KeyValue
              items={[
                { label: 'Available', value: a.balance ? <Amt value={a.balance.available} /> : 'Not known' },
                { label: 'Posted', value: a.balance ? <Amt value={a.balance.posted} /> : 'Not known' },
                {
                  label: 'Status',
                  value: <StatusChip status={stateStatus(a.status)}>{human(a.status)}</StatusChip>,
                },
              ]}
            />
            {a.balance?.stale && (
              <p className="fw-stale">The bank did not answer just now; this is the last known balance.</p>
            )}
          </Card>
          <Card title="Transactions">
            <Load state={txns} label="transactions">
              {(rows) => (
                <>
                  <Table
                    caption="Transactions, newest first"
                    rows={rows}
                    rowKey={(t) => t.id}
                    empty="No transactions yet."
                    columns={[
                      {
                        key: 'date',
                        header: 'Date',
                        render: (t) => (t.effectiveDate ? formatDate(t.effectiveDate) : ''),
                      },
                      { key: 'what', header: 'Description', render: (t) => t.origin || t.rail || '' },
                      { key: 'stage', header: 'Status', render: (t) => human(t.stage) },
                      {
                        key: 'amount',
                        header: 'Amount',
                        align: 'end',
                        render: (t) => (
                          <span>
                            {t.direction === 'CREDIT' ? '+' : '-'}
                            <Amt value={t.amount} />
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
                      Show more
                    </Button>
                  )}
                </>
              )}
            </Load>
          </Card>
          <Card title="Statements">
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
                          Statement {s.period}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No statements yet.</p>
                )
              }
            </Load>
            {statementError && <Notice status="failure">{statementError}</Notice>}
          </Card>
          <Modal
            open={Boolean(statement)}
            title={`Statement ${statement?.period ?? ''}`}
            onClose={() => setStatement(null)}
          >
            {statement && (
              <div data-testid="statement-view">
                <KeyValue
                  items={[
                    { label: 'Opening balance', value: <Amt value={statement.opening} /> },
                    { label: 'Closing balance', value: <Amt value={statement.closing} /> },
                  ]}
                />
                <Table
                  caption="Statement lines"
                  rows={statement.transactions.map((l, i) => ({ ...l, i }))}
                  rowKey={(l) => String(l.i)}
                  columns={[
                    { key: 'date', header: 'Date', render: (l) => (l.date ? formatDate(l.date) : '') },
                    {
                      key: 'dir',
                      header: 'In or out',
                      render: (l) => (l.direction === 'CREDIT' ? 'In' : 'Out'),
                    },
                    {
                      key: 'amount',
                      header: 'Amount',
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
        title="Accounts"
        subtitle="Balances come from the bank."
        actions={<Link to="/recipients">Recipients</Link>}
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
                            <Last4 value={a.last4} /> {human(a.status)}
                          </span>
                        </span>
                        <Balance a={a} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No accounts yet">
                  Your account appears here once the bank opens it.
                </EmptyState>
              )
            }
          </Load>
        </div>
        {id ? (
          <div>
            <Button variant="ghost" className="fw-back" onClick={() => navigate('/accounts')}>
              Back to accounts
            </Button>
            <AccountDetail id={id} />
          </div>
        ) : (
          <div />
        )}
      </div>
    </>
  );
}
