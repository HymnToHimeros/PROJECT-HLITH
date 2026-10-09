import { useState, type CSSProperties } from 'react';
import type { BacklogItem, GameContract } from '../../core/contract';
import { known, unknown } from '../../core/contract/known';
import { setBacklogCategory, setBacklogDone } from '../../core/data/userData';
import { formatNumber } from '../../core/time/format';
import { Button, ExampleTag, NoData, ProgressBar } from '../../core/ui';
import { Switch } from '../pulls/shared';
import { cx } from '../../core/ui/cx';
import { categories, estimate, pullsOf, type BacklogEstimate, type CategoryView, type ItemView } from './backlog';
import b from './backlog.module.css';
import type { BacklogData } from './useBacklogData';

interface Props {
  game: GameContract;
  data: BacklogData;
  openCalculator: () => void;
}

/**
 * Backlog (R30, design: one card of category rows with a bar, done / total,
 * pulls left and a switch; then "Backlog could add"). Open a category to see
 * its items and set how much you have done. Each switch says whether that
 * category's rewards count toward pulls (the same switch is in the Calculator).
 */
export function Backlog({ game, data, openCalculator }: Props) {
  const cats = categories(game, data.items.list, data.user, data.items.exampleDone);
  const est = estimate(game, cats);
  const name = (id: string) => game.currencies.find((c) => c.id === id)?.name ?? id;
  return (
    <div className={b.stack} style={{ '--vent': game.vent } as CSSProperties}>
      <div className={b.cats}>
        {cats.map((c, i) => (
          <Category key={c.id} game={game} cat={c} example={data.items.example} name={name} firstId={i === 0 ? `backlog-first-${game.id}` : undefined} />
        ))}
      </div>
      <Summary est={est} example={data.items.example} name={name} unknownCount={cats.filter((c) => c.enabled).reduce((a, c) => a + c.unknown.length, 0)} openCalculator={openCalculator} />
    </div>
  );
}

/** "840 Gem · 12 Ticket": numbers in the number font, currency names in words. */
const amounts = (left: Record<string, number>, name: (id: string) => string) =>
  Object.entries(left).map(([c, v], i) => (
    <span key={c}>
      {i > 0 && ' · '}
      <strong className={b.num}>{formatNumber(v)}</strong> {name(c)}
    </span>
  ));

function Category({ game, cat, example, name, firstId }: { game: GameContract; cat: CategoryView; example: boolean; name: (id: string) => string; firstId: string | undefined }) {
  // The first category starts open, so its items (and "Edit") are right there.
  const [open, setOpen] = useState(firstId !== undefined);
  const known = cat.items.filter((v) => v.done !== null);
  const finished = known.filter((v) => v.done !== null && v.done >= v.item.total).length;
  const ratio = known.length ? known.reduce((a, v) => a + Math.min(1, (v.done ?? 0) / Math.max(1, v.item.total)), 0) / cat.items.length : null;
  const single = cat.items.length === 1 ? cat.items[0] : undefined;
  const hasLeft = Object.keys(cat.rewardLeft).length > 0;
  const pulls = pullsOf(game, cat.rewardLeft);
  const value = known.length === 0 ? null : single && single.done !== null ? `${formatNumber(single.done)}/${formatNumber(single.item.total)}` : `${finished} of ${cat.items.length} finished`;
  const listId = `backlog-${game.id}-${cat.id}`;
  return (
    <section className={cx(b.cat, !cat.enabled && b.off)} aria-label={cat.label}>
      <div className={b.catRow}>
        <div className={b.catMain}>
          <h3 className={b.catTitle}>
            <button type="button" className={b.catToggle} aria-expanded={open} aria-controls={listId} onClick={() => setOpen((x) => !x)}>
              {cat.label}
            </button>
            {example && <ExampleTag />}
          </h3>
          <div className={b.barLine}>
            <div className={b.bar} role="progressbar" aria-label={`${cat.label} done`} {...(ratio !== null ? { 'aria-valuenow': Math.round(ratio * 100), 'aria-valuemin': 0, 'aria-valuemax': 100 } : {})}>
              {ratio !== null && <div className={b.barFill} style={{ width: `${ratio * 100}%` }} />}
            </div>
            <span className={b.barValue}>{value ?? <NoData dash={false} />}</span>
          </div>
        </div>
        <div className={b.catReward}>
          {hasLeft ? (
            <>
              <span className={cx(b.pullsLeft, !cat.enabled && b.dimmed)}>+{formatNumber(pulls)} pulls left</span>
              <span className={b.amount}>{amounts(cat.rewardLeft, name)}</span>
            </>
          ) : (
            <button type="button" className={b.fix} onClick={() => setOpen(true)}>
              Enter progress
            </button>
          )}
        </div>
        <span className={b.switchBox}>
          <Switch checked={cat.enabled} onChange={(on) => setBacklogCategory(game.id, cat.id, on)} label={`Count ${cat.label} toward pulls`} />
        </span>
      </div>
      {!cat.enabled && <p className={b.muted}>Not counted toward pulls.</p>}
      {cat.covers.length > 0 && cat.enabled && <p className={b.muted}>While this is on, it also covers {cat.covers.map((r) => `“${r.label}”`).join(', ')} in Pulls, so nothing is counted twice.</p>}
      <ul id={listId} className={b.items} hidden={!open}>
        {cat.items.map((v, i) => (
          <Item key={v.item.id} game={game} view={v} example={example} name={name} id={i === 0 ? firstId : undefined} />
        ))}
      </ul>
    </section>
  );
}

