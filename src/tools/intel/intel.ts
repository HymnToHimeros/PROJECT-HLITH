/**
 * Intel: new content no other module covers, built only from what the game's
 * lists already say. A character counts as upcoming when its listed release
 * date is still ahead, or when it first shows up on a leaked banner and isn't
 * released yet. Every item keeps the source it came from.
 */
import type { Banner, Character, GameContract } from '../../core/contract';

export type IntelKind = 'character' | 'weapon' | 'area' | 'event' | 'system';

export interface IntelItem {
  id: string;
  /** What kind of new content it is (design: Character · Area · Event · System). */
  kind: IntelKind;
  /** Heading it's grouped under, in the game's own words ("Characters", "Agents"…). */
  group: string;
  title: string;
  /** e.g. "5★ · Quantum · Elation". */
  detail: string;
  /** When it's expected, if a list gives a date. */
  when: number | null;
  /** What `when` is, e.g. "Release date in the game files". */
  whenLabel: string;
  sources: string[];
  characterId?: string;
}

export function characterDetail(game: GameContract, c: Character): string {
  const element = game.elements.find((e) => e.id === c.element)?.label;
  const role = game.roles.find((r) => r.id === c.role)?.label;
  return [game.terms.rarity[c.rarity] ?? c.rarity, element, role].filter(Boolean).join(' · ');
}

export function intelItems(game: GameContract, characters: Character[], banners: Banner[], now: number): IntelItem[] {
  const group = `${game.terms.character}s`;
  const items = new Map<string, IntelItem>();
  const add = (c: Character, when: number, whenLabel: string, source: string) => {
    const had = items.get(c.id);
    if (had) {
      if (!had.sources.includes(source)) had.sources.push(source);
      return;
    }
    items.set(c.id, { id: `character-${c.id}`, kind: 'character', group, title: c.name, detail: characterDetail(game, c), when, whenLabel, sources: [source], characterId: c.id });
  };

  const released = (c: Character) => c.releasedAt !== undefined && Date.parse(c.releasedAt) <= now;
  // Characters on a confirmed (non-leak) upcoming banner get a different label.
  const confirmedUpcoming = new Map<string, Banner>();
  for (const b of banners) {
    if (b.leak || Date.parse(b.start) <= now) continue;
    for (const id of b.featured) if (!confirmedUpcoming.has(id)) confirmedUpcoming.set(id, b);
  }
  for (const c of characters) {
    if (!c.releasedAt || Date.parse(c.releasedAt) <= now) continue;
    const banner = confirmedUpcoming.get(c.id);
    if (banner) {
      add(c, Date.parse(c.releasedAt), `Official banner (${banner.title}) starts`, 'official banner');
    } else {
      add(c, Date.parse(c.releasedAt), 'Release date in the game files', c.source ?? 'game list');
    }
  }

  // Characters already on a confirmed banner that has started aren't news.
  const confirmed = new Set(banners.filter((b) => !b.leak && Date.parse(b.start) <= now).flatMap((b) => b.featured));
  const byId = new Map(characters.map((c) => [c.id, c]));
  const leaks = banners.filter((b) => b.leak && Date.parse(b.end) > now).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  for (const b of leaks) {
    for (const id of b.featured) {
      const c = byId.get(id);
      if (!c || released(c) || confirmed.has(id)) continue;
      add(c, Date.parse(b.start), `First leaked banner (${b.title}) starts`, b.leak?.source ?? 'unknown source');
    }
  }
  return [...items.values()].sort((a, b) => (a.when ?? Infinity) - (b.when ?? Infinity) || a.title.localeCompare(b.title));
}

const DAY = 86_400_000;

/** Words for each kind, in the game's own terms when it has them. */
export const kindLabel = (game: GameContract | null, kind: IntelKind): string =>
  kind === 'character' ? (game?.terms.character ?? 'Character') : kind === 'weapon' ? (game?.terms.weapon ?? 'Weapon') : kind === 'area' ? 'Area' : kind === 'event' ? 'Event' : 'System';

/** Example reliability for example cards only (real reliability comes from the owner's leak-source list). */
export type Reliability = 'high' | 'mid' | 'low';
export const exampleReliability: Record<string, Reliability> = {
  'example-intel-character': 'mid',
  'example-intel-weapon': 'mid',
  'example-intel-area': 'low',
  'example-intel-event': 'low',
  'example-intel-system': 'high',
};

/** Example cards that only show what Intel looks like, one per kind. Generic on purpose: no real names. */
export function exampleIntel(game: GameContract, now: number): IntelItem[] {
  const top = game.terms.rarity.top;
  const card = (kind: IntelKind, title: string, detail: string, days: number | null, source: string): IntelItem => ({
    id: `example-intel-${kind}`,
    kind,
    group: kindLabel(game, kind),
    title,
    detail,
    when: days === null ? null : now + days * DAY,
    whenLabel: 'Expected',
    sources: [source],
  });
  return [
    card('character', `A new ${top} ${game.terms.character.toLowerCase()}`, 'Name, element and role show here', 30, 'Example source · beta build'),
    card('weapon', `A new ${top} ${game.terms.weapon}`, 'Who it is made for shows here', 30, 'Example source · beta build'),
    card('area', 'A new map area', 'Where it is and what it unlocks', null, 'Example source · file names only'),
    card('event', 'A new limited event', 'Rewards and dates show here', 44, 'Example source · unconfirmed'),
    card('system', 'A change to an existing mode', 'What changes and when', null, 'Example source · official preview'),
  ];
}
