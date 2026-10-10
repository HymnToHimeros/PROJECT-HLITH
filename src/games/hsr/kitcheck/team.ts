/**
 * Everything HSR builds on the check (docs/logic/hsr-theory.md): synergy % on
 * teams, Line-ups, Who fits, "If you pull…" % and recommended teams. Same
 * shape as ZZZ (src/games/zzz/kitcheck/team.ts), with teams of four and no order.
 */
import type { FitOptions, FitSuggestion, PullValue, TeamAccount, TeamIdea, TeamPreset, TeamReason, TeamRules, TeamVerdict } from '../../../core/contract';
import { canCarry, canPartner, check, compare, damageDealers, isCentre, type Account, type Library, type Line, type TeamResult } from './check';
import { centreOf, library, pageOf } from './library';
import { accountNotes } from '../../../core/rules/accountNotes';
import { SIGNATURE_PIECE } from '../../../core/rules/signatureWeapons';
import { explainTeam, memberPhrase } from '../../../core/rules/teamExplain';

export const METHOD = 'HSR Kit Check theory v2 (docs/logic/hsr-theory.md)';
/** Partners kept per damage dealer before teams of four are tried, once the pool is bigger than this. */
const PAIR_LIMIT = 10;
const SIZE = 4;

const toAccount = (a: TeamAccount): Account => ({ eidolon: (id) => (a.owned(id) ? a.dupes(id) : 0), enhanced: (id) => a.potential?.(id), weapon: (id) => (a.owned(id) ? a.weapon?.(id) : undefined) });

/** The Trailblazer is one character: at most one of their forms (ids 8001–8010) in a team. */
const isTrailblazer = (id: string) => id.startsWith('80') && id.length === 4;
const fits = (team: string[]) => team.filter(isTrailblazer).length <= 1;

export function synergyLabel(percent: number, members: number): string {
  if (members < SIZE) return 'Incomplete';
  return percent >= 85 ? 'Excellent' : percent >= 65 ? 'Good' : percent >= 45 ? 'Partly' : 'Weak';
}

function combos(xs: string[], k: number): string[][] {
  if (k === 0) return [[]];
  const out: string[][] = [];
  xs.forEach((x, i) => {
    for (const rest of combos(xs.slice(i + 1), k - 1)) out.push([x, ...rest]);
  });
  return out;
}

/** The best team the check finds for one damage dealer from a pool of characters. */
/** Same question, same answer: bestFor is asked the same thing by every team on a screen, so answers are kept (keyed by the pool and its levels). */
const bestCache = new Map<string, TeamResult | undefined>();
let cacheLib: Library | undefined;

export function bestFor(dd: string, pool: string[], lib: Library, account: Account): TeamResult | undefined {
  if (cacheLib !== lib) {
    bestCache.clear();
    cacheLib = lib;
  }
  const key = `${dd}|${[...new Set(pool)].sort().map((id) => `${id}:${account.eidolon(id)}:${account.enhanced(id) ?? '-'}`).join(',')}|${account.eidolon(dd)}:${account.enhanced(dd) ?? '-'}`;
  if (bestCache.has(key)) return bestCache.get(key);
  if (bestCache.size > 2000) bestCache.clear();
  const found = findBest(dd, pool, lib, account);
  bestCache.set(key, found);
  return found;
}

/**
 * A big pool is cut to the partners worth trying: the PAIR_LIMIT best by count
 * beside the damage dealer, plus the SUSTAIN_LIMIT best who bring sustain (so
 * the best team can always have one).
 */
