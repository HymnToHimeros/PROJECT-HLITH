/**
 * Example banners for a game whose banner list hasn't been added yet. The live
 * ones are the same examples Pulls uses; on top of that one upcoming banner and
 * one leaked banner, so every part of the screen can be seen. Built from the
 * game record and its character list, so it works for any game. Every one is
 * shown with an EXAMPLE badge and disappears once the real list is added.
 */
import type { Banner, Character, GameContract } from '../../core/contract';
import { exampleBanners as liveExamples } from '../pulls/examples';

const DAY = 86_400_000;

export function exampleBanners(game: GameContract, characters: Character[], now: number): Banner[] {
  const live = liveExamples(game, characters, now);
  const type = game.bannerTypes.find((t) => t.target === 'character');
  if (!type) return live;
  const tops = characters.filter((c) => c.rarity === 'top').sort((a, b) => (b.releasedAt ?? b.id).localeCompare(a.releasedAt ?? a.id));
  const next = tops[1];
  const later = tops[2];
  const upcoming: Banner[] = [
    {
      id: `example-${type.id}-next`,
      type: type.id,
      title: next?.name ?? 'Next featured character',
      featured: next ? [next.id] : [],
      start: new Date(now + 18 * DAY).toISOString(),
      end: new Date(now + 39 * DAY).toISOString(),
    },
    {
      id: `example-${type.id}-leak`,
      type: type.id,
      title: later?.name ?? 'Leaked featured character',
      featured: later ? [later.id] : [],
      start: new Date(now + 39 * DAY).toISOString(),
      end: new Date(now + 60 * DAY).toISOString(),
      leak: { source: 'example source' },
    },
  ];
  return [...live, ...upcoming];
}
