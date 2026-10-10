/**
 * Everything ZZZ builds on the check (docs/logic/zzz-method.md): synergy % on
 * presets, Line-ups, Who fits and "If you pull…" %. Decisions the method leaves
 * open are written down in docs/logic/zzz-decisions.md.
 */
import { bestFill, withOwnerLists } from '../../../core/rules/fillTeam';
import { bestFoundCards } from '../../../core/rules/bestCards';
import type { FitOptions, FitSuggestion, PullValue, TeamAccount, TeamIdea, TeamPreset, TeamReason, TeamRules, TeamVerdict, TeamWant } from '../../../core/contract';
import { BUILD_STAT_WORD, buildFit } from '../../../core/rules/buildFit';
import { GEAR_SLOTS } from '../gear';
import { checkSquad, compare, DD_ORDER, labelOf, type Account, type Library, type Line, type SquadResult } from './check';
import { library } from './library';
import { accountNotes, type AccountFacts } from '../../../core/rules/accountNotes';
import { SIGNATURE_PIECE } from '../../../core/rules/signatureWeapons';
import { assumedLine, assumedWords } from '../../../core/rules/averageBuild';
import { assume } from '../assumed';
import { explainTeam, memberPhrase } from '../../../core/rules/teamExplain';
import { countWords, percentOf, timesWords, typicalNote, VALUE_NOTE } from '../../../core/rules/kitValue';
import { leakLines, usable } from '../../../core/rules/leaks';

export const METHOD = 'ZZZ Kit Check method (docs/logic/zzz-method.md)';
/** Partners kept per damage dealer before trios are tried, once the pool is bigger than this (method: Line-ups step 2). */
const PAIR_LIMIT = 10;

const toAccount = (a: TeamAccount): Account => ({
  mindscape: (id) => (a.owned(id) ? a.dupes(id) : 0),
  potential: (id) => a.potential?.(id),
  weapon: (id) => (a.owned(id) ? a.weapon?.(id) : undefined),
  // T18: a saved build is read only for agents you own; undefined = no build saved.
  buildFit: (id, stat) => {
    const b = a.owned(id) ? a.build?.(id) : undefined;
    const fit = b ? buildFit(b, stat, GEAR_SLOTS) : undefined;
    // T34: an assumed build says so wherever its fit is shown.
    return fit && a.assumed?.(id) ? { ...fit, have: `${assumedWords(a.weapon?.(id)?.name)}: ${fit.have}` } : fit;
  },
});

export function synergyLabel(percent: number, members: number): string {
  if (members < 3) return 'Incomplete';
  return percent >= 85 ? 'Excellent' : percent >= 65 ? 'Good' : percent >= 45 ? 'Partly' : 'Weak';
}

const isDamageDealer = (id: string, lib: Library) => DD_ORDER.includes(lib.profiles.get(id)?.specialty ?? 'support');

/** The best squad the check finds for one damage dealer from a pool of characters (both orders tried). */
/** Same question, same answer: bestFor is asked the same thing by every team on a screen, so answers are kept (keyed by the pool and its levels). */
const bestCache = new Map<string, SquadResult | undefined>();
let cacheLib: Library | undefined;

export function bestFor(dd: string, pool: string[], lib: Library, account: Account, likeFor?: SquadResult): SquadResult | undefined {
  if (cacheLib !== lib) {
    bestCache.clear();
    cacheLib = lib;
  }
  const key = `${dd}|${[...new Set(pool)].sort().map((id) => `${id}:${account.mindscape(id)}:${account.potential(id) ?? '-'}`).join(',')}|${account.mindscape(dd)}:${account.potential(dd) ?? '-'}|${likeFor?.sustain ? 'sustain' : ''}|${(likeFor?.order ?? []).join(',')}`;
  if (bestCache.has(key)) return bestCache.get(key);
  if (bestCache.size > 2000) bestCache.clear();
  // The best team found assumes every member is built for what the team wants (decision 26): 100% includes builds.
  const found = findBest(dd, pool, lib, { ...account, ideal: true }, !!likeFor?.sustain, likeFor?.order ?? []);
  bestCache.set(key, found);
  return found;
}

