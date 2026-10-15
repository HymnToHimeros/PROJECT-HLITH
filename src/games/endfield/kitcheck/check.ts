/**
 * Part B of docs/logic/endfield-method.md: checking a team, exactly as written. Fixed rules, no guessing:
 * the same team always gets the same answer, and every point comes with the entry (and its quote) that earned it.
 * Mirrors the ZZZ check (src/games/zzz/kitcheck/check.ts); Endfield has no team order (decision 2).
 */
import { ownDamagePart, partOf, sizeOf, typicalSize, value, type Part } from '../../../core/rules/kitValue';
import { unreadWords } from '../../../core/rules/leaks';
import { ARTS, GENERAL_STATS, SPECIFIC_STATS, SUPPORT_STATS, type CharacterSheet, type Condition, type Element, type Entry, type GameEvent, type OpClass, type Stat } from './types';

export interface Profile {
  characterId: string;
  element: Element;
  opClass: OpClass;
}

/** What the check knows: profiles for everyone, sheets for read operators, kit unlock levels and labels. */
export interface Library {
  profiles: Map<string, Profile>;
  sheets: Map<string, CharacterSheet>;
  /** Kit piece → the Potential it needs, per operator. */
  unlocks: Map<string, Map<string, { potential?: number }>>;
  /** Kit piece → its label ("Battle Skill: Dolly Rush"), per operator. */
  pieceLabels: Map<string, Map<string, string>>;
  names: Map<string, string>;
  /** Ids that are one operator, so a team holds at most one of them (the Endministrator: male or female). */
  sameOperator?: string[][];
  /** Not used by Endfield yet (no leaks); kept so shared rules read the same shape. */
  leaks?: Map<string, string>;
  stale?: Map<string, string>;
}

export const labelOf = (lib: Library, who: string, piece: string) => lib.pieceLabels.get(who)?.get(piece) ?? piece;

/** Your account: the Potential saved per operator (not owned = 0). */
export interface Account {
  potential: (id: string) => number;
}

export type Status = 'on' | 'off' | 'locked' | 'unknown';

/** One line of the explanation. `points` is what it adds to the count (0 for tie-break and not counted). */
export interface Line {
  kind: 'switched-on' | 'buff' | 'chain' | 'off' | 'duplicate' | 'weak-fit' | 'support' | 'not-counted' | 'locked' | 'unknown';
  who: string;
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
  /** T30: its share of the team's kit value. */
  value?: number;
}

export interface SquadResult {
  /** The team, damage dealer first. */
  order: string[];
  dd: string;
  count: number;
  /** T30: the kit value, POINTS × ln(how much the kits multiply the damage dealer's damage). */
  value: number;
  /** Info only: someone heals or shields the others. */
  sustain: boolean;
  support: number;
  chains: number;
  lines: Line[];
}

export type CheckOutcome = { rated: true; best: SquadResult; other?: SquadResult } | { rated: false; why: string; unread?: string[] };

/** Decision 1: the damage dealers are the members whose sheets have damage notes. */
export const damageDealers = (members: string[], lib: Library) => members.filter((id) => !!lib.sheets.get(id)?.damage);
export const isDamageDealer = (id: string, lib: Library) => !!lib.sheets.get(id)?.damage;

/** The damage type of a damage dealer's damage: from their notes, else their element. */
const damageOf = (dd: string, lib: Library): Element | undefined => lib.sheets.get(dd)?.damage?.element ?? lib.profiles.get(dd)?.element;

type CondResult = 'met' | 'not-met' | 'unknown';
const hasNamed = (c: Condition | undefined): boolean => !!c && ('all' in c ? c.all.some(hasNamed) : 'named' in c || 'lead' in c);

