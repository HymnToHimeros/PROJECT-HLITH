// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isScheduler } from '../supabase/functions/_shared/backupPlan.ts';
import { readHoyolab, type Deps } from '../supabase/functions/_shared/hoyolab.ts';
import {
  checkinDayStart,
  checkinRecord,
  checkRedeemLogin,
  codeLoginMismatch,
  codesToTry,
  MISMATCH_TEXT,
  parseCodeList,
  readCodes,
  redeemCode,
  redeemStatus,
  runLinks,
  type LinkRow,
  type RunDeps,
  type Store,
  type Tried,
} from '../supabase/functions/_shared/hoyolabAuto.ts';
import { ACTION_ERROR_TEXT, cleanLabel, parseAction, storedGames } from '../supabase/functions/_shared/hoyolabLinks.ts';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');
const TOKEN = 'v2_SECRETTOKENvalue1234567890';
const LOGIN = { ltuid_v2: '123456789', ltoken_v2: TOKEN };
const REDEEM = { account_id_v2: '123456789', account_mid_v2: 'abc123_hy', cookie_token_v2: 'v2_COOKIETOKENsecret12345' };
const ROLE = { game_biz: 'hkrpg_global', region: 'prod_official_eur', game_uid: '700000001', nickname: 'Tester', level: 70, region_name: 'Europe' };
const ok = (data: unknown) => ({ retcode: 0, message: 'OK', data });

/** A fake HoYoLAB/HoYoverse that answers by path; redemptions answer from a queue of retcodes. */
function fake(routes: Record<string, unknown>, redeemRetcodes: number[] = []) {
  const calls: { url: string; method: string; headers: Record<string, string>; body?: string }[] = [];
  let now = Date.parse('2026-10-09T12:00:00Z');
  const deps: RunDeps = {
    md5,
    now: () => now,
    random6: () => 'abcdef',
    uuid: () => '00000000-0000-4000-8000-000000000000',
    sleep: async (ms) => {
      now += ms;
    },
    fetch: async (url, init) => {
      calls.push({ url, method: init.method, headers: init.headers, ...(init.body ? { body: init.body } : {}) });
      const path = new URL(url).pathname;
      if (path.includes('webExchangeCdkey')) return { ok: true, status: 200, json: async () => ({ retcode: redeemRetcodes.shift() ?? 0, message: '' }) };
      const key = Object.keys(routes)
        .sort((a, b) => b.length - a.length)
        .find((k) => path.endsWith(k));
      return { ok: true, status: 200, json: async () => (key ? routes[key] : { retcode: -1, message: 'not found' }) };
    },
  };
  return { deps, calls, advance: (ms: number) => (now += ms) };
}

describe('check-in result', () => {
  it('only a real claim counts as claimed, with the reward HoYoLAB named', async () => {
    const { deps } = fake({
      getUserGameRolesByCookie: ok({ list: [ROLE] }),
      '/info': ok({ is_sign: false, total_sign_day: 2 }),
      '/sign': ok({ code: 'ok' }),
      '/home': ok({ awards: [{ name: 'Credit', cnt: 5000 }, { name: 'Fuel', cnt: 1 }, { name: 'Stellar Jade', cnt: 20 }] }),
    });
    const r = await readHoyolab({ gameBiz: 'hkrpg_global', login: LOGIN, want: ['checkin'], claim: true }, deps as Deps);
    expect(checkinRecord(r)).toEqual({ status: 'claimed', message: null, reward: '20 × Stellar Jade' });
  });

  it('already done, a captcha and a bad login are each said plainly', async () => {
    const done = fake({ getUserGameRolesByCookie: ok({ list: [ROLE] }), '/info': ok({ is_sign: true, total_sign_day: 3 }) });
    expect(checkinRecord(await readHoyolab({ gameBiz: 'hkrpg_global', login: LOGIN, want: ['checkin'], claim: true }, done.deps)).status).toBe('already');

    const risk = fake({ getUserGameRolesByCookie: ok({ list: [ROLE] }), '/info': ok({ is_sign: false, total_sign_day: 3 }), '/sign': ok({ gt_result: { is_risk: true } }) });
    const r = checkinRecord(await readHoyolab({ gameBiz: 'hkrpg_global', login: LOGIN, want: ['checkin'], claim: true }, risk.deps));
    expect(r.status).toBe('error');
    expect(r.message).toMatch(/captcha/);

    expect(checkinRecord({ ok: false, error: 'login' })).toMatchObject({ status: 'error', message: expect.stringMatching(/isn’t valid/) });
  });

  it('the check-in day turns over at midnight UTC+8', () => {
    expect(checkinDayStart(Date.parse('2026-10-09T15:59:00Z'))).toBe('2026-10-08T16:00:00.000Z');
    expect(checkinDayStart(Date.parse('2026-10-09T16:01:00Z'))).toBe('2026-10-09T16:00:00.000Z');
  });
});

