import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { GameContract, GameId } from '../../core/contract';
import { backend } from '../../core/data/backend';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { HowTo, NoData, Segmented } from '../../core/ui';
import { Announcements } from './Announcements';
import type { Draft } from './approve';
import { Findings } from './Findings';
import { Lists } from './Lists';
import { Members } from './Members';
import { Rewards } from './Rewards';
import { Users } from './Users';
import o from './owner.module.css';
import { OwnerThemesAdmin } from './OwnerThemesAdmin';
import { Scheduler, when } from './Scheduler';
import { jobLabel, useSchedulerData } from './schedulerData';

/*
 * Owner console (R58), design: Account → Owner console. Shown only to owners
 * (public.is_owner() on the server); every owner write is checked there again.
 *
 * Overview shows what is real: user numbers from public.owner_stats() (owner only,
 * migration 0008), every game record and the built-in list sizes. Not built yet, and so
 * not shown as controls: editing game records and the leak-source list, named once in
 * one "planned" line. Nothing here ever touches anyone's progress.
 *
 * Tabs: Overview (this file), Users (Users.tsx: everyone who joined, silence, ban, remove, T60b), Lists (Lists.tsx: the built-in lists in catalog_items),
 * Announcements (Announcements.tsx), Members (Members.tsx: testers and invite links, T60), Scheduler (Scheduler.tsx) and Findings (Findings.tsx),
 * the last two reading the scheduler tables through schedulerData.ts, and Owner themes
 * (OwnerThemesAdmin.tsx: the owner-only themes in the private store, T47).
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

type OwnerTab = 'overview' | 'users' | 'lists' | 'announcements' | 'members' | 'rewards' | 'scheduler' | 'findings' | 'themes';
const OWNER_TABS: readonly string[] = ['overview', 'users', 'lists', 'announcements', 'members', 'rewards', 'scheduler', 'findings', 'themes'];

/** The owner's console: Overview, Lists, Announcements, Scheduler, Findings. The tab can live in the address (props.tab / openTab). */
export default function OwnerConsole(props: ModuleScreenProps & { selfId?: string | undefined }) {
  const [own, setOwn] = useState<OwnerTab>('overview');
  const tab: OwnerTab = props.tab && OWNER_TABS.includes(props.tab) ? (props.tab as OwnerTab) : own;
  const setTab = (t: OwnerTab) => {
    setOwn(t);
    props.openTab(t);
  };
  const [now] = useState(() => Date.now());
  const sched = useSchedulerData(props.games.map((g) => g.id));
  const newFindings = sched.findings.filter((f) => f.status === 'new').length;
  // An approved finding that needs more fields opens Lists with it in the form.
  const [draft, setDraft] = useState<Draft | null>(null);
  const clearDraft = useCallback(() => setDraft(null), []);
  const openDraft = (d: Draft) => {
    setDraft(d);
    setTab('lists');
  };
  return (
    <div className={o.stack}>
      <p className={o.scope}>OWNER · ONLY YOU SEE THIS</p>
      <Segmented
        label="Owner console"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'overview', label: 'Overview' },
          { id: 'users', label: 'Users' },
          { id: 'lists', label: 'Lists' },
          { id: 'announcements', label: 'Announcements' },
          { id: 'members', label: 'Members' },
          { id: 'rewards', label: 'Rewards' },
          { id: 'scheduler', label: 'Scheduler' },
          { id: 'findings', label: newFindings ? `Findings · ${newFindings}` : 'Findings' },
          { id: 'themes', label: 'Owner themes' },
        ]}
      />
      {tab === 'overview' && <Overview {...props} />}
      {tab === 'users' && <Users selfId={props.selfId} />}
      {tab === 'lists' && <Lists games={props.games} draft={draft} clearDraft={clearDraft} />}
      {tab === 'announcements' && <Announcements />}
      {tab === 'members' && <Members />}
      {tab === 'rewards' && <Rewards />}
      {tab === 'scheduler' && <Scheduler data={sched} now={now} />}
      {tab === 'findings' && <Findings data={sched} games={props.games} onDraft={openDraft} />}
      {tab === 'themes' && <OwnerThemesAdmin />}
    </div>
  );
}

export interface OwnerStats {
  users: number;
  active_7d: number;
  hoyolab_links: number;
  jobs: { id: string; last_run_at: string | null; last_status: string | null }[];
  findings_waiting: number;
  counted_at: string;
}

/** public.owner_stats(): null while loading, 'none' without a server or when the call fails. */
function useOwnerStats(): OwnerStats | null | 'none' {
  const [stats, setStats] = useState<OwnerStats | null | 'none'>(backend ? null : 'none');
  useEffect(() => {
    if (!backend) return;
    let alive = true;
    void Promise.resolve(backend.rpc('owner_stats')).then(
      ({ data, error }) => {
        if (alive) setStats(error || !data || typeof data !== 'object' ? 'none' : (data as OwnerStats));
      },
      () => alive && setStats('none'),
    );
    return () => {
      alive = false;
    };
  }, []);
  return stats;
}

const STAT_TILES: { id: 'users' | 'active_7d' | 'hoyolab_links' | 'findings_waiting'; label: string }[] = [
  { id: 'users', label: 'Accounts' },
  { id: 'active_7d', label: 'Active in the last 7 days' },
  { id: 'hoyolab_links', label: 'HoYoLAB accounts linked' },
  { id: 'findings_waiting', label: 'Findings waiting' },
];

function Overview({ games }: ModuleScreenProps) {
  const counts = useListCounts(games);
  const stats = useOwnerStats();
  const real = stats !== null && stats !== 'none' ? stats : null;

  return (
    <div className={o.stack}>
      <HowTo
        steps={[
          <>Game records set each game’s colour, currencies, servers, reset time and modules. All of them are listed, switched on in your switcher or not.</>,
          <>Numbers are counted on the server when you open this page. “Active” means signed in, or settings or game data saved, in the last 7 days.</>,
          <>Built-in lists are the characters, banners, events, materials and backlog every user starts from, with your changes from Lists. The numbers are counted from the lists themselves.</>,
          <>Scheduler runs the jobs; Findings is the inbox of what they found.</>,
        ]}
      />
      <p className={o.note}>Planned, not built yet: editing game records and the leak-source list.</p>

      <section className={o.tiles} aria-label="Numbers">
        {STAT_TILES.map((t) => (
          <div key={t.id} className={o.tile}>
            <span className={o.tileLabel}>{t.label}</span>
            {real ? (
              <span className={o.tileValue}>{real[t.id]}</span>
            ) : (
              <>
                <span className={o.tileDash}>—</span>
                <span className={o.noData}>{stats === null ? 'Counting…' : 'No data yet'}</span>
              </>
            )}
          </div>
        ))}
      </section>

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

        <section className={o.card} aria-labelledby="owner-jobs">
          <h3 className={o.cardTitle} id="owner-jobs">
            Scheduler: last run per job
          </h3>
          {!real ? (
            <NoData />
          ) : real.jobs.length === 0 ? (
            <span className={o.note}>No job has run yet.</span>
          ) : (
            real.jobs.map((j) => (
              <div key={j.id} className={o.listRow}>
                <span className={o.listLabel}>{jobLabel(j.id)}</span>
                <span className={o.recordMeta}>
                  {when(j.last_run_at) ?? 'never'}
                  {j.last_status ? ` · ${j.last_status}` : ''}
                </span>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
