import { Button, Card, KeyValue, PageHeader, Select, useTheme } from '../design-system';
import { PRIVACY_LINE } from '../recording/Recorder';
import { useSession } from '../session';
import { human } from './common';
import { NotificationChoices } from './NotificationChoices';

export function SettingsScreen() {
  const { mode, role, leave } = useSession();
  const { theme, themes, setTheme } = useTheme();
  return (
    <>
      <PageHeader title="Settings" />
      <Card title="Appearance">
        <label>
          <span className="og-visually-hidden">Theme</span>
          <Select
            aria-label="Theme"
            value={theme.id}
            onChange={(e) => setTheme(e.target.value)}
            options={themes.map((t) => ({ value: t.id, label: t.name }))}
          />
        </label>
      </Card>
      <NotificationChoices />
      <Card title="Privacy">
        <p className="fw-privacy" data-testid="privacy-line">
          {PRIVACY_LINE}
        </p>
      </Card>
      <Card title="Session">
        <KeyValue
          items={[
            { label: 'Mode', value: mode === 'demo' ? 'Demo, sample data' : 'Live' },
            { label: 'Role', value: role ? human(role) : 'None' },
          ]}
        />
        <div className="fw-actions">
          <Button variant="secondary" data-testid="sign-out" onClick={leave}>
            {mode === 'demo' ? 'Leave demo' : 'Sign out'}
          </Button>
        </div>
      </Card>
    </>
  );
}
