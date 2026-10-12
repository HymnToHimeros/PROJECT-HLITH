/**
 * Builds the profile card (ProfileCard.tsx) from your profile and your own data (T52).
 * No React. Pictures: an uploaded one, or a character's portrait / splash art while one is
 * chosen. Showcase items you no longer have (a character not owned any more, a team you
 * deleted) are left out rather than shown wrong.
 */
import type { Character, GameContract, GameId } from '../../core/contract';
import type { GameUserData } from '../../core/data/userData';
import type { BadgeState } from './badges';
import { shownBadge } from './badges';
import { gameNumbers, luckiestPull } from './cardExtras';
import type { CardCharacter, CardFeatured, CardLuckiest, CardStats, ProfileCardProps } from './ProfileCard';
import type { CharRef, Profile } from './profile';

export interface CardInput {
  profile: Profile;
  games: GameContract[];
  data: Record<GameId, GameUserData | undefined>;
  characters: Record<GameId, Character[] | undefined>;
  badges: BadgeState[];
  /** Turns a stored picture value into something an <img> can show. */
  imageUrl: (v: string | null) => string | null;
  fallbackName: string;
  bannerFallback: string;
}

export function characterOf(characters: Record<GameId, Character[] | undefined>, ref: CharRef | null): Character | undefined {
  return ref ? characters[ref.game]?.find((c) => c.id === ref.id) : undefined;
}

export function cardCharacter(game: GameContract, c: Character): CardCharacter {
  return { name: c.name, portrait: c.portrait, rarity: c.rarity, elementColor: game.elements.find((e) => e.id === c.element)?.color ?? 'var(--line-empty)' };
}

export function featuredItems(profile: Profile, games: GameContract[], data: CardInput['data'], characters: CardInput['characters']): CardFeatured[] {
  return profile.featured.flatMap((f): CardFeatured[] => {
    const game = games.find((g) => g.id === f.game);
    const d = data[f.game];
    const list = characters[f.game];
    if (!game || !d || !list) return [];
    if (f.kind === 'character') {
      const c = list.find((x) => x.id === f.id);
      if (!c || !d.roster[c.id]?.owned) return [];
      return [{ kind: 'character', key: `c:${f.game}:${f.id}`, gameShort: game.short, vent: game.vent, ...cardCharacter(game, c) }];
    }
    const team = d.teams.find((t) => t.id === f.id);
    if (!team) return [];
    const members = team.members.flatMap((id) => {
      const c = list.find((x) => x.id === id);
      return c ? [cardCharacter(game, c)] : [];
    });
    return [{ kind: 'team', key: `t:${f.game}:${f.id}`, gameShort: game.short, vent: game.vent, name: team.name, members }];
  });
}

export function pullStats(games: GameContract[], data: CardInput['data']): CardStats[] {
  return gameNumbers(games, data).flatMap((n) => {
    const g = games.find((x) => x.id === n.game);
    return g ? [{ gameShort: g.short, vent: g.vent, total: n.total, tops: n.tops, topLabel: g.terms.rarity.top, averagePity: n.averagePity, won: n.won, lost: n.lost }] : [];
  });
}

/** The saved team chosen as best team, if it still exists. */
export function bestTeamItem(profile: Profile, games: GameContract[], data: CardInput['data'], characters: CardInput['characters']): Extract<CardFeatured, { kind: 'team' }> | null {
  if (!profile.bestTeam) return null;
  const [item] = featuredItems({ ...profile, featured: [{ kind: 'team', ...profile.bestTeam }] }, games, data, characters);
  return item?.kind === 'team' ? item : null;
}

export function luckiestItem(games: GameContract[], data: CardInput['data'], characters: CardInput['characters']): CardLuckiest | null {
  const l = luckiestPull(games, data);
  const game = l && games.find((g) => g.id === l.game);
  if (!l || !game) return null;
  const ch = characters[l.game]?.find((c) => c.id === l.itemId);
  const look = ch ? cardCharacter(game, ch) : { name: l.name, rarity: 'top' as const, elementColor: 'var(--line-empty)' };
  return { ...look, name: ch?.name ?? l.name, gameShort: game.short, vent: game.vent, topLabel: game.terms.rarity.top, pulls: l.pulls, time: l.time };
}

export function buildCard(input: CardInput): ProfileCardProps {
  const { profile, games, data, characters, badges } = input;
  const avatarChar = characterOf(characters, profile.avatarChar);
  const bannerChar = characterOf(characters, profile.bannerChar);
  const stats = pullStats(games, data);
  const isOwner = badges.some((b) => b.def.id === 'owner' && b.earned);
  return {
    name: profile.displayName ?? input.fallbackName,
    title: profile.title,
    avatarUrl: avatarChar?.portrait ?? input.imageUrl(profile.avatar),
    bannerUrl: bannerChar?.art ?? bannerChar?.portrait ?? input.imageUrl(profile.banner),
    bannerFallback: input.bannerFallback,
    // The sky frame is the owner's alone.
    frame: profile.frame === 'sky' && !isOwner ? 'none' : profile.frame,
    nameColor: profile.nameColor,
    vent: games[0]?.vent ?? 'var(--vent-all)',
    badge: shownBadge(badges, profile.pinnedBadge),
    ownerTitle: profile.ownerTitle,
    // The owner's look is the owner's alone.
    ownerStyle: isOwner ? profile.ownerStyle : null,
    featured: featuredItems(profile, games, data, characters),
    // Only badges you hold go on the shelf.
    shelf: profile.pinnedShelf.filter((id) => badges.some((b) => b.def.id === id && b.earned)),
    bestTeam: bestTeamItem(profile, games, data, characters),
    luckiest: luckiestItem(games, data, characters),
    stats: stats.length ? stats : null,
    badgeCount: { earned: badges.filter((b) => b.earned).length, total: badges.length },
  };
}
