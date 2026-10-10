/**
 * Part B of docs/logic/zzz-method.md: checking a squad, exactly as written.
 * Fixed rules, no guessing: the same squad always gets the same answer, and
 * every point comes with the entry (and its quote) that earned it.
 */
import { GENERAL_STATS, SPECIFIC_STATS, SUPPORT_STATS, type CharacterSheet, type Condition, type Entry, type Specialty } from './types';

export interface Profile {
  characterId: string;
  specialty: Specialty;
  attribute: string;
  faction: string;
  assistType: string;
}

/** What the check knows about the game: profiles for everyone, sheets for read characters, kit unlock levels. */
export interface Library {
  profiles: Map<string, Profile>;
  sheets: Map<string, CharacterSheet>;
  /** Kit piece → unlock level, per character. */
  unlocks: Map<string, Map<string, { dupes?: number; potential?: number; replacedAt?: number }>>;
  /** Kit piece → its label ("Additional Ability: External Line"), per character. */
  pieceLabels: Map<string, Map<string, string>>;
  names: Map<string, string>;
}

/** Your account: Mindscape per character (not owned = 0), Potential when known. */
export interface Account {
  mindscape: (id: string) => number;
  /** undefined = not saved. */
  potential: (id: string) => number | undefined;
}

export type Status = 'on' | 'off' | 'locked' | 'unknown' | 'replaced';

/** One line of the explanation. `points` is what it adds to the count (0 for tie-break and not counted). */
export interface Line {
  kind: 'switched-on' | 'buff' | 'chain' | 'off' | 'duplicate' | 'weak-fit' | 'support' | 'possible' | 'not-counted' | 'locked' | 'unknown' | 'replaced';
  who: string;
  /** Entry id (absent for weak fits). */
  entry?: string;
  tag: string;
  /** Plain-words reason. */
  why: string;
  /** Proof: kit piece and exact quote. */
  piece?: string;
  quote?: string;
  points: number;
  /** For a switched-on ability: the teammates who each meet its condition. */
  helpers?: string[];
}

export interface SquadResult {
  /** The order kept, damage dealer first: A > B > C. */
  order: string[];
  dd: string;
  count: number;
  support: number;
  chains: number;
  lines: Line[];
}

export type CheckOutcome = { rated: true; best: SquadResult; other?: SquadResult } | { rated: false; why: string; unread?: string[] };

/** Part B step 1: the damage dealer. Attack first; otherwise Rupture, Armorer or Anomaly, in that order. */
export const DD_ORDER: Specialty[] = ['attack', 'rupture', 'armorer', 'anomaly'];

export function damageDealers(members: string[], lib: Library): string[] {
  for (const s of DD_ORDER) {
    const found = members.filter((id) => lib.profiles.get(id)?.specialty === s);
    if (found.length) return found;
  }
  return [];
}

const before = (order: string[], id: string) => order[(order.indexOf(id) - 1 + order.length) % order.length] ?? '';
const after = (order: string[], id: string) => order[(order.indexOf(id) + 1) % order.length] ?? '';

type CondResult = 'met' | 'not-met' | 'unknown';

function evalCondition(c: Condition | undefined, self: string, order: string[], lib: Library): CondResult {
  if (!c) return 'met';
  const me = lib.profiles.get(self);
  if ('unknown' in c) return 'unknown';
  if ('all' in c) {
    const rs = c.all.map((x) => evalCondition(x, self, order, lib));
    return rs.includes('not-met') ? 'not-met' : rs.includes('unknown') ? 'unknown' : 'met';
  }
  if ('previous' in c) {
    const p = lib.profiles.get(before(order, self));
    return order.length > 1 && p && c.previous.specialties.includes(p.specialty) ? 'met' : 'not-met';
  }
  if ('count' in c) {
    const n = order.filter((id) => lib.profiles.get(id)?.specialty === c.count.specialty).length;
    return n >= c.count.atLeast ? 'met' : 'not-met';
  }
  const a = c.another;
  const ok = order.some((id) => {
    if (id === self) return false;
    const p = lib.profiles.get(id);
    if (!p || !me) return false;
    return (
      !!a.specialties?.includes(p.specialty) ||
      (!!a.sameAttribute && p.attribute === me.attribute) ||
      (!!a.sameFaction && p.faction === me.faction) ||
      !!a.attributes?.includes(p.attribute) ||
      !!a.assistTypes?.includes(p.assistType)
    );
  });
  return ok ? 'met' : 'not-met';
}

