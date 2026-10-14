import { useState, type FormEvent } from 'react';
import type { Currency, GameContract } from '../../core/contract';
import { useExamplesShown } from '../../core/data/prefs';
import { addLedgerEntry, reverseLedgerEntry, type LedgerEntry } from '../../core/data/userData';
import { formatNumber } from '../../core/time/format';
import { formatDateTime, formatDay, formatTime } from '../../core/time/reset';
import { Button, EmptyState, ExampleTag } from '../../core/ui';
import { cx } from '../../core/ui/cx';
import { flowTotals, groupLines, groupPulls, withBalances, type Flow, type FlowTotal, type LogGroup, type LogLine } from './bankLog';
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
  have: 'What the game shows right now. This sets your balance: a rise since the balance HLITH expected counts as Earned, a drop as Spent.',
  earned: 'Free currency you got (dailies, events, endgame).',
  bought: 'Currency you paid real money for. It adds to your balance now, so the next balance check doesn’t count it as Earned too.',
  spent: 'Currency you used, e.g. on pulls.',
};

const DAY = 86_400_000;

/**
 * Bank log (design: ENTRY · CHANGE · BALANCE table): an add-only ledger. Your
 * balance = latest balance check + changes since. V1 features: balance check /
 * earned / bought / spent, every currency in one go, a date and a note, and
 * all-time totals. Entries saved together show as one entry under their day;
 * a balance check shows its change from the expected balance, which counts as
 * Earned or Spent (bankLog.ts). Entries are never edited or removed: Undo adds
 * a correcting entry, and the pair stops counting (the same rule as balances()
 * in userData).
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
  const groups = groupLines(withBalances(entries), currencies);
  const totals = flowTotals(example ? [] : groups, currencies);
  const anyCounted = !example && groups.some((g) => g.state === 'counted' || g.state === 'partly');
  const days = byDay(groups);
  const labelOf = (g: LogGroup) => g.note ?? KIND_LABEL[g.kind];
  // Undo on a group cancels every currency in it that still counts.
  const undoGroup = (g: LogGroup) => {
    const at = new Date().toISOString();
    for (const l of g.lines) if (l.state === 'counted') reverseLedgerEntry(game.id, l.entry.id, at);
  };

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
        {!anyCounted ? (
          <>
            <EmptyTile label="Earned for free" why="add entries" />
            <EmptyTile label="Bought" why="add entries" />
            <EmptyTile label="Spent" why="add entries" />
          </>
        ) : (
          FLOWS.map((flow) => <FlowTile key={flow} flow={flow} total={totals[flow]} currencies={currencies} premium={premium} />)
        )}
        {/* V1 kept money paid. Entries have no money field yet, so this stays empty rather than guessed. */}
        <EmptyTile label="Money paid" why="money amounts aren't logged yet" />
      </div>

      {groups.length === 0 ? (
        <EmptyState title="No entries yet" body="Your bank log is empty. Type what the game shows above and press Add entry: that becomes your bank." />
      ) : (
        <section className={p.ledger} aria-label="Bank log entries">
          <div className={p.ledgerHead} aria-hidden="true">
            <span>ENTRY</span>
            <span className={p.right}>CHANGE</span>
            <span className={p.right}>BALANCE</span>
          </div>
          {days.map((day) => (
            <div key={day.key} role="group" aria-label={day.label}>
              <h4 className={p.ledgerDay}>{day.label}</h4>
              <ul className={p.ledgerList}>
                {day.groups.map((g) => {
                  const first = g.lines[0]?.entry;
                  const original = g.state === 'undo' && first?.reverses ? entries.find((x) => x.id === first.reverses) : undefined;
                  const label = g.state === 'undo' ? `Undo: ${original?.note ?? KIND_LABEL[g.kind]}` : labelOf(g);
                  const pulls = g.state === 'undo' ? null : groupPulls(g, currencies);
                  const says = g.kind === 'have' && g.state !== 'undo' ? fromCheckText(g, name) : null;
                  return (
                    <li key={g.key} className={cx(p.ledgerGroup, g.state === 'undone' && p.undone)}>
                      <div className={p.ledgerRow}>
                        <div className={p.ledgerMain}>
                          <span className={p.rowLabel}>
                            <span className={p.entryName}>{label}</span> {example && <ExampleTag />}
                            {g.state === 'undone' && <span className={p.undoneTag}>UNDONE</span>}
                            {g.state === 'partly' && <span className={p.undoneTag}>PARTLY UNDONE</span>}
                          </span>
                          <span className={p.small}>
                            {formatTime(Date.parse(g.at))}
                            {g.state === 'undo' ? ' · cancels that entry; neither counts' : g.note ? ` · ${KIND_LABEL[g.kind]}` : ''}
                          </span>
                          {says && <span className={p.fromCheck}>{says}</span>}
                          {(g.state === 'counted' || g.state === 'partly') && !example && (
                            <button type="button" className={p.linkButton} aria-label={`Undo ${labelOf(g)}, ${formatDateTime(Date.parse(g.at))}`} onClick={() => undoGroup(g)}>
                              Undo
                            </button>
                          )}
                        </div>
                        <span className={cx(p.groupPulls, pulls !== null && pulls > 0 && g.state !== 'undone' && p.plus)}>{pulls ? `≈ ${signed(pulls, 1)} pulls` : ''}</span>
                        <span aria-hidden="true" />
                      </div>
                      {g.lines.map((l) => (
                        <div key={l.entry.id} className={cx(p.ledgerLine, l.state === 'undone' && g.state !== 'undone' && p.undone)}>
                          <span className={p.lineName}>{name(l.entry.currency)}</span>
                          <span className={cx(p.change, l.state === 'counted' && l.change !== null && l.change > 0 && p.plus)}>
                            <span className={p.srOnly}>{l.state === 'counted' ? 'Change: ' : 'Not counted: '}</span>
                            {changeText(l)}
                          </span>
                          <span className={p.balance}>
                            <span className={p.srOnly}>Balance: </span>
                            {l.balance === null ? '—' : formatNumber(l.balance)}
                          </span>
                        </div>
                      ))}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {example && <span className={p.muted}>These entries are examples. Your first entry replaces them.</span>}
        </section>
      )}
    </div>
  );
}

const FLOWS: Flow[] = ['earned', 'bought', 'spent'];
const FLOW_LABEL: Record<Flow, string> = { earned: 'Earned for free', bought: 'Bought', spent: 'Spent' };

/** One total: the premium currency big; other currencies, pulls and where it comes from below. */
function FlowTile({ flow, total, currencies, premium }: { flow: Flow; total: FlowTotal; currencies: Currency[]; premium: Currency | undefined }) {
  const others = currencies.filter((c) => c.id !== premium?.id && total.amounts[c.id]).map((c) => `${formatNumber(total.amounts[c.id] ?? 0)} ${c.name}`);
  const from = [total.logged || !total.fromChecks ? plural(total.logged, 'entry', 'entries') : '', total.fromChecks ? `${total.logged ? '' : 'from '}${plural(total.fromChecks, 'balance check', 'balance checks')}` : ''].filter(Boolean).join(' + ');
  return (
    <Tile
      label={FLOW_LABEL[flow]}
      value={formatNumber(total.amounts[premium?.id ?? ''] ?? 0)}
      caption={
        <>
          {premium?.name}
          {others.length ? ` + ${others.join(', ')}` : ''}
          <br />
          {total.pulls ? `≈ ${formatNumber(round1(total.pulls))} pulls · ` : ''}
          {from}
        </>
      }
    />
  );
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "+3,627", "−1,600" (a real minus sign), "±0". */
function signed(x: number, digits = 0): string {
  const r = digits ? round1(x) : x;
  return r > 0 ? `+${formatNumber(r)}` : r < 0 ? `−${formatNumber(-r)}` : '±0';
}

/** What a currency line's CHANGE cell shows. */
function changeText(l: LogLine): string {
  if (l.state === 'undo') return '0';
  // The first check of a currency has nothing to compare with; an undone check shows what it said.
  if (l.entry.kind === 'have' && l.change === null) return l.state === 'undone' ? `=${formatNumber(l.entry.amount)}` : '—';
  return signed(l.change ?? 0);
}

/** What a balance check found: "From balance check: Earned 3,627 Stellar Jade, 3 Star Rail Pass · Spent 10 Star Rail Special Pass". */
function fromCheckText(g: LogGroup, name: (id: string) => string): string | null {
  if (g.state === 'undone') return null;
  const part = (flow: 'earned' | 'spent') => {
    const items = g.lines.filter((l) => l.fromCheck === flow).map((l) => `${formatNumber(Math.abs(l.change ?? 0))} ${name(l.entry.currency)}`);
    return items.length ? `${flow === 'earned' ? 'Earned' : 'Spent'} ${items.join(', ')}` : '';
  };
  const parts = [part('earned'), part('spent')].filter(Boolean);
  if (parts.length) return `From balance check: ${parts.join(' · ')}`;
  const counted = g.lines.filter((l) => l.state === 'counted');
  if (counted.length && counted.every((l) => l.change === null)) return 'First balance check: this sets your bank';
  if (counted.length) return 'From balance check: no change';
  return null;
}

/** Groups by the day they happened (viewer's time), newest day and newest entry first. */
function byDay(groups: LogGroup[]): { key: string; label: string; groups: LogGroup[] }[] {
  const out: { key: string; label: string; groups: LogGroup[] }[] = [];
  for (const g of [...groups].reverse()) {
    const t = Date.parse(g.at);
    const key = new Date(t).toLocaleDateString('en-CA');
    const last = out[out.length - 1];
    if (last?.key === key) last.groups.push(g);
    else out.push({ key, label: formatDay(t), groups: [g] });
  }
  return out;
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
