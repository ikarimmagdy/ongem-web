import type { Card, NoticeView, Payment } from '../api/types';
import { applicationStep, needsItems } from './needs';

const pay = (id: string, state: string, approvalBy: Payment['approvalBy'] = 'COMPANY'): Payment => ({
  id,
  state,
  rail: 'ACH',
  amount: { amountMinor: 420_000, currency: 'USD' },
  fromAccountId: 'acc_1',
  recipientId: 'rcp_1',
  timeline: [],
  approvalBy: state === 'PENDING_APPROVAL' ? approvalBy : null,
});
const card = (id: string, state: string): Card => ({
  id,
  holderName: 'A',
  fundingAccountId: 'acc_1',
  form: 'VIRTUAL',
  last4: id.slice(-4),
  state,
});
const notice = (id: string, readAt: string | null): NoticeView => ({
  id,
  kind: 'PAYMENT_SENT',
  title: `Notice ${id}`,
  body: '',
  link: null,
  mandatory: false,
  occurredAt: '2026-10-20T10:00:00Z',
  createdAt: '2026-10-20T10:00:00Z',
  readAt,
});

describe('OG-035 Needs you and application steps', () => {
  it('AC_R5_1 maps each application state to its step, and an open account to none', () => {
    for (const s of [null, 'PREFILLING', 'COLLECTING', 'READY_FOR_DISCLOSURES', 'MORE_INFO', 'EDD'])
      expect(applicationStep(s)).toBe(2);
    for (const s of ['SUBMITTED', 'VERIFYING', 'IN_REVIEW', 'PENDING_BANK', 'REJECTED'])
      expect(applicationStep(s)).toBe(3);
    for (const s of ['APPROVED', 'PROVISIONING']) expect(applicationStep(s)).toBe(4);
    expect(applicationStep('ACTIVE')).toBeNull();
  });

  it('AC_R3_3 lists approvals, the application step, card alerts and unread notices, in that order', () => {
    const items = needsItems({
      payments: [pay('p1', 'PENDING_APPROVAL'), pay('p2', 'SETTLED'), pay('p3', 'PENDING_APPROVAL', 'ONGEM')],
      canApprove: true,
      payee: () => 'Harbor Rent Co',
      applicationState: 'SUBMITTED',
      applicationId: 'app_1',
      cards: [card('c_0001', 'ACTIVE'), card('c_8830', 'FROZEN'), card('c_7777', 'PENDING')],
      notices: [notice('n1', null), notice('n2', '2026-10-21T00:00:00Z'), notice('n3', null)],
    });
    expect(items.map((i) => `${i.kind}:${i.id}`)).toEqual([
      'approval:p1',
      'application:app_1',
      'card:c_8830',
      'card:c_7777',
      'notice:n1',
      'notice:n3',
    ]);
    expect(items[0]).toMatchObject({ payee: 'Harbor Rent Co', to: '/payments/p1' });
    expect(items[1]).toMatchObject({ step: 'bank', to: '/onboarding' });
    expect(items[2]).toMatchObject({ state: 'FROZEN', to: '/cards/c_8830' });
    expect(items[4]).toMatchObject({ to: '/notifications' });
  });

  it('AC_R3_2 a role without payment:approve gets no approval item', () => {
    const items = needsItems({
      payments: [pay('p1', 'PENDING_APPROVAL')],
      canApprove: false,
      payee: () => 'x',
      cards: [],
      notices: [],
    });
    expect(items).toEqual([]);
  });

  it('AC_R3_1 nothing waiting gives no item', () => {
    expect(
      needsItems({
        payments: [],
        canApprove: true,
        payee: () => '',
        applicationState: 'ACTIVE',
        applicationId: 'a',
        cards: [],
        notices: [],
      }),
    ).toEqual([]);
  });
});
