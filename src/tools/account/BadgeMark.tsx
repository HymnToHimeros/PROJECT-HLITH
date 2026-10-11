import { useId } from 'react';
import type { BadgeId } from './badges';
import b from './badges.module.css';

/**
 * Badge medallions (T52), drawn here, no pictures to load.
 *  - Owner: a night sky over HLIÐSKJÁLF in a gold ring, Odin's one eye in the middle and his
 *    two ravens, Huginn and Muninn, circling it. The ravens turn and a light passes over the
 *    gold only while Animations are on.
 *  - Seated: the high seat itself.
 *  - Earned: a rune for each badge, cut into the medallion.
 * Locked badges are drawn faint with a dashed ring.
 */

/** Elder Futhark runes on a 24×24 grid, as plain strokes. */
const RUNES: Partial<Record<BadgeId, { rune: string; d: string }>> = {
  'first-light': { rune: 'Sowilo, the sun', d: 'M15 3 L9 10 L15 14 L9 21' },
  hundred: { rune: 'Kenaz, the torch', d: 'M15 4 L9 12 L15 20' },
  thousand: { rune: 'Jera, the harvest', d: 'M11 4 L7 9 L11 14 M13 10 L17 15 L13 20' },
  storm: { rune: 'Hagalaz, the hail', d: 'M8 3 V21 M16 3 V21 M8 9 L16 15' },
  'shield-wall': { rune: 'Algiz, the shield', d: 'M12 3 V21 M12 11 L6 4 M12 11 L18 4' },
  'between-worlds': { rune: 'Ehwaz, the crossing', d: 'M7 3 V21 M17 3 V21 M7 3 L12 9 L17 3' },
  'thirty-dawns': { rune: 'Dagaz, the dawn', d: 'M6 5 V19 L18 5 V19 Z' },
  'self-portrait': { rune: 'Mannaz, the self', d: 'M7 3 V21 M17 3 V21 M7 3 L17 11 M17 3 L7 11' },
  hall: { rune: 'Othala, the home', d: 'M12 3 L17 8 L12 13 L7 8 Z M9.5 10.5 L5 21 M14.5 10.5 L19 21' },
  treasurer: { rune: 'Fehu, wealth', d: 'M8 3 V21 M8 9 L16 3 M8 14 L16 8' },
  sagas: { rune: 'Raido, the journey', d: 'M8 3 V21 M8 3 L15 7 L8 12 L15 21' },
  gatherer: { rune: 'Ingwaz, the seed', d: 'M12 4 L18 12 L12 20 L6 12 Z' },
  'rune-days': { rune: 'Laguz, the flow', d: 'M9 3 V21 M9 3 L16 9' },
  'feast-days': { rune: 'Gebo, the gift', d: 'M6 4 L18 20 M18 4 L6 20' },
  smith: { rune: 'Tiwaz, the forge-god', d: 'M12 3 V21 M6 9 L12 3 L18 9' },
};

/** A raven in flight, about 12 units wide, centred on 0,0. */
export const RAVEN = 'M-6 0.5 Q-3.5 -3.5 -0.5 -1 Q1.5 -5 6 -4 Q3 -1.6 2.2 0.6 L5 2.6 L1.2 1.9 L-0.6 3.4 Q-1 1.2 -6 0.5 Z';

export function BadgeMark({ id, earned = true, size = 48, title }: { id: BadgeId; earned?: boolean; size?: number; title?: string }) {
  const uid = useId().replace(/:/g, '');
  const label = title ? <title>{title}</title> : null;
  if (id === 'owner') return <OwnerMark size={size} uid={uid} label={label} />;
  const cls = `${b.mark} ${earned ? '' : b.locked}`;
  if (id === 'seated')
    return (
      <svg className={cls} width={size} height={size} viewBox="0 0 64 64" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
        {label}
        <circle cx="32" cy="32" r="29" className={b.seatDisc} />
        <circle cx="32" cy="32" r="29" className={b.ring} />
        {/* The high seat: a tall back, arms, a step. */}
        <path className={b.glyph} d="M23 14 V38 H41 V14 M23 14 Q32 9 41 14 M19 30 H23 M41 30 H45 M19 30 V44 M45 30 V44 M23 38 V46 M41 38 V46 M17 50 H47" />
        <path className={b.glyphSoft} d="M27 20 H37 M27 25 H37" />
      </svg>
    );
  const r = RUNES[id];
  return (
    <svg className={cls} width={size} height={size} viewBox="0 0 64 64" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {label}
      <circle cx="32" cy="32" r="29" className={b.disc} />
      <circle cx="32" cy="32" r="29" className={earned ? b.ringEarned : b.ringLocked} />
      <circle cx="32" cy="32" r="24.5" className={b.ringInner} />
      {r && <path className={b.rune} d={r.d} transform="translate(14 14) scale(1.5)" />}
    </svg>
  );
}

