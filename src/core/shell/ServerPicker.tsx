import type { CSSProperties } from 'react';
import type { GameContract } from '../contract';
import { nextDailyReset, serverRule, formatTime } from '../time/reset';
import p from './picker.module.css';

interface Props {
  game: GameContract;
  value: string | undefined;
  onChange: (serverId: string) => void;
  now: number;
  /** Show "HSR server" above the options (when several games share a page). */
  legend?: boolean;
}

const utc = (h: number) => `UTC${h >= 0 ? '+' : '−'}${Math.abs(h)}`;

/** Pick a server per game (design: Server sheet). Each option shows its daily reset in the viewer's own time. */
export function ServerPicker({ game, value, onChange, now, legend = false }: Props) {
  return (
    <div className={p.group} role="radiogroup" aria-label={`${game.short} server`} style={{ '--game-vent': game.vent } as CSSProperties}>
      {legend && <span className={p.legend}>{game.short} server</span>}
      {game.servers.map((server) => {
        const on = value === server.id;
        const meta = `${utc(server.utcOffset)} · daily reset at ${formatTime(nextDailyReset(now, serverRule(game, server.id)))} your time`;
        return (
          <button key={server.id} type="button" role="radio" aria-checked={on} aria-label={`${server.label}, ${meta}`} className={p.option} onClick={() => onChange(server.id)}>
            <span className={p.ring} aria-hidden="true">
              <span className={p.dot} />
            </span>
            <span className={p.optionText}>
              <span className={p.optionLabel}>{server.label}</span>
              <span className={p.optionMeta}>{meta}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