function findBest(dd: string, pool: string[], lib: Library, account: Account, needSustain = false, also: string[] = []): SquadResult | undefined {
  let partners = pool.filter((id) => id !== dd && lib.sheets.has(id));
  if (!lib.sheets.has(dd) || !partners.length) return undefined;
  if (partners.length > PAIR_LIMIT) {
    const pairs = partners.map((p) => {
      const out = checkSquad([dd, p], lib, account, dd);
      return { p, r: out.rated ? out.best : undefined };
    });
    pairs.sort((a, b) => (b.r && a.r ? compare(b.r, a.r) : b.r ? 1 : -1));
    // The squad's own members always stay in the running, however their pair with the damage dealer ranks.
    partners = [...new Set([...pairs.slice(0, PAIR_LIMIT).map((x) => x.p), ...partners.filter((id) => also.includes(id))])];
  }
  let best: SquadResult | undefined;
  const tryOne = (members: string[]) => {
    const out = checkSquad(members, lib, account, dd);
    if (out.rated && (!needSustain || out.best.sustain) && (!best || compare(out.best, best) > 0)) best = out.best;
  };
  if (partners.length === 1) tryOne([dd, partners[0] ?? '']);
  for (let i = 0; i < partners.length; i++) for (let j = i + 1; j < partners.length; j++) tryOne([dd, partners[i] ?? '', partners[j] ?? '']);
  return best;
}

const asExplain = (r: SquadResult) => ({ members: r.order, dd: r.dd, count: r.count, value: r.value, lines: r.lines });

/** Every read character the account doesn't hide (the unpicked Trailblazer: `skip`, FRAME's protagonist setting). */
/** Everyone the check may use: no one the owner hid, and leaks only when the owner shows them (T39). */
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
  // A team's first member is its damage dealer when they can be one (the lead of a preset); otherwise Part B step 1 picks.
  const lead = members[0] && isDamageDealer(members[0], lib) ? members[0] : undefined;
  const out = checkSquad(members, lib, account, lead);
  if (!out.rated) return { rated: false, why: out.why };
  const mine = out.best;
  const owned = ownedRead(a, lib);
  const notes: string[] = [];
  let pool: string[];
  if (owned.length < 3) {
    pool = readable(lib, a);
    notes.push('You own fewer than three agents whose kits have been read, so this compares with every agent instead.');
  } else pool = [...new Set([...owned, ...members])];
  // Like with like (MANAGER's ruling, T30): a squad with a healer is compared with the best squad that keeps one.
  const best = bestFor(mine.dd, pool, lib, account, mine);
  if (mine.sustain) notes.push('This squad has a healer, so the best squad found keeps one too.');
  const top = best && compare(best, mine) > 0 ? best : mine;
  if (top.value <= 0 && top.count <= 0) return { rated: false, why: `No squad the check can find connects for ${name(mine.dd)} yet (best ${countWords(top)}).` };
  const percent = Math.max(0, percentOf(mine.value, top.value));
  if (percent >= 100) notes.push(`100% means the check knows no better squad for ${name(mine.dd)} from your agents.`);
  else notes.push(`Best for ${name(mine.dd)} from your agents: ${top.order.map(name).join(' > ')} counts ${countWords(top)}.`);
  const every = bestFor(mine.dd, readable(lib, a), lib, account, mine);
  if (every && every.value > top.value) notes.push(`From every agent, ${every.order.map(name).join(' > ')} counts ${countWords(every)}.`);
  if (out.other && out.other.count !== mine.count) notes.push(`The other order, ${out.other.order.map(name).join(' > ')}, counts ${countWords(out.other)}.`);
  notes.push(VALUE_NOTE);
  const typical = typicalNote(mine.lines, name);
  if (typical) notes.push(typical);
  const assumedNote = assumedLine(mine.order, a, name);
  // T39: a leak in the squad says so (ZZZ has no game team lists to lack, so only the leak line).
  const leakNote = leakLines(mine.order, lib.leaks, name);
  // T34's assumed builds, then T39's leak lines: in the notes and at the end of the plain words.
  const extraNotes = [...(assumedNote ? [assumedNote] : []), ...leakNote];
  notes.push(...extraNotes);
  const explain = explainTeam(asExplain(mine), asExplain(top), name);
  return {
    rated: true,
    percent,
    label: synergyLabel(percent, members.length),
    count: mine.count,
    best: top.count,
    bestMembers: top.order,
    order: mine.order,
    reasons: mine.lines.map((l) => reasonOf(l, lib)),
    ...(wantsOf(mine, lib).length ? { wants: wantsOf(mine, lib) } : {}),
    explain: extraNotes.length ? { ...explain, missing: [...explain.missing, ...extraNotes] } : explain,
    notes: [summary(mine), ...notes],
  };
}

