import { useId, useMemo, useState } from 'react';
import type { Character } from '../../core/contract';
import { getPrefs, updatePrefs, usePrefs } from '../../core/data/prefs';
import { setRosterEntry, type RosterEntry } from '../../core/data/userData';
import { EmptyState, GameTag, HowTo } from '../../core/ui';
import { RosterImport } from '../account-links/RosterImport';
import { useHideLeaks } from '../banners/leakPref';
import { ScanEntry } from '../scan/Scan';
import { setShowLeaked, useShowLeaked } from './leakedPref';
import r from './roster.module.css';
import { artOf, byNewest, CharArt, dupesLabel, elementOf, entryOf, leaksFirst, rarityColor, subtitleOf, tagOf } from './shared';
import { allTags } from './MyLabels';
import { teamAccount } from './TeamParts';
import type { RosterData } from './useRosterData';

type Show = 'all' | 'owned' | 'not-owned' | 'wanted';
type Sort = 'newest' | 'name' | 'rarity' | 'fit';
type Tap = 'open' | 'owned' | 'wanted' | 'copies' | 'select';

interface Props {
  data: RosterData[];
  several: boolean;
  onOpen: (game: string, id: string) => void;
}

interface Row {
  d: RosterData;
  c: Character;
  e: RosterEntry;
  key: string;
}

const SHOW: { id: Show; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'owned', label: 'Owned' },
  { id: 'not-owned', label: 'Not owned' },
  { id: 'wanted', label: 'Wanted' },
];

const TAP: { id: Tap; label: string }[] = [
  { id: 'open', label: 'Open page' },
  { id: 'owned', label: 'Mark owned' },
  { id: 'wanted', label: 'Mark wanted' },
  { id: 'copies', label: 'Add a copy' },
  { id: 'select', label: 'Select several' },
];

/**
 * Roster → Characters (design): "N of M owned", All / Owned / Not owned, and the tile grid.
 * Newest first by default (release date; undated after dated, then by name).
 * Leaked characters (Character.leak) appear only with "Show leaked" on, marked
 * unverified with their source; they can be wanted but not owned. Shown leaks always come
 * first, newest first among them, whatever the sort (owner: they are the newest).
 */
/** The view you used last (Customise → Roster remembers it): sort, show, element, rarity and tag. */
const savedView = () => getPrefs().roster?.view ?? {};
const remember = (change: Record<string, string>) =>
  updatePrefs((p) => ({ ...p, roster: { ...p.roster, view: Object.fromEntries(Object.entries({ ...p.roster?.view, ...change }).filter(([, v]) => v)) } }));
const pickOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly unknown[]).includes(v) ? (v as T) : fallback);

