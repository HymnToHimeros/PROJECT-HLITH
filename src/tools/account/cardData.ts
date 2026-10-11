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
import type { CardCharacter, CardFeatured, CardStats, ProfileCardProps } from './ProfileCard';
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
  return games.flatMap((g) => {
    const pulls = data[g.id]?.pulls ?? [];
    if (pulls.length === 0) return [];
    return [{ gameShort: g.short, vent: g.vent, total: pulls.length, tops: pulls.filter((p) => p.rarity === 'top').length, topLabel: g.terms.rarity.top }];
  });
}

export function buildCard(input: CardInput): ProfileCardProps {
  const { profile, games, data, characters, badges } = input;
  const avatarChar = characterOf(characters, profile.avatarChar);
  const bannerChar = characterOf(characters, profile.bannerChar);
  const stats = pullStats(games, data);
  return {
    name: profile.displayName ?? input.fallbackName,
    title: profile.title,
    avatarUrl: avatarChar?.portrait ?? input.imageUrl(profile.avatar),
    bannerUrl: bannerChar?.art ?? bannerChar?.portrait ?? input.imageUrl(profile.banner),
    bannerFallback: input.bannerFallback,
    // The sky frame is the owner's alone.
    frame: profile.frame === 'sky' && !badges.some((b) => b.def.id === 'owner' && b.earned) ? 'none' : profile.frame,
    nameColor: profile.nameColor,
    vent: games[0]?.vent ?? 'var(--vent-all)',
    badge: shownBadge(badges, profile.pinnedBadge),
    ownerTitle: profile.ownerTitle,
    featured: featuredItems(profile, games, data, characters),
    stats: stats.length ? stats : null,
    badgeCount: { earned: badges.filter((b) => b.earned).length, total: badges.length },
  };
}
