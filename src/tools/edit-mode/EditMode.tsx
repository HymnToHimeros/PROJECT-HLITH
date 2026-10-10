/**
 * Edit mode (ROADMAP R46): add, change and hide your OWN events, banners and
 * backlog items for one game, on top of the built-in list. Nothing is ever
 * deleted: hiding sets a flag, and list updates never touch your entries.
 * No design yet (CLAUDE.md Override 5): built from the shared tokens and parts.
 */
import { useEffect, useId, useState, type FormEvent } from 'react';
import type { GameContract } from '../../core/contract';
import { saveOwnItem, setOwnItemHidden, useGameData, type OwnItemTypes, type OwnKind } from '../../core/data/userData';
import { formatDateTime } from '../../core/time/reset';
import { BottomSheet, Button, HowTo, Segmented } from '../../core/ui';
import { newOwnId, type MergedRow, type Origin } from './merge';
import { useOwnRows } from './useWithOwnItems';
import s from './edit-mode.module.css';

const NOUN: Record<OwnKind, { one: string; list: string }> = {
  events: { one: 'event', list: 'Events' },
  banners: { one: 'banner', list: 'Banners' },
  backlog: { one: 'backlog item', list: 'Backlog' },
};

const ORIGIN_LABEL: Record<Origin, string> = { 'built-in': 'LIST', changed: 'CHANGED', mine: 'YOURS', example: 'EXAMPLE' };

type AnyItem = OwnItemTypes[OwnKind];

/** Loads a game's built-in list for one kind. Empty until loaded. */
function useBuiltIn<K extends OwnKind>(game: GameContract, kind: K): { list: OwnItemTypes[K][]; loading: boolean } {
  const [state, setState] = useState<{ key: string; list: OwnItemTypes[K][] } | null>(null);
  const key = `${game.id}:${kind}`;
  useEffect(() => {
    let alive = true;
    const load = game.data[kind] as () => Promise<OwnItemTypes[K][]>;
    void load().then((list) => {
      if (alive) setState({ key, list });
    });
    return () => {
      alive = false;
    };
  }, [game, kind, key]);
  return state?.key === key ? { list: state.list, loading: false } : { list: [], loading: true };
}

/**
 * `examples`: the screen's example items, passed while the game's list is empty and you have
 * none of your own. They show here too, so you can change one (it becomes yours) or hide it.
 */
