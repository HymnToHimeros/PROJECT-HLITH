import { useMemo, useState } from 'react';
import type { Character, GameContract } from '../../core/contract';
import { CharacterTile, EmptyState } from '../../core/ui';
import { RosterImport } from '../account-links/RosterImport';
import { ScanEntry } from '../scan/Scan';
import r from './roster.module.css';
import { byNewest, dupesLabel, elementOf, entryOf, subtitleOf } from './shared';
import type { RosterData } from './useRosterData';

type Show = 'all' | 'owned' | 'not-owned' | 'wanted';
type Sort = 'newest' | 'name' | 'rarity';

interface Props {
  game: GameContract;
  data: RosterData;
  onOpen: (id: string) => void;
}

/** Every character as a tile, with filters by element, role, rarity, owned and wanted, and a name search. */
export function Characters({ game, data, onOpen }: Props) {
  const [query, setQuery] = useState('');
  const [element, setElement] = useState('');
  const [role, setRole] = useState('');
  const [rarity, setRarity] = useState('');
  const [show, setShow] = useState<Show>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const roster = data.user.roster;
  const anyDates = data.characters.some((c) => c.releasedAt);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const keep = (c: Character) => {
      const e = entryOf(roster, c.id);
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (element && c.element !== element) return false;
      if (role && c.role !== role) return false;
      if (rarity && c.rarity !== rarity) return false;
      if (show === 'owned' && !e.owned) return false;
      if (show === 'not-owned' && e.owned) return false;
      if (show === 'wanted' && !e.wanted) return false;
      return true;
    };
    const order = sort === 'name' ? (a: Character, b: Character) => a.name.localeCompare(b.name) : sort === 'rarity' ? (a: Character, b: Character) => (a.rarity === b.rarity ? byNewest(a, b) : a.rarity === 'top' ? -1 : 1) : byNewest;
    return data.characters.filter(keep).sort(order);
  }, [data.characters, roster, query, element, role, rarity, show, sort]);

  const owned = data.characters.filter((c) => entryOf(roster, c.id).owned).length;
  const wanted = data.characters.filter((c) => entryOf(roster, c.id).wanted).length;
  const id = (what: string) => `roster-${what}-${game.id}`;
  const filtered = Boolean(query || element || role || rarity || show !== 'all');
  const clear = () => {
    setQuery('');
    setElement('');
    setRole('');
    setRarity('');
    setShow('all');
  };

  if (data.characters.length === 0) {
    return <EmptyState title={`No ${game.terms.character.toLowerCase()} list yet`} body={`This game’s ${game.terms.character.toLowerCase()} list hasn’t been added yet. It appears here as soon as it is.`} />;
  }

  return (
    <div className={r.stack}>
      {/* RosterImport mounts here (account-links builder) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><RosterImport game={game} /><ScanEntry game={game} /></div>
      <div className={r.filters} role="search">
        <label className={`${r.field} ${r.searchField}`}>
          Search
          <input id={id('search')} className={r.input} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`${game.terms.character} name`} />
        </label>
        <label className={r.field}>
          Element
          <select className={r.input} value={element} onChange={(e) => setElement(e.target.value)}>
            <option value="">All</option>
            {game.elements.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
        <label className={r.field}>
          Role
          <select className={r.input} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All</option>
            {game.roles.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <label className={r.field}>
          Rarity
          <select className={r.input} value={rarity} onChange={(e) => setRarity(e.target.value)}>
            <option value="">All</option>
            <option value="top">{game.terms.rarity.top}</option>
            <option value="mid">{game.terms.rarity.mid}</option>
          </select>
        </label>
        <label className={r.field}>
          Show
          <select className={r.input} value={show} onChange={(e) => setShow(e.target.value as Show)}>
            <option value="all">Everyone</option>
            <option value="owned">Owned</option>
            <option value="not-owned">Not owned</option>
            <option value="wanted">Wanted</option>
          </select>
        </label>
        <label className={r.field}>
          Sort
          <select className={r.input} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="newest">Newest first</option>
            <option value="name">Name</option>
            <option value="rarity">Rarity</option>
          </select>
        </label>
      </div>

      <p className={r.summary}>
        <span>
          Showing <strong>{list.length}</strong> of {data.characters.length}
        </span>
        <span>
          You own <strong>{owned}</strong> · <strong>{wanted}</strong> wanted
        </span>
        {sort === 'newest' && !anyDates && <span className={r.muted}>Release dates aren’t in the list yet, so this is by name.</span>}
        {filtered && (
          <button type="button" className={r.linkButton} onClick={clear}>
            Clear filters
          </button>
        )}
      </p>

      {list.length === 0 ? (
        <p className={r.muted}>Nobody matches these filters.</p>
      ) : (
        <ul className={r.grid} aria-label={`${game.terms.character}s`}>
          {list.map((c) => {
            const e = entryOf(roster, c.id);
            return (
              <li key={c.id} className={r.gridItem}>
                <button type="button" className={r.tileButton} onClick={() => onOpen(c.id)} aria-label={`${c.name}${e.owned ? ', owned' : ''}${e.wanted ? ', wanted' : ''}`}>
                  <CharacterTile
                    name={c.name}
                    subtitle={subtitleOf(game, c)}
                    rarity={c.rarity}
                    rarityLabel={game.terms.rarity[c.rarity]}
                    elementColor={elementOf(game, c.element)?.color ?? 'var(--ink-4)'}
                    owned={e.owned}
                    dupes={dupesLabel(game, e.dupes)}
                    art={c.art}
                  />
                  {e.wanted && <span className={r.wantedBadge}>WANTED</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
