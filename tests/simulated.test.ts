// @vitest-environment node
/**
 * Owner's outsider test (T51), the parts that need real logins, run in a simulated way:
 * the real server code against faked HoYoLAB, HoYoverse and Claude answers. Nothing here
 * contacts a real service. Each case checks the user gets a plain message and no secret.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { errorText, runTurn } from '../supabase/functions/_shared/assistant';
import { ERROR_TEXT, readHoyolab, type Deps, type Request } from '../supabase/functions/_shared/hoyolab';
import { fetchHistory, LINK_ERROR_TEXT, parseLink, type RawPull } from '../supabase/functions/_shared/hoyoGachaLog';

const TOKEN = 'v2_SECRETTOKENvalue1234567890';
const LOGIN = { ltuid_v2: '123456789', ltoken_v2: TOKEN };
const md5 = (s: string) => createHash('md5').update(s).digest('hex');
const ok = (data: unknown) => ({ retcode: 0, message: 'OK', data });
const ROLE = { game_biz: 'hkrpg_global', region: 'prod_official_eur', game_uid: '700000001', nickname: 'Tester', level: 70, region_name: 'Europe' };
const hsr = (want: Request['want']): Request => ({ gameBiz: 'hkrpg_global', login: LOGIN, want });

/** A fake HoYoLAB: the account list answers normally, every other call answers `rest`. */
function hoyolab(rest: () => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>, roles: unknown[] = [ROLE]): Deps {
  return {
    md5,
    now: () => Date.parse('2026-10-11T12:00:00Z'),
    random6: () => 'abcdef',
    fetch: async (url) => (url.includes('getUserGameRolesByCookie') ? { ok: true, status: 200, json: async () => ok({ list: roles }) } : rest()),
  };
}
const answer = (body: unknown, status = 200) => async () => ({ ok: status < 400, status, json: async () => body });

describe('HoYoLAB link (simulated)', () => {
  const cases: [string, Deps, keyof typeof ERROR_TEXT][] = [
    ['expired or invalid cookie', hoyolab(answer({ retcode: -100, message: 'Please login' })), 'login'],
    ['captcha', hoyolab(answer({ retcode: 1034, message: 'risk' })), 'captcha'],
    ['too many requests (retcode)', hoyolab(answer({ retcode: -110, message: 'visit too frequently' })), 'busy'],
    ['too many requests (HTTP 429)', hoyolab(answer({}, 429)), 'busy'],
    ['HoYoLAB down (no connection)', hoyolab(async () => { throw new Error('ECONNREFUSED'); }), 'server'],
    ['HoYoLAB down (HTTP 503)', hoyolab(answer({}, 503)), 'server'],
    ['HoYoLAB sends an error page, not JSON', hoyolab(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } })), 'server'],
  ];
  for (const [name, deps, want] of cases) {
    it(`${name}: says so plainly, never shows the login`, async () => {
      const r = await readHoyolab(hsr(['stamina']), deps);
      const problem = r.ok ? r.answer.problems.stamina : { code: r.error, text: ERROR_TEXT[r.error] };
      expect(problem?.code).toBe(want);
      expect(problem?.text).toBe(ERROR_TEXT[want]);
      expect(ERROR_TEXT[want]).not.toMatch(/retcode|undefined|null/i);
      expect(JSON.stringify(r)).not.toContain(TOKEN);
    });
  }

  it('wrong region (no account for this game on the global servers): no-account, nothing read', async () => {
    const r = await readHoyolab(hsr(['stamina', 'roster']), hoyolab(answer(ok({})), []));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('no-account');
  });

  it('a good answer reads stamina; a failed part never blanks the others', async () => {
    const deps: Deps = {
      ...hoyolab(answer({})),
      fetch: async (url) => {
        if (url.includes('getUserGameRolesByCookie')) return { ok: true, status: 200, json: async () => ok({ list: [ROLE] }) };
        if (url.includes('/note')) return { ok: true, status: 200, json: async () => ok({ current_stamina: 200, max_stamina: 240, stamina_recover_time: 7200 }) };
        return { ok: true, status: 200, json: async () => ({ retcode: -110, message: 'busy' }) };
      },
    };
    const r = await readHoyolab(hsr(['stamina', 'roster']), deps);
    expect(r.ok && r.answer.stamina).toEqual({ current: 200, max: 240, fullInSeconds: 7200 });
    expect(r.ok && r.answer.problems.roster?.code).toBe('busy');
  });
});

