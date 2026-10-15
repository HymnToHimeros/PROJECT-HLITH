/**
 * Team scores in plain words (owner's report T17): who the damage dealer is,
 * what each member gives them (with the kit lines behind it on the screen's
 * proof list), what costs points, and what is missing to reach the best team.
 * Game-free: each game's check hands over its lines in this shape.
 */
import type { TeamExplain } from '../contract';
import { BUILD_STAT_WORD, FIT_WORD, type BuildStat, type Fit } from './buildFit';
import { percentOf, timesWords } from './kitValue';

/** One line of a game's check, in the fields every game's check has. */
export interface ExplainLine {
  kind: string;
  who: string;
  tag: string;
  why: string;
  points: number;
  /** T30: the line's share of the kit value (a support's own hits have value but no count point). */
  value?: number;
  helpers?: string[];
  /** Counted for a second damage dealer of the team, not the main one (hsr-decisions 33). */
  forDd?: string;
  /** A build line (T18): the build the team wants on `who` and how theirs fits. */
  build?: { stat: string; have: string; fit: Fit; max: number };
}

export interface ExplainTeam {
  members: string[];
  dd: string;
  /** T30: the kit value (POINTS × ln of the multiplier); ranks teams. Absent = compare by count. */
  value?: number;
  /** Other damage dealers whose damage counts too (hsr-decisions 33). */
  coDds?: string[];
  count: number;
  lines: ExplainLine[];
}

const statWords = (stat: string) => (stat in BUILD_STAT_WORD ? BUILD_STAT_WORD[stat as BuildStat] : stat);
const list = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1] ?? ''}`);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A tag without its "Allies:" / "Enemy:" lead-in, which reads badly inside a sentence. */
const bare = (tag: string) => tag.replace(/^(Allies|Ally|Squad|Teammates|Team|Enemy|Enemies|One ally|Shifu|Bondmate|Self|Own):\s*/i, '');
/**
 * "Follow-Up ATK for Feixiao: Follow-Up ATK after teammates attack" → their Follow-Up ATK sets off "Follow-Up ATK after teammates attack".
 * Endfield's lines already say what they do ("sets up Combustion for Laevatain: Combo on Combustion") → sets up Combustion, which sets off "Combo on Combustion".
 */
const chainWords = (why: string) => {
  const m = /^(.*?) for .*?: (.*)$/.exec(why);
  if (!m) return why;
  return /^sets up /.test(m[1] ?? '') ? `${m[1]}, which sets off “${m[2]}”` : `their ${m[1]} sets off “${m[2]}”`;
};

/** What one member brings to the damage dealer, as a phrase without the name ("gives …; sets off …"), and the points it earns. */
function given(t: ExplainTeam, who: string, name: (id: string) => string): { phrase: string; points: number } {
  const all = t.lines.filter((l) => l.who === who);
  const own = all.filter((l) => !l.forDd);
  const counted = own.filter((l) => l.points > 0);
  const lost = own.filter((l) => l.points < 0);
  const support = own.filter((l) => l.kind === 'support');
  const turnedOn = t.lines.filter((l) => !l.forDd && l.kind === 'switched-on' && l.helpers?.includes(who));
  const dd = name(t.dd);
  const parts: string[] = [];
  if (who === t.dd) {
    const on = counted.filter((l) => l.kind === 'switched-on');
    parts.push(on.length ? `the team switches on ${on.length === 1 ? 'one of their abilities' : `${on.length} of their abilities`}: ${list(on.map((l) => bare(l.tag)))}` : 'none of their abilities depend on who is in the team');
  } else {
    const buffs = counted.filter((l) => l.kind === 'buff');
    const chains = counted.filter((l) => l.kind === 'chain');
    if (buffs.length) parts.push(`gives ${dd} ${list(buffs.map((l) => bare(l.tag)))}`);
    // Two skills can set off the same chain (Camille's Battle Skill and Ultimate): said once.
    for (const c of new Set(chains.map((l) => chainWords(l.why)))) parts.push(c);
    // Switching on the damage dealer's ability is counted once, on the damage dealer's line.
    if (turnedOn.length) parts.push(`switches on ${dd}'s ${list(turnedOn.map((l) => `“${bare(l.tag)}”`))}`);
    // T30 (B): a support's own hits add to the team's damage (kit value), not to the count.
    const hits = support.filter((l) => (l.value ?? 0) > 0);
    if (hits.length) parts.push(`adds damage of their own: ${list(hits.map((l) => bare(l.tag)))}`);
    const rest = support.filter((l) => !((l.value ?? 0) > 0));
    if (rest.length && !buffs.length && !chains.length && !hits.length) parts.push(`team support only (${list(rest.map((l) => bare(l.tag)))}): breaks ties, adds no points`);
  }
  for (const l of own)
    if (l.kind === 'build' && l.build)
      parts.push(
        l.build.have.startsWith('assumed')
          ? `best when built for ${statWords(l.build.stat)} (assumed here)`
          : `the team wants them built for ${statWords(l.build.stat)}: ${FIT_WORD[l.build.fit]}${l.build.fit === 'no-build' ? '' : ` (${l.build.have})`}`,
      );
  for (const l of lost) parts.push(l.kind === 'weak-fit' ? `brings nothing ${dd} uses (−1)` : `${bare(l.tag)}: ${l.why} (−1)`);
  // Second damage dealers (decision 33): what this member does for each of them, in the same words.
  for (const co of t.coDds ?? []) {
    const forCo = all.filter((l) => l.forDd === co);
    if (!forCo.length) continue;
    const up = forCo.filter((l) => l.points > 0);
    if (who === co) {
      const on = up.filter((l) => l.kind === 'switched-on');
      parts.push(`deals damage too${on.length ? `; the team switches on ${list(on.map((l) => bare(l.tag)))}` : ''}`);
    } else {
      const buffs = up.filter((l) => l.kind === 'buff');
      if (buffs.length) parts.push(`gives ${name(co)} ${list(buffs.map((l) => bare(l.tag)))}`);
      for (const c of up.filter((l) => l.kind === 'chain')) parts.push(chainWords(c.why));
      const on = t.lines.filter((l) => l.forDd === co && l.kind === 'switched-on' && l.helpers?.includes(who));
      if (on.length) parts.push(`switches on ${name(co)}'s ${list(on.map((l) => `“${bare(l.tag)}”`))}`);
    }
    for (const l of forCo.filter((x) => x.points < 0)) parts.push(`${bare(l.tag)} (for ${name(co)}): ${l.why} (−1)`);
  }
  const points = all.reduce((n, l) => n + l.points, 0);
  return { phrase: parts.join('; ') || 'nothing that counts for this team', points };
}