function evalCondition(c: Condition | undefined, self: string, team: string[], lib: Library, dd?: string): CondResult {
  if (!c) return 'met';
  if ('unknown' in c) return 'unknown';
  if ('lead' in c) {
    // Decision 8: Team Position 01 is the damage dealer.
    const el = dd === undefined ? undefined : damageOf(dd, lib);
    if (el === undefined) return 'unknown';
    return c.lead.elements.includes(el) !== !!c.lead.not ? 'met' : 'not-met';
  }
  if ('named' in c) {
    const q = c.named;
    if (q.as === 'member') return team.some((id) => id !== self && q.ids.includes(id)) ? 'met' : 'not-met';
    if (dd === undefined) return 'unknown';
    return q.ids.includes(dd) === (q.as === 'carry') ? 'met' : 'not-met';
  }
  if ('all' in c) {
    const rs = c.all.map((x) => evalCondition(x, self, team, lib, dd));
    return rs.includes('not-met') ? 'not-met' : rs.includes('unknown') ? 'unknown' : 'met';
  }
  if ('count' in c) {
    const n = team.filter((id) => {
      const p = lib.profiles.get(id);
      return !!p && (!c.count.element || p.element === c.count.element) && (!c.count.opClass || p.opClass === c.count.opClass);
    }).length;
    return n >= c.count.atLeast ? 'met' : 'not-met';
  }
  const a = c.another;
  return team.some((id) => {
    if (id === self) return false;
    const p = lib.profiles.get(id);
    if (!p) return false;
    return !!a.classes?.includes(p.opClass) || !!a.elements?.includes(p.element) || (a.arts !== undefined && ARTS.includes(p.element) === a.arts);
  })
    ? 'met'
    : 'not-met';
}

/** Part B step 2: locked, on, off or unknown, with the reason in words. */
export function statusOf(e: Entry, who: string, team: string[], lib: Library, account: Account, dd?: string): { status: Status; why: string } {
  const need = lib.unlocks.get(who)?.get(e.piece)?.potential;
  if (need && account.potential(who) < need) return { status: 'locked', why: `locked: needs Potential ${need}, you have ${account.potential(who)}` };
  if (e.unverified) return { status: 'unknown', why: `unclear text: ${e.unverified}` };
  const r = evalCondition(e.on, who, team, lib, dd);
  if (r === 'unknown') return { status: 'unknown', why: 'its condition cannot be checked from profiles' };
  if (r === 'not-met') return { status: 'off', why: `off: ${conditionWords(e.on)} is not met in this team` };
  return { status: 'on', why: e.on ? `on: ${conditionWords(e.on)}` : 'always on' };
}