/** Part B step 3: locked, on, off or unknown, with the reason in words. */
export function statusOf(e: Entry, who: string, order: string[], lib: Library, account: Account): { status: Status; why: string } {
  const unlock = lib.unlocks.get(who)?.get(e.piece);
  if (unlock?.dupes && account.mindscape(who) < unlock.dupes) return { status: 'locked', why: `locked: needs M${unlock.dupes}, you have M${account.mindscape(who)}` };
  if (unlock?.potential) {
    const p = account.potential(who);
    if (p === undefined) return { status: 'locked', why: `locked: needs Potential ${unlock.potential}; Potential isn't saved yet` };
    if (p < unlock.potential) return { status: 'locked', why: `locked: needs Potential ${unlock.potential}, you have ${p}` };
  }
  if (unlock?.replacedAt) {
    const p = account.potential(who);
    if (p !== undefined && p >= unlock.replacedAt) return { status: 'replaced', why: `replaced: the Agent Potential ${unlock.replacedAt}+ version is on` };
  }
  if (e.unverified) return { status: 'unknown', why: `unclear text: ${e.unverified}` };
  const r = evalCondition(e.on, who, order, lib);
  if (r === 'unknown') return { status: 'unknown', why: 'its condition cannot be checked from profiles' };
  if (r === 'not-met') return { status: 'off', why: `off: ${conditionWords(e.on, lib)} is not met in this squad` };
  return { status: 'on', why: e.on ? `on: ${conditionWords(e.on, lib)}` : 'always on' };
}

