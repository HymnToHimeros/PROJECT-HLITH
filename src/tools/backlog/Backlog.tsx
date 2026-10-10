import { useId, useState, type CSSProperties, type FormEvent } from 'react';
import type { BacklogItem, GameContract } from '../../core/contract';
import { clearBacklogDone, gameData, restoreBacklogDone, revertOwnItem, saveOwnItem, setBacklogCategory, setBacklogDone, setOwnItemHidden, useGameData } from '../../core/data/userData';
import { formatNumber } from '../../core/time/format';
import { BottomSheet, Button, ExampleTag, NoData } from '../../core/ui';
import { cx } from '../../core/ui/cx';
import { newOwnId } from '../edit-mode/merge';
import { Switch } from '../pulls/shared';
import { exampleBacklog } from './examples';
import { categories, categoryIds, categoryLabel, estimate, groupsOf, isDone, openCount, shapeOf, type CategoryView, type ItemView, type Shape } from './backlog';
import b from './backlog.module.css';
import type { BacklogData, BacklogRow } from './useBacklogData';

interface Props {
  game: GameContract;
  data: BacklogData;
  openCalculator: () => void;
  /** Edit mode: change, add or hide anything. */
  editing: boolean;
}

/**
 * Backlog (R30): "still on the table" on top, one tab per category, and each category
 * the way its content works: the story as a checklist you tap where you are, side quests
 * as tick boxes in their regions, everything else as counters. Every item is yours to
 * change in Edit mode (built-in ones take your changes on top; nothing is deleted, only
 * hidden). The switch on each category says whether it counts toward pulls (the same
 * switch is in Pulls → Calculator).
 */
export function Backlog({ game, data, openCalculator, editing }: Props) {
  const all = categories(game, data.items.list, data.user, data.items.exampleDone);
  const real = categories(game, data.items.real, data.user);
  const ids = categoryIds(data.items.list).filter((id) => editing || all.some((c) => c.id === id));
  const [tab, setTab] = useState<string | null>(null);
  const current = tab && ids.includes(tab) ? tab : (ids[0] ?? null);
  const [form, setForm] = useState<{ row: BacklogRow | null; category: string } | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const name = (id: string) => game.currencies.find((c) => c.id === id)?.name ?? id;
  const cat = all.find((c) => c.id === current);
  const hidden = data.rows.filter((r) => r.hidden);
  const rowOf = (id: string) => data.rows.find((r) => r.item.id === id && !r.hidden);

  return (
    <div className={b.stack} style={{ '--vent': game.vent } as CSSProperties}>
      <Summary game={game} cats={real} example={data.items.example && data.items.real.length === 0} name={name} openCalculator={openCalculator} />

      {editing && (
        <section className={b.editBar} aria-label="Edit mode">
          <p className={b.editText}>Edit mode: change, add or hide anything here. Built-in items are only hidden, so you can always bring them back.</p>
          <div className={b.editActions}>
            {hidden.length > 0 && (
              <Button variant="quiet" aria-pressed={showHidden} onClick={() => setShowHidden((v) => !v)}>
                {showHidden ? 'Hide hidden' : `Show hidden (${hidden.length})`}
              </Button>
            )}
            <Button variant="primary" onClick={() => setForm({ row: null, category: current ?? 'story' })}>
              + Add item
            </Button>
          </div>
        </section>
      )}

      {editing && showHidden && hidden.length > 0 && (
        <ul className={b.hiddenList} aria-label="Hidden items">
          {hidden.map((r) => (
            <li key={r.item.id} className={b.hiddenRow}>
              <span>
                {r.item.title} <span className={b.muted}>· {categoryLabel(r.item.category)}</span>
              </span>
              <Button className={b.small} onClick={() => setOwnItemHidden(game.id, 'backlog', r.item.id, false, new Date().toISOString())} aria-label={`Show ${r.item.title} again`}>
                Show again
              </Button>
            </li>
          ))}
        </ul>
      )}

      {ids.length === 0 ? (
        <section className={b.card}>
          <NoData dash={false} />
          <p className={b.muted}>Nothing in {game.short}’s backlog yet. Press Edit, then “Add item”, to add your own.</p>
        </section>
      ) : (
        <>
          <div className={b.tabs} role="tablist" aria-label={`${game.short} backlog categories`}>
            {ids.map((id) => {
              const c = all.find((x) => x.id === id);
              return (
                <button key={id} type="button" role="tab" aria-selected={id === current} className={b.tab} onClick={() => setTab(id)}>
                  {categoryLabel(id)}
                  <span className={b.badge}>{c ? badgeOf(c) : 0}</span>
                </button>
              );
            })}
          </div>
          {current && (
            <CategoryPanel
              key={current}
              game={game}
              id={current}
              cat={cat}
              data={data}
              editing={editing}
              name={name}
              onAdd={() => setForm({ row: null, category: current })}
              onChange={(id) => {
                const row = rowOf(id);
                if (row) setForm({ row, category: row.item.category });
              }}
            />
          )}
        </>
      )}

      <BottomSheet open={form !== null} title={form?.row ? `Change “${form.row.item.title}”` : 'Add a backlog item'} onClose={() => setForm(null)} side>
        {form && <ItemForm game={game} row={form.row} category={form.category} categories={categoryIds(data.items.list)} rows={data.rows} onDone={() => setForm(null)} />}
      </BottomSheet>
    </div>
  );
}

