import { Permission } from '../api/client';
import type { InviteView } from '../api/types';
import { Card, PageHeader, StatusChip } from '../design-system';
import { currentMembership } from '../lib/company';
import { useAsync } from '../lib/useAsync';
import { t } from '../i18n';
import { useSession } from '../session';
import { Load, human } from './common';
import { TeamInvites } from './TeamInvites';

/**
 * Team (OG-035 R7): the people of this company and the invitations, moved out of Settings. There is no member list in
 * the API yet, so members are the signed-in person and the invitations that were accepted (seen with member:invite).
 */
export function TeamScreen() {
  const { api, can } = useSession();
  const invite = can(Permission.MEMBER_INVITE);
  const me = useAsync(() => api.me(), [api]);
  const accepted = useAsync(async (): Promise<InviteView[]> => {
    if (!invite) return [];
    const companyId = (await api.me()).companyId;
    return companyId ? (await api.invites(companyId)).filter((i) => i.state === 'ACCEPTED') : [];
  }, [api, invite]);
  return (
    <>
      <PageHeader title={t('app.team.title')} />
      <Card title={t('app.team.members')} data-testid="team-members">
        <Load state={me} label="team">
          {(person) => {
            const m = currentMembership(person);
            const name =
              [person.legalFirstName, person.legalLastName].filter(Boolean).join(' ') || person.email || '';
            return (
              <ul className="fw-list">
                <li className="fw-row" data-testid="team-you">
                  <span className="fw-row__main">
                    <strong>{name}</strong>
                    <span className="fw-row__sub">{t('app.team.you')}</span>
                  </span>
                  {m?.role && <StatusChip status="neutral">{human(m.role)}</StatusChip>}
                </li>
                {accepted.status === 'success' &&
                  accepted.data.map((i) => (
                    <li key={i.id} className="fw-row" data-testid={`team-member-${i.id}`}>
                      <span className="fw-row__main">
                        <strong>{i.email}</strong>
                      </span>
                      <StatusChip status="neutral">{human(i.role)}</StatusChip>
                    </li>
                  ))}
              </ul>
            );
          }}
        </Load>
        <p className="fw-row__sub">{t('app.team.members_note')}</p>
      </Card>
      {invite ? (
        <TeamInvites />
      ) : (
        <Card>
          <p data-testid="team-no-invite">{t('app.team.no_invite')}</p>
        </Card>
      )}
    </>
  );
}
