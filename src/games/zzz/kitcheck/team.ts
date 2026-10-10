/**
 * Everything ZZZ builds on the check (docs/logic/zzz-method.md): synergy % on
 * presets, Line-ups, Who fits and "If you pull…" %. Decisions the method leaves
 * open are written down in docs/logic/zzz-decisions.md.
 */
import type { FitSuggestion, PullValue, TeamAccount, TeamIdea, TeamReason, TeamRules, TeamVerdict } from '../../../core/contract';
import { checkSquad, compare, DD_ORDER, type Account, type Library, type Line, type SquadResult } from './check';
import { library } from './library';

export const METHOD = 'ZZZ Kit Check method (docs/logic/zzz-method.md)';
/** Partners kept per damage dealer before trios are tried, once the pool is bigger than this (method: Line-ups step 2). */
const PAIR_LIMIT = 10;

const toAccount = (a: TeamAccount): Account => ({ mindscape: (id) => (a.owned(id) ? a.dupes(id) : 0), potential: (id) => a.potential?.(id) });

export function synergyLabel(percent: number, members: number): string {
  if (members < 3) return 'Incomplete';
  return percent >= 85 ? 'Excellent' : percent >= 65 ? 'Good' : percent >= 45 ? 'Partly' : 'Weak';
}

const isDamageDealer = (id: string, lib: Library) => DD_ORDER.includes(lib.profiles.get(id)?.specialty ?? 'support');

/** The best squad the check finds for one damage dealer from a pool of characters (both orders tried). */
export function bestFor(dd: string, pool: string[], lib: Library, account: Account): SquadResult | undefined {
  let partners = pool.filter((id) => id !== dd && lib.sheets.has(id));
  if (!lib.sheets.has(dd) || !partners.length) return undefined;
  if (partners.length > PAIR_LIMIT) {
    const pairs = partners.map((p) => {
      const out = checkSquad([dd, p], lib, account, dd);
      return { p, r: out.rated ? out.best : undefined };
    });
    pairs.sort((a, b) => (b.r && a.r ? compare(b.r, a.r) : b.r ? 1 : -1));
    partners = pairs.slice(0, PAIR_LIMIT).map((x) => x.p);
  }
  let best: SquadResult | undefined;
  const tryOne = (members: string[]) => {
    const out = checkSquad(members, lib, account, dd);
    if (out.rated && (!best || compare(out.best, best) > 0)) best = out.best;
  };
  if (partners.length === 1) tryOne([dd, partners[0] ?? '']);
  for (let i = 0; i < partners.length; i++) for (let j = i + 1; j < partners.length; j++) tryOne([dd, partners[i] ?? '', partners[j] ?? '']);
  return best;
}

const ownedRead = (a: TeamAccount, lib: Library) => [...lib.sheets.keys()].filter((id) => a.owned(id));

function reasonOf(l: Line, lib: Library): TeamReason {
  const name = (id: string) => lib.names.get(id) ?? id;
  const group: TeamReason['group'] = l.kind === 'support' ? 'tie-break' : l.points !== 0 ? 'counted' : 'not-counted';
  const proof = l.piece && l.quote ? { who: name(l.who), skill: lib.pieceLabels.get(l.who)?.get(l.piece) ?? l.piece, quote: l.quote } : undefined;
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
  const out = checkSquad(members, lib, account);
  if (!out.rated) return { rated: false, why: out.why };
  const mine = out.best;
  const owned = ownedRead(a, lib);
  const notes: string[] = [];
  let pool: string[];
  if (owned.length < 3) {
    pool = [...lib.sheets.keys()];
    notes.push('You own fewer than three agents whose kits have been read, so this compares with every agent instead.');
  } else pool = [...new Set([...owned, ...members])];
  const best = bestFor(mine.dd, pool, lib, account);
  const top = best && compare(best, mine) > 0 ? best : mine;
  if (top.count <= 0) return { rated: false, why: `No squad the check can find connects for ${name(mine.dd)} yet (best count ${top.count}).` };
  const percent = Math.max(0, Math.round((mine.count / top.count) * 100));
  if (percent >= 100) notes.push(`100% means the check knows no better squad for ${name(mine.dd)} from your agents.`);
  else notes.push(`Best for ${name(mine.dd)} from your agents: ${top.order.map(name).join(' > ')} counts ${top.count}.`);
  const every = bestFor(mine.dd, [...lib.sheets.keys()], lib, account);
  if (every && every.count > top.count) notes.push(`From every agent, ${every.order.map(name).join(' > ')} counts ${every.count}.`);
  if (out.other && out.other.count !== mine.count) notes.push(`The other order, ${out.other.order.map(name).join(' > ')}, counts ${out.other.count}.`);
  notes.push('A higher count means more of the kits connect, not more damage.');
  return {
    rated: true,
    percent,
    label: synergyLabel(percent, members.length),
    count: mine.count,
    best: top.count,
    bestMembers: top.order,
    order: mine.order,
    reasons: mine.lines.map((l) => reasonOf(l, lib)),
    notes: [summary(mine), ...notes],
  };
}