/** How a candidate connects in a checked squad, in words; empty = not at all. */
function connections(r: SquadResult, c: string, lib: Library): string[] {
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
  // Your own agents by default; the rest only when asked, as theory.
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
    // % against the best squad found for the same damage dealer from the same pool.
    const best = bestFor(r.dd, [...new Set([...pool, ...members])], lib, account, r);
    const top = best && compare(best, r) > 0 ? best.value : r.value;
    const percent = top > 0 ? Math.max(0, percentOf(r.value, top)) : 0;
    const hasTrack = [...(lib.unlocks.get(c)?.values() ?? [])].some((u) => u.potential || u.replacedAt);
    const locked = r.lines.filter((l) => l.who === c && l.kind === 'locked').length;
    const sigId = lib.unlocks.get(c)?.get(SIGNATURE_PIECE)?.weapon;
    const sigLabel = lib.pieceLabels.get(c)?.get(SIGNATURE_PIECE);
    const signature = sigId && sigLabel ? { id: sigId, name: sigLabel.replace(/^Signature [^:]+: /, '').replace(/ · .*$/, '') } : undefined;
    const equipped = equippedFact(c, a, lib);
    const { notes, theory } = accountNotes(c, a, { dupePrefix: 'M', ...(hasTrack ? { track: 'Agent Potential', trackLevels: true } : {}), locked, ...(signature ? { signature } : {}), ...(equipped ? { equipped } : {}) });
    // T39: a leak is never owned, so it only shows as theory, marked unverified.
    const leak = leakLines([c], lib.leaks, (x) => lib.names.get(x) ?? x);
    out.push({ id: c, count: r.count, how, withEveryone, percent, fromAccount: [...leak, ...notes], theory });
  }
  return out.sort((x, y) => (y.percent ?? 0) - (x.percent ?? 0) || Number(y.withEveryone) - Number(x.withEveryone) || y.count - x.count);
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
        if (out.rated && out.best.value > 0) mine.push(out.best);
      }
    candidates.push(...mine.sort((x, y) => compare(y, x)).slice(0, 5));
  }
  // The set of teams that never share a character with the highest total count; more teams break a tie.
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
  return best.map((r) => ({ members: r.order, count: r.count, why: `${r.order.map(name).join(' > ')} counts ${countWords(r)}: ${summary(r)}` }));
}

export function ifYouPull(id: string, a: TeamAccount, lib: Library = library()): PullValue | null {
  if (!lib.sheets.has(id)) return null;
  const name = (x: string) => lib.names.get(x) ?? x;
  // A character you don't own is tested at M0 (toAccount gives 0 for anyone not owned).
  const account = toAccount(a);
  // The character asked about is always in the pool, a hidden leak included (pre-pull, T39).
  const all = [...new Set([...readable(lib, a), id])];
  const base = ownedRead(a, lib).filter((x) => x !== id);
  const why: string[] = [];
  let percent = 0;
  if (isDamageDealer(id, lib)) {
    const withYours = bestFor(id, [...base, id], lib, account);
    const withAll = bestFor(id, all, lib, account);
    if (withYours && withAll && withAll.value > 0) {
      const p = Math.max(0, percentOf(withYours.value, withAll.value));
      why.push(
        `As a damage dealer: your best squad for them is ${withYours.order.map(name).join(' > ')} (${countWords(withYours)}; the best with every agent is ${countWords(withAll)}, so ${p}%). There ${memberPhrase(asExplain(withYours), id, name)}.`,
      );
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
      why.push(
        `As a teammate: ${name(dd)}'s best squad of yours goes from ${(now ? countWords(now) : '0')} to ${countWords(lifted)} (${lifted.order.map(name).join(' > ')}; the most possible is ${countWords(possible)}, so ${p}%). ${name(id)} ${memberPhrase(asExplain(lifted), id, name)}.`,
      );
      percent = Math.max(percent, p);
    }
  }
  if (!why.length) why.push('No gain: no team of yours gets a higher kit value with them.');
  // T39: a leak says so first.
  if (lib.leaks?.has(id)) why.unshift(...leakLines([id], lib.leaks, name));
  return { percent, why };
}