function Item({ game, view, example, name, id }: { game: GameContract; view: ItemView; example: boolean; name: (id: string) => string; id: string | undefined }) {
  const [editing, setEditing] = useState(false);
  const { item, done } = view;
  return (
    <li className={b.item}>
      {/* Tap anywhere on the row to edit the done count. */}
      <div className={b.itemRow} onClick={() => setEditing(true)}>
        <div className={b.itemMain}>
          <ProgressBar label={item.title} value={done === null ? unknown('enter-manually') : known({ done, total: item.total }, 'user')} onFix={() => setEditing(true)} />
        </div>
        <div className={b.itemReward}>
          <ItemReward view={view} name={name} />
          {(example || view.doneExample) && <ExampleTag />}
        </div>
        <Button
          id={id}
          className={b.edit}
          aria-expanded={editing}
          aria-label={`${editing ? 'Close' : 'Edit'} done count for ${item.title}`}
          onClick={(e) => {
            e.stopPropagation();
            setEditing((x) => !x);
          }}
        >
          {editing ? 'Close' : 'Edit'}
        </Button>
      </div>
      {editing && <DoneEditor game={game} item={item} done={done} />}
    </li>
  );
}

function ItemReward({ view, name }: { view: ItemView; name: (id: string) => string }) {
  if (view.item.reward === null)
    return (
      <span>
        Reward <NoData dash={false} />
      </span>
    );
  if (view.rewardLeft === null) return <span className={b.muted}>{formatNumber(view.item.reward)} in all · enter your progress</span>;
  if (view.rewardLeft === 0) return <span className={b.muted}>All collected</span>;
  return (
    <span>
      <strong className={b.num}>{formatNumber(view.rewardLeft)}</strong> {name(view.item.currency)} left
    </span>
  );
}

function DoneEditor({ game, item, done }: { game: GameContract; item: BacklogItem; done: number | null }) {
  const [draft, setDraft] = useState(done === null ? '' : String(done));
  const save = (n: number) => {
    const v = Math.min(item.total, Math.max(0, Math.round(n)));
    setBacklogDone(game.id, item.id, v);
    setDraft(String(v));
  };
  const current = Number.parseInt(draft, 10);
  const base = Number.isFinite(current) ? current : (done ?? 0);
  return (
    <div className={b.editor} role="group" aria-label={`Done count for ${item.title}`}>
      <span className={b.editorLabel}>Done</span>
      <Button className={b.step} aria-label={`One less done for ${item.title}`} disabled={base <= 0} onClick={() => save(base - 1)}>
        −
      </Button>
      <input
        className={b.input}
        type="number"
        inputMode="numeric"
        min={0}
        max={item.total}
        value={draft}
        placeholder="0"
        aria-label={`Done for ${item.title}`}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number.parseInt(e.target.value, 10);
          if (Number.isFinite(n)) save(n);
        }}
      />
      <Button className={b.step} aria-label={`One more done for ${item.title}`} disabled={base >= item.total} onClick={() => save(base + 1)}>
        +
      </Button>
      <span className={b.muted}>of {formatNumber(item.total)}</span>
      <span className={b.editorEnd}>
        <Button className={b.step} onClick={() => save(item.total)}>
          All done
        </Button>
      </span>
    </div>
  );
}

function Summary({
  est,
  example,
  name,
  unknownCount,
  openCalculator,
}: {
  est: BacklogEstimate;
  example: boolean;
  name: (id: string) => string;
  unknownCount: number;
  openCalculator: () => void;
}) {
  const counted = Object.keys(est.counted).length > 0;
  const notes: string[] = [];
  if (counted) notes.push(`${Object.entries(est.counted).map(([c, v]) => `${formatNumber(v)} ${name(c)}`).join(' · ')} left in the categories that count`);
  if (!est.anyEnabled) notes.push('Every category is switched off, so nothing is counted.');
  if (est.offPulls > 0) notes.push(`switched off: about ${formatNumber(est.offPulls)} more pulls`);
  if (unknownCount > 0) notes.push(`${unknownCount} item${unknownCount === 1 ? '' : 's'} without data left out`);
  return (
    <section className={cx(b.card, b.summary)} aria-label="Backlog could add">
      <div className={b.sumText}>
        <span className={b.sumLabel}>Backlog could add about</span>
        <span className={b.muted}>{notes.join(' · ')}</span>
      </div>
      <div className={b.sumFigure}>
        {counted || !est.anyEnabled ? (
          <>
            <span className={b.sumValue}>+{formatNumber(counted ? est.pulls : 0)}</span>
            <span className={b.muted}>pulls</span>
            {example && counted && <ExampleTag />}
          </>
        ) : (
          <NoData />
        )}
      </div>
      <Button variant="primary" onClick={openCalculator}>
        Open calculator
      </Button>
    </section>
  );
}
