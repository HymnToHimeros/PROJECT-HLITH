import type { CSSProperties } from 'react';
import type { Banner, Character, GameContract, ModuleId } from '../../core/contract';
import { formatDate, formatRange } from '../../core/time/reset';
import { EmptyState, ExampleNotice, ExampleTag, GameTag, NoData, Timer, UnverifiedTag } from '../../core/ui';
import { cx } from '../../core/ui/cx';
import { GameHeading, Strip } from '../pulls/shared';
import b from './banners.module.css';
import { rerunLabel, rosterFit, splitBanners } from './fit';
import { useBannersData, type BannersData } from './useBannersData';
import { EditListButton } from '../edit-mode/EditMode';
import { setRosterEntry } from '../../core/data/userData';
import { useAddOwnBanner } from './AddOwnBanner';

export type BannerFilter = 'all' | 'live' | 'upcoming' | 'leaks' | 'reruns';

interface Props {
  game: GameContract;
  now: number;
  many: boolean;
  hideLeaks: boolean;
  filter: BannerFilter;
  open: (module: ModuleId, tab?: string) => void;
}

/** Banners for one game: live first (ending soonest on top), then upcoming (starting soonest on top), in one grid as in the design. */
export function GameBanners({ game, now, many, hideLeaks, filter, open }: Props) {
  const data = useBannersData(game, now);
  const { openSheet, sheet } = useAddOwnBanner(game, data.examples);
  if (data.loading) return null;
  const { live, upcoming, hiddenLeaks } = splitBanners(data.banners.list, now, hideLeaks);
  const pick = (list: Banner[], state: 'live' | 'upcoming') => list.map((banner) => ({ banner, state }));
  let cards = [...pick(live, 'live'), ...pick(upcoming, 'upcoming')];
  if (filter === 'live') cards = cards.filter((c) => c.state === 'live');
  if (filter === 'upcoming') cards = cards.filter((c) => c.state === 'upcoming');
  if (filter === 'leaks') cards = cards.filter((c) => c.banner.leak);
  // Rerun watch: the same "Rerun" label the cards carry.
  if (filter === 'reruns') cards = cards.filter((c) => rerunLabel(game, c.banner, data.characters) === 'Rerun');
  const unknownRerun = [...live, ...upcoming].filter((x) => rerunLabel(game, x, data.characters) === null && game.bannerTypes.find((t) => t.id === x.type)?.target !== 'weapon').length;
  return (
    <section className={b.stack} aria-label={game.name} style={{ '--vent': game.vent } as CSSProperties}>
      <GameHeading game={game} show={many} />
      <EditListButton game={game} kind="banners" examples={data.examples} />
      {data.banners.example && (
        <ExampleNotice>
          The banner list for this game still has to be added by us (not you), so these banners and their art are examples. The roster labels on them are your own.
        </ExampleNotice>
      )}
      <LatestChanges data={data} game={game} now={now} />
      {live.length === 0 && upcoming.length === 0 && hiddenLeaks === 0 ? (
        <EmptyState
          title="No banners listed"
          body="No live or upcoming banners are listed for this game yet. They appear here as soon as the list has them, or add one yourself now."
          action={{ label: 'Add my own banner', onClick: openSheet }}
        />
      ) : (
        <>
          {filter === 'reruns' && (
            <Strip>
              Rerun watch: live and upcoming banners whose featured character came out more than a week before the banner opens.
              {unknownRerun > 0 ? ` ${unknownRerun} ${unknownRerun === 1 ? 'banner has' : 'banners have'} no release date for the character, so ${unknownRerun === 1 ? 'it isn’t' : 'they aren’t'} sorted: no data yet.` : ''}
            </Strip>
          )}
          {cards.length > 0 ? (
            <div className={b.grid}>
              {cards.map(({ banner, state }) => (
                <BannerItem key={banner.id} game={game} banner={banner} state={state} data={data} tagged={many} open={open} />
              ))}
            </div>
          ) : (
            <p className={b.muted}>
              {filter === 'leaks' && hideLeaks ? 'Leaks are hidden. Switch on “Show leaks” to see them.' : filter === 'reruns' ? 'No reruns among the live and upcoming banners.' : 'Nothing here right now.'}
            </p>
          )}
          {hiddenLeaks > 0 && (
            <p className={b.muted}>
              {hiddenLeaks} leaked {hiddenLeaks === 1 ? 'banner' : 'banners'} hidden.
            </p>
          )}
        </>
      )}
      {sheet}
    </section>
  );
}

interface ItemProps {
  game: GameContract;
  banner: Banner;
  state: 'live' | 'upcoming';
  data: BannersData;
  tagged: boolean;
  open: (module: ModuleId, tab?: string) => void;
}

