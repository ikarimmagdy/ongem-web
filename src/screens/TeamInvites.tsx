import { useState } from 'react';
import { invitableRoles, Permission } from '../api/client';
import { errorText } from '../api/errors';
import type { InviteView } from '../api/types';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Notice,
  Select,
  Skeleton,
  StatusChip,
} from '../design-system';
import { formatDate } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { t } from '../i18n';
import { useSession } from '../session';
import { human } from './common';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const STATE_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'success',
  REVOKED: 'neutral',
  EXPIRED: 'neutral',
} as const;

/**
 * OG-023 R6: the company's invitations in Settings, for a member with `member:invite`. Invite by email with a role no
 * wider than one's own; the accept link comes back once and is shown once; a waiting invitation can be revoked.
 */
export function TeamInvites() {
  const { api, can, role } = useSession();
  const company = useAsync(async () => (await api.me()).companyId ?? null, [api]);
  const companyId = company.status === 'success' ? company.data : null;
  const invites = useAsync(
    () => (companyId ? api.invites(companyId) : Promise.resolve<InviteView[]>([])),
    [api, companyId],
  );
  const roles = invitableRoles(role);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ email: string; link: string } | null>(null);
  if (!can(Permission.MEMBER_INVITE)) return null;
  const pickedRole = roles.includes(inviteRole) ? inviteRole : (roles[roles.length - 1] ?? '');
  const emailOk = EMAIL.test(email.trim());
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      invites.reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const invite = () =>
    run(async () => {
      if (!companyId) return;
      const made = await api.createInvite(companyId, { email: email.trim(), role: pickedRole });
      setSent({ email: made.invite.email, link: made.acceptUrl });
      setEmail('');
    });
  return (
    <Card title={t('app.team.invitations')} data-testid="settings-team">
      <p>{t('app.team.text')}</p>
      <form
        className="fw-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (emailOk && pickedRole) void invite();
        }}
      >
        <Field label={t('app.team.email')} error={email && !emailOk ? t('app.team.email_error') : undefined}>
          <Input
            data-testid="invite-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label={t('app.team.role')}>
          <Select
            data-testid="invite-role"
            value={pickedRole}
            onChange={(e) => setInviteRole(e.target.value)}
            options={roles.map((r) => ({ value: r, label: human(r) }))}
          />
        </Field>
        <div className="fw-actions">
          <Button type="submit" data-testid="invite-send" disabled={busy || !emailOk || !companyId}>
            {t('app.team.send')}
          </Button>
        </div>
      </form>
      {sent && (
        <Notice status="success">
          <span data-testid="invite-sent">{t('app.team.sent', sent)}</span>
        </Notice>
      )}
      {error && (
        <Notice status="failure">
          <span data-testid="invite-form-error">{error}</span>
        </Notice>
      )}
      {invites.status === 'loading' || company.status === 'loading' ? (
        <Skeleton label={t('app.team.loading')} />
      ) : invites.status === 'error' ? (
        <Notice status="failure">{errorText(invites.error)}</Notice>
      ) : !invites.data.length ? (
        <EmptyState title={t('app.team.empty')} />
      ) : (
        <ul className="fw-list" data-testid="invite-list">
          {invites.data.map((i) => (
            <li key={i.id} className="fw-row" data-testid={`invite-${i.id}`}>
              <span className="fw-row__main">
                <span>{i.email}</span>
                <span className="fw-row__sub">
                  {human(i.role)}
                  {i.state === 'PENDING'
                    ? ` · ${t('app.team.expires', { date: formatDate(i.expiresAt) })}`
                    : ''}
                </span>
              </span>
              <StatusChip status={STATE_STATUS[i.state]}>
                {t(`app.team.state.${i.state.toLowerCase()}`)}
              </StatusChip>
              {i.state === 'PENDING' && (
                <Button
                  variant="secondary"
                  data-testid={`invite-revoke-${i.id}`}
                  disabled={busy}
                  onClick={() => void run(() => api.revokeInvite(companyId ?? '', i.id))}
                >
                  {t('app.team.revoke')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
