/**
 * Everything HSR builds on the check (docs/logic/hsr-theory.md): synergy % on
 * teams, Line-ups, Who fits, "If you pull…" % and recommended teams. Same
 * shape as ZZZ (src/games/zzz/kitcheck/team.ts), with teams of four and no order.
 */
import type { FitOptions, FitSuggestion, PullValue, TeamAccount, TeamIdea, TeamPreset, TeamReason, TeamRules, TeamVerdict, TeamWant } from '../../../core/contract';
import { BUILD_STAT_WORD, buildFit } from '../../../core/rules/buildFit';
import { GEAR_SLOTS } from '../gear';
import { canCarry, canPartner, check, compare, damageDealers, isCentre, labelOf, type Account, type Library, type Line, type TeamResult } from './check';
import { isOwnTeam, library, pageOf } from './library';
import { fillTeam, withOwnerLists } from '../../../core/rules/fillTeam';
import { accountNotes, type AccountFacts } from '../../../core/rules/accountNotes';
import { SIGNATURE_PIECE } from '../../../core/rules/signatureWeapons';
import { assumedLine, assumedWords } from '../../../core/rules/averageBuild';
import { assume } from '../assumed';
import { explainTeam, memberPhrase } from '../../../core/rules/teamExplain';
import { countWords, percentOf, timesWords, typicalNote, VALUE_NOTE } from '../../../core/rules/kitValue';
import { leakLines, noListLine, usable } from '../../../core/rules/leaks';

export const METHOD = 'HSR Kit Check theory v2 (docs/logic/hsr-theory.md)';
/** Partners kept per damage dealer before teams of four are tried, once the pool is bigger than this. */
const PAIR_LIMIT = 10;
const SIZE = 4;

const toAccount = (a: TeamAccount): Account => ({
  eidolon: (id) => (a.owned(id) ? a.dupes(id) : 0),
  enhanced: (id) => a.potential?.(id),
  weapon: (id) => (a.owned(id) ? a.weapon?.(id) : undefined),
  teamList: (id) => {
    const l = a.teamList?.(id);
    return l && l.some((slot) => slot.length) ? l : undefined;
  },
  // T18: a saved build is read only for characters you own; undefined = no build saved.
  buildFit: (id, stat) => {
    const b = a.owned(id) ? a.build?.(id) : undefined;
    const fit = b ? buildFit(b, stat, GEAR_SLOTS) : undefined;
    // T34: an assumed build says so wherever its fit is shown.
    return fit && a.assumed?.(id) ? { ...fit, have: `${assumedWords(a.weapon?.(id)?.name)}: ${fit.have}` } : fit;
  },
});

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

/**
 * `also`: characters tried beside `dd` even when their own game team doesn't list them: a team you made yourself is
 * compared with the best team that could include its own members (decision 30).
 */
export function bestFor(dd: string, pool: string[], lib: Library, account: Account, also: string[] = []): TeamResult | undefined {
  if (cacheLib !== lib) {
    bestCache.clear();
    cacheLib = lib;
  }
  const key = `${dd}|${[...new Set(pool)].sort().map((id) => `${id}:${account.eidolon(id)}:${account.enhanced(id) ?? '-'}`).join(',')}|${account.eidolon(dd)}:${account.enhanced(dd) ?? '-'}|${[...also].sort().join(',')}|${(lib.ownTeams.get(dd) ?? []).map((t) => JSON.stringify(account.teamList?.(t.id) ?? null)).join(';')}`;
  if (bestCache.has(key)) return bestCache.get(key);
  if (bestCache.size > 2000) bestCache.clear();
  // The best team found assumes every member is built for what the team wants (decision 26): 100% includes builds.
  const found = findBest(dd, pool, lib, { ...account, ideal: true }, also);
  bestCache.set(key, found);
  return found;
}

/** A big pool is cut to the PAIR_LIMIT partners with the best count beside the damage dealer. */
function shortlist(dd: string, partners: string[], lib: Library, account: Account): string[] {
  if (partners.length <= PAIR_LIMIT) return partners;
  return partners
    .map((p) => {
      const out = check([dd, p], lib, account, dd);
      return { p, r: out.rated ? out.best : undefined };
    })
    .filter((x): x is { p: string; r: TeamResult } => !!x.r)
    .sort((a, b) => b.r.value - a.r.value || b.r.count - a.r.count || b.r.support - a.r.support || b.r.chains - a.r.chains)
    .slice(0, PAIR_LIMIT)
    .map((x) => x.p);
}

