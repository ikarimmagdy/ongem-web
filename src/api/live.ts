import type { OnGemApi } from './client';
import { deviceProof, registration, type DeviceKeys } from './device';
import { ApiError } from './errors';
import { paths } from './paths';
import { REGION } from '../region';
import { REVERIFICATION_CANCELLED, REVERIFICATION_REQUIRED, type ReverificationHint } from './reverify';
import type {
  CreatePayment,
  CreateRecipient,
  OpenTicket,
  OwnerIdentity,
  Recipient,
  RecipientPage,
  CardWidgetKind,
  InviteView,
} from './types';

export interface LiveOptions {
  baseUrl: string;
  getToken(opts?: { fresh?: boolean }): Promise<string | null>;
  reverify(hint?: ReverificationHint): Promise<boolean>;
  fetchImpl?: typeof fetch;
  newKey?: () => string;
  /** The signed-in person and this browser's device keys: with both, every call carries X-Device-Id (CORE-SEC-03). */
  personId?: string | null;
  deviceKeys?: DeviceKeys;
  /** Waits between retries of a request the API is still working on (409 idempotency_in_progress). */
  sleep?: (ms: number) => Promise<void>;
  /** The company picked in the switcher (G-69): every call carries it as X-Company-Id; none means the default. */
  companyId?: string | null;
  /** OG-023 R12: the region [baseUrl] serves (the build's region by default). */
  region?: string;
  /** The API base of each region this build may call (VITE_API_BASE_URL_US, VITE_API_BASE_URL_AE). */
  regionBases?: Partial<Record<string, string>>;
}

/** The API base URL per region from the build's configuration; a region without one is not asked (OG-023 R12). */
export function configuredRegionBases(): Partial<Record<string, string>> {
  const bases: Partial<Record<string, string>> = {};
  const us = import.meta.env.VITE_API_BASE_URL_US?.trim();
  const ae = import.meta.env.VITE_API_BASE_URL_AE?.trim();
  if (us) bases.US = us;
  if (ae) bases.AE = ae;
  return bases;
}

/** Waits before each retry of 409 idempotency_in_progress, with the same Idempotency-Key (CORE-COR-02). */
export const IN_PROGRESS_BACKOFF_MS = [500, 1000, 2000, 4000];
export const IDEMPOTENCY_IN_PROGRESS = 'idempotency_in_progress';

const DEVICES = '/v1/devices';
const WRONG_REGION = 'wrong_region';