/** Tab badge: the story as done/total, everything else as items still open; ✓ when all done. */
function badgeOf(c: CategoryView): string {
  const story = c.items.length === 1 && c.items[0] && shapeOf(c.items[0].item) === 'steps' ? c.items[0] : null;
  if (story) return story.done === null ? '—' : story.done >= story.item.total ? '✓' : `${story.done}/${story.item.total}`;
  const open = openCount(c);
  return open === 0 && c.items.length > 0 ? '✓' : String(open);
}

function CategoryPanel({
  game,
  id,
  cat,
  data,
  editing,
  name,
  onAdd,
  onChange,
}: {
  game: GameContract;
  id: string;
  cat: CategoryView | undefined;
  data: BacklogData;
  editing: boolean;
  name: (id: string) => string;
  onAdd: () => void;
  onChange: (id: string) => void;
}) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [confirmAll, setConfirmAll] = useState(false);
  /** What progress was before "All done", so Undo puts it back exactly (missing = no data). */
  const [undoAll, setUndoAll] = useState<Record<string, number | undefined> | null>(null);
  const items = cat?.items ?? [];
  const groups = groupsOf(items);
  const named = groups.filter((g) => g.name !== null);
  const noRewards = items.length > 0 && items.every((v) => v.item.reward === 0);
  const label = categoryLabel(id);
  const ctx: RowCtx = { game, data, editing, name, onChange };
  const toggle = (g: string) =>
    setOpenGroups((s) => {
      const n = new Set(s);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });

  return (
    <section className={cx(b.panel, cat && !cat.enabled && b.off)} aria-label={label}>
      <div className={b.panelHead}>
        <h3 className={b.panelTitle}>{label}</h3>
        <div className={b.panelActions}>
          {noRewards && <span className={b.muted}>checklist only · no rewards counted</span>}
          {editing && (
            <button type="button" className={b.link} onClick={onAdd}>
              + Add
            </button>
          )}
          {named.length > 0 && (
            <button type="button" className={b.link} onClick={() => setOpenGroups(openGroups.size === named.length ? new Set() : new Set(named.map((g) => g.name as string)))}>
              {openGroups.size === named.length ? 'Close all' : 'Open all'}
            </button>
          )}
          {items.length > 0 &&
            (confirmAll ? (
              <span className={b.confirm} role="group" aria-label="Mark all as done?">
                Mark all {items.length} as done?
                <button
                  type="button"
                  className={b.link}
                  onClick={() => {
                    const mine = gameData(game.id).backlog;
                    setUndoAll(Object.fromEntries(items.map((v) => [v.item.id, mine[v.item.id]])));
                    for (const v of items) setBacklogDone(game.id, v.item.id, v.item.total);
                    setConfirmAll(false);
                  }}
                >
                  Yes
                </button>
                <button type="button" className={b.link} onClick={() => setConfirmAll(false)}>
                  Cancel
                </button>
              </span>
            ) : undoAll ? (
              <span className={b.confirm} role="status">
                All {Object.keys(undoAll).length} marked done.
                <button
                  type="button"
                  className={b.link}
                  onClick={() => {
                    restoreBacklogDone(game.id, undoAll);
                    setUndoAll(null);
                  }}
                >
                  Undo
                </button>
              </span>
            ) : (
              <button type="button" className={b.link} onClick={() => setConfirmAll(true)}>
                All done
              </button>
            ))}
          {cat && !noRewards && <Switch checked={cat.enabled} onChange={(on) => setBacklogCategory(game.id, cat.id, on)} label={`Count ${label} toward pulls`} />}
        </div>
      </div>
      {cat && !cat.enabled && <p className={b.muted}>Not counted toward pulls.</p>}
      {cat && cat.enabled && cat.covers.length > 0 && <p className={b.muted}>While this is on, it also covers {cat.covers.map((r) => `“${r.label}”`).join(', ')} in Pulls, so nothing is counted twice.</p>}

      {items.length === 0 ? (
        <div className={b.card}>
          <p className={b.muted}>Nothing in {label} yet.</p>
          <Button onClick={onAdd}>+ Add to {label}</Button>
        </div>
      ) : (
        <div className={b.card}>
          {groups.map((g) =>
            g.name === null ? (
              g.items.map((v) => <ItemRow key={v.item.id} view={v} ctx={ctx} />)
            ) : (
              <Group key={g.name} title={g.name} items={g.items} open={openGroups.has(g.name)} onToggle={() => toggle(g.name as string)} ctx={ctx} />
            ),
          )}
        </div>
      )}
    </section>
  );
}