const CLASS_WORD: Record<OpClass, string> = { caster: 'Caster', defender: 'Defender', guard: 'Guard', striker: 'Striker', supporter: 'Supporter', vanguard: 'Vanguard' };
const ELEMENT_WORD: Record<Element, string> = { physical: 'Physical', heat: 'Heat', cryo: 'Cryo', electric: 'Electric', nature: 'Nature' };
const list = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1] ?? ''}`);

export function conditionWords(c: Condition | undefined): string {
  if (!c) return 'always';
  if ('unknown' in c) return c.unknown;
  if ('lead' in c) return c.lead.words;
  if ('named' in c) return c.named.words;
  if ('all' in c) return c.all.map(conditionWords).join(', and ');
  if ('count' in c) return `${c.count.atLeast} ${[c.count.element && ELEMENT_WORD[c.count.element], c.count.opClass && CLASS_WORD[c.count.opClass]].filter(Boolean).join(' ')} operators in the team`;
  const parts: string[] = [];
  if (c.another.classes?.length) parts.push(`a ${list(c.another.classes.map((x) => CLASS_WORD[x]))}`);
  if (c.another.elements?.length) parts.push(`${list(c.another.elements.map((x) => ELEMENT_WORD[x]))}`);
  if (c.another.arts !== undefined) parts.push(c.another.arts ? 'an Arts operator' : 'a Physical operator');
  return `another member is ${parts.join(', or ')}`;
}

/** Decision 5: the events a general reaction covers ('arts-infliction' is set up by any element's infliction). */
const COVERS: Partial<Record<GameEvent, GameEvent[]>> = {
  'physical-status': ['lift', 'knock-down', 'crush', 'breach'],
  'arts-infliction': ['heat-infliction', 'cryo-infliction', 'electric-infliction', 'nature-infliction'],
  'arts-reaction': ['combustion', 'solidification', 'electrification', 'corrosion'],
};
/** Arts Susceptibility makes an enemy Susceptible to every Arts element (wiki: Arts Susceptibility). */
const IMPLIES: Partial<Record<GameEvent, GameEvent[]>> = {
  'arts-susceptibility': ['heat-susceptibility', 'cryo-susceptibility', 'electric-susceptibility', 'nature-susceptibility'],
};
/** Decision 5: an element's infliction on an enemy that already has another element's sets up that element's reaction. */
const REACTION_OF: Partial<Record<GameEvent, GameEvent>> = {
  'heat-infliction': 'combustion',
  'cryo-infliction': 'solidification',
  'electric-infliction': 'electrification',
  'nature-infliction': 'corrosion',
};
/** Does setting up `cause` meet a piece that reacts to `need`? */
export const meets = (cause: GameEvent, need: GameEvent) => cause === need || !!COVERS[need]?.includes(cause) || !!IMPLIES[cause]?.includes(need);

const EVENT_WORD: Record<GameEvent, string> = {
  vulnerable: 'Vulnerable',
  'physical-status': 'a Physical Status',
  lift: 'Lift',
  'knock-down': 'Knock Down',
  crush: 'Crush',
  breach: 'Breach',
  'arts-infliction': 'an Arts Infliction',
  'heat-infliction': 'Heat Infliction',
  'cryo-infliction': 'Cryo Infliction',
  'electric-infliction': 'Electric Infliction',
  'nature-infliction': 'Nature Infliction',
  'arts-burst': 'an Arts Burst',
  'arts-reaction': 'an Arts Reaction',
  combustion: 'Combustion',
  solidification: 'Solidification',
  electrification: 'Electrification',
  corrosion: 'Corrosion',
  'physical-susceptibility': 'Physical Susceptibility',
  'arts-susceptibility': 'Arts Susceptibility',
  'heat-susceptibility': 'Heat Susceptibility',
  'cryo-susceptibility': 'Cryo Susceptibility',
  'electric-susceptibility': 'Electric Susceptibility',
  'nature-susceptibility': 'Nature Susceptibility',
  stagger: 'Stagger',
  'final-strike': 'a Final Strike',
  link: 'Link',
};
export const eventWord = (e: GameEvent) => EVENT_WORD[e];

type Reach = { kind: 'buff'; why: string; used: Stat[] } | { kind: 'support'; why: string } | { kind: 'no'; why: string };

/** Does the damage dealer's damage use this stat (general and not ignored, or specific and listed)? */
function usedBy(stat: Stat, dd: string, lib: Library): boolean {
  const notes = lib.sheets.get(dd)?.damage;
  return (GENERAL_STATS.includes(stat) && !notes?.ignores.includes(stat)) || (SPECIFIC_STATS.includes(stat) && !!notes?.uses.includes(stat));
}

/** Part B step 3: does this buff reach the damage dealer? */
function reach(e: Entry, giver: string, dd: string, lib: Library): Reach {
  const name = (id: string) => lib.names.get(id) ?? id;
  if (e.to === 'self') return { kind: 'support', why: `helps ${name(giver)} only` };
  if (e.to === 'teammate') return { kind: 'support', why: 'goes to one operator the game picks, not always the damage dealer' };
  const el = damageOf(dd, lib);
  const notes = lib.sheets.get(dd)?.damage;
  const l = e.limits;
  if (l && el) {
    if (l.elements && !l.elements.includes(el)) return { kind: 'no', why: `only for ${list(l.elements.map((x) => ELEMENT_WORD[x]))} DMG; ${name(dd)} deals ${ELEMENT_WORD[el]}` };
    if (l.arts !== undefined && ARTS.includes(el) !== l.arts) return { kind: 'no', why: `only for ${l.arts ? 'Arts' : 'Physical'} DMG; ${name(dd)} deals ${ELEMENT_WORD[el]}` };
    if (l.skills && notes && !l.skills.some((s) => notes.skills.includes(s))) return { kind: 'no', why: `only for ${list(l.skills)} DMG; ${name(dd)}'s damage is mainly ${list(notes.skills)}` };
  }
  const stats = e.gives.map((g) => g.stat);
  const used = stats.filter((s) => usedBy(s, dd, lib));
  if (used.length) return { kind: 'buff', why: `reaches ${name(dd)}`, used };
  if (stats.some((s) => SUPPORT_STATS.includes(s))) return { kind: 'support', why: 'team support' };
  return { kind: 'no', why: `${name(dd)}'s damage doesn't use ${list([...new Set(stats)])}` };
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

