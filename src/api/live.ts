import type { OnGemApi } from './client';
import { ApiError } from './errors';
import { paths } from './paths';
import { REVERIFICATION_CANCELLED, REVERIFICATION_REQUIRED, type ReverificationHint } from './reverify';
import type { CreatePayment, CreateRecipient, OpenTicket, OwnerIdentity } from './types';

export interface LiveOptions {
  baseUrl: string;
  getToken(opts?: { fresh?: boolean }): Promise<string | null>;
  reverify(hint?: ReverificationHint): Promise<boolean>;
  fetchImpl?: typeof fetch;
  newKey?: () => string;
}

type Body = { json: unknown } | { form: FormData } | undefined;

/**
 * The live customer API (OG-030 R8): the session token as a bearer on every call, an Idempotency-Key on every write,
 * one token refresh on 401 (never for mfa_required), and 403 reverification_required answered by the reverification
 * dialog and one retry with the same key. Nothing is stored in the browser.
 */
export class LiveOnGemApi implements OnGemApi {
  readonly kind = 'live' as const;
  private readonly fetchImpl: typeof fetch;
  private readonly newKey: () => string;

  constructor(private readonly opts: LiveOptions) {
    this.fetchImpl = opts.fetchImpl ?? ((i, init) => fetch(i, init));
    this.newKey = opts.newKey ?? (() => crypto.randomUUID());
  }

