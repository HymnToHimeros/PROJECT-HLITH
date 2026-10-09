/**
 * What HLITH does on its own for saved HoYoLAB accounts, when the player has
 * switched it on: the daily check-in, and redeeming gift codes. Pure logic shared
 * by the hoyolab-daily function (daily schedule), the hoyolab function ("Run now")
 * and the tests; the database and `fetch` are passed in.
 *
 * Sources (HoYoLAB/HoYoverse have no public API; this follows genshin.py, MIT):
 * - Check-in: genshin/client/components/daily.py ("info", "sign", "home"); "today"
 *   turns over at midnight UTC+8 (genshin.py utility.get_sign_day / China time).
 * - Code redemption: genshin/client/components/hoyolab.py redeem_code + routes.py CODE_URL:
 *   POST public-operation-{hkrpg,nap}.hoyoverse.com/common/apicdkey/api/webExchangeCdkeyRisk
 *   with cdkey, device_uuid, game_biz, lang, platform "4", region, t, uid. It needs the
 *   hoyoverse.com account login (cookie_token_v2 + account_mid_v2 + account_id_v2,
 *   managers.py requires_cookie_token), NOT the HoYoLAB ltoken_v2 login.
 * - Redemption error codes: genshin/errors.py (-1065, -2001, -2003, -2004, -2006, -2014,
 *   -2008, -2011, -2016, -2017, -2018, -2021, -1071).
 * - Public code list: hoyo-codes (https://github.com/seriaati/hoyo-codes), API
 *   https://hoyo-codes.seria.moe/codes?game=hkrpg|nap. It finds codes on public code
 *   pages and keeps only those it could redeem on its own test account.
 * NOT YET TESTED against a live account. Nothing here ever reports success that
 * HoYoLAB didn't answer with retcode 0.
 *
 * Safety: login values are used only inside these calls, never logged, never stored
 * anywhere but Vault, never returned.
 */
import { checkLogin, ERROR_TEXT, readHoyolab, type Deps, type GameBiz } from './hoyolab.ts';

// ── Check-in result ──────────────────────────────────────────────

export type CheckinStatus = 'claimed' | 'already' | 'error';
export interface CheckinRecord {
  status: CheckinStatus;
  message: string | null;
  reward: string | null;
}

/** Turn what readHoyolab answered into the row the results table keeps. Only a real claim counts as claimed. */
export function checkinRecord(result: Awaited<ReturnType<typeof readHoyolab>>): CheckinRecord {
  if (!result.ok) return { status: 'error', message: ERROR_TEXT[result.error], reward: null };
  const problem = result.answer.problems.checkin;
  const c = result.answer.checkin;
  if (c?.claimedNow) return { status: 'claimed', message: null, reward: c.reward ?? null };
  if (problem) return { status: 'error', message: problem.text, reward: null };
  if (c?.checkedInToday) return { status: 'already', message: 'Already checked in today (on hoyolab.com or by another app).', reward: null };
  return { status: 'error', message: 'HoYoLAB didn’t confirm the check-in.', reward: null };
}

/** HoYoLAB's check-in day starts at midnight UTC+8. Returns that day's start as an ISO time. */
export function checkinDayStart(nowMs: number): string {
  const shifted = new Date(nowMs + 8 * 3_600_000);
  const start = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 8 * 3_600_000;
  return new Date(start).toISOString();
}

// ── Code redemption ──────────────────────────────────────────────

export interface RedeemLogin {
  account_id_v2: string;
  account_mid_v2: string;
  cookie_token_v2: string;
}

/** account_id_v2 = digits · account_mid_v2 = ends in _hy · cookie_token_v2 = starts with v2_. */
export function checkRedeemLogin(raw: unknown): RedeemLogin | null {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
  const id = s(o.account_id_v2);
  const mid = s(o.account_mid_v2);
  const token = s(o.cookie_token_v2);
  if (!/^\d{4,15}$/.test(id) || !/^[0-9a-z]{4,30}_hy$/i.test(mid) || !/^v2_[\w\-.=+/]{10,600}$/.test(token)) return null;
  return { account_id_v2: id, account_mid_v2: mid, cookie_token_v2: token };
}

