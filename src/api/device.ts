/**
 * This browser's device key for device binding (OG-006 R8, CORE-SEC-03). The key pair is made by WebCrypto with a private
 * key that cannot be exported, and kept per person in IndexedDB, so script can use it but never read it out. Nothing else
 * is stored: the device id comes back from POST /v1/devices each time the app starts, because the API answers the device
 * already bound to the same key.
 */
export interface DeviceKeys {
  /** The person's key pair, made on first use. */
  get(personId: string): Promise<CryptoKeyPair>;
  /** Drops the person's key, for example after the API answered device_revoked. */
  forget(personId: string): Promise<void>;
}

const ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' } as const;

export const newKeyPair = () =>
  crypto.subtle.generateKey(ALGORITHM, false, ['sign', 'verify']) as Promise<CryptoKeyPair>;

/** Keys held only in memory: a new device on every page load. Used when IndexedDB is not available. */
export class MemoryDeviceKeys implements DeviceKeys {
  private readonly keys = new Map<string, Promise<CryptoKeyPair>>();

  get(personId: string) {
    let k = this.keys.get(personId);
    if (!k) {
      k = newKeyPair();
      this.keys.set(personId, k);
    }
    return k;
  }

  forget(personId: string) {
    this.keys.delete(personId);
    return Promise.resolve();
  }
}

const DB = 'ongem-device';
const STORE = 'keys';

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('indexeddb'));
  });
}

/** Keys in IndexedDB, falling back to memory when the browser refuses storage (private windows). */
export class BrowserDeviceKeys implements DeviceKeys {
  private readonly memory = new MemoryDeviceKeys();

  private open(): Promise<IDBDatabase> {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    return request(r);
  }

  async get(personId: string): Promise<CryptoKeyPair> {
    try {
      const db = await this.open();
      try {
        const found = (await request(db.transaction(STORE).objectStore(STORE).get(personId))) as
          CryptoKeyPair | undefined;
        if (found?.privateKey && found.publicKey) return found;
        const pair = await newKeyPair();
        await request(db.transaction(STORE, 'readwrite').objectStore(STORE).put(pair, personId));
        return pair;
      } finally {
        db.close();
      }
    } catch {
      return this.memory.get(personId);
    }
  }

  async forget(personId: string): Promise<void> {
    await this.memory.forget(personId);
    try {
      const db = await this.open();
      try {
        await request(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(personId));
      } finally {
        db.close();
      }
    } catch {
      /* storage unavailable: nothing was kept */
    }
  }
}

export function defaultDeviceKeys(): DeviceKeys {
  return typeof indexedDB === 'undefined' ? new MemoryDeviceKeys() : new BrowserDeviceKeys();
}

function base64(bytes: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s);
}

/** The body of POST /v1/devices for [challenge]: SPKI public key and a raw (r||s) ECDSA SHA-256 signature, base64. */
export async function registration(pair: CryptoKeyPair, challenge: { challengeId: string; nonce: string }) {
  const publicKey = base64(await crypto.subtle.exportKey('spki', pair.publicKey));
  const signature = base64(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.privateKey,
      new TextEncoder().encode(challenge.nonce),
    ),
  );
  return { challengeId: challenge.challengeId, publicKey, signature, platform: 'web', name: 'Web browser' };
}

/** The lines a device signs for one call (ongem-core DeviceProofs, CORE-SEC-04): the path has no query. */
export function proofMessage(
  method: string,
  path: string,
  seconds: number,
  deviceId: string,
  idempotencyKey: string | null,
): string {
  return [
    'v1',
    method.toUpperCase(),
    path.split('?')[0],
    String(seconds),
    deviceId,
    idempotencyKey ?? '',
  ].join('\n');
}

/** X-Device-Proof: `v1.<seconds>.<raw ECDSA SHA-256 signature, base64>` by this browser's device key. */
export async function deviceProof(
  pair: CryptoKeyPair,
  method: string,
  path: string,
  deviceId: string,
  idempotencyKey: string | null,
  now: () => number = Date.now,
): Promise<string> {
  const seconds = Math.floor(now() / 1000);
  const signature = base64(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.privateKey,
      new TextEncoder().encode(proofMessage(method, path, seconds, deviceId, idempotencyKey)),
    ),
  );
  return `v1.${seconds}.${signature}`;
}
