import { Button, Card, KeyValue, PageHeader, Select, StatusChip, useTheme } from '../design-system';
import { useAsync } from '../lib/useAsync';
import { LanguageSwitch, t } from '../i18n';
import { privacyLine } from '../recording/Recorder';
import { useSession } from '../session';
import { human, stateStatus } from './common';
import { NotificationChoices } from './NotificationChoices';

export function SettingsScreen() {
  const { api, mode, role, leave } = useSession();
  const { theme, themes, setTheme } = useTheme();
  // G-157: the person's identity state at the bank (it moved here from Home's company card, OG-035 R1).
  const me = useAsync(() => api.me(), [api]);
  const bankState = me.status === 'success' ? (me.data.providerState ?? 'NOT_SUBMITTED') : null;
  return (
    <>
      <PageHeader title={t('app.settings.title')} />
      <Card title={t('app.settings.language.title')} data-testid="settings-language">
        <LanguageSwitch variant="choice" onChange={(l) => void api.setLocale(l).catch(() => undefined)} />
      </Card>
      <Card title={t('app.settings.appearance')}>
        <label>
          <span className="og-visually-hidden">{t('app.settings.theme')}</span>
          <Select
            aria-label={t('app.settings.theme')}
            value={theme.id}
            onChange={(e) => setTheme(e.target.value)}
            options={themes.map((t) => ({ value: t.id, label: t.name }))}
          />
        </label>
      </Card>
      <NotificationChoices />
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
    </>
  );
}
