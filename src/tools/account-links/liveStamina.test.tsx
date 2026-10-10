import { renderHook, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LinkedAccount } from './accounts';
import { fakeGame } from './fakeGame';

const invoke = vi.fn();
let accounts: LinkedAccount[] = [];
let blocker: string | null = null;

vi.mock('../../core/data/backend', () => ({ backend: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock('./useAccounts', () => ({
  useAccounts: () => ({ accounts, blocker, signedIn: blocker === null, server: blocker === null ? { accounts, checkins: [], redemptions: [], publicCodes: {} } : null, loadError: null, refresh: () => {} }),
}));

const { cachedReading, clearStaminaCache, fullInText, projectStamina, saveReading, staminaSources, STAMINA_TTL_MS, useLiveStamina } = await import('./liveStamina');

const linked = fakeGame({ accountLinks: [{ provider: 'hoyolab', supports: ['stamina', 'checkin'], config: { gameBiz: 'hkrpg_global' } }] });
const unlinked = fakeGame({ id: 'bb', short: 'BB' });
const pool = { minutesPerPoint: 6 };
const READ = '2026-10-10T12:00:00.000Z';
const at = (min: number) => Date.parse(READ) + min * 60_000;
const server: LinkedAccount = { id: 'link-1', label: 'Main', where: 'server', hoyolabId: '123456789', games: [{ gameId: 'aa', uid: '700000001' }], autoCheckin: false, autoRedeem: false, hasRedeemLogin: false };

describe('counting stamina forward', () => {
  // 182/240: 58 points missing × 6 min = 348 min = 20 880 s, which is what HoYoLAB says.
  const r = { current: 182, max: 240, fullInSeconds: 20_880, readAt: READ };

  it('shows the read as is right after reading', () => {
    expect(projectStamina(r, pool, at(0))).toEqual({ value: 182, max: 240, fullInSeconds: 20_880, projected: false });
  });

  it('adds one point per regeneration step, following HoYoLAB’s full-in time', () => {
    expect(projectStamina(r, pool, at(6))).toMatchObject({ value: 183, fullInSeconds: 20_520, projected: true });
    expect(projectStamina(r, pool, at(59))).toMatchObject({ value: 191, projected: true });
    expect(projectStamina(r, pool, at(400))).toMatchObject({ value: 240, fullInSeconds: 0 });
  });

  it('doesn’t count forward when the game record’s rate disagrees with HoYoLAB', () => {
    const odd = { ...r, fullInSeconds: 3600 };
    expect(projectStamina(odd, pool, at(30))).toEqual({ value: 182, max: 240, fullInSeconds: 1800, projected: false });
    expect(projectStamina(r, undefined, at(30))).toMatchObject({ value: 182, projected: false });
  });

  it('above the cap nothing regenerates', () => {
    expect(projectStamina({ current: 250, max: 240, fullInSeconds: 0, readAt: READ }, pool, at(60))).toEqual({ value: 250, max: 240, fullInSeconds: 0, projected: false });
  });

  it('says how long until full in plain words', () => {
    expect(fullInText(20_820)).toBe('Full in 5 h 47 min');
    expect(fullInText(300)).toBe('Full in 5 min');
    expect(fullInText(0)).toBe('Full now');
    expect(fullInText(null)).toBeNull();
  });
});

describe('which account reads which game', () => {
  it('only games with a HoYoLAB stamina link and a usable linked account', () => {
    const device: LinkedAccount = { ...server, id: 'd1', where: 'device', login: { ltuid_v2: '1', ltoken_v2: 'v2_x' } };
    expect(staminaSources([linked, unlinked], [server]).map((s) => [s.game.id, s.account.id, s.uid])).toEqual([['aa', 'link-1', '700000001']]);
    expect(staminaSources([linked], [device]).map((s) => s.account.id)).toEqual(['d1']);
    expect(staminaSources([linked], [])).toEqual([]);
  });
});

describe('useLiveStamina', () => {
  beforeEach(() => {
    clearStaminaCache();
    invoke.mockReset();
    accounts = [server];
    blocker = null;
  });
  afterEach(() => vi.useRealTimers());

  it('reads once on open, keeps the answer with its read time, and doesn’t ask again while fresh', async () => {
    const readAt = new Date().toISOString();
    invoke.mockResolvedValue({ data: { account: { uid: '700000001' }, readAt, stamina: { current: 100, max: 240, fullInSeconds: 50_400 }, problems: {} }, error: null });
    const { result, unmount } = renderHook(() => useLiveStamina([linked, unlinked]));
    expect(result.current.stamina.aa).toEqual({ state: 'loading' });
    expect(result.current.stamina.bb).toEqual({ state: 'none' });
    await waitFor(() => expect(result.current.stamina.aa).toMatchObject({ state: 'ok', reading: { current: 100, readAt } }));
    expect(invoke).toHaveBeenCalledWith('hoyolab', { body: { gameBiz: 'hkrpg_global', linkId: 'link-1', uid: '700000001', want: ['stamina'], claim: false } });
    expect(cachedReading('aa:server:123456789')).toMatchObject({ current: 100 });
    unmount();
    // Opening Today again within a few minutes uses the kept answer.
    const again = renderHook(() => useLiveStamina([linked]));
    await waitFor(() => expect(again.result.current.stamina.aa).toMatchObject({ state: 'ok' }));
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('reads again when the kept answer is older than a few minutes', async () => {
    saveReading('aa:server:123456789', { current: 90, max: 240, fullInSeconds: 54_000, readAt: new Date(Date.now() - STAMINA_TTL_MS - 1000).toISOString() });
    invoke.mockResolvedValue({ data: { account: { uid: '700000001' }, readAt: new Date().toISOString(), stamina: { current: 120, max: 240, fullInSeconds: 43_200 }, problems: {} }, error: null });
    const { result } = renderHook(() => useLiveStamina([linked]));
    expect(result.current.stamina.aa).toMatchObject({ state: 'ok', reading: { current: 90 }, refreshing: true });
    await waitFor(() => expect(result.current.stamina.aa).toMatchObject({ state: 'ok', reading: { current: 120 }, refreshing: false }));
  });

  it('an error is the reason, never a number; retry asks again', async () => {
    invoke.mockResolvedValueOnce({ data: { account: { uid: '700000001' }, readAt: new Date().toISOString(), problems: { stamina: { code: 'private', text: 'Real-Time Notes are switched off on HoYoLAB.' } } }, error: null });
    const { result } = renderHook(() => useLiveStamina([linked]));
    await waitFor(() => expect(result.current.stamina.aa).toEqual({ state: 'error', text: 'Real-Time Notes are switched off on HoYoLAB.' }));
    invoke.mockResolvedValueOnce({ data: { account: { uid: '700000001' }, readAt: new Date().toISOString(), stamina: { current: 5, max: 240, fullInSeconds: 84_600 }, problems: {} }, error: null });
    act(() => result.current.retry('aa'));
    await waitFor(() => expect(result.current.stamina.aa).toMatchObject({ state: 'ok', reading: { current: 5 } }));
  });

  it('without HLITH’s server (or signed out) nothing is read: Connect account stays', () => {
    blocker = 'This copy of HLITH runs on this device only';
    const { result } = renderHook(() => useLiveStamina([linked]));
    expect(result.current.stamina.aa).toEqual({ state: 'none' });
    expect(invoke).not.toHaveBeenCalled();
  });
});
