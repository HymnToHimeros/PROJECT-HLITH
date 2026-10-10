import { useState, type CSSProperties } from 'react';
import type { Banner, BannerType, GameContract } from '../../core/contract';
import { formatNumber } from '../../core/time/format';
import { formatRange } from '../../core/time/reset';
import { EmptyState, ExampleTag, GameTag, NoData, Timer, UnverifiedTag } from '../../core/ui';
import { cx } from '../../core/ui/cx';
import { budget, budgetPulls, pullsFor, type BudgetRow } from '../budget/budget';
import { chance, pityFromHistory, worstCase, type OddsMode } from '../pity/pity';
import { Filters, percent, Strip } from './shared';
import p from './pulls.module.css';
import type { PullsData } from './usePullsData';

interface Props {
  game: GameContract;
  data: PullsData;
  serverId: string | undefined;
  now: number;
  /** Game tag on each card (All games only). */
  tagged: boolean;
  openTab: (tab: string) => void;
}

type Target = 'all' | 'character' | 'weapon';
/** Pity you typed in to try out. Kept on this screen only, never saved. */
type WhatIf = Record<string, { pulls: number; guaranteed: boolean }>;

/**
 * Planner (design: Pulls → Planner): one card per banner with pulls you have
 * now, by the banner's end, the worst case and a verdict; chance to win when
 * your pity is known. A filter picks character or weapon banners (V1 feature),
 * and "Try your own pity" lets you see odds before importing (not saved).
 */
export function Planner({ game, data, serverId, now, tagged, openTab }: Props) {
  const [target, setTarget] = useState<Target>('all');
  const [whatIf, setWhatIf] = useState<WhatIf>({});
  const all = data.banners.list.filter((b) => Date.parse(b.end) > now);
  const typeOf = (b: Banner) => game.bannerTypes.find((t) => t.id === b.type);
  const banners = all.filter((b) => target === 'all' || typeOf(b)?.target === target).sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || Date.parse(a.end) - Date.parse(b.end));
  const hasWeapon = all.some((b) => typeOf(b)?.target === 'weapon');
  const noRealHistory = data.history.example;
  const pityTypes = game.bannerTypes.filter((t) => t.pity.kind === 'hard-pity' && all.some((b) => b.type === t.id));

  return (
    <div className={p.stack}>
      {noRealHistory && (
        <Strip action={{ label: 'Import in History', onClick: () => openTab('history') }}>
          Chance to win needs your pity and 50/50 state. Pull history: no data yet, so the chances below use example pulls.
        </Strip>
      )}
      <div className={p.toolbar}>
        {hasWeapon && (
          <Filters
            label="Which banners"
            value={target}
            onChange={setTarget}
            options={[
              { id: 'all', label: 'Both' },
              { id: 'character', label: `${game.terms.character} banners` },
              { id: 'weapon', label: `${game.terms.weapon} banners` },
            ]}
          />
        )}
        {pityTypes.length > 0 && <TryPity game={game} types={pityTypes} value={whatIf} onChange={setWhatIf} />}
      </div>
      {banners.length === 0 ? (
        <EmptyState title="No banners yet" body="No upcoming banners are listed for this game yet. They appear here as soon as the list has them." />
      ) : (
        <div className={p.planGrid}>
          {banners.map((b) => {
            const type = typeOf(b);
            return type ? <PlanCard key={b.id} game={game} banner={b} type={type} data={data} serverId={serverId} now={now} tagged={tagged} whatIf={whatIf[type.id]} /> : null;
          })}
        </div>
      )}
    </div>
  );
}

interface CardProps {
  game: GameContract;
  banner: Banner;
  type: BannerType;
  data: PullsData;
  serverId: string | undefined;
  now: number;
  tagged: boolean;
  whatIf: WhatIf[string] | undefined;
}

