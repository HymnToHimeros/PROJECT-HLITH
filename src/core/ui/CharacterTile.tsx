import { cx } from './cx';
import s from './ui.module.css';

interface Props {
  name: string;
  /** "Nihility · Lightning" — role and element words come from the game record. */
  subtitle: string;
  rarity: 'top' | 'mid' | 'low';
  rarityLabel: string; // '5★' / '4★' / '3★' or 'S' / 'A' / 'B'
  elementColor: string;
  owned: boolean;
  /** e.g. "E2" / "M1", built from the game's dupe prefix. Absent when the game has no dupes. */
  dupes?: string | undefined;
  art?: string | undefined;
}

/** Dot = element · bottom edge = rarity · badge = dupes. */
export function CharacterTile({ name, subtitle, rarity, rarityLabel, elementColor, owned, dupes, art }: Props) {
  const rarityColor = rarity === 'top' ? 'var(--rarity-top)' : rarity === 'mid' ? 'var(--rarity-mid)' : 'var(--rarity-low)';
  return (
    <div className={cx(s.charTile, !owned && s.notOwned)}>
      <div className={s.charArt}>
        {art ? <img src={art} alt="" /> : <span className={s.initials}>{initials(name)}</span>}
        <span className={s.elementDot} style={{ background: elementColor }} aria-hidden="true" />
        <span className={s.rarity} style={{ color: rarityColor }}>
          {rarityLabel}
        </span>
        {owned ? dupes && <span className={s.dupes}>{dupes}</span> : <span className={s.notOwnedLabel}>NOT OWNED</span>}
        <span className={s.rarityEdge} style={{ background: rarityColor }} aria-hidden="true" />
      </div>
      <span className={s.charName}>{name}</span>
      <span className={s.charSub}>{subtitle}</span>
    </div>
  );
}

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