/** `GET /v1/whereami` (OG-022 R2): ids, a region and an API base only. */
export interface Whereami {
  companyId: string | null;
  region: string | null;
  apiBaseUrl: string | null;
}
const DEVICE_PROOF = new Set(['device_proof_required', 'device_proof_invalid']);

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
  private readonly sleep: (ms: number) => Promise<void>;
  private device: Promise<string | null> | null;

  get companyId(): string | null {
    return this.opts.companyId ?? null;
  }

  /** The same person and browser device in another of the person's companies; the device is not bound again. */
  forCompany(companyId: string | null): LiveOnGemApi {
    return new LiveOnGemApi({ ...this.opts, companyId }, { device: this.device });
  }

  get region(): string {
    return this.opts.region ?? REGION;
  }

  /** The same person on another region's API (OG-023 R12), whose device binds there on its own. */
  forRegion(region: string): LiveOnGemApi | null {
    if (region === this.region) return this.forCompany(null);
    const base = (this.opts.regionBases ?? configuredRegionBases())[region];
    if (!base) return null;
    return new LiveOnGemApi({ ...this.opts, baseUrl: base, region, companyId: null });
  }

  constructor(
    private readonly opts: LiveOptions,
    shared?: { device: Promise<string | null> | null },
  ) {
    this.device = shared?.device ?? null;
    this.fetchImpl = opts.fetchImpl ?? ((i, init) => fetch(i, init));
    this.newKey = opts.newKey ?? (() => crypto.randomUUID());
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /**
   * This browser's device id for the signed-in person: a challenge signed with the person's device key, then
   * POST /v1/devices, which answers the device already bound to that key. Asked once per client; when binding fails
   * the calls go on without the header and the API decides (it refuses them where binding is enforced).
   */
  private deviceId(): Promise<string | null> {
    const { personId, deviceKeys } = this.opts;
    if (!personId || !deviceKeys) return Promise.resolve(null);
    this.device ??= (async () => {
      try {
        const pair = await deviceKeys.get(personId);
        const challenge = await this.call<{ challengeId: string; nonce: string }>(
          'POST',
          `${DEVICES}/challenge`,
        );
        const bound = await this.call<{ id: string }>('POST', DEVICES, {
          json: await registration(pair, challenge),
        });
        return bound.id;
      } catch {
        return null;
      }
    })();
    return this.device;
  }

  private async proof(method: string, path: string, device: string, key: string | null) {
    const { personId, deviceKeys } = this.opts;
    if (!personId || !deviceKeys) return null;
    try {
      return await deviceProof(await deviceKeys.get(personId), method, path, device, key);
    } catch {
      return null;
    }
  }

  private async forgetDevice() {
    this.device = null;
    if (this.opts.personId && this.opts.deviceKeys) await this.opts.deviceKeys.forget(this.opts.personId);
  }

  private async send(
    method: string,
    path: string,
    token: string,
    key: string | null,
    body: Body,
    device: string | null,
  ) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json, application/problem+json', // content-check: ignore (media types)
    };
    if (key) headers['Idempotency-Key'] = key;
    if (device) {
      headers['X-Device-Id'] = device;
      // CORE-SEC-04: a fresh proof for every attempt, signed by this browser's device key.
      const proof = await this.proof(method, path, device, key);
      if (proof) headers['X-Device-Proof'] = proof;
    }
    if (this.opts.companyId) headers['X-Company-Id'] = this.opts.companyId;
    let payload: BodyInit | undefined;
    if (body && 'json' in body) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body.json);
    } else if (body && 'form' in body) {
      payload = body.form;
    }
    try {
      // The bearer is the only credential: Clerk's __session cookie is never sent, so a cross-site form cannot act.
      return await this.fetchImpl(this.opts.baseUrl.replace(/\/$/, '') + path, {
        method,
        headers,
        body: payload,
        credentials: 'omit',
      });
    } catch {
      throw new ApiError(0, 'network', 'Could not reach OnGem.');
    }
  }

  private static async problem(res: Response): Promise<{
    code?: string;
    detail?: string;
    reverification?: ReverificationHint;
    homeRegion?: string;
    apiBaseUrl?: string;
  }> {
    try {
      return (await res.clone().json()) as { code?: string; detail?: string };
    } catch {
      return {};
    }
  }

  async call<T>(method: string, path: string, body?: Body): Promise<T> {
    const key = method === 'GET' ? null : this.newKey();
    // Binding the device itself never needs one, nor does whereami, which is asked before the person's region is known
    // and must leave nothing in a region that does not hold them (OG-022 R25); every other customer call carries it.
    let device =
      path === DEVICES || path.startsWith(`${DEVICES}/`) || path === paths.whereami
        ? null
        : await this.deviceId();
    let token = await this.opts.getToken();
    if (!token) throw new ApiError(401, 'not_signed_in');
    const send = async (t: string) => {
      let r = await this.send(method, path, t, key, body, device);
      // The same request is still running on the server: wait and ask again with the same key, so it runs once.
      for (const ms of IN_PROGRESS_BACKOFF_MS) {
        if (r.status !== 409 || (await LiveOnGemApi.problem(r)).code !== IDEMPOTENCY_IN_PROGRESS) break;
        await this.sleep(ms);
        r = await this.send(method, path, t, key, body, device);
      }
      return r;
    };
    let res = await send(token);
    // PT-01: a refused proof gets one freshly signed retry, then this browser is bound again with a new key and tried
    // once more. A 401 is answered before the body is read, so the same Idempotency-Key cannot run a write twice.
    if (device && res.status === 401 && DEVICE_PROOF.has((await LiveOnGemApi.problem(res)).code ?? '')) {
      res = await send(token);
      if (res.status === 401 && DEVICE_PROOF.has((await LiveOnGemApi.problem(res)).code ?? '')) {
        await this.forgetDevice();
        device = await this.deviceId();
        if (device) res = await send(token);
      }
    }
    if (res.status === 401) {
      const p = await LiveOnGemApi.problem(res);
      if (p.code && DEVICE_PROOF.has(p.code)) throw new ApiError(401, p.code, p.detail);
      if (p.code === 'device_revoked') await this.forgetDevice();
      if (p.code === 'mfa_required' || p.code === 'device_revoked' || p.code === 'device_required')
        throw new ApiError(401, p.code, p.detail);
      token = await this.opts.getToken({ fresh: true });
      if (!token) throw new ApiError(401, 'not_signed_in');
      res = await send(token);
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
        res = await send(token);
      }
    }
    if (!res.ok) {
      const p = await LiveOnGemApi.problem(res);
      const where =
        p.code === WRONG_REGION
          ? { homeRegion: p.homeRegion ?? null, apiBaseUrl: p.apiBaseUrl ?? null }
          : undefined;
      throw new ApiError(res.status, p.code ?? null, p.detail, where);
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
  /** ongem-core pages recipients (100 at most per page); the screens and the assistant want the whole list. */
  recipients: OnGemApi['recipients'] = async () => {
    const all: Recipient[] = [];
    let cursor: string | null | undefined;
    do {
      const page = await this.call<RecipientPage>('GET', paths.recipientPage(cursor));
      all.push(...page.items);
      cursor = page.next;
    } while (cursor);
    return all;
  };
  createRecipient: OnGemApi['createRecipient'] = (r: CreateRecipient) =>
    this.call('POST', paths.recipients, { json: r });
  archiveRecipient: OnGemApi['archiveRecipient'] = (id: string) => this.call('DELETE', paths.recipient(id));
  payments: OnGemApi['payments'] = (cursor?: string | null, limit = 20) =>
    this.call('GET', paths.payments(cursor, limit));
  payment: OnGemApi['payment'] = (id: string) => this.call('GET', paths.payment(id));
  createPayment: OnGemApi['createPayment'] = (p: CreatePayment) =>
    this.call('POST', paths.createPayment, { json: p });
  sendPayment: OnGemApi['sendPayment'] = (id: string) => this.call('POST', paths.sendPayment(id));
  approvePayment: OnGemApi['approvePayment'] = (id) => this.call('POST', paths.approvePayment(id));
  rejectPayment: OnGemApi['rejectPayment'] = (id) => this.call('POST', paths.rejectPayment(id));
  fundingSources: OnGemApi['fundingSources'] = () => this.call('GET', paths.fundingSources);
  fundingSource: OnGemApi['fundingSource'] = (id) => this.call('GET', paths.fundingSource(id));
  linkFundingSource: OnGemApi['linkFundingSource'] = (r) =>
    this.call('POST', paths.fundingSources, { json: r });
  removeFundingSource: OnGemApi['removeFundingSource'] = (id) => this.call('DELETE', paths.fundingSource(id));
  createTopUp: OnGemApi['createTopUp'] = (r) => this.call('POST', paths.topUps, { json: r });
  schedules: OnGemApi['schedules'] = () => this.call('GET', paths.schedules);
  schedule: OnGemApi['schedule'] = (id) => this.call('GET', paths.schedule(id));
  createSchedule: OnGemApi['createSchedule'] = (r) => this.call('POST', paths.schedules, { json: r });
  pauseSchedule: OnGemApi['pauseSchedule'] = (id) => this.call('POST', paths.scheduleAction(id, 'pause'));
  resumeSchedule: OnGemApi['resumeSchedule'] = (id) => this.call('POST', paths.scheduleAction(id, 'resume'));
  cancelSchedule: OnGemApi['cancelSchedule'] = (id) => this.call('POST', paths.scheduleAction(id, 'cancel'));
  cards: OnGemApi['cards'] = (cursor?: string | null) => this.call('GET', paths.cards(cursor));
  card: OnGemApi['card'] = (id: string) => this.call('GET', paths.card(id));
  setCardFrozen: OnGemApi['setCardFrozen'] = (id: string, frozen: boolean) =>
    this.call('POST', paths.cardFreeze(id, frozen));
  cardWidget: OnGemApi['cardWidget'] = (id: string, kind: CardWidgetKind) =>
    this.call('GET', paths.cardWidget(id, kind));
  applications: OnGemApi['applications'] = () => this.call('GET', paths.applications);
  application: OnGemApi['application'] = (id: string) => this.call('GET', paths.application(id));
  putOwnerIdentity: OnGemApi['putOwnerIdentity'] = (app: string, owner: string, identity: OwnerIdentity) =>
    this.call('PUT', paths.ownerIdentity(app, owner), { json: identity });
  confirmApplication: OnGemApi['confirmApplication'] = (id: string) => this.call('POST', paths.confirm(id));
  submitApplication: OnGemApi['submitApplication'] = (id: string) => this.call('POST', paths.submit(id));
  startIdCapture: OnGemApi['startIdCapture'] = (id, document, sendSms) =>
    this.call('POST', paths.idCaptures(id), { json: { document, sendSms } });
  idCaptures: OnGemApi['idCaptures'] = (id) => this.call('GET', paths.idCaptures(id));
  idCapture: OnGemApi['idCapture'] = (id, capture) => this.call('GET', paths.idCapture(id, capture));
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
  notifications: OnGemApi['notifications'] = (opts) =>
    this.call(
      'GET',
      paths.notifications(opts?.unread ?? false, Math.min(100, Math.max(1, opts?.limit ?? 50))),
    );
  readNotification: OnGemApi['readNotification'] = (id) => this.call('POST', paths.readNotification(id));
  readAllNotifications: OnGemApi['readAllNotifications'] = () =>
    this.call('POST', paths.readAllNotifications);
  setLocale: OnGemApi['setLocale'] = async (locale) => {
    await this.call('PUT', paths.preferences, { json: { locale } });
  };
  /**
   * OG-022 R11, R24, R25: where the person's company lives and that region's API base URL. A region that has never seen
   * the person answers no company and no region; 409 wrong_region is read as the answer it carries.
   */
  whereami = async (): Promise<Whereami> => {
    try {
      return await this.call<Whereami>('GET', paths.whereami);
    } catch (e) {
      if (e instanceof ApiError && e.code === WRONG_REGION && e.where)
        return {
          companyId: this.companyId,
          region: e.where.homeRegion,
          apiBaseUrl: e.where.apiBaseUrl,
        };
      throw e;
    }
  };
  notificationPreferences: OnGemApi['notificationPreferences'] = () =>
    this.call('GET', paths.notificationPreferences);
  setNotificationPreferences: OnGemApi['setNotificationPreferences'] = (kinds) =>
    this.call('PUT', paths.notificationPreferences, { json: { kinds } });
  setSmsNumber: OnGemApi['setSmsNumber'] = (number) =>
    this.call('PUT', paths.smsNumber, { json: { number } });
  verifySmsNumber: OnGemApi['verifySmsNumber'] = (code) =>
    this.call('POST', paths.verifySmsNumber, { json: { code } });
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
  invites: OnGemApi['invites'] = async (company) =>
    (await this.call<{ items: InviteView[] }>('GET', paths.invites(company))).items;
  createInvite: OnGemApi['createInvite'] = (company, r) =>
    this.call('POST', paths.invites(company), { json: r });
  revokeInvite: OnGemApi['revokeInvite'] = (company, id) => this.call('DELETE', paths.invite(company, id));
  acceptInvite: OnGemApi['acceptInvite'] = (token) => this.call('POST', paths.acceptInvite(token));
  recordEvents: OnGemApi['recordEvents'] = (id, events) =>
    this.call('POST', paths.recordingEvents(id), { json: { events } });
}