interface RowCtx {
  game: GameContract;
  data: BacklogData;
  editing: boolean;
  name: (id: string) => string;
  onChange: (id: string) => void;
}

const isExample = (v: ItemView, ctx: RowCtx) => ctx.data.items.exampleIds.has(v.item.id) || v.doneExample;

/** Reward still to get, in words: "≈ 420 Gem left", "no reward", "All collected", or no data. */
function RewardLeft({ view, name }: { view: ItemView; name: (id: string) => string }) {
  const { item } = view;
  if (item.reward === 0) return <span className={b.muted}>no reward</span>;
  if (item.reward === null)
    return (
      <span className={b.muted}>
        Reward: <NoData dash={false} />
      </span>
    );
  if (view.rewardLeft === null) return <span className={b.muted}>{formatNumber(item.reward)} in all · enter your progress</span>;
  if (view.rewardLeft === 0) return <span className={b.muted}>All collected</span>;
  return (
    <span className={b.reward}>
      ≈ {formatNumber(view.rewardLeft)} {name(item.currency)} left
    </span>
  );
}

function Group({ title, items, open, onToggle, ctx }: { title: string; items: ItemView[]; open: boolean; onToggle: () => void; ctx: RowCtx }) {
  const id = useId();
  const left = items.filter((v) => !isDone(v)).length;
  const sum: Record<string, number> = {};
  let unknownReward = false;
  for (const v of items) {
    if (v.rewardLeft === null) unknownReward = unknownReward || !isDone(v);
    else if (v.rewardLeft > 0) sum[v.item.currency] = (sum[v.item.currency] ?? 0) + v.rewardLeft;
  }
  const amounts = Object.entries(sum);
  return (
    <div className={b.group}>
      <button type="button" className={b.groupHead} aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <span className={b.chevron} aria-hidden="true">
          {open ? '⌄' : '›'}
        </span>
        <span className={b.groupText}>
          <span className={b.itemTitle}>{title}</span>
          <span className={b.muted}>{left === 0 ? `all ${items.length} done` : `${left} of ${items.length} still open`}</span>
        </span>
        <span className={b.groupEnd}>
          {left === 0 ? (
            <span aria-label="all done">✓</span>
          ) : amounts.length ? (
            amounts.map(([c, v]) => (
              <span key={c} className={b.reward}>
                ≈ {formatNumber(v)} {ctx.name(c)}
              </span>
            ))
          ) : unknownReward ? (
            <span className={b.muted}>—</span>
          ) : null}
        </span>
      </button>
      <div id={id} hidden={!open} className={b.groupBody}>
        {items.map((v) => (
          <ItemRow key={v.item.id} view={v} ctx={ctx} />
        ))}
      </div>
    </div>
  );
}

