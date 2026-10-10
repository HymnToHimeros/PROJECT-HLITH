/**
 * Part B of docs/logic/hsr-theory.md: checking a team of four. Fixed rules, no
 * guessing: the same team always gets the same answer, and every point comes
 * with the entry (and its quote) that earned it. HSR has no team order.
 */
import { BUILD_STAT_WORD, BUILT_POINTS, FIT_WORD, type BuildFit, type BuildStat } from '../../../core/rules/buildFit';
import { ownDamagePart, partOf, POINTS, sizeOf, typicalSize, value, type Part } from '../../../core/rules/kitValue';
import { GENERAL_STATS, SPECIFIC_STATS, SUPPORT_STATS, SUSTAIN_STATS, type CharacterSheet, type Condition, type DamageKind, type Element, type Entry, type GameEventKind, type Path, type Stat } from './types';

export interface Profile {
  characterId: string;
  path: Path;
  element: Element;
}

/** What the check knows about the game: profiles for everyone, sheets for read characters, kit unlock levels. */
export interface Library {
  profiles: Map<string, Profile>;
  sheets: Map<string, CharacterSheet>;
  /** Kit piece → unlock level, per character (`potential` 1 = the Enhanced kit). */
  unlocks: Map<string, Map<string, { dupes?: number; potential?: number; replacedAt?: number; weapon?: string }>>;
  /** Kit piece → its label ("Trace: Inert Respiration"), per character. */
  pieceLabels: Map<string, Map<string, string>>;
  names: Map<string, string>;
  /** Leaked characters (beta kit text) and where the leak came from (T39). */
  leaks?: Map<string, string>;
  /**
   * Who teams are built around: characters the game's own recommended teams centre on (a team's first member, or
   * the page's character when the first member can't carry). Empty = not known, every carry counts.
   */
  centres: Set<string>;
  /** Who the game's own teams put together (every pick and backup of a team), per character. */
  pairedWith: Map<string, Set<string>>;
  /**
   * Per carry with an own game team: everyone its own teams list in any slot. They are the only teammates the check
   * tries for that carry (decision 30); a carry without one falls back to the pairing rule.
   */
  allowed: Map<string, Set<string>>;
  /** Each carry's own game teams (preset id and slot lists), for the owner's edited lists (decision 31). */
  ownTeams: Map<string, { id: string; slots: string[][] }[]>;
  /**
   * Every Light Cone the check can read (T18 step 4): its path, its entries (piece `weapon:<id>`) and its label.
   * A signature's entries come from its character's sheet; `madeFor` marks it (that character reads it as a kit piece).
   */
  weapons: Map<string, { name: string; role: string; madeFor?: string; label: string; entries: Entry[] }>;
}

/** The piece a weapon's entries carry: `weapon:<id>`. */
export const weaponPiece = (id: string) => `weapon:${id}`;

/** A kit piece's label, or an equipped Light Cone's ("Light Cone: Night on the Milky Way"). */
export const labelOf = (lib: Library, who: string, piece: string) => (piece.startsWith('weapon:') ? lib.weapons.get(piece.slice(7))?.label : lib.pieceLabels.get(who)?.get(piece)) ?? piece;

/**
 * Everything a member brings: their sheet, plus the Light Cone in their saved build when its path is theirs (an HSR
 * Light Cone's effect only works on its path) and it isn't their own signature (read as a kit piece already).
 */
export function entriesOf(who: string, lib: Library, account: Account): Entry[] {
  const own = lib.sheets.get(who)?.entries ?? [];
  const id = account.weapon?.(who)?.id;
  const w = id ? lib.weapons.get(id) : undefined;
  if (!w || w.madeFor === who || w.role !== lib.profiles.get(who)?.path) return own;
  return [...own, ...w.entries];
}

/** Your account: Eidolon per character (not owned = 0), Enhanced when known. */
export interface Account {
  eidolon: (id: string) => number;
  /** 1 = has the Enhanced kit, 0 = not; undefined = not saved. */
  enhanced: (id: string) => number | undefined;
  /** The weapon in the saved build (signature weapons); undefined = none saved. */
  weapon?: (id: string) => { id?: string; name: string } | undefined;
  /** How the saved build fits one stat (T18); undefined = no build saved. */
  buildFit?: (id: string, stat: BuildStat) => BuildFit | undefined;
  /** Assume every member is built for what the team wants: the best team found (decision 26). */
  ideal?: boolean;
  /** The owner's own slot lists for a game team (preset id), when edited (decision 31). */
  teamList?: (presetId: string) => string[][] | undefined;
}

export type Status = 'on' | 'off' | 'locked' | 'unknown' | 'replaced';

