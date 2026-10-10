/**
 * "Best found from your characters" cards (owner's job T41, both games). When none of a damage dealer's recommended
 * cards reaches 90% and their best team found from your characters is a line-up no card shows, that team gets a
 * card of its own (Aventurine • Waveflair + Mortenax Blade + Ashveil + Robin • Summeretto: no game list has all
 * three). Game-free: each game hands over its cards' verdicts and its best-team search.
 */
import type { TeamAccount, TeamPreset } from '../contract';
import { accountKey } from './fillTeam';

/** `TeamPreset.source` of a best-found card: the screen tags it, and it has no game team list to edit. */
export const BEST_FOUND = 'best-found';
/** Below this, a damage dealer's best card gets a best-found card beside it (MANAGER, T41: "under ~90%"). */
export const BEST_CARD_BELOW = 90;

export interface ShownCard {
  dd: string;
  members: string[];
  percent: number;
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

/**
 * `bestOf`: the damage dealer's best team found from your characters and its own % on your builds, as its card would
 * show it. `size`: the game's team size; a best team found that can't fill it (a carry whose lists name too few of
 * yours) gets no card, and neither does one whose % on your builds isn't above their best card's.
 */
export function bestFoundCards(cards: ShownCard[], bestOf: (dd: string) => { members: string[]; percent: number } | undefined, name: (id: string) => string, size: number): TeamPreset[] {
  const out: TeamPreset[] = [];
  for (const dd of [...new Set(cards.map((c) => c.dd))]) {
    const mine = cards.filter((c) => c.dd === dd);
    const top = Math.max(...mine.map((c) => c.percent));
    if (top >= BEST_CARD_BELOW) continue;
    const found = bestOf(dd);
    const best = found?.members;
    if (!found || !best || best.length < size || found.percent <= top || mine.some((c) => same(c.members, best))) continue;
    out.push({ id: `${BEST_FOUND}-${dd}`, name: `${name(dd)} · best found from your characters`, slots: best.map((id) => ({ characters: [id] })), source: BEST_FOUND });
  }
  return out;
}

const cardCache = new Map<string, TeamPreset[]>();

/**
 * The same cards for the same question: a screen asks on every render (FRAME's note on #93), so the answer is kept,
 * keyed by the cards' slots and lists and everything the account says about every character involved (`ids`: the
 * cards' characters and everyone owned, since the best team found draws on them).
 */
export function cachedCards(game: string, presets: TeamPreset[], ids: string[], account: TeamAccount, make: () => TeamPreset[]): TeamPreset[] {
  const lists = presets.map((p) => `${p.id}:${JSON.stringify(account.teamList?.(p.id) ?? p.slots.map((s) => s.characters))}`).join(';');
  const key = `${game}|${lists}|${accountKey([...new Set([...presets.flatMap((p) => p.slots.flatMap((s) => s.characters)), ...ids])].sort(), account)}`;
  const hit = cardCache.get(key);
  if (hit) return hit;
  const out = make();
  if (cardCache.size >= 50) cardCache.clear();
  cardCache.set(key, out);
  return out;
}