export function Characters({ data, several, onOpen }: Props) {
  const [query, setQuery] = useState('');
  const [element, setElementState] = useState(() => savedView().element ?? '');
  const [rarity, setRarityState] = useState(() => savedView().rarity ?? '');
  const [show, setShowState] = useState<Show>(() => pickOf(['all', 'owned', 'not-owned', 'wanted'], savedView().show, 'all'));
  const [sort, setSortState] = useState<Sort>(() => pickOf(['newest', 'name', 'rarity', 'fit'], savedView().sort, 'newest'));
  const [tagFilter, setTagState] = useState(() => savedView().tag ?? '');
  const setElement = (v: string) => (setElementState(v), remember({ element: v }));
  const setRarity = (v: string) => (setRarityState(v), remember({ rarity: v }));
  const setShow = (v: Show) => (setShowState(v), remember({ show: v === 'all' ? '' : v }));
  const setSort = (v: Sort) => (setSortState(v), remember({ sort: v === 'newest' ? '' : v }));
  const setTag = (v: string) => (setTagState(v), remember({ tag: v }));
  const rosterPrefs = usePrefs().roster;
  const tileSize = rosterPrefs?.tileSize ?? 'normal';
  const hideOnTile = new Set(rosterPrefs?.hideOnTile ?? []);
  const tags = allTags(data.map((d) => d.user));
  const [tap, setTap] = useState<Tap>('open');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // Search, element / rarity / sort and quick marking live behind one "Filters" button, closed by default.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const panelId = useId();

  const showLeaked = useShowLeaked();
  const hideLeaks = useHideLeaks();
  // "Hide leaks" (Banners) wins: with it on, leaked characters stay hidden here too.
  const leaksShown = showLeaked && !hideLeaks;
  const allRows: Row[] = useMemo(() => data.flatMap((d) => d.characters.map((c) => ({ d, c, e: entryOf(d.user.roster, c.id), key: `${d.game.id}:${c.id}` }))), [data]);
  const released = useMemo(() => allRows.filter((x) => !x.c.leak), [allRows]);
  const leakedCount = allRows.length - released.length;
  const rows = leaksShown ? allRows : released;
  const word = several ? 'character' : (data[0]?.game.terms.character.toLowerCase() ?? 'character');
  const elements = [...new Set(data.flatMap((d) => d.game.elements.map((e) => e.label)))];
  const rarityWord = (k: 'top' | 'mid' | 'low') => [...new Set(data.map((d) => d.game.terms.rarity[k]).filter(Boolean))].join(' · ');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const keep = ({ d, c, e }: Row) => {
      if (q && !`${c.name} ${d.user.nicknames?.[c.id] ?? ''} ${subtitleOf(d.game, c)} ${(d.user.tags?.[c.id] ?? []).join(' ')}`.toLowerCase().includes(q)) return false;
      if (tagFilter && !(d.user.tags?.[c.id] ?? []).includes(tagFilter)) return false;
      if (element && elementOf(d.game, c.element)?.label !== element) return false;
      if (rarity && c.rarity !== rarity) return false;
      if (show === 'owned' && !e.owned) return false;
      if (show === 'not-owned' && e.owned) return false;
      if (show === 'wanted' && !e.wanted) return false;
      return true;
    };
    // Best fit for me: what each character adds to your teams (the game's team rules); not rated yet = last.
    const fit = new Map<string, number>();
    if (sort === 'fit')
      for (const x of rows) {
        const v = x.d.game.rules.teams?.ifYouPull(x.c.id, teamAccount(x.d));
        if (v) fit.set(x.key, v.percent);
      }
    const chosen = (a: Row, b: Row) =>
      sort === 'fit'
        ? (fit.get(b.key) ?? -1) - (fit.get(a.key) ?? -1) || byNewest(a.c, b.c)
        : sort === 'name'
          ? a.c.name.localeCompare(b.c.name)
          : sort === 'rarity' && a.c.rarity !== b.c.rarity
            ? (a.c.rarity === 'top' ? -1 : 1)
            : byNewest(a.c, b.c);
    // Leaked characters always come first, newest first among them (owner); the chosen sort orders the rest.
    const order = (a: Row, b: Row) => (a.c.leak || b.c.leak ? leaksFirst(a.c, b.c) : chosen(a, b));
    return rows.filter(keep).sort(order);
  }, [rows, query, element, rarity, show, sort, tagFilter]);
  const canFit = data.some((d) => d.game.rules.teams);

  // "N of M owned" counts released characters only: a leak can't be owned.
  const owned = released.filter((x) => x.e.owned).length;
  const wanted = rows.filter((x) => x.e.wanted).length;
  const filtered = Boolean(query || element || rarity || tagFilter || show !== 'all');
  const anyDates = rows.some((x) => x.c.releasedAt);
  const clear = () => {
    setQuery('');
    setElement('');
    setRarity('');
    setTag('');
    setShow('all');
  };

  // Owning someone means you're no longer saving for them: marking Owned clears Wanted.
  const save = (x: Row, change: Partial<RosterEntry>) => {
    if (x.c.leak && (change.owned || change.dupes)) return; // leaked: wanted only, never owned
    setRosterEntry(x.d.game.id, x.c.id, { ...x.e, ...change, ...(change.owned && !x.e.owned ? { wanted: false } : {}) });
  };
  const onTile = (x: Row) => {
    if (tap === 'open') onOpen(x.d.game.id, x.c.id);
    else if (tap === 'owned') save(x, { owned: !x.e.owned });
    else if (tap === 'wanted') save(x, { wanted: !x.e.wanted });
    else if (tap === 'copies') {
      const max = x.d.game.dupes?.max ?? 0;
      save(x, x.e.owned ? { dupes: x.e.dupes >= max ? 0 : x.e.dupes + 1 } : { owned: true });
    } else
      setPicked((p) => {
        const next = new Set(p);
        if (next.has(x.key)) next.delete(x.key);
        else next.add(x.key);
        return next;
      });
  };
  const bulk = (change: Partial<RosterEntry>) => {
    for (const x of rows) if (picked.has(x.key)) save(x, change);
    setPicked(new Set());
  };

  if (released.length === 0 && !(leaksShown && leakedCount > 0)) {
    return <EmptyState title={`No ${word} list yet`} body={`This game’s ${word} list hasn’t been added yet. It appears here as soon as it is.`} />;
  }

  const game = data[0]?.game;
  const extras = [query, element, rarity, tagFilter, sort !== 'newest', tap !== 'open'].filter(Boolean).length;

  return (
    <div className={r.stack}>
      <div className={r.headRow}>
        {/* RosterImport mounts here (account-links builder) */}
        {game && (
          <span className={r.importGroup}>
            <RosterImport games={[game]} />
            <ScanEntry games={[game]} />
          </span>
        )}
        <span className={r.grow} />
        <button type="button" className={r.filtersBtn} aria-expanded={filtersOpen} aria-controls={panelId} onClick={() => setFiltersOpen((o) => !o)}>
          Filters
          {extras > 0 && <span className={r.filtersCount}>{extras}</span>}
        </button>
        <span className={r.howSmall}>
          <HowTo
            steps={[
              <>Tap a {word} to open their page. There you mark them <strong>Owned</strong> or <strong>Wanted</strong> and set how many copies you have ({copiesWord(data)}).</>,
              <>Many at once: open <strong>Filters</strong>, under “Tap a {word} to” pick <strong>Mark owned</strong>, <strong>Mark wanted</strong> or <strong>Add a copy</strong>, then tap tiles. Tap again to undo.</>,
              <>Or pick <strong>Select several</strong>, tap every {word} you own (or “Select all shown” after filtering) and press Owned.</>,
              <>Wanted {word}s are the ones you’re saving for. Today and Banners use them to remind you before their banner leaves.</>,
              <>Filters also has search by name, role or element, and sorting.</>,
            ]}
          />
        </span>
      </div>

      {filtersOpen && (
        <div className={r.filtersPanel} id={panelId} role="region" aria-label="Filters">
          <div className={r.tools}>
            <label className={`${r.field} ${r.searchField}`}>
              <span className={r.fieldLabel}>Search</span>
              <input className={r.input} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, nickname, tag, role, element…" />
            </label>
            <label className={r.field}>
              <span className={r.fieldLabel}>Element</span>
              <select className={r.input} value={element} onChange={(e) => setElement(e.target.value)}>
                <option value="">Any element</option>
                {elements.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </label>
            <label className={r.field}>
              <span className={r.fieldLabel}>Rarity</span>
              <select className={r.input} value={rarity} onChange={(e) => setRarity(e.target.value)}>
                <option value="">Any rarity</option>
                <option value="top">{rarityWord('top')}</option>
                <option value="mid">{rarityWord('mid')}</option>
                {rarityWord('low') && <option value="low">{rarityWord('low')}</option>}
              </select>
            </label>
            {tags.length > 0 && (
              <label className={r.field}>
                <span className={r.fieldLabel}>Your tag</span>
                <select className={r.input} value={tagFilter} onChange={(e) => setTag(e.target.value)}>
                  <option value="">Any tag</option>
                  {tags.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className={r.field}>
              <span className={r.fieldLabel}>Sort</span>
              <select className={r.input} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="newest">Newest first</option>
                <option value="name">Name</option>
                <option value="rarity">Rarity</option>
                <option value="fit" disabled={!canFit}>
                  {canFit ? 'Best fit for me' : 'Best fit for me · no data yet'}
                </option>
              </select>
            </label>
          </div>

          <div className={r.tapRow}>
            <span className={r.fieldLabel} id={`${panelId}-tap`}>
              Tap a {word} to
            </span>
            <div className={r.seg} role="group" aria-labelledby={`${panelId}-tap`}>
              {TAP.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={r.segBtn}
                  aria-pressed={tap === o.id}
                  onClick={() => {
                    setTap(o.id);
                    setPicked(new Set());
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className={r.panelFoot}>
            <button type="button" className={r.smallBtn} onClick={() => setFiltersOpen(false)}>
              Done
            </button>
            {extras > 0 && (
              <button
                type="button"
                className={r.linkButton}
                onClick={() => {
                  clear();
                  setSort('newest');
                  setTap('open');
                  setPicked(new Set());
                }}
              >
                Reset all
              </button>
            )}
          </div>
        </div>
      )}

      <div className={r.countRow}>
        <p className={r.count}>
          <strong className={r.countNum}>{owned}</strong> of {released.length} owned
          {wanted > 0 && (
            <>
              {' · '}
              <strong className={r.countNum}>{wanted}</strong> wanted
            </>
          )}
        </p>
        <div className={r.seg} role="group" aria-label="Show">
          {SHOW.map((o) => (
            <button key={o.id} type="button" className={r.segBtn} aria-pressed={show === o.id} onClick={() => setShow(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
        <div className={r.seg} role="group" aria-label="Leaks">
          <button type="button" className={r.segBtn} aria-pressed={leaksShown} disabled={hideLeaks} onClick={() => setShowLeaked(!showLeaked)}>
            Show leaked
          </button>
        </div>
      </div>

      {hideLeaks && <p className={r.muted}>Leaked characters stay hidden while “Hide leaks” is on (Banners).</p>}
      {leaksShown && leakedCount === 0 && <p className={r.muted}>No leaked characters listed yet.</p>}
      {leaksShown && leakedCount > 0 && <p className={r.muted}>Leaked characters are marked LEAK; open one to see where the leak came from. You can mark them wanted, not owned.</p>}

      {tap !== 'open' && tap !== 'select' && (
        <p className={r.summary}>
          <span>
            Tapping a {word} now: <strong>{TAP.find((o) => o.id === tap)?.label}</strong>
          </span>
          <button type="button" className={r.linkButton} onClick={() => setTap('open')}>
            Back to opening pages
          </button>
        </p>
      )}

      {tap === 'select' && (
        <div className={r.selectBar} role="region" aria-label="Selected characters">
          <span className={r.count}>
            <strong className={r.countNum}>{picked.size}</strong> selected
          </span>
          <button type="button" className={r.linkButton} onClick={() => setPicked(new Set(list.map((x) => x.key)))}>
            Select all shown
          </button>
          {picked.size > 0 && (
            <button type="button" className={r.linkButton} onClick={() => setPicked(new Set())}>
              Clear
            </button>
          )}
          <span className={r.grow} />
          <button type="button" className={r.smallBtn} disabled={!picked.size} onClick={() => bulk({ owned: true })}>
            Owned
          </button>
          <button type="button" className={r.smallBtn} disabled={!picked.size} onClick={() => bulk({ wanted: true })}>
            Wanted
          </button>
          <button type="button" className={r.smallBtn} disabled={!picked.size} onClick={() => bulk({ owned: false })}>
            Not owned
          </button>
          <button type="button" className={r.smallBtn} disabled={!picked.size} onClick={() => bulk({ wanted: false })}>
            Not wanted
          </button>
        </div>
      )}

      {sort === 'fit' && (
        <p className={r.summary}>
          <span className={r.muted}>Ranked by what each {word} adds to your teams, checked kit by kit (open one to see why). {word[0]?.toUpperCase()}{word.slice(1)}s whose kits haven’t been read yet come last: no data yet.</span>
        </p>
      )}
      {(filtered || (sort === 'newest' && !anyDates)) && (
        <p className={r.summary}>
          {filtered && (
            <span>
              Showing <strong>{list.length}</strong> of {rows.length}
            </span>
          )}
          {sort === 'newest' && !anyDates && <span className={r.muted}>Release dates aren’t in the list yet, so this is by name.</span>}
          {filtered && (
            <button type="button" className={r.linkButton} onClick={clear}>
              Clear filters
            </button>
          )}
        </p>
      )}

      {list.length === 0 ? (
        <p className={r.muted}>No {word}s match these filters.</p>
      ) : (
        <ul className={r.grid} data-size={tileSize} aria-label={several ? 'Characters' : `${data[0]?.game.terms.character ?? 'Character'}s`}>
          {list.map((x) => (
            <li key={x.key}>
              <Tile row={x} several={several} selecting={tap === 'select'} picked={picked.has(x.key)} hide={hideOnTile} onClick={() => onTile(x)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const copiesWord = (data: RosterData[]) => [...new Set(data.flatMap((d) => (d.game.dupes ? [`${d.game.dupes.name}s`] : [])))].join(' or ') || 'copies';

function Tile({ row, several, selecting, picked, hide, onClick }: { row: Row; several: boolean; selecting: boolean; picked: boolean; hide: Set<string>; onClick: () => void }) {
  const { d, c, e } = row;
  const nick = d.user.nicknames?.[c.id];
  const myTags = hide.has('tags') ? [] : (d.user.tags?.[c.id] ?? []);
  const game = d.game;
  const tag = tagOf(game, several);
  const el = elementOf(game, c.element);
  const dupes = e.owned ? dupesLabel(game, e.dupes) : undefined;
  const label = `${c.name}${nick ? ` (“${nick}”)` : ''}${several ? ` (${game.short})` : ''}${c.leak ? ', leaked, unverified' : ''}${e.owned ? ', owned' : ''}${e.wanted ? ', wanted' : ''}`;
  return (
    <button type="button" className={r.tile} data-owned={e.owned} onClick={onClick} aria-label={label} aria-pressed={selecting ? picked : undefined}>
      <CharArt name={c.name} src={artOf(c, 'portrait')} elementColor={el?.color ?? 'var(--ink-4)'} className={r.tileArt}>
        {!hide.has('element') && <span className={r.elementDot} style={{ background: el?.color ?? 'var(--ink-4)' }} title={el?.label} aria-hidden="true" />}
        <span className={r.tileTopRight}>
          {tag && <GameTag {...tag} />}
          {e.wanted && <span className={r.wantedBadge}>WANTED</span>}
        </span>
        {!hide.has('rarity') && (
          <span className={r.tileRarity} style={{ color: rarityColor(c) }}>
            {game.terms.rarity[c.rarity] ?? c.rarity}
          </span>
        )}
        {/* A leak can't be owned: its chip says LEAK instead (the source and details are on its page). */}
        {e.owned ? dupes && !hide.has('copies') && <span className={r.dupeBadge}>{dupes}</span> : <span className={r.notOwned}>{c.leak ? 'LEAK' : 'NOT OWNED'}</span>}
        <span className={r.rarityEdge} style={{ background: rarityColor(c) }} aria-hidden="true" />
        {selecting && (
          <span className={r.check} data-on={picked} aria-hidden="true">
            {picked ? '✓' : ''}
          </span>
        )}
      </CharArt>
      <span className={r.tileText}>
        <span className={r.tileName}>{nick ?? c.name}</span>
        {!hide.has('role') && <span className={r.tileMeta}>{nick ? `${c.name} · ` : ''}{subtitleOf(game, c)}</span>}
        {myTags.length > 0 && (
          <span className={r.tileTags}>
            {myTags.map((t) => (
              <span key={t} className={r.tileTag}>
                {t}
              </span>
            ))}
          </span>
        )}
      </span>
    </button>
  );
}
