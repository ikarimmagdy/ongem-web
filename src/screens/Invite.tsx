import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { errorText } from '../api/errors';
import type { InviteAccepted } from '../api/types';
import { Button, Card, Notice, PageHeader } from '../design-system';
import { t } from '../i18n';
import { useSession } from '../session';
import { human } from './common';

/**
 * OG-023 R7: the link in an invitation email (`/invite/<token>`). The signed-in person accepts it; the API checks that
 * their verified email is the invited one. On success the company joins their switcher and opens.
 */
export function InviteScreen() {
  const { token = '' } = useParams();
  const { api, switchCompany } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<InviteAccepted | null>(null);
  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      setJoined(await api.acceptInvite(token));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const company = joined?.companyName ?? t('app.shell.company');
  return (
    <>
      <PageHeader title={t('app.invite.title')} />
      <Card data-testid="invite-screen">
        {joined ? (
          <>
            <Notice status="success">
              <span data-testid="invite-joined">
                {t('app.invite.joined', { company, role: human(joined.role) })}
              </span>
            </Notice>
            <div className="fw-actions">
              <Button
                data-testid="invite-open"
                onClick={() => {
                  // The invitation is accepted in the region whose API answered it, so the company lives there.
                  switchCompany(joined.companyId, api.region);
                  navigate('/');
                }}
              >
                {t('app.invite.open', { company })}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p>{t('app.invite.text')}</p>
            {error && (
              <Notice status="failure">
                <span data-testid="invite-error">{error}</span>
              </Notice>
            )}
            <div className="fw-actions">
              <Button data-testid="invite-accept" disabled={busy || !token} onClick={() => void accept()}>
                {t('app.invite.accept')}
              </Button>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
