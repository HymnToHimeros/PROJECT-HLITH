import { useEffect, useId, useState, type FormEvent } from 'react';
import type { GameContract } from '../../core/contract';
import { backend } from '../../core/data/backend';
import { LIST_KINDS, mergeList, seedLoaders, type CatalogRow, type ListItem, type ListKind } from '../../core/data/catalog';
import { fetchCatalogRows, saveCatalogRow, setCatalogStatus } from '../../core/data/catalogSource';
import { formatDateTime } from '../../core/time/reset';
import { Button, HowTo, NoData, Segmented } from '../../core/ui';
import { EVENT_KINDS, findingSource, slugId, type Draft } from './approve';
import o from './owner.module.css';

/*
 * Owner console → Lists: the built-in lists every user starts from (each game's seed
 * files with the owner's rows from catalog_items laid over them). The owner adds items,
 * changes any item and retires or brings back items, for everyone. Nothing is deleted
 * and nobody's progress is touched: progress lives in other tables, keyed by the item's
 * id, and ids never change. Users' own changes and hides still apply on top.
 * No design yet (CLAUDE.md Override 5): the owner console's tokens and parts.
 */

type Item = { id: string } & Record<string, unknown>;
type Row = ListItem<Item>;

export const LIST_LABEL: Record<ListKind, { list: string; one: string }> = {
  events: { list: 'Events', one: 'event' },
  banners: { list: 'Banners', one: 'banner' },
  backlog: { list: 'Backlog', one: 'backlog item' },
  characters: { list: 'Characters', one: 'character' },
  versions: { list: 'Versions', one: 'version' },
};
const LISTS = Object.keys(LIST_LABEL) as ListKind[];

const EVENT_KIND_LABEL: Record<string, string> = { event: 'Event', login: 'Login', web: 'Web event', endgame: 'Endgame', bonus: 'Double drops / bonus' };

/** ISO → value for <input type="datetime-local"> in your local time. */
const toLocalInput = (v: unknown) => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  if (!Number.isFinite(t)) return '';
  return new Date(t - new Date(t).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : '');
const when = (v: unknown) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? formatDateTime(Date.parse(v)) : 'not set');

function nameOf(item: Item): string {
  return String(item.title ?? item.name ?? item.id);
}

/** One line about an item, in plain words. */
function describe(game: GameContract, list: ListKind, i: Item): string {
  const cur = (id: unknown) => game.currencies.find((c) => c.id === id)?.name ?? String(id ?? '');
  const reward = i.reward === null || i.reward === undefined ? 'reward unknown' : `${String(i.reward)} ${cur(i.currency)}`;
  if (list === 'events') return `${EVENT_KIND_LABEL[String(i.kind)] ?? String(i.kind ?? 'kind not set')} · ${when(i.start)} → ${when(i.end)} · ${reward}`;
  if (list === 'banners') return `${game.bannerTypes.find((t) => t.id === i.type)?.label ?? String(i.type ?? 'type not set')} · ${when(i.start)} → ${when(i.end)}`;
  if (list === 'backlog') return `${String(i.category ?? 'no category')} · ${String(i.total ?? '?')} to do · ${reward}`;
  if (list === 'characters') {
    const rarity = i.rarity === 'top' ? game.terms.rarity.top : i.rarity === 'mid' ? game.terms.rarity.mid : 'rarity not set';
    const el = game.elements.find((e) => e.id === i.element)?.label ?? String(i.element ?? 'element not set');
    const role = game.roles.find((r) => r.id === i.role)?.label ?? String(i.role ?? 'role not set');
    return `${rarity} · ${el} · ${role}`;
  }
  return `${when(i.start)} → ${when(i.end)}`;
}

interface Props {
  games: GameContract[];
  /** An item to complete, from an approved finding. */
  draft: Draft | null;
  clearDraft: () => void;
}

interface FormState {
  /** The item as it is now (seed + owner row), or the draft's fields for a new one. */
  item: Partial<Item>;
  /** The seed's own version, when changing a seed item. */
  base: Item | null;
  isNew: boolean;
  missing?: string[];
  findingId?: string | undefined;
}

