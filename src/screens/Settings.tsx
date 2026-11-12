import { useState } from 'react';
import { errorText } from '../api/errors';
import type { DeviceView } from '../api/types';
import { Button, Card, KeyValue, Notice, PageHeader, StatusChip, useTheme } from '../design-system';
import { useAsync } from '../lib/useAsync';
import { DARK_THEME, useAppearance, type Appearance } from '../lib/appearance';
import { formatDate } from '../lib/format';
import { LanguageSwitch, t } from '../i18n';
import { privacyLine } from '../recording/Recorder';
import { useSession } from '../session';
import { Load, human, stateStatus } from './common';
import { lastSignInText, signInDevice, signInLine } from '../lib/signins';

/** FA-055: the sign-in before this session, beside the bank disclosure; nothing while it loads or when it fails. */
export function LastSignIn({ testId, className }: { testId: string; className?: string }) {
  const { api } = useSession();
  const summary = useAsync(() => api.securitySummary(), [api]);
  if (summary.status !== 'success') return null;
  return (
    <p className={className ?? 'fw-row__sub'} data-testid={testId}>
      {lastSignInText(summary.data.lastSignIn)}
    </p>
  );
}

/** FA-030: Light, Dark or System as one choice; another brand's white-label theme is never offered to a founder. */
function AppearanceChoice() {
  const { themes } = useTheme();
  const [appearance, setAppearance] = useAppearance();
  const options: Appearance[] = themes.some((x) => x.id === DARK_THEME)
    ? ['light', 'dark', 'system']
    : ['light'];
  return (
    <div
      className="fw-segmented"
      role="radiogroup"
      aria-label={t('app.settings.theme')}
      data-testid="appearance-choice"
    >
      {options.map((a) => (
        <button
          key={a}
          type="button"
          role="radio"
          aria-checked={a === appearance}
          className={a === appearance ? 'fw-segmented__item is-active' : 'fw-segmented__item'}
          data-testid={`appearance-${a}`}
          onClick={() => setAppearance(a)}
        >
          {t(`app.settings.appearance_choice.${a}`)}
        </button>
      ))}
    </div>
  );
}

