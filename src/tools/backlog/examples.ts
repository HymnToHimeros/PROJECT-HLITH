/**
 * Example backlog so the screen shows what it looks like before the game's
 * real list is added. Built from the game record only (its premium currency
 * and its word for a character), so it works for any game. Every example item
 * and example done count is shown with an EXAMPLE badge; ids start with
 * `example-`. Done counts you enter on these are saved for real and replace
 * the example count.
 */
import type { BacklogItem, GameContract } from '../../core/contract';
import { premiumCurrency } from '../events/examples';

export function exampleBacklog(game: GameContract): { items: BacklogItem[]; done: Record<string, number> } {
  const currency = premiumCurrency(game)?.id ?? game.currencies[0]?.id ?? '';
  const rows: [id: string, category: string, title: string, total: number, reward: number | null, done: number][] = [
    ['example-story-main', 'story', 'Main story chapters', 52, 3120, 38],
    ['example-story-interludes', 'story', 'Story interludes', 12, 720, 12],
    ['example-side-characters', 'side-quests', `${game.terms.character} stories`, 40, 1200, 21],
    ['example-side-quests', 'side-quests', 'Side quests', 120, null, 64],
    ['example-exploration-chests', 'exploration', 'Treasure chests', 2400, 2900, 1820],
    ['example-exploration-puzzles', 'exploration', 'Puzzles and collectibles', 180, 900, 95],
    ['example-modes', 'modes', 'Permanent mode stages', 30, 1800, 18],
    ['example-achievements', 'achievements', 'Achievements', 780, 1840, 412],
  ];
  return {
    items: rows.map(([id, category, title, total, reward]) => ({ id, category, title, total, reward, currency })),
    done: Object.fromEntries(rows.map(([id, , , , , done]) => [id, done])),
  };
}
