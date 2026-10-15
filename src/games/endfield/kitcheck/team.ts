/**
 * Everything Endfield builds on the check (docs/logic/endfield-method.md): synergy % on teams, Line-ups,
 * Who fits and "If you pull…" %. Mirrors the ZZZ team rules (src/games/zzz/kitcheck/team.ts) for teams of 4
 * with no order; builds and weapons aren't read for Endfield yet.
 */
import { bestFill, withOwnerLists } from '../../../core/rules/fillTeam';
import { bestFoundCards, cachedCards } from '../../../core/rules/bestCards';
import type { FitOptions, FitSuggestion, PullValue, TeamAccount, TeamIdea, TeamPreset, TeamReason, TeamRules, TeamVerdict } from '../../../core/contract';
import { accountNotes } from '../../../core/rules/accountNotes';
import { explainTeam, memberPhrase } from '../../../core/rules/teamExplain';
import { countWords, percentOf, timesWords, typicalNote, VALUE_NOTE } from '../../../core/rules/kitValue';
import { usable } from '../../../core/rules/leaks';
import { checkSquad, compare, isDamageDealer, labelOf, type Account, type Library, type Line, type SquadResult } from './check';
import { library } from './library';

export const METHOD = 'Endfield Kit Check method (docs/logic/endfield-method.md)';
/** A team is 4 operators. */
const SIZE = 4;
/** Partners kept per damage dealer before teams are tried, once the pool is bigger than this. */
const PAIR_LIMIT = 9;

const toAccount = (a: TeamAccount): Account => ({ potential: (id) => (a.owned(id) ? a.dupes(id) : 0) });

/** Kits read so far, of every operator. */
export const readSoFar = (lib: Library = library()) => ({ read: lib.sheets.size, total: lib.names.size });

/** The grade word; none while only some kits are read (the best among a few is not "Excellent"), the % stays. */
export function synergyLabel(percent: number, members: number, partial = false): string {
  if (members < SIZE) return 'Incomplete';
  if (partial) return '';
  return percent >= 85 ? 'Excellent' : percent >= 65 ? 'Good' : percent >= 45 ? 'Partly' : 'Weak';
}

/** Every way to pick `k` of the list. */
function choose<T>(xs: T[], k: number): T[][] {
  if (k === 0) return [[]];
  return xs.flatMap((x, i) => choose(xs.slice(i + 1), k - 1).map((rest) => [x, ...rest]));
}

const bestCache = new Map<string, SquadResult | undefined>();
let cacheLib: Library | undefined;

/** The best team the check finds for one damage dealer from a pool of operators (same answer kept per pool). */
export function bestFor(dd: string, pool: string[], lib: Library, account: Account, needSustain = false): SquadResult | undefined {
  if (cacheLib !== lib) {
    bestCache.clear();
    cacheLib = lib;
  }
  const key = `${dd}|${[...new Set(pool)].sort().map((id) => `${id}:${account.potential(id)}`).join(',')}|${account.potential(dd)}|${needSustain ? 'sustain' : ''}`;
  if (bestCache.has(key)) return bestCache.get(key);
  if (bestCache.size > 2000) bestCache.clear();
  let partners = pool.filter((id) => id !== dd && lib.sheets.has(id));
  let best: SquadResult | undefined;
  if (lib.sheets.has(dd) && partners.length) {
    if (partners.length > PAIR_LIMIT) {
      const pairs = partners.map((p) => ({ p, r: checkSquad([dd, p], lib, account, dd) }));
      pairs.sort((a, b) => (a.r.rated && b.r.rated ? compare(b.r.best, a.r.best) : b.r.rated ? 1 : -1));
      partners = pairs.slice(0, PAIR_LIMIT).map((x) => x.p);
    }
    for (const rest of choose(partners, Math.min(SIZE - 1, partners.length))) {
      const out = checkSquad([dd, ...rest], lib, account, dd);
      if (out.rated && (!needSustain || out.best.sustain) && (!best || compare(out.best, best) > 0)) best = out.best;
    }
  }
  bestCache.set(key, best);
  return best;
}

const asExplain = (r: SquadResult) => ({ members: r.order, dd: r.dd, count: r.count, value: r.value, lines: r.lines });

