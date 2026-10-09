/**
 * Intel: new content no other module covers, built only from what the game's
 * lists already say. A character counts as upcoming when its listed release
 * date is still ahead, or when it first shows up on a leaked banner and isn't
 * released yet. Every item keeps the source it came from.
 */
import type { Banner, Character, GameContract } from '../../core/contract';

export interface IntelItem {
  id: string;
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
  return [game.terms.rarity[c.rarity], element, role].filter(Boolean).join(' · ');
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
    items.set(c.id, { id: `character-${c.id}`, group, title: c.name, detail: characterDetail(game, c), when, whenLabel, sources: [source], characterId: c.id });
  };

  const released = (c: Character) => c.releasedAt !== undefined && Date.parse(c.releasedAt) <= now;
  for (const c of characters) {
    if (c.releasedAt && Date.parse(c.releasedAt) > now) add(c, Date.parse(c.releasedAt), 'Release date in the game files', c.source ?? 'game list');
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

/** Two example cards that only show what Intel looks like. Generic on purpose: no real names. */
export function exampleIntel(game: GameContract, now: number): IntelItem[] {
  const top = game.terms.rarity.top;
  return [
    {
      id: 'example-intel-character',
      group: `${game.terms.character}s`,
      title: `A new ${top} ${game.terms.character.toLowerCase()}`,
      detail: 'Name, element and role show here',
      when: now + 30 * DAY,
      whenLabel: 'Expected',
      sources: ['example source'],
    },
    {
      id: 'example-intel-weapon',
      group: `${game.terms.weapon}s`,
      title: `A new ${top} ${game.terms.weapon}`,
      detail: 'Who it is made for shows here',
      when: now + 30 * DAY,
      whenLabel: 'Expected',
      sources: ['example source'],
    },
  ];
}
