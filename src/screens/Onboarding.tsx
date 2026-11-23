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
import { t } from '../i18n';
import { useAsync } from '../lib/useAsync';
import { applicationLabel } from '../lib/states';
import { acceptedOwnerIds, IS_AE, type OwnerIdType } from '../region';

const ID_TEST = IS_AE ? 'id' : 'ssn';
import { useSession } from '../session';
import { Load, stateStatus } from './common';

/**
 * An owner's ID number, by the ID types the programme accepts that are issued in this region (OG-070
 * `identifiers.ownerIdTypes`; OG-022 R18 for the region's documents).
 */
function OwnerId({
  app,
  ownerId,
  types,
  onDone,
}: {
  app: Application;
  ownerId: string;
  types: OwnerIdType[];
  onDone(): void;
}) {
  const { api } = useSession();
  const [idType, setIdType] = useState(types[0]!.idType);
  const kind = types.find((x) => x.idType === idType) ?? types[0]!;
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
        <Field label={t('app.onboarding.id_type')}>
          <Select
            data-testid={`owner-id-type-${ownerId}`}
            value={idType}
            onChange={(v) => {
              setIdType(v);
              setNumber('');
            }}
            options={types.map((x) => ({ value: x.idType, label: x.label }))}
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
        <Field label={t('app.onboarding.issuing_country')} hint={t('app.onboarding.issuing_country_hint')}>
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
        {t('app.onboarding.save')}
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
      const doc = await api.disclosureText(d.versionId);
      await api.recordDisclosure(d.versionId, 'DISPLAYED');
      setOpen({ d, text: doc.text });
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
              <StatusChip status="success">{t('app.onboarding.accepted')}</StatusChip>
            ) : (
              <Button
                size="sm"
                data-testid={`disclosure-${d.versionId}`}
                disabled={busy}
                onClick={() => void read(d)}
              >
                {t('app.onboarding.read_and_accept')}
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
            {t('app.onboarding.i_accept')}
          </Button>
        }
      >
        <p>{open?.text}</p>
        {error && <Notice status="failure">{error}</Notice>}
      </Modal>
    </>
  );
}