function EditButtons({ view, ctx }: { view: ItemView; ctx: RowCtx }) {
  if (!ctx.editing) return null;
  const t = view.item.title;
  const changed = ctx.data.rows.some((r) => r.item.id === view.item.id && r.origin === 'changed');
  return (
    <span className={b.rowEdit}>
      <Button className={b.small} onClick={() => ctx.onChange(view.item.id)} aria-label={`Change ${t}`}>
        Change
      </Button>
      {changed && (
        <Button className={b.small} onClick={() => revertOwnItem(ctx.game.id, 'backlog', view.item.id, new Date().toISOString())} aria-label={`Back to the list’s version of ${t}`}>
          Back to the list’s version
        </Button>
      )}
      <Button className={b.small} onClick={() => setOwnItemHidden(ctx.game.id, 'backlog', view.item.id, true, new Date().toISOString())} aria-label={`Hide ${t}`}>
        Hide
      </Button>
    </span>
  );
}

function ItemRow({ view, ctx }: { view: ItemView; ctx: RowCtx }) {
  const shape = shapeOf(view.item);
  if (shape === 'steps') return <Steps view={view} ctx={ctx} />;
  if (shape === 'check') return <Check view={view} ctx={ctx} />;
  return <Counter view={view} ctx={ctx} />;
}

/** An ordered checklist: tap the step you are on; everything before it counts as done. */
function Steps({ view, ctx }: { view: ItemView; ctx: RowCtx }) {
  const { item, done } = view;
  const steps = item.steps ?? [];
  const finished = done !== null && done >= steps.length;
  const at = done === null || finished ? null : steps[done];
  const save = (n: number) => setBacklogDone(ctx.game.id, item.id, n);
  return (
    <div className={b.steps} role="group" aria-label={item.title}>
      <div className={b.stepsHead}>
        <span className={b.itemTitle}>
          {finished ? `You have finished ${item.title.toLowerCase()}` : at ? `You are at: ${at}` : item.title}
          {isExample(view, ctx) && <ExampleTag />}
        </span>
        <EditButtons view={view} ctx={ctx} />
      </div>
      <span className={b.muted}>Tap the step you are on: everything before it counts as done.</span>
      {done === null && (
        <span className={b.muted}>
          Where you are: <NoData dash={false} />
        </span>
      )}
      <ol className={b.stepList}>
        {steps.map((s, i) => {
          const state = done === null ? 'open' : i < done ? 'done' : i === done ? 'here' : 'open';
          return (
            <li key={`${i}-${s}`}>
              <button type="button" className={cx(b.step, state === 'done' && b.stepDone, state === 'here' && b.stepHere)} aria-pressed={state === 'here'} onClick={() => save(i)}>
                <span className={b.dot} aria-hidden="true">
                  {state === 'done' ? '✓' : state === 'here' ? '•' : ''}
                </span>
                <span className={b.stepText}>{s}</span>
                {state === 'here' && <span className={b.here}>you are here</span>}
              </button>
            </li>
          );
        })}
      </ol>
      <div className={b.stepsActions}>
        <Button onClick={() => save(steps.length)} aria-pressed={finished}>
          ✓ I’ve finished {item.title.toLowerCase()}
        </Button>
        <button type="button" className={b.link} onClick={() => save(0)}>
          Start of {item.title.toLowerCase()}
        </button>
      </div>
    </div>
  );
}