describe('code redemption', () => {
  it('maps HoYoverse answers to plain statuses', () => {
    expect(redeemStatus(0)).toBe('redeemed');
    expect(redeemStatus(-2017)).toBe('already-used');
    expect(redeemStatus(-2018)).toBe('already-used');
    expect(redeemStatus(-2001)).toBe('expired');
    expect(redeemStatus(-2003)).toBe('invalid');
    expect(redeemStatus(-2008)).toBe('region-locked');
    expect(redeemStatus(-2011)).toBe('level-too-low');
    expect(redeemStatus(-2016)).toBe('cooldown');
    expect(redeemStatus(-1071)).toBe('login');
    expect(redeemStatus(12345)).toBe('error');
    expect(redeemStatus(null)).toBe('error');
  });

  it('checks the separate code login', () => {
    expect(checkRedeemLogin(REDEEM)).toEqual(REDEEM);
    expect(checkRedeemLogin({ ...REDEEM, cookie_token_v2: 'nope' })).toBeNull();
    expect(checkRedeemLogin({ ...REDEEM, account_mid_v2: 'x; evil=1' })).toBeNull();
    expect(checkRedeemLogin(null)).toBeNull();
  });

  it('posts to the game’s own HoYoverse host with the code login only in the cookie', async () => {
    const { deps, calls } = fake({}, [0]);
    const r = await redeemCode(deps, REDEEM, { gameBiz: 'nap_global', uid: '1500000001', region: 'prod_gf_eu', code: 'ZZZFREE' });
    expect(r.status).toBe('redeemed');
    const call = calls[0];
    expect(call?.url).toBe('https://public-operation-nap.hoyoverse.com/common/apicdkey/api/webExchangeCdkeyRisk');
    expect(call?.method).toBe('POST');
    expect(call?.headers.Cookie).toBe(`account_id_v2=123456789; account_mid_v2=abc123_hy; cookie_token_v2=${REDEEM.cookie_token_v2}`);
    expect(JSON.parse(call?.body ?? '{}')).toMatchObject({ cdkey: 'ZZZFREE', game_biz: 'nap_global', region: 'prod_gf_eu', uid: 1500000001, platform: '4' });
    expect(call?.body).not.toContain(REDEEM.cookie_token_v2);
  });

  it('keeps HoYoverse’s answer number with an unclear outcome, so a refusal can be traced', async () => {
    const { deps } = fake({}, [-1071, 0]);
    const refused = await redeemCode(deps, REDEEM, { gameBiz: 'hkrpg_global', uid: '700000001', region: 'prod_official_eur', code: 'AAAA' });
    expect(refused).toEqual({ status: 'login', message: expect.stringContaining('(HoYoverse answer -1071)') as unknown as string });
    expect(refused.message).toMatch(/account_id_v2, account_mid_v2 and cookie_token_v2/);
    const fine = await redeemCode(deps, REDEEM, { gameBiz: 'hkrpg_global', uid: '700000001', region: 'prod_official_eur', code: 'BBBB' });
    expect(fine.message).not.toMatch(/HoYoverse answer/);
  });

  it('the code login must be the same HoYoverse account as the saved login', () => {
    const login = { ...LOGIN, ltmid_v2: 'abc123_hy' };
    expect(codeLoginMismatch(login, REDEEM)).toBeNull();
    expect(codeLoginMismatch(LOGIN, { ...REDEEM, account_mid_v2: 'other9_hy' })).toBeNull(); // no ltmid_v2 saved: only the number can be compared
    // The owner's case: account_id_v2 copied from another account, account_mid_v2 from this one.
    expect(codeLoginMismatch(login, { ...REDEEM, account_id_v2: '987654321' })).toBe('account-id');
    expect(codeLoginMismatch(login, { ...REDEEM, account_mid_v2: 'other9_hy' })).toBe('account-mid');
    expect(codeLoginMismatch(null, REDEEM)).toBeNull();
    expect(ACTION_ERROR_TEXT['redeem-other-account']).toMatch(/Nothing was saved/);
  });

  it('reads pasted codes and the public list', () => {
    expect(readCodes('starrailgift, ABCD1234\nabcd1234 · x · TOOLONGCODEXXXXXXXXXXXXXXXXXXXXXXX')).toEqual(['STARRAILGIFT', 'ABCD1234']);
    expect(parseCodeList({ codes: [{ code: 'STARRAILGIFT', status: 'OK', rewards: '50 stellar jade' }, { code: 'OLD', status: 'NOT_OK' }, { code: 'bad code!', status: 'OK' }] })).toEqual([{ code: 'STARRAILGIFT', rewards: '50 stellar jade' }]);
    expect(parseCodeList('<html>')).toEqual([]);
  });

  it('never retries a finished code, and gives up after 3 errors', () => {
    const t = (code: string, status: Tried['status'], uid = '1'): Tried => ({ link_id: 'L', game_uid: uid, code, status });
    const tried = [t('A', 'redeemed'), t('B', 'expired'), t('C', 'error'), t('D', 'error'), t('D', 'error'), t('D', 'error'), t('E', 'level-too-low'), t('A', 'redeemed', '2')];
    expect(codesToTry(['A', 'B', 'C', 'D', 'E', 'F'], tried, 'L', '1')).toEqual(['C', 'E', 'F']);
    expect(codesToTry(['A'], tried, 'L', '3')).toEqual(['A']); // another game account is separate
  });
});

