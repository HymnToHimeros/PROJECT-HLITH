/**
 * A small encrypted store for secrets kept on this device (a HoYoLAB login the player asked
 * to remember). The value is encrypted with AES-GCM; the key is a non-extractable WebCrypto
 * key kept in IndexedDB, so the browser can use it but no script (and no copy of the site's
 * storage) can read it out. The encrypted text lives in localStorage under the caller's key.
 *
 * Without WebCrypto or IndexedDB (very old browsers, some private modes) nothing is sealed:
 * `vaultAvailable()` is false and callers keep secrets for this one use only.
 */

const DB = 'hlith-device-vault';
const STORE = 'keys';
const KEY_ID = 'aes-gcm-v1';

export interface Sealed {
  v: 1;
  iv: string;
  data: string;
}

export function vaultAvailable(): boolean {
  if (testKey) return true;
  try {
    return typeof indexedDB !== 'undefined' && typeof crypto !== 'undefined' && Boolean(crypto.subtle);
  } catch {
    return false;
  }
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string) => Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'));
  });
}

let keyPromise: Promise<CryptoKey> | null = null;
let testKey: CryptoKey | null = null;

/** This device's key: made once (non-extractable) and kept in IndexedDB. */
function deviceKey(): Promise<CryptoKey> {
  if (testKey) return Promise.resolve(testKey);
  keyPromise ??= (async () => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    const db = await request(open);
    const found = await request(db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY_ID));
    if (found instanceof CryptoKey) return found;
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await request(db.transaction(STORE, 'readwrite').objectStore(STORE).put(key, KEY_ID));
    return key;
  })().catch((e: unknown) => {
    keyPromise = null;
    throw e;
  });
  return keyPromise;
}

export async function seal(value: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deviceKey(), new TextEncoder().encode(JSON.stringify(value)));
  return { v: 1, iv: b64(iv), data: b64(new Uint8Array(data)) };
}

export async function unseal<T>(sealed: Sealed): Promise<T> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv) }, await deviceKey(), unb64(sealed.data));
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

export const isSealed = (x: unknown): x is Sealed => {
  const s = x as Partial<Sealed> | null;
  return Boolean(s) && s?.v === 1 && typeof s.iv === 'string' && typeof s.data === 'string';
};

/** Tests only: use this key instead of IndexedDB (null = back to normal, no vault in tests). */
export function setVaultKeyForTests(key: CryptoKey | null): void {
  testKey = key;
  keyPromise = null;
}