/** One line of the explanation. `points` is what it adds to the count (0 for tie-break and not counted). */
export interface Line {
  kind: 'switched-on' | 'buff' | 'chain' | 'off' | 'duplicate' | 'weak-fit' | 'support' | 'not-counted' | 'locked' | 'unknown' | 'replaced' | 'build';
  who: string;
  /** For a build line: the stat the team wants on them and how their saved build fits. */
  build?: { stat: BuildStat; fit: BuildFit['fit']; have: string; max: number };
  /** Counted for a second damage dealer of the team (decision 33), not the main one. */
  forDd?: string;
  entry?: string;
  tag: string;
  why: string;
  piece?: string;
  quote?: string;
  points: number;
  /** For a switched-on ability: the teammates who each meet its condition. */
  helpers?: string[];
  /** T30: what the line adds, sized from the kit text, by zone. */
  parts?: Part[];
  /** T30: its share of the team's kit value (see `value` on the result). */
  value?: number;
}

export interface TeamResult {
  /** The damage dealer first, then the others as given. */
  members: string[];
  dd: string;
  count: number;
  /** T30: the kit value, POINTS × ln(how much the kits multiply the damage dealer's damage). Ranks teams and gives the %. */
  value: number;
  support: number;
  chains: number;
  /** Someone heals or shields the team (or is Preservation / Abundance). */
  /** Info only (decision 32): someone heals or shields. Never scored, ranked or required. */
  sustain: boolean;
  /** Other damage dealers the carry's own game team puts beside them, whose damage counts too (decision 33). */
  coDds?: string[];
  lines: Line[];
}

export type CheckOutcome = { rated: true; best: TeamResult; other?: TeamResult } | { rated: false; why: string; unread?: string[] };

/** Damage dealers first by path when two can carry: the ones built for it. */
const PATH_ORDER: Path[] = ['destruction', 'hunt', 'erudition', 'nihility', 'remembrance', 'elation', 'harmony', 'abundance', 'preservation'];

/**
 * Part B step 1: who carries this team. Characters the game builds teams around come first; a character who can
 * carry but whom the game only ever pairs with another carry (March 7th (Hunt) with Feixiao) is tried only when no
 * centre is in the team. Then the main-damage paths first.
 */
export function damageDealers(members: string[], lib: Library): string[] {
  const rank = (id: string) => PATH_ORDER.indexOf(lib.profiles.get(id)?.path ?? 'preservation');
  const carries = members.filter((id) => canCarry(id, lib)).sort((a, b) => rank(a) - rank(b));
  const centres = carries.filter((id) => isCentre(id, lib));
  return centres.length ? centres : carries;
}

export const canCarry = (id: string, lib: Library) => Boolean(lib.sheets.get(id)?.damage);
/** A character teams are built around (the game's own teams say so); every carry when that isn't known. */
export const isCentre = (id: string, lib: Library) => canCarry(id, lib) && (lib.centres.size === 0 || lib.centres.has(id));
/**
 * Can this character be a partner on a team built around `dd`? Anyone who isn't a centre themself; another
 * centre only when the game's own teams put the two together (Saber with Gilgamesh, Mortenax Blade with Rin).
 */
export const canPartner = (id: string, dd: string, lib: Library, account?: Account) => {
  // A carry with its own game team only gets teammates that team lists (no mix-matching, owner's report 2026-10-10);
  // where the owner edited a team's slot lists, theirs count instead (decision 31).
  const own = lib.ownTeams.get(dd);
  if (own?.length) return own.some((t) => (account?.teamList?.(t.id) ?? t.slots).some((slot) => slot.includes(id)));
  return !isCentre(id, lib) || lib.centres.size === 0 || !!lib.pairedWith.get(dd)?.has(id);
};

type CondResult = 'met' | 'not-met' | 'unknown';

const matches = (p: Profile | undefined, paths?: Path[], elements?: Element[]) => !!p && (!!paths?.includes(p.path) || !!elements?.includes(p.element));

function evalCondition(c: Condition | undefined, self: string, team: string[], lib: Library): CondResult {
  if (!c) return 'met';
  if ('unknown' in c) return 'unknown';
  if ('teammate' in c) {
    const q = c.teammate;
    const does = (id: string) =>
      (lib.sheets.get(id)?.entries ?? []).some(
        (e) => !e.piece.startsWith('eidolon-') && e.to !== 'self' && e.to !== 'enemy' && (!q.gives || e.gives.some((g) => q.gives?.includes(g.stat))) && (!q.to || q.to.includes(e.to)),
      );
    return team.some((id) => id !== self && does(id)) ? 'met' : 'not-met';
  }
  if ('all' in c) {
    const rs = c.all.map((x) => evalCondition(x, self, team, lib));
    return rs.includes('not-met') ? 'not-met' : rs.includes('unknown') ? 'unknown' : 'met';
  }
  const q = c.count;
  const n = team.filter((id) => !(q.others && id === self) && matches(lib.profiles.get(id), q.paths, q.elements)).length;
  return n >= q.atLeast && (q.atMost === undefined || n <= q.atMost) ? 'met' : 'not-met';
}

