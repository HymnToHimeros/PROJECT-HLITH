import { memo, type CSSProperties } from 'react';
import { ACCENT_SHAPES, MOTIF_LAYERS, TEXTURE_LAYERS, type Layer } from './ornamentIds';
import o from './ornaments.module.css';

export { ACCENT_SHAPES, MOTIF_LAYERS, TEXTURE_LAYERS, type Layer };

/**
 * Generic background layers a theme can switch on (T74): motifs with slow motion, surface
 * textures and accent shapes. Nothing here belongs to any one theme: a theme (in the private
 * theme store) picks layers by id, and its own colours paint them (--rarity-top is
 * the warm light, --glacier the cool one, --art-glow the haze). Motion runs only with Animations
 * on (art.module.css stills the whole layer otherwise).
 */

const seq = (n: number) => Array.from({ length: n }, (_, i) => i);
/** Fixed pseudo-random spread (the same on every load). */
const rnd = (i: number, k = 1) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;

function Motif({ id }: { id: Layer }) {
  switch (id) {
    case 'orbit-light':
      // A warm and a cool light crossing the sky on a long, slow arc.
      return (
        <div className={o.orbit}>
          <span className={o.orbitWarm} />
          <span className={o.orbitCool} />
          <svg className={o.orbitPath} viewBox="0 0 100 40" preserveAspectRatio="none">
            <path d="M-5 38 Q50 -14 105 38" fill="none" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      );
    case 'corona-ring':
      // A dark disc with a thin glowing ring that breathes.
      return (
        <svg className={o.corona} viewBox="0 0 200 200">
          <defs>
            <radialGradient id="ol-corona">
              <stop offset="58%" stopColor="var(--rarity-top)" stopOpacity="0" />
              <stop offset="64%" stopColor="var(--rarity-top)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--rarity-top)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle className={o.coronaGlow} cx="100" cy="100" r="96" fill="url(#ol-corona)" />
          <circle cx="100" cy="100" r="58" fill="var(--bg-app)" />
          <circle cx="100" cy="100" r="58" fill="none" stroke="var(--rarity-top)" strokeOpacity="0.7" strokeWidth="0.8" />
          <circle className={o.coronaSpin} cx="100" cy="100" r="74" fill="none" stroke="var(--glacier)" strokeOpacity="0.35" strokeWidth="0.6" strokeDasharray="2 9" />
        </svg>
      );
    case 'phase-band':
      // The moon's phases along the top edge, each brightening in turn.
      return (
        <div className={o.phases}>
          {seq(9).map((i) => {
            const f = i / 8;
            return (
              <svg key={i} viewBox="-10 -10 20 20" style={{ '--i': i } as CSSProperties}>
                <circle r="8" fill="none" stroke="var(--glacier)" strokeOpacity="0.5" strokeWidth="0.6" />
                <path d={`M0 -8 A8 8 0 0 1 0 8 A${Math.abs(8 - f * 16)} 8 0 0 ${f < 0.5 ? 0 : 1} 0 -8 Z`} fill="var(--glacier)" fillOpacity="0.55" />
              </svg>
            );
          })}
        </div>
      );
    case 'ember-rise':
      // Small embers rising from the bottom, swaying as they go.
      return (
        <div className={o.embers}>
          {seq(16).map((i) => (
            <i key={i} style={{ left: `${rnd(i) * 100}%`, animationDelay: `${rnd(i, 2) * -14}s`, animationDuration: `${10 + rnd(i, 3) * 8}s`, '--s': `${2 + rnd(i, 4) * 3}px` } as CSSProperties} />
          ))}
        </div>
      );
    case 'frost-trail':
      // Frost crystals in the corners and a trail of prints fading in and out.
      return (
        <div className={o.frost}>
          {[o.frostTl, o.frostBr].map((c, k) => (
            <svg key={k} className={c} viewBox="-50 -50 100 100">
              {seq(6).map((i) => (
                <g key={i} transform={`rotate(${i * 60})`}>
                  <path d="M0 0 V-44 M0 -18 L-9 -27 M0 -18 L9 -27 M0 -32 L-6 -38 M0 -32 L6 -38" fill="none" stroke="var(--glacier)" strokeOpacity="0.5" strokeWidth="1" />
                </g>
              ))}
            </svg>
          ))}
          <div className={o.prints}>
            {seq(8).map((i) => (
              <svg key={i} viewBox="-6 -6 12 12" style={{ '--i': i, left: `${8 + i * 11}%`, top: `${72 - (i % 2) * 5 - i * 3}%` } as CSSProperties}>
                <ellipse cy="2" rx="3" ry="2.6" fill="var(--glacier)" />
                {[-3.2, -1.1, 1.1, 3.2].map((x, j) => (
                  <circle key={j} cx={x} cy={j === 0 || j === 3 ? -2.2 : -3.6} r="1.1" fill="var(--glacier)" />
                ))}
              </svg>
            ))}
          </div>
        </div>
      );
    case 'storm-streaks':
      // Slanted rain, and now and then a faint flash with a fork of light.
      return (
        <div className={o.storm}>
          <span className={o.rain} />
          <span className={o.flash} />
          <svg className={o.fork} viewBox="0 0 60 120">
            <path d="M40 0 L28 44 L38 46 L18 120 M28 44 L12 58" fill="none" stroke="var(--glacier)" strokeWidth="1.4" strokeOpacity="0.8" />
          </svg>
        </div>
      );
    case 'aurora-veil':
      // Soft curtains of light waving across the top.
      return (
        <svg className={o.aurora} viewBox="0 0 400 140" preserveAspectRatio="none">
          <defs>
            <linearGradient id="ol-aurora" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--glacier)" stopOpacity="0" />
              <stop offset="45%" stopColor="var(--glacier)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="var(--rarity-top)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {seq(3).map((i) => (
            <path key={i} className={o.curtain} style={{ '--i': i } as CSSProperties} d={`M0 ${30 + i * 18} C80 ${10 + i * 10} 140 ${70 + i * 8} 220 ${40 + i * 12} S340 ${20 + i * 14} 400 ${50 + i * 10} V140 H0 Z`} fill="url(#ol-aurora)" opacity={0.6 - i * 0.15} />
          ))}
        </svg>
      );
    case 'knot-band':
      // An interlaced band down both sides, its lines slowly flowing.
      return (
        <div className={o.knots}>
          {[o.knotL, o.knotR].map((c, k) => (
            <svg key={k} className={c} viewBox="0 0 40 400" preserveAspectRatio="none">
              <path className={o.knotLine} d="M10 0 C40 25 0 75 30 100 S0 175 30 200 S0 275 30 300 S0 375 30 400" fill="none" stroke="var(--rarity-top)" strokeOpacity="0.6" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              <path className={o.knotLine2} d="M30 0 C0 25 40 75 10 100 S40 175 10 200 S40 275 10 300 S40 375 10 400" fill="none" stroke="var(--glacier)" strokeOpacity="0.45" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
          ))}
        </div>
      );
    case 'shield-row':
      // Round shields along the bottom edge, lit by a flickering warm glow.
      return (
        <div className={o.shields}>
          <span className={o.torch} />
          <svg viewBox="0 0 400 60" preserveAspectRatio="xMidYMax slice">
            {seq(9).map((i) => (
              <g key={i} transform={`translate(${24 + i * 44} 44)`}>
                <circle r="20" fill="var(--bg-card)" stroke="var(--rarity-top)" strokeOpacity="0.6" strokeWidth="1.4" />
                <circle r="6" fill="var(--rarity-top)" fillOpacity="0.35" />
                <path d="M-20 0 H20 M0 -20 V20" stroke="var(--rarity-top)" strokeOpacity="0.2" strokeWidth="1" />
              </g>
            ))}
          </svg>
        </div>
      );
    case 'sound-rings':
      // Rings of sound spreading out from one corner, one after another.
      return (
        <svg className={o.rings} viewBox="0 0 200 200">
          {seq(5).map((i) => (
            <circle key={i} className={o.ring} style={{ '--i': i } as CSSProperties} cx="0" cy="200" r="40" fill="none" stroke="var(--glacier)" strokeWidth="1" />
          ))}
        </svg>
      );
    case 'starfield':
      return <span className={o.starfield} />;
    case 'grain':
      return <span className={o.grain} />;
    case 'hex-mesh':
      return <span className={o.hex} />;
    case 'rune-rows':
      return <span className={o.runes} />;
  }
}

/** Every layer the theme asked for, in a fixed order (textures under motifs). */
export const OrnamentLayers = memo(function OrnamentLayers({ ids }: { ids: readonly string[] }) {
  const layers = [...TEXTURE_LAYERS, ...MOTIF_LAYERS].filter((l) => ids.includes(l));
  return (
    <>
      {layers.map((l) => (
        <Motif key={l} id={l} />
      ))}
    </>
  );
});
