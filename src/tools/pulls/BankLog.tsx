import { useState, type FormEvent } from 'react';
import type { GameContract } from '../../core/contract';
import { useExamplesShown } from '../../core/data/prefs';
import { addLedgerEntry, reverseLedgerEntry, type LedgerEntry } from '../../core/data/userData';
import { formatNumber } from '../../core/time/format';
import { formatDateTime } from '../../core/time/reset';
import { Button, EmptyState, ExampleTag } from '../../core/ui';
import { cx } from '../../core/ui/cx';
import { EmptyTile, Filters, Tile } from './shared';
import k from './kit.module.css';
import p from './pulls.module.css';
import type { PullsData } from './usePullsData';

const KIND_LABEL: Record<LedgerEntry['kind'], string> = {
  have: 'Balance check',
  earned: 'Earned',
  bought: 'Bought',
  spent: 'Spent',
};
const KIND_HINT: Record<LedgerEntry['kind'], string> = {
  have: 'What the game shows right now. This sets your balance.',
  earned: 'Free currency you got (dailies, events, endgame).',
  bought: 'Currency you paid real money for.',
  spent: 'Currency you used, e.g. on pulls.',
};

const DAY = 86_400_000;

/**
 * Bank log (design: ENTRY · CHANGE · BALANCE table): an add-only ledger. Your
 * balance = latest balance check + changes since. V1 features: balance check /
 * earned / bought / spent, every currency in one go, a date and a note, and
 * all-time totals. Entries are never edited or removed: Undo adds a correcting
 * entry, and the pair stops counting (the same rule as balances() in userData).
 */
