import { useRef, useState } from 'react';
import { errorText } from '../api/errors';
import type { Application, RequiredDisclosure } from '../api/types';
import { Button, Card, Field, Input, Modal, Notice, PageHeader, StatusChip, Stepper } from '../design-system';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { Load, human, stateStatus } from './common';

function OwnerId({ app, ownerId, onDone }: { app: Application; ownerId: string; onDone(): void }) {
  const { api } = useSession();
  const [number, setNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = /^\d{9}$/.test(number);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      // The number exists only in this request and is cleared from the field right after (OG-029 R3).
      await api.putOwnerIdentity(app.id, ownerId, { idType: 'SSN', number, country: 'US' });
      setNumber('');
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fw-form">
      <Field label="Social Security number" hint="9 digits. Only the last four are shown back.">
        <Input
          data-testid={`owner-ssn-${ownerId}`}
          data-mask=""
          inputMode="numeric"
          autoComplete="off"
          maxLength={9}
          value={number}
          onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
        />
      </Field>
      {error && <Notice status="failure">{error}</Notice>}
      <Button data-testid={`owner-ssn-save-${ownerId}`} disabled={!valid || busy} onClick={() => void save()}>
        Save
      </Button>
    </div>
  );
}

function Disclosures({ list, onDone }: { list: RequiredDisclosure[]; onDone(): void }) {
  const { api } = useSession();
  const [open, setOpen] = useState<{ d: RequiredDisclosure; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const once = async (f: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await f();
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const read = (d: RequiredDisclosure) =>
    once(async () => {
      const t = await api.disclosureText(d.versionId);
      await api.recordDisclosure(d.versionId, 'DISPLAYED');
      setOpen({ d, text: t.text });
    });
  const accept = () =>
    once(async () => {
      if (!open) return;
      await api.recordDisclosure(open.d.versionId, 'ACKNOWLEDGED');
      setOpen(null);
      onDone();
    });
  return (
    <>
      <ul className="fw-list">
        {list.map((d) => (
          <li key={d.versionId} className="fw-row">
            <span>{d.title}</span>
            {d.acknowledged ? (
              <StatusChip status="success">Accepted</StatusChip>
            ) : (
              <Button
                size="sm"
                data-testid={`disclosure-${d.versionId}`}
                disabled={busy}
                onClick={() => void read(d)}
              >
                Read and accept
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error && !open && <Notice status="failure">{error}</Notice>}
      <Modal
        open={Boolean(open)}
        title={open?.d.title ?? ''}
        onClose={() => setOpen(null)}
        footer={
          <Button data-testid="disclosure-accept" disabled={busy} onClick={() => void accept()}>
            I accept
          </Button>
        }
      >
        <p>{open?.text}</p>
        {error && <Notice status="failure">{error}</Notice>}
      </Modal>
    </>
  );
}

/** States in which the bank is deciding (the app's "The bank's review" step). */
const WAITING = ['SUBMITTED', 'VERIFYING', 'PENDING_BANK', 'IN_REVIEW', 'MORE_INFO', 'EDD'];
export function OnboardingScreen() {
  const { api } = useSession();
  const [n, setN] = useState(0);
  const refresh = () => setN((x) => x + 1);
  const apps = useAsync(() => api.applications(), [api, n]);
  const disclosures = useAsync(() => api.requiredDisclosures(), [api, n]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const act = (f: () => Promise<unknown>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    f()
      .then(refresh, (e) => setError(errorText(e)))
      .finally(() => {
        inFlight.current = false;
        setBusy(false);
      });
  };
  return (
    <>
      <PageHeader title="Account application" subtitle="The bank decides; we show each step as it happens." />
      <Load state={apps} label="application">
        {(list) => {
          const app = list[0];
          if (!app) return <Notice status="info">There is no application for your company yet.</Notice>;
          const missing = app.owners.filter((o) => app.requirements.includes(`owner_id_missing:${o.id}`));
          const discs = disclosures.status === 'success' ? disclosures.data : [];
          const allAccepted = discs.every((d) => d.acknowledged);
          return (
            <>
              <Card
                title={
                  <>
                    Status{' '}
                    <StatusChip status={stateStatus(app.state)}>
                      <span data-testid="application-state">{human(app.state)}</span>
                    </StatusChip>
                  </>
                }
              >
                <Stepper
                  label="Application steps"
                  items={[
                    {
                      id: 'owners',
                      label: 'Owner identity',
                      statusText: missing.length ? 'To do' : 'Done',
                      status: missing.length ? 'pending' : 'success',
                      current: missing.length > 0,
                    },
                    {
                      id: 'confirm',
                      label: 'Confirm details',
                      statusText: app.state === 'COLLECTING' ? 'To do' : 'Done',
                      status: app.state === 'COLLECTING' ? 'pending' : 'success',
                    },
                    {
                      id: 'disclosures',
                      label: 'Disclosures',
                      statusText: allAccepted ? 'Done' : 'To do',
                      status: allAccepted ? 'success' : 'pending',
                    },
                    {
                      id: 'submit',
                      label: 'Submit to the bank',
                      statusText: human(app.state),
                      status: stateStatus(app.state),
                    },
                  ]}
                />
              </Card>
              {WAITING.includes(app.state) && (
                <Notice status="info">
                  <span role="status" aria-live="polite" data-testid="bank-waiting">
                    The bank is reviewing your application. This can take a few days. Check back here for
                    updates.
                  </span>
                </Notice>
              )}
              {error && <Notice status="failure">{error}</Notice>}
              <Card title="Owners">
                <ul className="fw-list">
                  {app.owners.map((o) => (
                    <li key={o.id} className="fw-row">
                      <span className="fw-row__main">
                        <strong>{o.name}</strong>
                        <span className="fw-row__sub">
                          {o.ownershipPercent}%{' '}
                          {o.idLast4 ? <span data-mask="">ID ending {o.idLast4}</span> : 'ID needed'}
                        </span>
                      </span>
                      {missing.includes(o) && <OwnerId app={app} ownerId={o.id} onDone={refresh} />}
                    </li>
                  ))}
                </ul>
              </Card>
              {app.state === 'COLLECTING' && (
                <Button
                  data-testid="application-confirm"
                  disabled={busy || missing.length > 0}
                  onClick={() => act(() => api.confirmApplication(app.id))}
                >
                  Confirm details
                </Button>
              )}
              {app.state === 'READY_FOR_DISCLOSURES' && (
                <Card title="Disclosures">
                  <Disclosures list={discs} onDone={refresh} />
                  <Button
                    data-testid="application-submit"
                    disabled={busy || !allAccepted}
                    onClick={() => act(() => api.submitApplication(app.id))}
                  >
                    Submit to the bank
                  </Button>
                </Card>
              )}
            </>
          );
        }}
      </Load>
    </>
  );
}
