import { useEffect, useRef, useState } from 'react';
import { errorText } from '../api/errors';
import type { Application, IdCapture, IdDocument, RequiredDisclosure } from '../api/types';
import {
  Button,
  Card,
  Field,
  Input,
  Modal,
  Notice,
  PageHeader,
  Select,
  StatusChip,
  Stepper,
  type Status,
} from '../design-system';
import { useAsync } from '../lib/useAsync';
import { applicationLabel } from '../lib/states';
import { IS_AE, REGION_CONFIG } from '../region';

const ID_TEST = IS_AE ? 'id' : 'ssn';
import { useSession } from '../session';
import { Load, stateStatus } from './common';

/** An owner's ID number, by the region's ID types (US: SSN; AE: Emirates ID or passport, OG-022 R18). */
function OwnerId({ app, ownerId, onDone }: { app: Application; ownerId: string; onDone(): void }) {
  const { api } = useSession();
  const types = REGION_CONFIG.ownerIds;
  const [idType, setIdType] = useState(types[0]!.idType);
  const kind = types.find((t) => t.idType === idType) ?? types[0]!;
  const [number, setNumber] = useState('');
  const [issuer, setIssuer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const country = kind.country ?? issuer;
  const valid = kind.pattern.test(number) && /^[A-Z]{2}$/.test(country);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      // The number exists only in this request and is cleared from the field right after (OG-029 R3).
      await api.putOwnerIdentity(app.id, ownerId, { idType: kind.idType, number, country });
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
      {types.length > 1 && (
        <Field label="ID type">
          <Select
            data-testid={`owner-id-type-${ownerId}`}
            value={idType}
            onChange={(e) => {
              setIdType(e.target.value);
              setNumber('');
            }}
            options={types.map((t) => ({ value: t.idType, label: t.label }))}
          />
        </Field>
      )}
      <Field label={kind.label} hint={kind.hint}>
        <Input
          data-testid={`owner-${ID_TEST}-${ownerId}`}
          data-mask=""
          inputMode={kind.numeric ? 'numeric' : 'text'}
          autoComplete="off"
          maxLength={kind.maxLength}
          value={number}
          onChange={(e) =>
            setNumber(
              kind.numeric
                ? e.target.value.replace(/\D/g, '')
                : e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
            )
          }
        />
      </Field>
      {!kind.country && (
        <Field label="Issuing country" hint="Two letters, such as IN or GB.">
          <Input
            data-testid={`owner-id-country-${ownerId}`}
            autoComplete="off"
            maxLength={2}
            value={issuer}
            onChange={(e) => setIssuer(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          />
        </Field>
      )}
      {error && <Notice status="failure">{error}</Notice>}
      <Button
        data-testid={`owner-${ID_TEST}-save-${ownerId}`}
        disabled={!valid || busy}
        onClick={() => void save()}
      >
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

const DOCUMENTS: Array<{ value: IdDocument; label: string }> = [
  { value: 'DRIVERS_LICENSE', label: "Driver's license" },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'ID_CARD', label: 'State ID card' },
];

/** How often an unfinished capture is read again while this screen is open. */
export const ID_CAPTURE_POLL_MS = 5000;

/** The capture page the bank gave, only if it is an https address; anything else is never opened. */
export function safeCaptureUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/** A capture's stage in words, the same as the app's (G-111). */
export function captureStatus(c: IdCapture): { status: Status; text: string } {
  if (c.stage === 'WAITING') return { status: 'pending', text: 'Waiting for your photos' };
  if (c.stage === 'CAPTURED')
    return { status: 'pending', text: 'Photos received. The bank is checking them.' };
  const k = (c.kycStatus ?? '').toUpperCase();
  if (k === 'ACCEPTED') return { status: 'success', text: 'Your ID is verified' };
  if (k === 'REJECTED') return { status: 'failure', text: 'The bank could not verify this ID' };
  return { status: 'pending', text: 'The bank is reviewing your ID' };
}

/**
 * G-111: the founder's own ID document capture while the bank is checking the application. "Capture in this browser"
 * gets the bank's capture page (a link that opens in a new tab, https only); "Text me the link" asks the bank to text it
 * to the phone it holds. The newest session is read again until the bank has answered.
 */
function IdCaptureCard({ app }: { app: Application }) {
  const { api } = useSession();
  const [document, setDocument] = useState<IdDocument>('DRIVERS_LICENSE');
  const [capture, setCapture] = useState<IdCapture | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    let alive = true;
    api.idCaptures(app.id).then(
      (list) => alive && setCapture((c) => c ?? list[0] ?? null),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [api, app.id]);

  const check = async () => {
    if (!capture || inFlight.current) return;
    inFlight.current = true;
    try {
      setCapture(await api.idCapture(app.id, capture.id));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
    }
  };

  const done = capture?.stage === 'VERIFIED';
  const captureId = capture?.id;
  useEffect(() => {
    if (!captureId || done) return;
    const t = setInterval(() => void check(), ID_CAPTURE_POLL_MS);
    return () => clearInterval(t);
  }, [captureId, done]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async (sendSms: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setLink(null);
    try {
      const c = await api.startIdCapture(app.id, document, sendSms);
      setCapture({ ...c, captureUrl: null });
      if (!sendSms) {
        const url = safeCaptureUrl(c.captureUrl);
        if (url) setLink(url);
        else if (c.captureUrl)
          setError('The bank sent a capture address we cannot open. Try Text me the link.');
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const s = capture ? captureStatus(capture) : null;
  return (
    <Card title="Verify your ID document">
      <p>
        The bank may ask for photos of your ID. Take them in this browser or on your phone. It takes about two
        minutes.
      </p>
      {capture && s && (
        <p data-testid="id-capture-status">
          <StatusChip status={s.status}>
            <span role="status" aria-live="polite">
              {s.text}
            </span>
          </StatusChip>
        </p>
      )}
      {capture?.smsRequested && !done && (
        <Notice status="info">
          <span data-testid="id-capture-sms-sent">
            The bank is texting the link to the phone number it holds for you. Open it on your phone.
          </span>
        </Notice>
      )}
      {link && (
        <Notice status="info">
          <a data-testid="id-capture-open" href={link} target="_blank" rel="noopener noreferrer">
            Open the capture page
          </a>{' '}
          It opens in a new tab. Come back here when you are done.
        </Notice>
      )}
      {api.kind === 'demo' && capture && !capture.smsRequested && !link && !done && (
        <Notice status="info">Demo mode has no capture page. Check the status to see the next step.</Notice>
      )}
      {error && <Notice status="failure">{error}</Notice>}
      {!done && (
        <div className="fw-form">
          <Field label="Document">
            <Select
              data-testid="id-capture-document"
              value={document}
              options={DOCUMENTS}
              onChange={(e) => setDocument(e.target.value as IdDocument)}
            />
          </Field>
          <Button data-testid="id-capture-browser" disabled={busy} onClick={() => void start(false)}>
            Capture in this browser
          </Button>
          <Button
            variant="secondary"
            data-testid="id-capture-sms"
            disabled={busy}
            onClick={() => void start(true)}
          >
            Text me the link
          </Button>
          {capture && (
            <Button variant="secondary" data-testid="id-capture-check" onClick={() => void check()}>
              Check status
            </Button>
          )}
        </div>
      )}
    </Card>
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
                      <span data-testid="application-state">{applicationLabel(app.state)}</span>
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
                      statusText: applicationLabel(app.state),
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
              {WAITING.includes(app.state) && <IdCaptureCard app={app} />}
              <Card title="Owners">
                <ul className="fw-list">
                  {app.owners.map((o) => (
                    <li key={o.id} className="fw-row fw-row--stack" data-testid={`owner-row-${o.id}`}>
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
