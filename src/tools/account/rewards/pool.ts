/**
 * The reward pool (T67): pictures the owner can give out as exclusive rewards. An item in the
 * Owner console → Rewards picks one of these by its key ("r-<kind>-…"); the server accepts only
 * keys of that shape, so the owner's own badges, frames and name styles can never be given.
 * New event designs are drawn like the option sheets and added here.
 * Drawings are fixed text, never anything a person typed. Classes start with "ra-".
 */

export type RewardKind = 'badge' | 'frame' | 'name';

export interface PoolEntry {
  art: string;
  kind: RewardKind;
  /** Suggested name for a new item. */
  name: string;
  line: string;
}

export interface BadgeArt {
  /** viewBox -32 -32 64 64 */
  body: string;
}
/** A frame around a round picture: viewBox 0 0 100 100, the picture is a circle r 34 at the centre. */
export interface FrameArt {
  under: string;
  over: string;
}

export const REWARD_BADGES: Record<string, BadgeArt> = {
  'r-badge-lantern': {
    body: `<path d="M0 -30 V-22" stroke="#8a6a3a" stroke-width="1.6"/>
<g class="ra-sway">
<circle class="ra-glow" cx="0" cy="2" r="24" fill="#ffb347" opacity="0.22"/>
<rect x="-9" y="-22" width="18" height="5" rx="1.5" fill="#3a2414" stroke="#e8b85c" stroke-width="1"/>
<path d="M-9 -17 Q-19 2 -9 21 H9 Q19 2 9 -17 Z" fill="#c8361d" stroke="#e8b85c" stroke-width="1.2"/>
<path d="M-3 -17 Q-7 2 -3 21 M3 -17 Q7 2 3 21" fill="none" stroke="#f2c86a" stroke-width="0.8" opacity="0.7"/>
<ellipse class="ra-flame" cx="0" cy="4" rx="5" ry="8" fill="#ffd27a"/>
<rect x="-9" y="21" width="18" height="4" rx="1.5" fill="#3a2414" stroke="#e8b85c" stroke-width="1"/>
<path d="M0 25 V30 M-3 30 H3" stroke="#e8b85c" stroke-width="1.2"/>
</g>`,
  },
  'r-badge-starfall': {
    body: `<circle r="27" fill="#141b33" stroke="#9fb4ff" stroke-width="1.6"/>
<circle r="22" fill="none" stroke="#4b5c99" stroke-width="0.8" stroke-dasharray="2 3"/>
<g fill="#cfd8ff"><circle cx="-12" cy="-10" r="0.9"/><circle cx="10" cy="-15" r="0.7"/><circle cx="15" cy="8" r="0.8"/><circle cx="-16" cy="9" r="0.6"/><circle cx="-4" cy="16" r="0.7"/></g>
<g class="ra-fall">
<path d="M14 -14 L-2 2" stroke="#e8f0ff" stroke-width="2.2" stroke-linecap="round" opacity="0.55"/>
<path d="M18 -18 L6 -6" stroke="#e8f0ff" stroke-width="1.2" stroke-linecap="round" opacity="0.35"/>
<path class="ra-glow" d="M-4 -1 L-1.2 4.6 L5 5.4 L0.4 9.6 L1.6 15.8 L-4 12.8 L-9.6 15.8 L-8.4 9.6 L-13 5.4 L-6.8 4.6 Z" fill="#ffe08a" stroke="#fff3c4" stroke-width="0.8"/>
</g>`,
  },
  'r-badge-forge': {
    body: `<circle r="27" fill="#1d1612" stroke="#b07a3c" stroke-width="1.6"/>
<path d="M-17 10 H17 L13 4 H-6 Q-12 4 -15 0 H-19 Q-19 7 -17 10 Z" fill="#5d6670" stroke="#aab4be" stroke-width="1"/>
<path d="M-9 10 L-11 18 H11 L9 10 Z" fill="#454c55" stroke="#aab4be" stroke-width="1"/>
<g class="ra-hammer">
<rect x="-2" y="-22" width="4" height="22" rx="1.5" fill="#8a5a2b" transform="rotate(-35 0 0)"/>
<rect x="-9" y="-26" width="14" height="8" rx="1.5" fill="#9aa3ad" stroke="#d6dde4" stroke-width="0.8" transform="rotate(-35 0 0)"/>
</g>
<g class="ra-sparks" fill="#ffc35a"><circle cx="4" cy="0" r="1.3"/><circle cx="9" cy="-4" r="1"/><circle cx="1" cy="-6" r="0.9"/><circle cx="12" cy="1" r="0.8"/></g>`,
  },
};

