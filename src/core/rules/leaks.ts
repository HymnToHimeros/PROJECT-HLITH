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

/** A quote a sheet relies on: the kit piece it is from and the words, which must still be in that piece's text. */
export interface SheetQuote {
  piece: string;
  quote: string;
}

/**
 * Owner's job T43: SCHEDULER re-imports leaks' beta kits on every check, and beta text changes between builds. A
 * leak's sheet is stale when a quote it relies on is no longer word for word in its piece, or its kit has a piece the
 * sheet doesn't read (an entry or a "nothing" reason). A stale sheet is not used: its character reads "not read yet",
 * with this reason, until it is read again. Released characters stay checked by the sheet tests (a change fails CI).
 * Returns why it is stale, or undefined when it still matches.
 */
export function staleReason(quotes: SheetQuote[], read: Set<string>, kit: { id: string; gameText: string }[] | undefined): string | undefined {
  if (!kit) return 'its beta kit text is gone';
  const text = new Map(kit.map((s) => [s.id, s.gameText]));
  const changed = quotes.filter((q) => !text.get(q.piece)?.includes(q.quote));
  const added = kit.filter((s) => !read.has(s.id));
  if (!changed.length && !added.length) return undefined;
  const parts = [
    ...(changed.length ? [`${changed.length} quoted line${changed.length === 1 ? '' : 's'} changed`] : []),
    ...(added.length ? [`${added.length} new piece${added.length === 1 ? '' : 's'}`] : []),
  ];
  return `its beta kit changed since it was read (${parts.join(', ')})`;
}

/** "not rated yet: X not read yet" or, for a stale leak sheet, why it isn't read now (T43). */
export const unreadWords = (ids: string[], name: (id: string) => string, stale: Map<string, string> | undefined) =>
  `not rated yet: ${ids.map((id) => (stale?.has(id) ? `${name(id)} (${stale.get(id)})` : name(id))).join(', ')} not read yet`;
