import { useMemo, type ReactNode } from 'react';
import type { TeamAccount, TeamReason, TeamVerdict } from '../../core/contract';
import { ExampleTag, NoData } from '../../core/ui';
import r from './roster.module.css';
import { artOf, CharArt, elementOf, entryOf } from './shared';
import type { RosterData } from './useRosterData';

export type Status = 'owned' | 'wanted' | 'gap';
export const statusWord: Record<Status, string> = { owned: 'owned', wanted: 'wanted', gap: 'not owned' };

export function statusOf(data: RosterData, id: string): Status {
  const e = entryOf(data.user.roster, id);
  return e.owned ? 'owned' : e.wanted ? 'wanted' : 'gap';
}

/**
 * One team member as a small portrait (art fills it; else an element-tinted
 * placeholder). Sample art is used only when the team is an EXAMPLE.
 */
export function Member({ data, id, example, size = 'md', showName = false, onOpen }: { data: RosterData; id: string; example: boolean; size?: 'sm' | 'md'; showName?: boolean; onOpen?: ((id: string) => void) | undefined }) {
  const c = data.byId.get(id);
  const name = c?.name ?? id;
  const status = statusOf(data, id);
  const el = c ? elementOf(data.game, c.element) : undefined;
  const src = c ? artOf(c, 'portrait', example ? data.sampleArt.get(c.id) : undefined) : undefined;
  const body: ReactNode = (
    <>
      <CharArt name={name} src={src} elementColor={el?.color ?? 'var(--ink-4)'} className={size === 'sm' ? r.memberArtSm : r.memberArt}>
        <span className={r.memberEdge} style={{ background: el?.color ?? 'var(--line-empty)' }} aria-hidden="true" />
      </CharArt>
      {showName ? (
        <span className={r.memberText}>
          <span className={r.memberName}>{name}</span>
          <span className={r.memberState} data-status={status}>
            {statusWord[status]}
          </span>
        </span>
      ) : (
        <span className={r.srOnly}>
          {name}, {statusWord[status]}
        </span>
      )}
    </>
  );
  const cls = `${r.member} ${status === 'gap' ? r.memberGap : ''}`;
  return onOpen && c ? (
    <button type="button" className={cls} title={`${name} · ${statusWord[status]}`} onClick={() => onOpen(c.id)}>
      {body}
    </button>
  ) : (
    <span className={cls} title={`${name} · ${statusWord[status]}`}>
      {body}
    </span>
  );
}

/** What the game's team rules may know about you: who you own and their dupes. */
export const teamAccount = (data: RosterData): TeamAccount => rosterAccount(data.user.roster);

const rosterAccount = (roster: RosterData['user']['roster']): TeamAccount => ({
  owned: (id) => entryOf(roster, id).owned,
  dupes: (id) => entryOf(roster, id).dupes,
});

/** The game's verdict on a team, from its team rules (LOGIC-CORE); null when the game has none. */
export function useVerdict(data: RosterData, members: string[], skip = false): TeamVerdict | null {
  const rules = data.game.rules.teams;
  const key = members.join(',');
  const roster = data.user.roster;
  return useMemo(() => (skip || !rules ? null : rules.verdict(key ? key.split(',') : [], rosterAccount(roster))), [rules, key, roster, skip]);
}

/** Why a team scores what it does: every point with the kit text that earned it. */
export function WhyScore({ verdict, data }: { verdict: TeamVerdict | null; data: RosterData }) {
  if (!verdict) return null;
  if (!verdict.rated) return <span className={r.muted}>{verdict.why}</span>;
  const name = (id: string) => data.byId.get(id)?.name ?? id;
  const groups: [TeamReason['group'], string][] = [
    ['counted', 'Counted'],
    ['tie-break', 'Team support · only breaks ties'],
    ['not-counted', 'Shown, not counted'],
  ];
  return (
    <details className={r.why}>
      <summary className={r.whySummary}>
        Why {verdict.percent}%: count {verdict.count} of {verdict.best} · order {verdict.order.map(name).join(' > ')}
      </summary>
      <div className={r.stack}>
        {verdict.notes.map((n) => (
          <span key={n} className={r.muted}>
            {n}
          </span>
        ))}
        {groups.map(([g, title]) => {
          const rows = verdict.reasons.filter((x) => x.group === g);
          if (!rows.length) return null;
          const list = (
            <ul className={r.whyList}>
              {rows.map((x, i) => (
                <li key={i} className={r.whyItem}>
                  <span className={r.whyPoints}>{x.points > 0 ? `+${x.points}` : x.points < 0 ? `−${-x.points}` : '·'}</span>
                  <span>
                    {x.text}
                    {x.proof && (
                      <span className={r.whyQuote}>
                        {x.proof.skill}: “{x.proof.quote}”
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          );
          // Locked, off-target and possible lines can be long: folded away, one tap to open.
          return g === 'not-counted' ? (
            <details key={g} className={r.why}>
              <summary className={r.whySummary}>
                {title} ({rows.length})
              </summary>
              {list}
            </details>
          ) : (
            <div key={g} className={r.stack}>
              <span className={r.label}>{title.toUpperCase()}</span>
              {list}
            </div>
          );
        })}
        <span className={r.muted}>Rules: {data.game.rules.teams?.method}</span>
      </div>
    </details>
  );
}

/** The team score spot (design: big number + "synergy"). Real scores come from the game's team rules; otherwise "No data yet", or an EXAMPLE number on example teams. */
export function Score({ score, example, big = false, verdict = null }: { score: number | null; example: boolean; big?: boolean; verdict?: TeamVerdict | null }) {
  if (verdict?.rated && !example)
    return (
      <div className={r.score} role="group" aria-label="Fit with your roster">
        <span className={big ? r.scoreNumBig : r.scoreNum}>{verdict.percent}%</span>
        <span className={r.scoreLabel}>synergy · {verdict.label}</span>
      </div>
    );
  return (
    <div className={r.score} role="group" aria-label="Fit with your roster">
      {score !== null && example ? (
        <>
          <span className={big ? r.scoreNumBig : r.scoreNum}>{score}</span>
          <span className={r.scoreLabel}>synergy · example</span>
        </>
      ) : (
        <>
          <span className={big ? r.scoreNumBig : r.scoreNum} data-empty="true" aria-hidden="true">
            —
          </span>
          <NoData dash={false} />
        </>
      )}
    </div>
  );
}

/** A compact team row (character page → Team fit): name, portraits, score, and why. */
export function TeamRow({ data, name, members, example, score }: { data: RosterData; name: string; members: string[]; example: boolean; score: number | null }) {
  const verdict = useVerdict(data, members, example);
  return (
    <div className={r.stack}>
      <div className={r.teamRow}>
        <div className={r.teamRowMain}>
          <span className={r.teamRowName}>
            {name} {example && <ExampleTag />}
          </span>
          <span className={r.members}>
            {members.map((id) => (
              <Member key={id} data={data} id={id} example={example} size="sm" />
            ))}
          </span>
        </div>
        <Score score={score} example={example} verdict={verdict} />
      </div>
      {!example && <WhyScore verdict={verdict} data={data} />}
    </div>
  );
}