/** In-memory results table. */
function memoryStore(secret: { login: string | null; redeem: string | null } | null, codes: string[] = [], done = new Set<string>()) {
  const checkins: Parameters<Store['recordCheckin']>[0][] = [];
  const redemptions: Parameters<Store['recordRedemption']>[0][] = [];
  const store: Store = {
    secret: async () => secret,
    checkedIn: async () => done,
    tried: async () => [],
    codesFor: async () => codes,
    recordCheckin: async (r) => void checkins.push(r),
    recordRedemption: async (r) => void redemptions.push(r),
  };
  return { store, checkins, redemptions };
}

const LINK: LinkRow = {
  id: 'L1',
  user_id: 'U1',
  games: [
    { gameBiz: 'hkrpg_global', uid: '700000001', region: 'prod_official_eur' },
    { gameBiz: 'hkrpg_global', uid: '700000002', region: 'prod_official_asia' },
  ],
  auto_checkin: true,
  auto_redeem: true,
};

describe('one automatic run', () => {
  const routes = { getUserGameRolesByCookie: ok({ list: [ROLE, { ...ROLE, game_uid: '700000002' }] }), '/info': ok({ is_sign: false, total_sign_day: 0 }), '/sign': ok({}) };

  it('checks in once per game, tries codes per game account with a pause between, and records every answer', async () => {
    const { deps, calls } = fake(routes, [0, -2017, -2001]);
    const mem = memoryStore({ login: JSON.stringify(LOGIN), redeem: JSON.stringify(REDEEM) }, ['AAAA', 'BBBB']);
    const t0 = deps.now();
    const s = await runLinks([LINK], mem.store, deps, { startedBy: 'auto', deadline: t0 + 120_000, maxRedemptions: 10, jobs: (l) => ({ checkin: l.auto_checkin, redeem: l.auto_redeem }) });
    expect(mem.checkins).toEqual([{ user_id: 'U1', link_id: 'L1', game_biz: 'hkrpg_global', started_by: 'auto', status: 'claimed', message: null, reward: null }]);
    expect(mem.redemptions.map((r) => [r.game_uid, r.code, r.status])).toEqual([
      ['700000001', 'AAAA', 'redeemed'],
      ['700000001', 'BBBB', 'already-used'],
      ['700000002', 'AAAA', 'expired'],
      ['700000002', 'BBBB', 'redeemed'],
    ]);
    expect(s).toEqual({ checkins: 1, redemptions: 4, stoppedEarly: false });
    expect(deps.now() - t0).toBe(3 * 6000); // waited between codes
    expect(JSON.stringify([mem.checkins, mem.redemptions])).not.toContain(TOKEN);
    expect(calls.every((c) => !c.url.includes(TOKEN) && !c.url.includes(REDEEM.cookie_token_v2))).toBe(true);
  });

  it('switches off = nothing happens; already checked in today = no second try', async () => {
    const { deps, calls } = fake(routes);
    const mem = memoryStore({ login: JSON.stringify(LOGIN), redeem: JSON.stringify(REDEEM) }, ['AAAA']);
    await runLinks([{ ...LINK, auto_checkin: false, auto_redeem: false }], mem.store, deps, { startedBy: 'auto', deadline: deps.now() + 1e6, maxRedemptions: 10, jobs: (l) => ({ checkin: l.auto_checkin, redeem: l.auto_redeem }) });
    expect(calls).toHaveLength(0);
    const done = memoryStore({ login: JSON.stringify(LOGIN), redeem: null }, [], new Set(['L1:hkrpg_global']));
    await runLinks([LINK], done.store, deps, { startedBy: 'auto', deadline: deps.now() + 1e6, maxRedemptions: 10, jobs: () => ({ checkin: true, redeem: true }) });
    expect(calls).toHaveLength(0);
  });

  it('a forgotten login is never used, a bad code login stops that account, and the time limit is kept', async () => {
    const gone = fake(routes);
    const forgotten = memoryStore(null, ['AAAA']);
    await runLinks([LINK], forgotten.store, gone.deps, { startedBy: 'auto', deadline: gone.deps.now() + 1e6, maxRedemptions: 10, jobs: () => ({ checkin: true, redeem: true }) });
    expect(gone.calls).toHaveLength(0);
    expect(forgotten.checkins[0]).toMatchObject({ status: 'error' });
    expect(forgotten.redemptions).toHaveLength(0);

    const bad = fake(routes, [-1071]);
    const mem = memoryStore({ login: JSON.stringify(LOGIN), redeem: JSON.stringify(REDEEM) }, ['AAAA', 'BBBB']);
    await runLinks([LINK], mem.store, bad.deps, { startedBy: 'auto', deadline: bad.deps.now() + 1e6, maxRedemptions: 10, jobs: () => ({ checkin: false, redeem: true }) });
    expect(mem.redemptions.map((r) => r.status)).toEqual(['login']);

    // A code login mixed from two accounts is never sent to HoYoverse: one row says why.
    const mixed = fake(routes);
    const mix = memoryStore({ login: JSON.stringify(LOGIN), redeem: JSON.stringify({ ...REDEEM, account_id_v2: '987654321' }) }, ['AAAA', 'BBBB']);
    await runLinks([LINK], mix.store, mixed.deps, { startedBy: 'auto', deadline: mixed.deps.now() + 1e6, maxRedemptions: 10, jobs: () => ({ checkin: false, redeem: true }) });
    expect(mixed.calls.filter((c) => c.url.includes('webExchangeCdkey'))).toHaveLength(0);
    expect(mix.redemptions).toEqual([expect.objectContaining({ code: 'AAAA', game_uid: '700000001', status: 'login', message: MISMATCH_TEXT })]);

    const slow = fake(routes);
    const late = memoryStore({ login: JSON.stringify(LOGIN), redeem: JSON.stringify(REDEEM) }, ['AAAA', 'BBBB']);
    const s = await runLinks([LINK], late.store, slow.deps, { startedBy: 'auto', deadline: slow.deps.now() + 5000, maxRedemptions: 10, jobs: () => ({ checkin: false, redeem: true }) });
    expect(s).toMatchObject({ redemptions: 1, stoppedEarly: true });
  });
});

