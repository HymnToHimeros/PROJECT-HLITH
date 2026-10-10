import { useMemo, useState } from 'react';
import type { Character } from '../../core/contract';
import { Button, NoData } from '../../core/ui';
import { BuildEditor } from './BuildEditor';
import r from './roster.module.css';
import { entryOf, toCharacterBuild } from './shared';
import type { RosterData } from './useRosterData';

/**
 * Target stats (owner's job T35): the end stats to build a character towards, only where the game
 * text gives a number (kit, signature weapon, recommended sets; LOGIC-CORE). Each row: you / target,
 * and one tap shows why, the source, the quote and how the number follows. "You" comes from the
 * totals saved with the build; without them it says "No data yet" and offers to enter them.
 */
export function StatTargets({ data, character: c }: { data: RosterData; character: Character }) {
  const { game, user } = data;
  const saved = user.builds?.[c.id];
  const entry = entryOf(user.roster, c.id);
  const [editing, setEditing] = useState(false);
  const targets = useMemo(() => game.rules.statTargets?.(c.id, saved ? toCharacterBuild(saved, c.id, entry.dupes) : undefined), [game.rules, c.id, saved, entry.dupes]);
  if (!game.rules.statTargets) return null;
  const rows = targets?.rows ?? [];
  const hasTotals = Boolean(saved?.totals && Object.keys(saved.totals).length);
  const canEnter = Boolean(game.build) && entry.owned;
  const titleId = `stat-targets-${c.id}`;
  return (
    <section className={r.card} aria-labelledby={titleId}>
      <div className={r.cardHead}>
        <h3 className={r.cardTitle} id={titleId}>
          Target stats
        </h3>
        {canEnter && rows.length > 0 && (
          <Button variant="quiet" onClick={() => setEditing(true)}>
            {hasTotals ? 'Edit totals' : 'Enter totals'}
          </Button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className={r.cardText}>
          Targets: <NoData dash={false} /> The game text gives no stat number for {c.name}, so there is nothing to aim at yet.
        </p>
      ) : (
        <>
          {!hasTotals && <p className={r.cardText}>Enter the totals from {c.name}’s stat screen to see where you stand.</p>}
          <ul className={r.targetList}>
            {rows.map((row, i) => (
              <li key={`${row.stat}-${i}`}>
                <details className={r.targetRow}>
                  <summary className={r.targetSummary}>
                    <span className={r.targetStat}>{row.stat}</span>
                    <span className={r.targetNumbers}>
                      <span>you: {row.you ?? <NoData dash={false} />}</span>
                      <span className={r.muted}>/</span>
                      <span>target: {row.target}</span>
                    </span>
                    <span className={r.targetMark} data-met={row.met === undefined ? 'unknown' : String(row.met)}>
                      {row.met === undefined ? '' : row.met ? 'Reached' : 'Not yet'}
                    </span>
                  </summary>
                  <div className={r.targetMore}>
                    <span>{row.why}</span>
                    {row.condition && <span className={r.muted}>When: {row.condition}</span>}
                    {row.working && <span className={r.muted}>How: {row.working}</span>}
                    <span className={r.whyQuote}>
                      {row.source}: “{row.quote}”
                    </span>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}
      {targets?.direction && (
        <div className={r.stack}>
          <span className={r.label}>BUILD TOWARDS</span>
          <ul className={r.targetDirection}>
            {Object.entries(targets.direction.mains).map(([slot, mains]) => (
              <li key={slot}>
                <span className={r.muted}>{game.build?.slots.find((s) => s.id === slot)?.label ?? slot}:</span> {mains.join(' / ')}
              </li>
            ))}
            {targets.direction.subs.length > 0 && (
              <li>
                <span className={r.muted}>Extra stats:</span> {targets.direction.subs.join(', ')}
              </li>
            )}
          </ul>
          <span className={r.muted}>Source: {targets.direction.source}</span>
        </div>
      )}
      {canEnter && <BuildEditor game={game} character={c} saved={saved} open={editing} onClose={() => setEditing(false)} />}
    </section>
  );
}