const SUSTAIN_LIMIT = 3;
function shortlist(dd: string, partners: string[], lib: Library, account: Account): string[] {
  if (partners.length <= PAIR_LIMIT) return partners;
  const solo = check([dd], lib, account, dd);
  const alone = solo.rated && solo.best.sustain;
  const pairs = partners
    .map((p) => {
      const out = check([dd, p], lib, account, dd);
      return { p, r: out.rated ? out.best : undefined };
    })
    .filter((x): x is { p: string; r: TeamResult } => !!x.r)
    .sort((a, b) => b.r.count - a.r.count || b.r.support - a.r.support || b.r.chains - a.r.chains);
  const top = pairs.slice(0, PAIR_LIMIT).map((x) => x.p);
  const sustain = alone ? [] : pairs.filter((x) => x.r.sustain && !top.includes(x.p)).slice(0, SUSTAIN_LIMIT).map((x) => x.p);
  return [...top, ...sustain];
}

function findBest(dd: string, pool: string[], lib: Library, account: Account): TeamResult | undefined {
  let partners = pool.filter((id) => id !== dd && lib.sheets.has(id) && fits([dd, id]) && canPartner(id, dd, lib));
  if (!lib.sheets.has(dd) || !canCarry(dd, lib) || !partners.length) return undefined;
  partners = shortlist(dd, partners, lib, account);
  let best: TeamResult | undefined;
  for (const others of combos(partners, Math.min(SIZE - 1, partners.length))) {
    if (!fits([dd, ...others])) continue;
    const out = check([dd, ...others], lib, account, dd);
    if (out.rated && (!best || compare(out.best, best) > 0)) best = out.best;
  }
  return best;
}

/** The first member leads when the check would pick them as the damage dealer. */
const leadOf = (members: string[], lib: Library) => (members[0] && damageDealers(members, lib).includes(members[0]) ? members[0] : undefined);
/** Characters to build teams around: the centres among them, or every carry when none is a centre. */
const centresIn = (ids: string[], lib: Library) => {
  const centres = ids.filter((id) => isCentre(id, lib));
  return centres.length ? centres : ids.filter((id) => canCarry(id, lib));
};

const asExplain = (r: TeamResult) => ({ members: r.members, dd: r.dd, count: r.count, lines: r.lines });

const ownedRead = (a: TeamAccount, lib: Library) => [...lib.sheets.keys()].filter((id) => a.owned(id));

function reasonOf(l: Line, lib: Library): TeamReason {
  const name = (id: string) => lib.names.get(id) ?? id;
  const group: TeamReason['group'] = l.kind === 'support' ? 'tie-break' : l.points !== 0 ? 'counted' : 'not-counted';
  const proof = l.piece && l.quote ? { who: name(l.who), skill: lib.pieceLabels.get(l.who)?.get(l.piece) ?? l.piece, quote: l.quote } : undefined;
  return { points: l.points, group, text: `${name(l.who)} · ${l.tag}: ${l.why}`, ...(proof ? { proof } : {}) };
}

export function summary(r: TeamResult): string {
  const n = (kind: Line['kind']) => r.lines.filter((l) => l.kind === kind).length;
  const parts = [`${n('buff')} buffs reach the damage dealer`, `${n('switched-on')} of their abilities switched on`, `${n('chain')} chains`];
  const minus = n('off') + n('duplicate') + n('weak-fit');
  return `${parts.join(', ')}${minus ? `, −${minus} (off, duplicates, weak fits)` : ''}${r.sustain ? '' : '; no sustain (no healer or shield)'}`;
}

const teamWords = (r: TeamResult, lib: Library) => {
  const name = (id: string) => lib.names.get(id) ?? id;
  return `${name(r.dd)} with ${r.members.filter((x) => x !== r.dd).map(name).join(', ')}`;
};