describe('saved-account requests', () => {
  const id = '1b4e28ba-2fa1-11d2-883f-0016d3cca427';
  it('accepts the four actions and refuses anything malformed', () => {
    expect(parseAction({ gameBiz: 'hkrpg_global', login: LOGIN })).toBeNull(); // a plain reading
    expect(parseAction({ action: 'save', label: '  Alt  ', login: LOGIN, games: ['hkrpg_global', 'genshin'] })).toEqual({ ok: true, action: { action: 'save', linkId: null, label: 'Alt', login: LOGIN, games: ['hkrpg_global'] } });
    expect(parseAction({ action: 'save', login: { ltuid_v2: 'x' }, games: ['hkrpg_global'] })).toEqual({ ok: false, error: 'bad-login' });
    expect(parseAction({ action: 'redeem-login', linkId: id, redeem: REDEEM })).toEqual({ ok: true, action: { action: 'redeem-login', linkId: id, redeem: REDEEM } });
    expect(parseAction({ action: 'redeem-login', linkId: id, redeem: null })).toMatchObject({ ok: true });
    expect(parseAction({ action: 'redeem-login', linkId: 'not-a-uuid', redeem: null })).toEqual({ ok: false, error: 'bad-request' });
    expect(parseAction({ action: 'add-codes', gameBiz: 'nap_global', codes: 'zzzfree, abcd1234' })).toEqual({ ok: true, action: { action: 'add-codes', gameBiz: 'nap_global', codes: ['ZZZFREE', 'ABCD1234'] } });
    expect(parseAction({ action: 'add-codes', gameBiz: 'nap_global', codes: '!!' })).toEqual({ ok: false, error: 'no-codes' });
    expect(parseAction({ action: 'run' })).toEqual({ ok: true, action: { action: 'run', linkId: null, checkin: true, redeem: true } });
    expect(parseAction({ action: 'wipe' })).toEqual({ ok: false, error: 'bad-request' });
  });
  it('labels and what a login covers', () => {
    expect(cleanLabel('')).toBe('Main');
    expect(cleanLabel('A\u0000lt\n  2')).toBe('Alt 2');
    expect(cleanLabel('x'.repeat(60))).toHaveLength(40);
    expect(storedGames({ nap_global: [{ account: { uid: '1500000001', nickname: 'N', level: 40, server: 'Europe' }, region: 'prod_gf_eu' }] })).toEqual([
      { gameBiz: 'nap_global', uid: '1500000001', region: 'prod_gf_eu', nickname: 'N', server: 'Europe', level: 40 },
    ]);
  });
});

describe('the daily function', () => {
  it('only the scheduler holding the service key may start it', () => {
    const src = readFileSync('supabase/functions/hoyolab-daily/index.ts', 'utf8');
    expect(src).toMatch(/isScheduler\(req\.headers\.get\('Authorization'\), serviceKey\)/);
    expect(src).not.toMatch(/console\./); // never logs
    expect(isScheduler('Bearer service', 'service')).toBe(true);
    expect(isScheduler('Bearer anon-key', 'service')).toBe(false);
  });
  it('is declared with the platform check off (it checks the key itself), and the hoyolab function never logs', () => {
    const toml = readFileSync('supabase/config.toml', 'utf8');
    expect(toml).toMatch(/\[functions\.hoyolab-daily\]\nverify_jwt = false/);
    expect(readFileSync('supabase/functions/hoyolab/index.ts', 'utf8')).not.toMatch(/console\./);
  });
  it('refuses to save a code login from another account than the saved login', () => {
    const src = readFileSync('supabase/functions/hoyolab/index.ts', 'utf8');
    expect(src).toMatch(/codeLoginMismatch\(await savedLogin\(a\.linkId\), a\.redeem\)\) return json\(\{ error: ACTION_ERROR_TEXT\['redeem-other-account'\]/);
  });
});
