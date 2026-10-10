import { useState, type CSSProperties, type ReactNode } from 'react';
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

const DAY = 86_400_000;

type Phase = 'now' | 'next' | 'later';
const PHASES: { id: Phase; label: string }[] = [
  { id: 'now', label: 'Now' },
  { id: 'next', label: 'Next' },
  { id: 'later', label: 'Later' },
];

interface Group {
  lead: Banner;
  /** Weapon banners that run beside the lead (same character, same dates). */
  weapons: Banner[];
}

/**
 * Banners for one game as a timeline board (owner's pick, direction 2): a time ruler with a
 * TODAY line, then Now / Next / Later columns. Each character banner is a tile with its weapon
 * banner stacked under it. Permanent banners sit apart in an "Always open" rail. On a phone
 * the columns become tabs.
 */
export function GameBanners({ game, now, many, hideLeaks, filter, open }: Props) {
  const data = useBannersData(game, now);
  const { openSheet, sheet } = useAddOwnBanner(game, data.examples);
  const [tab, setTab] = useState<Phase>('now');
  if (data.loading) return null;
  const { live, upcoming, hiddenLeaks } = splitBanners(data.banners.list, now, hideLeaks);
  const isWeapon = (b: Banner) => game.bannerTypes.find((t) => t.id === b.type)?.target === 'weapon';
  const keep = (b: Banner) =>
    filter === 'leaks' ? Boolean(b.leak) : filter === 'reruns' ? rerunLabel(game, b, data.characters) === 'Rerun' : true;
  const permanent = live.filter((b) => b.permanent).filter(keep);
  const limitedLive = live.filter((b) => !b.permanent);
  // Next = the next phase (everything opening within two days of the first upcoming start); Later = the rest.
  const firstStart = upcoming.length ? Math.min(...upcoming.map((b) => Date.parse(b.start))) : 0;
  const phaseOf = (b: Banner): Phase => (Date.parse(b.start) <= now ? 'now' : Date.parse(b.start) <= firstStart + 2 * DAY ? 'next' : 'later');
  const shown = [...limitedLive, ...upcoming].filter(keep).filter((b) => (filter === 'live' ? phaseOf(b) === 'now' : filter === 'upcoming' ? phaseOf(b) !== 'now' : true));
  const columns = Object.fromEntries(PHASES.map(({ id }) => [id, groupBanners(shown.filter((b) => phaseOf(b) === id), isWeapon, data, now)])) as Record<Phase, Group[]>;
  const nothing = live.length === 0 && upcoming.length === 0 && hiddenLeaks === 0;
  const unknownRerun = [...live, ...upcoming].filter((x) => rerunLabel(game, x, data.characters) === null && !isWeapon(x)).length;
  const counts = Object.fromEntries(PHASES.map(({ id }) => [id, columns[id].length])) as Record<Phase, number>;
  const tile = (b: Banner, paired = false) => <BannerTile key={b.id} game={game} banner={b} data={data} tagged={many} open={open} now={now} paired={paired} />;
  return (
    <section className={b.stack} aria-label={game.name} style={{ '--vent': game.vent } as CSSProperties}>
      <div className={b.headRow}>
        <GameHeading game={game} show={many} />
        <span className={b.grow} />
        <EditListButton game={game} kind="banners" examples={data.examples} />
      </div>
      {data.banners.example && (
        <ExampleNotice>
          The banner list for this game still has to be added by us (not you), so these banners and their art are examples. The roster labels on them are your own.
        </ExampleNotice>
      )}
      {nothing ? (
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
          <div className={cx(b.boardWrap, permanent.length > 0 && b.withRail)}>
            <div className={b.boardMain}>
              <Ruler game={game} banners={[...limitedLive, ...upcoming].filter((x) => !isWeapon(x))} now={now} />
              <div className={b.tabs} role="tablist" aria-label={`${game.short} phases`}>
                {PHASES.map(({ id, label }) => (
                  <button key={id} type="button" role="tab" aria-selected={tab === id} className={b.tabBtn} onClick={() => setTab(id)}>
                    {label} <span className={b.tabCount}>{counts[id]}</span>
                  </button>
                ))}
              </div>
              <div className={b.board}>
                {PHASES.map(({ id, label }) => {
                  const list = columns[id];
                  const first = list[0]?.lead;
                  const note =
                    id === 'now'
                      ? list.length
                        ? 'Live now'
                        : 'Nothing limited is live'
                      : first
                        ? `${formatRange(Date.parse(first.start), Date.parse(first.end))} · opens in ${countdown(Date.parse(first.start) - now)}`
                        : id === 'next'
                          ? 'Not announced yet'
                          : 'Nothing further listed';
                  return (
                    <div key={id} className={cx(b.column, id === 'now' && b.columnNow)} data-active={tab === id}>
                      <div className={b.columnHead}>
                        <span className={b.columnLabel}>{label}</span>
                        <span className={b.columnNote}>{note}</span>
                      </div>
                      {list.map((g) => (
                        <div key={g.lead.id} className={b.group}>
                          {tile(g.lead)}
                          {g.weapons.map((w) => tile(w, true))}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              {shown.length === 0 && (
                <p className={b.muted}>
                  {filter === 'leaks' && hideLeaks ? 'Leaks are hidden. Switch on “Show leaks” to see them.' : filter === 'reruns' ? 'No reruns among the live and upcoming banners.' : 'Nothing here right now.'}
                </p>
              )}
              {hiddenLeaks > 0 && (
                <p className={b.muted}>
                  {hiddenLeaks} leaked {hiddenLeaks === 1 ? 'banner' : 'banners'} hidden.
                </p>
              )}
            </div>
            {permanent.length > 0 && <AlwaysOpen game={game} banners={permanent} isWeapon={isWeapon} tile={tile} />}
          </div>
        </>
      )}
      <LatestChanges data={data} game={game} now={now} />
      {sheet}
    </section>
  );
}

const countdown = (ms: number) => {
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / 3_600_000);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
};

/** Character banners in order, each with the weapon banners that run beside it; unpaired weapon banners stand alone. */
function groupBanners(list: Banner[], isWeapon: (b: Banner) => boolean, data: BannersData, now: number): Group[] {
  const sorted = [...list].sort((x, y) => (Date.parse(x.start) <= now ? Date.parse(x.end) - Date.parse(y.end) : Date.parse(x.start) - Date.parse(y.start)) || x.id.localeCompare(y.id));
  const chars = sorted.filter((x) => !isWeapon(x));
  const used = new Set<string>();
  const groups: Group[] = chars.map((lead) => {
    const weapons = sorted.filter((w) => {
      if (!isWeapon(w) || used.has(w.id)) return false;
      const madeFor = w.featured.map((id) => data.weapons.get(id)?.madeFor).find(Boolean);
      const same = Math.abs(Date.parse(w.start) - Date.parse(lead.start)) <= DAY;
      if (madeFor && madeFor === lead.featured[0] && same) {
        used.add(w.id);
        return true;
      }
      return false;
    });
    return { lead, weapons };
  });
  for (const w of sorted) if (isWeapon(w) && !used.has(w.id)) groups.push({ lead: w, weapons: [] });
  return groups;
}

/** The time ruler: one bar per character banner (leaks dashed), weekly ticks and a TODAY line. */
function Ruler({ game, banners, now }: { game: GameContract; banners: Banner[]; now: number }) {
  if (banners.length === 0) return null;
  const from = Math.max(Math.min(...banners.map((x) => Date.parse(x.start))), now - 21 * DAY);
  const to = Math.min(Math.max(...banners.map((x) => Date.parse(x.end)), now + 28 * DAY), now + 84 * DAY);
  const span = Math.max(to - from, DAY);
  const pct = (t: number) => `${(Math.min(Math.max(t, from), to) - from) / span * 100}%`;
  // Pack bars into rows so ones that don't overlap share a row.
  const rows: Banner[][] = [];
  for (const x of [...banners].sort((a, c) => Date.parse(a.start) - Date.parse(c.start))) {
    const row = rows.find((r) => r.every((y) => Date.parse(y.end) <= Date.parse(x.start) || Date.parse(y.start) >= Date.parse(x.end)));
    if (row) row.push(x);
    else rows.push([x]);
  }
  const ticks: number[] = [];
  for (let t = from - (from % DAY) + DAY; t < to; t += 7 * DAY) ticks.push(t);
  return (
    // Focusable so keyboard users can scroll it sideways on a phone.
    <div className={b.ruler} role="img" aria-label={`${game.short} banner timeline`} tabIndex={0}>
      <div className={b.rulerInner}>
        {rows.map((row, i) => (
          <div key={i} className={b.rulerRow}>
            {row.map((x) => (
              <span
                key={x.id}
                className={cx(b.rulerBar, x.leak && b.rulerLeak)}
                style={{ left: pct(Date.parse(x.start)), width: `calc(${pct(Date.parse(x.end))} - ${pct(Date.parse(x.start))})` }}
                title={`${x.title} · ${formatRange(Date.parse(x.start), Date.parse(x.end))}`}
              >
                {x.leak ? '? leak' : x.title}
              </span>
            ))}
          </div>
        ))}
        <div className={b.rulerTicks} aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className={b.rulerTick} style={{ left: pct(t) }}>
              {formatDate(t)}
            </span>
          ))}
        </div>
        {now >= from && now <= to && (
          <span className={b.today} style={{ left: pct(now) }} aria-hidden="true">
            <span className={b.todayLabel}>TODAY</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Permanent banners: open all the time, so they sit apart from the limited ones. Weapon ones fold away. */
function AlwaysOpen({ game, banners, isWeapon, tile }: { game: GameContract; banners: Banner[]; isWeapon: (b: Banner) => boolean; tile: (b: Banner) => ReactNode }) {
  const chars = banners.filter((x) => !isWeapon(x));
  const weapons = banners.filter(isWeapon);
  const [showWeapons, setShowWeapons] = useState(false);
  return (
    <aside className={b.rail} aria-label={`Always open · ${game.short}`}>
      <h3 className={b.sectionLabel}>ALWAYS OPEN · {banners.length}</h3>
      <p className={b.muted}>Permanent banners with no end date, kept apart from the limited ones.</p>
      {chars.map((x) => tile(x))}
      {weapons.length > 0 && (
        <>
          <button type="button" className={b.railToggle} aria-expanded={showWeapons} onClick={() => setShowWeapons((v) => !v)}>
            {showWeapons ? 'Hide' : 'Show'} {weapons.length} {game.terms.weapon} {weapons.length === 1 ? 'banner' : 'banners'}
          </button>
          {showWeapons && weapons.map((x) => tile(x))}
        </>
      )}
    </aside>
  );
}

interface TileProps {
  game: GameContract;
  banner: Banner;
  data: BannersData;
  tagged: boolean;
  open: (module: ModuleId, tab?: string) => void;
  now: number;
  /** A weapon banner stacked under its character banner. */
  paired: boolean;
}

/** One banner: compact (picture, what, who, your fit, Want, time left, Plan pulls); Details opens the rest. */
function BannerTile({ game, banner, data, tagged, open, now, paired }: TileProps) {
  const [details, setDetails] = useState(false);
  const type = game.bannerTypes.find((t) => t.id === banner.type);
  const start = Date.parse(banner.start);
  const end = Date.parse(banner.end);
  const isWeapon = type?.target === 'weapon';
  const weapons = isWeapon ? banner.featured.map((id) => data.weapons.get(id)).filter((w): w is Weapon => Boolean(w)) : [];
  const leadWeapon = weapons[0];
  const featured = isWeapon
    ? weapons.flatMap((w) => (w.madeFor && data.characters.get(w.madeFor) ? [data.characters.get(w.madeFor) as Character] : []))
    : banner.featured.map((id) => data.characters.get(id)).filter((c): c is Character => Boolean(c));
  const lead = featured[0];
  const isExample = data.banners.exampleIds.has(banner.id);
  // Sample art only ever illustrates example banners; real banners use the character's own art (a weapon banner: the weapon's picture).
  const art = banner.art ?? (isWeapon && leadWeapon ? leadWeapon.icon : lead ? (isExample ? (data.sampleArt.get(lead.id) ?? lead.art) : lead.art) : undefined);
  const element = lead ? game.elements.find((e) => e.id === lead.element) : undefined;
  const role = lead ? game.roles.find((r) => r.id === lead.role) : undefined;
  const rerun = rerunLabel(game, banner, data.characters);
  const live = start <= now;
  const progress = live && !banner.permanent && end > start ? Math.min(1, Math.max(0, (now - start) / (end - start))) : null;
  const others = isWeapon ? weapons.slice(1) : featured.slice(1);
  const detailsId = `banner-details-${game.id}-${banner.id}`;
  return (
    <article
      className={cx(b.tile, paired && b.tilePaired, banner.leak && b.leak)}
      aria-label={banner.title}
      style={{ '--el': element?.color ?? 'var(--line-strong)' } as CSSProperties}
    >
      <div className={b.tileTop}>
        <div className={cx(b.thumb, !art && b.thumbEmpty, isWeapon && art && b.thumbWeapon)}>
          {art ? <img src={art} alt="" loading="lazy" className={cx(b.thumbImg, isWeapon && b.thumbImgWeapon)} /> : <span aria-hidden="true">{(leadWeapon?.name ?? lead?.name ?? banner.title).slice(0, 2)}</span>}
          <span className={b.artLabel}>{art ? (isExample ? 'SAMPLE ART' : '') : 'NO ART YET'}</span>
        </div>
        <div className={b.tileBody}>
          <div className={b.kindRow}>
            <span className={b.kind}>
              {type?.label ?? 'Banner'}
              {rerun && ` · ${rerun}`}
            </span>
            {isExample && <ExampleTag />}
            {tagged && <GameTag label={game.short} vent={game.vent} />}
            {!isWeapon && lead && <WantStar game={game} character={lead} data={data} />}
          </div>
          <h4 className={b.tileTitle}>{banner.title}</h4>
          {banner.leak && <UnverifiedTag source={banner.leak.source} />}
          {isWeapon && leadWeapon && (
            <span className={b.sub}>
              <strong className={b.charName}>{leadWeapon.name}</strong> {leadWeapon.rarity !== 'low' && <span className={leadWeapon.rarity === 'top' ? b.top : b.mid}>{game.terms.rarity[leadWeapon.rarity]}</span>}
            </span>
          )}
          {lead && (
            <div className={b.leadRow}>
              <span className={b.sub}>
                {isWeapon ? 'Made for ' : ''}
                <strong className={b.charName}>{lead.name}</strong> {!isWeapon && <span className={lead.rarity === 'top' ? b.top : b.mid}>{game.terms.rarity[lead.rarity]}</span>}
              </span>
              <FitPill game={game} character={lead} data={data} open={open} />
            </div>
          )}
          {isWeapon && weapons.length === 0 && <span className={b.sub}>{`${game.terms.weapon} banner · ${game.terms.weapon} list not in HLITH yet`}</span>}
          {!isWeapon && featured.length === 0 && <span className={b.sub}>Featured character not in the list yet</span>}
        </div>
      </div>
      <div className={b.timeRow}>
        <span className={b.timer}>{banner.permanent ? <span>Permanent</span> : live ? <Timer to={end} deadline prefix="ends in" /> : <Timer to={start} prefix="opens in" />}</span>
        <span className={b.dates}>{banner.permanent ? `since ${formatDate(start)}` : formatRange(start, end)}</span>
      </div>
      {progress !== null && (
        <span className={b.bar} role="img" aria-label={`${Math.round(progress * 100)}% of the banner has passed`}>
          <span className={b.barFill} style={{ width: `${progress * 100}%` }} />
        </span>
      )}
      <div className={b.tileActions}>
        <button type="button" className={b.detailsBtn} aria-expanded={details} aria-controls={detailsId} onClick={() => setDetails((v) => !v)}>
          {details ? 'Less' : 'Details'}
        </button>
        <span className={b.grow} />
        <button type="button" className={b.plan} onClick={() => open('pulls', 'planner')}>
          Plan pulls
        </button>
      </div>
      <div id={detailsId} className={b.details} hidden={!details}>
        {!isWeapon && lead && [element?.label, role?.label].filter(Boolean).length > 0 && (
          <span className={b.sub}>
            {lead.name}: {[element?.label, role?.label].filter(Boolean).join(' · ')}
          </span>
        )}
        {others.length > 0 && (
          <div className={b.also}>
            <span className={b.alsoLabel}>Also featured</span>
            <ul className={b.alsoList}>
              {isWeapon
                ? (others as Weapon[]).map((w) => {
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
                  })
                : (others as Character[]).map((c) => (
                    <li key={c.id} className={b.alsoItem}>
                      {c.portrait ? <img src={c.portrait} alt="" loading="lazy" className={b.alsoPic} /> : <span className={b.alsoPic} aria-hidden="true" />}
                      <span className={b.alsoText}>
                        <span className={b.alsoName}>
                          {c.name} <span className={c.rarity === 'top' ? b.top : b.mid}>{game.terms.rarity[c.rarity]}</span>
                        </span>
                        <FitPill game={game} character={c} data={data} open={open} />
                      </span>
                      <WantStar game={game} character={c} data={data} />
                    </li>
                  ))}
            </ul>
          </div>
        )}
        {!isWeapon && lead && <TeamLine character={lead} data={data} open={open} />}
      </div>
    </article>
  );
}

const wantLabel = (c: Character, wanted: boolean) => (wanted ? `Remove ${c.name} from my wanted list` : `Add ${c.name} to my wanted list`);

/** A star to want a character. Only the wanted mark changes; owned, copies and Potential stay as they are. */
function WantStar({ game, character: c, data }: { game: GameContract; character: Character; data: BannersData }) {
  const entry = data.user.roster[c.id];
  const wanted = entry?.wanted ?? false;
  return (
    <button
      type="button"
      className={cx(b.star, wanted && b.wantOn)}
      aria-pressed={wanted}
      aria-label={wantLabel(c, wanted)}
      title={wantLabel(c, wanted)}
      onClick={() => setRosterEntry(game.id, c.id, { ...entry, owned: entry?.owned ?? false, dupes: entry?.dupes ?? 0, wanted: !wanted })}
    >
      {wanted ? '★' : '☆'}
    </button>
  );
}

function FitPill({ game, character: c, data, open }: { game: GameContract; character: Character; data: BannersData; open: TileProps['open'] }) {
  const fit = rosterFit(game, data.user.roster, c.id);
  return fit.kind === 'unknown' ? (
    <span className={b.sub}>
      Roster: <NoData dash={false} fix="enter-manually" onFix={() => open('roster', 'characters')} />
    </span>
  ) : (
    <span className={cx(b.fit, b[fit.kind])}>{fit.label}</span>
  );
}

/** Team fit for the lead: how many teammates of your saved team you own. */
function TeamLine({ character: c, data, open }: { character: Character; data: BannersData; open: TileProps['open'] }) {
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