/** Everyone the check may use: no one the owner hid. */
const readable = (lib: Library, a: TeamAccount) => usable(lib.sheets.keys(), a, lib.leaks);
const ownedRead = (a: TeamAccount, lib: Library) => readable(lib, a).filter((id) => a.owned(id));

function reasonOf(l: Line, lib: Library): TeamReason {
  const name = (id: string) => lib.names.get(id) ?? id;
  const group: TeamReason['group'] = l.kind === 'support' ? 'tie-break' : l.points !== 0 ? 'counted' : 'not-counted';
  const proof = l.piece && l.quote ? { who: name(l.who), skill: labelOf(lib, l.who, l.piece), quote: l.quote } : undefined;
  return { points: l.points, group, text: `${name(l.who)} · ${l.tag}: ${l.why}`, ...(proof ? { proof } : {}) };
}

export function summary(r: SquadResult): string {
  const n = (kind: Line['kind']) => r.lines.filter((l) => l.kind === kind).length;
  const parts = [`${n('buff')} buffs reach the damage dealer`, `${n('switched-on')} of their abilities switched on`, `${n('chain')} chains`];
  const minus = n('off') + n('duplicate') + n('weak-fit');
  return `${parts.join(', ')}${minus ? `, −${minus} (off, duplicates, weak fits)` : ''}`;
}

export function verdict(members: string[], a: TeamAccount, lib: Library = library()): TeamVerdict {
  const name = (id: string) => lib.names.get(id) ?? id;
  const account = toAccount(a);
  // A team's first member is its damage dealer when they can be one; otherwise every damage dealer is tried.
  const lead = members[0] && isDamageDealer(members[0], lib) ? members[0] : undefined;
  const out = checkSquad(members, lib, account, lead);
  if (!out.rated) return { rated: false, why: out.why };
  const mine = out.best;
  const owned = ownedRead(a, lib);
  const notes: string[] = [];
  let pool: string[];
  if (owned.length < SIZE) {
    pool = readable(lib, a);
    notes.push('You own fewer than four operators whose kits have been read, so this compares with every operator instead.');
  } else pool = [...new Set([...owned, ...members])];
  const best = bestFor(mine.dd, pool, lib, account, mine.sustain);
  if (mine.sustain) notes.push('This team has a healer or shields, so the best team found keeps one too.');
  const top = best && compare(best, mine) > 0 ? best : mine;
  if (top.value <= 0 && top.count <= 0) return { rated: false, why: `No team the check can find connects for ${name(mine.dd)} yet (best ${countWords(top)}).` };
  const percent = Math.max(0, percentOf(mine.value, top.value));
  if (percent >= 100) notes.push(`100% means the check knows no better team for ${name(mine.dd)} from your operators.`);
  else notes.push(`Best for ${name(mine.dd)} from your operators: ${top.order.map(name).join(', ')} counts ${countWords(top)}.`);
  const every = bestFor(mine.dd, readable(lib, a), lib, account, mine.sustain);
  if (every && every.value > top.value) notes.push(`From every operator, ${every.order.map(name).join(', ')} counts ${countWords(every)}.`);
  if (out.other) notes.push(`With ${name(out.other.dd)} as the damage dealer instead, it counts ${countWords(out.other)}.`);
  const n = readSoFar(lib);
  if (n.read < n.total) notes.push(`Only ${n.read} of ${n.total} operators are read so far: this is the best among those, and it will change as more are read.`);
  notes.push(VALUE_NOTE);
  const typical = typicalNote(mine.lines, name);
  if (typical) notes.push(typical);
  return {
    rated: true,
    percent,
    label: synergyLabel(percent, members.length, n.read < n.total),
    count: mine.count,
    best: top.count,
    bestMembers: top.order,
    order: mine.order,
    reasons: mine.lines.map((l) => reasonOf(l, lib)),
    explain: explainTeam(asExplain(mine), asExplain(top), name),
    notes: [summary(mine), ...notes],
  };
}