/** FA-029: the authenticator and the recent sign-ins (GET /v1/me/security), with what to do about one not recognised. */
function SignInsSummary() {
  const { api } = useSession();
  const summary = useAsync(() => api.securitySummary(), [api]);
  if (summary.status === 'error')
    return (
      <Notice status="failure">
        <span data-testid="security-error">{t('app.settings.security.sign_ins_error')}</span>
      </Notice>
    );
  return (
    <Load state={summary} label="sign-ins">
      {(s) => (
        <>
          <KeyValue
            items={[
              {
                label: t('app.settings.security.authenticator'),
                value: (
                  <span data-testid="security-authenticator">
                    {s.authenticator.status === 'ON'
                      ? t('app.settings.security.authenticator_on')
                      : s.authenticator.status === 'OFF'
                        ? t('app.settings.security.authenticator_off')
                        : t('app.settings.security.authenticator_unknown')}
                  </span>
                ),
              },
            ]}
          />
          <h3 className="fw-subhead">{t('app.settings.security.sign_ins')}</h3>
          {s.recentSignIns.length ? (
            <ul className="fw-divided" data-testid="sign-in-list">
              {s.recentSignIns.map((x, i) => (
                <li key={`${x.at}-${i}`} className="fw-divided__row" data-testid={`sign-in-${i}`}>
                  <span className="fw-row__main">
                    <strong>{signInDevice(x)}</strong>
                    <span className="fw-row__sub">{signInLine(x)}</span>
                  </span>
                  {x.current && (
                    <StatusChip status="info">{t('app.settings.security.sign_in_current')}</StatusChip>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="fw-row__sub">{t('app.settings.security.sign_ins_empty')}</p>
          )}
          <p className="fw-row__sub" data-testid="security-not-you">
            {t('app.settings.security.not_you')}
          </p>
        </>
      )}
    </Load>
  );
}

/** FA-029: Security: the devices bound to this person (GET /v1/devices), when each was last used, and Sign out. */
function SecuritySection() {
  const { api } = useSession();
  const [n, setN] = useState(0);
  const devices = useAsync(() => api.devices(), [api, n]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const revoke = async (d: DeviceView) => {
    setBusy(d.id);
    setError(null);
    try {
      await api.revokeDevice(d.id);
      setN((x) => x + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card title={t('app.settings.security.title')} data-testid="settings-security">
      <SignInsSummary />
      <h3 className="fw-subhead">{t('app.settings.security.devices')}</h3>
      <p className="fw-row__sub">{t('app.settings.security.intro')}</p>
      {error && <Notice status="failure">{error}</Notice>}
      <Load state={devices} label="devices">
        {(list) =>
          list.length ? (
            <ul className="fw-divided" data-testid="device-list">
              {list.map((d) => (
                <li key={d.id} className="fw-divided__row" data-testid={`device-${d.id}`}>
                  <span className="fw-row__main">
                    <strong>{d.name ?? d.model ?? human(d.platform)}</strong>
                    <span className="fw-row__sub">
                      {d.revokedAt
                        ? t('app.settings.security.revoked_on', { date: formatDate(d.revokedAt) })
                        : d.current
                          ? t('app.settings.security.this_device')
                          : d.lastSeenAt
                            ? t('app.settings.security.last_used', { date: formatDate(d.lastSeenAt) })
                            : t('app.settings.security.added_on', { date: formatDate(d.createdAt) })}
                    </span>
                  </span>
                  {!d.current && !d.revokedAt && (
                    <Button
                      variant="secondary"
                      data-testid={`device-revoke-${d.id}`}
                      disabled={busy !== null}
                      onClick={() => void revoke(d)}
                    >
                      {t('app.settings.security.sign_out_device')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="fw-row__sub">{t('app.settings.security.empty')}</p>
          )
        }
      </Load>
    </Card>
  );
}
import { NotificationChoices } from './NotificationChoices';

export function SettingsScreen() {
  const { api, mode, role, leave } = useSession();
  // G-157: the person's identity state at the bank (it moved here from Home's company card, OG-035 R1).
  const me = useAsync(() => api.me(), [api]);
  const bankState = me.status === 'success' ? (me.data.providerState ?? 'NOT_SUBMITTED') : null;
  return (
    <>
      <PageHeader title={t('app.settings.title')} />
      {/* OG-040: settings read as one column at a form's width, not stretched across a wide screen. */}
      <div className="fw-settings">
        <Card title={t('app.settings.language.title')} data-testid="settings-language">
          <LanguageSwitch variant="choice" onChange={(l) => void api.setLocale(l).catch(() => undefined)} />
        </Card>
        <Card title={t('app.settings.appearance')}>
          <AppearanceChoice />
        </Card>
        <NotificationChoices />
        <SecuritySection />
        <Card title={t('app.settings.privacy')}>
          <p className="fw-privacy" data-testid="privacy-line">
            {privacyLine()}
          </p>
        </Card>
        <Card title={t('app.settings.session')}>
          <KeyValue
            items={[
              {
                label: t('app.settings.mode'),
                value: mode === 'demo' ? t('app.settings.mode_demo') : t('app.settings.mode_live'),
              },
              { label: t('app.settings.role'), value: role ? human(role) : t('app.settings.role_none') },
              ...(bankState
                ? [
                    {
                      label: t('app.home.identity_at_bank'),
                      value: (
                        <StatusChip status={stateStatus(bankState)}>
                          <span data-testid="home-verification">{human(bankState)}</span>
                        </StatusChip>
                      ),
                    },
                  ]
                : []),
            ]}
          />
          <div className="fw-actions">
            <Button variant="secondary" data-testid="sign-out" onClick={leave}>
              {mode === 'demo' ? t('app.settings.leave_demo') : t('app.common.sign_out')}
            </Button>
          </div>
        </Card>
        <Card title={t('app.settings.bank.title')}>
          <p data-testid="settings-disclosure">{t('app.shell.disclosure')}</p>
          <LastSignIn testId="settings-last-sign-in" />
        </Card>
      </div>
    </>
  );
}
