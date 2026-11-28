import { LiveOnGemApi } from '../api/live';
import spec from '../api/openapi-paths.json';
import { LiveSpend, spendOf, type CardBody, type SpendPolicy } from '../spend/api';
import { defaultPolicy } from '../spend/demo';

interface Seen {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: BodyInit | null | undefined;
}

function client(answer: (s: Seen, n: number) => Response = () => new Response('{}', { status: 200 })) {
  const seen: Seen[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const s = {
      method: init.method ?? 'GET',
      url,
      headers: init.headers as Record<string, string>,
      body: init.body,
    };
    seen.push(s);
    return answer(s, seen.length);
  }) as unknown as typeof fetch;
  let n = 0;
  const reverify = vi.fn(() => Promise.resolve(true));
  const api = new LiveOnGemApi({
    baseUrl: '',
    fetchImpl,
    getToken: () => Promise.resolve('t'),
    reverify,
    newKey: () => `key-${++n}`,
    companyId: 'cmp_1',
  });
  return { api, seen, reverify, spend: spendOf(api) };
}

function served(method: string, url: string) {
  const path = url.split('?')[0]!;
  return Object.entries(spec as Record<string, string[]>).some(([template, verbs]) => {
    const re = new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`);
    return re.test(path) && verbs.includes(method.toLowerCase());
  });
}

const card: CardBody = {
  dateOfBirth: '1990-04-02',
  address: { line1: '1 Main St', city: 'Austin', region: 'TX', postalCode: '78701', country: 'US' },
};

describe('OG-087 spend calls on the live client', () => {
  it('OG087_every_spend_call_is_an_ongem_core_endpoint_with_its_method', async () => {
    const { spend, seen } = client();
    const file = new File(['x'], 'r.pdf', { type: 'application/pdf' });
    const policy: SpendPolicy = defaultPolicy();
    await Promise.all([
      spend.program(),
      spend.settings(),
      spend.teams(),
      spend.createTeam('Ops'),
      spend.updateTeam('spt_1', { state: 'ARCHIVED' }),
      spend.employees({ teamId: 'spt_1', state: 'ACTIVE' }),
      spend.employee('emp_1'),
      spend.createEmployee({ firstName: 'A', lastName: 'B', email: 'a@b.example' }),
      spend.moveEmployee('emp_1', ''),
      spend.employeeAction('emp_1', 'suspend'),
      spend.employeeAction('emp_1', 'reactivate'),
      spend.employeeAction('emp_1', 'offboard'),
      spend.issueCard('emp_1', card),
      spend.setEmployeeCardFrozen('emp_1', true),
      spend.setEmployeeCardFrozen('emp_1', false),
      spend.policy(),
      spend.proposePolicy(policy, 'why'),
      spend.decidePolicy(2, true),
      spend.decidePolicy(2, false, 'no'),
      spend.withdrawPolicy(2),
      spend.expenses({ state: 'OPEN', from: '2026-10-01', to: '2026-10-31' }, 'c1', 25),
      spend.expense('exp_1'),
      spend.recode('exp_1', { category: 'travel' }),
      spend.decideExpense('exp_1', true),
      spend.decideExpense('exp_1', false, 'not ours'),
      spend.receipts(),
      spend.matchReceipt('rct_1', 'exp_1'),
      spend.exports(),
      spend.createExport({ from: '2026-10-01', to: '2026-10-31', format: 'CSV' }),
      spend.exportOne('spx_1'),
      spend.me(),
      spend.myCard(),
      spend.setMyCardFrozen(true),
      spend.setMyCardFrozen(false),
      spend.myCardWidget('REVEAL'),
      spend.myExpenses('OPEN', null, 25),
      spend.myExpense('exp_1'),
      spend.codeMyExpense('exp_1', { category: 'meals', vatMinor: 10 }),
      spend.submitMyExpense('exp_1'),
      spend.claim({ amountMinor: 1800, currency: 'USD', merchant: 'Bistro', spentOn: '2026-10-29' }),
      spend.myReceipts(),
      spend.uploadReceipt(file, { amountMinor: 4250, currency: 'USD', date: '2026-10-27' }),
      spend.matchMyReceipt('rct_1', 'exp_1'),
    ]);
    expect(seen).toHaveLength(43);
    expect(seen.filter((s) => !served(s.method, s.url)).map((s) => `${s.method} ${s.url}`)).toEqual([]);
    const urls = seen.map((s) => `${s.method} ${s.url}`);
    expect(urls).toContain('GET /v1/spend/employees?teamId=spt_1&state=ACTIVE');
    expect(urls).toContain(
      'GET /v1/spend/expenses?state=OPEN&from=2026-10-01&to=2026-10-31&cursor=c1&limit=25',
    );
    expect(urls).toContain('GET /v1/spend/me/card/widget-token?kind=REVEAL');
    expect(urls).toContain('POST /v1/spend/policy/versions/2/withdraw');
    expect(urls).toContain('POST /v1/spend/employees/emp_1/card/unfreeze');
  });

  it('OG087_every_write_carries_an_idempotency_key_and_the_company', async () => {
    const { spend, seen } = client();
    await spend.createTeam('Ops');
    await spend.recode('exp_1', { note: 'n' });
    await spend.teams();
    const [post, patch, get] = seen;
    expect(post!.headers['Idempotency-Key']).toBe('key-1');
    expect(patch!.headers['Idempotency-Key']).toBe('key-2');
    expect(get!.headers['Idempotency-Key']).toBeUndefined();
    for (const s of seen) expect(s.headers['X-Company-Id']).toBe('cmp_1');
    expect(JSON.parse(post!.body as string)).toEqual({ name: 'Ops' });
  });

  it('OG087_card_issue_reuses_the_callers_key_and_retries_step_up_with_it', async () => {
    const { spend, seen, reverify } = client((_s, n) =>
      n === 1
        ? new Response(JSON.stringify({ code: 'reverification_required' }), { status: 403 })
        : new Response('{}', { status: 201 }),
    );
    await spend.issueCard('emp_1', card, 'issue-key');
    expect(reverify).toHaveBeenCalledTimes(1);
    expect(seen.map((s) => s.headers['Idempotency-Key'])).toEqual(['issue-key', 'issue-key']);
    expect(JSON.parse(seen[0]!.body as string)).toEqual(card);
  });

  it('OG087_receipt_upload_is_multipart_with_the_hints', async () => {
    const { spend, seen } = client();
    const file = new File(['%PDF'], 'lunch.pdf', { type: 'application/pdf' });
    await spend.uploadReceipt(file, {
      expenseId: 'exp_1',
      amountMinor: 4250,
      currency: 'USD',
      date: '2026-10-27',
    });
    const form = seen[0]!.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect((form.get('file') as File).name).toBe('lunch.pdf');
    expect(form.get('expenseId')).toBe('exp_1');
    expect(form.get('amountMinor')).toBe('4250');
    expect(form.get('date')).toBe('2026-10-27');
    expect(form.get('merchant')).toBeNull();
    expect(seen[0]!.headers['Content-Type']).toBeUndefined();
  });

  it('OG087_reject_sends_the_note_and_limits_are_clamped', async () => {
    const { spend, seen } = client(() => new Response('{"items":[]}', { status: 200 }));
    await spend.decideExpense('exp_1', false, '  not ours  ');
    await spend.expenses({}, null, 500);
    expect(JSON.parse(seen[0]!.body as string)).toEqual({ note: 'not ours' });
    expect(seen[1]!.url).toBe('/v1/spend/expenses?limit=100');
    expect(
      spendOf(new LiveOnGemApi({ baseUrl: '', getToken: async () => 't', reverify: async () => true })),
    ).toBeInstanceOf(LiveSpend);
  });

  it('OG087_core_policy_invalid_problems_reach_the_error', async () => {
    const { spend } = client(
      () =>
        new Response(
          JSON.stringify({
            code: 'policy_invalid',
            detail: 'x',
            problems: [{ code: 'categories_empty', detail: 'at least one category is needed' }],
          }),
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
        ),
    );
    await expect(spend.proposePolicy(defaultPolicy())).rejects.toMatchObject({
      status: 422,
      code: 'policy_invalid',
      problems: [{ code: 'categories_empty', detail: 'at least one category is needed' }],
    });
  });
});