/** Part B steps 2–8 for a team with a set damage dealer. */
export function checkTeam(team: string[], dd: string, lib: Library, account: Account): SquadResult {
  const name = (id: string) => lib.names.get(id) ?? id;
  const order = [dd, ...team.filter((id) => id !== dd)];
  const lines: Line[] = [];
  const contributed = new Set<string>();
  const supported = new Set<string>();
  const seenNoStack = new Map<string, string>();
  const typ = typicalOf(lib);
  const sized = (e: Entry, keep: (s: Stat) => boolean): Part[] => e.gives.filter((g) => keep(g.stat)).map((g) => partOf(g.stat, g.amount, typ));
  const statuses = new Map<string, { status: Status; why: string }>();
  const key = (who: string, e: Entry) => `${who}:${e.id}`;
  const entries = new Map(order.map((who) => [who, lib.sheets.get(who)?.entries ?? []]));
  for (const who of order) for (const e of entries.get(who) ?? []) statuses.set(key(who, e), statusOf(e, who, order, lib, account, dd));
  const ddReacting = (entries.get(dd) ?? []).filter((x) => x.reacts?.length && statuses.get(key(dd, x))?.status === 'on');
  // Decision 5: the inflictions the team applies; one element's on top of another's makes the reaction of the second.
  const inflicted = new Set(order.flatMap((who) => (entries.get(who) ?? []).filter((e) => statuses.get(key(who, e))?.status === 'on').flatMap((e) => (e.causes ?? []).filter((c) => REACTION_OF[c]))));
  const reactionsOf = (e: Entry): GameEvent[] => (e.causes ?? []).flatMap((c) => (REACTION_OF[c] && [...inflicted].some((x) => x !== c) ? [REACTION_OF[c]] : []));

  for (const who of order) {
    for (const e of entries.get(who) ?? []) {
      const st = statuses.get(key(who, e)) ?? { status: 'unknown', why: '' };
      const base = { who, entry: e.id, tag: e.tag, piece: e.piece, quote: e.quote };
      if (st.status === 'locked' || st.status === 'unknown') {
        lines.push({ ...base, kind: st.status, why: st.why, points: 0 });
        continue;
      }
      if (st.status === 'off') {
        // A line for a named operator who isn't here (or isn't the damage dealer) is for another team: no loss.
        if (hasNamed(e.on)) lines.push({ ...base, kind: 'not-counted', why: `only when ${conditionWords(e.on)}`, points: 0 });
        else lines.push({ ...base, kind: 'off', why: st.why, points: -1 });
        continue;
      }
      // Step 5: entries the kits say do not stack count once.
      if (e.noStack) {
        const first = seenNoStack.get(e.noStack);
        if (first) {
          lines.push({ ...base, kind: 'duplicate', why: `does not stack with ${first}`, points: -1 });
          continue;
        }
        seenNoStack.set(e.noStack, `${name(who)}'s ${e.tag}`);
      }
      if (who === dd) {
        // Only an ability of the damage dealer that a teammate switches on counts as "theirs switched on".
        if (e.on) {
          const helpers = order.filter((id) => id !== dd && evalCondition(e.on, dd, [dd, id], lib) === 'met');
          for (const id of helpers) contributed.add(id);
          const own = sized(e, (s) => usedBy(s, dd, lib));
          lines.push({ ...base, kind: 'switched-on', why: `${st.why}${helpers.length ? ` (${helpers.map(name).join(' and ')})` : ''}`, points: 1, helpers, parts: own.length ? own : [{ zone: `ability:${dd}:${e.id}`, size: typ, how: 'typical' }] });
        }
        continue;
      }
      // Step 4: chains, a teammate setting up what the damage dealer's kit reacts to.
      if (e.causes?.length) {
        const reactions = reactionsOf(e);
        const causes = [...e.causes, ...reactions];
        const hit = ddReacting.find((x) => causes.some((c) => x.reacts?.some((need) => meets(c, need))));
        const cause = hit && causes.find((c) => hit.reacts?.some((need) => meets(c, need)));
        if (hit && cause) {
          contributed.add(who);
          const how = reactions.includes(cause) && !e.causes.includes(cause) ? ' (on another element’s Infliction)' : '';
          lines.push({ ...base, kind: 'chain', why: `sets up ${eventWord(cause)}${how} for ${name(dd)}: ${hit.tag}`, points: 1, parts: [{ zone: `chain:${dd}:${hit.id}`, size: typ, how: 'typical' }] });
        } else if (!e.gives.length) lines.push({ ...base, kind: 'not-counted', why: `${name(dd)}'s kit has nothing switched on that needs ${list(e.causes.map(eventWord))}`, points: 0 });
      }
      if (!e.gives.length) continue;
      const r = reach(e, who, dd, lib);
      if (r.kind === 'buff') {
        contributed.add(who);
        lines.push({ ...base, kind: 'buff', why: r.why, points: 1, parts: sized(e, (s) => r.used.includes(s)) });
      } else if (r.kind === 'support') {
        supported.add(who);
        const own = e.to === 'self' ? [] : e.gives.filter((g) => g.stat === 'own-damage').map((g) => ownDamagePart(g.amount, lib.sheets.get(dd)?.damage?.quotes ?? [], typ));
        lines.push({ ...base, kind: 'support', why: r.why, points: 0, ...(own.length ? { parts: own } : {}) });
      } else lines.push({ ...base, kind: 'not-counted', why: r.why, points: 0 });
    }
  }

  // Step 6 (decision 6): a teammate who brings the damage dealer nothing at all is a weak fit.
  for (const who of order) {
    if (who === dd || contributed.has(who) || supported.has(who)) continue;
    lines.push({ kind: 'weak-fit', who, tag: 'Weak fit', why: `${name(who)} brings nothing for ${name(dd)}`, points: -1 });
  }

  // T30, on top of the count: the team's kit value from every line's sized parts; each line's `value` is its share.
  const v = value(lines.map((l) => l.parts ?? []));
  lines.forEach((l, i) => (l.value = l.parts?.length ? (v.shares[i] ?? 0) : 0));
  const count = lines.reduce((n, l) => n + l.points, 0);
  const sustain = order.some((id) => (entries.get(id) ?? []).some((e) => e.to !== 'self' && e.to !== 'enemy' && e.gives.some((g) => g.stat === 'heal' || g.stat === 'shield')));
  return { order, dd, count, value: v.points, sustain, support: lines.filter((l) => l.kind === 'support').length, chains: lines.filter((l) => l.kind === 'chain').length, lines };
}

