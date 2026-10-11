/**
 * Profile badges (T52). HLIÐSKJÁLF is Odin's high seat, from which he sees every world:
 * everyone who uses HLITH sits on it, and the owner of HLITH is above it, in the sky,
 * watching over everything.
 *
 * Every badge is earned from real data only (CLAUDE.md: honest data). Nothing here is
 * invented or estimated: a badge whose data HLITH doesn't have stays "Not yet", with the
 * way to earn it. The owner badge comes only from the server (public.is_owner()), never
 * from anything the app could be told by the browser. No React here.
 *
 * Some badges can also be checked by the server (supabase/migrations/0011_profile_card.sql,
 * SERVER_CHECKED below); only those show on a card someone else sees.
 */
import type { GameContract, GameId, ModuleId } from '../../core/contract';
import type { GameUserData } from '../../core/data/userData';

export type BadgeId =
  | 'owner'
  | 'seated'
  | 'first-light'
  | 'hundred'
  | 'thousand'
  | 'storm'
  | 'shield-wall'
  | 'between-worlds'
  | 'thirty-dawns'
  | 'self-portrait'
  | 'hall'
  | 'treasurer'
  | 'sagas'
  | 'gatherer'
  | 'rune-days'
  | 'feast-days'
  | 'smith';

export type BadgeKind = 'owner' | 'seat' | 'earned' | 'module';

export interface BadgeDef {
  id: BadgeId;
  name: string;
  /** How it is earned, in plain words. */
  how: string;
  kind: BadgeKind;
  /** Where to go to earn it (for "Not yet"). */
  go?: { module: ModuleId; tab?: string } | { section: string };
}

/** Names the owner can choose for their badge (Profile → Edit → Your badge). The first is the default. */
export const OWNER_TITLES = ['Above the High Seat', 'The Sky over HLIÐSKJÁLF', 'The Watcher Above'] as const;
export type OwnerTitle = (typeof OWNER_TITLES)[number];
export const OWNER_LINE = 'Watches over every world from the sky above HLIÐSKJÁLF. Only the owner of HLITH holds it.';

export const BADGES: BadgeDef[] = [
  { id: 'owner', name: OWNER_TITLES[0], how: OWNER_LINE, kind: 'owner' },
  { id: 'seated', name: 'Seated on HLIÐSKJÁLF', how: 'Everyone who opens HLITH sits on the high seat and sees every world.', kind: 'seat' },
  { id: 'first-light', name: 'First Light', how: 'A top-rarity result in your imported pull history.', kind: 'earned', go: { module: 'pulls', tab: 'history' } },
  { id: 'hundred', name: 'A Hundred Casts', how: '100 pulls in your imported history.', kind: 'earned', go: { module: 'pulls', tab: 'history' } },
  { id: 'thousand', name: 'A Thousand Casts', how: '1,000 pulls in your imported history.', kind: 'earned', go: { module: 'pulls', tab: 'history' } },
  { id: 'storm', name: 'Weathered the Storm', how: 'A top result that only came on the very last pull, at hard pity.', kind: 'earned', go: { module: 'pulls', tab: 'history' } },
  { id: 'shield-wall', name: 'Shield-Wall', how: 'A saved team with every slot filled.', kind: 'earned', go: { module: 'roster', tab: 'teams' } },
  { id: 'between-worlds', name: 'Between Worlds', how: 'Owned characters or pulls in two games.', kind: 'earned', go: { module: 'roster', tab: 'characters' } },
  { id: 'thirty-dawns', name: 'Thirty Dawns', how: '30 days in a row checked in through your HoYoLAB link.', kind: 'earned', go: { section: 'connections' } },
  { id: 'self-portrait', name: 'Self-Portrait', how: 'A profile picture (yours or a character) and a title.', kind: 'earned', go: { section: 'profile' } },
  { id: 'hall', name: 'The Hall Fills', how: 'Your first character marked as owned in Roster.', kind: 'module', go: { module: 'roster', tab: 'characters' } },
  { id: 'treasurer', name: 'Keeper of the Hoard', how: 'Your first entry in the Bank log.', kind: 'module', go: { module: 'pulls', tab: 'log' } },
  { id: 'sagas', name: 'Unfinished Sagas', how: 'Your first count entered in Backlog.', kind: 'module', go: { module: 'backlog' } },
  { id: 'gatherer', name: 'Gatherer', how: 'Your first farm target in Farm.', kind: 'module', go: { module: 'farm' } },
  { id: 'rune-days', name: 'Rune-Marked Days', how: 'Your first plan on the Calendar.', kind: 'module', go: { module: 'calendar' } },
  { id: 'feast-days', name: 'Feast Days', how: 'Your first event marked in Events.', kind: 'module', go: { module: 'events' } },
  { id: 'smith', name: 'Smith of the Hall', how: 'Your first saved build on a character page.', kind: 'module', go: { module: 'roster', tab: 'characters' } },
];

export const BADGE_BY_ID = Object.fromEntries(BADGES.map((b) => [b.id, b])) as Record<BadgeId, BadgeDef>;
export const isBadgeId = (v: unknown): v is BadgeId => typeof v === 'string' && v in BADGE_BY_ID;