/** T41, mirrors HSR: a "Best found from your characters" card when every recommended squad of a damage dealer stays under 90%. */
export function bestCards(presets: TeamPreset[], a: TeamAccount, lib: Library = library()): TeamPreset[] {
  const assumed = assume(a);
  const owned = ownedRead(assumed, lib);
  if (owned.length < 3) return [];
  const account = toAccount(assumed);
  // As HSR: the trigger is the card's own %; the card added is the best squad found with any line-up.
  const best = (dd: string) => bestFor(dd, owned, lib, account);
  const cards = presets.flatMap((p) => {
    const members = zzzTeamRules.fill?.(p, a) ?? [];
    const lead = members[0] && isDamageDealer(members[0], lib) ? members[0] : undefined;
    const out = members.length ? checkSquad(members, lib, account, lead) : undefined;
    if (!out?.rated || !a.owned(out.best.dd)) return [];
    const v = verdict(members, assumed, lib);
    return v.rated ? [{ dd: out.best.dd, members, percent: v.percent }] : [];
  });
  const found = (dd: string) => {
    const members = best(dd)?.order;
    const v = members ? verdict(members, assumed, lib) : undefined;
    return members && v?.rated ? { members, percent: v.percent } : undefined;
  };
  return bestFoundCards(cards, found, (id) => lib.names.get(id) ?? id, 3);
}

export const zzzTeamRules: TeamRules = {
  method: METHOD,
  // T40: the better unit is picked for each slot, by the kit value My teams scores with (same account, same check).
  fill: (p, a) => {
    const lib = library();
    const account = toAccount(assume(a));
    return bestFill(withOwnerLists(p, a), a, (_team, id) => !a.skip?.(id), (team, dd) => {
      const lead = dd ?? (team[0] && isDamageDealer(team[0], lib) ? team[0] : undefined);
      const out = checkSquad(team, lib, account, lead);
      return out.rated ? { value: out.best.value, dd: out.best.dd } : undefined;
    });
  },
  rated: (id) => library().sheets.has(id),
  // T34: the owner's "assume signature + average build" switch is applied once, here, for every question.
  verdict: (m, a) => verdict(m, assume(a)),
  whoFits: (m, a, o) => whoFits(m, assume(a), library(), o),
  lineUps: (a) => lineUps(assume(a)),
  ifYouPull: (id, a) => ifYouPull(id, assume(a)),
  bestCards: (ps, a) => bestCards(ps, a),
};

/**
 * Recommended teams from the check itself: for every damage dealer, the best
 * squad the check finds from every agent at Mindscape 0 (no Potential). Each
 * place lists the best pick first, then the two that score best beside the rest.
 */
export function recommendedTeams(lib: Library = library()): TeamPreset[] {
  const name = (id: string) => lib.names.get(id) ?? id;
  const m0: Account = { mindscape: () => 0, potential: () => undefined };
  // Recommended teams are the same for everyone: leaks (unverified) stay out of them (T39).
  const all = [...lib.sheets.keys()].filter((id) => !lib.leaks?.has(id));
  const out: TeamPreset[] = [];
  for (const dd of all.filter((id) => isDamageDealer(id, lib))) {
    const first = bestFor(dd, all, lib, m0);
    if (!first || first.count <= 0) continue;
    // Alternatives for each place: whoever scores best with the damage dealer and the other partner.
    const partners = first.order.slice(1);
    const places = partners.map((p) => {
      const others = partners.filter((x) => x !== p);
      const ranked = all
        .filter((x) => x !== dd && !partners.includes(x))
        .map((x) => {
          const out = checkSquad([dd, ...others, x], lib, m0, dd);
          return { x, r: out.rated ? out.best : undefined };
        })
        .filter((c): c is { x: string; r: SquadResult } => !!c.r && c.r.count > 0)
        .sort((a, b) => compare(b.r, a.r))
        .slice(0, 2)
        .map((c) => c.x);
      return [p, ...ranked];
    });
    out.push({
      id: `kit-check-${dd}`,
      name: `${name(dd)} · best by kit check`,
      slots: [{ characters: [dd] }, ...places.map((p) => ({ characters: [...new Set(p)] }))],
      source: `${METHOD}: the best kit value for ${name(dd)} from every agent at Mindscape 0: count ${first.count}, ${timesWords(first.value)}`,
    });
  }
  return out;
}

/** What the check makes of the W-Engine in an agent's saved build (for the account notes). */
function equippedFact(c: string, a: TeamAccount, lib: Library): AccountFacts['equipped'] {
  const w = a.owned(c) ? a.weapon?.(c) : undefined;
  if (!w) return undefined;
  if (!w.id) return { is: 'unknown' };
  const sheet = lib.weapons.get(w.id);
  if (!sheet) return { is: 'unread' };
  const specialty = lib.profiles.get(c)?.specialty;
  return sheet.madeFor === c || sheet.role === specialty ? { is: 'counts' } : { is: 'wrong-role', role: sheet.role.charAt(0).toUpperCase() + sheet.role.slice(1) };
}

/** The builds this team wants on its members (T18), from its build lines. */
function wantsOf(r: SquadResult, lib: Library): TeamWant[] {
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
