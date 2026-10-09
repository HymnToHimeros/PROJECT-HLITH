/**
 * Proposal cards (ROADMAP R49): each change the Assistant suggests, with
 * Approve / Dismiss, then Undo once applied. Nothing changes without Approve.
 * No design yet (CLAUDE.md Override 5): shared tokens and parts only.
 */
import { useState, type CSSProperties } from 'react';
import type { GameContract } from '../../core/contract';
import { useGameData, type AssistantAction } from '../../core/data/userData';
import { Button, ExampleTag, GameTag, HowTo } from '../../core/ui';
import { setProposalStatus, type ProposalStatus } from './chat';
import { applyProposal, KIND_LABEL, undoProposal, type Proposal } from './proposals';
import s from './assistant.module.css';

interface CardProps {
  proposal: Proposal;
  status: ProposalStatus;
  error?: string | undefined;
  game?: GameContract | undefined;
  /** Show the game tag (All games view). */
  showGame?: boolean;
  /** Example card: buttons do nothing. */
  example?: boolean;
}

export function ProposalCard({ proposal: p, status, error, game, showGame = false, example = false }: CardProps) {
  const actions = useGameData(p.game || '_none').assistantActions;
  const action = actions.find((a) => a.id === p.id);
  const approve = () => {
    const r = applyProposal(p);
    setProposalStatus(p.id, r.ok ? 'applied' : 'pending', r.ok ? undefined : r.error);
  };
  const undo = () => {
    const r = undoProposal(p.game, p.id);
    setProposalStatus(p.id, r.ok ? 'undone' : 'applied', r.ok ? undefined : r.error);
  };
  // After a reload or a new chat the record in your data is the truth.
  const shown: ProposalStatus = action ? (action.status === 'undone' ? 'undone' : 'applied') : status;

  return (
    <article className={s.card} aria-label={`Proposal: ${p.title}`} style={game ? ({ '--vent': game.vent } as CSSProperties) : undefined}>
      <div className={s.cardHead}>
        <span className={s.kind}>PROPOSAL · {KIND_LABEL[p.kind]}</span>
        {example && <ExampleTag />}
        {showGame && game && <GameTag label={game.short} vent={game.vent} />}
      </div>
      <h4 className={s.cardTitle}>{p.title}</h4>
      {p.detail && <p className={s.cardDetail}>{p.detail}</p>}
      {p.stops && (
        <ol className={s.stops}>
          {p.stops.map((st, i) => (
            <li key={i}>
              {st.title}
              {st.minutes !== null && <span className={s.mono}> · ~{st.minutes} min</span>}
              {st.items.length > 0 && (
                <ul>
                  {st.items.map((it, j) => (
                    <li key={j}>{it}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
      {p.why && <p className={s.why}>{p.why}</p>}
      {p.problem ? (
        <p className={s.problem}>Can’t apply this: {p.problem}</p>
      ) : (
        <div className={s.cardActions}>
          {shown === 'pending' && (
            <>
              <Button variant="primary" onClick={example ? undefined : approve} disabled={example} aria-label={`Approve: ${p.title}`}>
                {p.kind === 'plan' || p.kind === 'route' ? 'Add to calendar' : 'Approve'}
              </Button>
              <Button onClick={example ? undefined : () => setProposalStatus(p.id, 'dismissed')} disabled={example} aria-label={`Dismiss: ${p.title}`}>
                Dismiss
              </Button>
            </>
          )}
          {shown === 'applied' && (
            <>
              <span className={`${s.state} ${s.ok}`} role="status">
                ✓ Applied
              </span>
              <Button onClick={undo} aria-label={`Undo: ${p.title}`}>
                Undo
              </Button>
            </>
          )}
          {shown === 'dismissed' && (
            <span className={s.state} role="status">
              Dismissed · nothing changed
            </span>
          )}
          {shown === 'undone' && (
            <span className={s.state} role="status">
              Undone · back as it was
            </span>
          )}
        </div>
      )}
      {error && (
        <p className={s.problem} role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

/** "What are proposals?" — shown in Settings and under the example chat. */
export function ProposalsHowTo() {
  return (
    <HowTo
      title="What are proposals?"
      steps={[
        'When the Assistant wants to change something (a balance, an event, backlog progress, your roster, a task on Today, a plan or a route), it shows a card instead of doing it.',
        'Read the card: it says what changes, what it is now, and why. Tap Approve (or “Add to calendar” for plans) to apply it, or Dismiss to leave everything as it is.',
        'Changed your mind? Tap Undo on the card, or in Settings → Changes the Assistant made. Bank log changes are undone with a correcting entry; nothing is ever deleted.',
        'The Assistant is told what you decided with your next message.',
      ]}
    />
  );
}

/** Every change the Assistant made in one game, newest first, with Undo. */
export function ActionLog({ game, showGame }: { game: GameContract; showGame: boolean }) {
  const actions = useGameData(game.id).assistantActions;
  if (actions.length === 0) return null;
  return (
    <ul className={s.actionList} aria-label={`Changes the Assistant made in ${game.name}`}>
      {[...actions].reverse().map((a) => (
        <ActionRow key={a.id} game={game} action={a} showGame={showGame} />
      ))}
    </ul>
  );
}

function ActionRow({ game, action: a, showGame }: { game: GameContract; action: AssistantAction; showGame: boolean }) {
  const [error, setError] = useState('');
  return (
    <li className={s.actionRow}>
      {showGame && <GameTag label={game.short} vent={game.vent} />}
      <span className={a.status === 'undone' ? s.undone : undefined}>
        {a.summary}
        <span className={s.meta}> · {new Date(a.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        {error && (
          <span className={s.problem} role="alert">
            {' '}
            {error}
          </span>
        )}
      </span>
      {a.status === 'applied' ? (
        <Button
          onClick={() => {
            const r = undoProposal(game.id, a.id);
            setProposalStatus(a.id, r.ok ? 'undone' : 'applied');
            setError(r.ok ? '' : r.error);
          }}
          aria-label={`Undo: ${a.summary}`}
        >
          Undo
        </Button>
      ) : (
        <span className={s.meta}>Undone</span>
      )}
    </li>
  );
}
