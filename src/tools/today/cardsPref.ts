/**
 * Customise → Today (T52d): which cards Today shows, in which column, in what order.
 * The stat tiles and the server/currency row stay on top and can be hidden; the rest are
 * arranged in two columns (one on a phone: left, then right). Missing = the design's layout.
 */
export const TODAY_CARDS = ['tasks', 'tonight', 'wishlist', 'banners', 'coming'] as const;
export type TodayCard = (typeof TODAY_CARDS)[number];
export const TOP_PARTS = ['tiles', 'chips'] as const;
export type TopPart = (typeof TOP_PARTS)[number];

export const TODAY_CARD_LABEL: Record<TodayCard | TopPart, string> = {
  tiles: 'Resets, pulls and stamina tiles',
  chips: 'Server and currencies',
  tasks: 'Open tasks',
  tonight: 'Tonight’s run',
  wishlist: 'Wishlist',
  banners: 'Live banners',
  coming: 'Coming up',
};

export interface TodayLayout {
  left: TodayCard[];
  right: TodayCard[];
  hidden: (TodayCard | TopPart)[];
}

export const DEFAULT_TODAY: TodayLayout = { left: ['tasks', 'tonight', 'wishlist'], right: ['banners', 'coming'], hidden: [] };

const isCard = (v: unknown): v is TodayCard => (TODAY_CARDS as readonly unknown[]).includes(v);
const isPart = (v: unknown): v is TodayCard | TopPart => isCard(v) || (TOP_PARTS as readonly unknown[]).includes(v);

/** Any saved value → a full layout: every card exactly once; a card the app gains later lands where the design puts it. */
export function cleanToday(raw: unknown): TodayLayout {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const seen = new Set<TodayCard>();
  const take = (v: unknown) =>
    (Array.isArray(v) ? v : []).filter((x): x is TodayCard => {
      if (!isCard(x) || seen.has(x)) return false;
      seen.add(x);
      return true;
    });
  const left = take(r.left);
  const right = take(r.right);
  for (const c of TODAY_CARDS) if (!seen.has(c)) (DEFAULT_TODAY.left.includes(c) ? left : right).push(c);
  const hidden = [...new Set((Array.isArray(r.hidden) ? r.hidden : []).filter(isPart))];
  return { left, right, hidden };
}

/** Move a card one step up or down within its column, or to the other column (at the end). */
export function moveCard(l: TodayLayout, card: TodayCard, to: 'up' | 'down' | 'left' | 'right'): TodayLayout {
  const side = l.left.includes(card) ? 'left' : 'right';
  if (to === 'left' || to === 'right') {
    if (to === side) return l;
    return { ...l, [side]: l[side].filter((c) => c !== card), [to]: [...l[to], card] };
  }
  const list = [...l[side]];
  const i = list.indexOf(card);
  const j = to === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return l;
  [list[i], list[j]] = [list[j] as TodayCard, list[i] as TodayCard];
  return { ...l, [side]: list };
}
