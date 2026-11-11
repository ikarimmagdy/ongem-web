import { useState } from 'react';
import { errorText } from '../api/errors';
import type { Account, RequiredDisclosure, Statement } from '../api/types';
import { Button, Card, EmptyState, Modal, Notice, PageHeader, Select } from '../design-system';
import { useAsync } from '../lib/useAsync';
import { formatPeriod } from '../lib/format';
import { t } from '../i18n';
import { useSession } from '../session';
import { StatementModal } from './Accounts';
import { ExportActivity } from './ExportActivity';
import { AcctLast4, Load } from './common';

function AccountStatements({ account, onOpen }: { account: Account; onOpen(period: string): void }) {
  const { api } = useSession();
  const list = useAsync(() => api.statements(account.id), [api, account.id]);
  return (
    <li data-testid={`documents-account-${account.id}`}>
      <p className="fw-docs__account">
        <strong>{account.name}</strong> <AcctLast4 value={account.last4} />
      </p>
      <Load state={list} label="statements">
        {(rows) =>
          rows.length ? (
            <ul className="fw-list">
              {rows.map((s) => (
                <li key={s.period}>
                  <button
                    className="fw-row"
                    data-testid={`documents-statement-${account.id}-${s.period}`}
                    onClick={() => onOpen(s.period)}
                  >
                    {t('app.accounts.statement_period', { period: formatPeriod(s.period) })}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fw-row__sub">{t('app.documents.no_statements')}</p>
          )
        }
      </Load>
    </li>
  );
}

function Disclosures() {
  const { api } = useSession();
  const list = useAsync(() => api.requiredDisclosures(), [api]);
  const [open, setOpen] = useState<{ d: RequiredDisclosure; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const read = (d: RequiredDisclosure) => {
    setError(null);
    api.disclosureText(d.versionId).then(
      (doc) => setOpen({ d, text: doc.text }),
      (e: unknown) => setError(errorText(e)),
    );
  };
  return (
    <Card title={t('app.documents.disclosures')} data-testid="documents-disclosures">
      <Load state={list} label="disclosures">
        {(rows) =>
          rows.length ? (
            <ul className="fw-list">
              {rows.map((d) => (
                <li key={d.versionId} className="fw-row">
                  <span className="fw-row__main">
                    <strong>{d.title}</strong>
                    <span className="fw-row__sub">{d.version}</span>
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    data-testid={`documents-disclosure-${d.versionId}`}
                    onClick={() => read(d)}
                  >
                    {t('app.documents.read')}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fw-row__sub">{t('app.documents.no_disclosures')}</p>
          )
        }
      </Load>
      {error && <Notice status="failure">{error}</Notice>}
      <Modal open={Boolean(open)} title={open?.d.title ?? ''} onClose={() => setOpen(null)}>
        <p className="fw-doc-text" data-testid="documents-disclosure-text">
          {open?.text}
        </p>
      </Modal>
    </Card>
  );
}

/**
 * Documents (OG-035 R7): statements by account, the accounting exports of a picked account (OG-024) and the agreements
 * and disclosures the company was shown.
 */
export function DocumentsScreen() {
  const { api } = useSession();
  const accounts = useAsync(() => api.accounts(), [api]);
  const [picked, setPicked] = useState<string | null>(null);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [statementError, setStatementError] = useState<string | null>(null);
  const openStatement = (accountId: string, period: string) => {
    setStatementError(null);
    api.statement(accountId, period).then(setStatement, (e: unknown) => setStatementError(errorText(e)));
  };
  return (
    <>
      <PageHeader title={t('app.documents.title')} subtitle={t('app.documents.subtitle')} />
      <Load state={accounts} label="accounts">
        {(list) => {
          const account = list.find((a) => a.id === picked) ?? list[0];
          return list.length ? (
            <>
              <Card title={t('app.documents.statements')} data-testid="documents-statements">
                <ul className="fw-docs">
                  {list.map((a) => (
                    <AccountStatements key={a.id} account={a} onOpen={(p) => openStatement(a.id, p)} />
                  ))}
                </ul>
                {statementError && <Notice status="failure">{statementError}</Notice>}
              </Card>
              <section
                className="fw-docs__exports"
                data-testid="documents-exports"
                aria-label={t('app.documents.exports')}
              >
                {account && (
                  <ExportActivity
                    key={account.id}
                    accountId={account.id}
                    picker={
                      list.length > 1 && (
                        <label className="fw-docs__pick">
                          <span>{t('app.documents.account')}</span>
                          <Select
                            aria-label={t('app.documents.account')}
                            data-testid="documents-export-account"
                            value={account.id}
                            onChange={(e) => setPicked(e.target.value)}
                            options={list.map((a) => ({ value: a.id, label: a.name }))}
                          />
                        </label>
                      )
                    }
                  />
                )}
              </section>
            </>
          ) : (
            <EmptyState title={t('app.documents.statements')}>{t('app.documents.no_accounts')}</EmptyState>
          );
        }}
      </Load>
      <Disclosures />
      <StatementModal statement={statement} onClose={() => setStatement(null)} />
    </>
  );
}
