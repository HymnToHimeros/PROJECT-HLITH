/**
 * Earned titles (T64 B2): a title you can wear only while you hold the badge behind it, so
 * every one is earned from your own data (badges.ts). The server checks the same badge before
 * a card someone else opens shows it (public.profile_card, 0018). No React here.
 */
import type { BadgeId } from './badges';

export const EARNED_TITLE: Readonly<Partial<Record<BadgeId, string>>> = {
  seated: 'Seated on HLIÐSKJÁLF',
  'first-light': 'Bearer of First Light',
  hundred: 'Hundred-Caster',
  thousand: 'Thousand-Caster',
  storm: 'Weathered the Storm',
  'shield-wall': 'Captain of the Shield-Wall',
  'between-worlds': 'Walker Between Worlds',
  'thirty-dawns': 'Keeper of Thirty Dawns',
  'self-portrait': 'Face of the Hall',
  hall: 'Keeper of the Hall',
  treasurer: 'Keeper of the Hoard',
  sagas: 'Teller of Sagas',
  gatherer: 'Gatherer of the Nine Realms',
  'rune-days': 'Rune-Marked',
  'feast-days': 'Guest of the Feast',
  smith: 'Smith of the Hall',
};

export const earnedTitle = (id: BadgeId | null | undefined): string | null => (id ? (EARNED_TITLE[id] ?? null) : null);
