import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { invitableRoles } from '../api/client';
import { DemoOnGemApi } from '../api/demo';
import { demoMe } from '../api/demoData';
import { ApiError, errorText } from '../api/errors';
import { renderApp } from './render';

const asRole = (role: string) =>
  new DemoOnGemApi({ me: { ...demoMe, memberships: demoMe.memberships.map((m) => ({ ...m, role })) } });

describe('team invitations (OG-023 R6, client)', () => {
  it('an owner invites by email and the link is shown once AC-R6.1', async () => {
    renderApp('/team');
    // The card may mount again once the shell knows the company, so it is found afresh each time.
    expect(await screen.findByTestId('settings-team')).toBeInTheDocument();
    expect(await screen.findByText('No invitations yet.')).toBeInTheDocument();
    await userEvent.type(screen.getByTestId('invite-email'), 'sam@example.com');
    await userEvent.selectOptions(screen.getByTestId('invite-role'), 'VIEWER');
    await userEvent.click(screen.getByTestId('invite-send'));
    const sent = await screen.findByTestId('invite-sent');
    expect(sent).toHaveTextContent('Invitation sent to sam@example.com.');
    expect(sent).toHaveTextContent(/\/invite\/demo_invite_\d+/);
    const row = await within(await screen.findByTestId('invite-list')).findByText('sam@example.com');
    expect(row.closest('li')).toHaveTextContent('Waiting');
    expect(row.closest('li')).toHaveTextContent('Viewer');
  });

  it('no invitations without member invite, and no role wider than mine AC-R6.2', async () => {
    renderApp('/team', { api: asRole('VIEWER') });
    expect(await screen.findByTestId('team-no-invite')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-team')).not.toBeInTheDocument();
    expect(invitableRoles('ADMIN')).not.toContain('OWNER');
    expect(invitableRoles('ADMIN')).not.toContain('APPROVER');
    expect(invitableRoles('OWNER')).toEqual(['OWNER', 'ADMIN', 'APPROVER', 'MEMBER', 'VIEWER']);
    renderApp('/team', { api: asRole('ADMIN') });
    const role = await screen.findByTestId('invite-role');
    expect(within(role).queryByRole('option', { name: 'Owner' })).not.toBeInTheDocument();
  });

  it('a second invite for the same email is invite_exists AC-R6.3', async () => {
    renderApp('/team');
    await userEvent.type(await screen.findByTestId('invite-email'), 'sam@example.com');
    await userEvent.click(screen.getByTestId('invite-send'));
    await screen.findByTestId('invite-sent');
    await userEvent.type(screen.getByTestId('invite-email'), 'SAM@example.com');
    await userEvent.click(screen.getByTestId('invite-send'));
    expect(await screen.findByTestId('invite-form-error')).toHaveTextContent(
      'This person already has an invitation waiting for this company.',
    );
  });

  it('a revoked invitation lists as revoked AC-R6.4', async () => {
    const api = new DemoOnGemApi();
    const made = await api.createInvite('cmp_demo_northwind', { email: 'kim@example.com', role: 'MEMBER' });
    renderApp('/team', { api });
    await userEvent.click(await screen.findByTestId(`invite-revoke-${made.invite.id}`));
    await waitFor(() => expect(screen.getByTestId(`invite-${made.invite.id}`)).toHaveTextContent('Revoked'));
    expect(screen.queryByTestId(`invite-revoke-${made.invite.id}`)).not.toBeInTheDocument();
  });
});

describe('accepting an invitation (OG-023 R7, client)', () => {
  it('accepting joins the company and opens it AC-R7.1', async () => {
    renderApp('/invite/demo_invite_1');
    await userEvent.click(await screen.findByTestId('invite-accept'));
    expect(await screen.findByTestId('invite-joined')).toHaveTextContent(
      'You joined Harbor Studio LLC as Member.',
    );
    await userEvent.click(screen.getByTestId('invite-open'));
    await waitFor(() =>
      expect(screen.getByTestId('company-switcher')).toHaveTextContent('Harbor Studio LLC'),
    );
  });

  it('an expired revoked or used invitation says so AC-R7.2', async () => {
    renderApp('/invite/not_a_token');
    await userEvent.click(await screen.findByTestId('invite-accept'));
    expect(await screen.findByTestId('invite-error')).toHaveTextContent(
      'This invitation has expired, was revoked or was already used.',
    );
  });

  it('another email and the membership limit are explained AC-R7.3 AC-R10.1', () => {
    expect(errorText(new ApiError(403, 'invite_email_mismatch'))).toBe(
      'This invitation is for another email address. Sign in with the email it was sent to.',
    );
    expect(errorText(new ApiError(409, 'membership_limit'))).toBe(
      'You have reached the number of companies one person can join.',
    );
  });
});