export function Lists({ games, draft, clearDraft }: Props) {
  const live = Boolean(backend);
  // A draft from an approved finding opens this tab with the form filled in (the tab mounts fresh for it).
  const [gameId, setGameId] = useState(draft?.gameId ?? games[0]?.id ?? '');
  const [list, setList] = useState<ListKind>(draft?.list ?? 'events');
  const [loaded, setLoaded] = useState<{ key: string; seed: Item[]; rows: CatalogRow[]; error: string | null } | null>(null);
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState<FormState | null>(() =>
    draft ? { item: draft.item as Partial<Item>, base: null, isNew: true, missing: draft.missing, findingId: draft.findingId } : null,
  );
  const [said, setSaid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const game = games.find((g) => g.id === gameId) ?? games[0];
  const key = `${game?.id ?? ''}:${list}:${tick}`;

  useEffect(() => {
    if (draft) clearDraft();
  }, [draft, clearDraft]);

  useEffect(() => {
    if (!game) return;
    let alive = true;
    const loadSeed = seedLoaders(game)[list] as unknown as () => Promise<Item[]>;
    void Promise.all([
      loadSeed(),
      live
        ? fetchCatalogRows(backend, game.id, LIST_KINDS[list]).then(
            (rows) => ({ rows, error: null }),
            (e: unknown) => ({ rows: [] as CatalogRow[], error: e instanceof Error ? e.message : 'Could not read the owner’s rows.' }),
          )
        : Promise.resolve({ rows: [] as CatalogRow[], error: null }),
    ]).then(([seed, r]) => {
      if (alive) setLoaded({ key, seed, rows: r.rows, error: r.error });
    });
    return () => {
      alive = false;
    };
  }, [game, list, key, live]);

  if (!game) return <NoData />;
  const ready = loaded?.key === key ? loaded : null;
  const merged: Row[] = ready ? mergeList(ready.seed, ready.rows) : [];
  const seedById = new Map((ready?.seed ?? []).map((i) => [i.id, i]));
  const q = filter.trim().toLowerCase();
  const shown = q ? merged.filter((r) => nameOf(r).toLowerCase().includes(q) || r.id.toLowerCase().includes(q)) : merged;
  const noun = LIST_LABEL[list].one;

  const save = async (id: string, data: Record<string, unknown>, isNew: boolean, findingId?: string) => {
    setError(null);
    try {
      await saveCatalogRow({ game_id: game.id, kind: LIST_KINDS[list], id, data, ...(findingId ? { source: findingSource(findingId) } : {}) });
      setForm(null);
      setSaid(`${isNew ? 'Added' : 'Saved'} “${String(data.title ?? data.name ?? id)}” in ${game.short} · ${LIST_LABEL[list].list}. Everyone sees this after reload.`);
      setTick((t) => t + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save it.');
    }
  };

  const setStatus = async (r: Row, status: 'active' | 'retired') => {
    setError(null);
    try {
      await setCatalogStatus(game.id, LIST_KINDS[list], r.id, status);
      setSaid(
        status === 'retired'
          ? `Retired “${nameOf(r)}”: it leaves ${game.short} · ${LIST_LABEL[list].list} for everyone after reload. Progress on it stays saved and comes back if you bring it back.`
          : `Brought back “${nameOf(r)}”: everyone sees it again after reload.`,
      );
      setTick((t) => t + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change it.');
    }
  };

  return (
    <div className={o.stack}>
      <HowTo
        steps={[
          <>These are the built-in lists every user starts from: the game’s own files (LIST) plus your changes and additions (OWNER).</>,
          <>Add, change, retire or bring back an item. Everyone sees the change after they reload. Nothing is ever deleted, and nobody’s progress changes.</>,
          <>People’s own changes and hidden items (Edit mode) still apply on top of these lists.</>,
        ]}
      />
      {!live && <p className={o.note}>This site runs without a server, so these are the game files’ lists as they are. Changing them for everyone needs the site’s server.</p>}
      {error && (
        <p className={o.alert} role="alert">
          {error}
        </p>
      )}
      {said && (
        <p className={o.said} role="status">
          {said}
        </p>
      )}

      <section className={o.card} aria-labelledby="lists-title">
        <div className={o.cardHead}>
          <h3 className={o.cardTitle} id="lists-title">
            {game.short} · {LIST_LABEL[list].list} <span className={o.count}>{ready ? `${merged.filter((r) => !r.retired).length} in the list` : '…'}</span>
          </h3>
          {live && !form && (
            <button type="button" className={o.publish} onClick={() => setForm({ item: {}, base: null, isNew: true })}>
              Add {noun}
            </button>
          )}
        </div>
        <div className={o.filters}>
          <label className={o.filter}>
            <span>Game</span>
            <select
              className={o.select}
              value={game.id}
              onChange={(e) => {
                setGameId(e.target.value);
                setForm(null);
              }}
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className={o.filter}>
            <span>Find</span>
            <input className={o.select} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Name or id" />
          </label>
        </div>
        <Segmented
          label="List"
          value={list}
          onChange={(l) => {
            setList(l);
            setForm(null);
          }}
          options={LISTS.map((l) => ({ id: l, label: LIST_LABEL[l].list }))}
        />
        {ready?.error && (
          <p className={o.alert} role="alert">
            Could not read your changes ({ready.error}), so this shows the game files’ list only.
          </p>
        )}

        {form && (
          <ItemForm
            key={`${list}:${String(form.item.id ?? 'new')}`}
            game={game}
            list={list}
            state={form}
            taken={new Set(merged.map((r) => r.id))}
            onCancel={() => setForm(null)}
            onSave={(id, data) => void save(id, data, form.isNew && !merged.some((r) => r.id === id), form.findingId)}
          />
        )}

        {!ready ? (
          <span className={o.note}>Loading…</span>
        ) : shown.length === 0 ? (
          merged.length === 0 ? <NoData /> : <span className={o.note}>Nothing matches.</span>
        ) : (
          <ul className={o.list}>
            {shown.map((r) => (
              <li key={r.id} className={`${o.item} ${r.retired ? o.itemRetired : ''}`} aria-label={nameOf(r)}>
                <span className={`${o.tag} ${r.updatedBy === 'owner' ? o.tagOwner : ''}`}>{r.updatedBy === 'owner' ? 'OWNER' : 'LIST'}</span>
                {r.retired && <span className={o.tag}>RETIRED</span>}
                {Boolean(r.leak) && <span className={o.tag}>LEAK</span>}
                <span className={o.itemText}>
                  <span className={o.itemTitle}>{nameOf(r)}</span>
                  <span className={o.recordMeta}>
                    {describe(game, list, r)} · id {r.id}
                  </span>
                </span>
                {live && (
                  <span className={o.jobActions}>
                    <button
                      type="button"
                      className={o.smallBtn}
                      aria-label={`Change: ${nameOf(r)}`}
                      onClick={() => {
                        const { retired, updatedBy, ...item } = r;
                        void retired;
                        void updatedBy;
                        setForm({ item, base: seedById.get(r.id) ?? null, isNew: false });
                      }}
                    >
                      Change
                    </button>
                    {r.retired ? (
                      <button type="button" className={o.smallBtn} aria-label={`Bring back: ${nameOf(r)}`} onClick={() => void setStatus(r, 'active')}>
                        Bring back
                      </button>
                    ) : (
                      <button type="button" className={o.smallBtn} aria-label={`Retire: ${nameOf(r)}`} onClick={() => void setStatus(r, 'retired')}>
                        Retire
                      </button>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <span className={o.note}>
          Retire takes an item out of the list for everyone; its id stays reserved, and people’s progress on it stays saved and comes back if you bring it back.
          {list === 'characters' && ' While a character is retired, people who have it won’t see it in Roster.'}
        </span>
      </section>
    </div>
  );
}

// ── The form ─────────────────────────────────────────────────────────

type FieldType = 'text' | 'datetime' | 'number' | 'int' | 'select' | 'lines' | 'csv';
interface Field {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { id: string; label: string }[];
  wide?: boolean;
}

function fieldsFor(game: GameContract, list: ListKind): Field[] {
  const currencies = game.currencies.map((c) => ({ id: c.id, label: c.name }));
  const leak: Field = { key: 'leak', label: 'Leak source (empty = not a leak)', type: 'text', wide: true };
  switch (list) {
    case 'events':
      return [
        { key: 'title', label: 'Name', type: 'text', required: true, wide: true },
        { key: 'kind', label: 'Type', type: 'select', required: true, options: EVENT_KINDS.map((k) => ({ id: k, label: EVENT_KIND_LABEL[k] ?? k })) },
        { key: 'start', label: 'Starts (your time)', type: 'datetime', required: true },
        { key: 'end', label: 'Ends (your time)', type: 'datetime', required: true },
        { key: 'reward', label: 'Reward (empty = unknown)', type: 'number' },
        { key: 'currency', label: 'Currency', type: 'select', options: currencies },
        { key: 'loginDays', label: 'Login days (login events)', type: 'int' },
        leak,
      ];
    case 'banners':
      return [
        { key: 'title', label: 'Name', type: 'text', required: true, wide: true },
        { key: 'type', label: 'Banner type', type: 'select', required: true, options: game.bannerTypes.map((t) => ({ id: t.id, label: t.label })) },
        { key: 'start', label: 'Starts (your time)', type: 'datetime', required: true },
        { key: 'end', label: 'Ends (your time)', type: 'datetime', required: true },
        { key: 'featured', label: 'Featured (character or weapon ids, separated by commas)', type: 'csv', wide: true },
        leak,
      ];
    case 'backlog':
      return [
        { key: 'title', label: 'Name', type: 'text', required: true, wide: true },
        { key: 'category', label: 'Category (story, side-quests, exploration…)', type: 'text', required: true },
        { key: 'total', label: 'How much there is to do', type: 'int', required: true },
        { key: 'reward', label: 'Reward for all of it (empty = unknown, 0 = none)', type: 'number' },
        { key: 'currency', label: 'Currency', type: 'select', options: currencies },
        { key: 'group', label: 'Heading inside the category', type: 'text' },
        { key: 'unit', label: 'Unit after the numbers (e.g. %)', type: 'text' },
        { key: 'note', label: 'Short note', type: 'text', wide: true },
        { key: 'steps', label: 'Steps in order, one per line (sets the total)', type: 'lines', wide: true },
      ];
    case 'characters':
      return [
        { key: 'name', label: 'Name', type: 'text', required: true, wide: true },
        {
          key: 'rarity',
          label: 'Rarity',
          type: 'select',
          required: true,
          options: [
            { id: 'top', label: game.terms.rarity.top },
            { id: 'mid', label: game.terms.rarity.mid },
          ],
        },
        { key: 'element', label: 'Element', type: 'select', required: true, options: game.elements.map((e) => ({ id: e.id, label: e.label })) },
        { key: 'role', label: 'Role', type: 'select', required: true, options: game.roles.map((r) => ({ id: r.id, label: r.label })) },
        { key: 'releasedAt', label: 'Released (your time)', type: 'datetime' },
        leak,
      ];
    case 'versions':
      return [
        { key: 'start', label: 'Starts (your time)', type: 'datetime', required: true },
        { key: 'end', label: 'Ends (your time)', type: 'datetime', required: true },
      ];
  }
}

/** A stored value → the text in its input. */
function toInput(f: Field, v: unknown): string {
  if (v === undefined || v === null) return '';
  if (f.key === 'leak') return typeof v === 'object' && v && 'source' in v ? String((v as { source: unknown }).source ?? '') : '';
  if (f.type === 'datetime') return toLocalInput(v);
  if (f.type === 'lines') return Array.isArray(v) ? v.join('\n') : '';
  if (f.type === 'csv') return Array.isArray(v) ? v.join(', ') : '';
  return String(v);
}

interface FormProps {
  game: GameContract;
  list: ListKind;
  state: FormState;
  taken: Set<string>;
  onCancel: () => void;
  onSave: (id: string, data: Record<string, unknown>) => void;
}

function ItemForm({ game, list, state, taken, onCancel, onSave }: FormProps) {
  const uid = useId();
  const fields = fieldsFor(game, list);
  const premium = game.currencies.find((c) => c.perPull && !c.paid)?.id ?? game.currencies[0]?.id ?? '';
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const f of fields) out[f.key] = toInput(f, state.item[f.key]);
    if (state.isNew) {
      if (!out.currency && fields.some((f) => f.key === 'currency')) out.currency = premium;
      for (const f of fields) if (f.type === 'select' && f.required && !out[f.key] && !state.missing) out[f.key] = f.options?.[0]?.id ?? '';
    }
    return out;
  });
  const [id, setId] = useState(typeof state.item.id === 'string' ? state.item.id : '');
  const [idTouched, setIdTouched] = useState(typeof state.item.id === 'string');
  const [error, setError] = useState('');
  const noun = LIST_LABEL[list].one;
  const words = values.title ?? values.name ?? '';
  const shownId = state.isNew && !idTouched && list !== 'versions' ? slugId(words) : id;
  const f = (k: string) => `${uid}-${k}`;
  const set = (k: string, v: string) => setValues((x) => ({ ...x, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const finalId = shownId.trim();
    if (!finalId) return setError(list === 'versions' ? 'Give the version number.' : 'Give it a name (the id is made from it).');
    if (!/^[A-Za-z0-9._-]{1,80}$/.test(finalId)) return setError('The id may use letters, digits, dots, dashes and underscores only.');
    if (state.isNew && !state.findingId && taken.has(finalId)) return setError(`There is already an item with the id “${finalId}”. Change that one, or pick another id.`);
    const data: Record<string, unknown> = {};
    for (const fd of fields) {
      const raw = (values[fd.key] ?? '').trim();
      if (fd.required && !raw) return setError(`${fd.label.replace(/ \(.*\)$/, '')} is needed.`);
      if (!raw) {
        if (fd.key === 'reward') data.reward = null;
        else if (fd.type === 'csv' || fd.type === 'lines') data[fd.key] = [];
        continue;
      }
      if (fd.key === 'leak') data.leak = { source: raw };
      else if (fd.type === 'datetime') data[fd.key] = fromLocalInput(raw);
      else if (fd.type === 'number' || fd.type === 'int') {
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0 || (fd.type === 'int' && !Number.isInteger(n))) return setError(`${fd.label.replace(/ \(.*\)$/, '')} must be a ${fd.type === 'int' ? 'whole ' : ''}number.`);
        data[fd.key] = n;
      } else if (fd.type === 'csv')
        data[fd.key] = raw
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
      else if (fd.type === 'lines')
        data[fd.key] = raw
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean);
      else data[fd.key] = raw;
    }
    if (typeof data.start === 'string' && typeof data.end === 'string' && Date.parse(data.end) <= Date.parse(data.start)) return setError('It has to end after it starts.');
    if (list === 'backlog' && Array.isArray(data.steps) && data.steps.length > 0) data.total = data.steps.length;
    if (list === 'backlog' && !('total' in data)) return setError('How much there is to do is needed.');

    let out: Record<string, unknown>;
    if (state.base) {
      // A seed item: keep only what differs from the game file, so later file fixes still show through.
      const base = state.base as Record<string, unknown>;
      const empty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
      out = Object.fromEntries(Object.entries(data).filter(([k, v]) => !(empty(v) && empty(base[k])) && JSON.stringify(base[k]) !== JSON.stringify(v)));
      if (base.leak && !data.leak) out.leak = null;
    } else {
      out = Object.fromEntries(Object.entries(data).filter(([k, v]) => k === 'reward' || !(Array.isArray(v) && v.length === 0) || list === 'banners'));
    }
    onSave(finalId, out);
  };

  const what = state.isNew
    ? `Adds this ${noun} to ${game.short} · ${LIST_LABEL[list].list} for everyone. They see it after reload.`
    : state.base
      ? `Changes this built-in ${noun} for everyone (the game file keeps its own version). They see it after reload; their own changes still sit on top, and nobody’s progress changes.`
      : `Changes your ${noun} for everyone. They see it after reload; nobody’s progress changes.`;

  return (
    <form className={o.form} onSubmit={submit} aria-label={state.isNew ? `Add ${noun}` : `Change ${String(state.item.title ?? state.item.name ?? state.item.id)}`}>
      <h4 className={o.cardTitle}>{state.isNew ? `Add ${noun}` : `Change “${String(state.item.title ?? state.item.name ?? state.item.id)}”`}</h4>
      {state.missing && state.missing.length > 0 && <p className={o.note}>From an approved finding. Still needed: {state.missing.join(', ')}.</p>}
      <div className={o.formGrid}>
        {(state.isNew || list === 'versions') && (
          <label className={o.field} htmlFor={f('id')}>
            {list === 'versions' ? 'Version number' : 'Id (made from the name; never changes once added)'}
            <input
              id={f('id')}
              className={o.input}
              value={shownId}
              readOnly={!state.isNew}
              onChange={(e) => {
                setId(e.target.value);
                setIdTouched(true);
              }}
              autoComplete="off"
            />
          </label>
        )}
        {fields.map((fd) => (
          <label key={fd.key} className={`${o.field} ${fd.wide ? o.wide : ''}`} htmlFor={f(fd.key)}>
            {fd.label}
            {fd.type === 'select' ? (
              <select id={f(fd.key)} className={o.select} value={values[fd.key] ?? ''} onChange={(e) => set(fd.key, e.target.value)}>
                {!fd.required || !values[fd.key] ? <option value="">{fd.required ? 'Pick one' : 'Not set'}</option> : null}
                {(fd.options ?? []).map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.label}
                  </option>
                ))}
              </select>
            ) : fd.type === 'lines' ? (
              <textarea id={f(fd.key)} className={o.textarea} value={values[fd.key] ?? ''} onChange={(e) => set(fd.key, e.target.value)} />
            ) : (
              <input
                id={f(fd.key)}
                className={o.input}
                type={fd.type === 'datetime' ? 'datetime-local' : 'text'}
                inputMode={fd.type === 'number' || fd.type === 'int' ? 'numeric' : undefined}
                value={values[fd.key] ?? ''}
                onChange={(e) => set(fd.key, e.target.value)}
                autoComplete="off"
              />
            )}
          </label>
        ))}
      </div>
      <p className={o.note}>{what}</p>
      {error && (
        <p className={o.alert} role="alert">
          {error}
        </p>
      )}
      <div className={o.jobActions}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit">
          {state.isNew ? `Add ${noun}` : 'Save change'}
        </Button>
      </div>
    </form>
  );
}