function PlanCard({ game, banner: b, type, data, serverId, now, tagged, whatIf }: CardProps) {
  const start = Date.parse(b.start);
  const end = Date.parse(b.end);
  const upcoming = start > now;
  // V1: for a banner that hasn't started, count until it arrives or until it ends.
  const [until, setUntil] = useState<'start' | 'end'>('end');
  const horizon = upcoming && until === 'start' ? start : end;
  const haveNow = data.bank.value.known ? pullsFor(game, data.bank.value.value, type.id) : null;
  const byEnd = budget({
    game,
    serverId,
    now,
    until: horizon,
    bank: data.bank.value,
    paidExtras: data.user.paidExtras,
    passes: Object.fromEntries(Object.entries(data.user.passes).map(([k, v]) => [k, Date.parse(v)])),
    ...data.budgetExtras(horizon),
  });
  const pullsBy = budgetPulls(game, byEnd, type.id);
  const fromHistory = pityFromHistory(data.history.list, type.id);
  const state = whatIf ?? {
    pulls: fromHistory.pity.known ? fromHistory.pity.value : 0,
    guaranteed: fromHistory.guaranteed.known ? fromHistory.guaranteed.value : false,
  };
  const stateKnown = Boolean(whatIf) || (fromHistory.pity.known && fromHistory.guaranteed.known);
  const worst = worstCase(type.pity, state);
  const odds = (mode: OddsMode) => (stateKnown && pullsBy.known ? chance(type.pity, state, pullsBy.value, mode) : null);
  const official = odds('official');
  const community = odds('community');
  const exampleNumbers = data.bank.example || (!whatIf && data.history.example);
  const worstN = worst.known ? worst.value : null;
  const byN = pullsBy.known ? pullsBy.value : null;
  const short = worstN !== null && byN !== null ? worstN - byN : null;
  const hard = type.pity.kind === 'hard-pity' ? type.pity.hardPity : null;

  return (
    <article className={cx(p.planCard, b.leak && p.leakCard)} style={{ '--vent': game.vent } as CSSProperties} aria-label={b.title}>
      <div className={p.kindRow}>
        <span className={p.kind}>{type.label}</span>
        {(data.banners.exampleIds.has(b.id) || exampleNumbers) && <ExampleTag />}
        {b.leak && <UnverifiedTag source={b.leak.source} />}
        {tagged && <GameTag label={game.short} vent={game.vent} />}
      </div>
      <div className={p.titleBlock}>
        <h3 className={p.bigTitle}>{b.title}</h3>
        <span className={p.range}>
          {formatRange(start, end)} · {upcoming ? <Timer to={start} prefix="opens in" /> : <Timer to={end} deadline prefix="ends in" />}
        </span>
      </div>
      {upcoming && (
        <Filters
          label={`Count until, for ${b.title}`}
          value={until}
          onChange={setUntil}
          options={[
            { id: 'start', label: 'Until it opens' },
            { id: 'end', label: 'Until it ends' },
          ]}
        />
      )}
      <div className={p.figures}>
        <Figure label="Have now" value={haveNow} />
        <Figure label={upcoming && until === 'start' ? 'When it opens' : 'By end'} value={byN} />
        <Figure label="Worst case" value={worstN} dim />
      </div>
      {worstN !== null && worstN > 0 && (
        <div className={p.bar} role="img" aria-label={`${haveNow ?? 'unknown'} now and ${byN ?? 'unknown'} by then, of ${worstN} for the worst case`}>
          {byN !== null && <span className={p.barBy} style={{ width: `${Math.min(100, (byN / worstN) * 100)}%` }} />}
          {haveNow !== null && <span className={p.barHave} style={{ width: `${Math.min(100, (haveNow / worstN) * 100)}%` }} />}
        </div>
      )}
      <div className={p.verdictRow}>
        {short === null ? (
          <NoData dash={false} fix="enter-manually" />
        ) : short <= 0 ? (
          <span className={p.ok}>Covers the worst case</span>
        ) : (
          <span className={p.short}>{formatNumber(short)} short of worst case</span>
        )}
        <span className={p.muted}>By end counts everything still to earn (see Calculator)</span>
      </div>
      <dl className={p.odds}>
        <div className={p.oddsRow}>
          <dt>Chance by then · official rates</dt>
          <dd className={p.oddsValue}>{official?.known ? percent(official.value) : <NoData dash={false} fix="import-history" />}</dd>
        </div>
        <div className={p.oddsRow}>
          <dt>Chance by then · community rates</dt>
          <dd className={p.oddsValue}>{community?.known ? percent(community.value) : <span className={p.muted}>not available</span>}</dd>
        </div>
        {stateKnown && (
          <div className={p.oddsRow}>
            <dt>{whatIf ? 'Your pity (what-if, not saved)' : 'Pity from your history'}</dt>
            <dd className={p.oddsValue}>
              {state.pulls}
              {hard !== null ? `/${hard}` : ''} · {state.guaranteed ? 'guaranteed' : '50/50'}
              {!whatIf && data.history.example ? ' · example' : ''}
            </dd>
          </div>
        )}
      </dl>
      <LeftOut rows={byEnd.rows} />
    </article>
  );
}