export const REDEEM: Record<GameBiz, { url: string; origin: string }> = {
  hkrpg_global: { url: 'https://public-operation-hkrpg.hoyoverse.com/common/apicdkey/api/webExchangeCdkeyRisk', origin: 'https://hsr.hoyoverse.com' },
  nap_global: { url: 'https://public-operation-nap.hoyoverse.com/common/apicdkey/api/webExchangeCdkeyRisk', origin: 'https://zenless.hoyoverse.com' },
};
export const REDEEM_HOSTS = new Set(['public-operation-hkrpg.hoyoverse.com', 'public-operation-nap.hoyoverse.com']);

export type RedeemStatus = 'redeemed' | 'already-used' | 'expired' | 'invalid' | 'region-locked' | 'level-too-low' | 'cooldown' | 'login' | 'captcha' | 'error';

export const REDEEM_TEXT: Record<RedeemStatus, string> = {
  redeemed: 'Redeemed. The reward arrives in your in-game mail: collect it in the game.',
  'already-used': 'Already redeemed on this account.',
  expired: 'This code has expired.',
  invalid: 'HoYoverse says this code isn’t valid (wrong, used up, or not active yet).',
  'region-locked': 'This code is for another server region.',
  'level-too-low': 'Your account level is too low for this code yet. HLITH tries again later.',
  cooldown: 'HoYoverse asked to wait between codes. HLITH tries again on the next run.',
  login: 'HoYoverse says the code login isn’t valid any more. Paste fresh values from the gift page.',
  captcha: 'HoYoverse wants a captcha first. Redeem this one on the gift page yourself.',
  error: 'HoYoverse returned an error. HLITH tries again on the next run (up to 3 times).',
};

/** Final = never tried again for this account. */
export const FINAL: ReadonlySet<RedeemStatus> = new Set(['redeemed', 'already-used', 'expired', 'invalid', 'region-locked']);

/** HoYoverse retcode → status (genshin.py errors.py). */
export function redeemStatus(retcode: number | null): RedeemStatus {
  if (retcode === 0) return 'redeemed';
  if (retcode === null) return 'error';
  if ([-2017, -2018].includes(retcode)) return 'already-used';
  if (retcode === -2001) return 'expired';
  if ([-1065, -2003, -2004, -2006, -2014].includes(retcode)) return 'invalid';
  if (retcode === -2008) return 'region-locked';
  if ([-2011, -2021].includes(retcode)) return 'level-too-low';
  if (retcode === -2016) return 'cooldown';
  if ([-1071, -100, 10001].includes(retcode)) return 'login';
  if ([10035, 5003, 10041, 1034].includes(retcode)) return 'captcha';
  return 'error';
}

const redeemAllowed = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && REDEEM_HOSTS.has(u.hostname) && !u.username && !u.password && u.port === '';
  } catch {
    return false;
  }
};

