import { Fragment, useRef, useState } from 'react';
import { errorText } from '../api/errors';
import type { KindPreference, NotificationPreferences, PreferenceChange } from '../api/types';
import { Button, Card, Field, Input, Notice } from '../design-system';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { FilterChips, Load } from './common';
import { has, t } from '../i18n';

type Scope = 'person' | 'company';
type Channel = 'inApp' | 'email' | 'sms' | 'push';
const CHANNELS: Channel[] = ['inApp', 'email', 'sms', 'push'];

/** A category's name in the reader's language; the API's word when the content has none yet. */
export function categoryLabel(category: string | undefined): string {
  const k = `app.notifications.category.${(category ?? 'other').toLowerCase()}`;
  return has(k) ? t(k) : t('app.notifications.category.other');
}

/** The kinds in the order the API lists them, grouped by category (OG-014 1.2). */
export function byCategory(kinds: KindPreference[]): Array<[string | undefined, KindPreference[]]> {
  const groups = new Map<string | undefined, KindPreference[]>();
  for (const k of kinds) groups.set(k.category, [...(groups.get(k.category) ?? []), k]);
  return [...groups.entries()];
}

/** In-app and email of a mandatory kind are always on (422 mandatory_kind); SMS waits for a verified number. */
function locked(k: KindPreference, c: Channel, smsVerified: boolean) {
  if (k.mandatory && (c === 'inApp' || c === 'email')) return true;
  return c === 'sms' && !smsVerified;
}

function value(k: KindPreference, c: Channel): boolean {
  if (k.mandatory && (c === 'inApp' || c === 'email')) return true;
  if (c === 'inApp') return k.inApp ?? true;
  if (c === 'push') return k.push ?? true;
  return k[c];
}

/**
 * OG-014 choices (M-3-R33, R34; contract 2026-11-20 1.3): per kind and channel (in app, email, SMS, push), either the
 * person's own choices for every company, or this company's override with where each choice comes from and a reset to
 * the person's choices. One change is saved at a time; SMS only after the number is verified with its 6-digit code.
 */