/**
 * The plain-words explanation of `mine` against `best` (the best team the rules find for the same damage dealer;
 * the same team when it is the best).
 */
/** What one member brings in a checked team, in plain words ("gives Feixiao …; their Follow-Up ATK sets off …"). */
export const memberPhrase = (t: ExplainTeam, who: string, name: (id: string) => string) => given(t, who, name).phrase;

export function explainTeam(mine: ExplainTeam, best: ExplainTeam, name: (id: string) => string): TeamExplain {
  const dd = name(mine.dd);
  const pts = (n: number) => `${n > 0 ? '+' : ''}${n}`;
  const members = mine.members.map((id) => {
    const g = given(mine, id, name);
    return { id, text: `${name(id)}${id === mine.dd ? ' (damage dealer)' : ''}: ${g.phrase}.`, points: g.points };
  });
  const missing: string[] = [];
  const lost = mine.lines.filter((l) => l.points < 0);
  if (lost.length)
    missing.push(`${plural(lost.length, 'point')} lost: ${list(lost.map((l) => (l.kind === 'weak-fit' ? `${name(l.who)} brings nothing for ${dd}` : `${name(l.who)}'s “${bare(l.tag)}” is ${l.kind === 'duplicate' ? 'a duplicate' : 'off'}`)))}.`);
  // Builds this team wants that aren't (fully) there yet.
  for (const l of mine.lines)
    if (l.kind === 'build' && l.build && l.points < l.build.max)
      missing.push(`${name(l.who)} built for ${statWords(l.build.stat)}: ${FIT_WORD[l.build.fit]}; up to ${plural(l.build.max - l.points, 'point')} more.`);
  // T30: "better" is a higher kit value when both have one; the count otherwise.
  const byValue = mine.value !== undefined && best.value !== undefined;
  const gap = byValue ? (best.value ?? 0) - (mine.value ?? 0) : best.count - mine.count;
  const newcomers = best.members.filter((id) => !mine.members.includes(id));
  // The headline names the best team found, so a low % explains itself (owner, 2026-10-10).
  const bestTeam = list(best.members.map(name));
  const short = byValue ? `${percentOf(mine.value ?? 0, best.value ?? 0)}% of the kit value of the best team found (${bestTeam})` : `${plural(gap, 'point')} short of the best team found (${bestTeam})`;
  if (gap > 1e-9 && newcomers.length) {
    const leaving = mine.members.filter((id) => !best.members.includes(id));
    const against = byValue ? `kit value ${timesWords(best.value ?? 0)} against ${timesWords(mine.value ?? 0)} here (count ${best.count} against ${mine.count})` : `${best.count} points against ${mine.count} here`;
    missing.unshift(`The best team found for ${dd} is ${bestTeam}: ${against}${leaving.length ? `, swapping ${list(leaving.map(name))} for ${list(newcomers.map(name))}` : ''}.`);
    for (const id of newcomers) {
      const g = given(best, id, name);
      missing.push(`${name(id)} would bring: ${g.phrase} (${pts(g.points)}).`);
    }
  }
  const helpers = members.filter((m) => m.id !== mine.dd && m.points > 0).map((m) => name(m.id));
  const co = (mine.coDds ?? []).map(name);
  const built = byValue ? `; ${percentOf(mine.value ?? 0, best.value ?? 0)}% of its kit value when fully built` : `; ${plural(gap, 'point')} more when fully built`;
  const headline = `${dd} deals the damage${co.length ? `, with ${list(co)}` : ''}. ${helpers.length ? `${list(helpers)} ${helpers.length === 1 ? 'connects' : 'connect'} with ${dd}'s kit` : `No teammate connects with ${dd}'s kit`}${gap > 1e-9 ? (newcomers.length ? `; ${short}` : built) : '; no better team found'}.`;
  return { headline, members, missing };
}
