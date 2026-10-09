/**
 * Example events, endgame cycles and a leaked banner, so Today and Calendar
 * show what they look like before the game's lists are added. Built from the
 * game record, so it works for any game. Every id starts with `example-` and
 * everything here is shown with an EXAMPLE badge.
 */
import type { Banner, Character, GameContract, GameEvent } from '../../core/contract';

const DAY = 86_400_000;
const HOUR = 3_600_000;

export function exampleEvents(game: GameContract, now: number): GameEvent[] {
  const premium = game.currencies.find((c) => c.perPull && !c.paid)?.id ?? '';
  const at = (offset: number) => new Date(now + offset).toISOString();
  return [
    { id: 'example-event-limited', title: 'Limited-time event', kind: 'event', start: at(-9 * DAY), end: at(2 * DAY + 5 * HOUR), reward: null, currency: premium },
    { id: 'example-event-login', title: 'Login event', kind: 'login', start: at(-2 * DAY), end: at(12 * DAY), reward: null, currency: premium, loginDays: 7 },
    { id: 'example-event-web', title: 'Web event', kind: 'web', start: at(4 * DAY), end: at(11 * DAY), reward: null, currency: premium },
  ];
}

/** Endgame cycles the record lists without a start date: example dates, real names and lengths. */
export function exampleCycles(game: GameContract, now: number): { id: string; title: string; start: number; end: number }[] {
  return game.income
    .filter((r) => r.schedule.kind === 'cycle' && !r.schedule.anchor)
    .map((r, i) => {
      const days = r.schedule.kind === 'cycle' ? r.schedule.days : 14;
      const start = now - (3 + i * 4) * DAY;
      return { id: `example-cycle-${r.id}`, title: r.label, start, end: start + days * DAY };
    });
}

/** One leaked banner after the example banners, to show how leaks look. */
export function exampleLeak(game: GameContract, characters: Character[], after: number): Banner | null {
  const type = game.bannerTypes.find((t) => t.target === 'character');
  if (!type) return null;
  const tops = characters.filter((c) => c.rarity === 'top').sort((a, b) => (b.releasedAt ?? b.id).localeCompare(a.releasedAt ?? a.id));
  const star = tops[2] ?? tops[0];
  return {
    id: `example-leak-${type.id}`,
    type: type.id,
    title: star?.name ?? 'Leaked character',
    featured: star ? [star.id] : [],
    start: new Date(after).toISOString(),
    end: new Date(after + 21 * DAY).toISOString(),
    leak: { source: 'example source' },
  };
}
