/**
 * Leaked characters in teams (owner's job T39): "leaked charchter cna also be used to build teams with … therfore u
 * cna for exmaple pre upll a chacrhter". A leak is read from its beta kit text like anyone else, but every place it
 * shows says so, and it joins other characters' teams only when the owner shows leaks (TeamAccount.showLeaks).
 * Game-free; each game's library lists its leaks (Character.leak). Rules: docs/logic/hsr-decisions.md 36.
 */
import type { TeamAccount } from '../contract';

export const LEAK_WORDS = 'unverified beta kit, may change';

/** Every character the check may use for this account: leaks only when shown, and never anyone the owner hid. */
export const usable = (ids: Iterable<string>, a: TeamAccount, leaks: Map<string, string> | undefined) =>
  [...ids].filter((id) => !a.skip?.(id) && (a.showLeaks || !leaks?.has(id)));

/** One line per leak in a team: "Leak: X: unverified beta kit, may change (source)." */
export function leakLines(members: string[], leaks: Map<string, string> | undefined, name: (id: string) => string): string[] {
  return members.filter((id) => leaks?.has(id)).map((id) => `Leak: ${name(id)}: ${LEAK_WORDS} (${leaks?.get(id) ?? 'leak'}).`);
}

/** A leaked carry has no game team list yet: their teammates come from the kit lines alone. */
export const noListLine = (name: string) => `No game team list yet for ${name}: teammates are the characters whose kits connect with theirs.`;
