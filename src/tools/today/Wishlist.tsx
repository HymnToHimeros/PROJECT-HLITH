import type { Banner, Character, GameContract } from '../../core/contract';
import type { GameUserData } from '../../core/data/userData';
import { formatRange } from '../../core/time/reset';
import { Button, EmptyState, ExampleTag, GameTag, Timer, UnverifiedTag } from '../../core/ui';
import t from './today.module.css';

export interface WishlistGame {
  game: GameContract;
  user: GameUserData;
  characters: Character[];
  banners: Banner[];
  /** Any banner is an example. */
  example: boolean;
  /** Which banners are examples. */
  exampleIds?: ReadonlySet<string> | undefined;
}

interface Props {
  games: WishlistGame[];
  tags: boolean;
  now: number;
  openRoster: () => void;
}

/** Live and upcoming banners that feature any character on your wanted list, soonest first. */
export function wishlistRows(games: WishlistGame[], now: number) {
  return games
    .flatMap(({ game, user, characters, banners, exampleIds }) =>
      banners
        .filter((b) => Date.parse(b.end) > now)
        .flatMap((b) =>
          b.featured
            .filter((id) => user.roster[id]?.wanted)
            .map((id) => ({ game, banner: b, character: characters.find((c) => c.id === id), characterId: id, example: Boolean(exampleIds?.has(b.id)) })),
        ),
    )
    .sort((a, b) => Date.parse(a.banner.start) - Date.parse(b.banner.start) || Date.parse(a.banner.end) - Date.parse(b.banner.end));
}

/**
 * ★ Wishlist (R44, no design yet: built from the shared tokens). Banners for
 * the characters you marked as wanted in Roster.
 */
export function Wishlist({ games, tags, now, openRoster }: Props) {
  const wanted = games.flatMap(({ game, user, characters }) =>
    Object.entries(user.roster)
      .filter(([, e]) => e.wanted)
      .map(([id]) => ({ game, id, name: characters.find((c) => c.id === id)?.name ?? id })),
  );
  if (wanted.length === 0) {
    return (
      <EmptyState
        title="Wishlist"
        body="Mark the characters you want in Roster and every live or upcoming banner with them shows up here."
        action={{ label: 'Pick wanted characters', onClick: openRoster }}
      />
    );
  }
  const rows = wishlistRows(games, now);
  return (
    <section className={t.card} aria-label="Wishlist">
      <div className={t.cardHead}>
        <h3 className={t.cardTitle}>Wishlist</h3>
        <Button variant="quiet" onClick={openRoster}>
          Change wanted list
        </Button>
      </div>
      <p className={t.sub}>Live and upcoming banners with the characters you want.</p>
      {rows.length > 0 ? (
        <div className={t.list}>
          {rows.map(({ game, banner, character, characterId, example }) => {
            const live = Date.parse(banner.start) <= now;
            const type = game.bannerTypes.find((x) => x.id === banner.type)?.label ?? banner.type;
            return (
              <div key={`${game.id}:${banner.id}:${characterId}`} className={t.wish}>
                <span className={t.wishMark} style={tags ? { background: game.vent } : undefined} aria-hidden="true" />
                <span className={t.taskBody}>
                  <span className={t.taskTop}>
                    {character?.name ?? characterId}
                    {tags && <GameTag label={game.short} vent={game.vent} />}
                    {example && <ExampleTag />}
                    {banner.leak && <UnverifiedTag source={banner.leak.source} />}
                  </span>
                  <span className={t.why}>
                    {type} · {formatRange(Date.parse(banner.start), Date.parse(banner.end))}
                  </span>
                </span>
                {live ? <Timer to={Date.parse(banner.end)} deadline prefix="live · ends in" /> : <Timer to={Date.parse(banner.start)} prefix="opens in" />}
              </div>
            );
          })}
        </div>
      ) : (
        <p className={t.muted}>None of the characters you want has a live or upcoming banner on the list yet.</p>
      )}
      <div className={t.chips} aria-label="Wanted characters">
        {wanted.map((w) => (
          <span key={`${w.game.id}:${w.id}`} className={t.chip}>
            {w.name}
            {tags && <span className={t.reward}>{w.game.short}</span>}
          </span>
        ))}
      </div>
    </section>
  );
}
