/**
 * Team scores in plain words (owner's report T17): who the damage dealer is,
 * what each member gives them (with the kit lines behind it on the screen's
 * proof list), what costs points, and what is missing to reach the best team.
 * Game-free: each game's check hands over its lines in this shape.
 */
import type { TeamExplain } from '../contract';
import { BUILD_STAT_WORD, FIT_WORD, type BuildStat, type Fit } from './buildFit';

/** One line of a game's check, in the fields every game's check has. */
export interface ExplainLine {
  kind: string;
  who: string;
  tag: string;
  why: string;
  points: number;
  helpers?: string[];
  /** A build line (T18): the build the team wants on `who` and how theirs fits. */
  build?: { stat: string; have: string; fit: Fit; max: number };
}

export interface ExplainTeam {
  members: string[];
  dd: string;
  count: number;
  lines: ExplainLine[];
}

const statWords = (stat: string) => (stat in BUILD_STAT_WORD ? BUILD_STAT_WORD[stat as BuildStat] : stat);
const list = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1] ?? ''}`);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A tag without its "Allies:" / "Enemy:" lead-in, which reads badly inside a sentence. */
const bare = (tag: string) => tag.replace(/^(Allies|Ally|Squad|Teammates|Team|Enemy|Enemies|One ally|Shifu|Bondmate|Self|Own):\s*/i, '');
/** "Follow-Up ATK for Feixiao: Follow-Up ATK after teammates attack" → their Follow-Up ATK sets off "Follow-Up ATK after teammates attack". */
const chainWords = (why: string) => {
  const m = /^(.*?) for .*?: (.*)$/.exec(why);
  return m ? `their ${m[1]} sets off “${m[2]}”` : why;
};

/** What one member brings to the damage dealer, as a phrase without the name ("gives …; sets off …"), and the points it earns. */
function given(t: ExplainTeam, who: string, name: (id: string) => string): { phrase: string; points: number } {
  const own = t.lines.filter((l) => l.who === who);
  const counted = own.filter((l) => l.points > 0);
  const lost = own.filter((l) => l.points < 0);
  const support = own.filter((l) => l.kind === 'support');
  const turnedOn = t.lines.filter((l) => l.kind === 'switched-on' && l.helpers?.includes(who));
  const dd = name(t.dd);
  const parts: string[] = [];
  if (who === t.dd) {
    const on = counted.filter((l) => l.kind === 'switched-on');
    parts.push(on.length ? `the team switches on ${on.length === 1 ? 'one of their abilities' : `${on.length} of their abilities`}: ${list(on.map((l) => bare(l.tag)))}` : 'none of their abilities depend on who is in the team');
  } else {
    const buffs = counted.filter((l) => l.kind === 'buff');
    const chains = counted.filter((l) => l.kind === 'chain');
    if (buffs.length) parts.push(`gives ${dd} ${list(buffs.map((l) => bare(l.tag)))}`);
    for (const c of chains) parts.push(chainWords(c.why));
    // Switching on the damage dealer's ability is counted once, on the damage dealer's line.
    if (turnedOn.length) parts.push(`switches on ${dd}'s ${list(turnedOn.map((l) => `“${bare(l.tag)}”`))}`);
    if (support.length && !buffs.length && !chains.length) parts.push(`team support only (${list(support.map((l) => bare(l.tag)))}): breaks ties, adds no points`);
  }
  for (const l of own)
    if (l.kind === 'build' && l.build)
      parts.push(
        l.build.have.startsWith('assumed')
          ? `best when built for ${statWords(l.build.stat)} (assumed here)`
          : `the team wants them built for ${statWords(l.build.stat)}: ${FIT_WORD[l.build.fit]}${l.build.fit === 'no-build' ? '' : ` (${l.build.have})`}`,
      );
  for (const l of lost) parts.push(l.kind === 'weak-fit' ? `brings nothing ${dd} uses (−1)` : `${bare(l.tag)}: ${l.why} (−1)`);
  const points = counted.reduce((n, l) => n + l.points, 0) + lost.reduce((n, l) => n + l.points, 0);
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
  const gap = best.count - mine.count;
  const newcomers = best.members.filter((id) => !mine.members.includes(id));
  if (gap > 0 && newcomers.length) {
    const leaving = mine.members.filter((id) => !best.members.includes(id));
    missing.unshift(`The best team found for ${dd} is ${list(best.members.map(name))}: ${best.count} points against ${mine.count} here${leaving.length ? `, swapping ${list(leaving.map(name))} for ${list(newcomers.map(name))}` : ''}.`);
    for (const id of newcomers) {
      const g = given(best, id, name);
      missing.push(`${name(id)} would bring: ${g.phrase} (${pts(g.points)}).`);
    }
  }
  const helpers = members.filter((m) => m.id !== mine.dd && m.points > 0).map((m) => name(m.id));
  const headline = `${dd} deals the damage. ${helpers.length ? `${list(helpers)} ${helpers.length === 1 ? 'connects' : 'connect'} with ${dd}'s kit` : `No teammate connects with ${dd}'s kit`}${gap > 0 ? (newcomers.length ? `; ${plural(gap, 'point')} short of the best team found` : `; ${plural(gap, 'point')} more when fully built`) : '; no better team found'}.`;
  return { headline, members, missing };
}
