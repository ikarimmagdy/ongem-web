import { useState } from 'react';
import { Permission } from '../api/client';
import { Button, Card, EmptyState, Field, Input, Notice, StatusChip, useToast } from '../design-system';
import { t, tn } from '../i18n';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { Load } from '../screens/common';
import { spendOf, type TeamView } from './api';
import { spendErrorText, spendStatus, stateLabel } from './common';

/** Teams with their active employee counts; finance (spend:manage) adds, renames and archives. */
export function TeamsScreen() {
  const { api, can } = useSession();
  const spend = spendOf(api);
  const manage = can(Permission.SPEND_MANAGE);
  const toast = useToast();
  const teams = useAsync(() => spend.teams(), [api]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const run = async (work: () => Promise<TeamView>, done: (t: TeamView) => string) => {
    setBusy(true);
    setError(null);
    try {
      const team = await work();
      toast.show(done(team), 'success');
      teams.reload();
      return true;
    } catch (e) {
      setError(spendErrorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {manage && (
        <Card title={t('app.spend.teams.add_title')}>
          <form
            className="fw-thread"
            data-testid="team-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return setError(t('app.spend.teams.name_required'));
              if (
                await run(
                  () => spend.createTeam(name.trim()),
                  (x) => t('app.spend.teams.added', { name: x.name }),
                )
              )
                setName('');
            }}
          >
            <Field label={t('app.spend.teams.name')}>
              <Input
                data-testid="team-name"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <div className="fw-actions">
              <Button type="submit" data-testid="team-add" disabled={busy}>
                {t('app.spend.teams.add')}
              </Button>
            </div>
          </form>
        </Card>
      )}
      {error && (
        <Notice status="failure">
          <span data-testid="team-error">{error}</span>
        </Notice>
      )}
      <Card title={t('app.spend.teams.title')}>
        <Load state={teams} label="spend teams">
          {(list) =>
            list.length === 0 ? (
              <EmptyState title={t('app.spend.teams.empty')} />
            ) : (
              <ul className="fw-list" data-testid="team-list">
                {list.map((x) => (
                  <li key={x.id} className="fw-row" data-testid={`team-${x.id}`}>
                    {editing?.id === x.id ? (
                      <form
                        className="fw-row__main fw-actions"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (
                            await run(
                              () => spend.updateTeam(x.id, { name: editing.name }),
                              (y) => t('app.spend.teams.renamed', { name: y.name }),
                            )
                          )
                            setEditing(null);
                        }}
                      >
                        <Field label={t('app.spend.teams.name')}>
                          <Input
                            data-testid="team-rename-input"
                            value={editing.name}
                            maxLength={80}
                            onChange={(e) => setEditing({ id: x.id, name: e.target.value })}
                          />
                        </Field>
                        <Button type="submit" size="sm" data-testid="team-rename-save" disabled={busy}>
                          {t('app.spend.save')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          {t('app.common.cancel')}
                        </Button>
                      </form>
                    ) : (
                      <>
                        <span className="fw-row__main">
                          <strong>{x.name}</strong>
                          <span className="fw-row__sub">{tn('app.spend.teams.count', x.employees)}</span>
                        </span>
                        <StatusChip status={spendStatus(x.state)}>{stateLabel(x.state)}</StatusChip>
                        {manage && x.state === 'ACTIVE' && (
                          <span className="fw-actions">
                            <Button
                              size="sm"
                              variant="secondary"
                              data-testid={`team-rename-${x.id}`}
                              onClick={() => setEditing({ id: x.id, name: x.name })}
                            >
                              {t('app.spend.teams.rename')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              data-testid={`team-archive-${x.id}`}
                              disabled={busy}
                              onClick={() =>
                                run(
                                  () => spend.updateTeam(x.id, { state: 'ARCHIVED' }),
                                  (y) => t('app.spend.teams.archived', { name: y.name }),
                                )
                              }
                            >
                              {t('app.spend.teams.archive')}
                            </Button>
                          </span>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )
          }
        </Load>
      </Card>
    </>
  );
}