/** Part B step 3: locked, replaced, on, off or unknown, with the reason in words. */
export function statusOf(e: Entry, who: string, team: string[], lib: Library, account: Account): { status: Status; why: string } {
  const unlock = lib.unlocks.get(who)?.get(e.piece);
  if (unlock?.weapon) {
    const w = account.weapon?.(who);
    if (!w) return { status: 'locked', why: 'locked: needs their signature weapon equipped (none saved in their build)' };
    if (w.id !== unlock.weapon) return { status: 'locked', why: `locked: needs their signature weapon; the saved build has ${w.name}` };
  }
  if (unlock?.dupes && account.eidolon(who) < unlock.dupes) return { status: 'locked', why: `locked: needs E${unlock.dupes}, you have E${account.eidolon(who)}` };
  if (unlock?.potential) {
    const p = account.enhanced(who);
    if (p === undefined) return { status: 'locked', why: 'locked: needs the Enhanced kit; HLITH does not save it yet' };
    if (p < unlock.potential) return { status: 'locked', why: 'locked: needs the Enhanced kit' };
  }
  if (unlock?.replacedAt) {
    const p = account.enhanced(who);
    if (p !== undefined && p >= unlock.replacedAt) return { status: 'replaced', why: 'replaced: the Enhanced version is on' };
  }
  if (e.unverified) return { status: 'unknown', why: `unclear text: ${e.unverified}` };
  const r = evalCondition(e.on, who, team, lib);
  if (r === 'unknown') return { status: 'unknown', why: 'its condition cannot be checked from profiles' };
  if (r === 'not-met') return { status: 'off', why: `off: ${conditionWords(e.on)} is not met in this team` };
  return { status: 'on', why: e.on ? `on: ${conditionWords(e.on)}` : 'always on' };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const list = (xs: string[], or = 'or') => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} ${or} ${xs[xs.length - 1] ?? ''}`);

const hasAtMost = (c: Condition | undefined): boolean => !!c && ('all' in c ? c.all.some(hasAtMost) : 'count' in c && c.count.atMost !== undefined);

export function conditionWords(c: Condition | undefined): string {
  if (!c) return 'always';
  if ('unknown' in c) return c.unknown;
  if ('teammate' in c) return c.teammate.words;
  if ('all' in c) return c.all.map(conditionWords).join(', and ');
  const q = c.count;
  const what = list([...(q.paths ?? []).map(cap), ...(q.elements ?? []).map(cap)]);
  if (q.atMost === 0) return `no ${what} character${q.others ? ' besides them' : ''} in the team`;
  const most = q.atMost === undefined ? '' : ` and at most ${q.atMost}`;
  return `${q.atLeast}${most} ${what} character${q.atLeast === 1 && !most ? '' : 's'}${q.others ? ' besides them' : ''} in the team`;
}

export const KIND_WORD: Record<DamageKind, string> = {
  basic: 'Basic ATK DMG',
  skill: 'Skill DMG',
  ultimate: 'Ultimate DMG',
  'follow-up': 'Follow-Up ATK DMG',
  dot: 'DoT',
  break: 'Break DMG',
  'super-break': 'Super Break DMG',
  additional: 'Additional DMG',
  memosprite: 'memosprite DMG',
  elation: 'Elation DMG',
  true: 'True DMG',
};

const STAT_WORD: Partial<Record<Stat, string>> = { 'skill-points': 'Skill Points', 'energy-regen': 'Energy Regeneration', 'effect-hit-rate': 'Effect Hit Rate', 'break-effect': 'Break Effect', 'break-efficiency': 'Weakness Break Efficiency', hp: 'HP', def: 'DEF', elation: 'Elation' };
const statWord = (s: Stat) => STAT_WORD[s] ?? s;

type Reach = { kind: 'buff'; why: string; used: string[] } | { kind: 'support' | 'no'; why: string };

/** Part B step 4: does this buff reach the damage dealer, and does their damage use it? */
function reach(e: Entry, giver: string, dd: string, lib: Library, addedKinds: DamageKind[] = []): Reach {
  const name = (id: string) => lib.names.get(id) ?? id;
  const ddp = lib.profiles.get(dd);
  const base = lib.sheets.get(dd)?.damage;
  // Kinds the team makes their damage count as (an entry of theirs with `addsKinds` that is on).
  const notes = base && addedKinds.length ? { ...base, kinds: [...new Set([...base.kinds, ...addedKinds])] } : base;
  const stats = e.gives.map((g) => g.stat);
  const support = stats.some((s) => SUPPORT_STATS.includes(s));
  if (e.to === 'self') return { kind: 'no', why: `helps ${name(giver)} only` };
  const l = e.limits;
  if (ddp && l) {
    if (l.elements && !l.elements.includes(ddp.element)) return { kind: 'no', why: `only for ${list(l.elements.map(cap))}; ${name(dd)} is ${cap(ddp.element)}` };
    if (l.paths && !l.paths.includes(ddp.path)) return { kind: 'no', why: `only for ${list(l.paths.map(cap))}; ${name(dd)} is ${cap(ddp.path)}` };
    if (l.kinds && !l.kinds.some((k) => notes?.kinds.includes(k))) return { kind: support ? 'support' : 'no', why: `only for ${list(l.kinds.map((k) => KIND_WORD[k]))}, which ${name(dd)} doesn't deal` };
  }
  // A DMG bonus limited to Break / Super Break DMG is that damage's own multiplier: it counts for a Break carry who
  // ignores general DMG% (Trailblazer · Harmony's "Super Break DMG … increases by 20%–60%" for Firefly).
  const breakOnly = !!l?.kinds?.length && l.kinds.every((k) => k === 'break' || k === 'super-break');
  const used = stats.filter(
    (s) => !(s === 'atk' && !usesAtk(dd, lib)) && ((GENERAL_STATS.includes(s) && (!notes?.ignores.includes(s) || (s === 'dmg' && breakOnly))) || (SPECIFIC_STATS.includes(s) && !!notes?.uses.includes(s))),
  );
  // A buff for one kind of damage is its own thing (it's what makes a team fit): "crit-dmg" and "crit-dmg for Follow-Up ATK" are two stats.
  const kindKey = l?.kinds ? `:${[...l.kinds].sort().join('+')}` : '';
  if (used.length) return { kind: 'buff', why: `reaches ${name(dd)}${l?.kinds ? ` (deals ${list(l.kinds.filter((k) => notes?.kinds.includes(k)).map((k) => KIND_WORD[k]), 'and')})` : ''}`, used: used.map((s) => `${s}${kindKey}`) };
  if (support || stats.some((s) => s === 'skill-points' || s === 'energy-regen')) return { kind: 'support', why: 'team support' };
  return { kind: 'no', why: `${name(dd)}'s damage doesn't use ${list([...new Set(stats)].map(statWord))}` };
}

