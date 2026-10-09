// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  allowedUrl,
  checkLogin,
  dynamicSecret,
  errorFor,
  parseCharacters,
  parseRequest,
  readHoyolab,
  type Deps,
  type Request,
} from '../supabase/functions/_shared/hoyolab';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');
const TOKEN = 'v2_SECRETTOKENvalue1234567890';
const LOGIN = { ltuid_v2: '123456789', ltoken_v2: TOKEN };

describe('host allowlist', () => {
  it('allows only HoYoLAB https hosts', () => {
    expect(allowedUrl('https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/note')).toBe(true);
    expect(allowedUrl('https://sg-public-api.hoyolab.com/event/luna/zzz/os/info')).toBe(true);
    expect(allowedUrl('http://bbs-api-os.hoyolab.com/x')).toBe(false);
    expect(allowedUrl('https://evil.example.com/x')).toBe(false);
    expect(allowedUrl('https://bbs-api-os.hoyolab.com.evil.com/x')).toBe(false);
    expect(allowedUrl('https://user:pw@bbs-api-os.hoyolab.com/x')).toBe(false);
    expect(allowedUrl('https://bbs-api-os.hoyolab.com:8443/x')).toBe(false);
    expect(allowedUrl('not a url')).toBe(false);
  });
});

describe('login values and request checks', () => {
  it('accepts ltuid_v2 + ltoken_v2 (+ optional ltmid_v2) and refuses anything else', () => {
    expect(checkLogin(LOGIN)).toEqual(LOGIN);
    expect(checkLogin({ ...LOGIN, ltmid_v2: 'abc123_hy' })).toEqual({ ...LOGIN, ltmid_v2: 'abc123_hy' });
    expect(checkLogin({ ltuid_v2: 'abc', ltoken_v2: TOKEN })).toBeNull();
    expect(checkLogin({ ltuid_v2: '123456789', ltoken_v2: 'nope' })).toBeNull();
    expect(checkLogin({ ...LOGIN, ltoken_v2: 'v2_abc; evil=1' })).toBeNull();
    expect(checkLogin(null)).toBeNull();
  });
  it('checks the game, the UID and the parts', () => {
    expect(parseRequest({ gameBiz: 'genshin', login: LOGIN })).toEqual({ ok: false, error: 'unknown-game' });
    expect(parseRequest({ gameBiz: 'nap_global', login: {} })).toEqual({ ok: false, error: 'bad-request' });
    expect(parseRequest({ gameBiz: 'nap_global', login: LOGIN, uid: '12ab' })).toEqual({ ok: false, error: 'bad-request' });
    const ok = parseRequest({ gameBiz: 'hkrpg_global', login: LOGIN, want: ['stamina', 'stamina', 'pulls'] });
    expect(ok.ok && ok.request.want).toEqual(['stamina']);
  });
});

describe('signature and errors', () => {
  it('builds the DS header as t,r,md5(salt&t&r)', () => {
    const ds = dynamicSecret(md5, 1700000000, 'abcdef');
    const [t, r, h] = ds.split(',');
    expect(t).toBe('1700000000');
    expect(r).toBe('abcdef');
    expect(h).toMatch(/^[0-9a-f]{32}$/);
  });
  it('maps HoYoLAB retcodes to plain reasons', () => {
    expect(errorFor(-100)).toBe('login');
    expect(errorFor(10001)).toBe('login');
    expect(errorFor(10102)).toBe('private');
    expect(errorFor(10101)).toBe('busy');
    expect(errorFor(1034)).toBe('captcha');
    expect(errorFor(-10002)).toBe('no-account');
    expect(errorFor(42)).toBe('server');
  });
});

describe('parsing', () => {
  it('reads characters from both games’ shapes', () => {
    expect(
      parseCharacters({
        avatar_list: [
          { id: 1001, name: 'March 7th', level: 80, rank: 6, equip: { name: 'Cone', level: 80 } },
          { id: 1011, name_mi18n: 'Anby', level: 60, rank: 0 },
          { name: 'no id' },
        ],
      }),
    ).toEqual([
      { id: '1001', name: 'March 7th', level: 80, dupes: 6, weapon: { name: 'Cone', level: 80 } },
      { id: '1011', name: 'Anby', level: 60, dupes: 0, weapon: null },
    ]);
  });
});

