import { useState, type CSSProperties } from 'react';
import type { GameContract, GameId } from '../../core/contract';
import { useExamplesShown } from '../../core/data/prefs';
import { formatDate } from '../../core/time/reset';
import { EmptyState, ExampleNotice, ExampleTag, GameTag, NoData, Timer } from '../../core/ui';
import type { GameLists } from '../today/lists';
import { exampleIntel, exampleReliability, intelItems, kindLabel, type IntelItem, type IntelKind, type Reliability } from './intel';
import type { LeakNote } from './leakNotes';
import n from './intel.module.css';

interface Props {
  games: GameContract[];
  lists: Record<GameId, GameLists>;
  now: number;
  /** Leak posts the owner approved (leakNotes.ts), newest first. */
  notes?: LeakNote[];
}

interface Row {
  game: GameContract;
  item: IntelItem;
  example: boolean;
}

const KINDS: IntelKind[] = ['character', 'weapon', 'area', 'event', 'system'];
const REL: Record<Reliability, { label: string; pct: number }> = { high: { label: 'High', pct: 90 }, mid: { label: 'Medium', pct: 60 }, low: { label: 'Low', pct: 30 } };

/** Intel (design): type filter, then one dashed row per item: kind, ? UNVERIFIED, title, source, source reliability. */
export function Intel({ games, lists, now, notes = [] }: Props) {
  const [kind, setKind] = useState<IntelKind | 'all'>('all');
  const several = games.length > 1;
  const showExamples = useExamplesShown();
  const examples: GameContract[] = [];
  const rows: Row[] = games.flatMap((game): Row[] => {
    const l = lists[game.id];
    const real = l ? intelItems(game, l.characters, l.banners, now) : [];
    if (real.length || !showExamples) return real.map((item) => ({ game, item, example: false }));
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
      {rows.length === 0 && <EmptyState title="Nothing upcoming listed yet" body="New characters, banners and content appear here, marked unverified, once the game’s lists are added. That part is on us, not you." />}
      <ul className={n.list} aria-label="Upcoming">
        {shown.map((r) => (
          <li key={`${r.game.id}:${r.item.id}`}>
            <IntelRow row={r} several={several} />
          </li>
        ))}
      </ul>
      {notes.length > 0 && <LeakNotes notes={notes} games={games} />}
    </div>
  );
}

const NOTE_KIND: Record<string, string> = { leak: 'Leak', event: 'Event', banner: 'Banner', character: 'Character', info: 'News' };

/** News and leaks: every finding the owner approved, any kind or source, newest first; leaks marked unverified. */
function LeakNotes({ notes, games }: { notes: LeakNote[]; games: GameContract[] }) {
  const several = games.length > 1;
  return (
    <section className={n.stack} aria-labelledby="intel-notes">
      <h2 className={n.section} id="intel-notes">
        News and leaks
      </h2>
      <ul className={n.list} aria-label="News and leaks">
        {notes.map((note) => {
          const game = games.find((g) => g.id === note.gameId);
          return (
            <li key={`${note.gameId}:${note.id}`}>
              <LeakNoteRow note={note} game={game} several={several} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function LeakNoteRow({ note, game, several }: { note: LeakNote; game: GameContract | undefined; several: boolean }) {
  const [original, setOriginal] = useState(false);
  const translated = Boolean(note.translation);
  const shown = translated && !original ? note.translation : note.text;
  return (
    <article className={n.row} style={{ '--row-vent': game?.vent } as CSSProperties} aria-label={note.title}>
      <div className={n.main}>
        <div className={n.meta}>
          <span className={n.kind}>{note.leak ? 'Leak' : (NOTE_KIND[note.kind] ?? 'News')}</span>
          {note.leak && (
            <span className={n.unverified} title="Not confirmed by the game">
              ? UNVERIFIED
            </span>
          )}
          {several && game && <GameTag label={game.short} vent={game.vent} />}
        </div>
        <h3 className={n.title}>{note.title}</h3>
        <span className={n.source}>
          {formatDate(Date.parse(note.at))} · {note.credit}
          {note.url && (
            <>
              {' · '}
              <a className={n.link} href={note.url} target="_blank" rel="noreferrer noopener">
                Post
              </a>
            </>
          )}
        </span>
        {translated && <span className={n.detail}>{original ? 'Original post' : 'Translated, may be inexact'}</span>}
        {shown && (
          <p className={n.postText} lang={translated && original ? 'zh' : undefined}>
            {shown}
          </p>
        )}
        <div className={n.meta}>
          {translated && (
            <button type="button" className={n.segBtn} onClick={() => setOriginal((v) => !v)} aria-pressed={original}>
              {original ? 'Show translation' : 'Show original'}
            </button>
          )}
          {note.images.length > 0 && (
            <span className={n.source}>
              Images:{' '}
              {note.images.map((src, i) => (
                <a key={src} className={n.link} href={src} target="_blank" rel="noreferrer noopener" aria-label={`Image ${i + 1} (opens the source)`}>
                  {i + 1}
                </a>
              ))}
            </span>
          )}
        </div>
      </div>
    </article>
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
