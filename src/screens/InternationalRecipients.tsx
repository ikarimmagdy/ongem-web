import { useRef, useState, type ReactNode } from 'react';
import { Permission } from '../api/client';
import { errorText } from '../api/errors';
import type { Corridor, InternationalRecipient } from '../api/types';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Notice,
  Select,
  StatusChip,
  useToast,
} from '../design-system';
import {
  recipientFormErrors,
  recipientRequest,
  schemeFor,
  type RecipientErrors,
  type RecipientFieldName,
  type RecipientForm,
} from '../lib/bankDetails';
import { corridorLabel, countryName } from '../lib/fx';
import { useAsync } from '../lib/useAsync';
import { t } from '../i18n';
import { useSession } from '../session';
import { Last4, Load, human, stateStatus } from './common';

const EMPTY: RecipientForm = {
  kind: 'BUSINESS',
  name: '',
  iban: '',
  bic: '',
  sortCode: '',
  routingNumber: '',
  accountNumber: '',
  localScheme: '',
  bankCode: '',
  line1: '',
  city: '',
  postalCode: '',
};

/** The sentence under a field for the API's code: a missing field, else what that field must be. */
export function fieldError(field: RecipientFieldName, code: string | undefined): string | undefined {
  if (!code) return undefined;
  if (code === 'recipient_field_required') return t('app.fx.recipient.error.required');
  return t(`app.fx.recipient.error.${field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}`);
}

/** A recipient abroad in one line: country and currency, how they are paid, the last 4 only. */
export function recipientLine(r: InternationalRecipient): ReactNode {
  return (
    <>
      {t('app.fx.recipient.row', { country: countryName(r.country), currency: r.currency })}{' '}
      <Last4 value={r.accountLast4} />
    </>
  );
}

/**
 * OG-054: a beneficiary abroad with the fields the chosen corridor needs (IBAN, BIC, sort code, ABA, local code,
 * address), checked here as the API checks them, then saved with step-up (purpose recipient).
 */