/** How a candidate connects in a checked squad, in words; empty = not at all. */
function connections(r: SquadResult, c: string, lib: Library): string[] {
  const name = (id: string) => lib.names.get(id) ?? id;
  const piece = (who: string, p?: string) => (p ? (lib.pieceLabels.get(who)?.get(p) ?? p) : '');
  const how: string[] = [];
  for (const l of r.lines) {
    if (l.kind === 'switched-on' && (l.helpers?.includes(c) || (r.dd === c && l.helpers?.length))) how.push(`turns on ${name(r.dd)}'s ${piece(r.dd, l.piece)}`);
    else if (l.kind === 'buff' && (l.who === c || r.dd === c)) how.push(`${l.tag} for ${name(r.dd)} (from ${name(l.who)})`);
    else if (l.kind === 'chain' && (l.who === c || r.dd === c)) how.push(`${l.why} (from ${name(l.who)})`);
    else if (l.kind === 'support' && l.who === c) how.push(`team support: ${l.tag}`);
  }
  return [...new Set(how)];
}

export function whoFits(members: string[], a: TeamAccount, lib: Library = library()): FitSuggestion[] {
  const account = toAccount(a);
  const out: FitSuggestion[] = [];
  for (const c of lib.sheets.keys()) {
    if (members.includes(c)) continue;
    const res = checkSquad([...members, c], lib, account);
    if (!res.rated) continue;
    const r = res.best;
    if (r.lines.some((l) => l.kind === 'weak-fit' && l.who === c)) continue;
    const how = connections(r, c, lib);
    if (!how.length) continue;
    const others = members.filter((m) => m !== r.dd);
    const withEveryone = c === r.dd ? others.every((m) => r.lines.some((l) => l.who === m && (l.kind === 'buff' || l.kind === 'chain'))) : r.lines.some((l) => l.who === c && (l.kind === 'buff' || l.kind === 'chain'));
    out.push({ id: c, count: r.count, how, withEveryone });
  }
  return out.sort((x, y) => Number(y.withEveryone) - Number(x.withEveryone) || y.count - x.count);
}

export function lineUps(a: TeamAccount, lib: Library = library()): TeamIdea[] {
  const name = (id: string) => lib.names.get(id) ?? id;
  const account = toAccount(a);
  const owned = ownedRead(a, lib);
  const candidates: SquadResult[] = [];
  for (const dd of owned.filter((id) => isDamageDealer(id, lib))) {
    const pool = owned.filter((id) => id !== dd);
    let partners = pool;
    if (partners.length > PAIR_LIMIT) {
      partners = partners
        .map((p) => ({ p, r: checkSquad([dd, p], lib, account, dd) }))
        .sort((x, y) => (x.r.rated && y.r.rated ? compare(y.r.best, x.r.best) : y.r.rated ? 1 : -1))
        .slice(0, PAIR_LIMIT)
        .map((x) => x.p);
    }
    const mine: SquadResult[] = [];
    for (let i = 0; i < partners.length; i++)
      for (let j = i + 1; j < partners.length; j++) {
        const out = checkSquad([dd, partners[i] ?? '', partners[j] ?? ''], lib, account, dd);
        if (out.rated && out.best.count > 0) mine.push(out.best);
      }
    candidates.push(...mine.sort((x, y) => compare(y, x)).slice(0, 5));
  }
  // The set of teams that never share a character with the highest total count; more teams break a tie.
  let best: SquadResult[] = [];
  const total = (xs: SquadResult[]) => xs.reduce((n, x) => n + x.count, 0);
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
  return best.map((r) => ({ members: r.order, count: r.count, why: `${r.order.map(name).join(' > ')} counts ${r.count}: ${summary(r)}` }));
}

export function ifYouPull(id: string, a: TeamAccount, lib: Library = library()): PullValue | null {
  if (!lib.sheets.has(id)) return null;
  const name = (x: string) => lib.names.get(x) ?? x;
  // A character you don't own is tested at M0 (toAccount gives 0 for anyone not owned).
  const account = toAccount(a);
  const all = [...lib.sheets.keys()];
  const base = ownedRead(a, lib).filter((x) => x !== id);
  const why: string[] = [];
  let percent = 0;
  if (isDamageDealer(id, lib)) {
    const withYours = bestFor(id, [...base, id], lib, account);
    const withAll = bestFor(id, all, lib, account);
    if (withYours && withAll && withAll.count > 0) {
      const p = Math.max(0, Math.round((withYours.count / withAll.count) * 100));
      why.push(`As a damage dealer: ${withYours.order.map(name).join(' > ')} counts ${withYours.count} from your agents, against ${withAll.count} with every agent (${p}%).`);
      percent = Math.max(percent, p);
    }
  }
  for (const dd of base.filter((x) => isDamageDealer(x, lib))) {
    const now = bestFor(dd, base, lib, account);
    const lifted = bestFor(dd, [...base, id], lib, account);
    const possible = bestFor(dd, all, lib, account);
    if (!lifted || !possible || possible.count <= 0 || !lifted.order.includes(id)) continue;
    if (lifted.count > (now?.count ?? 0)) {
      const p = Math.round((lifted.count / possible.count) * 100);
      why.push(`As a teammate: ${name(dd)} goes from ${now?.count ?? 0} to ${lifted.count} (${lifted.order.map(name).join(' > ')}); ${name(dd)}'s best possible is ${possible.count} (${p}%).`);
      percent = Math.max(percent, p);
    }
  }
  if (!why.length) why.push('No gain: no team of yours gets a higher count with them.');
  return { percent, why };
}

export const zzzTeamRules: TeamRules = {
  method: METHOD,
  rated: (id) => library().sheets.has(id),
  verdict: (m, a) => verdict(m, a),
  whoFits: (m, a) => whoFits(m, a),
  lineUps: (a) => lineUps(a),
  ifYouPull: (id, a) => ifYouPull(id, a),
};