export function BankLog({ game, data }: { game: GameContract; data: PullsData }) {
  const currencies = game.currencies;
  const showExamples = useExamplesShown();
  const [kind, setKind] = useState<LedgerEntry['kind']>('have');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const name = (id: string) => currencies.find((c) => c.id === id)?.name ?? id;
  const premium = currencies.find((c) => c.perPull && !c.paid);
  const today = new Date().toLocaleDateString('en-CA');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const check = readForm(currencies, amounts, date, today);
    if (!check.ok) return setProblem(check.problem);
    // Today (or no date) = right now; an earlier day = midday that day.
    const at = date && date !== today ? new Date(`${date}T12:00:00`).toISOString() : new Date().toISOString();
    for (const [currency, amount] of check.values) addLedgerEntry(game.id, { at, currency, kind, amount, ...(note.trim() ? { note: note.trim() } : {}) });
    setProblem(null);
    setAmounts({});
    setNote('');
  };

  const real = data.user.ledger;
  // Example rows only while examples are shown (Account → Example data).
  const example = real.length === 0 && showExamples;
  const entries = example ? exampleLedger(game) : real;
  const rows = withBalances(entries).reverse();
  const undone = undoneIds(real);
  const counted = real.filter((x) => !undone.has(x.id));
  const sum = (kindOf: LedgerEntry['kind']) => counted.filter((x) => x.kind === kindOf && x.currency === premium?.id).reduce((a, x) => a + x.amount, 0);
  const count = (kindOf: LedgerEntry['kind']) => counted.filter((x) => x.kind === kindOf).length;
  const labelOf = (x: LedgerEntry) => x.note ?? KIND_LABEL[x.kind];

  return (
    <div className={p.stack}>
      <section className={p.card} aria-label="Add to your bank log">
        <h3 className={p.cardTitle}>Add to your bank log</h3>
        <form className={p.stack} onSubmit={submit} noValidate>
          <Filters label="Kind of entry" value={kind} onChange={setKind} options={(Object.keys(KIND_LABEL) as LedgerEntry['kind'][]).map((id) => ({ id, label: KIND_LABEL[id] }))} />
          <span className={p.muted}>{KIND_HINT[kind]}</span>
          <div className={p.form}>
            {currencies.map((c, i) => (
              <label key={c.id} className={p.field}>
                {c.name}
                <input
                  id={i === 0 ? `bank-amount-${game.id}` : undefined}
                  className={p.input}
                  inputMode="numeric"
                  value={amounts[c.id] ?? ''}
                  onChange={(e) => setAmounts((a) => ({ ...a, [c.id]: e.target.value }))}
                  placeholder={c.id === premium?.id || (i === 0 && !premium) ? 'e.g. 8400' : 'e.g. 12'}
                />
              </label>
            ))}
            <label className={p.field}>
              Date
              <input className={p.input} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className={cx(p.field, p.grow)}>
              Note (optional)
              <input className={p.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 10 pulls · featured banner" />
            </label>
            <Button variant="primary" type="submit">
              Add entry
            </Button>
          </div>
          {problem && (
            <span className={p.error} role="alert">
              {problem}
            </span>
          )}
          <span className={p.muted}>Fill in only the currencies you want to log. Empty date = now. Made a mistake? Press Undo on that entry: it stays in the log, marked undone, and stops counting.</span>
        </form>
      </section>

      <div className={k.tiles}>
        {counted.length === 0 ? (
          <>
            <EmptyTile label="Earned for free" why="add entries" />
            <EmptyTile label="Bought" why="add entries" />
            <EmptyTile label="Spent" why="add entries" />
          </>
        ) : (
          <>
            <Tile label="Earned for free" value={formatNumber(sum('earned'))} caption={`${premium?.name ?? ''} · ${count('earned')} entries`} />
            <Tile label="Bought" value={formatNumber(sum('bought'))} caption={`${premium?.name ?? ''} · ${count('bought')} entries`} />
            <Tile label="Spent" value={formatNumber(sum('spent'))} caption={`${premium?.name ?? ''} · ${count('spent')} entries`} />
          </>
        )}
        {/* V1 kept money paid. Entries have no money field yet, so this stays empty rather than guessed. */}
        <EmptyTile label="Money paid" why="money amounts aren't logged yet" />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No entries yet" body="Your bank log is empty. Type what the game shows above and press Add entry: that becomes your bank." />
      ) : (
        <section className={p.ledger} aria-label="Bank log entries">
          <div className={p.ledgerHead} aria-hidden="true">
            <span>ENTRY</span>
            <span className={p.right}>CHANGE</span>
            <span className={p.right}>BALANCE</span>
          </div>
          <ul className={p.ledgerList}>
            {rows.map((r) => {
              const original = r.entry.reverses ? entries.find((x) => x.id === r.entry.reverses) : undefined;
              const when = formatDateTime(Date.parse(r.entry.at));
              return (
                <li key={r.entry.id} className={cx(p.ledgerRow, r.state === 'undone' && p.undone)}>
                  <div className={p.ledgerMain}>
                    <span className={p.rowLabel}>
                      <span className={p.entryName}>{r.state === 'undo' ? `Undo: ${original ? labelOf(original) : KIND_LABEL[r.entry.kind]}` : labelOf(r.entry)}</span> {example && <ExampleTag />}
                      {r.state === 'undone' && <span className={p.undoneTag}>UNDONE</span>}
                    </span>
                    <span className={p.small}>
                      {when} · {name(r.entry.currency)}
                      {r.state === 'undo' ? ' · cancels that entry; neither counts' : r.entry.note ? ` · ${KIND_LABEL[r.entry.kind]}` : ''}
                    </span>
                    {r.state === 'counted' && !example && (
                      <button type="button" className={p.linkButton} aria-label={`Undo ${labelOf(r.entry)}, ${when}`} onClick={() => reverseLedgerEntry(game.id, r.entry.id, new Date().toISOString())}>
                        Undo
                      </button>
                    )}
                  </div>
                  <span className={cx(p.change, r.state === 'counted' && (r.entry.kind === 'earned' || r.entry.kind === 'bought') && p.plus)}>
                    <span className={p.srOnly}>{r.state === 'counted' ? 'Change: ' : 'Not counted: '}</span>
                    {r.state === 'undo' ? '0' : `${r.entry.kind === 'have' ? '=' : r.entry.kind === 'spent' ? '−' : '+'}${formatNumber(r.entry.amount)}`}
                  </span>
                  <span className={p.balance}>
                    <span className={p.srOnly}>Balance: </span>
                    {r.balance === null ? '—' : formatNumber(r.balance)}
                  </span>
                </li>
              );
            })}
          </ul>
          {example && <span className={p.muted}>These entries are examples. Your first entry replaces them.</span>}
        </section>
      )}
    </div>
  );
}