/** A single thing to do: one tick box. */
function Check({ view, ctx }: { view: ItemView; ctx: RowCtx }) {
  const { item } = view;
  const done = isDone(view);
  return (
    <div className={b.row}>
      <label className={b.check}>
        <input type="checkbox" checked={done} onChange={(e) => setBacklogDone(ctx.game.id, item.id, e.target.checked ? 1 : 0)} aria-label={`${item.title} done`} />
        <span className={b.rowText}>
          <span className={cx(b.itemTitle, done && b.struck)}>
            {item.title} {isExample(view, ctx) && <ExampleTag />}
          </span>
          {item.note && <span className={b.muted}>{item.note}</span>}
        </span>
      </label>
      <span className={b.rowEnd}>
        {view.done === null && <span className={b.muted}>not ticked yet</span>}
        <RewardLeft view={view} name={ctx.name} />
        <EditButtons view={view} ctx={ctx} />
      </span>
    </div>
  );
}

/** Something counted: − [done] / total +, with a bar and the reward still to get. */
function Counter({ view, ctx }: { view: ItemView; ctx: RowCtx }) {
  const { item, done } = view;
  const [draft, setDraft] = useState<string | null>(null);
  const unit = item.unit ?? '';
  const save = (n: number) => {
    setBacklogDone(ctx.game.id, item.id, Math.min(item.total, Math.max(0, Math.round(n))));
    setDraft(null);
  };
  const base = done ?? 0;
  const ratio = done === null ? null : Math.min(1, done / Math.max(1, item.total));
  return (
    <div className={b.counterRow}>
      <div className={b.row}>
        <span className={b.rowText}>
          <span className={b.itemTitle}>
            {item.title} {isExample(view, ctx) && <ExampleTag />}
          </span>
          <RewardLeft view={view} name={ctx.name} />
          {item.note && <span className={b.muted}>{item.note}</span>}
        </span>
        <span className={b.rowEnd}>
          <span className={b.stepper} role="group" aria-label={`Done for ${item.title}`}>
            <button type="button" className={b.stepBtn} aria-label={`One less done for ${item.title}`} disabled={base <= 0} onClick={() => save(base - 1)}>
              −
            </button>
            <input
              className={b.input}
              type="number"
              inputMode="numeric"
              min={0}
              max={item.total}
              value={draft ?? (done === null ? '' : String(done))}
              placeholder="–"
              aria-label={`Done for ${item.title}`}
              onChange={(e) => {
                setDraft(e.target.value);
                // An empty box clears your progress (back to "No data yet").
                if (e.target.value.trim() === '') return clearBacklogDone(ctx.game.id, item.id);
                const n = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(n)) setBacklogDone(ctx.game.id, item.id, Math.min(item.total, Math.max(0, n)));
              }}
              onBlur={() => setDraft(null)}
            />
            <span className={b.of}>
              / {formatNumber(item.total)}
              {unit}
              {item.reward !== null && item.reward > 0 && item.total === item.reward ? ` ${ctx.name(item.currency)}` : ''}
            </span>
            <button type="button" className={b.stepBtn} aria-label={`One more done for ${item.title}`} disabled={base >= item.total} onClick={() => save(base + 1)}>
              +
            </button>
          </span>
          <EditButtons view={view} ctx={ctx} />
        </span>
      </div>
      <div className={b.bar} role="progressbar" aria-label={`${item.title} done`} {...(ratio !== null ? { 'aria-valuenow': Math.round(ratio * 100), 'aria-valuemin': 0, 'aria-valuemax': 100 } : {})}>
        {ratio !== null && <div className={b.barFill} style={{ width: `${ratio * 100}%` }} />}
      </div>
    </div>
  );
}

