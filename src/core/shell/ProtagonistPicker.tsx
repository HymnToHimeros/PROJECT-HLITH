import type { CSSProperties } from 'react';
import type { GameContract } from '../contract';
import { chooseProtagonist } from '../data/protagonist';
import { usePrefs } from '../data/prefs';
import p from './picker.module.css';

/** Pick your main character for a game (HSR: Caelus or Stelle). Nothing for games without that choice. */
export function ProtagonistPicker({ game, legend = false }: { game: GameContract; legend?: boolean }) {
  const value = usePrefs().protagonists?.[game.id];
  const choice = game.protagonist;
  if (!choice) return null;
  return (
    <div className={p.group} role="radiogroup" aria-label={`Your ${game.short} ${choice.label}`} style={{ '--game-vent': game.vent } as CSSProperties}>
      {legend && (
        <span className={p.legend}>
          Your {game.short} {choice.label}
        </span>
      )}
      {choice.options.map((o) => {
        const on = value === o.id;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} className={p.option} onClick={() => void chooseProtagonist(game, o.id)}>
            <span className={p.ring} aria-hidden="true">
              <span className={p.dot} />
            </span>
            <span className={p.optionText}>
              <span className={p.optionLabel}>{o.name}</span>
              <span className={p.optionMeta}>{on ? 'Yours: counted as owned, the other one hidden' : value ? 'Hidden. Pick to switch; nothing is lost' : 'Pick if this is yours'}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