/** Entries that don't count: every undone entry and every Undo entry (as in balances() in userData). */
function undoneIds(entries: LedgerEntry[]): Set<string> {
  const out = new Set<string>();
  for (const e of entries) {
    if (!e.reverses) continue;
    out.add(e.id);
    out.add(e.reverses);
  }
  return out;
}

export type RowState = 'counted' | 'undone' | 'undo';

/**
 * Each entry with the balance of its currency right after it (unknown until the
 * first balance check). Undone entries and their Undo entries are listed but
 * skipped, so the balance matches balances() in userData.
 */
export function withBalances(entries: LedgerEntry[]): { entry: LedgerEntry; balance: number | null; state: RowState }[] {
  const skip = undoneIds(entries);
  const sorted = [...entries].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const bal: Record<string, number> = {};
  return sorted.map((entry) => {
    const state: RowState = entry.reverses ? 'undo' : skip.has(entry.id) ? 'undone' : 'counted';
    if (state === 'counted') {
      if (entry.kind === 'have') bal[entry.currency] = entry.amount;
      else if (entry.currency in bal) bal[entry.currency] = (bal[entry.currency] ?? 0) + (entry.kind === 'spent' ? -entry.amount : entry.amount);
    }
    return { entry, state, balance: entry.currency in bal ? (bal[entry.currency] ?? null) : null };
  });
}

/**
 * Checks the form before anything is saved: amounts must be whole numbers
 * (spaces and thousands separators are fine), at least one must be filled in,
 * and the date can't be in the future. Nothing is cleared when there is a problem.
 */
export function readForm(
  currencies: GameContract['currencies'],
  amounts: Record<string, string>,
  date: string,
  today: string,
): { ok: true; values: [string, number][] } | { ok: false; problem: string } {
  if (date && date > today) return { ok: false, problem: 'That date is in the future. Pick today or an earlier day.' };
  const values: [string, number][] = [];
  const bad: string[] = [];
  for (const c of currencies) {
    const typed = amounts[c.id]?.trim() ?? '';
    if (!typed) continue;
    const raw = typed.replace(/[\s,.’']/g, '');
    if (!/^\d+$/.test(raw)) bad.push(`“${typed}” for ${c.name}`);
    else values.push([c.id, Number(raw)]);
  }
  if (bad.length) return { ok: false, problem: `${bad.join(' and ')} isn’t a whole number. Type digits only, for example 8400.` };
  if (values.length === 0) return { ok: false, problem: 'Type at least one amount first, for example what the game shows for your currency.' };
  return { ok: true, values };
}

/** Example entries that end at the example balance (8,400 premium, 12 pull items). Shown, never saved. */
function exampleLedger(game: GameContract): LedgerEntry[] {
  const premium = game.currencies.find((c) => c.perPull && !c.paid);
  const item = game.currencies.find((c) => c.pullItemFor && c.pullItemFor.length > 0);
  const now = Date.now();
  const at = (days: number) => new Date(now - days * DAY).toISOString();
  const out: LedgerEntry[] = [];
  if (premium) {
    out.push(
      { id: 'example-1', at: at(6), currency: premium.id, kind: 'have', amount: 8_600, note: 'Balance check' },
      { id: 'example-2', at: at(5), currency: premium.id, kind: 'earned', amount: 60, note: 'Daily mission' },
      { id: 'example-3', at: at(4), currency: premium.id, kind: 'earned', amount: 800, note: 'Endgame clear' },
      { id: 'example-4', at: at(3), currency: premium.id, kind: 'spent', amount: 1_600, note: '10 pulls · featured banner' },
      { id: 'example-5', at: at(2), currency: premium.id, kind: 'earned', amount: 420, note: 'Event reward' },
      { id: 'example-6', at: at(1), currency: premium.id, kind: 'earned', amount: 60, note: 'Daily mission' },
      { id: 'example-7', at: at(0.2), currency: premium.id, kind: 'earned', amount: 60, note: 'Daily mission' },
    );
  }
  if (item) out.push({ id: 'example-8', at: at(6), currency: item.id, kind: 'have', amount: 12, note: 'Balance check' });
  return out;
}