export function EditMode({ game, kind, examples }: { game: GameContract; kind: OwnKind; examples?: readonly AnyItem[] | undefined }) {
  const { list, loading } = useBuiltIn(game, kind);
  const ownRows = useOwnRows(game, kind, list);
  const own = useGameData(game.id).ownItems[kind];
  const exampleRows: MergedRow<AnyItem>[] =
    !loading && list.length === 0 && examples ? examples.filter((e) => !own[e.id]?.mine).map((e) => ({ item: e, origin: 'example' as const, hidden: Boolean(own[e.id]?.hidden) })) : [];
  const rows = [...exampleRows, ...ownRows];
  const [showHidden, setShowHidden] = useState(false);
  const [editing, setEditing] = useState<{ row: MergedRow<AnyItem> | null } | null>(null);
  const noun = NOUN[kind];
  const hiddenCount = rows.filter((r) => r.hidden).length;
  const shown = rows.filter((r) => showHidden || !r.hidden);
  const now = () => new Date().toISOString();

  return (
    <div className={s.stack}>
      <HowTo
        title="How Edit mode works"
        steps={[
          `Add ${noun.one}s the list doesn’t have yet with “Add ${noun.one}”. They show up in ${noun.list} next to the built-in ones, marked YOURS.`,
          `Change any ${noun.one} with “Change”. Your version wins; the list’s own entry is kept underneath, marked CHANGED.`,
          `Hide anything you don’t want to see with “Hide”. Nothing is deleted: “Show hidden” brings it back.`,
          `Items marked EXAMPLE stand in while the game’s list is empty. Change one and it becomes yours; the others stay until you hide them.`,
          `When the list is updated, your own items, changes and hides stay exactly as you left them.`,
        ]}
      />
      <div className={s.toolbar}>
        <Button variant="primary" onClick={() => setEditing({ row: null })}>
          Add {noun.one}
        </Button>
        {hiddenCount > 0 && (
          <Button variant="quiet" aria-pressed={showHidden} onClick={() => setShowHidden((v) => !v)}>
            {showHidden ? 'Hide hidden' : `Show hidden (${hiddenCount})`}
          </Button>
        )}
      </div>
      {editing && (
        <ItemForm
          game={game}
          kind={kind}
          row={editing.row}
          onCancel={() => setEditing(null)}
          onSave={(id, fields, mine) => {
            const before = own[id]?.fields ?? {};
            saveOwnItem(game.id, kind, { id, mine, fields: { ...before, ...fields }, hidden: editing.row?.hidden ?? false, at: now() });
            setEditing(null);
          }}
        />
      )}
      {loading ? (
        <p className={s.note}>Loading the list…</p>
      ) : list.length === 0 ? (
        <p className={s.note}>
          {game.name} has no built-in {noun.list.toLowerCase()} list yet.{' '}
          {exampleRows.length > 0 ? 'The rows marked EXAMPLE stand in for it: change one to make it yours, or hide it.' : 'Add your own with the button above.'}
        </p>
      ) : null}
      {shown.length > 0 && (
        <ul className={s.list} aria-label={`${noun.list} in ${game.name}`}>
          {shown.map((r) => (
            <li key={r.item.id} className={`${s.row} ${r.hidden ? s.rowHidden : ''}`}>
              <span className={`${s.origin} ${r.origin === 'mine' ? s.originMine : r.origin === 'changed' ? s.originChanged : ''}`}>{ORIGIN_LABEL[r.origin]}</span>
              <span className={s.rowText}>
                <span className={s.rowTitle}>{r.item.title}</span>
                <span className={s.rowMeta}>
                  {r.hidden ? 'Hidden · ' : ''}
                  {describe(game, kind, r.item)}
                </span>
              </span>
              <span className={s.rowActions}>
                <Button className={s.small} onClick={() => setEditing({ row: r })} aria-label={`Change ${r.item.title}`}>
                  Change
                </Button>
                <Button className={s.small} onClick={() => setOwnItemHidden(game.id, kind, r.item.id, !r.hidden, now())} aria-label={`${r.hidden ? 'Show' : 'Hide'} ${r.item.title}`}>
                  {r.hidden ? 'Show' : 'Hide'}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function describe(game: GameContract, kind: OwnKind, item: AnyItem): string {
  const when = (a: string, b: string) => {
    const x = Date.parse(a);
    const y = Date.parse(b);
    return Number.isFinite(x) && Number.isFinite(y) ? `${formatDateTime(x)} → ${formatDateTime(y)}` : 'dates not set';
  };
  const cur = (id: string) => game.currencies.find((c) => c.id === id)?.name ?? id;
  if (kind === 'events') {
    const e = item as OwnItemTypes['events'];
    return `${when(e.start, e.end)} · ${e.reward === null ? 'reward unknown' : `${e.reward} ${cur(e.currency)}`}`;
  }
  if (kind === 'banners') {
    const b = item as OwnItemTypes['banners'];
    return `${game.bannerTypes.find((t) => t.id === b.type)?.label ?? b.type} · ${when(b.start, b.end)}`;
  }
  const b = item as OwnItemTypes['backlog'];
  return `${b.category} · ${b.total} to do · ${b.reward === null ? 'reward unknown' : `${b.reward} ${cur(b.currency)}`}`;
}

/** ISO → value for <input type="datetime-local"> in your local time. */
const toLocalInput = (iso: string | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return '';
  const d = new Date(t - new Date(t).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : '');

const EVENT_KINDS: { id: OwnItemTypes['events']['kind']; label: string }[] = [
  { id: 'event', label: 'Event' },
  { id: 'login', label: 'Login' },
  { id: 'web', label: 'Web event' },
  { id: 'endgame', label: 'Endgame' },
  { id: 'bonus', label: 'Double drops / bonus' },
];
const BACKLOG_CATEGORIES = ['story', 'side-quests', 'exploration', 'modes', 'achievements'];

interface FormProps {
  game: GameContract;
  kind: OwnKind;
  row: MergedRow<AnyItem> | null;
  onCancel: () => void;
  onSave: (id: string, fields: Partial<AnyItem>, mine: boolean) => void;
}

function ItemForm({ game, kind, row, onCancel, onSave }: FormProps) {
  const uid = useId();
  const item = (row?.item ?? {}) as Partial<OwnItemTypes['events'] & OwnItemTypes['banners'] & OwnItemTypes['backlog']>;
  const premium = game.currencies.find((c) => c.perPull)?.id ?? game.currencies[0]?.id ?? '';
  const [title, setTitle] = useState(item.title ?? '');
  const [start, setStart] = useState(toLocalInput(item.start));
  const [end, setEnd] = useState(toLocalInput(item.end));
  const [currency, setCurrency] = useState(item.currency ?? premium);
  const [reward, setReward] = useState(item.reward === null || item.reward === undefined ? '' : String(item.reward));
  const [eventKind, setEventKind] = useState(item.kind ?? 'event');
  const [loginDays, setLoginDays] = useState(item.loginDays ? String(item.loginDays) : '');
  const [bannerType, setBannerType] = useState(item.type ?? game.bannerTypes[0]?.id ?? '');
  const [featured, setFeatured] = useState((item.featured ?? []).join(', '));
  const [category, setCategory] = useState(item.category ?? BACKLOG_CATEGORIES[0] ?? 'story');
  const [total, setTotal] = useState(item.total ? String(item.total) : '');
  const [error, setError] = useState('');
  const noun = NOUN[kind].one;
  const isMine = !row || row.origin === 'mine' || row.origin === 'example';
  const f = (name: string) => `${uid}-${name}`;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Give it a name.');
    const rewardNum = reward.trim() === '' ? null : Number(reward);
    if (rewardNum !== null && (!Number.isFinite(rewardNum) || rewardNum < 0)) return setError('The reward must be a number (or empty if you don’t know it).');
    let fields: Partial<AnyItem>;
    if (kind === 'backlog') {
      const t = Number(total);
      if (!Number.isInteger(t) || t < 1) return setError('How many steps it has must be a whole number of 1 or more.');
      fields = { title: title.trim(), category, total: t, reward: rewardNum, currency } satisfies Partial<OwnItemTypes['backlog']>;
    } else {
      const s0 = fromLocalInput(start);
      const e0 = fromLocalInput(end);
      if (!s0 || !e0) return setError('Set when it starts and ends.');
      if (Date.parse(e0) <= Date.parse(s0)) return setError('It has to end after it starts.');
      if (kind === 'events') {
        const days = loginDays.trim() === '' ? undefined : Number(loginDays);
        if (days !== undefined && (!Number.isInteger(days) || days < 1)) return setError('Login days must be a whole number.');
        fields = { title: title.trim(), kind: eventKind, start: s0, end: e0, reward: rewardNum, currency, ...(days ? { loginDays: days } : {}) } satisfies Partial<OwnItemTypes['events']>;
      } else {
        fields = {
          title: title.trim(),
          type: bannerType,
          start: s0,
          end: e0,
          featured: featured
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
        } satisfies Partial<OwnItemTypes['banners']>;
      }
    }
    if (row && !isMine) {
      // A built-in item: keep only what you actually changed.
      const base = row.item as unknown as Record<string, unknown>;
      fields = Object.fromEntries(Object.entries(fields).filter(([k, v]) => JSON.stringify(base[k]) !== JSON.stringify(v))) as Partial<AnyItem>;
      if (Object.keys(fields).length === 0) return onCancel();
    }
    onSave(row?.item.id ?? newOwnId(Date.now()), fields, isMine);
  };

  return (
    <form className={s.form} onSubmit={submit} aria-label={row ? `Change ${row.item.title}` : `Add ${noun}`}>
      <h3 className={s.formTitle}>{row ? `Change “${row.item.title}”` : `Add your own ${noun}`}</h3>
      {row && !isMine && <p className={s.note}>This is a built-in {noun}. Your changes sit on top; the list’s own version is kept.</p>}
      {row?.origin === 'example' && <p className={s.note}>This is an example. Saving makes it your own {noun}; anything you marked on it stays.</p>}
      <div className={s.grid}>
        <label className={`${s.field} ${s.wide}`} htmlFor={f('title')}>
          Name
          <input id={f('title')} className={s.input} value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" />
        </label>
        {kind === 'events' && (
          <label className={s.field} htmlFor={f('kind')}>
            Type
            <select id={f('kind')} className={s.input} value={eventKind} onChange={(e) => setEventKind(e.target.value as typeof eventKind)}>
              {EVENT_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind === 'banners' && (
          <label className={s.field} htmlFor={f('btype')}>
            Banner type
            <select id={f('btype')} className={s.input} value={bannerType} onChange={(e) => setBannerType(e.target.value)}>
              {game.bannerTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind === 'backlog' && (
          <>
            <label className={s.field} htmlFor={f('cat')}>
              Category
              <select id={f('cat')} className={s.input} value={category} onChange={(e) => setCategory(e.target.value)}>
                {[...new Set([...BACKLOG_CATEGORIES, category])].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className={s.field} htmlFor={f('total')}>
              Steps in total
              <input id={f('total')} className={s.input} inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} />
            </label>
          </>
        )}
        {kind !== 'backlog' && (
          <>
            <label className={s.field} htmlFor={f('start')}>
              Starts (your time)
              <input id={f('start')} className={s.input} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className={s.field} htmlFor={f('end')}>
              Ends (your time)
              <input id={f('end')} className={s.input} type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </>
        )}
        {kind === 'banners' && (
          <label className={`${s.field} ${s.wide}`} htmlFor={f('feat')}>
            Featured (names or ids, separated by commas)
            <input id={f('feat')} className={s.input} value={featured} onChange={(e) => setFeatured(e.target.value)} autoComplete="off" />
          </label>
        )}
        {kind !== 'banners' && (
          <>
            <label className={s.field} htmlFor={f('reward')}>
              Reward (empty = unknown)
              <input id={f('reward')} className={s.input} inputMode="numeric" value={reward} onChange={(e) => setReward(e.target.value)} />
            </label>
            <label className={s.field} htmlFor={f('cur')}>
              Currency
              <select id={f('cur')} className={s.input} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {game.currencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {kind === 'events' && eventKind === 'login' && (
          <label className={s.field} htmlFor={f('days')}>
            Login days
            <input id={f('days')} className={s.input} inputMode="numeric" value={loginDays} onChange={(e) => setLoginDays(e.target.value)} />
          </label>
        )}
      </div>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <div className={s.formActions}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit">
          {row ? 'Save change' : `Add ${noun}`}
        </Button>
      </div>
    </form>
  );
}

/** Edit mode for every list of the games in view: pick a game (in All games) and a list. */
export function EditLists({ games, initialGame }: { games: GameContract[]; initialGame?: string | undefined }) {
  const [gameId, setGameId] = useState(initialGame && games.some((g) => g.id === initialGame) ? initialGame : (games[0]?.id ?? ''));
  const [kind, setKind] = useState<OwnKind>('events');
  const game = games.find((g) => g.id === gameId);
  if (!game) return <p className={s.note}>Switch on a game first.</p>;
  return (
    <div className={s.stack}>
      {games.length > 1 && <Segmented label="Game" options={games.map((g) => ({ id: g.id, label: g.short }))} value={game.id} onChange={setGameId} />}
      <Segmented
        label="List"
        options={[
          { id: 'events', label: 'Events' },
          { id: 'banners', label: 'Banners' },
          { id: 'backlog', label: 'Backlog' },
        ]}
        value={kind}
        onChange={setKind}
      />
      <EditMode key={`${game.id}-${kind}`} game={game} kind={kind} />
    </div>
  );
}

/**
 * One-line entry point for a list screen: an "Edit list" button that opens
 * Edit mode for that game and list in a side panel (PC) or sheet (phone).
 */
export function EditListButton({ game, kind, examples }: { game: GameContract; kind: OwnKind; examples?: readonly AnyItem[] | undefined }) {
  const [open, setOpen] = useState(false);
  const own = useGameData(game.id).ownItems[kind];
  const count = Object.values(own).filter((e) => e.mine && !e.hidden).length;
  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)} aria-label={`Add, change or hide ${NOUN[kind].list.toLowerCase()} in ${game.name}`}>
        Edit list{count ? ` · ${count} yours` : ''}
      </Button>
      <BottomSheet open={open} title={`Edit mode · ${NOUN[kind].list} · ${game.short}`} onClose={() => setOpen(false)} side>
        <EditMode game={game} kind={kind} examples={examples} />
      </BottomSheet>
    </>
  );
}
