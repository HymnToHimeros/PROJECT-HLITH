import type { ReactNode } from 'react';
import type { Character, GameContract, Kit } from '../../core/contract';
import { NoData } from '../../core/ui';
import r from './roster.module.css';
import { useKits } from './useRosterData';

interface Props {
  game: GameContract;
  /** One character (character page) or a whole team (Teams). */
  characters: Character[];
  /** Show the "Kit check" title (off when the sheet title already says it). */
  title?: boolean;
}

/*
 * Interface only. Logic is filled by the ROSTER-LOGIC workstream: kit data,
 * reading the game text and the "does" tags. This frame shows whatever
 * `game.data.kits` holds, as is.
 */

/**
 * Kit check (Override 1): for any game whose record has kit data, what each
 * skill does (tags) with the game's own text as proof. Without data: "No data yet".
 */
export function KitCheck({ game, characters, title = true }: Props) {
  const kits = useKits(game);
  return (
    <div className={r.kit}>
      {title && <h3 className={r.cardTitle}>Kit check</h3>}
      <span className={r.cardText}>What each skill does, with the game’s own text as proof. Tap a skill to read the text.</span>
      {kits === null ? (
        <p className={r.muted}>Loading kit text…</p>
      ) : (
        characters.map((c) => <OneKit key={c.id} who={c} kit={kits.find((k) => k.characterId === c.id)} showName={characters.length > 1} game={game} />)
      )}
    </div>
  );
}

function OneKit({ who, kit, showName, game }: { who: Character; kit: Kit | undefined; showName: boolean; game: GameContract }) {
  if (!kit || kit.skills.length === 0) {
    return (
      <div className={r.kitBlock}>
        {showName && <h4 className={r.kitName}>{who.name}</h4>}
        <div className={r.kitEmpty}>
          <NoData />
          <span className={r.muted}>Kit text for this {game.terms.character.toLowerCase()} hasn’t been added yet.</span>
        </div>
      </div>
    );
  }
  const unread = kit.skills.every((s) => s.does.length === 0 && !s.note);
  return (
    <div className={r.kitBlock}>
      {showName && <h4 className={r.kitName}>{who.name}</h4>}
      {(kit.source || kit.beta || unread) && (
        <span className={r.muted}>
          {kit.source && `Game text from ${kit.source}${kit.version ? ` (game data ${kit.version.split('+')[0]})` : ''}. `}
          {kit.beta && 'Not released yet: the text can still change. '}
          {unread && 'Not read yet: what each skill does is added next.'}
        </span>
      )}
      <ul className={r.skills}>
        {kit.skills.map((s) => (
          <li key={s.id} className={r.skill}>
            <details>
              <summary className={r.skillHead}>
                <span className={r.skillName}>{s.label}</span>
                <span className={r.tags}>
                  {s.does.map((t) => (
                    <span key={t} className={r.tag}>
                      {t}
                    </span>
                  ))}
                </span>
              </summary>
              <div className={r.gameText}>
                <span className={r.label}>GAME TEXT</span>
                <p className={r.gameTextBody}>{marked(s.gameText, (s.proof ?? []).map((p) => p.quote))}</p>
                {s.proof && s.proof.length > 0 && (
                  <>
                    <span className={r.label}>WHAT IT DOES · THE MARKED WORDS PROVE IT</span>
                    <ul className={r.proofList}>
                      {s.proof.map((p) => (
                        <li key={p.tag}>
                          <strong>{p.tag}</strong>
                          {p.note && <span className={r.muted}> · {p.note}</span>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {s.note && <span className={r.muted}>{s.note}</span>}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The game text with the proving quotes marked. */
function marked(text: string, quotes: string[]): ReactNode {
  const spans: [number, number][] = [];
  for (const q of quotes) {
    const at = q ? text.indexOf(q) : -1;
    if (at >= 0) spans.push([at, at + q.length]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const out: ReactNode[] = [];
  let pos = 0;
  for (const [from, to] of spans) {
    if (to <= pos) continue;
    const start = Math.max(from, pos);
    if (start > pos) out.push(text.slice(pos, start));
    out.push(<mark key={start}>{text.slice(start, to)}</mark>);
    pos = to;
  }
  out.push(text.slice(pos));
  return out;
}