const SPECIALTY_WORD: Record<Specialty, string> = { attack: 'Attack', stun: 'Stun', anomaly: 'Anomaly', support: 'Support', defense: 'Defense', rupture: 'Rupture', armorer: 'Armorer' };
const list = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1] ?? ''}`);

export function conditionWords(c: Condition | undefined, lib: Library): string {
  if (!c) return 'always';
  if ('unknown' in c) return c.unknown;
  if ('all' in c) return c.all.map((x) => conditionWords(x, lib)).join(', and ');
  if ('previous' in c) return `the character before is ${list(c.previous.specialties.map((s) => SPECIALTY_WORD[s]))}`;
  if ('count' in c) return `${c.count.atLeast} ${SPECIALTY_WORD[c.count.specialty]} characters in the squad`;
  const parts: string[] = [];
  if (c.another.specialties?.length) parts.push(list(c.another.specialties.map((s) => SPECIALTY_WORD[s])));
  if (c.another.attributes?.length) parts.push(`${list(c.another.attributes)} attribute`);
  if (c.another.assistTypes?.length) parts.push(`a ${list(c.another.assistTypes)} assist character`);
  if (c.another.sameAttribute) parts.push('the same attribute');
  if (c.another.sameFaction) parts.push('the same faction');
  return `another member is ${parts.join(', or shares ')}`;
}

type Reach = { kind: 'buff' | 'support'; why: string } | { kind: 'no'; why: string };

/** Part B step 4: does this buff reach the damage dealer? */
function reach(e: Entry, giver: string, dd: string, order: string[], lib: Library): Reach {
  const name = (id: string) => lib.names.get(id) ?? id;
  const ddp = lib.profiles.get(dd);
  const notes = lib.sheets.get(dd)?.damage;
  if (e.to === 'self') return { kind: 'support', why: `helps ${name(giver)} only` };
  if (e.to === 'previous' && before(order, giver) !== dd) return { kind: 'no', why: `goes to the character before ${name(giver)}, who is ${name(before(order, giver))}, not ${name(dd)}` };
  if (e.to === 'next' && after(order, giver) !== dd) return { kind: 'no', why: `goes to the character after ${name(giver)}, who is ${name(after(order, giver))}, not ${name(dd)}` };
  const l = e.limits;
  if (ddp && l) {
    if (l.attributes && !l.attributes.includes(ddp.attribute)) return { kind: 'no', why: `only for ${list(l.attributes)}; ${name(dd)} is ${ddp.attribute}` };
    if (l.notAttributes?.includes(ddp.attribute)) return { kind: 'no', why: `not for ${ddp.attribute}` };
    if (l.specialties && !l.specialties.includes(ddp.specialty)) return { kind: 'no', why: `only for ${list(l.specialties.map((s) => SPECIALTY_WORD[s]))}; ${name(dd)} is ${SPECIALTY_WORD[ddp.specialty]}` };
    if (l.notSpecialties?.includes(ddp.specialty)) return { kind: 'no', why: `not for ${SPECIALTY_WORD[ddp.specialty]}` };
  }
  const stats = e.gives.map((g) => g.stat);
  const used = stats.filter((s) => (GENERAL_STATS.includes(s) && !notes?.ignores.includes(s)) || (SPECIFIC_STATS.includes(s) && !!notes?.uses.includes(s)));
  if (used.length) return { kind: 'buff', why: `reaches ${name(dd)}` };
  if (stats.some((s) => SUPPORT_STATS.includes(s))) return { kind: 'support', why: 'team support' };
  return { kind: 'no', why: `${name(dd)}'s damage doesn't use ${list([...new Set(stats)])}` };
}

/** Parts B steps 3–8 for one order with a set damage dealer. */
export function checkOrder(order: string[], dd: string, lib: Library, account: Account): SquadResult {
  const name = (id: string) => lib.names.get(id) ?? id;
  const lines: Line[] = [];
  const contributed = new Set<string>();
  const seenNoStack = new Map<string, string>();
  const statuses = new Map<string, { status: Status; why: string }>();
  const key = (who: string, e: Entry) => `${who}:${e.id}`;
  for (const who of order) for (const e of lib.sheets.get(who)?.entries ?? []) statuses.set(key(who, e), statusOf(e, who, order, lib, account));
  const ddSheet = lib.sheets.get(dd);

  for (const who of order) {
    const sheet = lib.sheets.get(who);
    if (!sheet) continue;
    for (const e of sheet.entries) {
      const st = statuses.get(key(who, e)) ?? { status: 'unknown', why: '' };
      const base = { who, entry: e.id, tag: e.tag, piece: e.piece, quote: e.quote };
      if (st.status === 'locked') {
        lines.push({ ...base, kind: 'locked', why: st.why, points: 0 });
        continue;
      }
      if (st.status === 'replaced') {
        lines.push({ ...base, kind: 'replaced', why: st.why, points: 0 });
        continue;
      }
      if (st.status === 'unknown') {
        lines.push({ ...base, kind: 'unknown', why: st.why, points: 0 });
        continue;
      }
      if (st.status === 'off') {
        lines.push({ ...base, kind: 'off', why: st.why, points: -1 });
        continue;
      }
      // Step 6: entries the kits say do not stack count once.
      if (e.noStack) {
        const first = seenNoStack.get(e.noStack);
        if (first) {
          lines.push({ ...base, kind: 'duplicate', why: `does not stack with ${first}`, points: -1 });
          continue;
        }
        seenNoStack.set(e.noStack, `${name(who)}'s ${e.tag}`);
      }
      if (who === dd) {
        // Only an ability that helps the damage dealer counts as "theirs switched on" (decision 28).
        if (e.on && (e.to === 'teammate' || e.to === 'previous' || e.to === 'next')) {
          lines.push({ ...base, kind: 'not-counted', why: `${st.why}, but it goes to a teammate, not to ${name(dd)}`, points: 0 });
          continue;
        }
        if (e.on) {
          // Who switches it on: each teammate who would meet the condition alone.
          const helpers = order.filter((id) => id !== dd && evalCondition(e.on, dd, [dd, id], lib) === 'met');
          for (const id of helpers) contributed.add(id);
          lines.push({ ...base, kind: 'switched-on', why: `${st.why}${helpers.length ? ` (${helpers.map(name).join(' and ')})` : ''}`, points: 1, helpers });
        }
        continue;
      }
      // Step 5: chains.
      if (e.causes) {
        const c = e.causes;
        if (c.whose === 'unsaid') {
          lines.push({ ...base, kind: 'possible', why: `a ${eventWord(c.event)}, but the text does not say whose`, points: 0 });
        } else {
          const target = c.whose === 'previous' ? before(order, who) : c.whose === 'next' ? after(order, who) : dd;
          const reaction = ddSheet?.entries.find((x) => [x.reacts].flat().includes(c.event) && statuses.get(key(dd, x))?.status === 'on');
          if (target !== dd) lines.push({ ...base, kind: 'not-counted', why: `the ${eventWord(c.event)} goes to ${name(target)}, not ${name(dd)}`, points: 0 });
          else if (!reaction) lines.push({ ...base, kind: 'not-counted', why: `${name(dd)}'s kit has nothing switched on that reacts to a ${eventWord(c.event)}`, points: 0 });
          else {
            contributed.add(who);
            lines.push({ ...base, kind: 'chain', why: `${eventWord(c.event)} for ${name(dd)}: ${reaction.tag}`, points: 1 });
          }
        }
        if (!e.gives.length) continue;
      }
      if (!e.gives.length) continue;
      const r = reach(e, who, dd, order, lib);
      if (r.kind === 'buff') {
        contributed.add(who);
        lines.push({ ...base, kind: 'buff', why: r.why, points: 1 });
      } else if (r.kind === 'support') lines.push({ ...base, kind: 'support', why: r.why, points: 0 });
      else lines.push({ ...base, kind: 'not-counted', why: r.why, points: 0 });
    }
  }

  // Step 7: weak fits for Rupture, Armorer and Anomaly damage dealers.
  const spec = lib.profiles.get(dd)?.specialty;
  if (spec === 'rupture' || spec === 'armorer' || spec === 'anomaly') {
    for (const who of order) {
      if (who === dd || contributed.has(who)) continue;
      lines.push({ kind: 'weak-fit', who, tag: 'Weak fit', why: `${name(who)} brings nothing made for ${name(dd)}`, points: -1 });
    }
  }

  const count = lines.reduce((n, l) => n + l.points, 0);
  return { order, dd, count, support: lines.filter((l) => l.kind === 'support').length, chains: lines.filter((l) => l.kind === 'chain').length, lines };
}

