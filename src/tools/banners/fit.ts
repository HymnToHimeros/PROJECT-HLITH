/**
 * Pure helpers for the Banners screen: which banners are live or coming up,
 * and how a featured character fits your roster. Nothing here guesses: a
 * roster you haven't filled in gives "unknown", not "new for you".
 */
import type { Banner, Character, GameContract } from '../../core/contract';
import type { RosterEntry } from '../../core/data/userData';

export interface BannerSplit {
  /** Open now, the one ending soonest first. */
  live: Banner[];
  /** Not started yet, the one starting soonest first. */
  upcoming: Banner[];
  /** How many leaked banners the switch is hiding. */
  hiddenLeaks: number;
}

export function splitBanners(banners: Banner[], now: number, hideLeaks: boolean): BannerSplit {
  const open = banners.filter((b) => Date.parse(b.end) > now);
  const shown = hideLeaks ? open.filter((b) => !b.leak) : open;
  const live = shown.filter((b) => Date.parse(b.start) <= now).sort((a, b) => Date.parse(a.end) - Date.parse(b.end) || a.id.localeCompare(b.id));
  const upcoming = shown.filter((b) => Date.parse(b.start) > now).sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || a.id.localeCompare(b.id));
  return { live, upcoming, hiddenLeaks: open.length - shown.length };
}

const DAY = 86_400_000;

/**
 * "Rerun" when the featured character came out more than a week before the
 * banner opens, "New" otherwise; null when that can't be told (weapon banner,
 * no featured character, or no release date in the list).
 */
export function rerunLabel(game: GameContract, banner: Banner, characters: Map<string, Character>): 'Rerun' | 'New' | null {
  const type = game.bannerTypes.find((t) => t.id === banner.type);
  if (type?.target === 'weapon') return null;
  const lead = banner.featured[0] ? characters.get(banner.featured[0]) : undefined;
  if (!lead?.releasedAt) return null;
  return Date.parse(lead.releasedAt) < Date.parse(banner.start) - 7 * DAY ? 'Rerun' : 'New';
}

export type Fit =
  | { kind: 'owned'; label: string }
  | { kind: 'wanted'; label: string }
  | { kind: 'new'; label: string }
  /** Your roster is empty, so we can't tell. */
  | { kind: 'unknown' };

/** "You own it (E2)", "On your wanted list", "New for you", or unknown when the roster is empty. */
export function rosterFit(game: GameContract, roster: Record<string, RosterEntry>, characterId: string): Fit {
  const entry = roster[characterId];
  if (entry?.owned) {
    const dupes = game.dupes ? ` (${game.dupes.prefix}${entry.dupes})` : '';
    return { kind: 'owned', label: `You own it${dupes}${entry.wanted ? ' · on your wanted list' : ''}` };
  }
  if (entry?.wanted) return { kind: 'wanted', label: 'On your wanted list' };
  const filledIn = Object.values(roster).some((e) => e.owned || e.wanted);
  return filledIn ? { kind: 'new', label: 'New for you' } : { kind: 'unknown' };
}

export type Phase = 'now' | 'next' | 'later';
const PHASE_DAY = 86_400_000;

/**
 * Now / Next / Later, the same everywhere (Banners, Pulls → Planner): Now = open already;
 * Next = the next phase (everything opening within two days of the first upcoming start);
 * Later = the rest, leaks included.
 */
export function phaseOfBanner(list: readonly Banner[], now: number): (b: Banner) => Phase {
  const starts = list.map((x) => Date.parse(x.start)).filter((t) => t > now);
  const first = starts.length ? Math.min(...starts) : 0;
  return (x) => (Date.parse(x.start) <= now ? 'now' : Date.parse(x.start) <= first + 2 * PHASE_DAY ? 'next' : 'later');
}