/** Ties: higher kit value, then count, then more team support, then more chains. Positive = a is better. */
export const compare = (a: SquadResult, b: SquadResult) => a.value - b.value || a.count - b.count || a.support - b.support || a.chains - b.chains;

/** The whole check: each possible damage dealer, keep the best. `dd` forces one (If you pull, recommended teams). */
export function checkSquad(members: string[], lib: Library, account: Account, dd?: string): CheckOutcome {
  const twice = lib.sameOperator?.find((ids) => ids.filter((id) => members.includes(id)).length > 1);
  if (twice) return { rated: false, why: `${twice.map((id) => lib.names.get(id) ?? id).join(' and ')} are one operator: a team can hold only one of them` };
  const unread = members.filter((id) => !lib.sheets.has(id));
  if (unread.length) return { rated: false, why: unreadWords(unread, (id) => lib.names.get(id) ?? id, lib.stale), unread };
  const dds = dd ? [dd] : damageDealers(members, lib);
  if (!dds.length) return { rated: false, why: 'no damage dealer in this team (no operator here is read as one yet)' };
  const results = dds.map((d) => checkTeam(members, d, lib, account)).sort((a, b) => compare(b, a));
  const [best, other] = results;
  return best ? { rated: true, best, ...(other ? { other } : {}) } : { rated: false, why: 'nothing to check' };
}