export const eventWord = (e: string) => ({ 'quick-assist': 'Quick Assist', 'chain-attack': 'Chain Attack', ultimate: 'Ultimate', 'ether-veil': 'Ether Veil' })[e] ?? e;

/** Ties: higher count, then more team support, then more chains. Positive = a is better. */
export const compare = (a: SquadResult, b: SquadResult) => a.count - b.count || a.support - b.support || a.chains - b.chains;

/**
 * The whole check (Part B steps 1–9): pick the damage dealer, try both orders,
 * keep the better. `dd` forces a damage dealer (Line-ups, If you pull).
 */
export function checkSquad(members: string[], lib: Library, account: Account, dd?: string): CheckOutcome {
  const unread = members.filter((id) => !lib.sheets.has(id));
  if (unread.length) return { rated: false, why: `not rated yet: ${unread.map((id) => lib.names.get(id) ?? id).join(', ')} not read yet`, unread };
  const dds = dd ? [dd] : damageDealers(members, lib);
  if (!dds.length) return { rated: false, why: 'no damage dealer (Attack, Rupture, Armorer or Anomaly) in this squad' };
  let best: SquadResult | undefined;
  let other: SquadResult | undefined;
  for (const d of dds) {
    const rest = members.filter((id) => id !== d);
    const orders = rest.length === 2 ? [[d, rest[0] ?? '', rest[1] ?? ''], [d, rest[1] ?? '', rest[0] ?? '']] : [[d, ...rest]];
    for (const o of orders) {
      const r = checkOrder(o, d, lib, account);
      if (!best || compare(r, best) > 0) {
        if (best && best.dd === d) other = best;
        best = r;
      } else if (best.dd === d && (!other || compare(r, other) > 0)) other = r;
    }
  }
  return best ? { rated: true, best, ...(other ? { other } : {}) } : { rated: false, why: 'nothing to check' };
}
