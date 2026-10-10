/**
 * Build score (docs/logic/build-score.md): a saved build checked against the
 * game's own recommended build, part by part. Every part says what it
 * compared and what it found; a part with nothing entered is "No data yet"
 * and is left out of the score, never guessed.
 */
import { known, unknown, type BuildScorePart, type CharacterBuild, type Known, type RecommendedBuild } from '../contract';

export interface BuildScoreFacts {
  levelMax: number;
  weaponLevelMax: number;
  /** Slots that count toward each set size: HSR relic sets are worn on 4 cavern slots and planar sets on 2; ZZZ discs share all 6. */
  setSlots: (pieces: number) => string[];
}

export type BuildScore = Known<{ score: number; grade: string; parts: BuildScorePart[]; basis: string }>;

/** S 90+, A 75+, B 60+, C 40+, else D. */
export const gradeOf = (score: number) => (score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D');

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const pct = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 100);

export function scoreBuild(build: CharacterBuild, rec: RecommendedBuild | undefined, facts: BuildScoreFacts): BuildScore {
  if (!rec) return unknown('enter-manually');
  const parts: BuildScorePart[] = [];

  // 1. Level against the level cap.
  parts.push({ label: 'Level', value: pct(build.level / facts.levelMax), detail: `Level ${build.level} of ${facts.levelMax}.` });

  // 2. Weapon: one the game recommends, and its level.
  if (!build.weapon) parts.push({ label: 'Weapon', value: null, detail: 'No weapon entered.' });
  else if (!rec.weapons.length) parts.push({ label: 'Weapon', value: null, detail: `${build.weapon.name}: the game recommends no weapon to compare with.` });
  else {
    const rank = rec.weapons.findIndex((w) => same(w, build.weapon?.name ?? ''));
    parts.push({
      label: 'Weapon',
      value: rank >= 0 ? 100 : 0,
      detail: rank >= 0 ? `${build.weapon.name} is recommended${rec.weapons.length > 1 ? ` (#${rank + 1} of ${rec.weapons.length})` : ''}.` : `${build.weapon.name} is not one of the recommended: ${rec.weapons.join(', ')}.`,
    });
  }
  if (build.weapon?.level !== undefined) parts.push({ label: 'Weapon level', value: pct(build.weapon.level / facts.weaponLevelMax), detail: `Level ${build.weapon.level} of ${facts.weaponLevelMax}.` });

  // 3. Sets: each recommended set size is worn (any of its options, on enough pieces).
  const withSet = build.gear.filter((g) => g.set);
  for (const need of rec.sets.filter((s) => s.options.length)) {
    const label = `${need.pieces}-piece set`;
    if (!withSet.length) {
      parts.push({ label, value: null, detail: 'No sets entered.' });
      continue;
    }
    const slots = facts.setSlots(need.pieces);
    const count = (name: string) => withSet.filter((g) => (!slots.length || slots.includes(g.slot)) && same(g.set ?? '', name)).length;
    const hit = need.options.find((o) => count(o) >= need.pieces);
    const best = [...need.options].sort((a, b) => count(b) - count(a))[0] ?? '';
    parts.push({
      label,
      value: hit ? 100 : 0,
      detail: hit ? `${hit} on ${count(hit)} pieces.` : `Wants ${need.options.join(' or ')} on ${need.pieces} pieces; found ${count(best)} of ${best}.`,
    });
  }

  // 4. Main stats: each recommended slot has one of its recommended main stats.
  for (const [slot, wants] of Object.entries(rec.mainStats)) {
    const piece = build.gear.find((g) => g.slot === slot);
    if (!piece) parts.push({ label: `${slot} main stat`, value: null, detail: `No ${slot} entered.` });
    else {
      const ok = wants.some((w) => same(w, piece.main));
      parts.push({ label: `${slot} main stat`, value: ok ? 100 : 0, detail: ok ? `${piece.main}, as recommended.` : `${piece.main}; recommended: ${wants.join(' or ')}.` });
    }
  }

  // 5. Sub stats: the share of each piece's sub stats (by rolls when known) that the game recommends.
  const withSubs = build.gear.filter((g) => Object.keys(g.subs).length);
  if (!rec.subStats.length) parts.push({ label: 'Sub stats', value: null, detail: 'The game recommends no sub stats to compare with.' });
  else if (!withSubs.length) parts.push({ label: 'Sub stats', value: null, detail: 'No sub stats entered.' });
  else {
    let good = 0;
    let all = 0;
    for (const g of withSubs)
      for (const stat of Object.keys(g.subs)) {
        const weight = g.rolls?.[stat] ?? 1;
        all += weight;
        if (rec.subStats.some((w) => same(w, stat))) good += weight;
      }
    const byRolls = withSubs.some((g) => g.rolls && Object.keys(g.rolls).length);
    parts.push({
      label: 'Sub stats',
      value: pct(all ? good / all : 0),
      detail: `${good} of ${all} ${byRolls ? 'rolls' : 'sub stats'} on ${withSubs.length} piece${withSubs.length === 1 ? '' : 's'} are recommended (${rec.subStats.join(', ')}).`,
    });
  }

  const counted = parts.filter((p): p is BuildScorePart & { value: number } => p.value !== null);
  if (!counted.length) return unknown('enter-manually');
  const score = Math.round(counted.reduce((n, p) => n + p.value, 0) / counted.length);
  const missing = parts.length - counted.length;
  const basis = `Average of ${counted.length} checked part${counted.length === 1 ? '' : 's'} against ${rec.source}${missing ? `; ${missing} part${missing === 1 ? '' : 's'} with no data yet not counted` : ''}.`;
  return known({ score, grade: gradeOf(score), parts, basis }, 'user');
}
