import { useEffect, useState, type CSSProperties } from 'react';
import type { GameContract, GameId } from '../../core/contract';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { HowTo, Segmented } from '../../core/ui';
import { Findings } from './Findings';
import o from './owner.module.css';
import { Scheduler } from './Scheduler';
import { useSchedulerData } from './schedulerData';

/*
 * Owner console (R58), design: Account → Owner console. Shown only to owners
 * (public.is_owner() on the server); every owner write is checked there again.
 *
 * Overview shows what is real today: every game record and the built-in list sizes.
 * Not built yet, and so not shown as controls: editing game records, updating
 * built-in lists, the leak-source list, announcements to every user and user
 * numbers. They are named once, in one "planned" line. Nothing here ever touches
 * anyone's progress.
 *
 * Tabs: Overview (this file), Scheduler (Scheduler.tsx) and Findings (Findings.tsx),
 * both reading the scheduler tables through schedulerData.ts.
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

const pad = (n: number) => String(n).padStart(2, '0');
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type OwnerTab = 'overview' | 'scheduler' | 'findings';
const OWNER_TABS: readonly string[] = ['overview', 'scheduler', 'findings'];

/** The owner's console: Overview (game records, built-in lists), Scheduler, Findings. The tab can live in the address (props.tab / openTab). */
export default function OwnerConsole(props: ModuleScreenProps) {
  const [own, setOwn] = useState<OwnerTab>('overview');
  const tab: OwnerTab = props.tab && OWNER_TABS.includes(props.tab) ? (props.tab as OwnerTab) : own;
  const setTab = (t: OwnerTab) => {
    setOwn(t);
    props.openTab(t);
  };
  const [now] = useState(() => Date.now());
  const sched = useSchedulerData(props.games.map((g) => g.id));
  const newFindings = sched.findings.filter((f) => f.status === 'new').length;
  return (
    <div className={o.stack}>
      <p className={o.scope}>OWNER · ONLY YOU SEE THIS</p>
      <Segmented
        label="Owner console"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'overview', label: 'Overview' },
          { id: 'scheduler', label: 'Scheduler' },
          { id: 'findings', label: newFindings ? `Findings · ${newFindings}` : 'Findings' },
        ]}
      />
      {tab === 'overview' && <Overview {...props} />}
      {tab === 'scheduler' && <Scheduler data={sched} now={now} />}
      {tab === 'findings' && <Findings data={sched} games={props.games} />}
    </div>
  );
}

function Overview({ games }: ModuleScreenProps) {
  const counts = useListCounts(games);

  return (
    <div className={o.stack}>
      <HowTo
        steps={[
          <>Game records set each game’s colour, currencies, servers, reset time and modules. All of them are listed, switched on in your switcher or not.</>,
          <>Built-in lists are the characters, banners, events, materials and backlog every user starts from. The numbers are counted from the lists themselves.</>,
          <>Scheduler runs the jobs; Findings is the inbox of what they found.</>,
        ]}
      />
      <p className={o.note}>
        Planned, not built yet: editing game records, updating built-in lists from here, the leak-source list, announcements to every user, and user numbers.
      </p>

      <div className={o.grid}>
        <section className={o.card} aria-labelledby="owner-records">
          <h3 className={o.cardTitle} id="owner-records">
            Game records
          </h3>
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
            </div>
          ))}
        </section>

        <section className={o.card} aria-labelledby="owner-lists">
          <h3 className={o.cardTitle} id="owner-lists">
            Built-in lists
          </h3>
          {LISTS.map((l) => (
            <div key={l.id} className={o.listRow}>
              <span className={o.listLabel}>{l.label}</span>
              <span className={o.listCount}>{counts ? games.reduce((sum, g) => sum + (counts[g.id]?.[l.id] ?? 0), 0) : '…'}</span>
            </div>
          ))}
          <span className={o.note}>All games together. List updates never change anyone’s progress.</span>
        </section>
      </div>
    </div>
  );
}