export const EVENT_WORD: Record<GameEventKind, string> = {
  'follow-up': 'Follow-Up ATK',
  'summon-attack': 'summon or memosprite attack',
  debuff: 'debuff on enemies',
  dot: 'DoT on enemies',
  'hp-loss': 'HP loss for allies',
  'elation-skill': 'Elation Skill',
  'extra-turn': 'extra turn',
  'targets-ally': 'ability aimed at them',
};

/** T30: an Ultimate comes about every third turn (an action advance from it counts a third). */
export const ULTIMATE_EVERY = 3;

/**
 * T30 (owner via MANAGER): a buff counts only if it raises what the damage dealer's own damage scales on. ATK is
 * general, but a carry whose damage lines name another stat and never ATK ("50% of Castorice's Max HP") doesn't use
 * it. When the damage lines name no stat at all, ATK keeps counting (never guess it away).
 */
const atkCache = new WeakMap<Library, Map<string, boolean>>();
export function usesAtk(dd: string, lib: Library): boolean {
  let m = atkCache.get(lib);
  if (!m) atkCache.set(lib, (m = new Map()));
  const hit = m.get(dd);
  if (hit !== undefined) return hit;
  const text = (lib.sheets.get(dd)?.damage?.quotes ?? []).map((q) => q.quote).join(' ');
  // Only their own stat ("of Castorice's Max HP", "of this unit's ATK"), never an enemy's ("of the target's Max HP").
  const named = [...text.matchAll(/% of (?:the |this |[A-Z][^.%]*?'s )?(?:unit's |memosprite's )?(ATK|Max HP|DEF)\b/g)]
    .filter((x) => !/target|enem/i.test(x[0]))
    .map((x) => x[1]);
  const uses = !named.length || named.includes('ATK');
  m.set(dd, uses);
  return uses;
}

/**
 * T30: a Super Break hit's size in the kit text. "60% Super Break DMG" → 0.6; "1 instance of Super Break DMG" or
 * "1 Super Break hit" with no % is the game's plain Super Break, 100% → 1. Anything else isn't sized here.
 */
export function superBreakSize(amount: string): number | undefined {
  if (!/Super Break/i.test(amount)) return undefined;
  const pct = /(\d+(?:\.\d+)?)%\s*Super Break/i.exec(amount);
  if (pct?.[1]) return Number(pct[1]) / 100;
  return /^1 (?:instance of )?Super Break (?:hit|DMG)/i.test(amount.trim()) ? 1 : undefined;
}

/** The damage dealer's own Super Break hit, from their damage notes ("35%/50% Super Break DMG" → 0.5); undefined = none. */
function superBreakOf(dd: string, lib: Library): number | undefined {
  const text = (lib.sheets.get(dd)?.damage?.quotes ?? []).map((q) => q.quote).join(' ');
  const m = /((?:\d+(?:\.\d+)?%\/)*\d+(?:\.\d+)?)%\s*Super Break DMG/.exec(text);
  if (!m?.[1]) return undefined;
  const top = Math.max(...m[1].split('/').map((x) => Number(x.replace('%', ''))));
  return top > 0 ? top / 100 : undefined;
}

/** Does this part of the entry grow with the giver's build (`scales.gives`; all of it when absent)? */
const scalesWith = (e: Entry, stat: string) => !!e.scales && (!e.scales.gives || e.scales.gives.includes(stat as Stat));

/** Does the damage dealer's damage use this stat (general and not ignored, or specific and listed)? */
function usedBy(g: { stat: Stat }, dd: string, lib: Library): boolean {
  const notes = lib.sheets.get(dd)?.damage;
  if (g.stat === 'atk' && !usesAtk(dd, lib)) return false;
  return (GENERAL_STATS.includes(g.stat) && !notes?.ignores.includes(g.stat)) || (SPECIFIC_STATS.includes(g.stat) && !!notes?.uses.includes(g.stat));
}

/** T30: a buff without a stated percentage counts as the middle of every stated one in the game's sheets. */
const typicals = new WeakMap<Library, number>();
export function typicalOf(lib: Library): number {
  const hit = typicals.get(lib);
  if (hit !== undefined) return hit;
  const sizes: number[] = [];
  for (const sh of lib.sheets.values())
    for (const e of sh.entries)
      for (const g of e.gives) {
        const z = sizeOf(g.amount);
        if (z !== undefined && (GENERAL_STATS.includes(g.stat) || SPECIFIC_STATS.includes(g.stat))) sizes.push(Math.abs(z));
      }
  const t = typicalSize(sizes);
  typicals.set(lib, t);
  return t;
}

/** Part B steps 3–9 for one team with a set damage dealer. */
export function checkTeam(members: string[], dd: string, lib: Library, account: Account): TeamResult {
  const name = (id: string) => lib.names.get(id) ?? id;
  const team = [dd, ...members.filter((id) => id !== dd)];
  const lines: Line[] = [];
  const contributed = new Set<string>();
  const seenNoStack = new Map<string, { who: string; what: string }>();
  const chained = new Set<string>();
  const countedStats = new Set<string>();
  const valuedZones = new Set<string>();
  const wants = new Map<string, { who: string; e: Entry & { scales: NonNullable<Entry['scales']> }; parts: Part[] }>();
  const typ = typicalOf(lib);
  const ownSuperBreak = superBreakOf(dd, lib);
  // A damage dealer whose damage happens alone (Phainon's domain) gets nothing from teammates' own hits there.
  const alone = !!lib.sheets.get(dd)?.damage?.alone;
  const sized = (e: Entry, keep: (g: Entry['gives'][number]) => boolean): Part[] =>
    e.gives.filter(keep).map((g) => {
      // A teammate's Super Break hit is sized against the damage dealer's own ("1 instance of 50% Super Break DMG").
      const sb = g.stat === 'extra-dmg' && ownSuperBreak ? superBreakSize(g.amount) : undefined;
      if (sb !== undefined && ownSuperBreak) return { zone: g.stat, size: sb / ownSuperBreak, how: 'stated' as const };
      const pt = partOf(g.stat, g.amount, typ);
      // An extra hit made by the teammate (not a share of the damage dealer's own hits) doesn't happen while they're alone.
      if (alone && g.stat === 'extra-dmg' && pt.how === 'typical') return { ...pt, size: 0 };
      // An action advance from an Ultimate comes about every third turn; from a Skill, Talent or trace, every time.
      return g.stat === 'action-advance' && e.piece.startsWith('skill-ultimate') ? { ...pt, size: pt.size / ULTIMATE_EVERY } : pt;
    });
  const statuses = new Map<string, { status: Status; why: string }>();
  const key = (who: string, e: Entry) => `${who}:${e.id}`;
  const entries = new Map(team.map((who) => [who, entriesOf(who, lib, account)]));
  for (const who of team) for (const e of entries.get(who) ?? []) statuses.set(key(who, e), statusOf(e, who, team, lib, account));
  const reactions = (entries.get(dd) ?? []).filter((x) => x.reacts && x.reacts.from !== 'self' && statuses.get(key(dd, x))?.status === 'on');
  const addedKinds = (entries.get(dd) ?? []).filter((x) => x.addsKinds && statuses.get(key(dd, x))?.status === 'on').flatMap((x) => x.addsKinds ?? []);
  let sustain = team.some((id) => ['preservation', 'abundance'].includes(lib.profiles.get(id)?.path ?? ''));

  for (const who of team) {
    const own = entries.get(who) ?? [];
    for (let e of own) {
      const st = statuses.get(key(who, e)) ?? { status: 'unknown', why: '' };
      const base = { who, entry: e.id, tag: e.tag, piece: e.piece, quote: e.quote };
      if (st.status === 'locked' || st.status === 'replaced' || st.status === 'unknown') {
        lines.push({ ...base, kind: st.status, why: st.why, points: 0 });
        continue;
      }
      if (st.status === 'off') {
        // An option of the same kit that is on (an Eidolon that drops the condition) covers it: not a loss.
        const cover = e.noStack ? own.find((x) => x !== e && x.noStack === e.noStack && statuses.get(key(who, x))?.status === 'on') : undefined;
        if (cover) lines.push({ ...base, kind: 'not-counted', why: `${st.why}; ${cover.tag} applies instead`, points: 0 });
        else lines.push({ ...base, kind: 'off', why: st.why, points: -1 });
        continue;
      }
      if (e.to !== 'self' && e.to !== 'enemy' && e.gives.some((g) => SUSTAIN_STATS.includes(g.stat))) sustain = true;
      // Step 6: the same buff from two sources counts once.
      if (e.noStack) {
        const first = seenNoStack.get(e.noStack);
        // Two options in one kit (only one can apply at a time) are not a duplicate: the first counts, the other is shown.
        if (first?.who === who) {
          lines.push({ ...base, kind: 'not-counted', why: `only one of these applies at a time; ${first.what} is counted`, points: 0 });
          continue;
        }
        if (first) {
          lines.push({ ...base, kind: 'duplicate', why: `does not stack with ${first.what}`, points: -1 });
          continue;
        }
        seenNoStack.set(e.noStack, { who, what: `${name(who)}'s ${e.tag}` });
      }
      if (who === dd) {
        // Only an ability of the damage dealer's that the team switches on counts, and only when it helps them.
        if (e.on && e.to === 'teammates') {
          lines.push({ ...base, kind: 'not-counted', why: `${st.why}, but it goes to teammates, not to ${name(dd)}`, points: 0 });
          continue;
        }
        if (e.on) {
          // A "no other X" condition is kept on by nobody in particular: no teammate is credited with it.
          const helpers = hasAtMost(e.on) ? [] : team.filter((id) => id !== dd && evalCondition(e.on, dd, [dd, id], lib) === 'met');
          for (const id of helpers) contributed.add(id);
          // T30: what it gives the damage dealer, sized from the kit; an ability with no number counts as a typical buff.
          const own = sized(e, (g) => usedBy(g, dd, lib));
          lines.push({ ...base, kind: 'switched-on', why: `${st.why}${helpers.length ? ` (${helpers.map(name).join(' and ')})` : ''}`, points: 1, helpers, parts: own.length ? own : [{ zone: `ability:${dd}:${e.id}`, size: typ, how: 'typical' }] });
        }
        continue;
      }
      // Step 5: chains, only for events a kit makes on purpose, to a reaction of the damage dealer's that takes teammates' events.
      if (e.causes) {
        // A DoT is a debuff in HSR: a reaction to debuffs takes DoT too. Each teammate chains into each reaction once.
        const reaction = reactions.find((x) => (x.reacts?.event === e.causes || (x.reacts?.event === 'debuff' && e.causes === 'dot')) && !chained.has(`${who}:${x.id}`));
        const already = !reaction && reactions.some((x) => x.reacts?.event === e.causes || (x.reacts?.event === 'debuff' && e.causes === 'dot'));
        if (already) lines.push({ ...base, kind: 'not-counted', why: `${name(who)} already chains into that reaction of ${name(dd)}'s`, points: 0 });
        else if (reaction) {
          chained.add(`${who}:${reaction.id}`);
          contributed.add(who);
          // T30: the kit doesn't say how much a set-off reaction adds: a typical buff, one zone per reaction (feeders add up).
          lines.push({ ...base, kind: 'chain', why: `${EVENT_WORD[e.causes]} for ${name(dd)}: ${reaction.tag}`, points: 1, parts: alone ? [] : [{ zone: `chain:${dd}:${reaction.id}`, size: typ, how: 'typical' }] });
        } else lines.push({ ...base, kind: 'not-counted', why: `${name(dd)}'s kit has nothing switched on that reacts to a teammate's ${EVENT_WORD[e.causes]}`, points: 0 });
      }
      // T30: an ability aimed at one chosen ally sets off a reaction to being targeted (Phainon's Coreflame), once per
      // teammate. It happens before the damage dealer's own turn, so it counts even when they deal damage alone.
      if (e.to === 'chosen-ally' && !e.piece.startsWith('eidolon-')) {
        const targeted = reactions.find((x) => x.reacts?.event === 'targets-ally' && !chained.has(`${who}:${x.id}`));
        if (targeted) {
          chained.add(`${who}:${targeted.id}`);
          contributed.add(who);
          lines.push({ ...base, kind: 'chain', why: `${EVENT_WORD['targets-ally']} for ${name(dd)}: ${targeted.tag}`, points: 1, parts: [{ zone: `chain:${dd}:${targeted.id}`, size: typ, how: 'typical' }] });
        }
      }
      if (!e.gives.length) continue;
      // T30: a kit with two branches by the damage dealer ("if their ATK is higher… otherwise") gives one of them.
      if (e.gives.some((g) => g.when)) {
        const atk = usesAtk(dd, lib);
        e = { ...e, gives: e.gives.filter((g) => !g.when || (g.when === 'atk-carry') === atk) };
      }
      const r = reach(e, who, dd, lib, addedKinds);
      if (r.kind === 'buff') {
        contributed.add(who);
        // Step 4b: each teammate counts each stat once, however many sentences give it.
        const fresh = r.used.filter((u) => !countedStats.has(`${who}|${u}`));
        for (const u of r.used) countedStats.add(`${who}|${u}`);
        // T30, the kit value: every sentence with a stated size adds its size; one without (a duration, a kept stack)
        // adds once per stat and giver, so the same buff told twice isn't valued twice.
        const parts = sized(e, (g) => r.used.some((u) => u.split(':')[0] === g.stat)).filter((pt) => pt.how === 'stated' || !valuedZones.has(`${who}|${pt.zone}`));
        for (const pt of parts) valuedZones.add(`${who}|${pt.zone}`);
        // A buff that grows with the giver's stat counts a third at base; their build adds the rest (decisions 25–26).
        const scaled = parts.map((pt) => (scalesWith(e, pt.zone) ? { ...pt, size: pt.size / (1 + BUILT_POINTS) } : pt));
        if (fresh.length) {
          lines.push({ ...base, kind: 'buff', why: r.why, points: 1, parts: scaled });
          // T18: a counted buff that grows with the giver's stat makes the team want that build on them.
          const sc = e.scales;
          if (sc && (!sc.gives || fresh.some((u) => sc.gives?.includes(u.split(':')[0] as Stat))) && !wants.has(`${who}|${sc.stat}`)) wants.set(`${who}|${sc.stat}`, { who, e: { ...e, scales: sc }, parts: parts.filter((pt) => scalesWith(e, pt.zone)) });
        } else
          lines.push({
            ...base,
            kind: 'not-counted',
            why: `${r.why}, but ${name(who)}'s ${list([...new Set(r.used.map((u) => statWord(u.split(':')[0] as Stat)))], 'and')} already counts once${parts.length ? ' (its size still adds to the kit value)' : ''}`,
            points: 0,
            ...(parts.length ? { parts: scaled } : {}),
          });
      } else if (r.kind === 'support') {
        contributed.add(who);
        // T30 (B): a support's own damage adds to the team's, sized against the damage dealer's own hit from the kit
        // texts ("12% of Tribbie's Max HP per target hit" against "56% of Castorice's Max HP"); typical when they don't say.
        const own = e.to === 'self' || alone ? [] : e.gives.filter((g) => g.stat === 'own-damage').map((g) => ownDamagePart(g.amount, lib.sheets.get(dd)?.damage?.quotes ?? [], typ));
        lines.push({ ...base, kind: 'support', why: r.why, points: 0, ...(own.length ? { parts: own } : {}) });
      } else lines.push({ ...base, kind: 'not-counted', why: r.why, points: 0 });
    }
  }

  // T18 (decisions 25–26): each wanted build, read roughly from the saved build; the best team found assumes it built.
  for (const { who, e, parts } of wants.values()) {
    const fit: BuildFit = account.ideal ? { fit: 'built', points: BUILT_POINTS, have: 'assumed built for it' } : (account.buildFit?.(who, e.scales.stat) ?? { fit: 'no-build', points: 0, have: 'no build saved' });
    const word = BUILD_STAT_WORD[e.scales.stat];
    lines.push({
      kind: 'build',
      who,
      entry: e.id,
      tag: `${word} build on ${name(who)}`,
      why: `${e.tag} grows with ${name(who)}'s ${word}. Yours: ${fit.have}: ${FIT_WORD[fit.fit]}`,
      piece: e.piece,
      quote: e.scales.quote,
      points: fit.points,
      build: { stat: e.scales.stat, fit: fit.fit, have: fit.have, max: BUILT_POINTS },
      // T30: the rest of the scaled buff, by how built they are (built: all of it).
      parts: fit.points ? parts.map((pt) => ({ ...pt, size: (pt.size * fit.points) / (1 + BUILT_POINTS) })) : [],
    });
  }

  // Step 7: a teammate who brings nothing for the damage dealer and no team support is a weak fit.
  for (const who of team) {
    if (who === dd || contributed.has(who)) continue;
    lines.push({ kind: 'weak-fit', who, tag: 'Weak fit', why: `${name(who)} brings nothing for ${name(dd)} and no team support`, points: -1 });
  }

  // T30, on top of the count: the team's kit value from every line's sized parts; each line's `value` is its share.
  const v = value(lines.map((l) => l.parts ?? []));
  lines.forEach((l, i) => (l.value = l.parts?.length ? (v.shares[i] ?? 0) : 0));
  const count = lines.reduce((n, l) => n + l.points, 0);
  return { members: team, dd, count, value: v.points, support: lines.filter((l) => l.kind === 'support').length, chains: lines.filter((l) => l.kind === 'chain').length, sustain, lines };
}

/**
 * Which team is better: the higher count, then more team support, then more chains. Positive = a is better.
 * A team does not need a healer or shield (owner's ruling 2026-10-10, decision 32): sustain is never a rule or a tiebreak.
 */
export const compare = (a: TeamResult, b: TeamResult) => a.value - b.value || a.count - b.count || a.support - b.support || a.chains - b.chains;

/**
 * The whole check: pick the damage dealer (or use `dd`), check, and when two can
 * carry, keep the better and remember the other.
 */
/**
 * The carries this damage dealer's own game team lists (the owner's edited lists when there are any; otherwise the
 * game's pairings): in a team, they deal damage too, so what reaches them counts (decision 33).
 */
function coCarries(members: string[], dd: string, lib: Library, account: Account): string[] {
  const own = lib.ownTeams.get(dd);
  const listed = (id: string) => (own?.length ? own.some((t) => (account.teamList?.(t.id) ?? t.slots).some((slot) => slot.includes(id))) : !!lib.pairedWith.get(dd)?.has(id));
  return members.filter((id) => id !== dd && canCarry(id, lib) && listed(id));
}

/**
 * Decision 33: a team the game builds around several damage dealers (Aventurine • Waveflair with Mortenax Blade and
 * Ashveil) is checked for each of them. The main damage dealer's lines stay as they are; for each co-carry, the
 * lines that earn or cost points for them are added, marked `forDd`. A teammate who helps one carry only is not a
 * weak fit, and a build the team already wants on someone is not asked twice.
 */
function withCoCarries(r: TeamResult, lib: Library, account: Account): TeamResult {
  const co = coCarries(r.members, r.dd, lib, account);
  if (!co.length) return r;
  const wanted = new Set(r.lines.filter((l) => l.kind === 'build').map((l) => `${l.who}|${l.build?.stat ?? ''}`));
  const extra: Line[] = [];
  for (const c of co) {
    for (const l of checkTeam(r.members, c, lib, account).lines) {
      if (l.points === 0 || l.kind === 'weak-fit') continue;
      // A buff for one chosen ally goes to one carry only: when the main damage dealer gets it, the others don't (T30).
      const to = l.entry ? entriesOf(l.who, lib, account).find((x) => x.id === l.entry)?.to : undefined;
      if (to === 'chosen-ally' && r.lines.some((m) => !m.forDd && m.who === l.who && m.entry === l.entry && m.points > 0)) continue;
      if (l.kind === 'build' && wanted.has(`${l.who}|${l.build?.stat ?? ''}`)) continue;
      extra.push({ ...l, forDd: c });
    }
  }
  // T30: each carry's damage adds up (it doesn't multiply): the team is worth POINTS × ln(the sum of the carries'
  // multipliers), shared out to each carry's lines by how much of the sum that carry makes.
  const own = (c: string) => (c === r.dd ? r.lines.filter((l) => !l.forDd) : extra.filter((l) => l.forDd === c));
  const valueOf = (c: string) => own(c).reduce((n, l) => n + (l.value ?? 0), 0);
  const carries = [r.dd, ...co];
  const sum = carries.reduce((n, c) => n + Math.exp(valueOf(c) / POINTS), 0);
  const total = POINTS * Math.log(sum);
  for (const c of carries) {
    const mine = valueOf(c);
    const portion = (total * Math.exp(mine / POINTS)) / sum;
    if (mine > 0) for (const l of own(c)) l.value = ((l.value ?? 0) * portion) / mine;
  }
  const lines = [...r.lines, ...extra];
  return { ...r, lines, coDds: co, count: lines.reduce((n, l) => n + l.points, 0), value: total, chains: lines.filter((l) => l.kind === 'chain').length };
}

export function check(members: string[], lib: Library, account: Account, dd?: string): CheckOutcome {
  const unread = members.filter((id) => !lib.sheets.has(id));
  if (unread.length) return { rated: false, why: `not rated yet: ${unread.map((id) => lib.names.get(id) ?? id).join(', ')} not read yet`, unread };
  const dds = dd ? [dd] : damageDealers(members, lib);
  if (!dds.length) return { rated: false, why: 'no one in this team carries damage (no damage notes in their kits)' };
  let best: TeamResult | undefined;
  let other: TeamResult | undefined;
  for (const d of dds) {
    const r = withCoCarries(checkTeam(members, d, lib, account), lib, account);
    if (!best || compare(r, best) > 0) {
      other = best;
      best = r;
    } else if (!other || compare(r, other) > 0) other = r;
  }
  return best ? { rated: true, best, ...(other ? { other } : {}) } : { rated: false, why: 'nothing to check' };
}
