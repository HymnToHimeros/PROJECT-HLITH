/**
 * "Assume signature + average build" (owner's job T34): an owned character with no saved build can be scored as if
 * they had their signature weapon and an ordinary build, instead of at base. Game-free: each game hands over its
 * recommended builds, signature weapons and gear slots. Rules: docs/logic/build-score.md, "Assumed builds".
 *
 * The average build, built from the game's own recommendation:
 * - level cap, signature weapon at the first refinement (Superimposition / Phase 1);
 * - the first recommended main stat on every slot the game names (fixed slots keep their one main stat);
 * - the recommended sets on the slots the game puts them on;
 * - each recommended sub stat once per piece where it can appear (at most 4, never the piece's main stat), 1 roll
 *   each, no upgrades on top. Roll values are not assumed (recorded as 0); only which stats and how many rolls.
 * Right sets and main stats, ordinary sub stats: about half the rolls of a well-rolled build.
 */
import type { CharacterBuild, RecommendedBuild, TeamAccount } from '../contract';

/** What the average build is, in plain words. */
export const AVERAGE_WORDS = 'average build (recommended sets and main stats, 1 roll per recommended sub stat)';
/** Said wherever an assumed build is used: "assumed: signature <weapon>, average build (…)". */
export const assumedWords = (signature?: string) => `assumed: ${signature ? `signature ${signature}, ` : ''}${AVERAGE_WORDS}`;
/** Sub stats per piece (both games). */
const SUBS_PER_PIECE = 4;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export interface AverageFacts {
  levelMax: number;
  /** Gear slots in game order, with the main stats each can roll. */
  slots: { id: string; mains: string[] }[];
  /** Which slots a set of this many pieces goes on (HSR: cavern 4 on Head–Feet, planar 2 on Sphere and Rope). Empty = any. */
  setSlots: (pieces: number) => string[];
}

export function averageBuild(characterId: string, rec: RecommendedBuild, facts: AverageFacts, dupes = 0): CharacterBuild {
  // Sets: each recommended set (first option) on its slots; where the game doesn't say which slots, fill in order.
  const setOf = new Map<string, string>();
  let next = 0;
  for (const s of rec.sets) {
    const name = s.options[0];
    if (!name) continue;
    const on = facts.setSlots(s.pieces);
    const slots = on.length ? on : facts.slots.slice(next, next + s.pieces).map((x) => x.id);
    if (!on.length) next += s.pieces;
    for (const id of slots) if (!setOf.has(id)) setOf.set(id, name);
  }
  const gear = facts.slots.map((slot) => {
    const main = (slot.mains.length > 1 ? rec.mainStats[slot.id]?.[0] : undefined) ?? slot.mains[0] ?? '';
    const subs = rec.subStats.filter((s) => norm(s) !== norm(main)).slice(0, SUBS_PER_PIECE);
    const set = setOf.get(slot.id);
    return {
      slot: slot.id,
      main,
      subs: Object.fromEntries(subs.map((s) => [s, 0])),
      rolls: Object.fromEntries(subs.map((s) => [s, 1])),
      ...(set ? { set } : {}),
    };
  });
  return { characterId, level: facts.levelMax, dupes, gear };
}

export interface AssumeFacts extends AverageFacts {
  recommended: (id: string) => RecommendedBuild | undefined;
  signature: (id: string) => { id: string; name: string } | undefined;
}

/**
 * The account the team rules read, with T34's switch applied: when `assumeAverage` is on, an owned character with
 * no saved build gets their signature weapon and an average build, and `assumed(id)` says so. Saved builds always
 * win; with the switch off the account is unchanged ("no build saved, scored at base").
 */
export function withAssumedBuilds(a: TeamAccount, facts: AssumeFacts): TeamAccount {
  if (!a.assumeAverage) return a;
  const assumed = (id: string) => a.owned(id) && !a.build?.(id) && !a.weapon?.(id) && !!facts.recommended(id);
  return {
    ...a,
    assumed,
    weapon: (id) => {
      if (!assumed(id)) return a.weapon?.(id);
      const s = facts.signature(id);
      return s ? { id: s.id, name: s.name, refine: 1 } : undefined;
    },
    build: (id) => {
      if (!assumed(id)) return a.build?.(id);
      const rec = facts.recommended(id);
      return rec ? averageBuild(id, rec, facts, a.dupes(id)) : undefined;
    },
  };
}

/** One line for a team's Why: who in it was scored with an assumed build (T34); undefined = nobody. */
export function assumedLine(members: string[], a: TeamAccount, name: (id: string) => string): string | undefined {
  const who = members.filter((id) => a.assumed?.(id));
  if (!who.length) return undefined;
  const list = who.map((id) => {
    const w = a.weapon?.(id);
    return `${name(id)}${w ? ` (signature ${w.name})` : ''}`;
  });
  return `No build saved for ${list.join(', ')}: scored with their signature weapon and an ${AVERAGE_WORDS}, as your setting asks.`;
}
