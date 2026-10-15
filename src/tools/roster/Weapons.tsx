import { useMemo, useState } from 'react';
import type { GameContract, Weapon } from '../../core/contract';
import { EmptyState } from '../../core/ui';
import r from './roster.module.css';
import { useWeapons, type RosterData } from './useRosterData';

interface Props {
  data: RosterData[];
  several: boolean;
  onOpen: (game: string, id: string) => void;
}

type Sort = 'name' | 'rarity';

interface Row {
  d: RosterData;
  w: Weapon;
  key: string;
}

export function Weapons({ data, several, onOpen }: Props) {
  const [query, setQuery] = useState('');
  const game = data[0]?.game;
  const weapons = useWeapons(game as GameContract);
  const word = game?.terms.weapon.toLowerCase() ?? 'weapon';

  const rows: Row[] = useMemo(() => {
    if (!weapons || !data[0]) return [];
    return weapons.map((w) => ({ d: data[0] as RosterData, w, key: `${data[0]!.game.id}:${w.id}` }));
  }, [weapons, data]);

  const [sort, setSort] = useState<Sort>('name');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? rows.filter((x) => x.w.name.toLowerCase().includes(q) || (x.w.role ?? '').toLowerCase().includes(q) || (x.w.madeFor ?? '').toLowerCase().includes(q)) : rows;
    return [...filtered].sort((a, b) =>
      sort === 'rarity' && a.w.rarity !== b.w.rarity ? (a.w.rarity === 'top' ? -1 : 1) : a.w.name.localeCompare(b.w.name),
    );
  }, [rows, query, sort]);

  if (weapons === null) return <p className={r.muted}>Loading {word}s…</p>;
  if (rows.length === 0) return <EmptyState title={`No ${word} list yet`} body={`This game's ${word} list hasn't been added yet. It appears here as soon as it is.`} />;

  const rarityWord = (k: 'top' | 'mid' | 'low') => game?.terms.rarity[k] ?? k;

  return (
    <div className={r.stack}>
      <div className={r.countRow}>
        <p className={r.count}>
          <strong className={r.countNum}>{rows.length}</strong> {word}s
        </p>
      </div>

      <div className={r.headRow}>
        <label className={`${r.field} ${r.searchField}`}>
          <span className={r.fieldLabel}>Search</span>
          <input className={r.input} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Name, role, made for…`} />
        </label>
        <label className={r.field}>
          <span className={r.fieldLabel}>Sort</span>
          <select className={r.input} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="name">Name</option>
            <option value="rarity">Rarity</option>
          </select>
        </label>
      </div>

      {list.length === 0 ? (
        <p className={r.muted}>No {word}s match "{query}".</p>
      ) : (
        <ul className={r.grid} aria-label={several ? 'Weapons' : `${game?.terms.weapon ?? 'Weapon'}s`}>
          {list.map((x) => (
            <li key={x.key}>
              <WeaponTile row={x} game={game!} onClick={() => onOpen(x.d.game.id, x.w.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WeaponTile({ row, game, onClick }: { row: Row; game: GameContract; onClick: () => void }) {
  const { w } = row;
  const rarityColor = w.rarity === 'top' ? 'var(--star-top)' : w.rarity === 'mid' ? 'var(--star-mid)' : 'var(--ink-4)';
  return (
    <button type="button" className={r.tile} onClick={onClick} aria-label={w.name}>
      <div className={r.tileArt}>
        {w.icon ? (
          <img src={w.icon} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className={r.artInitials}>{w.name.slice(0, 2)}</span>
        )}
        <span className={r.tileRarity} style={{ color: rarityColor }}>
          {game.terms.rarity[w.rarity] ?? w.rarity}
        </span>
        <span className={r.rarityEdge} style={{ background: rarityColor }} aria-hidden="true" />
      </div>
      <span className={r.tileText}>
        <span className={r.tileName}>{w.name}</span>
        <span className={r.tileMeta}>{w.role ?? ''}{w.madeFor ? `${w.role ? ' · ' : ''}For ${w.madeFor}` : ''}</span>
      </span>
    </button>
  );
}