function BannerItem({ game, banner, state, data, tagged, open }: ItemProps) {
  const type = game.bannerTypes.find((t) => t.id === banner.type);
  const start = Date.parse(banner.start);
  const end = Date.parse(banner.end);
  const featured = banner.featured.map((id) => data.characters.get(id)).filter((c): c is Character => Boolean(c));
  const lead = featured[0];
  const isExample = data.banners.exampleIds.has(banner.id);
  // Sample art only ever illustrates example banners; real banners use the character's own art.
  const art = banner.art ?? (lead ? (isExample ? (data.sampleArt.get(lead.id) ?? lead.art) : lead.art) : undefined);
  const element = lead ? game.elements.find((e) => e.id === lead.element) : undefined;
  const isWeapon = type?.target === 'weapon';
  const rerun = rerunLabel(game, banner, data.characters);
  return (
    <article className={cx(b.card, banner.leak && b.leak)} aria-label={banner.title} style={{ '--el': element?.color ?? 'var(--line-strong)' } as CSSProperties}>
      <div className={cx(b.art, !art && b.artEmpty)}>
        {art ? (
          <img src={art} alt="" loading="lazy" className={b.artImg} />
        ) : (
          <span className={b.artName} aria-hidden="true">
            {lead?.name ?? banner.title}
          </span>
        )}
        <span className={b.artLabel}>{art ? (isExample ? 'SAMPLE ART' : '') : 'NO ART YET'}</span>
      </div>
      <div className={b.body}>
        <div className={b.kindRow}>
          <span className={b.kind}>
            {type?.label ?? 'Banner'}
            {rerun && ` · ${rerun}`}
          </span>
          {isExample && <ExampleTag />}
          {banner.leak && <UnverifiedTag source={banner.leak.source} />}
          {tagged && <GameTag label={game.short} vent={game.vent} />}
        </div>
        <h4 className={b.title}>{banner.title}</h4>
        <div className={b.whenRow}>
          <span>{banner.permanent ? `since ${formatDate(start)}` : formatRange(start, end)}</span>
          {banner.permanent && state === 'live' ? <span>Permanent</span> : state === 'live' ? <Timer to={end} deadline prefix="ends in" /> : <Timer to={start} prefix="opens in" />}
        </div>
        {featured.map((c) => (
          <FeaturedLines key={c.id} game={game} character={c} data={data} weapon={isWeapon} open={open} />
        ))}
        {featured.length === 0 && <span className={b.sub}>{isWeapon ? `${game.terms.weapon} banner · no fit score` : 'Featured character not in the list yet'}</span>}
        <button type="button" className={b.plan} onClick={() => open('pulls', 'planner')}>
          Plan pulls
        </button>
      </div>
    </article>
  );
}

function FeaturedLines({ game, character: c, data, weapon, open }: { game: GameContract; character: Character; data: BannersData; weapon: boolean; open: ItemProps['open'] }) {
  const element = game.elements.find((e) => e.id === c.element);
  const role = game.roles.find((r) => r.id === c.role);
  const fit = rosterFit(game, data.user.roster, c.id);
  const entry = data.user.roster[c.id];
  const wanted = entry?.wanted ?? false;
  const team = data.user.teams.find((t) => t.members.includes(c.id));
  const mates = team ? team.members.filter((id) => id !== c.id) : [];
  const owned = mates.filter((id) => data.user.roster[id]?.owned).length;
  return (
    <div className={b.featured}>
      <span className={b.sub}>
        {weapon ? 'Made for ' : ''}
        <strong className={b.charName}>{c.name}</strong> <span className={c.rarity === 'top' ? b.top : b.mid}>{game.terms.rarity[c.rarity]}</span>
        {[element?.label, role?.label].filter(Boolean).length > 0 && ` · ${[element?.label, role?.label].filter(Boolean).join(' · ')}`}
      </span>
      {fit.kind === 'unknown' ? (
        <span className={b.sub}>
          Roster: <NoData dash={false} fix="enter-manually" onFix={() => open('roster', 'characters')} />
        </span>
      ) : (
        <span className={cx(b.fit, b[fit.kind])}>{fit.label}</span>
      )}
      {!weapon && (
        // Only the wanted mark changes here; owned and copies stay as they are in your roster.
        <button
          type="button"
          className={b.wantButton}
          aria-label={wanted ? `Remove ${c.name} from my wanted list` : `Add ${c.name} to my wanted list`}
          onClick={() => setRosterEntry(game.id, c.id, { owned: entry?.owned ?? false, dupes: entry?.dupes ?? 0, wanted: !wanted })}
        >
          {wanted ? 'Remove from my wanted list' : 'Add to my wanted list'}
        </button>
      )}
      {!weapon &&
        (team ? (
          <span className={cx(b.fitLine, owned === mates.length && b.okText)}>
            Teammates owned {owned}/{mates.length} · {team.name}
          </span>
        ) : (
          <span className={b.glacier}>
            Fit: no data yet ·{' '}
            <button type="button" className={b.wantButton} onClick={() => open('roster', 'teams')}>
              build a team first
            </button>
          </span>
        ))}
    </div>
  );
}

/**
 * V1 "Latest changes": what changed in the banner list lately. The lists don't
 * keep a change log yet, so real lists show "No data yet"; example banners get
 * example changes so the frame is visible.
 */
function LatestChanges({ data, game, now }: { data: BannersData; game: GameContract; now: number }) {
  if (!data.banners.example) {
    return <Strip>Latest changes to the banner list: no data yet. They appear here once list updates keep a change log.</Strip>;
  }
  const next = data.banners.list.filter((x) => data.banners.exampleIds.has(x.id) && Date.parse(x.start) > now);
  const items = next.slice(0, 2).map((x) => ({ id: x.id, kind: x.leak ? 'Leak' : 'Official', text: `${x.title} ${x.leak ? 'rumoured' : 'confirmed'} for ${formatRange(Date.parse(x.start), Date.parse(x.end))}` }));
  if (items.length === 0) return null;
  return (
    <section className={b.changes} aria-label={`Latest changes, ${game.name}`}>
      <h3 className={b.sectionLabel}>LATEST CHANGES</h3>
      <ul className={b.changeList}>
        {items.map((i) => (
          <li key={i.id} className={b.change}>
            <span className={cx(b.changeKind, i.kind === 'Leak' && b.changeLeak)}>{i.kind}</span>
            <span>{i.text}</span>
            <ExampleTag />
          </li>
        ))}
      </ul>
    </section>
  );
}