export function verdict(members: string[], a: TeamAccount, lib: Library = library()): TeamVerdict {
  const name = (id: string) => lib.names.get(id) ?? id;
  const account = toAccount(a);
  // A preset's first member is its damage dealer when they can carry; otherwise the check picks.
  // A team's first member is its damage dealer when the check would pick them (a centre, or a carry when no centre is in it).
  const lead = leadOf(members, lib);
  const out = check(members, lib, account, lead);
  if (!out.rated) return { rated: false, why: out.why };
  const mine = out.best;
  const owned = ownedRead(a, lib);
  const notes: string[] = [];
  let pool: string[];
  if (owned.length < SIZE) {
    pool = [...lib.sheets.keys()];
    notes.push('You own fewer than four characters whose kits have been read, so this compares with every character instead.');
  } else pool = [...new Set([...owned, ...members])];
  const best = bestFor(mine.dd, pool, lib, account);
  const top = best && compare(best, mine) > 0 ? best : mine;
  if (top.count <= 0) return { rated: false, why: `No team the check can find connects for ${name(mine.dd)} yet (best count ${top.count}).` };
  const percent = Math.max(0, Math.round((mine.count / top.count) * 100));
  if (!mine.sustain) notes.push('No sustain: nobody in this team heals or shields, and no Preservation or Abundance character.');
  if (percent >= 100) notes.push(`100% means the check knows no better team for ${name(mine.dd)} from your characters.`);
  else notes.push(`Best for ${name(mine.dd)} from your characters: ${teamWords(top, lib)} counts ${top.count}.`);
  const every = bestFor(mine.dd, [...lib.sheets.keys()], lib, account);
  if (every && every.count > top.count) notes.push(`From every character: ${teamWords(every, lib)} counts ${every.count}.`);
  if (out.other && !lead) notes.push(`With ${name(out.other.dd)} as the damage dealer it counts ${out.other.count}.`);
  notes.push('Traces count as unlocked. A higher count means more of the kits connect, not more damage.');
  const label = synergyLabel(percent, members.length);
  return {
    rated: true,
    percent,
    label: mine.sustain ? label : `${label} · no sustain`,
    count: mine.count,
    best: top.count,
    bestMembers: top.members,
    order: mine.members,
    unordered: true,
    reasons: mine.lines.map((l) => reasonOf(l, lib)),
    explain: explainTeam({ members: mine.members, dd: mine.dd, count: mine.count, lines: mine.lines }, { members: top.members, dd: top.dd, count: top.count, lines: top.lines }, name),
    notes: [summary(mine), ...notes],
  };
}

