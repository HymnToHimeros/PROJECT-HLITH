/**
 * Example data so the Pulls screens show what they look like before you add
 * your own. Built from the game record and its character list, so it works for
 * any game. Everything here is shown with an EXAMPLE badge and disappears as
 * soon as you enter or import your own data.
 */
import type { Banner, Character, GameContract, PullRecord } from '../../core/contract';
import { known, type Known } from '../../core/contract/known';

const DAY = 86_400_000;

export function exampleBank(game: GameContract): Known<Record<string, number>> {
  const premium = game.currencies.find((c) => c.perPull && !c.paid);
  const item = game.currencies.find((c) => c.pullItemFor?.some((b) => game.bannerTypes.find((t) => t.id === b)?.target === 'character'));
  const value: Record<string, number> = {};
  if (premium) value[premium.id] = 8_400;
  if (item) value[item.id] = 12;
  return known(value, 'user', new Date().toISOString());
}

/** A few banners: the newest top-rarity character on each character banner type, open for 18 more days. */
export function exampleBanners(game: GameContract, characters: Character[], now: number): Banner[] {
  const tops = newestTops(characters);
  return game.bannerTypes
    .filter((t) => t.target === 'character' || t.target === 'weapon')
    .map((t, i) => {
      const star = tops[i % Math.max(tops.length, 1)];
      return {
        id: `example-${t.id}`,
        type: t.id,
        title: t.target === 'character' ? (star?.name ?? 'Featured character') : `${game.terms.weapon} for ${star?.name ?? 'the featured character'}`,
        featured: star ? [star.id] : [],
        start: new Date(now - 3 * DAY).toISOString(),
        end: new Date(now + 18 * DAY).toISOString(),
      };
    });
}

const newestTops = (characters: Character[]) => characters.filter((c) => c.rarity === 'top').sort((a, b) => (b.releasedAt ?? b.id).localeCompare(a.releasedAt ?? a.id));

export const exampleVersionEnd = (now: number) => now + 21 * DAY;

/**
 * A short, believable history per banner type: on the character banner a lost
 * 50/50 at 74 then a win at 62, then 18 pulls since; elsewhere a few pulls.
 */
export function exampleHistory(game: GameContract, characters: Character[], now: number): PullRecord[] {
  const tops = newestTops(characters);
  const mids = characters.filter((c) => c.rarity === 'mid');
  const out: PullRecord[] = [];
  let t = now - 60 * DAY;
  let n = 0;
  const add = (bannerType: string, rarity: PullRecord['rarity'], who?: Character, featured?: boolean) => {
    n++;
    t += 30 * 60_000;
    out.push({
      id: `example-${String(n).padStart(5, '0')}`,
      bannerType,
      itemId: who?.id ?? 'example-item',
      name: who?.name ?? (rarity === 'low' ? `${game.terms.weapon} (3★)` : 'Item'),
      rarity,
      time: new Date(t).toISOString(),
      ...(featured === undefined ? {} : { featured }),
    });
  };
  for (const type of game.bannerTypes) {
    if (type.pity.kind !== 'hard-pity') continue;
    if (type.target === 'character') {
      for (let i = 1; i <= 73; i++) add(type.id, i % 10 === 0 ? 'mid' : 'low', i % 10 === 0 ? mids[i % Math.max(mids.length, 1)] : undefined);
      add(type.id, 'top', tops[1], false);
      for (let i = 1; i <= 61; i++) add(type.id, i % 10 === 0 ? 'mid' : 'low', i % 10 === 0 ? mids[i % Math.max(mids.length, 1)] : undefined);
      add(type.id, 'top', tops[0], true);
      for (let i = 1; i <= 18; i++) add(type.id, i % 10 === 0 ? 'mid' : 'low', i % 10 === 0 ? mids[0] : undefined);
    } else {
      for (let i = 1; i <= 12; i++) add(type.id, i % 10 === 0 ? 'mid' : 'low', i % 10 === 0 ? mids[0] : undefined);
    }
  }
  return out;
}
