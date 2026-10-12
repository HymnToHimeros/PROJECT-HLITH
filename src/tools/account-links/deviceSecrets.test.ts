import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setVaultKeyForTests } from '../../core/data/deviceVault';
import { deviceAccounts, deviceAccountsSaved, forgetDeviceAccount, loadDeviceAccounts, rememberWorks, resetDeviceAccountsForTests, saveDeviceAccount } from './hoyolab';

const TOKEN = 'v2_SEALEDTESTTOKEN0123456789';
const SEALED = 'hlith.secret.hoyolab.sealed';
const newKey = () => crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
/** Everything this browser stores, as one string: the login must never appear in it as plain text. */
const storage = () => Object.keys(localStorage).map((k) => `${k}=${localStorage.getItem(k)}`).join('\n');
/** A fresh page load: memory gone, storage and the browser's key kept. */
const reload = () => resetDeviceAccountsForTests();

beforeEach(async () => {
  localStorage.clear();
  reload();
  setVaultKeyForTests(await newKey());
});
afterEach(() => setVaultKeyForTests(null));

describe('logins remembered on this device are encrypted', () => {
  it('a new login is stored encrypted, never as plain text, and reads back after a reload', async () => {
    await loadDeviceAccounts();
    saveDeviceAccount({ label: 'Main', login: { ltuid_v2: '111', ltoken_v2: TOKEN }, games: [{ gameId: 'aa', uid: '700' }] });
    await deviceAccountsSaved();
    expect(localStorage.getItem(SEALED)).toBeTruthy();
    expect(storage()).not.toContain(TOKEN);
    reload();
    await loadDeviceAccounts();
    expect(deviceAccounts().map((a) => [a.label, a.login.ltoken_v2])).toEqual([['Main', TOKEN]]);
  });

  it('moves plain-text logins from older versions into the encrypted list without losing any', async () => {
    localStorage.setItem('hlith.secret.hoyolab.accounts', JSON.stringify([{ id: 'd:1', label: 'Main', login: { ltuid_v2: '111', ltoken_v2: TOKEN }, games: [{ gameId: 'aa' }], savedAt: '2026-10-01T00:00:00Z' }]));
    localStorage.setItem('hlith.secret.hoyolab', JSON.stringify({ bb: { login: { ltuid_v2: '222', ltoken_v2: TOKEN }, uid: '1500', savedAt: '2026-09-01T00:00:00Z' } }));
    expect(deviceAccounts()).toHaveLength(2); // shown straight away, before the move
    await loadDeviceAccounts();
    await deviceAccountsSaved();
    expect(localStorage.getItem('hlith.secret.hoyolab.accounts')).toBeNull();
    expect(localStorage.getItem('hlith.secret.hoyolab')).toBeNull();
    expect(storage()).not.toContain(TOKEN);
    reload();
    await loadDeviceAccounts();
    expect(deviceAccounts().map((a) => [a.id, a.label, a.games])).toEqual([
      ['d:1', 'Main', [{ gameId: 'aa' }]],
      ['v1:222', 'Saved login', [{ gameId: 'bb', uid: '1500' }]],
    ]);
  });

  it('keeps the plain copy when the encrypted one can’t be written', async () => {
    const plain = JSON.stringify([{ id: 'd:1', label: 'Main', login: { ltuid_v2: '111', ltoken_v2: TOKEN }, games: [], savedAt: '2026-10-01T00:00:00Z' }]);
    localStorage.setItem('hlith.secret.hoyolab.accounts', plain);
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k === SEALED) throw new DOMException('full', 'QuotaExceededError');
      setItem.call(this, k, v);
    };
    try {
      await loadDeviceAccounts();
      await deviceAccountsSaved();
    } finally {
      Storage.prototype.setItem = setItem;
    }
    expect(localStorage.getItem('hlith.secret.hoyolab.accounts')).toBe(plain);
    expect(deviceAccounts()).toHaveLength(1);
  });

  it('a change made before the encrypted list is open is added to it, not written over it', async () => {
    saveDeviceAccount({ label: 'Main', login: { ltuid_v2: '111', ltoken_v2: TOKEN }, games: [{ gameId: 'aa' }] });
    await deviceAccountsSaved();
    reload();
    saveDeviceAccount({ label: 'Alt', login: { ltuid_v2: '222', ltoken_v2: TOKEN }, games: [{ gameId: 'aa' }] });
    await deviceAccountsSaved();
    reload();
    await loadDeviceAccounts();
    expect(deviceAccounts().map((a) => a.label)).toEqual(['Main', 'Alt']);
  });

  it('Forget removes the login from the encrypted list', async () => {
    const a = saveDeviceAccount({ label: 'Main', login: { ltuid_v2: '111', ltoken_v2: TOKEN }, games: [] });
    await deviceAccountsSaved();
    forgetDeviceAccount(a.id);
    await deviceAccountsSaved();
    expect(localStorage.getItem(SEALED)).toBeNull();
    reload();
    await loadDeviceAccounts();
    expect(deviceAccounts()).toEqual([]);
  });

  it('a list encrypted with a key this browser no longer has is left as it is until the next save', async () => {
    saveDeviceAccount({ label: 'Main', login: { ltuid_v2: '111', ltoken_v2: TOKEN }, games: [] });
    await deviceAccountsSaved();
    const blob = localStorage.getItem(SEALED);
    reload();
    setVaultKeyForTests(await newKey()); // the browser's key was cleared
    await loadDeviceAccounts();
    await deviceAccountsSaved();
    expect(deviceAccounts()).toEqual([]);
    expect(localStorage.getItem(SEALED)).toBe(blob);
  });

  it('Forget never rewrites a plain copy: it is moved into the encrypted list, then removed whole', async () => {
    localStorage.setItem('hlith.secret.hoyolab', JSON.stringify({ aa: { login: { ltuid_v2: '1', ltoken_v2: TOKEN }, savedAt: 'x' }, bb: { login: { ltuid_v2: '2', ltoken_v2: TOKEN }, savedAt: 'x' } }));
    forgetDeviceAccount('v1:1');
    await deviceAccountsSaved();
    expect(localStorage.getItem('hlith.secret.hoyolab')).toBeNull();
    reload();
    await loadDeviceAccounts();
    expect(deviceAccounts().map((a) => a.login.ltuid_v2)).toEqual(['2']); // the other login is kept, encrypted
  });

  it('without encryption in this browser, nothing is written in plain text', async () => {
    setVaultKeyForTests(null); // no IndexedDB here
    expect(rememberWorks()).toBe(false);
    saveDeviceAccount({ label: 'Main', login: { ltuid_v2: '111', ltoken_v2: TOKEN }, games: [] });
    await deviceAccountsSaved();
    expect(deviceAccounts()).toHaveLength(1); // kept for this page
    expect(storage()).not.toContain(TOKEN);
  });
});