/** Badges the server can check from the account's own rows, so they can show to others. */
export const SERVER_CHECKED: readonly BadgeId[] = ['owner', 'seated', 'first-light', 'hundred', 'thousand', 'between-worlds', 'thirty-dawns', 'hall', 'treasurer', 'sagas', 'gatherer', 'rune-days', 'feast-days', 'smith'];

export interface BadgeInput {
  games: GameContract[];
  data: Record<GameId, GameUserData | undefined>;
  /** From the server only (public.is_owner()). */
  isOwner: boolean;
  /** Days (YYYY-MM-DD, UTC) with a claimed or already-claimed check-in; null = no HoYoLAB link or not loaded. */
  checkinDays: string[] | null;
  profile: { hasPicture: boolean; hasTitle: boolean };
}

export interface BadgeState {
  def: BadgeDef;
  earned: boolean;
  /** When it was earned, only when the data says so (a pull's time, a bank entry's date). */
  at?: string;
}

const firstBy = (times: string[]) => times.filter(Boolean).sort()[0];

/** The longest run of consecutive days in a list of YYYY-MM-DD dates. */
export function longestRun(days: string[]): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of sorted) {
    const t = Date.parse(`${d}T00:00:00Z`);
    if (!Number.isFinite(t)) continue;
    run = prev !== null && t - prev === 86_400_000 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

/** The pull that hit hard pity on a banner (the last possible pull), if any. */
function hardPityHit(game: GameContract, d: GameUserData): string | undefined {
  const hits: string[] = [];
  for (const bt of game.bannerTypes) {
    if (bt.pity.kind !== 'hard-pity') continue;
    const pulls = d.pulls.filter((p) => p.bannerType === bt.id).sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
    let since = 0;
    // Before the first top in the history the count may have started earlier (an older, unimported pull), so it can't be proven.
    let counting = false;
    for (const p of pulls) {
      since++;
      if (p.rarity !== 'top') continue;
      if (counting && since === bt.pity.hardPity) hits.push(p.time);
      counting = true;
      since = 0;
    }
  }
  return firstBy(hits);
}

/** Every badge, earned or not, in display order. */
export function badgeStates(input: BadgeInput): BadgeState[] {
  const { games, isOwner } = input;
  const ds = games.map((g) => ({ game: g, d: input.data[g.id] })).filter((x): x is { game: GameContract; d: GameUserData } => Boolean(x.d));
  const allPulls = ds.flatMap((x) => x.d.pulls);
  const tops = allPulls.filter((p) => p.rarity === 'top');
  const sortedPulls = allPulls.map((p) => p.time).sort();
  const ownsAny = (d: GameUserData) => Object.values(d.roster).some((e) => e.owned);
  const activeGames = ds.filter((x) => x.d.pulls.length > 0 || ownsAny(x.d)).length;
  const storm = firstBy(ds.flatMap((x) => hardPityHit(x.game, x.d) ?? []));
  const fullTeam = ds.some((x) => (x.d.teams ?? []).some((t) => t.members.length >= x.game.teamSize));
  const any = (f: (d: GameUserData) => boolean) => ds.some((x) => f(x.d));
  const firstLedger = firstBy(ds.flatMap((x) => x.d.ledger.filter((e) => !e.reverses).map((e) => e.at)));

  const earned: Record<BadgeId, { earned: boolean; at?: string | undefined }> = {
    owner: { earned: isOwner },
    seated: { earned: true },
    'first-light': { earned: tops.length > 0, at: firstBy(tops.map((p) => p.time)) },
    hundred: { earned: allPulls.length >= 100, at: sortedPulls[99] },
    thousand: { earned: allPulls.length >= 1000, at: sortedPulls[999] },
    storm: { earned: storm !== undefined, at: storm },
    'shield-wall': { earned: fullTeam },
    'between-worlds': { earned: activeGames >= 2 },
    'thirty-dawns': { earned: input.checkinDays !== null && longestRun(input.checkinDays) >= 30 },
    'self-portrait': { earned: input.profile.hasPicture && input.profile.hasTitle },
    hall: { earned: any(ownsAny) },
    treasurer: { earned: firstLedger !== undefined, at: firstLedger },
    sagas: { earned: any((d) => Object.keys(d.backlog).length > 0) },
    gatherer: { earned: any((d) => d.farm.length > 0) },
    'rune-days': { earned: any((d) => d.plans.length > 0) },
    'feast-days': { earned: any((d) => Object.keys(d.events).length > 0) },
    smith: { earned: any((d) => Object.keys(d.builds ?? {}).length > 0) },
  };

  return BADGES.filter((b) => b.id !== 'owner' || isOwner).map((def) => {
    const e = earned[def.id];
    return { def, earned: e.earned, ...(e.earned && e.at ? { at: e.at } : {}) };
  });
}

/**
 * The badge shown on the card: the pinned one if it's earned, else the owner badge for
 * the owner, else "Seated on HLIÐSKJÁLF". A badge you no longer hold never shows.
 */
export function shownBadge(states: BadgeState[], pinned: BadgeId | null): BadgeId {
  const has = (id: BadgeId) => states.some((s) => s.def.id === id && s.earned);
  if (pinned && has(pinned)) return pinned;
  return has('owner') ? 'owner' : 'seated';
}
