import { useLayoutEffect, useState, type CSSProperties } from 'react';
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

/** What one game puts on the shared time ruler: its character banners and where its phases begin. */
export interface Lane {
  game: GameContract;
  bars: { id: string; title: string; start: number; end: number; leak: boolean }[];
  /** First start of the Next phase, and of the Later phase; undefined when nothing is listed. */
  next: number | undefined;
  later: number | undefined;
  weapons: boolean;
}

interface Props {
  game: GameContract;
  now: number;
  many: boolean;
  hideLeaks: boolean;
  filter: BannerFilter;
  open: (module: ModuleId, tab?: string) => void;
  /** Reports this game's row for the shared ruler at the top of the screen. */
  onLane: (lane: Lane) => void;
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
 * Banners for one game as a timeline board (owner's pick, direction 2, as in the mock-up):
 * Now / Next / Later columns under the shared ruler. Every banner is a big card with its art
 * (owner: all like the Now one), its weapon banner stacked under it. Permanent banners sit apart
 * as compact rows in an "Always open" rail. On a phone the columns become tabs.
 */
export function GameBanners({ game, now, many, hideLeaks, filter, open, onLane }: Props) {
  const data = useBannersData(game, now);
  const { openSheet, sheet } = useAddOwnBanner(game, data.examples);
  const [tab, setTab] = useState<Phase>('now');
  const { live, upcoming, hiddenLeaks } = splitBanners(data.banners.list, now, hideLeaks);
  const isWeapon = (x: Banner) => game.bannerTypes.find((t) => t.id === x.type)?.target === 'weapon';
  const limitedLive = live.filter((x) => !x.permanent);
  // Next = the next phase (everything opening within two days of the first upcoming start); Later = the rest.
  const firstStart = upcoming.length ? Math.min(...upcoming.map((x) => Date.parse(x.start))) : 0;
  const phaseOf = (x: Banner): Phase => (Date.parse(x.start) <= now ? 'now' : Date.parse(x.start) <= firstStart + 2 * DAY ? 'next' : 'later');
  const laterStarts = upcoming.filter((x) => phaseOf(x) === 'later').map((x) => Date.parse(x.start));
  const lane: Lane = {
    game,
    bars: [...limitedLive, ...upcoming].filter((x) => !isWeapon(x)).map((x) => ({ id: x.id, title: x.title, start: Date.parse(x.start), end: Date.parse(x.end), leak: Boolean(x.leak) })),
    next: upcoming.length ? firstStart : undefined,
    later: laterStarts.length ? Math.min(...laterStarts) : undefined,
    weapons: game.bannerTypes.some((t) => t.target === 'weapon'),
  };
  // Before paint, so the ruler doesn't pop in a frame late. The screen keeps the old row when nothing changed, so this doesn't loop.
  useLayoutEffect(() => {
    if (!data.loading) onLane(lane);
  });
  if (data.loading) return null;
  const keep = (x: Banner) => (filter === 'leaks' ? Boolean(x.leak) : filter === 'reruns' ? rerunLabel(game, x, data.characters) === 'Rerun' : true);
  const permanent = live.filter((x) => x.permanent).filter(keep);
  const shown = [...limitedLive, ...upcoming].filter(keep).filter((x) => (filter === 'live' ? phaseOf(x) === 'now' : filter === 'upcoming' ? phaseOf(x) !== 'now' : true));
  const columns = Object.fromEntries(
    PHASES.map(({ id }) => [
      id,
      groupBanners(
        shown.filter((x) => phaseOf(x) === id),
        isWeapon,
        data,
        now,
      ),
    ]),
  ) as Record<Phase, Group[]>;
  const nothing = live.length === 0 && upcoming.length === 0 && hiddenLeaks === 0;
  const unknownRerun = [...live, ...upcoming].filter((x) => rerunLabel(game, x, data.characters) === null && !isWeapon(x)).length;
  const counts = Object.fromEntries(PHASES.map(({ id }) => [id, columns[id].length])) as Record<Phase, number>;
  // Owner: every banner looks like the big Now card; the arrow folds one down to a compact tile.
  const tile = (x: Banner, paired = false) => <BannerTile key={x.id} game={game} banner={x} data={data} open={open} now={now} paired={paired} />;
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
              {unknownRerun > 0
                ? ` ${unknownRerun} ${unknownRerun === 1 ? 'banner has' : 'banners have'} no release date for the character, so ${unknownRerun === 1 ? 'it isn’t' : 'they aren’t'} sorted: no data yet.`
                : ''}
            </Strip>
          )}
          <div className={cx(b.boardWrap, permanent.length > 0 && b.withRail)}>
            <div className={b.boardMain}>
              <div className={b.tabs} role="tablist" aria-label={`${game.short} phases`}>
                {PHASES.map(({ id, label }) => (
                  <button key={id} type="button" role="tab" aria-selected={tab === id} className={b.tabBtn} onClick={() => setTab(id)}>
                    {label} <span className={b.tabCount}>{counts[id]}</span>
                  </button>
                ))}
              </div>
              <div className={cx(b.board, many && b.boardLabelled)}>
                {many && (
                  <div className={b.gameLabel} aria-hidden="true">
                    <span>{game.name}</span>
                  </div>
                )}
                {PHASES.map(({ id, label }) => {
                  const list = columns[id];
                  const first = list[0]?.lead;
                  const note =
                    id === 'now'
                      ? list.length
                        ? first && !first.permanent
                          ? `Live · ${countdown(Date.parse(first.end) - now)} until the first one ends`
                          : 'Live now'
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
                        <div key={g.lead.id} className={cx(b.group, g.weapons.length > 0 && b.pair)}>
                          {tile(g.lead)}
                          {g.weapons.map((w) => tile(w, true))}
                        </div>
                      ))}
                      {list.length === 0 && <div className={b.emptyCell} aria-hidden="true" />}
                    </div>
                  );
                })}
              </div>
              {shown.length === 0 && (
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
            </div>
            {permanent.length > 0 && <AlwaysOpen game={game} banners={permanent} isWeapon={isWeapon} data={data} open={open} />}
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
function groupBanners(list: Banner[], isWeapon: (x: Banner) => boolean, data: BannersData, now: number): Group[] {
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

/** Two rows are the same when every bar and phase start matches; the screen keeps the old one then. */
export const sameLane = (x: Lane, y: Lane) =>
  x.game === y.game &&
  x.next === y.next &&
  x.later === y.later &&
  x.weapons === y.weapons &&
  x.bars.length === y.bars.length &&
  x.bars.every((bar, i) => {
    const o = y.bars[i];
    return o !== undefined && bar.id === o.id && bar.title === o.title && bar.start === o.start && bar.end === o.end && bar.leak === o.leak;
  });

/**
 * One time ruler for every game on the screen (as in the mock-up): a row per game with its
 * character banners (leaks dashed), Now / Next / Later marked along the top, weekly dates,
 * a TODAY line and a legend.
 */
export function SharedRuler({ lanes, now }: { lanes: Lane[]; now: number }) {
  const all = lanes.flatMap((l) => l.bars);
  if (all.length === 0) return null;
  const from = Math.max(Math.min(...all.map((x) => x.start)), now - 21 * DAY);
  const to = Math.min(Math.max(...all.map((x) => x.end), now + 28 * DAY), now + 84 * DAY);
  const span = Math.max(to - from, DAY);
  const at = (t: number) => ((Math.min(Math.max(t, from), to) - from) / span) * 100;
  const pct = (t: number) => `${at(t)}%`;
  const starts = (key: 'next' | 'later') => lanes.map((l) => l[key]).filter((t): t is number => t !== undefined && t < to);
  const next = starts('next').length ? Math.min(...starts('next')) : undefined;
  const later = starts('later').length ? Math.min(...starts('later')) : undefined;
  const phases = [
    { id: 'now', label: 'NOW', from, to: next ?? later ?? to },
    ...(next !== undefined ? [{ id: 'next', label: 'NEXT', from: next, to: later ?? to }] : []),
    ...(later !== undefined ? [{ id: 'later', label: 'LATER', from: later, to }] : []),
  ];
  const ticks: number[] = [];
  for (let t = from - (from % DAY) + DAY; t < to; t += 7 * DAY) ticks.push(t);
  const name = `${lanes.map((l) => l.game.short).join(' and ')} banner timeline`;
  return (
    <section className={b.ruler} aria-label="Timeline">
      {/* Focusable so keyboard users can scroll it sideways on a phone. */}
      <div className={b.rulerScroll} role="img" aria-label={name} tabIndex={0}>
        <div className={b.rulerInner}>
          <div className={b.rulerOverlay} aria-hidden="true">
            {phases.map((p) => (
              <span key={p.id} className={cx(b.rulerPhase, p.id === 'now' && b.rulerPhaseNow)} style={{ left: pct(p.from), width: `${at(p.to) - at(p.from)}%` }}>
                <span className={b.rulerPhaseLabel}>{p.label}</span>
              </span>
            ))}
            {now >= from && now <= to && (
              <span className={b.today} style={{ left: pct(now) }}>
                <span className={b.todayLabel}>TODAY {formatDate(now).toUpperCase()}</span>
              </span>
            )}
          </div>
          {lanes.map((l) => (
            <div key={l.game.id} className={b.rulerLane} style={{ '--gv': l.game.vent } as CSSProperties}>
              <span className={b.rulerGame}>{l.game.short}</span>
              <div className={b.rulerRows}>
                {packRows(l.bars).map((row, i) => (
                  <div key={i} className={b.rulerRow}>
                    {row.map((x) => (
                      <span
                        key={x.id}
                        className={cx(b.rulerBar, x.leak && b.rulerLeak)}
                        style={{ left: pct(x.start), width: `calc(${pct(x.end)} - ${pct(x.start)})` }}
                        title={`${x.title} · ${formatRange(x.start, x.end)}`}
                      >
                        {x.leak ? '? leak' : x.title}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className={b.rulerTicks} aria-hidden="true">
            {ticks.map((t) => (
              <span key={t} className={b.rulerTick} style={{ left: pct(t) }}>
                {formatDate(t)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className={b.legend}>
        {lanes.map((l) => (
          <span key={l.game.id} style={{ '--gv': l.game.vent } as CSSProperties}>
            <i className={b.legendSwatch} aria-hidden="true" />
            {l.game.short} banner
          </span>
        ))}
        {all.some((x) => x.leak) && (
          <span>
            <i className={cx(b.legendSwatch, b.legendLeak)} aria-hidden="true" />
            Leak, unverified
          </span>
        )}
        {lanes.some((l) => l.weapons) && <span>Weapon banners run alongside their character</span>}
      </p>
    </section>
  );
}

/** Bars that don't overlap share a row. */
function packRows<T extends { start: number; end: number }>(bars: T[]): T[][] {
  const rows: T[][] = [];
  for (const x of [...bars].sort((a, c) => a.start - c.start)) {
    const row = rows.find((r) => r.every((y) => y.end <= x.start || y.start >= x.end));
    if (row) row.push(x);
    else rows.push([x]);
  }
  return rows;
}

/** Permanent banners: open all the time, so they sit apart from the limited ones as compact rows. Weapon ones fold away. */
function AlwaysOpen({ game, banners, isWeapon, data, open }: { game: GameContract; banners: Banner[]; isWeapon: (x: Banner) => boolean; data: BannersData; open: TileProps['open'] }) {
  const chars = banners.filter((x) => !isWeapon(x));
  const weapons = banners.filter(isWeapon);
  const [showWeapons, setShowWeapons] = useState(false);
  const row = (x: Banner) => <RailRow key={x.id} game={game} banner={x} data={data} open={open} weapon={isWeapon(x)} />;
  return (
    <aside className={b.rail} aria-label={`Always open · ${game.short}`}>
      <div className={b.railHead}>
        <h3 className={b.sectionLabel}>ALWAYS OPEN</h3>
        <GameTag label={game.short} vent={game.vent} />
      </div>
      <p className={b.muted}>
        {banners.length} permanent {banners.length === 1 ? 'banner' : 'banners'}. No end date, so they sit outside the timeline.
      </p>
      <div className={b.railList}>{chars.map(row)}</div>
      {weapons.length > 0 && (
        <>
          <button type="button" className={b.railToggle} aria-expanded={showWeapons} onClick={() => setShowWeapons((v) => !v)}>
            <span>
              {showWeapons ? 'Hide' : ''} {weapons.length} {game.terms.weapon} {weapons.length === 1 ? 'banner' : 'banners'}
            </span>
            <Chevron up={showWeapons} />
          </button>
          {showWeapons && <div className={b.railList}>{weapons.map(row)}</div>}
        </>
      )}
      <button type="button" className={b.railPlan} onClick={() => open('pulls', 'planner')}>
        Plan pulls on a permanent banner →
      </button>
    </aside>
  );
}

/** One permanent banner as a compact row: picture, who, your fit, Want. */
function RailRow({ game, banner, data, open, weapon }: { game: GameContract; banner: Banner; data: BannersData; open: TileProps['open']; weapon: boolean }) {
  const w = weapon ? data.weapons.get(banner.featured[0] ?? '') : undefined;
  const c = weapon ? (w?.madeFor ? data.characters.get(w.madeFor) : undefined) : data.characters.get(banner.featured[0] ?? '');
  const pic = weapon ? w?.icon : c?.portrait;
  const name = weapon ? (w?.name ?? banner.title) : (c?.name ?? banner.title);
  const rarity = weapon ? w?.rarity : c?.rarity;
  const el = c ? game.elements.find((e) => e.id === c.element) : undefined;
  return (
    <article
      className={b.railRow}
      aria-label={banner.title}
      title={`${banner.title} · permanent, since ${formatDate(Date.parse(banner.start))}`}
      style={{ '--el': el?.color ?? 'var(--line-strong)' } as CSSProperties}
    >
      {pic ? <img src={pic} alt="" loading="lazy" className={cx(b.railPic, weapon && b.alsoWeapon)} /> : <span className={b.railPic} aria-hidden="true" />}
      <span className={b.railText}>
        <span className={b.alsoName}>
          {name} {rarity && rarity !== 'low' && <span className={rarity === 'top' ? b.top : b.mid}>{game.terms.rarity[rarity]}</span>}
        </span>
        {c && <FitPill game={game} character={c} data={data} open={open} />}
      </span>
      {!weapon && c && <WantStar game={game} character={c} data={data} />}
    </article>
  );
}

interface TileProps {
  game: GameContract;
  banner: Banner;
  data: BannersData;
  open: (module: ModuleId, tab?: string) => void;
  now: number;
  /** A weapon banner stacked under its character banner. */
  paired: boolean;
}

function Chevron({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={b.chev} aria-hidden="true">
      <path d={up ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'} />
    </svg>
  );
}

/**
 * One banner. Big (as it opens): art with the title over it, a large countdown, the featured
 * character with your fit and Want, the others featured, team fit, Plan pulls. Its arrow folds
 * it to a compact tile (picture, what, who, your fit, Want, time) and back.
 */
function BannerTile({ game, banner, data, open, now, paired }: TileProps) {
  const [big, setBig] = useState(true);
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
  const artLabel = art ? (isExample ? 'SAMPLE ART' : '') : 'NO ART YET';
  const initials = (leadWeapon?.name ?? lead?.name ?? banner.title).slice(0, 2);
  const style = { '--el': element?.color ?? 'var(--line-strong)' } as CSSProperties;
  const kind = (
    <span className={b.kind}>
      {type?.label ?? 'Banner'}
      {rerun && <span className={cx(b.rerun, rerun === 'New' && b.rerunNew)}>· {rerun}</span>}
    </span>
  );
  const tags = <>{isExample && <ExampleTag />}</>;
  const toggle = (
    <button type="button" className={b.iconBtn} aria-expanded={big} aria-label={big ? 'Show less' : 'Details'} title={big ? 'Show less' : 'Details'} onClick={() => setBig((v) => !v)}>
      <Chevron up={big} />
    </button>
  );
  const weaponLine = isWeapon && leadWeapon && (
    <span className={b.sub}>
      <strong className={b.charName}>{leadWeapon.name}</strong>{' '}
      {leadWeapon.rarity !== 'low' && <span className={leadWeapon.rarity === 'top' ? b.top : b.mid}>{game.terms.rarity[leadWeapon.rarity]}</span>}
    </span>
  );
  const missing = (
    <>
      {isWeapon && weapons.length === 0 && <span className={b.sub}>{`${game.terms.weapon} banner · ${game.terms.weapon} list not in HLITH yet`}</span>}
      {!isWeapon && featured.length === 0 && <span className={b.sub}>Featured character not in the list yet</span>}
    </>
  );

  if (!big) {
    return (
      <article className={cx(b.tile, paired && b.tilePaired, banner.leak && b.leak)} aria-label={banner.title} style={style}>
        <div className={cx(b.thumb, !art && b.thumbEmpty, isWeapon && art && b.thumbWeapon)}>
          {art ? <img src={art} alt="" loading="lazy" className={cx(b.thumbImg, isWeapon && b.thumbImgWeapon)} /> : <span aria-hidden="true">{initials}</span>}
          <span className={b.artLabel}>{artLabel}</span>
        </div>
        <div className={b.tileBody}>
          <div className={b.kindRow}>
            {kind}
            {tags}
            <span className={b.tools}>
              {!isWeapon && lead && <WantStar game={game} character={lead} data={data} />}
              {toggle}
            </span>
          </div>
          <h4 className={b.tileTitle}>{banner.title}</h4>
          {banner.leak && <UnverifiedTag source={banner.leak.source} />}
          {weaponLine}
          {lead && (
            <div className={b.leadRow}>
              <span className={b.sub}>
                {isWeapon ? 'Made for ' : ''}
                <strong className={b.charName}>{lead.name}</strong> {!isWeapon && <span className={lead.rarity === 'top' ? b.top : b.mid}>{game.terms.rarity[lead.rarity]}</span>}
              </span>
              <FitPill game={game} character={lead} data={data} open={open} />
            </div>
          )}
          {missing}
          <div className={b.timeRow}>
            {progress !== null && <ProgressBar progress={progress} />}
            <span className={b.timer}>{banner.permanent ? <span>Permanent</span> : live ? <Timer to={end} deadline prefix="ends in" /> : <Timer to={start} prefix="opens in" />}</span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={cx(b.tile, b.hero, paired && b.tilePaired, banner.leak && b.leak)} aria-label={banner.title} style={style}>
      <div className={cx(b.heroArt, !art && b.thumbEmpty, isWeapon && b.heroArtWeapon)}>
        {art ? (
          <img src={art} alt="" loading="lazy" className={cx(b.heroImg, isWeapon && b.heroImgWeapon)} />
        ) : (
          <span className={b.heroInitials} aria-hidden="true">
            {initials}
          </span>
        )}
        <span className={b.artLabel}>{artLabel}</span>
        <span className={b.heroTools}>{toggle}</span>
        <div className={b.heroText}>
          <div className={b.kindRow}>
            {kind}
            {tags}
          </div>
          <h4 className={b.heroTitle}>{banner.title}</h4>
        </div>
      </div>
      <div className={b.heroBody}>
        {banner.leak && <UnverifiedTag source={banner.leak.source} />}
        <span className={b.dates}>{banner.permanent ? `since ${formatDate(start)}` : formatRange(start, end)}</span>
        <div className={b.countdown}>
          <span className={b.alsoLabel}>{banner.permanent ? 'Permanent' : live ? 'Ends in' : 'Opens in'}</span>
          <div className={b.countdownRow}>
            {!banner.permanent && <Timer to={live ? end : start} deadline={live} className={cx(b.bigTimer)} />}
            {progress !== null && <ProgressBar progress={progress} />}
          </div>
        </div>
        {weaponLine}
        {lead && (
          <div className={b.heroLead}>
            <span className={b.sub}>
              {isWeapon ? 'Made for ' : ''}
              <strong className={b.heroName}>{lead.name}</strong> <span className={lead.rarity === 'top' ? b.top : b.mid}>{game.terms.rarity[lead.rarity]}</span>
              {!isWeapon && [element?.label, role?.label].filter(Boolean).length > 0 && <span className={b.heroEl}> {[element?.label, role?.label].filter(Boolean).join(' · ')}</span>}
            </span>
            <div className={b.heroActions}>
              <FitPill game={game} character={lead} data={data} open={open} />
              {!isWeapon && <WantStar game={game} character={lead} data={data} big />}
            </div>
          </div>
        )}
        {missing}
        {others.length > 0 && (
          <div className={b.also}>
            <span className={b.alsoLabel}>Also featured{!isWeapon && others[0] ? ` · ${game.terms.rarity[(others[0] as Character).rarity] ?? ''}` : ''}</span>
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
        <button type="button" className={b.planBig} onClick={() => open('pulls', 'planner')}>
          Plan pulls
        </button>
      </div>
    </article>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <span className={b.bar} role="img" aria-label={`${Math.round(progress * 100)}% of the banner has passed`}>
      <span className={b.barFill} style={{ width: `${progress * 100}%` }} />
    </span>
  );
}

const wantLabel = (c: Character, wanted: boolean) => (wanted ? `Remove ${c.name} from my wanted list` : `Add ${c.name} to my wanted list`);

/** A star to want a character (big: with the word "Want"). Only the wanted mark changes; owned, copies and Potential stay as they are. */
function WantStar({ game, character: c, data, big = false }: { game: GameContract; character: Character; data: BannersData; big?: boolean }) {
  const entry = data.user.roster[c.id];
  const wanted = entry?.wanted ?? false;
  return (
    <button
      type="button"
      className={cx(big ? b.wantBig : b.star, wanted && b.wantOn)}
      aria-pressed={wanted}
      aria-label={wantLabel(c, wanted)}
      title={wantLabel(c, wanted)}
      onClick={() => setRosterEntry(game.id, c.id, { ...entry, owned: entry?.owned ?? false, dupes: entry?.dupes ?? 0, wanted: !wanted })}
    >
      <span aria-hidden="true">{wanted ? '★' : '☆'}</span>
      {big && <span>{wanted ? 'Wanted' : 'Want'}</span>}
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