export function AddInternationalRecipient({
  corridors,
  corridorId,
  onAdded,
  onCancel,
}: {
  corridors: Corridor[];
  corridorId?: string;
  onAdded(r: InternationalRecipient): void;
  onCancel?(): void;
}) {
  const { api } = useSession();
  const toast = useToast();
  const [chosen, setChosen] = useState(corridorId ?? '');
  const [form, setForm] = useState<RecipientForm>(EMPTY);
  const [errors, setErrors] = useState<RecipientErrors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const inFlight = useRef(false);
  const corridor = corridors.find((c) => c.id === chosen);
  const set = (k: keyof RecipientForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => {
    if (!corridor || inFlight.current) {
      setErrors({});
      return;
    }
    const errs = recipientFormErrors(form, corridor);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    inFlight.current = true;
    setBusy(true);
    setFailure(null);
    try {
      const r = await api.createInternationalRecipient(recipientRequest(form, corridor));
      setForm(EMPTY);
      toast.show(t('app.recipients.added', { name: r.name, screening: human(r.screening) }), 'success');
      onAdded(r);
    } catch (e) {
      setFailure(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const scheme = corridor ? schemeFor(corridor.requiredFields) : null;
  const needs = (f: string) => Boolean(corridor?.requiredFields.includes(f));
  const text = (field: keyof RecipientForm, label: string, opts: { hint?: string; upper?: boolean } = {}) => (
    <Field
      label={label}
      hint={opts.hint}
      error={fieldError(field as RecipientFieldName, errors[field as RecipientFieldName])}
    >
      <Input
        data-testid={`intl-${field}`}
        data-mask=""
        autoComplete="off"
        value={form[field]}
        onChange={(e) => set(field)(opts.upper ? e.target.value.toUpperCase() : e.target.value)}
      />
    </Field>
  );
  return (
    <form
      className="fw-form"
      noValidate
      data-testid="intl-recipient-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Field label={t('app.fx.recipient.corridor')} hint={t('app.fx.recipient.corridor_hint')}>
        <Select
          data-testid="intl-corridor"
          value={chosen}
          onChange={(v) => {
            setChosen(v);
            setErrors({});
          }}
          options={[
            { value: '', label: t('app.fx.recipient.choose_corridor') },
            ...corridors.map((c) => ({ value: c.id, label: corridorLabel(c) })),
          ]}
        />
      </Field>
      {corridor && (
        <>
          <Field label={t('app.fx.recipient.kind')}>
            <Select
              data-testid="intl-kind"
              value={form.kind}
              onChange={(v) => set('kind')(v)}
              options={[
                { value: 'BUSINESS', label: t('app.fx.recipient.kind_business') },
                { value: 'PERSON', label: t('app.fx.recipient.kind_person') },
              ]}
            />
          </Field>
          <Field label={t('app.recipients.name_label')} error={fieldError('name', errors.name)}>
            <Input data-testid="intl-name" value={form.name} onChange={(e) => set('name')(e.target.value)} />
          </Field>
          {scheme === 'IBAN' &&
            text('iban', t('app.fx.recipient.iban'), {
              upper: true,
              hint: t('app.fx.recipient.iban_hint', { country: countryName(corridor.destinationCountry) }),
            })}
          {scheme === 'UK_SORT_CODE' && (
            <>
              {text('sortCode', t('app.fx.recipient.sort_code'), {
                hint: t('app.fx.recipient.sort_code_hint'),
              })}
              {text('accountNumber', t('app.fx.recipient.account_number'), {
                hint: t('app.fx.recipient.uk_account_hint'),
              })}
            </>
          )}
          {scheme === 'US_ABA' && (
            <>
              {text('routingNumber', t('app.fx.recipient.routing_number'))}
              {text('accountNumber', t('app.fx.recipient.account_number'))}
            </>
          )}
          {scheme === 'LOCAL' && (
            <>
              {text('localScheme', t('app.fx.recipient.local_scheme'), {
                hint: t('app.fx.recipient.local_scheme_hint'),
                upper: true,
              })}
              {text('bankCode', t('app.fx.recipient.bank_code'), { upper: true })}
              {text('accountNumber', t('app.fx.recipient.account_number'), { upper: true })}
            </>
          )}
          {(needs('BIC') || scheme === 'IBAN') &&
            text('bic', needs('BIC') ? t('app.fx.recipient.bic') : t('app.fx.recipient.bic_optional'), {
              upper: true,
              hint: t('app.fx.recipient.bic_hint'),
            })}
          {needs('ADDRESS') && (
            <fieldset className="fw-fieldset" data-testid="intl-address">
              <legend>
                {t('app.fx.recipient.address', { country: countryName(corridor.destinationCountry) })}
              </legend>
              {(['line1', 'city', 'postalCode'] as const).map((k) => (
                <Field key={k} label={t(`app.fx.recipient.address_${k.toLowerCase()}`)}>
                  <Input data-testid={`intl-${k}`} value={form[k]} onChange={(e) => set(k)(e.target.value)} />
                </Field>
              ))}
              {errors.address && (
                <p className="og-field__error" role="alert">
                  {fieldError('address', errors.address)}
                </p>
              )}
            </fieldset>
          )}
        </>
      )}
      {failure && <Notice status="failure">{failure}</Notice>}
      <div className="fw-actions">
        {onCancel && (
          <Button variant="secondary" type="button" disabled={busy} onClick={onCancel}>
            {t('app.fx.cancel')}
          </Button>
        )}
        <Button type="submit" data-testid="intl-save" disabled={busy || !corridor}>
          {t('app.fx.recipient.save')}
        </Button>
      </div>
    </form>
  );
}

/** International recipients beside the domestic ones (Payments > Recipients), shown when corridors are offered. */
export function InternationalRecipients({ corridors }: { corridors: Corridor[] }) {
  const { api, can } = useSession();
  const [n, setN] = useState(0);
  const list = useAsync(() => api.internationalRecipients(), [api, n]);
  const [adding, setAdding] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);
  const manage = can(Permission.RECIPIENT_MANAGE);
  const archive = (id: string) => {
    if (archiving) return;
    setArchiving(id);
    setFailure(null);
    api
      .archiveInternationalRecipient(id)
      .then(
        () => setN((x) => x + 1),
        (e) => setFailure(errorText(e)),
      )
      .finally(() => setArchiving(null));
  };
  return (
    <Card
      title={t('app.fx.recipient.title')}
      data-testid="intl-recipients"
      actions={
        manage && corridors.length > 0 ? (
          <Button size="sm" variant="secondary" data-testid="intl-add" onClick={() => setAdding((x) => !x)}>
            {t('app.fx.recipient.add')}
          </Button>
        ) : undefined
      }
    >
      <p className="fw-row__sub">{t('app.fx.recipient.subtitle')}</p>
      {adding && manage && (
        <AddInternationalRecipient
          corridors={corridors}
          onCancel={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            setN((x) => x + 1);
          }}
        />
      )}
      {failure && <Notice status="failure">{failure}</Notice>}
      <Load state={list} label="recipients">
        {(rows) =>
          rows.length ? (
            <ul className="fw-list" data-testid="intl-recipients-list">
              {rows.map((r) => (
                <li key={r.id} className="fw-row" data-testid={`intl-recipient-${r.id}`}>
                  <span className="fw-row__main">
                    <strong>{r.name}</strong>
                    <span className="fw-row__sub">{recipientLine(r)}</span>
                  </span>
                  <span className="fw-actions">
                    <StatusChip status={stateStatus(r.screening)}>{human(r.screening)}</StatusChip>
                    {manage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t('app.recipients.archive_named', { name: r.name })}
                        data-testid={`intl-archive-${r.id}`}
                        disabled={archiving !== null}
                        onClick={() => archive(r.id)}
                      >
                        {t('app.recipients.archive')}
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t('app.fx.recipient.empty_title')}>
              {t('app.fx.recipient.empty_text')}
            </EmptyState>
          )
        }
      </Load>
    </Card>
  );
}
