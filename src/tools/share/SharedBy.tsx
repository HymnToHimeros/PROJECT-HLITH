import { useEffect, useState } from 'react';
import type { Character, GameContract, GameId } from '../../core/contract';
import { backend } from '../../core/data/backend';
import { BADGES, isBadgeId, OWNER_TITLES, type BadgeId, type OwnerTitle } from '../account/badges';
import { cardCharacter } from '../account/cardData';
import { defaultBanner } from '../account/Profile';
import { ProfileCard, type CardFeatured, type ProfileCardProps } from '../account/ProfileCard';
import { cleanProfile } from '../account/profile';
import { AVATAR_BUCKET } from '../account/useProfile';
import c from '../account-links/connections.module.css';

/** What public.profile_card() returns (supabase/migrations/0011_profile_card.sql); null = not shown. */
export interface CardRow {
  display_name: string | null;
  /** The username (T62, migration 0016); missing on older servers. */
  username?: string | null;
  avatar_path: string | null;
  banner_path: string | null;
  title: string | null;
  frame: string | null;
  name_color: string | null;
  avatar_char: unknown;
  banner_char: unknown;
  owner: boolean;
  owner_title: string | null;
  badges: string[] | null;
  pinned_badge: string | null;
  stats: { game: string; total: number; tops: number }[] | null;
  featured: ({ kind: 'character'; game: string; id: string } | { kind: 'team'; game: string; id: string; name: string; members: string[] })[];
}

export type CardLoader = (userId: string) => Promise<CardRow | null>;

const client = backend;
const serverCard: CardLoader | null = client
  ? async (userId) => {
      const { data, error } = await client.rpc('profile_card', { p_user: userId });
      if (error) throw new Error(error.message);
      return (data as CardRow | null) ?? null;
    }
  : null;

const publicUrl = (path: string | null) => (path && backend ? backend.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl : null);

/** The server's answer → the card. Only what the server returned is shown; badges only the ones it checked. */
export function cardFromRow(row: CardRow, games: GameContract[], characters: Record<GameId, Character[] | undefined>, imageUrl: (p: string | null) => string | null = publicUrl): ProfileCardProps {
  // Same cleaning as your own profile: unknown frames, colours and references are dropped.
  const look = cleanProfile({ title: row.title, frame: row.frame, nameColor: row.name_color, avatarChar: row.avatar_char, bannerChar: row.banner_char });
  const charOf = (ref: { game: string; id: string } | null) => (ref ? characters[ref.game]?.find((x) => x.id === ref.id) : undefined);
  const avatarChar = charOf(look.avatarChar);
  const bannerChar = charOf(look.bannerChar);
  const held = (row.badges ?? []).filter(isBadgeId);
  const badge: BadgeId = row.pinned_badge && isBadgeId(row.pinned_badge) && held.includes(row.pinned_badge) ? row.pinned_badge : held.includes('owner') ? 'owner' : 'seated';
  const featured = row.featured.slice(0, 4).flatMap((f): CardFeatured[] => {
    const game = games.find((g) => g.id === f.game);
    const list = characters[f.game];
    if (!game || !list) return [];
    if (f.kind === 'character') {
      const ch = list.find((x) => x.id === f.id);
      return ch ? [{ kind: 'character', key: `c:${f.game}:${f.id}`, gameShort: game.short, vent: game.vent, ...cardCharacter(game, ch) }] : [];
    }
    const members = (Array.isArray(f.members) ? f.members : []).flatMap((id) => {
      const ch = list.find((x) => x.id === id);
      return ch ? [cardCharacter(game, ch)] : [];
    });
    return [{ kind: 'team', key: `t:${f.game}:${f.id}`, gameShort: game.short, vent: game.vent, name: String(f.name || 'Team').slice(0, 60), members }];
  });
  const stats = (row.stats ?? []).flatMap((s) => {
    const g = games.find((x) => x.id === s.game);
    return g && s.total > 0 ? [{ gameShort: g.short, vent: g.vent, total: s.total, tops: s.tops, topLabel: g.terms.rarity.top }] : [];
  });
  const total = BADGES.filter((b) => b.id !== 'owner' || row.owner).length;
  return {
    name: row.display_name?.trim() || row.username || 'A HLITH user',
    handle: row.username ?? null,
    title: look.title,
    avatarUrl: avatarChar?.portrait ?? imageUrl(row.avatar_path),
    bannerUrl: bannerChar?.art ?? bannerChar?.portrait ?? imageUrl(row.banner_path),
    bannerFallback: defaultBanner(games),
    frame: look.frame === 'sky' && !row.owner ? 'none' : look.frame,
    nameColor: look.nameColor,
    vent: games[0]?.vent ?? 'var(--vent-all)',
    badge,
    ownerTitle: row.owner && (OWNER_TITLES as readonly string[]).includes(row.owner_title ?? '') ? (row.owner_title as OwnerTitle) : null,
    featured,
    stats: stats.length ? stats : null,
    badgeCount: row.badges ? { earned: held.length, total } : undefined,
  };
}

/** Characters for every game a card might use (loaded once each). */
function useAllCharacters(games: GameContract[]) {
  const [lists, setLists] = useState<Record<GameId, Character[] | undefined>>({});
  useEffect(() => {
    let alive = true;
    for (const g of games)
      void g.data
        .characters()
        .catch(() => [] as Character[])
        .then((list) => alive && setLists((cur) => ({ ...cur, [g.id]: list })));
    return () => {
      alive = false;
    };
  }, [games]);
  return lists;
}

/**
 * "Shared by" on a shared team (T52): the sharer's profile card, asked from the server.
 * Shows nothing at all when the link has no sharer, there is no server or no sign-in, or the
 * sharer keeps their card private.
 */
export function SharedBy({ by, games, load = serverCard }: { by: string; games: GameContract[]; load?: CardLoader | null }) {
  const [state, setState] = useState<{ by: string; row: CardRow | null; failed: boolean } | null>(null);
  const characters = useAllCharacters(games);
  useEffect(() => {
    if (!load) return;
    let alive = true;
    load(by).then(
      (row) => alive && setState({ by, row, failed: false }),
      () => alive && setState({ by, row: null, failed: true }),
    );
    return () => {
      alive = false;
    };
  }, [by, load]);
  const current = state?.by === by ? state : null;
  if (!load || !current || (!current.row && !current.failed)) return null;
  if (current.failed) return <span className={c.muted}>Who shared this couldn’t be loaded (sign in to see the card of whoever shared it).</span>;
  if (!current.row) return null;
  return (
    <section aria-label="Shared by" className={c.stack}>
      <ProfileCard {...cardFromRow(current.row, games, characters)} compact note="Shared this team with you" />
      <span className={c.muted}>Their badge and numbers are checked by HLITH’s server from their own data.</span>
    </section>
  );
}
