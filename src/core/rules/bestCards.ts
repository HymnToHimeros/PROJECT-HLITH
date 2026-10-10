/**
 * "Best found from your characters" cards (owner's job T41, both games). When none of a damage dealer's recommended
 * cards reaches 90% and their best team found from your characters is a line-up no card shows, that team gets a
 * card of its own (Aventurine • Waveflair + Mortenax Blade + Ashveil + Robin • Summeretto: no game list has all
 * three). Game-free: each game hands over its cards' verdicts and its best-team search.
 */
import type { TeamPreset } from '../contract';

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

/** `size`: the game's team size; a best team found that can't fill it (a carry whose lists name too few of yours) gets no card. */
export function bestFoundCards(cards: ShownCard[], bestOf: (dd: string) => string[] | undefined, name: (id: string) => string, size: number): TeamPreset[] {
  const out: TeamPreset[] = [];
  for (const dd of [...new Set(cards.map((c) => c.dd))]) {
    const mine = cards.filter((c) => c.dd === dd);
    if (Math.max(...mine.map((c) => c.percent)) >= BEST_CARD_BELOW) continue;
    const best = bestOf(dd);
    if (!best || best.length < size || mine.some((c) => same(c.members, best))) continue;
    out.push({ id: `${BEST_FOUND}-${dd}`, name: `${name(dd)} · best found from your characters`, slots: best.map((id) => ({ characters: [id] })), source: BEST_FOUND });
  }
  return out;
}
