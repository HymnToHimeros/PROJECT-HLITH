import type { ReactNode } from 'react';
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

/** The team score spot (design: big number + "synergy"). Real scores come from ROSTER-LOGIC; until then "No data yet", or an EXAMPLE number on example teams. */
export function Score({ score, example, big = false }: { score: number | null; example: boolean; big?: boolean }) {
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

/** A compact team row (character page → Team fit): name, portraits, score. */
export function TeamRow({ data, name, members, example, score }: { data: RosterData; name: string; members: string[]; example: boolean; score: number | null }) {
  return (
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
      <Score score={score} example={example} />
    </div>
  );
}