/** A fake HoYoLAB that answers by path and records every URL and header it was sent. */
function fakeHoyolab(routes: Record<string, unknown>) {
  const calls: { url: string; headers: Record<string, string>; method: string }[] = [];
  const deps: Deps = {
    md5,
    now: () => Date.parse('2026-10-09T12:00:00Z'),
    random6: () => 'abcdef',
    fetch: async (url, init) => {
      calls.push({ url, headers: init.headers, method: init.method });
      const path = new URL(url).pathname;
      const key = Object.keys(routes)
        .sort((a, b) => b.length - a.length)
        .find((k) => path.endsWith(k));
      const body = key ? routes[key] : { retcode: -1, message: 'not found' };
      return { ok: true, status: 200, json: async () => body };
    },
  };
  return { deps, calls };
}

const ok = (data: unknown) => ({ retcode: 0, message: 'OK', data });
const ROLE = { game_biz: 'hkrpg_global', region: 'prod_official_eur', game_uid: '700000001', nickname: 'Tester', level: 70, region_name: 'Europe' };
const hsr = (want: Request['want'], extra: Partial<Request> = {}): Request => ({ gameBiz: 'hkrpg_global', login: LOGIN, want, ...extra });

describe('readHoyolab', () => {
  it('reads stamina, check-in, characters and endgame, contacting only HoYoLAB, and never returns the login', async () => {
    const { deps, calls } = fakeHoyolab({
      getUserGameRolesByCookie: ok({ list: [ROLE] }),
      '/note': ok({ current_stamina: 180, max_stamina: 240, stamina_recover_time: 21600, current_train_score: 300, max_train_score: 500 }),
      '/info': ok({ is_sign: false, total_sign_day: 8 }),
      '/avatar/info': ok({ avatar_list: [{ id: 1001, name: 'March 7th', level: 80, rank: 2 }] }),
      '/challenge': ok({ has_data: true, star_num: 30, max_floor: 'Stage 12', battle_num: 14 }),
      '/challenge_story': ok({ has_data: false }),
      '/challenge_boss': ok({ has_data: true, star_num: 9, max_floor: 'Difficulty 4', battle_num: 4 }),
    });
    const r = await readHoyolab(hsr(['stamina', 'checkin', 'roster', 'endgame']), deps);
    if (!r.ok) throw new Error(r.error);
    expect(r.answer.account).toEqual({ uid: '700000001', nickname: 'Tester', level: 70, server: 'Europe' });
    expect(r.answer.stamina).toEqual({ current: 180, max: 240, fullInSeconds: 21600 });
    expect(r.answer.dailies).toEqual({ current: 300, max: 500 });
    expect(r.answer.checkin).toEqual({ checkedInToday: false, daysThisMonth: 8, claimedNow: false });
    expect(r.answer.roster?.[0]).toMatchObject({ id: '1001', dupes: 2 });
    expect(r.answer.endgame?.find((e) => e.mode === 'moc' && e.season === 'current')).toMatchObject({ hasData: true, stars: 30, floor: 'Stage 12' });
    expect(r.answer.endgame?.find((e) => e.mode === 'pf')).toMatchObject({ hasData: false });
    expect(r.answer.problems).toEqual({});
    // Safety: every request went to an allowed host, carried the login only in the Cookie header,
    // and the answer holds no trace of it.
    expect(calls.every((c) => allowedUrl(c.url))).toBe(true);
    expect(calls.every((c) => !c.url.includes(TOKEN))).toBe(true);
    expect(calls[0]?.headers.Cookie).toBe(`ltuid_v2=123456789; ltoken_v2=${TOKEN}`);
    expect(JSON.stringify(r.answer)).not.toContain(TOKEN);
    expect(calls.find((c) => c.url.includes('/note'))?.url).toContain('role_id=700000001');
    expect(calls.find((c) => c.url.includes('/note'))?.url).toContain('server=prod_official_eur');
    expect(calls.find((c) => c.url.includes('/info'))?.headers['x-rpc-signgame']).toBe('hkrpg');
    expect(calls.some((c) => c.method === 'POST')).toBe(false); // reading never claims
  });

  it('claims today’s check-in only when asked', async () => {
    const { deps, calls } = fakeHoyolab({
      getUserGameRolesByCookie: ok({ list: [ROLE] }),
      '/info': ok({ is_sign: false, total_sign_day: 8 }),
      '/sign': ok({ code: 'ok' }),
    });
    const r = await readHoyolab(hsr(['checkin'], { claim: true }), deps);
    expect(r.ok && r.answer.checkin).toEqual({ checkedInToday: true, daysThisMonth: 9, claimedNow: true });
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  });

  it('reports a captcha on check-in instead of claiming it worked', async () => {
    const { deps } = fakeHoyolab({
      getUserGameRolesByCookie: ok({ list: [ROLE] }),
      '/info': ok({ is_sign: false, total_sign_day: 8 }),
      '/sign': ok({ gt_result: { is_risk: true } }),
    });
    const r = await readHoyolab(hsr(['checkin'], { claim: true }), deps);
    expect(r.ok && r.answer.checkin?.claimedNow).toBe(false);
    expect(r.ok && r.answer.problems.checkin?.code).toBe('captcha');
  });

  it('fails the whole request on a bad login, and parts on their own otherwise', async () => {
    const bad = fakeHoyolab({ getUserGameRolesByCookie: { retcode: -100, message: 'Please login' } });
    expect(await readHoyolab(hsr(['stamina']), bad.deps)).toEqual({ ok: false, error: 'login' });

    const priv = fakeHoyolab({ getUserGameRolesByCookie: ok({ list: [ROLE] }), '/note': { retcode: 10102, message: 'private' }, '/avatar/info': ok({ avatar_list: [] }) });
    const r = await readHoyolab(hsr(['stamina', 'roster']), priv.deps);
    expect(r.ok && r.answer.problems.stamina?.code).toBe('private');
    expect(r.ok && r.answer.roster).toEqual([]);
  });

  it('asks which account when the login has several, and uses the one picked', async () => {
    const two = { list: [ROLE, { ...ROLE, game_uid: '800000002', region: 'prod_official_asia', region_name: 'Asia' }] };
    const a = fakeHoyolab({ getUserGameRolesByCookie: ok(two) });
    const r = await readHoyolab(hsr(['account']), a.deps);
    expect(r).toMatchObject({ ok: false, error: 'pick-uid' });
    expect(!r.ok && r.accounts?.map((x) => x.uid)).toEqual(['700000001', '800000002']);

    const b = fakeHoyolab({ getUserGameRolesByCookie: ok(two), '/note': ok({ current_stamina: 1, max_stamina: 240, stamina_recover_time: 0 }) });
    await readHoyolab(hsr(['stamina'], { uid: '800000002' }), b.deps);
    expect(b.calls.find((c) => c.url.includes('/note'))?.url).toContain('server=prod_official_asia');
  });

  it('says so when the login has no account for this game', async () => {
    const { deps } = fakeHoyolab({ getUserGameRolesByCookie: ok({ list: [] }) });
    expect(await readHoyolab(hsr(['stamina']), deps)).toEqual({ ok: false, error: 'no-account' });
  });

  it('reads ZZZ battery and Shiyu v2 from their own shapes', async () => {
    const { deps, calls } = fakeHoyolab({
      getUserGameRolesByCookie: ok({ list: [{ ...ROLE, game_biz: 'nap_global', region: 'prod_gf_eu', game_uid: '1500000001' }] }),
      '/note': ok({ energy: { progress: { current: 120, max: 240 }, restore: 43200 }, vitality: { current: 400, max: 400 } }),
      '/hadal_info_v2': ok({ hadal_ver: 'v2', hadal_info_v2: { brief: { score: 41000, max_score: 60000 } } }),
      '/hadal_mem_detail_v2': ok({ has_data: true, total_score: 30000, total_star: 9 }),
    });
    const r = await readHoyolab({ gameBiz: 'nap_global', login: LOGIN, want: ['stamina', 'endgame'] }, deps);
    if (!r.ok) throw new Error(r.error);
    expect(r.answer.stamina).toEqual({ current: 120, max: 240, fullInSeconds: 43200 });
    expect(r.answer.endgame?.find((e) => e.mode === 'shiyu')).toMatchObject({ hasData: true, score: 41000, maxScore: 60000 });
    expect(r.answer.endgame?.find((e) => e.mode === 'assault')).toMatchObject({ score: 30000, stars: 9 });
    expect(calls.find((c) => c.url.includes('hadal_mem_detail_v2'))?.url).toContain('uid=1500000001');
    expect(calls.find((c) => c.url.includes('hadal_mem_detail_v2'))?.url).toContain('region=prod_gf_eu');
  });
});