/** How a candidate connects in a checked team, in words; empty = not at all. */
function connections(r: SquadResult, c: string, lib: Library): string[] {
  const name = (id: string) => lib.names.get(id) ?? id;
  const how: string[] = [];
  for (const l of r.lines) {
    if (l.kind === 'switched-on' && (l.helpers?.includes(c) || (r.dd === c && l.helpers?.length))) how.push(`turns on ${name(r.dd)}'s ${l.piece ? labelOf(lib, r.dd, l.piece) : l.tag}`);
    else if (l.kind === 'buff' && (l.who === c || r.dd === c)) how.push(`${l.tag} for ${name(r.dd)} (from ${name(l.who)})`);
    else if (l.kind === 'chain' && (l.who === c || r.dd === c)) how.push(`${l.why} (from ${name(l.who)})`);
    else if (l.kind === 'support' && l.who === c) how.push(`team support: ${l.tag}`);
  }
  return [...new Set(how)];
}

export function whoFits(members: string[], a: TeamAccount, lib: Library = library(), options: FitOptions = {}): FitSuggestion[] {
  const account = toAccount(a);
  const out: FitSuggestion[] = [];
  const pool = readable(lib, a).filter((c) => options.includeUnowned || a.owned(c));
  for (const c of pool) {
    if (members.includes(c)) continue;
    const res = checkSquad([...members, c], lib, account);
    if (!res.rated) continue;
    const r = res.best;
    if (r.lines.some((l) => l.kind === 'weak-fit' && l.who === c)) continue;
    const how = connections(r, c, lib);
    if (!how.length) continue;
    const others = members.filter((m) => m !== r.dd);
    const withEveryone = c === r.dd ? others.every((m) => r.lines.some((l) => l.who === m && (l.kind === 'buff' || l.kind === 'chain'))) : r.lines.some((l) => l.who === c && (l.kind === 'buff' || l.kind === 'chain'));
    const best = bestFor(r.dd, [...new Set([...pool, ...members])], lib, account, r.sustain);
    const top = best && compare(best, r) > 0 ? best.value : r.value;
    const percent = top > 0 ? Math.max(0, percentOf(r.value, top)) : 0;
    const locked = r.lines.filter((l) => l.who === c && l.kind === 'locked').length;
    const { notes, theory } = accountNotes(c, a, { dupePrefix: 'P', locked });
    out.push({ id: c, count: r.count, how, withEveryone, percent, fromAccount: notes, theory });
  }
  return out.sort((x, y) => (y.percent ?? 0) - (x.percent ?? 0) || Number(y.withEveryone) - Number(x.withEveryone) || y.count - x.count);
}

export function lineUps(a: TeamAccount, lib: Library = library()): TeamIdea[] {
  const name = (id: string) => lib.names.get(id) ?? id;
  const account = toAccount(a);
  const owned = ownedRead(a, lib);
  const candidates: SquadResult[] = [];
  for (const dd of owned.filter((id) => isDamageDealer(id, lib))) {
    const found = bestFor(dd, owned, lib, account);
    if (found && found.value > 0) candidates.push(found);
  }
  // The set of teams that never share an operator with the highest total kit value; more teams break a tie.
  let best: SquadResult[] = [];
  const total = (xs: SquadResult[]) => xs.reduce((n, x) => n + x.value, 0);
  const search = (i: number, used: Set<string>, picked: SquadResult[]) => {
    if (total(picked) > total(best) || (total(picked) === total(best) && picked.length > best.length)) best = [...picked];
    for (let k = i; k < candidates.length; k++) {
      const c = candidates[k];
      if (!c || c.order.some((id) => used.has(id))) continue;
      const next = new Set(used);
      for (const id of c.order) next.add(id);
      search(k + 1, next, [...picked, c]);
    }
  };
  search(0, new Set(), []);
  return best.map((r) => ({ members: r.order, count: r.count, why: `${r.order.map(name).join(', ')} counts ${countWords(r)}: ${summary(r)}` }));
}

