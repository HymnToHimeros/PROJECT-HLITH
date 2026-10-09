import { useState, type FormEvent } from 'react';
import type { GameContract } from '../../core/contract';
import { addLedgerEntry, type LedgerEntry } from '../../core/data/userData';
import { formatNumber } from '../../core/time/format';
import { formatDateTime } from '../../core/time/reset';
import { Button } from '../../core/ui';
import { Ex } from './shared';
import p from './pulls.module.css';
import type { PullsData } from './usePullsData';

const KIND_LABEL: Record<LedgerEntry['kind'], string> = {
  have: 'I have',
  earned: 'Earned',
  bought: 'Bought',
  spent: 'Spent',
};

/** Bank log: an add-only ledger. Your balance = latest "I have" + changes since. */
export function BankLog({ game, data }: { game: GameContract; data: PullsData }) {
  const currencies = game.currencies;
  const [currency, setCurrency] = useState(currencies[0]?.id ?? '');
  const [kind, setKind] = useState<LedgerEntry['kind']>('have');
  const [amount, setAmount] = useState('');
  const name = (id: string) => currencies.find((c) => c.id === id)?.name ?? id;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount.replace(/[\s,.]/g, ''));
    if (!Number.isFinite(n) || n < 0 || !currency) return;
    addLedgerEntry(game.id, {
      at: new Date().toISOString(),
      currency,
      kind,
      amount: n,
    });
    setAmount('');
  };

  const entries = [...data.user.ledger].reverse();
  return (
    <div className={p.stack}>
      <div className={p.card}>
        <div className={p.cardHead}>
          <h3 className={p.cardTitle}>Balance</h3>
        </div>
        <div className={p.chips}>
          {data.bank.value.known &&
            Object.entries(data.bank.value.value).map(([c, v]) => (
              <span key={c} className={p.message}>
                <Ex example={data.bank.example}>
                  <strong>{formatNumber(v)}</strong> {name(c)}
                </Ex>
              </span>
            ))}
        </div>
        <form className={p.form} onSubmit={submit}>
          <label className={p.field}>
            Entry
            <select className={p.input} value={kind} onChange={(e) => setKind(e.target.value as LedgerEntry['kind'])}>
              {Object.entries(KIND_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className={p.field}>
            Amount
            <input className={p.input} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 8400" required />
          </label>
          <label className={p.field}>
            Currency
            <select className={p.input} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <Button variant="primary" type="submit">
            Add to log
          </Button>
        </form>
        <span className={p.muted}>Start with “I have” and what the game shows right now. Entries are never edited or removed; add a new “I have” to correct.</span>
      </div>
      {entries.length > 0 && (
        <div className={p.tableWrap}>
          <table className={p.table}>
            <thead>
              <tr>
                <th>WHEN</th>
                <th>ENTRY</th>
                <th className={p.num}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className={p.muted}>{formatDateTime(Date.parse(e.at))}</td>
                  <td>
                    {KIND_LABEL[e.kind]} · {name(e.currency)}
                  </td>
                  <td className={p.num}>
                    {e.kind === 'spent' ? '−' : e.kind === 'have' ? '' : '+'}
                    {formatNumber(e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