  private async send(method: string, path: string, token: string, key: string | null, body: Body) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json, application/problem+json',
    };
    if (key) headers['Idempotency-Key'] = key;
    let payload: BodyInit | undefined;
    if (body && 'json' in body) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body.json);
    } else if (body && 'form' in body) {
      payload = body.form;
    }
    try {
      return await this.fetchImpl(this.opts.baseUrl.replace(/\/$/, '') + path, {
        method,
        headers,
        body: payload,
      });
    } catch {
      throw new ApiError(0, 'network', 'Could not reach OnGem.');
    }
  }

  private static async problem(
    res: Response,
  ): Promise<{ code?: string; detail?: string; reverification?: ReverificationHint }> {
    try {
      return (await res.clone().json()) as { code?: string; detail?: string };
    } catch {
      return {};
    }
  }

  async call<T>(method: string, path: string, body?: Body): Promise<T> {
    const key = method === 'GET' ? null : this.newKey();
    let token = await this.opts.getToken();
    if (!token) throw new ApiError(401, 'not_signed_in');
    let res = await this.send(method, path, token, key, body);
    if (res.status === 401) {
      const p = await LiveOnGemApi.problem(res);
      if (p.code === 'mfa_required' || p.code === 'device_revoked') throw new ApiError(401, p.code, p.detail);
      token = await this.opts.getToken({ fresh: true });
      if (!token) throw new ApiError(401, 'not_signed_in');
      res = await this.send(method, path, token, key, body);
    }
    if (res.status === 403) {
      const p = await LiveOnGemApi.problem(res);
      if (p.code === REVERIFICATION_REQUIRED) {
        let ok = false;
        try {
          ok = await this.opts.reverify(p.reverification);
        } catch {
          ok = false;
        }
        if (!ok)
          throw new ApiError(
            403,
            REVERIFICATION_CANCELLED,
            'You did not confirm it is you, so nothing was changed.',
          );
        token = await this.opts.getToken({ fresh: true });
        if (!token) throw new ApiError(401, 'not_signed_in');
        res = await this.send(method, path, token, key, body);
      }
    }
    if (!res.ok) {
      const p = await LiveOnGemApi.problem(res);
      throw new ApiError(res.status, p.code ?? null, p.detail);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  me: OnGemApi['me'] = () => this.call('GET', paths.me);
  accounts: OnGemApi['accounts'] = () => this.call('GET', paths.accounts);
  account: OnGemApi['account'] = (id: string) => this.call('GET', paths.account(id));
  transactions: OnGemApi['transactions'] = (id: string, limit: number) =>
    this.call('GET', paths.transactions(id, Math.min(100, Math.max(1, limit))));
  statements: OnGemApi['statements'] = (id: string) => this.call('GET', paths.statements(id));
  statement: OnGemApi['statement'] = (id: string, period: string) =>
    this.call('GET', paths.statement(id, period));
  recipients: OnGemApi['recipients'] = () => this.call('GET', paths.recipients);
  createRecipient: OnGemApi['createRecipient'] = (r: CreateRecipient) =>
    this.call('POST', paths.recipients, { json: r });
  archiveRecipient: OnGemApi['archiveRecipient'] = (id: string) => this.call('DELETE', paths.recipient(id));
  payments: OnGemApi['payments'] = (cursor?: string | null, limit = 20) =>
    this.call('GET', paths.payments(cursor, limit));
  payment: OnGemApi['payment'] = (id: string) => this.call('GET', paths.payment(id));
  createPayment: OnGemApi['createPayment'] = (p: CreatePayment) =>
    this.call('POST', paths.createPayment, { json: p });
  sendPayment: OnGemApi['sendPayment'] = (id: string) => this.call('POST', paths.sendPayment(id));
  cards: OnGemApi['cards'] = (cursor?: string | null) => this.call('GET', paths.cards(cursor));
  card: OnGemApi['card'] = (id: string) => this.call('GET', paths.card(id));
  setCardFrozen: OnGemApi['setCardFrozen'] = (id: string, frozen: boolean) =>
    this.call('POST', paths.cardFreeze(id, frozen));
  applications: OnGemApi['applications'] = () => this.call('GET', paths.applications);
  application: OnGemApi['application'] = (id: string) => this.call('GET', paths.application(id));
  putOwnerIdentity: OnGemApi['putOwnerIdentity'] = (app: string, owner: string, identity: OwnerIdentity) =>
    this.call('PUT', paths.ownerIdentity(app, owner), { json: identity });
  confirmApplication: OnGemApi['confirmApplication'] = (id: string) => this.call('POST', paths.confirm(id));
  submitApplication: OnGemApi['submitApplication'] = (id: string) => this.call('POST', paths.submit(id));
  requiredDisclosures: OnGemApi['requiredDisclosures'] = () => this.call('GET', paths.disclosuresRequired);
  disclosureText: OnGemApi['disclosureText'] = (id: string) => this.call('GET', paths.disclosureVersion(id));
  recordDisclosure: OnGemApi['recordDisclosure'] = (versionId: string, kind: string) =>
    this.call('POST', paths.disclosureEvents, { json: { versionId, kind } });
  tickets: OnGemApi['tickets'] = () => this.call('GET', paths.tickets);
  ticket: OnGemApi['ticket'] = (id: string) => this.call('GET', paths.ticket(id));
  openTicket: OnGemApi['openTicket'] = (t: OpenTicket) => this.call('POST', paths.tickets, { json: t });
  replyToTicket: OnGemApi['replyToTicket'] = (id: string, body: string) =>
    this.call('POST', paths.ticketMessages(id), { json: { body } });
  attachToTicket: OnGemApi['attachToTicket'] = (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.call('POST', paths.ticketAttachments(id), { form });
  };
  startConversation: OnGemApi['startConversation'] = (channel, recordingSessionId) =>
    this.call('POST', paths.conversations, { json: { channel, recordingSessionId } });
  sendAssistantMessage: OnGemApi['sendAssistantMessage'] = (id, text) =>
    this.call('POST', paths.messages(id), { json: { text } });
  rateAssistantTurn: OnGemApi['rateAssistantTurn'] = (id, rating) =>
    this.call('POST', paths.turnFeedback(id), { json: { rating } });
  confirmAssistantDraft: OnGemApi['confirmAssistantDraft'] = (id, resultRef) =>
    this.call('POST', paths.confirmDraft(id), { json: { resultRef } });
  abandonAssistantDraft: OnGemApi['abandonAssistantDraft'] = (id) =>
    this.call('POST', paths.abandonDraft(id));
  startRecording: OnGemApi['startRecording'] = (platform, appVersion) =>
    this.call('POST', paths.recordingSessions, { json: { platform, appVersion } });
  recordEvents: OnGemApi['recordEvents'] = (id, events) =>
    this.call('POST', paths.recordingEvents(id), { json: { events } });
}
