/**
 * Reads a player's own HoYoLAB data: live stamina (Real-Time Notes), daily
 * check-in, characters (for roster import) and endgame records. Pure logic
 * shared by the hoyolab server function and the tests; `fetch` and `md5` are
 * passed in. Pull history is NOT read here (CLAUDE.md Override 2): it comes
 * only from the in-game history link and export files.
 *
 * Safety:
 * - Only the hosts in ALLOWED_HOSTS are ever contacted.
 * - The player's login values are used for this one request. They are never
 *   logged, stored, or sent back in the answer.
 *
 * HoYoLAB has no public, documented API. Everything below follows the
 * community library genshin.py (MIT), which trackers and Discord bots use:
 *   - Endpoints: https://github.com/seriaati/genshin.py/blob/master/genshin/client/routes.py
 *     (TAKUMI_URL, RECORD_URL, REWARD_URL)
 *   - Star Rail calls: .../genshin/client/components/chronicle/starrail.py
 *     ("note", "avatar/info", "challenge", "challenge_story", "challenge_boss")
 *   - ZZZ calls: .../genshin/client/components/chronicle/zzz.py
 *     ("note", "avatar/basic", "hadal_info_v2", "hadal_mem_detail_v2")
 *   - Check-in: .../genshin/client/components/daily.py ("info", "sign", x-rpc-signgame)
 *   - Request signature (DS) and headers: .../genshin/utility/ds.py, constants.py (DS_SALT overseas)
 *   - Error codes: .../genshin/errors.py, constants.py (GEETEST_RETCODES)
 *   - Cookie names (ltuid_v2 / ltoken_v2, since July 2023): https://seria.is-a.dev/genshin.py/authentication
 *     and https://github.com/canaria3406/hoyolab-auto-sign
 * NOT YET TESTED against a live HoYoLAB account (no real login was available
 * while building). The app labels every reading from here as unverified.
 */

export type GameBiz = 'hkrpg_global' | 'nap_global';
export type Part = 'account' | 'stamina' | 'checkin' | 'roster' | 'endgame';
export const PARTS: Part[] = ['account', 'stamina', 'checkin', 'roster', 'endgame'];

/** The only hosts this code may contact. */
export const ALLOWED_HOSTS = new Set(['api-os-takumi.mihoyo.com', 'bbs-api-os.hoyolab.com', 'sg-act-public-api.hoyolab.com', 'sg-public-api.hoyolab.com']);

const ROLES_URL = 'https://api-os-takumi.mihoyo.com/binding/api/getUserGameRolesByCookie';

interface EndgameMode {
  id: string;
  label: string;
  path: string;
  /** Query uses role_id/server (most) or uid/region (newer ZZZ pages). */
  idStyle: 'role' | 'uid';
  extra?: Record<string, string>;
  parse: (data: Record<string, unknown>) => EndgameFigures;
}

interface GameConfig {
  recordBase: string;
  charactersPath: string;
  charactersQuery: Record<string, string>;
  checkin: { url: string; actId: string; signgame: string };
  parseNote: (data: Record<string, unknown>) => { stamina: Stamina | null; dailies: Daily | null };
  endgame: EndgameMode[];
}