/** "Still on the table": pulls from what you haven't done yet, in the categories that count. Real items only. */
function Summary({ game, cats, example, name, openCalculator }: { game: GameContract; cats: CategoryView[]; example: boolean; name: (id: string) => string; openCalculator: () => void }) {
  const est = estimate(game, cats);
  const none = cats.length === 0;
  const counted = Object.keys(est.counted).length > 0;
  const unknownCount = cats.filter((c) => c.enabled).reduce((a, c) => a + c.unknown.filter((v) => !isDone(v) && v.item.reward !== 0).length, 0);
  const notes: string[] = [];
  if (counted) notes.push(`≈ ${Object.entries(est.counted).map(([c, v]) => `${formatNumber(v)} ${name(c)}`).join(' · ')}`);
  notes.push('only what you haven’t done yet, in the categories that are switched on');
  if (est.offPulls > 0) notes.push(`switched off: about ${formatNumber(est.offPulls)} more pulls`);
  if (unknownCount > 0) notes.push(`${unknownCount} item${unknownCount === 1 ? '' : 's'} without data left out`);
  return (
    <section className={b.hero} aria-label="Still on the table">
      <span className={b.heroLabel}>Still on the table</span>
      <div className={b.heroMain}>
        {example ? (
          <span className={b.heroNote}>
            <NoData dash={false} /> Examples are never counted: add your own items, or change an example in Edit, and this fills in.
          </span>
        ) : none ? (
          <span className={b.heroNote}>
            <NoData dash={false} /> Add your own items in Edit and this fills in.
          </span>
        ) : !est.anyEnabled ? (
          <span className={b.heroNote}>All categories switched off</span>
        ) : counted ? (
          <>
            <span className={b.heroValue}>{formatNumber(est.pulls)}</span>
            <span className={b.heroUnit}>pulls of one-time rewards</span>
          </>
        ) : (
          <NoData />
        )}
      </div>
      {!example && !none && <span className={b.muted}>{notes.join(' · ')}</span>}
      <span className={b.heroAction}>
        <Button variant="primary" onClick={openCalculator}>
          Open calculator
        </Button>
      </span>
    </section>
  );
}

const SHAPES: { id: Shape; label: string; hint: string }[] = [
  { id: 'counter', label: 'Counter', hint: 'Something you count: points, chests, achievements, percent.' },
  { id: 'check', label: 'Tick box', hint: 'One thing that is either done or not, like a side quest.' },
  { id: 'steps', label: 'Checklist in order', hint: 'Steps one after another, like story chapters: you tap where you are.' },
];

/** The kind a new item in this category usually is. */
const defaultShape = (category: string): Shape => (category === 'story' ? 'steps' : category === 'side-quests' ? 'check' : 'counter');

const splitSteps = (text: string) =>
  text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

export interface ItemFormProps {
  game: GameContract;
  row: BacklogRow | null;
  category: string;
  categories: string[];
  rows: BacklogRow[];
  onDone: () => void;
}

/**
 * Add or change a backlog item. Built-in items keep only what you changed (on top of your
 * earlier changes); examples become your own item. Also used by Assistant → Edit lists.
 */
