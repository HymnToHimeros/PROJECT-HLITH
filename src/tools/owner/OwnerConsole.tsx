import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { GameContract, GameId } from '../../core/contract';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { ExampleNotice, ExampleTag, HowTo, NoData } from '../../core/ui';
import o from './owner.module.css';

/*
 * Owner console (R58), design: Account → Owner console. Interface frame only.
 * Not reachable yet: there is no owner check, so the Account row stays hidden
 * (shell builder). Wire it as a screen taking ModuleScreenProps.
 *
 * Logic still to come (backend): saving game records, updating built-in lists,
 * the real leak-source list, publishing announcements to every user, and the
 * user stats. Until then each slot is "No data yet" or a clearly marked EXAMPLE.
 * Nothing here ever touches anyone's progress.
 */

type Counts = { characters: number; banners: number; events: number; materials: number; backlog: number };

function useListCounts(games: GameContract[]): Record<GameId, Counts> | null {
  const [state, setState] = useState<{ key: string; value: Record<GameId, Counts> } | null>(null);
  const key = games.map((g) => g.id).join(',');
  useEffect(() => {
    let alive = true;
    void Promise.all(
      games.map(async (g) => {
        const [characters, banners, events, materials, backlog] = await Promise.all([g.data.characters(), g.data.banners(), g.data.events(), g.data.materials(), g.data.backlog()]);
        return [g.id, { characters: characters.length, banners: banners.length, events: events.length, materials: materials.length, backlog: backlog.length }] as const;
      }),
    ).then((rows) => {
      if (alive) setState({ key: rows.map(([id]) => id).join(','), value: Object.fromEntries(rows) });
    });
    return () => {
      alive = false;
    };
  }, [games]);
  return state && state.key === key ? state.value : null;
}

const LISTS: { id: keyof Counts; label: string }[] = [
  { id: 'characters', label: 'Characters' },
  { id: 'banners', label: 'Banners' },
  { id: 'events', label: 'Events' },
  { id: 'materials', label: 'Materials' },
  { id: 'backlog', label: 'Backlog items' },
];

/** Example leak sources, shown until the backend holds the real list. */
const EXAMPLE_SOURCES = [
  { id: 'official', name: 'Official preview streams', reliability: 95 },
  { id: 'beta', name: 'Beta build leakers', reliability: 70 },
  { id: 'files', name: 'Datamine file names', reliability: 40 },
];

