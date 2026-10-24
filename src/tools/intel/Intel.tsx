import { useState, type CSSProperties } from 'react';
import type { Topic } from '../../../supabase/functions/_shared/scheduler.ts';
import type { GameContract, GameId } from '../../core/contract';
import { useExamplesShown } from '../../core/data/prefs';
import { formatDate } from '../../core/time/reset';
import { EmptyState, ExampleNotice, ExampleTag, GameTag, NoData, Timer } from '../../core/ui';
import { Segmented } from '../../core/ui/Segmented';
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

const REL: Record<Reliability, { label: string; pct: number }> = { high: { label: 'High', pct: 90 }, mid: { label: 'Medium', pct: 60 }, low: { label: 'Low', pct: 30 } };

const TOPIC_LABEL: Record<Topic, string> = {
  characters: 'Characters',
  story: 'Story',
  'weapons-items': 'Weapons & items',
  'events-modes': 'Events & modes',
  systems: 'Systems',
  codes: 'Codes',
  other: 'Other',
};
const TOPICS: Topic[] = ['characters', 'story', 'weapons-items', 'events-modes', 'systems', 'codes', 'other'];
const TOPIC_TABS: { id: 'all' | Topic; label: string }[] = [{ id: 'all', label: 'All' }, ...TOPICS.map((t) => ({ id: t, label: TOPIC_LABEL[t] }))];

const KIND_TO_TOPIC: Record<IntelKind, Topic> = { character: 'characters', weapon: 'weapons-items', area: 'events-modes', event: 'events-modes', system: 'systems' };

/** Intel (design): one topic tab row filters both upcoming cards and news/leak notes. */
export function Intel({ games, lists, now, notes = [] }: Props) {
  const [topic, setTopic] = useState<'all' | Topic>('all');
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

  const topicRows = topic === 'all' ? rows : rows.filter((r) => KIND_TO_TOPIC[r.item.kind] === topic);
  const topicNotes = topic === 'all' ? notes : notes.filter((nn) => nn.topic === topic);

  const counts = new Map<string, number>();
  for (const r of rows) { const t = KIND_TO_TOPIC[r.item.kind]; counts.set(t, (counts.get(t) ?? 0) + 1); }
  for (const nn of notes) counts.set(nn.topic, (counts.get(nn.topic) ?? 0) + 1);
  const total = rows.length + notes.length;
  const topicTabs = TOPIC_TABS.map((t) => ({ ...t, label: t.id === 'all' ? `All (${total})` : `${t.label} (${counts.get(t.id) ?? 0})` }));

  const empty = topicRows.length === 0 && topicNotes.length === 0;

  return (
    <div className={n.stack}>
      {examples.length > 0 && (
        <ExampleNotice>
          Nothing upcoming is listed for {examples.length === games.length ? (several ? 'these games' : 'this game') : examples.map((g) => g.name).join(' and ')} yet; adding it is on us, not you. The cards marked EXAMPLE only show what Intel will look like.
        </ExampleNotice>
      )}
      <Segmented label="Topic" options={topicTabs} value={topic} onChange={setTopic} tone="quiet" />
      {empty ? (
        <span className={n.muted}>No data yet</span>
      ) : (
        <>
          {topicRows.length > 0 && (
            <section className={n.stack} aria-labelledby="intel-upcoming">
              <h2 className={n.section} id="intel-upcoming">Upcoming</h2>
              <ul className={n.list} aria-label="Upcoming">
                {topicRows.map((r) => (
                  <li key={`${r.game.id}:${r.item.id}`}>
                    <IntelRow row={r} several={several} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {topicNotes.length > 0 && (
            <section className={n.stack} aria-labelledby="intel-notes">
              <h2 className={n.section} id="intel-notes">News and leaks</h2>
              <ul className={n.list} aria-label="News and leaks">
                {topicNotes.map((note) => {
                  const game = games.find((g) => g.id === note.gameId);
                  return (
                    <li key={`${note.gameId}:${note.id}`}>
                      <LeakNoteRow note={note} game={game} several={several} />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

const NOTE_KIND: Record<string, string> = { leak: 'Leak', event: 'Event', banner: 'Banner', character: 'Character', info: 'News' };

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
          <span className={n.kind}>{TOPIC_LABEL[note.topic as Topic] ?? note.topic}</span>
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
  return <EmptyState title="Leaks are hidden" body={'Everything in Intel is unverified, so it stays hidden while “Hide leaks” is on.'} action={{ label: 'Show leaks', onClick: onShow }} />;
}