export function ItemForm({ game, row, category, categories: cats, rows, onDone }: ItemFormProps) {
  const uid = useId();
  const user = useGameData(game.id);
  const item: Partial<BacklogItem> = row?.item ?? {};
  const premium = game.currencies.find((c) => c.perPull && !c.paid)?.id ?? game.currencies[0]?.id ?? '';
  const [title, setTitle] = useState(item.title ?? '');
  const [cat, setCat] = useState(item.category ?? category);
  const [newCat, setNewCat] = useState('');
  const [shape, setShape] = useState<Shape>(row ? shapeOf(row.item) : defaultShape(category));
  const [shapePicked, setShapePicked] = useState(false);
  const [group, setGroup] = useState(item.group ?? '');
  const [total, setTotal] = useState(row && shapeOf(row.item) === 'counter' ? String(row.item.total) : '');
  const [percent, setPercent] = useState(item.unit === '%');
  const [steps, setSteps] = useState((item.steps ?? []).join('\n'));
  const [noReward, setNoReward] = useState(item.reward === 0);
  const [reward, setReward] = useState(item.reward === null || item.reward === undefined || item.reward === 0 ? '' : String(item.reward));
  const [currency, setCurrency] = useState(item.currency ?? premium);
  const [note, setNote] = useState(item.note ?? '');
  const [error, setError] = useState('');
  const f = (n: string) => `${uid}-${n}`;
  const groups = [...new Set(rows.filter((r) => r.item.category === cat && r.item.group).map((r) => r.item.group as string))];

  // Progress already on this item: yours, or the example's (which becomes yours when you save).
  const id = row?.item.id;
  const mineDone = id === undefined ? undefined : user.backlog[id];
  const exampleDone = row?.origin === 'example' && id !== undefined ? exampleBacklog(game).done[id] : undefined;
  const prior = mineDone ?? exampleDone;
  const kindChanged = row !== null && (shape !== shapeOf(row.item) || (shape === 'counter' && percent !== (row.item.unit === '%')));
  const newTotal = shape === 'steps' ? splitSteps(steps).length : shape === 'check' ? 1 : percent ? 100 : Number(total);
  const of = row ? ` of ${formatNumber(row.item.total)}` : '';
  const progressNote =
    prior === undefined
      ? ''
      : kindChanged
        ? `Changing the kind clears its ${mineDone === undefined ? 'example ' : ''}progress (${formatNumber(prior)}${of}). Enter yours again after saving.`
        : Number.isInteger(newTotal) && newTotal >= 1 && prior > newTotal
          ? `Its progress (${formatNumber(prior)}) is more than the new total, so it will be set to ${formatNumber(newTotal)}.`
          : mineDone === undefined
            ? `Its example progress (${formatNumber(prior)}${of}) becomes yours when you save. You can change it any time.`
            : '';

  const pickCategory = (c: string) => {
    setCat(c);
    // A new item takes the usual kind for its category, unless you picked one yourself.
    if (!row && !shapePicked) setShape(defaultShape(c));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const category = cat === '__new' ? newCat.trim().toLowerCase().replace(/\s+/g, '-') : cat;
    if (!title.trim()) return setError('Give it a name.');
    if (!category) return setError('Name the new category.');
    const rewardNum = noReward ? 0 : reward.trim() === '' ? null : Number(reward);
    if (rewardNum !== null && (!Number.isFinite(rewardNum) || rewardNum < 0)) return setError('The reward must be a number (or empty if you don’t know it).');
    let fields: Partial<BacklogItem> = { title: title.trim(), category, reward: rewardNum, currency };
    if (shape === 'steps') {
      const list = splitSteps(steps);
      if (list.length < 1) return setError('Write the steps, one per line.');
      fields = { ...fields, steps: list, total: list.length };
    } else if (shape === 'check') {
      fields = { ...fields, total: 1, steps: [] };
    } else {
      const t = percent ? 100 : Number(total);
      if (!Number.isInteger(t) || t < 1) return setError('How much there is to do must be a whole number of 1 or more.');
      fields = { ...fields, total: t, steps: [] };
    }
    fields.group = group.trim();
    fields.note = note.trim();
    fields.unit = shape === 'counter' && percent ? '%' : '';
    const at = new Date().toISOString();
    const hidden = row?.hidden ?? false;
    if (row && (row.origin === 'built-in' || row.origin === 'changed')) {
      // A built-in item: keep only what you actually changed, on top of your earlier changes and the list's version.
      const base = row.item as unknown as Record<string, unknown>;
      const empty = (v: unknown) => v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
      const changed = Object.fromEntries(Object.entries(fields).filter(([k, v]) => !(empty(v) && empty(base[k])) && JSON.stringify(base[k]) !== JSON.stringify(v))) as Partial<BacklogItem>;
      const before = gameData(game.id).ownItems.backlog[row.item.id]?.fields ?? {};
      if (Object.keys(changed).length > 0) saveOwnItem(game.id, 'backlog', { id: row.item.id, mine: false, fields: { ...before, ...changed }, hidden, at });
    } else {
      // Your own item, a new one, or an example you changed (it becomes yours, same id, so your progress stays).
      saveOwnItem(game.id, 'backlog', { id: row?.item.id ?? newOwnId(Date.now()), mine: true, fields, hidden, at });
    }
    if (id !== undefined && prior !== undefined && fields.total !== undefined) {
      if (kindChanged) {
        if (mineDone !== undefined) clearBacklogDone(game.id, id);
      } else if (prior > fields.total) setBacklogDone(game.id, id, fields.total);
      else if (mineDone === undefined) setBacklogDone(game.id, id, prior);
    }
    onDone();
  };

  return (
    <form className={b.form} onSubmit={submit} aria-label={row ? `Change ${row.item.title}` : 'Add a backlog item'}>
      {row?.origin === 'example' && <p className={b.muted}>This is an example. Saving makes it your own item; the example badge goes away.</p>}
      {row && (row.origin === 'built-in' || row.origin === 'changed') && <p className={b.muted}>A built-in item: your changes sit on top, and list updates never undo them.</p>}
      <label className={b.field} htmlFor={f('title')}>
        Name
        <input id={f('title')} className={b.textInput} value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" />
      </label>
      <label className={b.field} htmlFor={f('cat')}>
        Category
        <select id={f('cat')} className={b.textInput} value={cat} onChange={(e) => pickCategory(e.target.value)}>
          {[...new Set([...cats, cat])]
            .filter((c) => c !== '__new')
            .map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          <option value="__new">New category…</option>
        </select>
      </label>
      {cat === '__new' && (
        <label className={b.field} htmlFor={f('newcat')}>
          New category name
          <input id={f('newcat')} className={b.textInput} value={newCat} onChange={(e) => setNewCat(e.target.value)} autoComplete="off" />
        </label>
      )}
      <fieldset className={b.fieldset}>
        <legend>Kind</legend>
        {SHAPES.map((s) => (
          <label key={s.id} className={b.radio}>
            <input
              type="radio"
              name={f('shape')}
              checked={shape === s.id}
              onChange={() => {
                setShape(s.id);
                setShapePicked(true);
              }}
            />
            <span>
              {s.label} <small className={b.muted}>{s.hint}</small>
            </span>
          </label>
        ))}
      </fieldset>
      {shape === 'counter' && (
        <>
          <label className={b.radio}>
            <input type="checkbox" checked={percent} onChange={(e) => setPercent(e.target.checked)} />
            <span>Counted in percent (0–100%)</span>
          </label>
          {!percent && (
            <label className={b.field} htmlFor={f('total')}>
              How much there is in total
              <input id={f('total')} className={b.textInput} inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} />
            </label>
          )}
        </>
      )}
      {shape === 'steps' && (
        <label className={b.field} htmlFor={f('steps')}>
          Steps, one per line, in order
          <textarea id={f('steps')} className={b.textInput} rows={6} value={steps} onChange={(e) => setSteps(e.target.value)} />
        </label>
      )}
      <label className={b.field} htmlFor={f('group')}>
        Group (optional, e.g. a region)
        <input id={f('group')} className={b.textInput} value={group} onChange={(e) => setGroup(e.target.value)} list={f('groups')} autoComplete="off" />
        <datalist id={f('groups')}>
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </label>
      <label className={b.radio}>
        <input type="checkbox" checked={noReward} onChange={(e) => setNoReward(e.target.checked)} />
        <span>Gives no reward (a checklist only)</span>
      </label>
      {!noReward && (
        <div className={b.formRow}>
          <label className={b.field} htmlFor={f('reward')}>
            Reward for all of it (empty = unknown)
            <input id={f('reward')} className={b.textInput} inputMode="numeric" value={reward} onChange={(e) => setReward(e.target.value)} />
          </label>
          <label className={b.field} htmlFor={f('cur')}>
            Currency
            <select id={f('cur')} className={b.textInput} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {game.currencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <label className={b.field} htmlFor={f('note')}>
        Note (optional)
        <input id={f('note')} className={b.textInput} value={note} onChange={(e) => setNote(e.target.value)} autoComplete="off" />
      </label>
      {progressNote && (
        <p className={b.muted} role="status">
          {progressNote}
        </p>
      )}
      {error && (
        <p className={b.error} role="alert">
          {error}
        </p>
      )}
      <div className={b.formActions}>
        <Button onClick={onDone}>Cancel</Button>
        <Button variant="primary" type="submit">
          {row ? 'Save change' : 'Add item'}
        </Button>
      </div>
    </form>
  );
}
