/**
 * Example endgame cycle dates, so Calendar and Events show what a cycle looks
 * like before the game record knows when its cycles start. Built from the game
 * record (real names and lengths), so it works for any game. Every id starts
 * with `example-` and everything here is shown with an EXAMPLE badge.
 */
import type { GameContract } from '../../core/contract';

const DAY = 86_400_000;

/** Endgame cycles the record lists without a start date: example dates, real names and lengths. */
export function exampleCycles(game: GameContract, now: number): { id: string; rowId: string; title: string; start: number; end: number }[] {
  return game.income
    .filter((r) => r.schedule.kind === 'cycle' && !r.schedule.anchor)
    .map((r, i) => {
      const days = r.schedule.kind === 'cycle' ? r.schedule.days : 14;
      const start = now - (3 + i * 4) * DAY;
      return { id: `example-cycle-${r.id}`, rowId: r.id, title: r.label, start, end: start + days * DAY };
    });
}
