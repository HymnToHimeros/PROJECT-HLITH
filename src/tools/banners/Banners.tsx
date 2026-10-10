import type { CSSProperties } from 'react';
import type { Banner, Character, GameContract, ModuleId, Weapon } from '../../core/contract';
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
      <div className={b.headRow}>
        <GameHeading game={game} show={many} />
        <span className={b.grow} />
        <EditListButton game={game} kind="banners" examples={data.examples} />
      </div>
      {data.banners.example && (
        <ExampleNotice>The banner list for this game still has to be added by us (not you), so these banners and their art are examples. The roster labels on them are your own.</ExampleNotice>
      )}
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
              {unknownRerun > 0
                ? ` ${unknownRerun} ${unknownRerun === 1 ? 'banner has' : 'banners have'} no release date for the character, so ${unknownRerun === 1 ? 'it isn’t' : 'they aren’t'} sorted: no data yet.`
                : ''}
            </Strip>
          )}
          {cards.length > 0 ? (
            <>
              {(['live', 'upcoming'] as const).map((st) => {
                const list = cards.filter((c) => c.state === st);
                if (list.length === 0) return null;
                return (
                  <div key={st} className={b.stack}>
                    <h3 className={b.sectionLabel}>
                      {st === 'live' ? 'LIVE NOW' : 'COMING UP'} · {list.length}
                    </h3>
                    <div className={st === 'live' ? b.grid : b.gridUp}>
                      {list.map(({ banner, state }) => (
                        <BannerItem key={banner.id} game={game} banner={banner} state={state} data={data} tagged={many} open={open} now={now} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <p className={b.muted}>
              {filter === 'leaks' && hideLeaks
                ? 'Leaks are hidden. Switch on “Show leaks” to see them.'
                : filter === 'reruns'
                  ? 'No reruns among the live and upcoming banners.'
                  : 'Nothing here right now.'}
            </p>
          )}
          {hiddenLeaks > 0 && (
            <p className={b.muted}>
              {hiddenLeaks} leaked {hiddenLeaks === 1 ? 'banner' : 'banners'} hidden.
            </p>
          )}
        </>
      )}
      <LatestChanges data={data} game={game} now={now} />
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
  now: number;
}

/**
 * One banner as a tracker card: the art, how long is left (with a bar for how far into the
 * banner you are), the lead with one Want button, the others as a compact row, team fit once,
 * Plan pulls. Live cards put the art beside the details on wide screens; upcoming ones are smaller.
 */
function BannerItem({ game, banner, state, data, tagged, open, now }: ItemProps) {
  const type = game.bannerTypes.find((t) => t.id === banner.type);
  const start = Date.parse(banner.start);
  const end = Date.parse(banner.end);
  const isWeapon = type?.target === 'weapon';
  // A weapon banner features weapons: each shown with its picture, and the character it's made for when the game data says so.
  const weapons = isWeapon ? banner.featured.map((id) => data.weapons.get(id)).filter((w): w is Weapon => Boolean(w)) : [];
  const leadWeapon = weapons[0];
  const featured = isWeapon
    ? weapons.flatMap((w) => (w.madeFor && data.characters.get(w.madeFor) ? [data.characters.get(w.madeFor) as Character] : []))
    : banner.featured.map((id) => data.characters.get(id)).filter((c): c is Character => Boolean(c));
  const lead = featured[0];
  const others = isWeapon ? [] : featured.slice(1);
  const isExample = data.banners.exampleIds.has(banner.id);
  // Sample art only ever illustrates example banners; real banners use the character's own art (a weapon banner: the weapon's picture).
  const art = banner.art ?? (isWeapon && leadWeapon ? leadWeapon.icon : lead ? (isExample ? (data.sampleArt.get(lead.id) ?? lead.art) : lead.art) : undefined);
  const element = lead ? game.elements.find((e) => e.id === lead.element) : undefined;
  const rerun = rerunLabel(game, banner, data.characters);
  const progress = state === 'live' && !banner.permanent && end > start ? Math.min(1, Math.max(0, (now - start) / (end - start))) : null;
  return (
    <article className={cx(b.card, state === 'upcoming' && b.cardUp, banner.leak && b.leak)} aria-label={banner.title} style={{ '--el': element?.color ?? 'var(--line-strong)' } as CSSProperties}>
      <div className={b.inner}>
        <div className={cx(b.art, !art && b.artEmpty, isWeapon && art && b.artWeaponBox)}>
          {art ? (
            <img src={art} alt="" loading="lazy" className={cx(b.artImg, isWeapon && b.artWeapon)} />
          ) : (
            <span className={b.artName} aria-hidden="true">
              {leadWeapon?.name ?? lead?.name ?? banner.title}
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
          <div className={b.when}>
            <div className={b.whenRow}>
              <span>{banner.permanent ? `since ${formatDate(start)}` : formatRange(start, end)}</span>
              <span className={b.timer}>
                {banner.permanent && state === 'live' ? <span>Permanent</span> : state === 'live' ? <Timer to={end} deadline prefix="ends in" /> : <Timer to={start} prefix="opens in" />}
              </span>
            </div>
            {progress !== null && (
              <span className={b.bar} role="img" aria-label={`${Math.round(progress * 100)}% of the banner has passed`}>
                <span className={b.barFill} style={{ width: `${progress * 100}%` }} />
              </span>
            )}
          </div>
          {isWeapon && leadWeapon && (
            <div className={b.weapon}>
              {leadWeapon.icon ? <img src={leadWeapon.icon} alt="" loading="lazy" className={b.weaponIcon} /> : <span className={b.weaponIcon} aria-hidden="true" />}
              <div className={b.weaponText}>
                <span className={b.sub}>
                  <strong className={b.charName}>{leadWeapon.name}</strong>{' '}
                  {leadWeapon.rarity !== 'low' && <span className={leadWeapon.rarity === 'top' ? b.top : b.mid}>{game.terms.rarity[leadWeapon.rarity]}</span>}
                </span>
                {lead && <Lead game={game} character={lead} data={data} weapon open={open} />}
              </div>
            </div>
          )}
          {isWeapon && weapons.length > 1 && (
            <div className={b.also}>
              <span className={b.alsoLabel}>Also featured</span>
              <ul className={b.alsoList}>
                {weapons.slice(1).map((w) => {
                  const owner = w.madeFor ? data.characters.get(w.madeFor) : undefined;
                  return (
                    <li key={w.id} className={b.alsoItem}>
                      {w.icon ? <img src={w.icon} alt="" loading="lazy" className={cx(b.alsoPic, b.alsoWeapon)} /> : <span className={b.alsoPic} aria-hidden="true" />}
                      <span className={b.alsoText}>
                        <span className={b.alsoName}>
                          {w.name} {w.rarity !== 'low' && <span className={w.rarity === 'top' ? b.top : b.mid}>{game.terms.rarity[w.rarity]}</span>}
                        </span>
                        {owner && (
                          <span className={b.alsoFor}>
                            for {owner.name} <FitPill game={game} character={owner} data={data} open={open} />
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {!isWeapon && lead && <Lead game={game} character={lead} data={data} weapon={false} open={open} />}
          {others.length > 0 && <AlsoFeatured game={game} characters={others} data={data} open={open} />}
          {isWeapon && weapons.length === 0 && <span className={b.sub}>{`${game.terms.weapon} banner · ${game.terms.weapon} list not in HLITH yet`}</span>}
          {!isWeapon && featured.length === 0 && <span className={b.sub}>Featured character not in the list yet</span>}
          <div className={b.footer}>
            {!isWeapon && lead && <TeamLine game={game} character={lead} data={data} open={open} />}
            <span className={b.grow} />
            <button type="button" className={b.plan} onClick={() => open('pulls', 'planner')}>
              Plan pulls
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

const wantLabel = (c: Character, wanted: boolean) => (wanted ? `Remove ${c.name} from my wanted list` : `Add ${c.name} to my wanted list`);

/** Only the wanted mark changes here; owned and copies stay as they are in your roster. */
const toggleWanted = (game: GameContract, data: BannersData, c: Character) => {
  const entry = data.user.roster[c.id];
  setRosterEntry(game.id, c.id, { ...entry, owned: entry?.owned ?? false, dupes: entry?.dupes ?? 0, wanted: !(entry?.wanted ?? false) });
};

function FitPill({ game, character: c, data, open }: { game: GameContract; character: Character; data: BannersData; open: ItemProps['open'] }) {
  const fit = rosterFit(game, data.user.roster, c.id);
  return fit.kind === 'unknown' ? (
    <span className={b.sub}>
      Roster: <NoData dash={false} fix="enter-manually" onFix={() => open('roster', 'characters')} />
    </span>
  ) : (
    <span className={cx(b.fit, b[fit.kind])}>{fit.label}</span>
  );
}

/** The featured character: portrait, name, what they are, your roster fit and one Want button. */
function Lead({ game, character: c, data, weapon, open }: { game: GameContract; character: Character; data: BannersData; weapon: boolean; open: ItemProps['open'] }) {
  const element = game.elements.find((e) => e.id === c.element);
  const role = game.roles.find((r) => r.id === c.role);
  const wanted = data.user.roster[c.id]?.wanted ?? false;
  return (
    <div className={b.lead}>
      {!weapon && (c.portrait ? <img src={c.portrait} alt="" loading="lazy" className={b.leadPic} /> : <span className={b.leadPic} aria-hidden="true" />)}
      <div className={b.leadText}>
        <span className={b.sub}>
          {weapon ? 'Made for ' : ''}
          <strong className={b.charName}>{c.name}</strong> <span className={c.rarity === 'top' ? b.top : b.mid}>{game.terms.rarity[c.rarity]}</span>
          {[element?.label, role?.label].filter(Boolean).length > 0 && ` · ${[element?.label, role?.label].filter(Boolean).join(' · ')}`}
        </span>
        <FitPill game={game} character={c} data={data} open={open} />
      </div>
      {!weapon && (
        <button type="button" className={cx(b.want, wanted && b.wantOn)} aria-pressed={wanted} aria-label={wantLabel(c, wanted)} onClick={() => toggleWanted(game, data, c)}>
          {wanted ? '★ Wanted' : '☆ Want'}
        </button>
      )}
    </div>
  );
}

/** The other featured characters (the 4★s): one small tile each with your roster fit and a star to want them. */
function AlsoFeatured({ game, characters, data, open }: { game: GameContract; characters: Character[]; data: BannersData; open: ItemProps['open'] }) {
  return (
    <div className={b.also}>
      <span className={b.alsoLabel}>Also featured</span>
      <ul className={b.alsoList}>
        {characters.map((c) => {
          const wanted = data.user.roster[c.id]?.wanted ?? false;
          return (
            <li key={c.id} className={b.alsoItem}>
              {c.portrait ? <img src={c.portrait} alt="" loading="lazy" className={b.alsoPic} /> : <span className={b.alsoPic} aria-hidden="true" />}
              <span className={b.alsoText}>
                <span className={b.alsoName}>
                  {c.name} <span className={c.rarity === 'top' ? b.top : b.mid}>{game.terms.rarity[c.rarity]}</span>
                </span>
                <FitPill game={game} character={c} data={data} open={open} />
              </span>
              <button
                type="button"
                className={cx(b.star, wanted && b.wantOn)}
                aria-pressed={wanted}
                aria-label={wantLabel(c, wanted)}
                title={wantLabel(c, wanted)}
                onClick={() => toggleWanted(game, data, c)}
              >
                {wanted ? '★' : '☆'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Team fit, once per banner, for the lead: how many teammates of your saved team you own. */
function TeamLine({ character: c, data, open }: { game: GameContract; character: Character; data: BannersData; open: ItemProps['open'] }) {
  const team = data.user.teams.find((t) => t.members.includes(c.id));
  const mates = team ? team.members.filter((id) => id !== c.id) : [];
  const owned = mates.filter((id) => data.user.roster[id]?.owned).length;
  return team ? (
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
  const items = next
    .slice(0, 2)
    .map((x) => ({ id: x.id, kind: x.leak ? 'Leak' : 'Official', text: `${x.title} ${x.leak ? 'rumoured' : 'confirmed'} for ${formatRange(Date.parse(x.start), Date.parse(x.end))}` }));
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
