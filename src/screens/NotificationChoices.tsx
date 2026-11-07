import { useRef, useState } from 'react';
import { errorText } from '../api/errors';
import type { NotificationPreferences, PreferenceChange } from '../api/types';
import { Button, Card, Field, Input, Notice } from '../design-system';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { Load } from './common';

/**
 * OG-014 choices (M-3-R33, R34): email and SMS per kind, saved one change at a time; a mandatory kind's email is on and
 * cannot be turned off; SMS only after the number is verified with its 6-digit code.
 */
export function NotificationChoices() {
  const { api } = useSession();
  const loaded = useAsync(() => api.notificationPreferences(), [api]);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [number, setNumber] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const once = async (f: () => Promise<NotificationPreferences>) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      setPrefs(await f());
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const change = (c: PreferenceChange) => void once(() => api.setNotificationPreferences([c]));
  return (
    <Card title="Notifications" data-testid="notice-choices">
      <Load state={loaded} label="notification choices">
        {(first) => {
          const p = prefs ?? first;
          return (
            <>
              <p className="fw-row__sub">
                Every notice is in Notifications. Choose which also reach you by email or SMS. Some always go
                by email because they are about your money or your account.
              </p>
              <div className="fw-prefs" role="group" aria-label="Email and SMS per notice">
                <span className="fw-prefs__head">Notice</span>
                <span className="fw-prefs__head">Email</span>
                <span className="fw-prefs__head">SMS</span>
                {p.kinds.map((k) => (
                  <div key={k.kind} className="fw-prefs__row">
                    <span>
                      {k.label}
                      {k.mandatory && <span className="fw-row__sub"> (always by email)</span>}
                    </span>
                    <input
                      type="checkbox"
                      aria-label={`${k.label} by email`}
                      data-testid={`pref-email-${k.kind}`}
                      checked={k.email || k.mandatory}
                      disabled={busy || k.mandatory}
                      onChange={(e) => change({ kind: k.kind, email: e.target.checked })}
                    />
                    <input
                      type="checkbox"
                      aria-label={`${k.label} by SMS`}
                      data-testid={`pref-sms-${k.kind}`}
                      checked={k.sms}
                      disabled={busy || !p.smsVerified}
                      onChange={(e) => change({ kind: k.kind, sms: e.target.checked })}
                    />
                  </div>
                ))}
              </div>
              <div className="fw-form">
                <p data-testid="sms-state">
                  {p.smsNumberLast4
                    ? `SMS number ending ${p.smsNumberLast4}${p.smsVerified ? ', verified' : ', not verified yet'}.`
                    : 'No SMS number yet. Add one to get texts.'}
                </p>
                <Field label="SMS number" hint="International form, like +15551234567.">
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
                      void once(() => api.setSmsNumber(number.trim())).then((ok) => {
                        if (ok) {
                          setCodeSent(true);
                          setCode('');
                        }
                      })
                    }
                  >
                    Send code
                  </Button>
                </div>
                {codeSent && !p.smsVerified && (
                  <>
                    <Field label="Code from the text" hint="6 digits. It works for 10 minutes and 5 tries.">
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
                        onClick={() => void once(() => api.verifySmsNumber(code))}
                      >
                        Verify number
                      </Button>
                    </div>
                  </>
                )}
                {error && <Notice status="failure">{error}</Notice>}
              </div>
            </>
          );
        }}
      </Load>
    </Card>
  );
}
