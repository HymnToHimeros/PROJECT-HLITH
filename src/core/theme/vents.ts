/**
 * Customise → Look → Game colours (T52b): pick your own colour for each game. Only these
 * choices are offered, and each one passes the same rules as a game's own colour (7:1 with
 * the text drawn on it, not orange or red, readable as text on every dark theme), tested in
 * tests/themes.test.ts. The game's own colour stays the default. No React here.
 */
import type { GameContract, GameId } from '../contract';

export const VENT_CHOICES: { id: string; label: string; value: string }[] = [
  { id: 'lilac', label: 'Lilac', value: '#A99BFF' },
  { id: 'lime', label: 'Lime', value: '#D4F23A' },
  { id: 'sky', label: 'Sky', value: '#8FD3F0' },
  { id: 'mint', label: 'Mint', value: '#7FE0B8' },
  { id: 'aqua', label: 'Aqua', value: '#6FE3E0' },
  { id: 'pink', label: 'Pink', value: '#F5A8D6' },
  { id: 'ice', label: 'Ice', value: '#CFE3EF' },
  { id: 'butter', label: 'Butter', value: '#F2E27A' },
];

const VALUES = new Set(VENT_CHOICES.map((v) => v.value.toLowerCase()));
export const isVentChoice = (v: unknown): v is string => typeof v === 'string' && VALUES.has(v.toLowerCase());

/** The game as you see it: with your own colour, if you picked one of the allowed choices. */
export function withVent(game: GameContract, chosen: Record<GameId, string> | undefined): GameContract {
  const v = chosen?.[game.id];
  return isVentChoice(v) && v.toLowerCase() !== game.vent.toLowerCase() ? { ...game, vent: v as GameContract['vent'] } : game;
}