/** Rows the budget couldn't count, grouped by why (e.g. "choose your server"). */
function LeftOut({ rows }: { rows: BudgetRow[] }) {
  const byReason = new Map<string, string[]>();
  for (const r of rows) if (r.status === 'no-data') byReason.set(r.reason ?? 'no data', [...(byReason.get(r.reason ?? 'no data') ?? []), r.label]);
  if (byReason.size === 0) return null;
  return (
    <details className={p.leftOut}>
      <summary>
        Not counted: {[...byReason.values()].flat().length} rows with no data yet
      </summary>
      {[...byReason].map(([reason, labels]) => (
        <span key={reason} className={p.muted}>
          {reason}: {labels.join(', ')}
        </span>
      ))}
    </details>
  );
}

function Figure({ label, value, dim = false }: { label: string; value: number | null; dim?: boolean }) {
  return (
    <div className={p.figure}>
      <span className={p.figLabel}>{label}</span>
      {value === null ? (
        <NoData />
      ) : (
        <span className={cx(p.figValue, dim && p.dim)}>{formatNumber(value)}</span>
      )}
    </div>
  );
}

/** V1 feature: type your pity in to see the odds, before (or without) importing. Not saved anywhere. */
function TryPity({ game, types, value, onChange }: { game: GameContract; types: BannerType[]; value: WhatIf; onChange: (v: WhatIf) => void }) {
  const [typeId, setTypeId] = useState(types[0]?.id ?? '');
  const type = types.find((t) => t.id === typeId) ?? types[0];
  if (!type || type.pity.kind !== 'hard-pity') return null;
  const cur = value[type.id];
  const hasFeatured = type.pity.featured !== undefined;
  const set = (next: { pulls: number; guaranteed: boolean } | null) => {
    const rest = Object.fromEntries(Object.entries(value).filter(([id]) => id !== type.id));
    onChange(next ? { ...rest, [type.id]: next } : rest);
  };
  return (
    <details className={p.tryPity}>
      <summary>Know your pity? Try it here</summary>
      <div className={p.tryBody}>
        <label className={p.field}>
          Banner
          <select className={p.input} value={type.id} onChange={(e) => setTypeId(e.target.value)}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className={p.field}>
          Pulls since your last {game.terms.rarity.top}
          <input
            className={p.input}
            type="number"
            inputMode="numeric"
            min={0}
            max={type.pity.hardPity - 1}
            value={cur ? cur.pulls : ''}
            placeholder="e.g. 40"
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              set(Number.isFinite(n) ? { pulls: Math.min(type.pity.kind === 'hard-pity' ? type.pity.hardPity - 1 : n, Math.max(0, n)), guaranteed: cur?.guaranteed ?? false } : null);
            }}
          />
        </label>
        {hasFeatured && (
          <label className={p.field}>
            Next {game.terms.rarity.top}
            <select className={p.input} value={cur?.guaranteed ? 'g' : 'f'} onChange={(e) => set({ pulls: cur?.pulls ?? 0, guaranteed: e.target.value === 'g' })}>
              <option value="f">50/50</option>
              <option value="g">Guaranteed (lost the last 50/50)</option>
            </select>
          </label>
        )}
        <span className={p.muted}>Only for trying out: kept on this screen, never saved. Importing your history replaces guesswork.</span>
      </div>
    </details>
  );
}
