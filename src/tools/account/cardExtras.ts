/**
 * More for the profile card (T64 B2), all from your own imported pull history. No React.
 *  - The luckiest pull: the top-rarity result that came after the fewest pulls. Only counts
 *    that can be proven: the count before the first top result in your history may have
 *    started on pulls you never imported, so it is left out.
 *  - Pull numbers per game: total pulls, average pulls per top result, the 50/50 record.
 *    Nothing is filled in: a number HLITH can't work out shows as "No data yet".
 * The server works these out the same way for a card someone else opens
 * (public.profile_card, 0018); a test keeps the two in step.
 */
import type { GameContract, GameId, PullRecord } from '../../core/contract';
import type { GameUserData } from '../../core/data/userData';
import { luck } from '../pity/pity';

export interface LuckiestPull {
  game: GameId;
  itemId: string;
  name: string;
  bannerType: string;
  /** The pull it came on, counting from the top result before it (1 = the very first pull). */
  pulls: number;
  time: string;
}

const byTime = (a: PullRecord, b: PullRecord) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id);

/** The luckiest provable top result across your games, or null. Ties go to the earliest. */
export function luckiestPull(games: GameContract[], data: Record<GameId, GameUserData | undefined>): LuckiestPull | null {
  let best: LuckiestPull | null = null;
  for (const g of games) {
    const pulls = data[g.id]?.pulls ?? [];
    for (const bt of new Set(pulls.map((p) => p.bannerType))) {
      let since = 0;
      let counting = false;
      for (const p of pulls.filter((x) => x.bannerType === bt).sort(byTime)) {
        since++;
        if (p.rarity !== 'top') continue;
        if (counting && (!best || since < best.pulls || (since === best.pulls && p.time < best.time))) {
          best = { game: g.id, itemId: p.itemId, name: p.name, bannerType: bt, pulls: since, time: p.time };
        }
        counting = true;
        since = 0;
      }
    }
  }
  return best;
}

export interface GameNumbers {
  game: GameId;
  total: number;
  tops: number;
  /** Average pulls per top result; null when there is none yet. */
  averagePity: number | null;
  /** 50/50s won and lost (guaranteed results don't count); null rate when none is known. */
  won: number;
  lost: number;
}

/** Pull numbers per game, for games with imported pulls. */
export function gameNumbers(games: GameContract[], data: Record<GameId, GameUserData | undefined>): GameNumbers[] {
  return games.flatMap((g) => {
    const pulls = data[g.id]?.pulls ?? [];
    if (pulls.length === 0) return [];
    let tops = 0;
    let pitySum = 0;
    let won = 0;
    let lost = 0;
    for (const bt of new Set(pulls.map((p) => p.bannerType))) {
      const l = luck(pulls, bt);
      if (l.averagePity.known) pitySum += l.averagePity.value * l.tops;
      tops += l.tops;
      won += l.fiftyFifty.won;
      lost += l.fiftyFifty.lost;
    }
    return [{ game: g.id, total: pulls.length, tops, averagePity: tops ? pitySum / tops : null, won, lost }];
  });
}

/** Share of 50/50s won, 0–1; null when no 50/50 result is known. */
export const winRate = (n: { won: number; lost: number }): number | null => (n.won + n.lost > 0 ? n.won / (n.won + n.lost) : null);
