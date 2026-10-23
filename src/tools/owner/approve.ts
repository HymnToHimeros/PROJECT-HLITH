/**
 * Approving a finding: turning what a job found into an item in a built-in list.
 * planApproval is pure: it reads the finding's payload and says which list the item
 * goes into, the item itself, and which required fields are missing. The owner
 * console writes complete items straight to catalog_items and opens the Lists form,
 * pre-filled, for the rest.
 *
 * Required fields per kind:
 *   event: title, kind, start, end · banner: title, type, start, end ·
 *   character: name, rarity, element, role · leak: one of those, marked leak: { source }.
 */
import type { GameContract } from '../../core/contract';
import type { ListKind } from '../../core/data/catalog';

export interface FindingLike {
  id: string;
  game_id: string | null;
  kind: string;
  title: string;
  payload: Record<string, unknown>;
  source_name: string | null;
}

export interface Draft {
  gameId: string;
  list: ListKind;
  item: Record<string, unknown>;
  /** Field names still needed before the item can go into the list. */
  missing: string[];
  /** The finding it came from: its title, and its id (saved as the row's source, so undoing the approval can find the row). */
  findingTitle?: string;
  findingId?: string;
}

/** The catalog row's source for an item an approved finding added. */
export const findingSource = (findingId: string) => `finding:${findingId}`;

export type ApprovalPlan = { ok: true; draft: Draft } | { ok: false; reason: string };

export const EVENT_KINDS = ['event', 'login', 'web', 'endgame', 'bonus'] as const;
const LEAK_LISTS = ['characters', 'banners', 'events'] as const;

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : undefined);
const iso = (v: unknown): string | undefined => {
  const s = str(v);
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
};
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
/** A value matched to one of the game's options by id or label; without the game, taken as given. */
const pick = (v: unknown, options: { id: string; label: string }[] | undefined): string | undefined => {
  const s = str(v);
  if (!s) return undefined;
  if (!options) return s;
  return options.find((o) => same(o.id, s) || same(o.label, s))?.id;
};

/** A stable id made from words: "Version 3.8 Login Event" → "version-3-8-login-event". */
export function slugId(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ð/g, 'd')
    .replace(/þ/g, 'th')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function rarityOf(v: unknown, game: GameContract | undefined): 'top' | 'mid' | 'low' | undefined {
  const s = str(v);
  if (!s) return undefined;
  if (s === 'top' || s === 'mid' || s === 'low') return s;
  if (game) {
    if (same(s, game.terms.rarity.top)) return 'top';
    if (same(s, game.terms.rarity.mid)) return 'mid';
    if (game.terms.rarity.low && same(s, game.terms.rarity.low)) return 'low';
  }
  if (/^5|^s$/i.test(s)) return 'top';
  if (/^4|^a$/i.test(s)) return 'mid';
  if (/^3|^b$/i.test(s)) return 'low';
  return undefined;
}

function listOf(f: FindingLike): ListKind | null {
  if (f.kind === 'event') return 'events';
  if (f.kind === 'banner') return 'banners';
  if (f.kind === 'character') return 'characters';
  if (f.kind !== 'leak') return null;
  const asked = str(f.payload.list);
  if (asked && (LEAK_LISTS as readonly string[]).includes(asked)) return asked as ListKind;
  const p = f.payload;
  if (str(p.name) || str(p.character) || str(p.rarity)) return 'characters';
  if (str(p.type) || Array.isArray(p.featured)) return 'banners';
  return 'events';
}

/** What approving this finding would add, and what is still missing. */
export function planApproval(f: FindingLike, game: GameContract | undefined): ApprovalPlan {
  if (!f.game_id) return { ok: false, reason: 'It names no game, so it can’t go into a game’s list.' };
  const list = listOf(f);
  if (!list) return { ok: false, reason: 'Info findings don’t go into a list.' };
  const p = f.payload;
  const item: Record<string, unknown> = {};
  let required: string[];
  if (list === 'events') {
    const kind = str(p.kind);
    Object.assign(item, {
      title: str(p.title),
      kind: kind && (EVENT_KINDS as readonly string[]).includes(kind) ? kind : undefined,
      start: iso(p.start),
      end: iso(p.end),
      reward: num(p.reward),
      currency: pick(p.currency, game?.currencies.map((c) => ({ id: c.id, label: c.name }))) ?? game?.currencies.find((c) => c.perPull)?.id ?? game?.currencies[0]?.id ?? '',
    });
    const days = num(p.loginDays);
    if (days) item.loginDays = days;
    required = ['title', 'kind', 'start', 'end'];
  } else if (list === 'banners') {
    Object.assign(item, {
      title: str(p.title),
      type: pick(p.type, game?.bannerTypes),
      start: iso(p.start),
      end: iso(p.end),
      featured: Array.isArray(p.featured) ? p.featured.map(str).filter((x): x is string => Boolean(x)) : [],
    });
    required = ['title', 'type', 'start', 'end'];
  } else {
    Object.assign(item, {
      name: str(p.name) ?? str(p.character),
      rarity: rarityOf(p.rarity, game),
      element: pick(p.element, game?.elements),
      role: pick(p.role ?? p.path ?? p.specialty, game?.roles),
    });
    const released = iso(p.releasedAt);
    if (released) item.releasedAt = released;
    required = f.kind === 'leak' ? ['name'] : ['name', 'rarity', 'element', 'role'];
  }
  if (f.kind === 'leak') item.leak = { source: f.source_name ?? 'unknown source' };
  else if (f.source_name && list === 'characters') item.source = f.source_name;
  const known: Record<string, unknown> = Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined));
  const words = str(known.title) ?? str(known.name);
  const id = str(p.id) ?? (words ? slugId(list === 'events' && known.start ? `${words} ${String(known.start).slice(0, 10)}` : words) : undefined);
  if (id) known.id = id;
  const missing = required.filter((k) => known[k] === undefined);
  if (!id) missing.unshift('id');
  return { ok: true, draft: { gameId: f.game_id, list, item: known, missing, findingTitle: f.title, findingId: f.id } };
}

/**
 * An info finding about a new event ("ZZZ: new event Data Bounty: Combat Simulation (2026-10-13 → 2026-10-18)",
 * or a payload with title/start/end): the event it names, or null. Approving it checks the game's
 * Events list first, then opens the Lists form pre-filled when it isn't there yet.
 */
export function eventFromInfo(f: FindingLike): { title: string; start?: string; end?: string } | null {
  if (f.kind !== 'info' || f.payload.leak === true) return null;
  const p = f.payload;
  const title = str(p.title) ?? str(p.event);
  const dated = (t: string, a: string | undefined, b: string | undefined) => ({ title: t, ...(a ? { start: a } : {}), ...(b ? { end: b } : {}) });
  if (title && (str(p.start) || str(p.end))) return dated(title, iso(p.start), iso(p.end));
  const m = /new event\s*:?\s*(.+?)\s*\((\d{4}-\d{2}-\d{2})\s*(?:→|->|–|-|to)\s*(\d{4}-\d{2}-\d{2})\)\s*$/i.exec(f.title);
  if (!m?.[1]) return null;
  return dated(m[1].trim(), iso(m[2]), iso(m[3]));
}