export const runeName = (id: BadgeId) => RUNES[id]?.rune;

function OwnerMark({ size, uid, label }: { size: number; uid: string; label: React.ReactNode }) {
  const sky = `sky-${uid}`;
  const gold = `gold-${uid}`;
  const clip = `clip-${uid}`;
  return (
    <svg className={`${b.mark} ${b.owner}`} width={size} height={size} viewBox="0 0 64 64" role={label ? 'img' : undefined} aria-hidden={label ? undefined : true}>
      {label}
      <defs>
        <radialGradient id={sky} cx="50%" cy="30%" r="75%">
          <stop offset="0" stopColor="#3a2f86" />
          <stop offset="0.55" stopColor="#17123f" />
          <stop offset="1" stopColor="#0a0820" />
        </radialGradient>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbe7a6" />
          <stop offset="0.45" stopColor="#e8b85c" />
          <stop offset="1" stopColor="#b07a22" />
        </linearGradient>
        <clipPath id={clip}>
          <circle cx="32" cy="32" r="28" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="29.5" fill={`url(#${sky})`} />
      <g clipPath={`url(#${clip})`}>
        {/* Stars over the high seat. */}
        {[
          [14, 18, 0.9],
          [48, 14, 0.7],
          [52, 40, 0.8],
          [11, 42, 0.6],
          [36, 9, 0.6],
          [24, 52, 0.5],
        ].map(([x, y, r], i) => (
          <circle key={i} className={b.star} style={{ animationDelay: `${i * 0.7}s` }} cx={x} cy={y} r={r} fill="#fbe7a6" />
        ))}
        {/* The seat far below, where everyone else sits. */}
        <path d="M27 58 V51 H37 V58 M27 51 Q32 48.5 37 51" fill="none" stroke={`url(#${gold})`} strokeWidth="1" opacity="0.55" />
        {/* The light passing over the gold (Animations on only). */}
        <rect className={b.sheen} x="-40" y="-10" width="18" height="90" fill="#fff6d8" opacity="0.18" transform="rotate(25 32 32)" />
      </g>
      {/* Odin's eye: gold rays, the eye, the iris. */}
      <g className={b.eye}>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return <line key={i} x1={32 + Math.cos(a) * 13} y1={32 + Math.sin(a) * 10} x2={32 + Math.cos(a) * 16.5} y2={32 + Math.sin(a) * 13} stroke={`url(#${gold})`} strokeWidth="0.9" strokeLinecap="round" opacity="0.7" />;
        })}
        <path d="M19 32 Q32 21 45 32 Q32 43 19 32 Z" fill="#0a0820" stroke={`url(#${gold})`} strokeWidth="1.6" />
        <circle cx="32" cy="32" r="5.2" fill={`url(#${gold})`} />
        <circle cx="32" cy="32" r="2" fill="#0a0820" />
        <circle cx="33.6" cy="30.4" r="0.9" fill="#fff6d8" />
      </g>
      {/* Huginn and Muninn, circling. */}
      <g className={b.ravens}>
        <path d={RAVEN} transform="translate(32 9.5) scale(0.95)" fill="#06050f" stroke={`url(#${gold})`} strokeWidth="0.55" />
        <path d={RAVEN} transform="translate(32 54.5) rotate(180) scale(0.95)" fill="#06050f" stroke={`url(#${gold})`} strokeWidth="0.55" />
      </g>
      <circle cx="32" cy="32" r="29.5" fill="none" stroke={`url(#${gold})`} strokeWidth="2.6" />
      <circle cx="32" cy="32" r="26.6" fill="none" stroke={`url(#${gold})`} strokeWidth="0.6" opacity="0.7" />
    </svg>
  );
}
