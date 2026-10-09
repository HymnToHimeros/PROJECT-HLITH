/**
 * Example events so the Events screen shows what it looks like before the
 * game's real event list is added. Built from the game record only (its
 * premium currency), so it works for any game. Every example is shown with an
 * EXAMPLE badge; ids start with `example-`. Your states and claimed login days
 * on these are saved for real.
 */
import type { GameContract, GameEvent } from '../../core/contract';

const DAY = 86_400_000;

/** The currency one pull is bought with (not the paid one). */
export const premiumCurrency = (game: GameContract) => game.currencies.find((c) => c.perPull && !c.paid);

export function exampleEvents(game: GameContract, now: number): GameEvent[] {
  const currency = premiumCurrency(game)?.id ?? game.currencies[0]?.id ?? '';
  const at = (days: number) => new Date(now + days * DAY).toISOString();
  return [
    { id: 'example-limited', title: 'Limited story event', kind: 'event', start: at(-4), end: at(10), reward: 1000, currency },
    { id: 'example-login', title: 'Daily login event', kind: 'login', start: at(-2), end: at(6), reward: 700, currency, loginDays: 7 },
    { id: 'example-web', title: 'Web event', kind: 'web', start: at(-5), end: at(2), reward: 120, currency },
    { id: 'example-bonus', title: 'Double drops bonus', kind: 'bonus', start: at(-1), end: at(5), reward: null, currency },
    { id: 'example-next', title: 'Next limited event', kind: 'event', start: at(8), end: at(22), reward: 900, currency },
    { id: 'example-rumour', title: 'Rumoured collaboration event', kind: 'event', start: at(26), end: at(40), reward: null, currency, leak: { source: 'example leak source' } },
    { id: 'example-past', title: 'Previous limited event', kind: 'event', start: at(-20), end: at(-3), reward: 800, currency },
  ];
}