function findBest(dd: string, pool: string[], lib: Library, account: Account, also: string[] = []): TeamResult | undefined {
  let partners = pool.filter((id) => id !== dd && lib.sheets.has(id) && fits([dd, id]) && (canPartner(id, dd, lib, account) || also.includes(id)));
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

const asExplain = (r: TeamResult) => ({ members: r.members, dd: r.dd, count: r.count, value: r.value, lines: r.lines, ...(r.coDds ? { coDds: r.coDds } : {}) });

/** Every read character the account doesn't hide (the unpicked Trailblazer: `skip`, FRAME's protagonist setting). */
/** Everyone the check may use: no one the owner hid, and leaks only when the owner shows them (T39). */
const readable = (lib: Library, a: TeamAccount) => usable(lib.sheets.keys(), a, lib.leaks);
const ownedRead = (a: TeamAccount, lib: Library) => readable(lib, a).filter((id) => a.owned(id));

function reasonOf(l: Line, lib: Library): TeamReason {
  const name = (id: string) => lib.names.get(id) ?? id;
  const group: TeamReason['group'] = l.kind === 'support' ? 'tie-break' : l.points !== 0 ? 'counted' : 'not-counted';
  const proof = l.piece && l.quote ? { who: name(l.who), skill: labelOf(lib, l.who, l.piece), quote: l.quote } : undefined;
  return { points: l.points, group, text: `${name(l.who)} · ${l.tag}${l.forDd ? ` (for ${name(l.forDd)})` : ''}: ${l.why}`, ...(proof ? { proof } : {}) };
}

export function summary(r: TeamResult): string {
  const n = (kind: Line['kind']) => r.lines.filter((l) => l.kind === kind).length;
  const parts = [`${n('buff')} buffs reach the damage dealer`, `${n('switched-on')} of their abilities switched on`, `${n('chain')} chains`];
  const minus = n('off') + n('duplicate') + n('weak-fit');
  return `${parts.join(', ')}${minus ? `, −${minus} (off, duplicates, weak fits)` : ''}`;
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
    pool = readable(lib, a);
    notes.push('You own fewer than four characters whose kits have been read, so this compares with every character instead.');
  } else pool = [...new Set([...owned, ...members])];
  const best = bestFor(mine.dd, pool, lib, account, mine.members);
  const top = best && compare(best, mine) > 0 ? best : mine;
  if (top.value <= 0 && top.count <= 0) return { rated: false, why: `No team the check can find connects for ${name(mine.dd)} yet (best ${countWords(top)}).` };
  const percent = Math.max(0, percentOf(mine.value, top.value));
  if (percent >= 100) notes.push(`100% means the check knows no better team for ${name(mine.dd)} from your characters.`);
  else notes.push(`Best for ${name(mine.dd)} from your characters: ${teamWords(top, lib)} counts ${countWords(top)}.`);
  const every = bestFor(mine.dd, readable(lib, a), lib, account);
  if (every && every.value > top.value) notes.push(`From every character: ${teamWords(every, lib)} counts ${countWords(every)}.`);
  if (out.other && !lead) notes.push(`With ${name(out.other.dd)} as the damage dealer it counts ${countWords(out.other)}.`);
  if ((lib.ownTeams.get(mine.dd) ?? []).some((t) => account.teamList?.(t.id))) notes.push(`Team lists for ${name(mine.dd)} edited by you: teammates come from your lists.`);
  notes.push(`Traces count as unlocked. ${VALUE_NOTE}`);
  const typical = typicalNote(mine.lines.filter((l) => !l.forDd), name);
  if (typical) notes.push(typical);
  const assumedNote = assumedLine(mine.members, a, name);
  // T39: a leak in the team says so; a leaked carry has no game team list yet.
  const leakNote = [...leakLines(mine.members, lib.leaks, name), ...(lib.leaks?.has(mine.dd) && !lib.ownTeams.get(mine.dd)?.length ? [noListLine(name(mine.dd))] : [])];
  // T34's assumed builds, then T39's leak lines: in the notes and at the end of the plain words.
  const extraNotes = [...(assumedNote ? [assumedNote] : []), ...leakNote];
  notes.push(...extraNotes);
  const explain = explainTeam(asExplain(mine), asExplain(top), name);
  const label = synergyLabel(percent, members.length);
  return {
    rated: true,
    percent,
    label,
    count: mine.count,
    best: top.count,
    bestMembers: top.members,
    order: mine.members,
    unordered: true,
    reasons: mine.lines.map((l) => reasonOf(l, lib)),
    ...(wantsOf(mine, lib).length ? { wants: wantsOf(mine, lib) } : {}),
    explain: extraNotes.length ? { ...explain, missing: [...explain.missing, ...extraNotes] } : explain,
    notes: [summary(mine), ...notes],
  };
}