const pad = (n: number) => String(n).padStart(2, '0');
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The owner's console: game records, built-in lists, leak sources, announcements, user stats. */
export default function OwnerConsole({ games }: ModuleScreenProps) {
  const counts = useListCounts(games);
  const [sourceOn, setSourceOn] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState('');
  const [drafts, setDrafts] = useState<string[]>([]);
  const shorts = games.map((g) => g.short).join(' · ');

  const publish = (e: FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    setDrafts((d) => [t, ...d]);
    setDraft('');
  };

  return (
    <div className={o.stack}>
      <p className={o.scope}>OWNER · ONLY YOU SEE THIS</p>
      <HowTo
        steps={[
          <>Game records set each game’s colour, currencies, servers, reset time and modules. New colours must pass the 7:1 contrast check.</>,
          <>Built-in lists are the characters, banners, events, materials and backlog every user starts from. Updating a list never changes anyone’s progress.</>,
          <>Leak sources decide what shows in Intel, Banners and Calendar as unverified. Switch a source off to hide everything from it.</>,
          <>Announcements go to every user. User numbers appear once the backend is connected.</>,
        ]}
      />

      <div className={o.tiles}>
        {['Accounts', 'Active today', 'Sync errors'].map((label) => (
          <div key={label} className={o.tile}>
            <span className={o.tileLabel}>{label}</span>
            <span className={o.tileDash} aria-hidden="true">
              —
            </span>
            <span className={o.noData}>No data yet · needs the backend</span>
          </div>
        ))}
      </div>

      <div className={o.grid}>
        <section className={o.card} aria-labelledby="owner-records">
          <div className={o.cardHead}>
            <h3 className={o.cardTitle} id="owner-records">
              Game records
            </h3>
            {/* Adding and editing records needs the backend (owner workstream). */}
            <button type="button" className={o.dashedBtn} disabled title="Comes with the backend">
              + Add game record
            </button>
          </div>
          {games.map((g) => (
            <div key={g.id} className={o.record}>
              <span className={o.recordIcon} style={{ '--rec-vent': g.vent } as CSSProperties}>
                {g.short}
              </span>
              <div className={o.recordText}>
                <span className={o.recordName}>{g.name}</span>
                <span className={o.recordMeta}>
                  {g.servers.length} servers · reset {pad(g.reset.hour)}:00 · {WEEKDAYS[g.reset.weekday] ?? '—'} · {g.modules.length} modules
                </span>
                <span className={o.recordCurr}>{g.currencies.map((c) => c.name).join(' · ') || 'No currencies listed'}</span>
              </div>
              <button type="button" className={o.smallBtn} disabled title="Comes with the backend">
                Edit
              </button>
            </div>
          ))}
          <span className={o.note}>A record sets vent, icon, currencies, servers, reset rule and modules. New vents must pass the 7:1 contrast check.</span>
        </section>

        <section className={o.card} aria-labelledby="owner-lists">
          <h3 className={o.cardTitle} id="owner-lists">
            Built-in lists
          </h3>
          {LISTS.map((l) => (
            <div key={l.id} className={o.listRow}>
              <span className={o.listLabel}>{l.label}</span>
              <span className={o.listCount}>{counts ? games.reduce((sum, g) => sum + (counts[g.id]?.[l.id] ?? 0), 0) : '…'}</span>
              <span className={o.listUpdated}>
                {/* Last update time is kept by the backend. */}
                <NoData dash={false} />
              </span>
              <button type="button" className={o.smallBtn} disabled title="Comes with the backend">
                Update
              </button>
            </div>
          ))}
          <span className={o.note}>List updates never change anyone’s progress.</span>
        </section>

        <section className={o.card} aria-labelledby="owner-sources">
          <div className={o.cardHead}>
            <h3 className={o.cardTitle} id="owner-sources">
              Leak sources
            </h3>
            <ExampleTag />
          </div>
          <ExampleNotice>These sources and their reliability are examples until the backend holds the real list. Switching them here changes nothing for users yet.</ExampleNotice>
          {EXAMPLE_SOURCES.map((s) => {
            const on = sourceOn[s.id] !== false;
            return (
              <div key={s.id} className={o.sourceRow}>
                <div className={o.sourceText}>
                  <span className={o.listLabel}>{s.name}</span>
                  <span className={o.recordMeta}>{shorts}</span>
                </div>
                <span className={o.track} aria-hidden="true">
                  <span className={o.fill} style={{ width: `${s.reliability}%` }} />
                </span>
                <span className={o.relValue}>{s.reliability}%</span>
                <button type="button" role="switch" aria-checked={on} aria-label={`Use ${s.name}`} className={o.switch} onClick={() => setSourceOn((x) => ({ ...x, [s.id]: !on }))}>
                  <span className={o.knob} />
                </button>
              </div>
            );
          })}
        </section>

        <section className={o.card} aria-labelledby="owner-ann">
          <h3 className={o.cardTitle} id="owner-ann">
            Announcements
          </h3>
          <form className={o.annForm} onSubmit={publish}>
            <label className={o.srOnly} htmlFor="owner-ann-input">
              Announcement
            </label>
            <input id="owner-ann-input" className={o.input} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write to every user…" />
            <button type="submit" className={o.publish}>
              Publish
            </button>
          </form>
          {/* Sending to every user needs the backend; until then a published text stays on this screen only. */}
          {drafts.length === 0 ? (
            <span className={o.note}>Nothing published yet.</span>
          ) : (
            drafts.map((t, i) => (
              <div key={`${i}-${t}`} className={o.ann}>
                <span className={o.annText}>{t}</span>
                <span className={o.noData}>Not sent yet · sending needs the backend</span>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