describe('In-game history link (simulated)', () => {
  const link = (() => {
    const r = parseLink('https://public-operation-hkrpg-sg.hoyoverse.com/common/gacha_record/api/getGachaLog?authkey=KEY&game_biz=hkrpg_global&lang=en');
    if (!r.ok) throw new Error('bad link');
    return r.link;
  })();
  const row = (n: number): RawPull & { uid: string } => ({ id: String(1000 + n), gacha_type: '11', item_id: '20000', name: 'Arrows', rank_type: '3', time: '2026-09-01 10:00:00', uid: '800000001' });
  /** 45 pulls on the character banner (3 pages of up to 20), nothing on the others. */
  const pages = (url: string) => {
    const q = new URL(url).searchParams;
    if (q.get('gacha_type') !== '11') return ok({ list: [], region_time_zone: 1 });
    const all = Array.from({ length: 45 }, (_, i) => row(45 - i));
    const end = q.get('end_id');
    const from = end === '0' ? 0 : all.findIndex((r) => r.id === end) + 1;
    return ok({ list: all.slice(from, from + 20), region_time_zone: 1 });
  };
  const fetchOk = async (url: string) => ({ ok: true, status: 200, json: async () => pages(url) });

  it('several pages: every pull read once', async () => {
    const r = await fetchHistory(link, fetchOk);
    expect(r.ok && r.result.list.length).toBe(45);
    expect(r.ok && new Set(r.result.list.map((x) => x.id)).size).toBe(45);
  });

  it('a second import adds nothing that is already stored', async () => {
    const first = await fetchHistory(link, fetchOk);
    const known = new Set(first.ok ? first.result.list.map((x) => x.id) : []);
    const again = await fetchHistory(link, fetchOk, { stopAtIds: known });
    expect(again.ok && again.result.list).toEqual([]);
  });

  it('empty history: ok, nothing to add', async () => {
    const r = await fetchHistory(link, async () => ({ ok: true, status: 200, json: async () => ok({ list: [] }) }));
    expect(r.ok && r.result.list).toEqual([]);
  });

  it('expired authkey: says to copy a fresh link', async () => {
    const r = await fetchHistory(link, async () => ({ ok: true, status: 200, json: async () => ({ retcode: -101, message: 'authkey timeout' }) }));
    expect(r).toEqual({ ok: false, error: 'expired' });
    expect(LINK_ERROR_TEXT.expired).toMatch(/expired/);
  });

  it('HoYoverse down or sending an error page: a plain "server" error, not a crash', async () => {
    const down = await fetchHistory(link, async () => {
      throw new Error('ECONNRESET');
    });
    expect(down.ok).toBe(false);
    if (!down.ok) expect(down.error).toBe('server');
    const html = await fetchHistory(link, async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } }));
    expect(html.ok).toBe(false);
    if (!html.ok) expect(html.error).toBe('server');
  });

  it("a link from the other game is read as that game (the app then refuses it: History.tsx)", () => {
    const zzz = parseLink('https://gs.hoyoverse.com/nap/event/e20230424gacha/index.html?authkey=abc&game_biz=nap_global&lang=en');
    expect(zzz.ok && zzz.link.host).toContain('nap');
  });
});

describe('Assistant with your own key (simulated)', () => {
  const req = { apiKey: 'sk-ant-TESTKEY-0000', model: 'claude-haiku-5-5' as const, messages: [{ role: 'user' as const, content: 'hi' }], userData: '{}' };
  it('a good reply comes back with its text', async () => {
    const reply = await runTurn(req as never, async () => ({ id: 'm', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', content: [{ type: 'text', text: 'Hello' }], stop_reason: 'end_turn', stop_details: null, usage: { input_tokens: 1, output_tokens: 1 } }) as never);
    expect(reply.content).toEqual([{ type: 'text', text: 'Hello' }]);
  });
  for (const [what, status, words] of [
    ['wrong key', 401, /did not accept this API key/],
    ['rate-limited', 429, /rate or spend limit/],
    ['provider busy', 529, /busy/],
    ['timeout or no connection', undefined, /could not reach Claude/],
  ] as const) {
    it(`${what}: a plain message without the key`, () => {
      const e = errorText(status);
      expect(e.error).toMatch(words);
      expect(e.error).not.toContain('sk-ant');
    });
  }
});
