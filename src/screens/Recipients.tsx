import { useRef, useState, type FormEvent } from 'react';
import { Permission } from '../api/client';
import { errorText } from '../api/errors';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Notice,
  PageHeader,
  Select,
  StatusChip,
  useToast,
} from '../design-system';
import { abaValid } from '../lib/aba';
import { normaliseIban, uaeIbanValid } from '../lib/iban';
import { IS_AE, REGION_CONFIG } from '../region';
import { useAsync } from '../lib/useAsync';
import { useSearchParams } from 'react-router-dom';
import { useDrafts } from '../assistant/drafts';
import { useSession } from '../session';
import { AcctLast4, Load, human, stateStatus } from './common';

/** Checked before any call (OG-030 AC-R3.1): name, ABA routing number, 4 to 17 digit account number. */
export function recipientErrors(name: string, routing: string, account: string) {
  return {
    name: name.trim() ? undefined : 'Enter the recipient name.',
    routing: abaValid(routing) ? undefined : 'Enter a valid 9-digit routing number.',
    account: /^\d{4,17}$/.test(account) ? undefined : 'Enter 4 to 17 digits.',
  };
}

/** The AE build (OG-022 R18): name and UAE IBAN; the IBAN error shows on the account line. */
export function ibanRecipientErrors(name: string, iban: string) {
  return {
    name: name.trim() ? undefined : 'Enter the recipient name.',
    routing: undefined,
    account: uaeIbanValid(iban) ? undefined : 'Enter a valid UAE IBAN: AE and 21 digits.',
  };
}

export function AddRecipient({
  initialName = '',
  onAdded,
}: {
  initialName?: string;
  onAdded?(id: string): void;
}) {
  const { api } = useSession();
  const drafts = useDrafts();
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const [routing, setRouting] = useState('');
  const [account, setAccount] = useState('');
  const [type, setType] = useState('CHECKING');
  const [errors, setErrors] = useState<ReturnType<typeof recipientErrors>>({
    name: undefined,
    routing: undefined,
    account: undefined,
  });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const inFlight = useRef(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    const errs = IS_AE ? ibanRecipientErrors(name, account) : recipientErrors(name, routing, account);
    setErrors(errs);
    if (errs.name || errs.routing || errs.account) return;
    inFlight.current = true;
    setBusy(true);
    setFailure(null);
    try {
      const r = await api.createRecipient(
        IS_AE
          ? { kind: 'BUSINESS', name: name.trim(), iban: normaliseIban(account), accountType: 'CURRENT' }
          : {
              kind: 'BUSINESS',
              name: name.trim(),
              accountNumber: account,
              routingNumber: routing,
              accountType: type,
            },
      );
      setAccount('');
      setRouting('');
      setName('');
      toast.show(`${r.name} added. Screening: ${human(r.screening)}.`, 'success');
      await drafts.done(['RECIPIENT_ADD'], r.id);
      onAdded?.(r.id);
    } catch (err) {
      setFailure(errorText(err));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <form className="fw-form" onSubmit={submit} noValidate data-testid="add-recipient">
      <Field label="Recipient name" error={errors.name}>
        <Input data-testid="recipient-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      {IS_AE ? (
        <Field label="IBAN" hint="AE and 21 digits. Only the last four are kept." error={errors.account}>
          <Input
            data-testid="recipient-iban"
            data-mask=""
            autoComplete="off"
            maxLength={29}
            value={account}
            onChange={(e) => setAccount(e.target.value.toUpperCase())}
          />
        </Field>
      ) : (
        <>
          <Field label="Routing number" error={errors.routing}>
            <Input
              data-testid="recipient-routing"
              inputMode="numeric"
              autoComplete="off"
              maxLength={9}
              value={routing}
              onChange={(e) => setRouting(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          <Field label="Account number" error={errors.account}>
            <Input
              data-testid="recipient-account"
              data-mask=""
              inputMode="numeric"
              autoComplete="off"
              value={account}
              onChange={(e) => setAccount(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          <Field label="Account type">
            <Select
              value={type}
              onChange={(e) => setType(e.target.value)}
              options={[
                { value: 'CHECKING', label: 'Checking' },
                { value: 'SAVINGS', label: 'Savings' },
              ]}
            />
          </Field>
        </>
      )}
      {failure && <Notice status="failure">{failure}</Notice>}
      <div className="fw-actions">
        <Button type="submit" data-testid="recipient-save" disabled={busy}>
          Add recipient
        </Button>
      </div>
    </form>
  );
}

export function RecipientsScreen() {
  const { api, can } = useSession();
  const drafts = useDrafts();
  const [q] = useSearchParams();
  const [n, setN] = useState(0);
  const list = useAsync(() => api.recipients(), [api, n]);
  const [adding, setAdding] = useState(q.get('add') === '1');
  const [failure, setFailure] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);
  const archiveInFlight = useRef(false);
  const manage = can(Permission.RECIPIENT_MANAGE);
  const archive = (id: string) => {
    if (archiveInFlight.current) return;
    archiveInFlight.current = true;
    setArchiving(id);
    setFailure(null);
    api
      .archiveRecipient(id)
      .then(() => drafts.done(['RECIPIENT_ARCHIVE'], id, { recipientId: id }))
      .then(
        () => setN((x) => x + 1),
        (e) => setFailure(errorText(e)),
      )
      .finally(() => {
        archiveInFlight.current = false;
        setArchiving(null);
      });
  };
  return (
    <>
      <PageHeader
        title="Recipients"
        subtitle={REGION_CONFIG.recipientsSubtitle}
        actions={
          manage && (
            <Button data-testid="recipient-add" onClick={() => setAdding((x) => !x)}>
              Add recipient
            </Button>
          )
        }
      />
      {adding && manage && (
        <Card title="New recipient">
          <AddRecipient
            initialName={q.get('name') ?? ''}
            onAdded={() => {
              setAdding(false);
              setN((x) => x + 1);
            }}
          />
        </Card>
      )}
      {failure && <Notice status="failure">{failure}</Notice>}
      <Load state={list} label="recipients">
        {(rows) =>
          rows.length ? (
            <ul className="fw-list" data-testid="recipients-list">
              {rows.map((r) => (
                <li key={r.id} className="fw-row" data-testid={`recipient-${r.id}`}>
                  <span className="fw-row__main">
                    <strong>{r.name}</strong>
                    <span className="fw-row__sub">
                      {IS_AE ? 'IBAN' : 'Account'} <AcctLast4 value={r.accountLast4} /> ·{' '}
                      {human(r.accountType)}
                    </span>
                  </span>
                  <span className="fw-actions">
                    <StatusChip status={stateStatus(r.screening)}>{human(r.screening)}</StatusChip>
                    {manage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Archive ${r.name}`}
                        disabled={archiving !== null}
                        onClick={() => archive(r.id)}
                      >
                        Archive
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No recipients yet">Add the people and companies you pay.</EmptyState>
          )
        }
      </Load>
    </>
  );
}