const DOCUMENTS: Array<{ value: IdDocument; key: string }> = [
  { value: 'DRIVERS_LICENSE', key: 'app.onboarding.doc_drivers_license' },
  { value: 'PASSPORT', key: 'app.onboarding.doc_passport' },
  { value: 'ID_CARD', key: 'app.onboarding.doc_id_card' },
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
  if (c.stage === 'WAITING') return { status: 'pending', text: t('app.onboarding.capture_waiting') };
  if (c.stage === 'CAPTURED') return { status: 'pending', text: t('app.onboarding.capture_captured') };
  const k = (c.kycStatus ?? '').toUpperCase();
  if (k === 'ACCEPTED') return { status: 'success', text: t('app.onboarding.capture_verified') };
  if (k === 'REJECTED') return { status: 'failure', text: t('app.onboarding.capture_rejected') };
  return { status: 'pending', text: t('app.onboarding.capture_reviewing') };
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
    const timer = setInterval(() => void check(), ID_CAPTURE_POLL_MS);
    return () => clearInterval(timer);
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
        else if (c.captureUrl) setError(t('app.onboarding.capture_bad_url'));
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
    <Card title={t('app.onboarding.capture_title')}>
      <p>{t('app.onboarding.capture_intro')}</p>
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
          <span data-testid="id-capture-sms-sent">{t('app.onboarding.capture_sms_sent')}</span>
        </Notice>
      )}
      {link && (
        <Notice status="info">
          <a data-testid="id-capture-open" href={link} target="_blank" rel="noopener noreferrer">
            {t('app.onboarding.capture_open')}
          </a>{' '}
          {t('app.onboarding.capture_open_note')}
        </Notice>
      )}
      {api.kind === 'demo' && capture && !capture.smsRequested && !link && !done && (
        <Notice status="info">{t('app.onboarding.capture_demo')}</Notice>
      )}
      {error && <Notice status="failure">{error}</Notice>}
      {!done && (
        <div className="fw-form">
          <Field label={t('app.onboarding.document')}>
            <Select
              data-testid="id-capture-document"
              value={document}
              options={DOCUMENTS.map((d) => ({ value: d.value, label: t(d.key) }))}
              onChange={(v) => setDocument(v as IdDocument)}
            />
          </Field>
          <Button data-testid="id-capture-browser" disabled={busy} onClick={() => void start(false)}>
            {t('app.onboarding.capture_browser')}
          </Button>
          <Button
            variant="secondary"
            data-testid="id-capture-sms"
            disabled={busy}
            onClick={() => void start(true)}
          >
            {t('app.onboarding.capture_sms')}
          </Button>
          {capture && (
            <Button variant="secondary" data-testid="id-capture-check" onClick={() => void check()}>
              {t('app.onboarding.capture_check')}
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
  // OG-069: the share at or above which owners are listed and verified, as configured in ongem-core.
  const threshold = useAsync(() => api.ownerThreshold(), [api]);
  // OG-070: the onboarding rules in force (ID types, owner limit), configuration in ongem-core.
  const rules = useAsync(() => api.onboardingRules(), [api]);
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
      <PageHeader title={t('app.onboarding.title')} subtitle={t('app.onboarding.subtitle')} />
      <Load state={apps} label="application">
        {(list) => {
          const app = list[0];
          if (!app) return <Notice status="info">{t('app.onboarding.no_application')}</Notice>;
          const missing = app.owners.filter((o) => app.requirements.includes(`owner_id_missing:${o.id}`));
          const discs = disclosures.status === 'success' ? disclosures.data : [];
          const idTypes =
            rules.status === 'success' ? acceptedOwnerIds(rules.data.identifiers.ownerIdTypes) : [];
          const maxOwners = rules.status === 'success' ? rules.data.ownerLimits.maxOwners : null;
          const overLimit = maxOwners !== null && app.owners.length > maxOwners;
          const allAccepted = discs.every((d) => d.acknowledged);
          return (
            <>
              <Card
                title={
                  <>
                    {t('app.onboarding.status')}{' '}
                    <StatusChip status={stateStatus(app.state)}>
                      <span data-testid="application-state">{applicationLabel(app.state)}</span>
                    </StatusChip>
                  </>
                }
              >
                <Stepper
                  label={t('app.onboarding.steps')}
                  items={[
                    {
                      id: 'owners',
                      label: t('app.onboarding.step_owners'),
                      statusText: t(missing.length ? 'app.onboarding.to_do' : 'app.onboarding.done'),
                      status: missing.length ? 'pending' : 'success',
                      current: missing.length > 0,
                    },
                    {
                      id: 'confirm',
                      label: t('app.onboarding.confirm_details'),
                      statusText: t(
                        app.state === 'COLLECTING' ? 'app.onboarding.to_do' : 'app.onboarding.done',
                      ),
                      status: app.state === 'COLLECTING' ? 'pending' : 'success',
                    },
                    {
                      id: 'disclosures',
                      label: t('app.onboarding.disclosures'),
                      statusText: t(allAccepted ? 'app.onboarding.done' : 'app.onboarding.to_do'),
                      status: allAccepted ? 'success' : 'pending',
                    },
                    {
                      id: 'submit',
                      label: t('app.onboarding.submit'),
                      statusText: applicationLabel(app.state),
                      status: stateStatus(app.state),
                    },
                  ]}
                />
              </Card>
              {WAITING.includes(app.state) && (
                <Notice status="info">
                  <span role="status" aria-live="polite" data-testid="bank-waiting">
                    {t('app.onboarding.bank_waiting')}
                  </span>
                </Notice>
              )}
              {error && <Notice status="failure">{error}</Notice>}
              {WAITING.includes(app.state) && <IdCaptureCard app={app} />}
              <Card title={t('app.onboarding.owners')}>
                {threshold.status === 'success' && (
                  <p className="fw-hint" data-testid="owners-threshold">
                    {t('app.onboarding.owners_threshold', {
                      percent: String(threshold.data.collectAtOrAbove),
                    })}
                  </p>
                )}
                <ul className="fw-list">
                  {app.owners.map((o) => (
                    <li key={o.id} className="fw-row fw-row--stack" data-testid={`owner-row-${o.id}`}>
                      <span className="fw-row__main">
                        <strong>{o.name}</strong>
                        <span className="fw-row__sub">
                          {o.ownershipPercent}%{' '}
                          {o.idLast4 ? (
                            <span data-mask="">{t('app.onboarding.id_ending', { last4: o.idLast4 })}</span>
                          ) : missing.includes(o) ? (
                            t('app.onboarding.id_needed')
                          ) : (
                            t('app.onboarding.id_not_required')
                          )}
                        </span>
                      </span>
                      {missing.includes(o) && idTypes.length > 0 && (
                        <OwnerId app={app} ownerId={o.id} types={idTypes} onDone={refresh} />
                      )}
                    </li>
                  ))}
                </ul>
                {missing.length > 0 && rules.status !== 'loading' && idTypes.length === 0 && (
                  <Notice
                    status="failure"
                    action={
                      <Button variant="secondary" onClick={rules.reload}>
                        {t('app.common.try_again')}
                      </Button>
                    }
                  >
                    <span data-testid="owner-id-types-unavailable">
                      {t('app.onboarding.id_types_unavailable')}
                    </span>
                  </Notice>
                )}
              </Card>
              {app.state === 'COLLECTING' && overLimit && (
                <Notice status="failure">
                  <span data-testid="owner-limit">
                    {t('app.onboarding.owner_limit', {
                      max: String(maxOwners),
                      count: String(app.owners.length),
                    })}
                  </span>
                </Notice>
              )}
              {app.state === 'COLLECTING' && (
                <Button
                  data-testid="application-confirm"
                  disabled={busy || missing.length > 0 || overLimit}
                  onClick={() => act(() => api.confirmApplication(app.id))}
                >
                  {t('app.onboarding.confirm_details')}
                </Button>
              )}
              {app.state === 'READY_FOR_DISCLOSURES' && (
                <Card title={t('app.onboarding.disclosures')}>
                  <Disclosures list={discs} onDone={refresh} />
                  <Button
                    data-testid="application-submit"
                    disabled={busy || !allAccepted}
                    onClick={() => act(() => api.submitApplication(app.id))}
                  >
                    {t('app.onboarding.submit')}
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
