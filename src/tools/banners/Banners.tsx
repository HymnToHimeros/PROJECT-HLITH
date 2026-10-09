import type { CSSProperties } from 'react';
import type { Banner, Character, GameContract, ModuleId } from '../../core/contract';
import { formatDateTime, formatRange } from '../../core/time/reset';
import { Button, EmptyState, ExampleNotice, ExampleTag, initials, NoData, Timer, UnverifiedTag } from '../../core/ui';
import { GameHeading } from '../pulls/shared';
import b from './banners.module.css';
import { rosterFit, splitBanners } from './fit';
import { useBannersData, type BannersData } from './useBannersData';

interface Props {
  game: GameContract;
  now: number;
  heading: boolean;
  hideLeaks: boolean;
  open: (module: ModuleId, tab?: string) => void;
}

/** Banners for one game: live first (ending soonest on top), then upcoming (starting soonest on top). */
export function GameBanners({ game, now, heading, hideLeaks, open }: Props) {
  const data = useBannersData(game, now);
  if (data.loading) return null;
  const { live, upcoming, hiddenLeaks } = splitBanners(data.banners.list, now, hideLeaks);
  const card = (banner: Banner, state: 'live' | 'upcoming') => (
    <BannerItem key={banner.id} game={game} banner={banner} state={state} data={data} open={open} />
  );
  return (
    <section className={b.stack} aria-label={game.name}>
      <GameHeading game={game} show={heading} />
      {data.banners.example && (
        <ExampleNotice>The banner list for this game still has to be added by us (not you), so these banners are examples. The roster labels on them are your own.</ExampleNotice>
      )}
      {live.length === 0 && upcoming.length === 0 && hiddenLeaks === 0 ? (
        <EmptyState title="No banners listed" body="No live or upcoming banners are listed for this game yet. They appear here as soon as the list has them." />
      ) : (
        <>
          <div className={b.section}>
            <h3 className={b.sectionLabel}>LIVE NOW · {live.length}</h3>
            {live.length ? <div className={b.grid}>{live.map((x) => card(x, 'live'))}</div> : <p className={b.muted}>Nothing is live right now.</p>}
          </div>
          <div className={b.section}>
            <h3 className={b.sectionLabel}>COMING UP · {upcoming.length}</h3>
            {upcoming.length ? <div className={b.grid}>{upcoming.map((x) => card(x, 'upcoming'))}</div> : <p className={b.muted}>No upcoming banners listed yet.</p>}
            {hiddenLeaks > 0 && (
              <p className={b.muted}>
                {hiddenLeaks} leaked {hiddenLeaks === 1 ? 'banner' : 'banners'} hidden.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

interface ItemProps {
  game: GameContract;
  banner: Banner;
  state: 'live' | 'upcoming';
  data: BannersData;
  open: (module: ModuleId, tab?: string) => void;
}

function BannerItem({ game, banner, state, data, open }: ItemProps) {
  const type = game.bannerTypes.find((t) => t.id === banner.type);
  const start = Date.parse(banner.start);
  const end = Date.parse(banner.end);
  const featured = banner.featured.map((id) => data.characters.get(id)).filter((c): c is Character => Boolean(c));
  return (
    <article className={`${b.card} ${banner.leak ? b.leak : ''}`} aria-label={banner.title}>
      <div className={b.head}>
        <span className={b.kind}>{type?.label ?? 'Banner'}</span>
        {banner.leak && <UnverifiedTag source={banner.leak.source} />}
      </div>
      <h4 className={b.title}>
        {banner.title} {data.banners.example && <ExampleTag />}
      </h4>
      <div className={b.when}>
        {state === 'live' ? (
          <>
            {formatRange(start, end)} · <Timer to={end} deadline prefix="ends in" />
          </>
        ) : (
          <>
            starts {formatDateTime(start)} · <Timer to={start} prefix="in" />
          </>
        )}
      </div>
      {featured.length > 0 && (
        <div className={b.featured}>
          <span className={b.label}>{type?.target === 'weapon' ? 'MADE FOR' : 'FEATURED'}</span>
          <ul className={b.chars}>
            {featured.map((c) => (
              <FeaturedRow key={c.id} game={game} character={c} data={data} open={open} />
            ))}
          </ul>
        </div>
      )}
      <div className={b.actions}>
        <Button variant="primary" onClick={() => open('pulls', 'planner')}>
          Plan pulls
        </Button>
      </div>
    </article>
  );
}

function FeaturedRow({ game, character: c, data, open }: { game: GameContract; character: Character; data: BannersData; open: ItemProps['open'] }) {
  const element = game.elements.find((e) => e.id === c.element);
  const role = game.roles.find((r) => r.id === c.role);
  const fit = rosterFit(game, data.user.roster, c.id);
  return (
    <li className={b.char}>
      <span className={b.avatar} style={{ '--el': element?.color ?? 'var(--line-strong)' } as CSSProperties} aria-hidden="true">
        {c.art ? <img src={c.art} alt="" /> : initials(c.name.replace(/[^\p{L}\p{N}\s]/gu, ''))}
      </span>
      <span className={b.charBody}>
        <span className={b.charName}>
          {c.name} <span className={c.rarity === 'top' ? b.top : b.mid}>{game.terms.rarity[c.rarity]}</span>
        </span>
        <span className={b.charSub}>{[element?.label, role?.label].filter(Boolean).join(' · ') || '—'}</span>
        <span className={b.fitRow}>
          {fit.kind === 'unknown' ? (
            <span className={b.fitNone}>
              Roster: <NoData dash={false} fix="enter-manually" onFix={() => open('roster', 'characters')} />
            </span>
          ) : (
            <span className={`${b.fit} ${b[fit.kind]}`}>{fit.label}</span>
          )}
        </span>
      </span>
    </li>
  );
}
