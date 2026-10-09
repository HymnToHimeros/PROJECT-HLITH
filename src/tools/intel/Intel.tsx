import { useState, type CSSProperties } from 'react';
import type { GameContract, GameId } from '../../core/contract';
import { formatDate } from '../../core/time/reset';
import { EmptyState, ExampleNotice, ExampleTag, GameTag, NoData, Timer } from '../../core/ui';
import type { GameLists } from '../today/lists';
import { exampleIntel, exampleReliability, intelItems, kindLabel, type IntelItem, type IntelKind, type Reliability } from './intel';
import n from './intel.module.css';

interface Props {
  games: GameContract[];
  lists: Record<GameId, GameLists>;
  now: number;
}

interface Row {
  game: GameContract;
  item: IntelItem;
  example: boolean;
}

const KINDS: IntelKind[] = ['character', 'weapon', 'area', 'event', 'system'];
const REL: Record<Reliability, { label: string; pct: number }> = { high: { label: 'High', pct: 90 }, mid: { label: 'Medium', pct: 60 }, low: { label: 'Low', pct: 30 } };

/** Intel (design): type filter, then one dashed row per item: kind, ? UNVERIFIED, title, source, source reliability. */
export function Intel({ games, lists, now }: Props) {
  const [kind, setKind] = useState<IntelKind | 'all'>('all');
  const several = games.length > 1;
  const examples: GameContract[] = [];
  const rows: Row[] = games.flatMap((game): Row[] => {
    const l = lists[game.id];
    const real = l ? intelItems(game, l.characters, l.banners, now) : [];
    if (real.length) return real.map((item) => ({ game, item, example: false }));
    examples.push(game);
    return exampleIntel(game, now).map((item) => ({ game, item, example: true }));
  });
  rows.sort((a, b) => (a.item.when ?? Infinity) - (b.item.when ?? Infinity) || a.item.title.localeCompare(b.item.title));
  const present = KINDS.filter((k) => rows.some((r) => r.item.kind === k));
  const shown = rows.filter((r) => kind === 'all' || r.item.kind === kind);
  const one = several ? null : (games[0] ?? null);

  return (
    <div className={n.stack}>
      {examples.length > 0 && (
        <ExampleNotice>
          Nothing upcoming is listed for {examples.length === games.length ? (several ? 'these games' : 'this game') : examples.map((g) => g.name).join(' and ')} yet; adding it is on us, not you. The cards marked EXAMPLE only show what Intel will look like.
        </ExampleNotice>
      )}
      <div className={n.seg} role="group" aria-label="Kind">
        {(['all', ...present] as const).map((k) => (
          <button key={k} type="button" className={n.segBtn} aria-pressed={kind === k} onClick={() => setKind(k)}>
            {k === 'all' ? 'All' : kindLabel(one, k)}
          </button>
        ))}
      </div>
      <ul className={n.list} aria-label="Upcoming">
        {shown.map((r) => (
          <li key={`${r.game.id}:${r.item.id}`}>
            <IntelRow row={r} several={several} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function IntelRow({ row, several }: { row: Row; several: boolean }) {
  const { game, item, example } = row;
  const rel = example ? exampleReliability[item.id] : undefined;
  return (
    <article className={n.row} style={{ '--row-vent': game.vent } as CSSProperties} aria-label={item.title}>
      <div className={n.main}>
        <div className={n.meta}>
          <span className={n.kind}>{kindLabel(several ? null : game, item.kind)}</span>
          <span className={n.unverified} title="Not confirmed by the game">
            ? UNVERIFIED
          </span>
          {several && <GameTag label={game.short} vent={game.vent} />}
          {example && <ExampleTag />}
        </div>
        <h3 className={n.title}>{item.title}</h3>
        <span className={n.detail}>{item.detail}</span>
        <span className={n.source}>
          {item.sources.map((s, i) => (
            <span key={s}>
              {i > 0 && ', '}
              {s}
            </span>
          ))}
          {' · '}
          {item.whenLabel}{' '}
          {item.when === null ? (
            <NoData dash={false} />
          ) : (
            <>
              {formatDate(item.when)} · <Timer to={item.when} prefix="in" />
            </>
          )}
        </span>
      </div>
      <div className={n.rel}>
        <span className={n.relLabel}>Source reliability</span>
        {rel ? (
          <div className={n.relBar}>
            <span className={n.track} aria-hidden="true">
              <span className={n.fill} style={{ width: `${REL[rel].pct}%` }} />
            </span>
            <span className={n.relValue} data-rel={rel}>
              {REL[rel].label}
            </span>
          </div>
        ) : (
          // The owner's leak-source list (Owner console) will carry each source's reliability.
          <NoData dash={false} />
        )}
      </div>
    </article>
  );
}

/** Shown instead of the cards while the viewer hides leaks. */
export function IntelHidden({ onShow }: { onShow: () => void }) {
  return <EmptyState title="Leaks are hidden" body="Everything in Intel is unverified, so it stays hidden while “Hide leaks” is on." action={{ label: 'Show leaks', onClick: onShow }} />;
}