const pic = '<circle cx="50" cy="50" r="36" fill="none" stroke="#0b0d11" stroke-width="2"/>';

export const REWARD_FRAMES: Record<string, FrameArt> = {
  'r-frame-aurora': {
    under: `<circle cx="50" cy="50" r="44" fill="#0e1a24"/>`,
    over: `${pic}
<g class="ra-spin" style="transform-origin:50px 50px">
<path d="M50 8 A42 42 0 0 1 92 50" fill="none" stroke="#3fe0b0" stroke-width="5" stroke-linecap="round" opacity="0.85"/>
<path d="M88 66 A42 42 0 0 1 30 87" fill="none" stroke="#7aa8ff" stroke-width="5" stroke-linecap="round" opacity="0.85"/>
<path d="M18 76 A42 42 0 0 1 22 22" fill="none" stroke="#b07cff" stroke-width="5" stroke-linecap="round" opacity="0.85"/>
</g>
<circle class="ra-glow" cx="50" cy="50" r="40" fill="none" stroke="#bff6e6" stroke-width="0.8" opacity="0.5"/>`,
  },
  'r-frame-ember': {
    under: `<circle cx="50" cy="50" r="40" fill="#2a120a"/>`,
    over: `${pic}
<circle cx="50" cy="50" r="38" fill="none" stroke="#e8742a" stroke-width="3"/>
<g class="ra-flicker" fill="#ff8a2b">
${Array.from({ length: 12 }, (_, i) => {
  const a = (i * 30 * Math.PI) / 180;
  const x = 50 + Math.cos(a) * 40;
  const y = 50 + Math.sin(a) * 40;
  const deg = i * 30 + 90;
  return `<path class="ra-tongue" style="animation-delay:${(i % 4) * 0.25}s;transform-origin:${x.toFixed(1)}px ${y.toFixed(1)}px" d="M${x.toFixed(1)} ${y.toFixed(1)} m-3 0 q3 -10 3 -12 q0 2 3 12 z" transform="rotate(${deg} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${i % 2 ? '#ffc04a' : '#ff6a1f'}"/>`;
}).join('\n')}
</g>`,
  },
  'r-frame-runestone': {
    under: `<rect x="6" y="6" width="88" height="88" rx="10" fill="#4a4f57" stroke="#2c3036" stroke-width="2"/>
<rect x="10" y="10" width="80" height="80" rx="8" fill="none" stroke="#6b717a" stroke-width="1"/>`,
    over: `${pic}
<g font-family="serif" font-size="9" fill="#8fd6ff" text-anchor="middle" class="ra-runes">
<text x="50" y="16">ᚱ ᚢ ᚾ ᛖ</text><text x="50" y="91">ᛊ ᛏ ᛟ ᚾ</text>
<text x="13" y="53" transform="rotate(-90 13 50)">ᚺ ᛚ ᛁ</text><text x="87" y="53" transform="rotate(90 87 50)">ᚦ ᛃ ᚨ</text>
</g>
<g fill="#2c3036"><circle cx="14" cy="14" r="2"/><circle cx="86" cy="14" r="2"/><circle cx="14" cy="86" r="2"/><circle cx="86" cy="86" r="2"/></g>`,
  },
};

export const REWARD_NAMES = ['r-name-aurora', 'r-name-ember', 'r-name-frost'] as const;

export const REWARD_POOL: readonly PoolEntry[] = [
  { art: 'r-badge-lantern', kind: 'badge', name: 'Lantern', line: 'A paper lantern that sways and glows.' },
  { art: 'r-badge-starfall', kind: 'badge', name: 'Starfall', line: 'A falling star across a night medallion.' },
  { art: 'r-badge-forge', kind: 'badge', name: 'First Forge', line: 'A hammer striking sparks on an anvil.' },
  { art: 'r-frame-aurora', kind: 'frame', name: 'Aurora Ring', line: 'Three ribbons of northern light circling.' },
  { art: 'r-frame-ember', kind: 'frame', name: 'Ember Crown', line: 'Twelve flickering flame tongues.' },
  { art: 'r-frame-runestone', kind: 'frame', name: 'Runestone', line: 'A carved stone slab with glowing runes.' },
  { art: 'r-name-aurora', kind: 'name', name: 'Aurora', line: 'Green, blue and violet drifting through the letters.' },
  { art: 'r-name-ember', kind: 'name', name: 'Embers', line: 'Warm orange that flickers like a fire.' },
  { art: 'r-name-frost', kind: 'name', name: 'Frost', line: 'Pale ice with a light passing over it.' },
];

export const poolEntry = (art: string) => REWARD_POOL.find((p) => p.art === art);