export function ifYouPull(id: string, a: TeamAccount, lib: Library = library()): PullValue | null {
  if (!lib.sheets.has(id)) return null;
  const name = (x: string) => lib.names.get(x) ?? x;
  // An operator you don't own is tested at Potential 0.
  const account = toAccount(a);
  const all = [...new Set([...readable(lib, a), id])];
  const base = ownedRead(a, lib).filter((x) => x !== id);
  const why: string[] = [];
  let percent = 0;
  if (isDamageDealer(id, lib)) {
    const withYours = bestFor(id, [...base, id], lib, account);
    const withAll = bestFor(id, all, lib, account);
    if (withYours && withAll && withAll.value > 0) {
      const p = Math.max(0, percentOf(withYours.value, withAll.value));
      why.push(`As a damage dealer: your best team for them is ${withYours.order.map(name).join(', ')} (${countWords(withYours)}; the best with every operator is ${countWords(withAll)}, so ${p}%). There ${memberPhrase(asExplain(withYours), id, name)}.`);
      percent = Math.max(percent, p);
    }
  }
  for (const dd of base.filter((x) => isDamageDealer(x, lib))) {
    const now = bestFor(dd, base, lib, account);
    const lifted = bestFor(dd, [...base, id], lib, account);
    const possible = bestFor(dd, all, lib, account);
    if (!lifted || !possible || possible.value <= 0 || !lifted.order.includes(id)) continue;
    if (lifted.value > (now?.value ?? 0)) {
      const p = percentOf(lifted.value, possible.value);
      why.push(`As a teammate: ${name(dd)}'s best team of yours goes from ${now ? countWords(now) : '0'} to ${countWords(lifted)} (${lifted.order.map(name).join(', ')}; the most possible is ${countWords(possible)}, so ${p}%). ${name(id)} ${memberPhrase(asExplain(lifted), id, name)}.`);
      percent = Math.max(percent, p);
    }
  }
  if (!why.length) why.push('No gain: no team of yours gets a higher kit value with them.');
  return { percent, why };
}

/** A "Best found from your operators" card when every team shown for a damage dealer stays under 90% (T41). */
export function bestCards(presets: TeamPreset[], a: TeamAccount, lib: Library = library()): TeamPreset[] {
  const owned = ownedRead(a, lib);
  if (owned.length < SIZE) return [];
  const account = toAccount(a);
  const cards = presets.flatMap((p) => {
    const members = endfieldTeamRules.fill?.(p, a) ?? [];
    const lead = members[0] && isDamageDealer(members[0], lib) ? members[0] : undefined;
    const out = members.length ? checkSquad(members, lib, account, lead) : undefined;
    if (!out?.rated || !a.owned(out.best.dd)) return [];
    const v = verdict(members, a, lib);
    return v.rated ? [{ dd: out.best.dd, members, percent: v.percent }] : [];
  });
  const found = (dd: string) => {
    const members = bestFor(dd, owned, lib, account)?.order;
    const v = members ? verdict(members, a, lib) : undefined;
    return members && v?.rated ? { members, percent: v.percent } : undefined;
  };
  return bestFoundCards(cards, found, (id) => lib.names.get(id) ?? id, SIZE);
}

export const endfieldTeamRules: TeamRules = {
  method: METHOD,
  fill: (p, a) => {
    const lib = library();
    const account = toAccount(a);
    return bestFill(withOwnerLists(p, a), a, (_team, id) => !a.skip?.(id), (team, dd) => {
      const lead = dd ?? (team[0] && isDamageDealer(team[0], lib) ? team[0] : undefined);
      const out = checkSquad(team, lib, account, lead);
      return out.rated ? { value: out.best.value, dd: out.best.dd } : undefined;
    });
  },
  rated: (id) => library().sheets.has(id),
  readSoFar: () => readSoFar(),
  verdict: (m, a) => verdict(m, a),
  whoFits: (m, a, o) => whoFits(m, a, library(), o),
  lineUps: (a) => lineUps(a),
  ifYouPull: (id, a) => ifYouPull(id, a),
  bestCards: (ps, a) => cachedCards('endfield', ps, readable(library(), a).filter((id) => a.owned(id)), a, () => bestCards(ps, a)),
};

/** Recommended teams from the check: for every damage dealer read, the best team from every operator at Potential 0. */
export function recommendedTeams(lib: Library = library()): TeamPreset[] {
  const name = (id: string) => lib.names.get(id) ?? id;
  const p0: Account = { potential: () => 0 };
  const all = [...lib.sheets.keys()];
  const out: TeamPreset[] = [];
  for (const dd of all.filter((id) => isDamageDealer(id, lib))) {
    const first = bestFor(dd, all, lib, p0);
    if (!first || first.count <= 0) continue;
    out.push({
      id: `kit-check-${dd}`,
      name: `${name(dd)} · best by kit check`,
      slots: first.order.map((id) => ({ characters: [id] })),
      source: `${METHOD}: the best kit value for ${name(dd)} from every operator read so far, at Potential 0: count ${first.count}, ${timesWords(first.value)}`,
    });
  }
  return out;
}