export function NotificationChoices() {
  const { api, companies, companyId, currentCompanyId } = useSession();
  const [scope, setScope] = useState<Scope>('person');
  const loaded = useAsync(
    () => (scope === 'company' ? api.companyNotificationPreferences() : api.notificationPreferences()),
    [api, scope],
  );
  const [prefs, setPrefs] = useState<{ scope: Scope; value: NotificationPreferences } | null>(null);
  const [number, setNumber] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const company = companies.find((c) => c.companyId === (companyId ?? currentCompanyId))?.companyName;
  const once = async (f: () => Promise<NotificationPreferences>, into: Scope = scope) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      setPrefs({ scope: into, value: await f() });
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const change = (c: PreferenceChange) =>
    void once(() =>
      scope === 'company' ? api.setCompanyNotificationPreferences([c]) : api.setNotificationPreferences([c]),
    );
  return (
    <Card title={t('app.notifications.title')} data-testid="notice-choices">
      <p className="fw-row__sub">{t('app.notifications.choices.intro_channels')}</p>
      <FilterChips
        label={t('app.notifications.choices.scope')}
        testId="pref-scope"
        value={scope}
        onChange={(id) => {
          setScope(id as Scope);
          setError(null);
        }}
        options={[
          { id: 'person', label: t('app.notifications.choices.scope_person') },
          {
            id: 'company',
            label: company
              ? t('app.notifications.choices.scope_company_named', { company })
              : t('app.notifications.choices.scope_company'),
          },
        ]}
      />
      <Load state={loaded} label="notification choices">
        {(first) => {
          const p = prefs && prefs.scope === scope ? prefs.value : first;
          const overridden = p.kinds.some((k) => k.source === 'COMPANY');
          return (
            <>
              {scope === 'company' && (
                <div className="fw-actions">
                  <p className="fw-row__sub">{t('app.notifications.choices.company_intro')}</p>
                  <Button
                    variant="secondary"
                    data-testid="pref-reset-company"
                    disabled={busy || !overridden}
                    onClick={() => void once(() => api.resetCompanyNotificationPreferences())}
                  >
                    {t('app.notifications.choices.reset_company')}
                  </Button>
                </div>
              )}
              <div
                className="fw-prefs fw-prefs--channels"
                role="group"
                aria-label={t('app.notifications.choices.group_channels')}
              >
                <span className="fw-prefs__head">{t('app.notifications.choices.notice')}</span>
                {CHANNELS.map((c) => (
                  <span key={c} className="fw-prefs__head">
                    {t(`app.notifications.choices.channel.${c.toLowerCase()}`)}
                  </span>
                ))}
                {byCategory(p.kinds).map(([category, kinds]) => (
                  <Fragment key={category ?? 'other'}>
                    {category && (
                      <span className="fw-prefs__group" data-testid={`pref-group-${category}`}>
                        {categoryLabel(category)}
                      </span>
                    )}
                    {kinds.map((k) => (
                      <div key={k.kind} className="fw-prefs__row">
                        <span>
                          {k.label}
                          {k.mandatory && (
                            <span className="fw-prefs__source">
                              {t('app.notifications.choices.always_on')}
                            </span>
                          )}
                          {scope === 'company' && k.source && (
                            <span className="fw-prefs__source" data-testid={`pref-source-${k.kind}`}>
                              {t(`app.notifications.choices.source.${k.source.toLowerCase()}`)}
                            </span>
                          )}
                        </span>
                        {CHANNELS.map((c) => (
                          <label key={c} className="fw-toggle">
                            <input
                              type="checkbox"
                              role="switch"
                              className="fw-toggle__input"
                              aria-label={t(`app.notifications.choices.by_${c.toLowerCase()}`, {
                                kind: k.label,
                              })}
                              data-testid={`pref-${c === 'inApp' ? 'inapp' : c}-${k.kind}`}
                              checked={value(k, c)}
                              disabled={busy || locked(k, c, p.smsVerified)}
                              onChange={(e) => change({ kind: k.kind, [c]: e.target.checked })}
                            />
                          </label>
                        ))}
                      </div>
                    ))}
                  </Fragment>
                ))}
              </div>
              <p className="fw-row__sub">{t('app.notifications.choices.push_note')}</p>
              {scope === 'person' && (
                <div className="fw-form">
                  <p data-testid="sms-state">
                    {p.smsNumberLast4
                      ? t(
                          p.smsVerified
                            ? 'app.notifications.choices.sms_verified'
                            : 'app.notifications.choices.sms_unverified',
                          { last4: p.smsNumberLast4 },
                        )
                      : t('app.notifications.choices.sms_none')}
                  </p>
                  <Field
                    label={t('app.notifications.choices.sms_number')}
                    hint={t('app.notifications.choices.sms_number_hint')}
                  >
                    <Input
                      data-testid="sms-number"
                      inputMode="tel"
                      autoComplete="tel"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                    />
                  </Field>
                  <div className="fw-actions">
                    <Button
                      variant="secondary"
                      data-testid="sms-number-save"
                      disabled={busy || !number.trim()}
                      onClick={() =>
                        void once(() => api.setSmsNumber(number.trim()), 'person').then((ok) => {
                          if (ok) {
                            setCodeSent(true);
                            setCode('');
                          }
                        })
                      }
                    >
                      {t('app.notifications.choices.send_code')}
                    </Button>
                  </div>
                  {codeSent && !p.smsVerified && (
                    <>
                      <Field
                        label={t('app.notifications.choices.code')}
                        hint={t('app.notifications.choices.code_hint')}
                      >
                        <Input
                          data-testid="sms-code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          value={code}
                          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        />
                      </Field>
                      <div className="fw-actions">
                        <Button
                          data-testid="sms-code-verify"
                          disabled={busy || code.length !== 6}
                          onClick={() => void once(() => api.verifySmsNumber(code), 'person')}
                        >
                          {t('app.notifications.choices.verify')}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
              {error && <Notice status="failure">{error}</Notice>}
            </>
          );
        }}
      </Load>
    </Card>
  );
}
