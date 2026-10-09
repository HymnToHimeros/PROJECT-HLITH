import { useId } from 'react';
import type { GameContract } from '../contract';
import { nextDailyReset, serverRule, formatTime } from '../time/reset';
import s from './shell.module.css';
import p from './picker.module.css';

interface Props {
  game: GameContract;
  value: string | undefined;
  onChange: (serverId: string) => void;
  now: number;
}

/** Pick a server per game. Each option shows its daily reset in the viewer's own time. */
export function ServerPicker({ game, value, onChange, now }: Props) {
  const name = useId();
  return (
    <fieldset className={p.fieldset}>
      <legend className={s.sectionLabel}>{game.short} server</legend>
      {game.servers.map((server) => (
        <label key={server.id} className={p.option}>
          <input type="radio" name={name} value={server.id} checked={value === server.id} onChange={() => onChange(server.id)} />
          <span className={p.optionLabel}>{server.label}</span>
          <span className={p.optionMeta}>
            Daily reset {formatTime(nextDailyReset(now, serverRule(game, server.id)))} your time
          </span>
        </label>
      ))}
    </fieldset>
  );
}