/** Redeem one code for one game account. Success only on retcode 0. */
export async function redeemCode(
  deps: Pick<Deps, 'fetch' | 'now'> & { uuid: () => string },
  login: RedeemLogin,
  target: { gameBiz: GameBiz; uid: string; region: string; code: string },
): Promise<{ status: RedeemStatus; message: string }> {
  const cfg = REDEEM[target.gameBiz];
  if (!redeemAllowed(cfg.url)) return { status: 'error', message: ERROR_TEXT['blocked-host'] };
  const body = {
    cdkey: target.code,
    device_uuid: deps.uuid(),
    game_biz: target.gameBiz,
    lang: 'en',
    platform: '4',
    region: target.region,
    t: Math.floor(deps.now() / 1000),
    uid: Number(target.uid),
  };
  try {
    const res = await deps.fetch(cfg.url, {
      method: 'POST',
      headers: {
        Cookie: `account_id_v2=${login.account_id_v2}; account_mid_v2=${login.account_mid_v2}; cookie_token_v2=${login.cookie_token_v2}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: cfg.origin,
        Referer: `${cfg.origin}/`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { status: res.status === 429 ? 'cooldown' : 'error', message: REDEEM_TEXT[res.status === 429 ? 'cooldown' : 'error'] };
    const answer = (await res.json()) as { retcode?: unknown };
    const retcode = typeof answer.retcode === 'number' ? answer.retcode : null;
    const status = redeemStatus(retcode);
    return { status, message: REDEEM_TEXT[status] };
  } catch {
    return { status: 'error', message: REDEEM_TEXT.error };
  }
}

/** Gift codes are letters and digits; pasted text is split on anything else. */
export function readCodes(text: string): string[] {
  return [...new Set(text.toUpperCase().split(/[^A-Z0-9]+/).filter((c) => /^[A-Z0-9]{4,30}$/.test(c)))];
}

// ── Public code list ─────────────────────────────────────────────

export const CODE_SOURCE = {
  name: 'hoyo-codes (seriaati)',
  home: 'https://github.com/seriaati/hoyo-codes',
  url: (gameBiz: GameBiz) => `https://hoyo-codes.seria.moe/codes?game=${gameBiz === 'hkrpg_global' ? 'hkrpg' : 'nap'}`,
};

/** { codes: [{ code, status: "OK", rewards }] } → the codes it marks OK. Anything else is ignored. */
export function parseCodeList(body: unknown): { code: string; rewards: string | null }[] {
  const list = body && typeof body === 'object' ? (body as { codes?: unknown }).codes : null;
  if (!Array.isArray(list)) return [];
  const out = new Map<string, string | null>();
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const code = typeof o.code === 'string' ? o.code.trim().toUpperCase() : '';
    if (o.status !== 'OK' || !/^[A-Z0-9]{4,30}$/.test(code)) continue;
    out.set(code, typeof o.rewards === 'string' && o.rewards.trim() ? o.rewards.trim().slice(0, 300) : null);
  }
  return [...out].map(([code, rewards]) => ({ code, rewards }));
}

// ── Which codes to try ───────────────────────────────────────────

export interface Tried {
  link_id: string;
  game_uid: string;
  code: string;
  status: RedeemStatus;
}

/** Codes not yet finished for this game account: no final answer yet, and fewer than 3 errors or captchas. */
export function codesToTry(candidates: string[], tried: Tried[], linkId: string, uid: string): string[] {
  const mine = tried.filter((t) => t.link_id === linkId && t.game_uid === uid);
  return [...new Set(candidates)].filter((code) => {
    const rows = mine.filter((t) => t.code === code);
    if (rows.some((t) => FINAL.has(t.status))) return false;
    return rows.filter((t) => t.status === 'error' || t.status === 'captcha').length < 3;
  });
}

// ── One run ──────────────────────────────────────────────────────

export interface LinkGame {
  gameBiz: GameBiz;
  uid: string;
  region: string;
}
export interface LinkRow {
  id: string;
  user_id: string;
  games: LinkGame[];
  auto_checkin: boolean;
  auto_redeem: boolean;
}

/** Keep only well-formed game entries from the stored games list. */
export function linkGames(raw: unknown): LinkGame[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((g): LinkGame[] => {
    if (!g || typeof g !== 'object') return [];
    const o = g as Record<string, unknown>;
    const gameBiz = o.gameBiz === 'hkrpg_global' || o.gameBiz === 'nap_global' ? o.gameBiz : null;
    const uid = typeof o.uid === 'string' && /^\d{6,12}$/.test(o.uid) ? o.uid : null;
    const region = typeof o.region === 'string' && /^[a-z0-9_]{2,40}$/.test(o.region) ? o.region : null;
    return gameBiz && uid && region ? [{ gameBiz, uid, region }] : [];
  });
}

export interface Store {
  /** The saved login (and code login) as stored; null when forgotten or missing. */
  secret(linkId: string): Promise<{ login: string | null; redeem: string | null } | null>;
  /** link:gameBiz pairs that already have a claimed/already check-in since `since`. */
  checkedIn(linkIds: string[], since: string): Promise<Set<string>>;
  tried(linkIds: string[]): Promise<Tried[]>;
  /** Public list plus each user's pasted codes, per game. */
  codesFor(userId: string, gameBiz: GameBiz): Promise<string[]>;
  recordCheckin(row: { user_id: string; link_id: string; game_biz: GameBiz; started_by: 'auto' | 'manual'; status: CheckinStatus; message: string | null; reward: string | null }): Promise<void>;
  recordRedemption(row: { user_id: string; link_id: string; game_biz: GameBiz; game_uid: string; code: string; started_by: 'auto' | 'manual'; status: RedeemStatus; message: string }): Promise<void>;
}

export interface RunDeps extends Deps {
  uuid: () => string;
  sleep: (ms: number) => Promise<void>;
}

export interface RunOptions {
  startedBy: 'auto' | 'manual';
  /** Stop starting new work after this time (epoch ms): server functions have a time limit. */
  deadline: number;
  maxRedemptions: number;
  /** Which jobs each link gets. The schedule passes its switches; "Run now" can pass both. */
  jobs: (link: LinkRow) => { checkin: boolean; redeem: boolean };
}

export interface RunSummary {
  checkins: number;
  redemptions: number;
  /** True when the time or code limit stopped the run; the rest waits for the next run. */
  stoppedEarly: boolean;
}

/** HoYoverse asks for about 5 seconds between codes (genshin.py RedemptionCooldown). */
export const REDEEM_GAP_MS = 6000;

const parseJson = (s: string | null): unknown => {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

export async function runLinks(links: LinkRow[], store: Store, deps: RunDeps, opts: RunOptions): Promise<RunSummary> {
  const summary: RunSummary = { checkins: 0, redemptions: 0, stoppedEarly: false };
  const done = await store.checkedIn(
    links.map((l) => l.id),
    checkinDayStart(deps.now()),
  );
  const tried = await store.tried(links.map((l) => l.id));
  const secrets = new Map<string, { login: string | null; redeem: string | null } | null>();
  const secretOf = async (id: string) => {
    if (!secrets.has(id)) secrets.set(id, await store.secret(id));
    return secrets.get(id) ?? null;
  };

  // 1. Check-ins first: quick, and the main reason people switch this on.
  for (const link of links) {
    if (!opts.jobs(link).checkin) continue;
    const perGame = new Map<GameBiz, LinkGame>();
    for (const g of link.games) if (!perGame.has(g.gameBiz)) perGame.set(g.gameBiz, g);
    for (const [gameBiz, g] of perGame) {
      if (done.has(`${link.id}:${gameBiz}`)) continue;
      if (deps.now() > opts.deadline) return { ...summary, stoppedEarly: true };
      const secret = await secretOf(link.id);
      const login = checkLogin(parseJson(secret?.login ?? null));
      const record = login
        ? checkinRecord(await readHoyolab({ gameBiz, login, uid: g.uid, want: ['checkin'], claim: true }, deps))
        : { status: 'error' as const, message: 'The saved login can’t be read. Paste it again.', reward: null };
      await store.recordCheckin({ user_id: link.user_id, link_id: link.id, game_biz: gameBiz, started_by: opts.startedBy, ...record });
      summary.checkins++;
    }
  }

  // 2. Codes, one at a time with a pause between them.
  let first = true;
  for (const link of links) {
    if (!opts.jobs(link).redeem) continue;
    const secret = await secretOf(link.id);
    const login = checkRedeemLogin(parseJson(secret?.redeem ?? null));
    if (!login) continue;
    let stop = false;
    for (const g of link.games) {
      if (stop) break;
      const todo = codesToTry(await store.codesFor(link.user_id, g.gameBiz), tried, link.id, g.uid);
      for (const code of todo) {
        if (summary.redemptions >= opts.maxRedemptions || deps.now() + (first ? 0 : REDEEM_GAP_MS) > opts.deadline) return { ...summary, stoppedEarly: true };
        if (!first) await deps.sleep(REDEEM_GAP_MS);
        first = false;
        const r = await redeemCode(deps, login, { gameBiz: g.gameBiz, uid: g.uid, region: g.region, code });
        await store.recordRedemption({ user_id: link.user_id, link_id: link.id, game_biz: g.gameBiz, game_uid: g.uid, code, started_by: opts.startedBy, status: r.status, message: r.message });
        tried.push({ link_id: link.id, game_uid: g.uid, code, status: r.status });
        summary.redemptions++;
        // A bad code login or a captcha stops this account until the player acts; a cooldown waits for the next run.
        if (r.status === 'login' || r.status === 'captcha' || r.status === 'cooldown') {
          stop = true;
          break;
        }
      }
    }
  }
  return summary;
}

