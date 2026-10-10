/**
 * Example backlog so the screen shows what it looks like before the game's
 * real list is added: one of each kind (story checklist, side quests in
 * regions, counters, exploration in %). Built from the game record only (its
 * premium currency and its words), so it works for any game, with generic
 * names on purpose. Every example shows an EXAMPLE badge; ids start with
 * `example-`. Everything is editable: changing an example makes it your own
 * item, and done counts you enter are saved for real.
 */
import type { BacklogItem, GameContract } from '../../core/contract';
import { premiumCurrency } from '../events/examples';

export function exampleBacklog(game: GameContract): { items: BacklogItem[]; done: Record<string, number> } {
  const currency = premiumCurrency(game)?.id ?? game.currencies[0]?.id ?? '';
  const item = (id: string, category: string, title: string, total: number, reward: number | null, more: Partial<BacklogItem> = {}): BacklogItem => ({
    id: `example-${id}`,
    category,
    title,
    total,
    reward,
    currency,
    ...more,
  });
  const steps = ['Prologue', 'Chapter 1', 'Chapter 2', 'Chapter 3 · start', 'Chapter 3 · end', 'Chapter 4 (latest)'];
  const items: BacklogItem[] = [
    item('story', 'story', 'Main story', steps.length, 0, { steps }),
    item('side-1-a', 'side-quests', 'Side quest A', 1, 30, { group: 'First region' }),
    item('side-1-b', 'side-quests', 'Side quest B', 1, 30, { group: 'First region' }),
    item('side-2-a', 'side-quests', 'Side quest C', 1, 40, { group: 'Second region' }),
    item('side-2-b', 'side-quests', 'Side quest D', 1, null, { group: 'Second region' }),
    item('event-1', 'permanent-events', 'A permanent event', 420, 420),
    item('event-2', 'permanent-events', 'Another permanent event', 300, 300),
    item('explore-1', 'exploration', 'First region', 100, 0, { unit: '%' }),
    item('explore-2', 'exploration', 'Second region', 100, null, { unit: '%' }),
    item('mode-1', 'modes', 'A permanent mode', 2400, 2400, { note: 'Rewards as points: one point per premium currency.' }),
    item('achievements', 'achievements', 'Achievements', 780, 1840),
  ];
  const done: Record<string, number> = {
    'example-story': 4,
    'example-side-1-a': 1,
    'example-side-1-b': 1,
    'example-side-2-a': 0,
    'example-event-1': 120,
    'example-explore-1': 100,
    'example-explore-2': 64,
    'example-mode-1': 900,
    'example-achievements': 412,
  };
  return { items, done };
}