/** What the check makes of the Light Cone in a character's saved build (for the account notes). */
function equippedFact(c: string, a: TeamAccount, lib: Library): AccountFacts['equipped'] {
  const w = a.owned(c) ? a.weapon?.(c) : undefined;
  if (!w) return undefined;
  if (!w.id) return { is: 'unknown' };
  const sheet = lib.weapons.get(w.id);
  if (!sheet) return { is: 'unread' };
  const path = lib.profiles.get(c)?.path;
  return sheet.madeFor === c || sheet.role === path ? { is: 'counts' } : { is: 'wrong-role', role: sheet.role.charAt(0).toUpperCase() + sheet.role.slice(1) };
}

/** The builds this team wants on its members (T18), from its build lines. */
function wantsOf(r: TeamResult, lib: Library): TeamWant[] {
  return r.lines.flatMap((l) =>
    l.kind === 'build' && l.build
      ? [
          {
            who: l.who,
            stat: BUILD_STAT_WORD[l.build.stat],
            label: l.tag,
            have: l.build.have,
            fit: l.build.fit,
            points: l.points,
            max: l.build.max,
            proof: { skill: l.piece ? labelOf(lib, l.who, l.piece) : '', quote: l.quote ?? '' },
          },
        ]
      : [],
  );
}

/** How a candidate connects in a checked team, in words; empty = not at all. */
function connections(r: TeamResult, c: string, lib: Library): string[] {
  const name = (id: string) => lib.names.get(id) ?? id;
  const piece = (who: string, p?: string) => (p ? labelOf(lib, who, p) : '');
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
  const pool = readable(lib, a).filter((c) => options.includeUnowned || a.owned(c));
  for (const c of pool) {
    if (members.includes(c) || !fits([...members, c])) continue;
    const res = check([...members, c], lib, account, leadOf([...members, c], lib));
    if (!res.rated) continue;
    const r = res.best;
    // Only teammates the carry's own game team lists (decision 30): no mix-matching.
    if (r.members.some((m) => m !== r.dd && !canPartner(m, r.dd, lib, account))) continue;
    if (r.lines.some((l) => l.kind === 'weak-fit' && l.who === c)) continue;
    const how = connections(r, c, lib);
    if (!how.length) continue;
    const others = members.filter((m) => m !== r.dd);
    const withEveryone = c === r.dd ? others.every((m) => r.lines.some((l) => l.who === m && (l.kind === 'buff' || l.kind === 'chain'))) : r.lines.some((l) => l.who === c && (l.kind === 'buff' || l.kind === 'chain'));
    // % against the best team found for the same damage dealer from the same pool.
    const best = bestFor(r.dd, [...new Set([...pool, ...members])], lib, account);
    const top = best && compare(best, r) > 0 ? best.value : r.value;
    const percent = top > 0 ? Math.max(0, percentOf(r.value, top)) : 0;
    const hasTrack = [...(lib.unlocks.get(c)?.values() ?? [])].some((u) => u.potential || u.replacedAt);
    const locked = r.lines.filter((l) => l.who === c && l.kind === 'locked').length;
    const sigId = lib.unlocks.get(c)?.get(SIGNATURE_PIECE)?.weapon;
    const sigLabel = lib.pieceLabels.get(c)?.get(SIGNATURE_PIECE);
    const signature = sigId && sigLabel ? { id: sigId, name: sigLabel.replace(/^Signature [^:]+: /, '').replace(/ · .*$/, '') } : undefined;
    const equipped = equippedFact(c, a, lib);
    const { notes, theory } = accountNotes(c, a, { dupePrefix: 'E', ...(hasTrack ? { track: 'Enhanced kit' } : {}), locked, ...(signature ? { signature } : {}), ...(equipped ? { equipped } : {}) });
    // T39: a leak is never owned, so it only shows as theory, marked unverified.
    const leak = leakLines([c], lib.leaks, (x) => lib.names.get(x) ?? x);
    out.push({ id: c, count: r.count, how, withEveryone, percent, fromAccount: [...leak, ...notes], theory });
  }
  return out.sort((x, y) => (y.percent ?? 0) - (x.percent ?? 0) || Number(y.withEveryone) - Number(x.withEveryone) || y.count - x.count);
}

export function lineUps(a: TeamAccount, lib: Library = library()): TeamIdea[] {
  const account = toAccount(a);
  const owned = ownedRead(a, lib);
  const candidates: TeamResult[] = [];
  for (const dd of centresIn(owned, lib)) {
    let partners = owned.filter((id) => id !== dd && fits([dd, id]) && canPartner(id, dd, lib, account));
    partners = shortlist(dd, partners, lib, account);
    const mine: TeamResult[] = [];
    for (const others of combos(partners, Math.min(SIZE - 1, partners.length))) {
      if (others.length < SIZE - 1 || !fits([dd, ...others])) continue;
      const out = check([dd, ...others], lib, account, dd);
      if (out.rated && out.best.value > 0) mine.push(out.best);
    }
    candidates.push(...mine.sort((x, y) => compare(y, x)).slice(0, 5));
  }
  // The set of teams that never share a character with the highest total count; more teams break a tie.
  let best: TeamResult[] = [];
  const total = (xs: TeamResult[]) => xs.reduce((n, x) => n + x.value, 0);
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
  return best.map((r) => ({ members: r.members, count: r.count, why: `${teamWords(r, lib)} counts ${countWords(r)}: ${summary(r)}` }));
}