export interface Stamina {
  current: number;
  max: number;
  /** Seconds until full, as HoYoLAB reported it at `readAt`. */
  fullInSeconds: number;
}
export interface Daily {
  current: number;
  max: number;
}
export interface EndgameFigures {
  hasData: boolean;
  stars?: number;
  score?: number;
  maxScore?: number;
  floor?: string;
  battles?: number;
}
export interface EndgameRecord extends EndgameFigures {
  mode: string;
  label: string;
  season: 'current' | 'previous';
}
export interface ImportedCharacter {
  id: string;
  name: string;
  level: number | null;
  dupes: number;
  weapon: { name: string; level: number | null } | null;
}
export interface Account {
  uid: string;
  nickname: string;
  level: number | null;
  server: string;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Star Rail endgame pages share one shape (StarRailChallenge / PureFiction / APCShadow in genshin.py). */
const hsrEndgame = (d: Record<string, unknown>): EndgameFigures => {
  const hasData = d.has_data === true;
  const out: EndgameFigures = { hasData };
  const stars = num(d.star_num);
  const battles = num(d.battle_num);
  if (hasData && stars !== null) out.stars = stars;
  if (hasData && battles !== null) out.battles = battles;
  if (hasData && str(d.max_floor)) out.floor = str(d.max_floor);
  return out;
};

export const GAMES: Record<GameBiz, GameConfig> = {
  hkrpg_global: {
    recordBase: 'https://bbs-api-os.hoyolab.com/game_record/hkrpg/api',
    charactersPath: 'avatar/info',
    charactersQuery: { need_wiki: 'true' },
    checkin: { url: 'https://sg-public-api.hoyolab.com/event/luna/hkrpg/os', actId: 'e202303301540311', signgame: 'hkrpg' },
    // StarRailNote: current_stamina, max_stamina, stamina_recover_time (seconds), current_train_score / max_train_score.
    parseNote: (d) => {
      const current = num(d.current_stamina);
      const max = num(d.max_stamina);
      const full = num(d.stamina_recover_time);
      const dc = num(d.current_train_score);
      const dm = num(d.max_train_score);
      return {
        stamina: current !== null && max !== null ? { current, max, fullInSeconds: full ?? 0 } : null,
        dailies: dc !== null && dm !== null ? { current: dc, max: dm } : null,
      };
    },
    endgame: [
      { id: 'moc', label: 'Memory of Chaos', path: 'challenge', idStyle: 'role', extra: { need_all: 'true' }, parse: hsrEndgame },
      { id: 'pf', label: 'Pure Fiction', path: 'challenge_story', idStyle: 'role', extra: { need_all: 'true' }, parse: hsrEndgame },
      { id: 'as', label: 'Apocalyptic Shadow', path: 'challenge_boss', idStyle: 'role', extra: { need_all: 'true' }, parse: hsrEndgame },
    ],
  },
  nap_global: {
    recordBase: 'https://sg-act-public-api.hoyolab.com/event/game_record_zzz/api/zzz',
    charactersPath: 'avatar/basic',
    charactersQuery: {},
    checkin: { url: 'https://sg-public-api.hoyolab.com/event/luna/zzz/os', actId: 'e202406031448091', signgame: 'zzz' },
    // ZZZNotes: energy.progress.{current,max}, energy.restore (seconds), vitality.{current,max}.
    parseNote: (d) => {
      const energy = obj(d.energy);
      const progress = obj(energy.progress);
      const current = num(progress.current);
      const max = num(progress.max);
      const vitality = obj(d.vitality);
      const dc = num(vitality.current);
      const dm = num(vitality.max);
      return {
        stamina: current !== null && max !== null ? { current, max, fullInSeconds: num(energy.restore) ?? 0 } : null,
        dailies: dc !== null && dm !== null ? { current: dc, max: dm } : null,
      };
    },
    endgame: [
      {
        id: 'shiyu',
        label: 'Shiyu Defense',
        path: 'hadal_info_v2',
        idStyle: 'role',
        // hadal_ver says which shape is inside: hadal_info_v1 (max_layer) or hadal_info_v2 (brief.score).
        parse: (d) => {
          const ver = str(d.hadal_ver);
          const inner = obj(d[`hadal_info_${ver}`]);
          if (ver === 'v2') {
            const brief = obj(inner.brief);
            const score = num(brief.score);
            const maxScore = num(brief.max_score);
            const hasData = score !== null;
            const out: EndgameFigures = { hasData };
            if (score !== null) out.score = score;
            if (maxScore !== null) out.maxScore = maxScore;
            return out;
          }
          const hasData = inner.has_data === true;
          const floor = num(inner.max_layer);
          return hasData && floor !== null ? { hasData, floor: String(floor) } : { hasData };
        },
      },
      {
        id: 'assault',
        label: 'Deadly Assault',
        path: 'hadal_mem_detail_v2',
        idStyle: 'uid',
        parse: (d) => {
          const hasData = d.has_data === true;
          const out: EndgameFigures = { hasData };
          const score = num(d.total_score);
          const stars = num(d.total_star);
          if (hasData && score !== null) out.score = score;
          if (hasData && stars !== null) out.stars = stars;
          return out;
        },
      },
    ],
  },
};

// ── Login values ─────────────────────────────────────────────────

export interface Login {
  ltuid_v2: string;
  ltoken_v2: string;
  ltmid_v2?: string;
}

/** Same checks the V1 app used: ltuid_v2 is a number, ltoken_v2 starts with v2_, ltmid_v2 ends in _hy. */
export function checkLogin(raw: unknown): Login | null {
  const o = obj(raw);
  const ltuid = str(o.ltuid_v2).trim();
  const ltoken = str(o.ltoken_v2).trim();
  const ltmid = str(o.ltmid_v2).trim();
  if (!/^\d{4,15}$/.test(ltuid)) return null;
  if (!/^v2_[\w\-.=+/]{10,600}$/.test(ltoken)) return null;
  if (ltmid && !/^[0-9a-z]{4,30}_hy$/i.test(ltmid)) return null;
  return ltmid ? { ltuid_v2: ltuid, ltoken_v2: ltoken, ltmid_v2: ltmid } : { ltuid_v2: ltuid, ltoken_v2: ltoken };
}

const cookieOf = (l: Login) => [`ltuid_v2=${l.ltuid_v2}`, `ltoken_v2=${l.ltoken_v2}`, l.ltmid_v2 ? `ltmid_v2=${l.ltmid_v2}` : ''].filter(Boolean).join('; ');

// ── Request signature ────────────────────────────────────────────

/** Overseas "dynamic secret" salt, from genshin.py constants.DS_SALT[Region.OVERSEAS]. */
export const DS_SALT_OVERSEAS = '6s25p5ox5y14umn1p61aqyyvbvvl3lrt';

/** `t,r,md5("salt=…&t=…&r=…")` as genshin.py's generate_dynamic_secret. */
export function dynamicSecret(md5: (s: string) => string, nowSeconds: number, random6: string): string {
  return `${nowSeconds},${random6},${md5(`salt=${DS_SALT_OVERSEAS}&t=${nowSeconds}&r=${random6}`)}`;
}

// ── Errors ───────────────────────────────────────────────────────

export type HoyoError = 'bad-request' | 'login' | 'private' | 'busy' | 'captcha' | 'no-account' | 'pick-uid' | 'unknown-game' | 'blocked-host' | 'server';

export const ERROR_TEXT: Record<HoyoError, string> = {
  'bad-request': 'Send both login values: ltuid_v2 (a number) and ltoken_v2 (starts with v2_).',
  login: 'HoYoLAB says this login isn’t valid any more. Copy fresh ltuid_v2 and ltoken_v2 values from hoyolab.com and try again.',
  private: 'HoYoLAB says this data is private. On hoyolab.com open your profile → Battle Chronicle → settings and turn on showing your Battle Chronicle and Real-Time Notes.',
  busy: 'HoYoLAB is limiting requests right now. Try again in a few minutes.',
  captcha: 'HoYoLAB wants a captcha first. Open hoyolab.com in your browser, do the step it asks for there, then try again.',
  'no-account': 'This HoYoLAB login has no game account for this game on the global servers.',
  'pick-uid': 'This HoYoLAB login has more than one account for this game. Pick the UID to use.',
  'unknown-game': 'HLITH can’t read this game from HoYoLAB.',
  'blocked-host': 'HLITH refused to contact a server that isn’t HoYoLAB.',
  server: 'HoYoLAB returned an error. Try again later.',
};

/** HoYoLAB's retcode → our error (genshin.py errors.py + GEETEST_RETCODES). */
export function errorFor(retcode: number): HoyoError {
  if ([-100, 10001, 10103, -1071].includes(retcode)) return 'login';
  if ([10102, 10104].includes(retcode)) return 'private';
  if ([10101, -110, 1028, -500004].includes(retcode)) return 'busy';
  if ([10035, 5003, 10041, 1034].includes(retcode)) return 'captcha';
  if ([-10002, 1009, -1073].includes(retcode)) return 'no-account';
  return 'server';
}

// ── Calling HoYoLAB ──────────────────────────────────────────────

export type Fetch = (url: string, init: { method: 'GET' | 'POST'; headers: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface Deps {
  fetch: Fetch;
  md5: (s: string) => string;
  now: () => number; // epoch ms
  random6: () => string;
}

type Got = { ok: true; data: Record<string, unknown> } | { ok: false; error: HoyoError };

/** Is this an https URL on an allowed host? Every request goes through this. */
export function allowedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && ALLOWED_HOSTS.has(u.hostname) && !u.username && !u.password && u.port === '';
  } catch {
    return false;
  }
}

async function call(deps: Deps, login: Login, url: string, opts: { method?: 'GET' | 'POST'; signgame?: string } = {}): Promise<Got> {
  if (!allowedUrl(url)) return { ok: false, error: 'blocked-host' };
  const headers: Record<string, string> = {
    Cookie: cookieOf(login),
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    Accept: 'application/json',
    Origin: 'https://act.hoyolab.com',
    Referer: 'https://act.hoyolab.com/',
    'x-rpc-app_version': '1.5.0',
    'x-rpc-client_type': '5',
    'x-rpc-language': 'en-us',
    'x-rpc-lang': 'en-us',
    DS: dynamicSecret(deps.md5, Math.floor(deps.now() / 1000), deps.random6()),
  };
  if (opts.signgame) headers['x-rpc-signgame'] = opts.signgame;
  let res: Awaited<ReturnType<Fetch>>;
  try {
    res = await deps.fetch(url, { method: opts.method ?? 'GET', headers, ...(opts.method === 'POST' ? { body: '{}' } : {}) });
  } catch {
    return { ok: false, error: 'server' };
  }
  if (!res.ok) return { ok: false, error: res.status === 429 ? 'busy' : 'server' };
  let body: Record<string, unknown>;
  try {
    body = obj(await res.json());
  } catch {
    return { ok: false, error: 'server' };
  }
  const retcode = num(body.retcode);
  if (retcode !== 0) return { ok: false, error: retcode === null ? 'server' : errorFor(retcode) };
  return { ok: true, data: obj(body.data) };
}

const withQuery = (base: string, q: Record<string, string>) => `${base}?${new URLSearchParams(q).toString()}`;

/** genshin.py models: StarRailPartialCharacter (id, name, level, rank, equip) and ZZZPartialAgent (id, name_mi18n, level, rank). */
export function parseCharacters(data: Record<string, unknown>): ImportedCharacter[] {
  return arr(data.avatar_list)
    .map(obj)
    .map((c) => {
      const equip = obj(c.equip);
      const weaponName = str(equip.name);
      return {
        id: str(c.id),
        name: str(c.name) || str(c.name_mi18n) || str(c.full_name_mi18n),
        level: num(c.level),
        dupes: Math.max(0, num(c.rank) ?? 0),
        weapon: weaponName ? { name: weaponName, level: num(equip.level) } : null,
      };
    })
    .filter((c) => c.id !== '');
}

export interface Request {
  gameBiz: GameBiz;
  login: Login;
  uid?: string;
  want: Part[];
  /** 'checkin' also claims today's reward when it isn't claimed yet. */
  claim?: boolean;
}

export interface Answer {
  account: Account;
  readAt: string;
  stamina?: Stamina | null;
  dailies?: Daily | null;
  checkin?: { checkedInToday: boolean; daysThisMonth: number | null; claimedNow: boolean };
  roster?: ImportedCharacter[];
  endgame?: EndgameRecord[];
  /** Parts that failed, with a plain reason. The rest still came through. */
  problems: Partial<Record<Part, { code: HoyoError; text: string }>>;
}

/** Turn the request body into a checked request, or say what's wrong. */
export function parseRequest(body: unknown): { ok: true; request: Request } | { ok: false; error: HoyoError } {
  const o = obj(body);
  const gameBiz = str(o.gameBiz);
  if (gameBiz !== 'hkrpg_global' && gameBiz !== 'nap_global') return { ok: false, error: 'unknown-game' };
  const login = checkLogin(o.login);
  if (!login) return { ok: false, error: 'bad-request' };
  const uid = str(o.uid).trim();
  if (uid && !/^\d{6,12}$/.test(uid)) return { ok: false, error: 'bad-request' };
  const want = arr(o.want).filter((p): p is Part => typeof p === 'string' && (PARTS as string[]).includes(p));
  return { ok: true, request: { gameBiz, login, ...(uid ? { uid } : {}), want: want.length ? [...new Set(want)] : ['account'], claim: o.claim === true } };
}

/** Read everything the request wants. Parts fail on their own; a bad login fails the whole request. */
export async function readHoyolab(req: Request, deps: Deps): Promise<{ ok: true; answer: Answer } | { ok: false; error: HoyoError; accounts?: Account[] }> {
  const cfg = GAMES[req.gameBiz];
  const roles = await call(deps, req.login, withQuery(ROLES_URL, { game_biz: req.gameBiz }));
  if (!roles.ok) return { ok: false, error: roles.error };
  // GenshinAccount in genshin.py: game_biz, region, game_uid, nickname, level, region_name.
  const accounts = arr(roles.data.list)
    .map(obj)
    .filter((r) => !r.game_biz || str(r.game_biz) === req.gameBiz)
    .map((r) => ({ account: { uid: str(r.game_uid), nickname: str(r.nickname), level: num(r.level), server: str(r.region_name) || str(r.region) }, region: str(r.region) }))
    .filter((r) => r.account.uid && r.region);
  if (accounts.length === 0) return { ok: false, error: 'no-account' };
  const picked = req.uid ? accounts.find((a) => a.account.uid === req.uid) : accounts.length === 1 ? accounts[0] : undefined;
  if (!picked) return { ok: false, error: req.uid ? 'no-account' : 'pick-uid', accounts: accounts.map((a) => a.account) };
  const { region } = picked;

  const answer: Answer = { account: picked.account, readAt: new Date(deps.now()).toISOString(), problems: {} };
  const fail = (part: Part, code: HoyoError) => (answer.problems[part] = { code, text: ERROR_TEXT[code] });
  const record = (path: string, style: 'role' | 'uid', extra: Record<string, string> = {}) =>
    call(deps, req.login, withQuery(`${cfg.recordBase}/${path}`, style === 'role' ? { role_id: picked.account.uid, server: region, ...extra } : { uid: picked.account.uid, region, ...extra }));

  if (req.want.includes('stamina')) {
    const note = await record('note', 'role');
    if (note.ok) {
      const parsed = cfg.parseNote(note.data);
      answer.stamina = parsed.stamina;
      answer.dailies = parsed.dailies;
    } else fail('stamina', note.error);
  }

  if (req.want.includes('checkin')) {
    const q = { act_id: cfg.checkin.actId, lang: 'en-us' };
    const info = await call(deps, req.login, withQuery(`${cfg.checkin.url}/info`, q), { signgame: cfg.checkin.signgame });
    if (!info.ok) fail('checkin', info.error);
    else {
      let checkedInToday = info.data.is_sign === true;
      let days = num(info.data.total_sign_day);
      let claimedNow = false;
      if (req.claim && !checkedInToday) {
        const sign = await call(deps, req.login, withQuery(`${cfg.checkin.url}/sign`, q), { method: 'POST', signgame: cfg.checkin.signgame });
        const risky = sign.ok && obj(sign.data.gt_result).is_risk === true;
        if (sign.ok && !risky) {
          claimedNow = true;
          checkedInToday = true;
          days = days === null ? null : days + 1;
        } else fail('checkin', risky ? 'captcha' : sign.ok ? 'server' : sign.error);
      }
      answer.checkin = { checkedInToday, daysThisMonth: days, claimedNow };
    }
  }

  if (req.want.includes('roster')) {
    const chars = await record(cfg.charactersPath, 'role', cfg.charactersQuery);
    if (chars.ok) answer.roster = parseCharacters(chars.data);
    else fail('roster', chars.error);
  }

  if (req.want.includes('endgame')) {
    const list: EndgameRecord[] = [];
    let firstError: HoyoError | null = null;
    for (const mode of cfg.endgame) {
      for (const season of ['current', 'previous'] as const) {
        const got = await record(mode.path, mode.idStyle, { schedule_type: season === 'current' ? '1' : '2', ...(mode.extra ?? {}) });
        if (got.ok) list.push({ mode: mode.id, label: mode.label, season, ...mode.parse(got.data) });
        else firstError ??= got.error;
      }
    }
    answer.endgame = list;
    if (firstError && list.length === 0) fail('endgame', firstError);
  }

  return { ok: true, answer };
}