/** How a candidate connects in a checked team, in words; empty = not at all. */
function connections(r: TeamResult, c: string, lib: Library): string[] {
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

export function whoFits(members: string[], a: TeamAccount, lib: Library = library(), options: FitOptions = {}): FitSuggestion[] {
  const account = toAccount(a);
  const out: FitSuggestion[] = [];
  // Your own characters by default; the rest only when asked, as theory.
  const pool = [...lib.sheets.keys()].filter((c) => options.includeUnowned || a.owned(c));
  for (const c of pool) {
    if (members.includes(c) || !fits([...members, c])) continue;
    const res = check([...members, c], lib, account, leadOf([...members, c], lib));
    if (!res.rated) continue;
    const r = res.best;
    if (r.lines.some((l) => l.kind === 'weak-fit' && l.who === c)) continue;
    const how = connections(r, c, lib);
    if (!how.length) continue;
    const others = members.filter((m) => m !== r.dd);
    const withEveryone = c === r.dd ? others.every((m) => r.lines.some((l) => l.who === m && (l.kind === 'buff' || l.kind === 'chain'))) : r.lines.some((l) => l.who === c && (l.kind === 'buff' || l.kind === 'chain'));
    // % against the best team found for the same damage dealer from the same pool.
    const best = bestFor(r.dd, [...new Set([...pool, ...members])], lib, account);
    const top = best && compare(best, r) > 0 ? best.count : r.count;
    const percent = top > 0 ? Math.max(0, Math.round((r.count / top) * 100)) : 0;
    const hasTrack = [...(lib.unlocks.get(c)?.values() ?? [])].some((u) => u.potential || u.replacedAt);
    const locked = r.lines.filter((l) => l.who === c && l.kind === 'locked').length;
    const sigId = lib.unlocks.get(c)?.get(SIGNATURE_PIECE)?.weapon;
    const sigLabel = lib.pieceLabels.get(c)?.get(SIGNATURE_PIECE);
    const signature = sigId && sigLabel ? { id: sigId, name: sigLabel.replace(/^Signature [^:]+: /, '').replace(/ · .*$/, '') } : undefined;
    const { notes, theory } = accountNotes(c, a, { dupePrefix: 'E', ...(hasTrack ? { track: 'Enhanced kit' } : {}), locked, ...(signature ? { signature } : {}) });
    out.push({ id: c, count: r.count, how, withEveryone, percent, fromAccount: notes, theory });
  }
  return out.sort((x, y) => (y.percent ?? 0) - (x.percent ?? 0) || Number(y.withEveryone) - Number(x.withEveryone) || y.count - x.count);
}

export function lineUps(a: TeamAccount, lib: Library = library()): TeamIdea[] {
  const account = toAccount(a);
  const owned = ownedRead(a, lib);
  const candidates: TeamResult[] = [];
  for (const dd of centresIn(owned, lib)) {
    let partners = owned.filter((id) => id !== dd && fits([dd, id]) && canPartner(id, dd, lib));
    partners = shortlist(dd, partners, lib, account);
    const mine: TeamResult[] = [];
    for (const others of combos(partners, Math.min(SIZE - 1, partners.length))) {
      if (others.length < SIZE - 1 || !fits([dd, ...others])) continue;
      const out = check([dd, ...others], lib, account, dd);
      if (out.rated && out.best.count > 0) mine.push(out.best);
    }
    candidates.push(...mine.sort((x, y) => compare(y, x)).slice(0, 5));
  }
  // The set of teams that never share a character with the highest total count; more teams break a tie.
  let best: TeamResult[] = [];
  const total = (xs: TeamResult[]) => xs.reduce((n, x) => n + x.count, 0);
  const search = (i: number, used: Set<string>, picked: TeamResult[]) => {
    if (total(picked) > total(best) || (total(picked) === total(best) && picked.length > best.length)) best = [...picked];
    for (let k = i; k < candidates.length; k++) {
      const c = candidates[k];
      if (!c || c.members.some((id) => used.has(id) || (isTrailblazer(id) && [...used].some(isTrailblazer)))) continue;
      const next = new Set(used);
      for (const id of c.members) next.add(id);
      search(k + 1, next, [...picked, c]);
    }
  };
  search(0, new Set(), []);
  return best.map((r) => ({ members: r.members, count: r.count, why: `${teamWords(r, lib)} counts ${r.count}: ${summary(r)}` }));
}

export function ifYouPull(id: string, a: TeamAccount, lib: Library = library()): PullValue | null {
  if (!lib.sheets.has(id)) return null;
  const account = toAccount(a);
  const all = [...lib.sheets.keys()];
  const base = ownedRead(a, lib).filter((x) => x !== id);
  const name = (x: string) => lib.names.get(x) ?? x;
  const why: string[] = [];
  let percent = 0;
  if (isCentre(id, lib)) {
    const withYours = bestFor(id, [...base, id], lib, account);
    const withAll = bestFor(id, all, lib, account);
    if (withYours && withAll && withAll.count > 0) {
      const p = Math.max(0, Math.round((withYours.count / withAll.count) * 100));
      why.push(
        `As a damage dealer: your best team for them is ${teamWords(withYours, lib)} (${withYours.count} points; the best with every character is ${withAll.count}, so ${p}%). There ${memberPhrase(asExplain(withYours), id, name)}.`,
      );
      percent = Math.max(percent, p);
    }
  }
  for (const dd of centresIn(base, lib)) {
    const now = bestFor(dd, base, lib, account);
    const lifted = bestFor(dd, [...base, id], lib, account);
    const possible = bestFor(dd, all, lib, account);
    if (!lifted || !possible || possible.count <= 0 || !lifted.members.includes(id)) continue;
    if (lifted.count > (now?.count ?? 0)) {
      const p = Math.round((lifted.count / possible.count) * 100);
      why.push(
        `As a teammate: ${name(dd)}'s best team of yours goes from ${now?.count ?? 0} to ${lifted.count} points (${teamWords(lifted, lib)}; the most possible is ${possible.count}, so ${p}%). ${name(id)} ${memberPhrase(asExplain(lifted), id, name)}.`,
      );
      percent = Math.max(percent, p);
    }
  }
  if (!why.length) why.push('No gain: no team of yours gets a higher count with them.');
  return { percent, why };
}

export const hsrTeamRules: TeamRules = {
  method: METHOD,
  rated: (id) => library().sheets.has(id),
  verdict: (m, a) => verdict(m, a),
  whoFits: (m, a, o) => whoFits(m, a, library(), o),
  lineUps: (a) => lineUps(a),
  ifYouPull: (id, a) => ifYouPull(id, a),
};

/**
 * Recommended teams from the check itself: for every character who can carry,
 * the best team of four from every character at Eidolon 0. Each place lists the
 * best pick first, then the two that score best beside the rest.
 */
const recommendedCache = new WeakMap<Library, TeamPreset[]>();

/** Same library, same answer: the search runs once per library (it checks thousands of teams). */
export function recommendedTeams(lib: Library = library()): TeamPreset[] {
  const hit = recommendedCache.get(lib);
  if (hit) return hit;
  const found = findRecommended(lib);
  recommendedCache.set(lib, found);
  return found;
}

function findRecommended(lib: Library): TeamPreset[] {
  const name = (id: string) => lib.names.get(id) ?? id;
  const e0: Account = { eidolon: () => 0, enhanced: () => undefined };
  const all = [...lib.sheets.keys()];
  const out: TeamPreset[] = [];
  for (const dd of all.filter((id) => isCentre(id, lib))) {
    const first = bestFor(dd, all, lib, e0);
    if (!first || first.count <= 0) continue;
    const partners = first.members.filter((x) => x !== dd);
    const places = partners.map((p) => {
      const others = partners.filter((x) => x !== p);
      const ranked = all
        .filter((x) => x !== dd && !partners.includes(x) && fits([dd, ...others, x]) && canPartner(x, dd, lib))
        .map((x) => {
          const res = check([dd, ...others, x], lib, e0, dd);
          return { x, r: res.rated ? res.best : undefined };
        })
        .filter((c): c is { x: string; r: TeamResult } => !!c.r && c.r.count > 0)
        .sort((a, b) => compare(b.r, a.r))
        .slice(0, 2)
        .map((c) => c.x);
      return [p, ...ranked];
    });
    out.push({
      id: `kit-check-${dd}`,
      name: `${name(dd)} · best by kit check`,
      slots: [{ characters: [dd] }, ...places.map((p) => ({ characters: [...new Set(p)] }))],
      source: `${METHOD}: the best count for ${name(dd)} from every character at Eidolon 0 (${first.count})`,
    });
  }
  return out;
}

/**
 * The game's own recommended teams, built around their real centre: the game lists a partner's team (March 7th
 * (Hunt), Topaz, Robin) with its carry first, so that carry leads and the team is named after them. The same four
 * first picks recommended from several pages are shown once.
 */
export function gameTeams(raw: TeamPreset[], lib: Library = library()): TeamPreset[] {
  const name = (id: string) => lib.names.get(id) ?? id;
  const carries = new Set([...lib.sheets.values()].filter((s) => s.damage).map((s) => s.characterId));
  const seen = new Set<string>();
  const out: TeamPreset[] = [];
  for (const t of raw) {
    const centre = centreOf(t, carries);
    const at = centre ? t.slots.findIndex((s) => s.characters[0] === centre) : -1;
    const slots = at > 0 ? [t.slots[at], ...t.slots.filter((_, i) => i !== at)].filter((s): s is TeamPreset['slots'][number] => !!s) : t.slots;
    const key = slots.map((s) => s.characters[0]).sort().join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const page = pageOf(t);
    const lead = slots[0]?.characters[0];
    out.push({ ...t, slots, name: lead ? `${name(lead)} team${page && page !== lead ? ` · with ${name(page)}` : ''}` : t.name });
  }
  return out;
}
