import { LiveOnGemApi } from './live';
import spec from './openapi-paths.json';

/** Calls every method of the live client against a recording fetch and checks each against ongem-core's OpenAPI paths. */
async function record() {
  const calls: Array<{ method: string; path: string }> = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ method: init.method ?? 'GET', path: url.split('?')[0]! });
    const page =
      (url.startsWith('/v1/recipients?') || url.endsWith('/invites')) && (init.method ?? 'GET') === 'GET';
    return new Response(page ? '{"items":[]}' : '{}', { status: 200 });
  }) as unknown as typeof fetch;
  const api = new LiveOnGemApi({
    baseUrl: '',
    fetchImpl,
    getToken: () => Promise.resolve('t'),
    reverify: () => Promise.resolve(true),
  });
  const file = new File(['x'], 'x.pdf', { type: 'application/pdf' });
  await Promise.all([
    api.me(),
    api.accounts(),
    api.account('a'),
    api.transactions('a', 20),
    api.statements('a'),
    api.statement('a', '2026-09'),
    api.requestExport('a', { month: '2026-10', format: 'CSV' }),
    api.exports('a'),
    api.exportRun('a', 'e'),
    api.exportLink('a', 'e'),
    api.recipients(),
    api.createRecipient({
      kind: 'BUSINESS',
      name: 'n',
      accountNumber: '1234',
      routingNumber: '021000021',
      accountType: 'CHECKING',
    }),
    api.archiveRecipient('r'),
    api.payments(null),
    api.payment('p'),
    api.createPayment({ fromAccountId: 'a', rail: 'ACH', amountMinor: 1, currency: 'USD' }),
    api.sendPayment('p'),
    api.approvePayment('p'),
    api.rejectPayment('p'),
    api.fundingSources(),
    api.fundingSource('f'),
    api.linkFundingSource({
      accountId: 'a',
      method: 'MANUAL',
      accountNumber: '1234',
      routingNumber: '021000021',
      accountType: 'CHECKING',
      ownerName: 'n',
    }),
    api.removeFundingSource('f'),
    api.schedules(),
    api.schedule('s'),
    api.createSchedule({
      fromAccountId: 'a',
      recipientId: 'r',
      rail: 'ACH',
      amountMinor: 1,
      currency: 'USD',
      frequency: 'MONTHLY',
      interval: 1,
      startDate: '2026-12-01',
    }),
    api.pauseSchedule('s'),
    api.resumeSchedule('s'),
    api.cancelSchedule('s'),
    api.createTopUp({ fundingSourceId: 'f', toAccountId: 'a', amountMinor: 1, currency: 'USD' }),
    api.cards(),
    api.card('c'),
    api.setCardFrozen('c', true),
    api.setCardFrozen('c', false),
    api.applications(),
    api.application('x'),
    api.putOwnerIdentity('x', 'o', { idType: 'SSN', number: '1', country: 'US' }),
    api.confirmApplication('x'),
    api.submitApplication('x'),
    api.startIdCapture('x', 'PASSPORT', false),
    api.idCaptures('x'),
    api.idCapture('x', 'c'),
    api.requiredDisclosures(),
    api.disclosureText('d'),
    api.recordDisclosure('d', 'DISPLAYED'),
    api.tickets(),
    api.ticket('t'),
    api.openTicket({ subject: 's', category: 'OTHER', body: 'b' }),
    api.replyToTicket('t', 'b'),
    api.attachToTicket('t', file),
    api.startConversation('WEB'),
    api.sendAssistantMessage('c', 'hi'),
    api.rateAssistantTurn('t', 'UP'),
    api.confirmAssistantDraft('d', 'p'),
    api.abandonAssistantDraft('d'),
    api.startRecording('WEB'),
    api.recordEvents('s', []),
    api.notifications({ unread: true, limit: 1 }),
    api.readNotification('n'),
    api.readAllNotifications(),
    api.notificationPreferences(),
    api.setNotificationPreferences([{ kind: 'PAYMENT_SENT', email: true }]),
    api.setSmsNumber('+15551234567'),
    api.verifySmsNumber('123456'),
    api.invites('c'),
    api.createInvite('c', { email: 'x@example.com', role: 'VIEWER' }),
    api.revokeInvite('c', 'i'),
    api.acceptInvite('tok'),
  ]);
  return calls;
}

function served(call: { method: string; path: string }) {
  const paths = spec as Record<string, string[]>;
  return Object.entries(paths).some(([template, verbs]) => {
    const re = new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`);
    return re.test(call.path) && verbs.includes(call.method.toLowerCase());
  });
}

describe('every live call is an ongem-core endpoint (OG-030 R8)', () => {
  it('every_live_call_is_in_the_openapi_AC_R8_1', async () => {
    const calls = await record();
    expect(calls).toHaveLength(64);
    expect(calls.filter((c) => !served(c))).toEqual([]);
  });
});
