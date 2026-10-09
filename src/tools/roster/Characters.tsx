import { useMemo, useState } from 'react';
import type { Character } from '../../core/contract';
import { setRosterEntry, type RosterEntry } from '../../core/data/userData';
import { EmptyState, GameTag, HowTo } from '../../core/ui';
import r from './roster.module.css';
import { artOf, byNewest, CharArt, dupesLabel, elementOf, entryOf, rarityColor, subtitleOf, tagOf } from './shared';
import type { RosterData } from './useRosterData';

type Show = 'all' | 'owned' | 'not-owned' | 'wanted';
type Sort = 'newest' | 'name' | 'rarity';
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

/** Roster → Characters (design): "N of M owned", All / Owned / Not owned, and the tile grid. */
export function Characters({ data, several, onOpen }: Props) {
  const [query, setQuery] = useState('');
  const [element, setElement] = useState('');
  const [rarity, setRarity] = useState('');
  const [show, setShow] = useState<Show>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [tap, setTap] = useState<Tap>('open');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // Open on PC, folded on a phone so the grid comes first (design switch at 820 px).
  const [moreOpen, setMoreOpen] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 821px)').matches);

  const rows: Row[] = useMemo(() => data.flatMap((d) => d.characters.map((c) => ({ d, c, e: entryOf(d.user.roster, c.id), key: `${d.game.id}:${c.id}` }))), [data]);
  const word = several ? 'character' : (data[0]?.game.terms.character.toLowerCase() ?? 'character');
  const elements = [...new Set(data.flatMap((d) => d.game.elements.map((e) => e.label)))];
  const rarityWord = (k: 'top' | 'mid') => [...new Set(data.map((d) => d.game.terms.rarity[k]))].join(' · ');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const keep = ({ d, c, e }: Row) => {
      if (q && !`${c.name} ${subtitleOf(d.game, c)}`.toLowerCase().includes(q)) return false;
      if (element && elementOf(d.game, c.element)?.label !== element) return false;
      if (rarity && c.rarity !== rarity) return false;
      if (show === 'owned' && !e.owned) return false;
      if (show === 'not-owned' && e.owned) return false;
      if (show === 'wanted' && !e.wanted) return false;
      return true;
    };
    const order = (a: Row, b: Row) =>
      sort === 'name' ? a.c.name.localeCompare(b.c.name) : sort === 'rarity' && a.c.rarity !== b.c.rarity ? (a.c.rarity === 'top' ? -1 : 1) : byNewest(a.c, b.c);
    return rows.filter(keep).sort(order);
  }, [rows, query, element, rarity, show, sort]);

  const owned = rows.filter((x) => x.e.owned).length;
  const wanted = rows.filter((x) => x.e.wanted).length;
  const filtered = Boolean(query || element || rarity || show !== 'all');
  const anyDates = rows.some((x) => x.c.releasedAt);
  const clear = () => {
    setQuery('');
    setElement('');
    setRarity('');
    setShow('all');
  };

  const save = (x: Row, change: Partial<RosterEntry>) => setRosterEntry(x.d.game.id, x.c.id, { ...x.e, ...change });
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

  if (rows.length === 0) {
    return <EmptyState title={`No ${word} list yet`} body={`This game’s ${word} list hasn’t been added yet. It appears here as soon as it is.`} />;
  }

  return (
    <div className={r.stack}>
      {/* RosterImport mounts here (account-links builder) */}
      <HowTo
        steps={[
          <>Tap a {word} to open their page. There you mark them <strong>Owned</strong> or <strong>Wanted</strong> and set how many copies you have ({copiesWord(data)}).</>,
          <>Many at once: under “Tap a {word} to”, pick <strong>Mark owned</strong>, <strong>Mark wanted</strong> or <strong>Add a copy</strong>, then tap tiles. Tap again to undo.</>,
          <>Or pick <strong>Select several</strong>, tap every {word} you own (or “Select all shown” after filtering) and press Owned.</>,
          <>Wanted {word}s are the ones you’re saving for. Today and Banners use them to remind you before their banner leaves.</>,
          <>Filters: search by name, role or element, or show only owned, not owned or wanted.</>,
        ]}
      />

      <div className={r.countRow}>
        <p className={r.count}>
          <strong className={r.countNum}>{owned}</strong> of {rows.length} owned
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
      </div>

      <div className={r.searchRow} role="search">
        <label className={`${r.field} ${r.searchField}`}>
          <span className={r.fieldLabel}>Search</span>
          <input className={r.input} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, role, element…" />
        </label>
      </div>

      <details className={r.more} open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
        <summary className={r.moreSummary}>
          Filters and quick marking
          {(element || rarity || sort !== 'newest' || tap !== 'open') && <span className={r.moreOn}>on</span>}
        </summary>
        <div className={r.tools}>
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
            </select>
          </label>
          <label className={r.field}>
            <span className={r.fieldLabel}>Sort</span>
            <select className={r.input} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="newest">Newest first</option>
              <option value="name">Name</option>
              <option value="rarity">Rarity</option>
              {/* ROSTER-LOGIC fills "Best fit for me" (ranks by fit with your account). */}
              <option value="fit" disabled>
                Best fit for me · no data yet
              </option>
            </select>
          </label>
        </div>

        <div className={r.tapRow}>
          <span className={r.fieldLabel} id="roster-tap-label">
            Tap a {word} to
          </span>
          <div className={r.seg} role="group" aria-labelledby="roster-tap-label">
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
      </details>

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
        </div>
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
        <ul className={r.grid} aria-label={several ? 'Characters' : `${data[0]?.game.terms.character ?? 'Character'}s`}>
          {list.map((x) => (
            <li key={x.key}>
              <Tile row={x} several={several} selecting={tap === 'select'} picked={picked.has(x.key)} onClick={() => onTile(x)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const copiesWord = (data: RosterData[]) => [...new Set(data.flatMap((d) => (d.game.dupes ? [`${d.game.dupes.name}s`] : [])))].join(' or ') || 'copies';

function Tile({ row, several, selecting, picked, onClick }: { row: Row; several: boolean; selecting: boolean; picked: boolean; onClick: () => void }) {
  const { d, c, e } = row;
  const game = d.game;
  const tag = tagOf(game, several);
  const el = elementOf(game, c.element);
  const dupes = e.owned ? dupesLabel(game, e.dupes) : undefined;
  const label = `${c.name}${several ? ` (${game.short})` : ''}${e.owned ? ', owned' : ''}${e.wanted ? ', wanted' : ''}`;
  return (
    <button type="button" className={r.tile} data-owned={e.owned} onClick={onClick} aria-label={label} aria-pressed={selecting ? picked : undefined}>
      <CharArt name={c.name} src={artOf(c, 'portrait')} elementColor={el?.color ?? 'var(--ink-4)'} className={r.tileArt}>
        <span className={r.elementDot} style={{ background: el?.color ?? 'var(--ink-4)' }} title={el?.label} aria-hidden="true" />
        <span className={r.tileTopRight}>
          {tag && <GameTag {...tag} />}
          {e.wanted && <span className={r.wantedBadge}>WANTED</span>}
        </span>
        <span className={r.tileRarity} style={{ color: rarityColor(c) }}>
          {game.terms.rarity[c.rarity]}
        </span>
        {e.owned ? dupes && <span className={r.dupeBadge}>{dupes}</span> : <span className={r.notOwned}>NOT OWNED</span>}
        <span className={r.rarityEdge} style={{ background: rarityColor(c) }} aria-hidden="true" />
        {selecting && (
          <span className={r.check} data-on={picked} aria-hidden="true">
            {picked ? '✓' : ''}
          </span>
        )}
      </CharArt>
      <span className={r.tileText}>
        <span className={r.tileName}>{c.name}</span>
        <span className={r.tileMeta}>{subtitleOf(game, c)}</span>
      </span>
    </button>
  );
}
