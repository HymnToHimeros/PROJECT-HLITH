import { useId } from 'react';
import { REWARD_BADGES, REWARD_FRAMES } from './pool';
import './rewards.css';

/** Reward pictures (T67), from the pool in pool.ts. An unknown key draws nothing. */

export function RewardBadge({ art, size, title }: { art: string; size: number; title?: string | undefined }) {
  const a = REWARD_BADGES[art];
  if (!a) return null;
  // Fixed drawings from pool.ts, never anything a person typed.
  return <svg className="ra-art" width={size} height={size} viewBox="-32 -32 64 64" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} dangerouslySetInnerHTML={{ __html: a.body }} />;
}

/** A round picture in a reward frame; the whole drawing fits in `size` px. */
export function RewardFrame({ art, src, letter, size }: { art: string; src: string | null; letter: string; size: number }) {
  const clip = `ra-pic-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const a = REWARD_FRAMES[art];
  if (!a) return null;
  return (
    <svg className="ra-art" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" style={{ flex: 'none' }}>
      <g dangerouslySetInnerHTML={{ __html: a.under }} />
      <clipPath id={clip}>
        <circle cx="50" cy="50" r="35" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect x="15" y="15" width="70" height="70" fill="#1b2230" />
        {src ? (
          <image href={src} x="15" y="15" width="70" height="70" preserveAspectRatio="xMidYMin slice" />
        ) : (
          <text x="50" y="50" dominantBaseline="central" textAnchor="middle" fill="#cfe3ef" fontWeight="700" fontSize="27" fontFamily="var(--font-numbers)">
            {letter.charAt(0).toUpperCase() || '?'}
          </text>
        )}
      </g>
      <g dangerouslySetInnerHTML={{ __html: a.over }} />
    </svg>
  );
}

export function RewardName({ art, text }: { art: string; text: string }) {
  return <span className={`ra-name ${art.startsWith('r-name-') ? `ra-${art.slice(2)}` : ''}`}>{text}</span>;
}

/** Any reward item's picture at a given size: a badge, a framed letter, or a name sample. */
export function RewardPreview({ kind, art, size, sample }: { kind: 'badge' | 'frame' | 'name'; art: string; size: number; sample: string }) {
  if (kind === 'badge') return <RewardBadge art={art} size={size} />;
  if (kind === 'frame') return <RewardFrame art={art} src={null} letter={sample} size={size} />;
  return <RewardName art={art} text={sample} />;
}