export function ifYouPull(id: string, a: TeamAccount, lib: Library = library()): PullValue | null {
  if (!lib.sheets.has(id)) return null;
  const account = toAccount(a);
  // The character asked about is always in the pool, a hidden leak included (pre-pull, T39).
  const all = [...new Set([...readable(lib, a), id])];
  const base = ownedRead(a, lib).filter((x) => x !== id);
  const name = (x: string) => lib.names.get(x) ?? x;
  const why: string[] = [];
  let percent = 0;
  // A leaked carry has no game team yet, so isn't a centre; pre-pull still asks what they'd carry (T39).
  if (isCentre(id, lib) || (lib.leaks?.has(id) && canCarry(id, lib))) {
    const withYours = bestFor(id, [...base, id], lib, account);
    const withAll = bestFor(id, all, lib, account);
    if (withYours && withAll && withAll.value > 0) {
      const p = Math.max(0, percentOf(withYours.value, withAll.value));
      why.push(
        `As a damage dealer: your best team for them is ${teamWords(withYours, lib)} (${countWords(withYours)}; the best with every character is ${countWords(withAll)}, so ${p}%). There ${memberPhrase(asExplain(withYours), id, name)}.`,
      );
      percent = Math.max(percent, p);
    }
  }
  for (const dd of centresIn(base, lib)) {
    const now = bestFor(dd, base, lib, account);
    const lifted = bestFor(dd, [...base, id], lib, account);
    const possible = bestFor(dd, all, lib, account);
    if (!lifted || !possible || possible.value <= 0 || !lifted.members.includes(id)) continue;
    if (lifted.value > (now?.value ?? 0)) {
      const p = percentOf(lifted.value, possible.value);
      why.push(
        `As a teammate: ${name(dd)}'s best team of yours goes from ${(now ? countWords(now) : '0')} to ${countWords(lifted)} (${teamWords(lifted, lib)}; the most possible is ${countWords(possible)}, so ${p}%). ${name(id)} ${memberPhrase(asExplain(lifted), id, name)}.`,
      );
      percent = Math.max(percent, p);
    }
  }
  if (!why.length) why.push('No gain: no team of yours gets a higher kit value with them.');
  // T39: a leak says so first; a leaked carry has no game team list yet.
  if (lib.leaks?.has(id)) why.unshift(...leakLines([id], lib.leaks, name), ...(canCarry(id, lib) && !lib.ownTeams.get(id)?.length ? [noListLine(name(id))] : []));
  return { percent, why };
}

export const hsrTeamRules: TeamRules = {
  method: METHOD,
  fill: (p, a) => fillTeam(withOwnerLists(p, a), a.owned, (team, id) => !a.skip?.(id) && fits([...team, id])),
  rated: (id) => library().sheets.has(id),
  // T34: the owner's "assume signature + average build" switch is applied once, here, for every question.
  verdict: (m, a) => verdict(m, assume(a)),
  whoFits: (m, a, o) => whoFits(m, assume(a), library(), o),
  lineUps: (a) => lineUps(assume(a)),
  ifYouPull: (id, a) => ifYouPull(id, assume(a)),
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
  // Recommended teams are the same for everyone: leaks (unverified) stay out of them (T39).
  const all = [...lib.sheets.keys()].filter((id) => !lib.leaks?.has(id));
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
      source: `${METHOD}: the best kit value for ${name(dd)} from every character at Eidolon 0: count ${first.count}, ${timesWords(first.value)}`,
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
  const made = new Map<string, number>();
  const out: TeamPreset[] = [];
  for (const t of raw) {
    // Only a carry's own team (decision 30): other pages' starter line-ups are never shown as teams.
    if (!isOwnTeam(t, carries)) continue;
    const page = pageOf(t) ?? '';
    const at = t.slots.findIndex((s) => s.characters.includes(page));
    const slots = at > 0 ? [t.slots[at], ...t.slots.filter((_, i) => i !== at)].filter((s): s is TeamPreset['slots'][number] => !!s) : t.slots;
    const key = slots.map((s) => s.characters.join('+')).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const n = (made.get(page) ?? 0) + 1;
    made.set(page, n);
    out.push({ ...t, slots, name: `${name(page)} team${n > 1 ? ` ${n}` : ''}` });
  }
  return out;
}
