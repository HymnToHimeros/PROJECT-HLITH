import { memo, type ReactNode } from 'react';
import type { Theme } from './themes';
import a from './art.module.css';

/*
 * The background art behind every page: hand-drawn vector ornaments (wings, rings,
 * runes, ravens, thorns, rays, star glints), all generated here, no image files.
 * The whole layer shows at --art-opacity, so text on the page keeps its contrast
 * (tests/themes.test.ts checks text over the strongest point of the art). Cards keep
 * their solid backgrounds. Decoration only: hidden from screen readers.
 */

// ── Building blocks ─────────────────────────────────────────────────

/** Same "random" stars every time. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => Math.round(n * 10) / 10;

/** A four-point glint. */
const glint = (x: number, y: number, r: number) => {
  const k = r * 0.22;
  return `M${f(x)} ${f(y - r)}L${f(x + k)} ${f(y - k)}L${f(x + r)} ${f(y)}L${f(x + k)} ${f(y + k)}L${f(x)} ${f(y + r)}L${f(x - k)} ${f(y + k)}L${f(x - r)} ${f(y)}L${f(x - k)} ${f(y - k)}Z`;
};

function Stars({ seed, n, w, h, big = 6 }: { seed: number; n: number; w: number; h: number; big?: number }) {
  const r = rng(seed);
  const dots: string[] = [];
  const glints: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = r() * h;
    const s = r();
    if (i < big) {
      glints.push(<path key={i} d={glint(x, y, 7 + s * 9)} className={i % 2 ? a.twinkle : a.twinkleSlow} style={{ animationDelay: `${f(-s * 9)}s` }} />);
    } else {
      const rad = 0.6 + s * 1.3;
      dots.push(`M${f(x - rad)} ${f(y)}a${f(rad)} ${f(rad)} 0 1 0 ${f(rad * 2)} 0a${f(rad)} ${f(rad)} 0 1 0 ${f(-rad * 2)} 0`);
    }
  }
  return (
    <g fill="currentColor" stroke="none">
      <path d={dots.join('')} opacity={0.7} />
      {glints}
    </g>
  );
}

/** Thin light rays fanning out of one point. */
function Rays({ x, y, n, from, to, len, id }: { x: number; y: number; n: number; from: number; to: number; len: number; id: string }) {
  const r = rng(n * 31 + len);
  const d: string[] = [];
  for (let i = 0; i < n; i++) {
    const ang = ((from + ((to - from) * (i + 0.5)) / n + (r() - 0.5) * 4) * Math.PI) / 180;
    const w = (0.6 + r() * 1.6) * (Math.PI / 180);
    const l = len * (0.6 + r() * 0.4);
    d.push(`M${x} ${y}L${f(x + Math.cos(ang - w) * l)} ${f(y + Math.sin(ang - w) * l)}L${f(x + Math.cos(ang + w) * l)} ${f(y + Math.sin(ang + w) * l)}Z`);
  }
  return (
    <>
      <defs>
        <radialGradient id={id} cx={x} cy={y} r={len} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--art-glow)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--art-glow)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={d.join('')} fill={`url(#${id})`} stroke="none" />
    </>
  );
}

/** A soft round glow in the theme's glow colour. */
function Glow({ x, y, r, id, strength = 0.8 }: { x: number; y: number; r: number; id: string; strength?: number }) {
  return (
    <>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor="var(--art-glow)" stopOpacity={strength} />
          <stop offset="1" stopColor="var(--art-glow)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={x} cy={y} r={r} fill={`url(#${id})`} stroke="none" />
    </>
  );
}

// Elder Futhark runes, drawn as strokes in a 1×1 box (fonts rarely carry them).
const RUNES = [
  'M.3 0V1M.3 .2L.75 0M.3 .45L.75 .25', // fehu
  'M.25 1V0L.75 .3V1', // uruz
  'M.3 0V1M.3 .3L.7 .5L.3 .7', // thurisaz
  'M.3 0V1M.3 0L.7 .25M.3 .3L.7 .55', // ansuz
  'M.3 1V0L.7 .25L.3 .5L.7 1', // raido
  'M.7 0L.3 .5L.7 1', // kaunan
  'M.2 0L.8 1M.8 0L.2 1', // gebo
  'M.25 0V1M.75 0V1M.25 .35L.75 .65', // hagalaz
  'M.5 0V1M.3 .35L.7 .65', // naudiz
  'M.5 0V1', // isaz
  'M.5 0V1M.5 .4L.2 0M.5 .4L.8 0', // algiz
  'M.7 0L.3 .4L.7 .6L.3 1', // sowilo
  'M.5 0V1M.2 .3L.5 0L.8 .3', // tiwaz
  'M.3 0V1L.7 .75L.3 .5L.7 .25L.3 0', // berkanan
  'M.25 0V1M.75 0V1M.25 0L.75 .45M.75 0L.25 .45', // mannaz
  'M.35 1V0L.7 .3', // laguz
  'M.2 0V1L.8 0V1L.2 0', // dagaz
];

/** Runes standing around a circle. */
function RuneRing({ x, y, r, size, count, start = 0 }: { x: number; y: number; r: number; size: number; count: number; start?: number }) {
  const out: ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const deg = (360 * i) / count;
    out.push(
      <path
        key={i}
        d={RUNES[(i + start) % RUNES.length]}
        transform={`rotate(${f(deg)} ${x} ${y}) translate(${f(x - size / 2)} ${f(y - r - size / 2)}) scale(${size})`}
        strokeWidth={1.4 / size}
      />,
    );
  }
  return <g fill="none">{out}</g>;
}

/** Concentric rings with tick marks: an astrolabe, or the high seat's view of the nine worlds. */
function Rings({ x, y, r, ticks = 72 }: { x: number; y: number; r: number; ticks?: number }) {
  const t: string[] = [];
  for (let i = 0; i < ticks; i++) {
    const ang = (2 * Math.PI * i) / ticks;
    const long = i % 6 === 0;
    const r1 = r * 0.92;
    const r2 = r * (long ? 0.84 : 0.88);
    t.push(`M${f(x + Math.cos(ang) * r1)} ${f(y + Math.sin(ang) * r1)}L${f(x + Math.cos(ang) * r2)} ${f(y + Math.sin(ang) * r2)}`);
  }
  return (
    <g fill="none">
      <circle cx={x} cy={y} r={r} />
      <circle cx={x} cy={y} r={r * 0.94} strokeWidth={0.6} />
      <path d={t.join('')} strokeWidth={0.8} />
      <circle cx={x} cy={y} r={r * 0.62} strokeDasharray="2 7" />
      <circle cx={x} cy={y} r={r * 0.4} strokeWidth={0.7} />
      <circle cx={x} cy={y} r={r * 1.18} strokeWidth={0.5} strokeDasharray="1 5" />
    </g>
  );
}

/** Nine points (the nine worlds) joined as a nine-pointed star, with Yggdrasil's axis through the middle. */
function NineWorlds({ x, y, r }: { x: number; y: number; r: number }) {
  const pts = Array.from({ length: 9 }, (_, i) => {
    const ang = -Math.PI / 2 + (2 * Math.PI * i) / 9;
    return [x + Math.cos(ang) * r, y + Math.sin(ang) * r] as const;
  });
  const star = pts.map((_, i) => pts[(i * 4) % 9] as readonly [number, number]);
  const d = `M${star.map(([px, py]) => `${f(px)} ${f(py)}`).join('L')}Z`;
  return (
    <g>
      <path d={d} fill="none" strokeWidth={0.8} />
      <path d={`M${x} ${f(y - r * 1.3)}V${f(y + r * 1.3)}`} fill="none" strokeWidth={0.6} />
      {pts.map(([px, py], i) => (
        <circle key={i} cx={f(px)} cy={f(py)} r={3} fill="currentColor" />
      ))}
      <circle cx={x} cy={y} r={5} fill="currentColor" />
    </g>
  );
}

/** One feathered wing, drawn as line work. Shoulder at 0,0, reaching right and up. */
function Wing({ flip = false, transform }: { flip?: boolean; transform: string }) {
  const out: string[] = [];
  const arm = (t: number) => {
    // Quadratic from the shoulder (0,0) via (150,-230) to the wrist tip (400,-240).
    const u = 1 - t;
    return [2 * u * t * 150 + t * t * 400, 2 * u * t * -230 + t * t * -240] as const;
  };
  const feather = (bx: number, by: number, deg: number, l: number, w: number) => {
    const rad = (deg * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const p = (px: number, py: number) => `${f(bx + px * c - py * s)} ${f(by + px * s + py * c)}`;
    out.push(`M${p(0, 0)}C${p(l * 0.3, -w)} ${p(l * 0.82, -w * 0.7)} ${p(l, 0)}C${p(l * 0.8, w * 0.45)} ${p(l * 0.3, w * 0.7)} ${p(0, 0)}M${p(l * 0.08, 0)}L${p(l * 0.9, 0)}`);
  };
  const rows: [number, number, number, number, number, number][] = [
    // count, angle from, angle to, length from, length to, width
    [13, 104, 28, 150, 360, 15],
    [11, 98, 36, 80, 170, 12],
    [8, 92, 50, 42, 80, 9],
  ];
  rows.forEach(([n, a0, a1, l0, l1, w], row) => {
    for (let i = 0; i < n; i++) {
      const t = 0.06 + (0.94 * i) / (n - 1);
      const [bx, by] = arm(t * (1 - row * 0.12));
      feather(bx, by, a0 + (a1 - a0) * t, l0 + (l1 - l0) * t ** 1.3, w);
    }
  });
  return (
    <g transform={flip ? `${transform} scale(-1 1)` : transform} fill="none">
      <path d={out.join('')} />
      <path d="M0 0Q150 -230 400 -240" strokeWidth={2} />
    </g>
  );
}

/** A raven in flight (Huginn or Muninn), seen from below: fingered wingtips, wedge tail. 100 × 60 box. */
const RAVEN =
  'M50 13L52.5 20L53 27C60 24 72 18 98 20L92 26L95 27L88 31L91 32L83 35L85 36.5L74 38C66 39 60 39 55 40L56 52L50 56L44 52L45 40C40 39 34 39 26 38L15 36.5L17 35L9 32L12 31L5 27L8 26L2 20C28 18 40 24 47 27L47.5 20Z';

function Raven({ x, y, s, flip = false }: { x: number; y: number; s: number; flip?: boolean }) {
  return <path d={RAVEN} fill="currentColor" transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s}) translate(-50 -32)`} />;
}

/** A smooth Catmull-Rom curve through the points: t in 0..1 → a point on it. */
function spline(d: [number, number][]) {
  return (t: number) => {
    const seg = Math.min(d.length - 2, Math.floor(t * (d.length - 1)));
    const u = t * (d.length - 1) - seg;
    const p0 = d[Math.max(0, seg - 1)] as [number, number];
    const p1 = d[seg] as [number, number];
    const p2 = d[seg + 1] as [number, number];
    const p3 = d[Math.min(d.length - 1, seg + 2)] as [number, number];
    const cr = (a0: number, a1: number, a2: number, a3: number) => 0.5 * (2 * a1 + (-a0 + a2) * u + (2 * a0 - 5 * a1 + 4 * a2 - a3) * u * u + (-a0 + 3 * a1 - 3 * a2 + a3) * u * u * u);
    return [cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])] as const;
  };
}

/** The spline as a path. */
const splinePath = (d: [number, number][], steps = 60) => {
  const pt = spline(d);
  return `M${Array.from({ length: steps + 1 }, (_, i) => pt(i / steps))
    .map(([x, y]) => `${f(x)} ${f(y)}`)
    .join('L')}`;
};

/** A thorned vine along a gentle curve. */
function Thorns({ d, n, seed }: { d: [number, number][]; n: number; seed: number }) {
  // Catmull-Rom through the points, sampled for thorn positions.
  const r = rng(seed);
  const pt = spline(d);
  const steps = 80;
  const line = Array.from({ length: steps + 1 }, (_, i) => pt(i / steps));
  const thorns: string[] = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const [x0, y0] = pt(t - 0.004);
    const [x1, y1] = pt(t + 0.004);
    const [x, y] = pt(t);
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    const side = i % 2 ? 1 : -1;
    const h = 9 + r() * 9;
    const tx = (x1 - x0) / len;
    const ty = (y1 - y0) / len;
    thorns.push(`M${f(x - tx * 5)} ${f(y - ty * 5)}L${f(x + nx * h * side + tx * 4)} ${f(y + ny * h * side + ty * 4)}L${f(x + tx * 5)} ${f(y + ty * 5)}Z`);
  }
  return (
    <g>
      <path d={`M${line.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}`} fill="none" strokeWidth={2.2} />
      <path d={thorns.join('')} fill="currentColor" />
    </g>
  );
}

/** A rose as open line work: petals curling round a centre. */
function Rose({ x, y, r, rot = 0 }: { x: number; y: number; r: number; rot?: number }) {
  const d: string[] = [];
  for (let i = 0; i < 7; i++) {
    const rr = r * (1 - i * 0.12);
    const a0 = (rot + i * 52) * (Math.PI / 180);
    const a1 = a0 + Math.PI * 1.15;
    d.push(`M${f(x + Math.cos(a0) * rr)} ${f(y + Math.sin(a0) * rr)}A${f(rr)} ${f(rr * 0.86)} ${rot} 0 1 ${f(x + Math.cos(a1) * rr)} ${f(y + Math.sin(a1) * rr)}`);
  }
  // Outer petals.
  for (let i = 0; i < 5; i++) {
    const ang = (rot + i * 72) * (Math.PI / 180);
    const px = x + Math.cos(ang) * r * 1.15;
    const py = y + Math.sin(ang) * r * 1.15;
    d.push(`M${f(x + Math.cos(ang - 0.7) * r)} ${f(y + Math.sin(ang - 0.7) * r)}Q${f(px + Math.cos(ang) * r * 0.5)} ${f(py + Math.sin(ang) * r * 0.5)} ${f(x + Math.cos(ang + 0.7) * r)} ${f(y + Math.sin(ang + 0.7) * r)}`);
  }
  return <path d={d.join('')} fill="none" strokeWidth={1.6} />;
}

/** A compass-like sigil: eight staves with different ends, inside a ring (after the Icelandic Vegvísir form). */
function Sigil({ x, y, r }: { x: number; y: number; r: number }) {
  const d: string[] = [];
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4 - Math.PI / 2;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const p = (along: number, across: number) => `${f(x + c * along - s * across)} ${f(y + s * along + c * across)}`;
    d.push(`M${p(r * 0.14, 0)}L${p(r * 0.86, 0)}`);
    const k = r * 0.1;
    switch (i % 4) {
      case 0:
        d.push(`M${p(r * 0.86, -k)}L${p(r * 0.86, k)}M${p(r * 0.7, -k)}L${p(r * 0.7, k)}`);
        break;
      case 1:
        d.push(`M${p(r * 0.62, 0)}L${p(r * 0.86, -k * 1.4)}M${p(r * 0.62, 0)}L${p(r * 0.86, k * 1.4)}`);
        break;
      case 2:
        d.push(`M${p(r * 0.86 + k, 0)}m-${f(k)} 0a${f(k)} ${f(k)} 0 1 0 ${f(k * 2)} 0a${f(k)} ${f(k)} 0 1 0 -${f(k * 2)} 0`);
        break;
      default:
        d.push(`M${p(r * 0.76, -k)}L${p(r * 0.86, 0)}L${p(r * 0.76, k)}M${p(r * 0.5, -k)}L${p(r * 0.5, k)}`);
    }
  }
  return (
    <g fill="none">
      <circle cx={x} cy={y} r={r} />
      <circle cx={x} cy={y} r={r * 0.12} />
      <path d={d.join('')} strokeWidth={1.2} />
    </g>
  );
}

/** Mirrored ornament curls with small spikes, like thorn or tribal line work. */
function Filigree({ x, y, s }: { x: number; y: number; s: number }) {
  const half = 'M0 0C40 -6 70 -30 80 -60C86 -78 78 -92 64 -90C52 -88 52 -72 62 -70M80 -60C96 -40 130 -34 160 -40M40 -10L52 -26M110 -38L118 -54M150 -40L170 -36L150 -32M0 0C30 10 60 30 70 56M70 56L62 66M70 56L80 64';
  return (
    <g fill="none" transform={`translate(${x} ${y}) scale(${s})`} strokeWidth={1.6 / s}>
      <path d={half} />
      <path d={half} transform="scale(-1 1)" />
      <path d={glint(0, -6, 10)} fill="currentColor" />
    </g>
  );
}

/** A cloud edge as soft overlapping arcs (light rays break through it). */
const CLOUD = 'M0 60C10 30 50 24 66 40C74 10 120 0 140 28C156 8 200 10 208 40C232 30 262 44 260 64';

/** An almond petal or leaf from its base (bx, by), pointing at deg, with a midrib. Sakura petals get a notched tip. */
const petal = (bx: number, by: number, deg: number, l: number, w: number, notch = false, rib = true) => {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const p = (px: number, py: number) => `${f(bx + px * c - py * s)} ${f(by + px * s + py * c)}`;
  const tip = notch
    ? `C${p(l * 0.82, -w)} ${p(l, -w * 0.6)} ${p(l, -w * 0.25)}L${p(l * 0.86, 0)}L${p(l, w * 0.25)}C${p(l, w * 0.6)} ${p(l * 0.82, w)}`
    : `C${p(l * 0.75, -w)} ${p(l, -w * 0.2)} ${p(l, 0)}C${p(l, w * 0.2)} ${p(l * 0.75, w)}`;
  return `M${p(0, 0)}C${p(l * 0.15, -w * 0.9)} ${p(l * 0.4, -w)} ${p(l * 0.55, -w)}${tip} ${p(l * 0.55, w)}C${p(l * 0.4, w)} ${p(l * 0.15, w * 0.9)} ${p(0, 0)}${rib ? `M${p(l * 0.1, 0)}L${p(l * 0.75, 0)}` : ''}`;
};

/** A night flower opening: rings of pointed petals round a centre, with stamens. */
function Bloom({ x, y, r, petals = 8, layers = 3, rot = 0 }: { x: number; y: number; r: number; petals?: number; layers?: number; rot?: number }) {
  const d: string[] = [];
  for (let k = 0; k < layers; k++) {
    const len = r * (1 - k * 0.24);
    for (let i = 0; i < petals; i++) d.push(petal(x, y, rot + (360 * (i + k * 0.5)) / petals, len, len * 0.3, false, k === 0));
  }
  const stamens: string[] = [];
  const dots: ReactNode[] = [];
  for (let i = 0; i < 7; i++) {
    const ang = ((rot - 90 + (i - 3) * 16) * Math.PI) / 180;
    const ex = x + Math.cos(ang) * r * 0.42;
    const ey = y + Math.sin(ang) * r * 0.42;
    stamens.push(`M${x} ${y}L${f(ex)} ${f(ey)}`);
    dots.push(<circle key={i} cx={f(ex)} cy={f(ey)} r={f(Math.max(2, r * 0.025))} fill="currentColor" stroke="none" />);
  }
  return (
    <g fill="none">
      <path d={d.join('')} />
      <path d={stamens.join('')} strokeWidth={0.8} />
      {dots}
    </g>
  );
}

/** A crescent moon: the lit edge of a circle of radius r, facing angle rot (degrees). */
function Crescent({ x, y, r, rot = 0, fill = false }: { x: number; y: number; r: number; rot?: number; fill?: boolean }) {
  // Outer arc half way round, inner arc back through a narrower ellipse.
  const d = `M0 ${-r}A${r} ${r} 0 1 1 0 ${r}A${f(r * 0.62)} ${r} 0 1 0 0 ${-r}Z`;
  return <path d={d} transform={`translate(${x} ${y}) rotate(${rot})`} fill={fill ? 'currentColor' : 'none'} fillOpacity={fill ? 0.35 : undefined} strokeWidth={1.6} />;
}

/** Small filled petals drifting across an area. */
function Drift({ seed, n, w, h, x = 0, y = 0, size = 10, notch = false }: { seed: number; n: number; w: number; h: number; x?: number; y?: number; size?: number; notch?: boolean }) {
  const r = rng(seed);
  const d: string[] = [];
  for (let i = 0; i < n; i++) {
    const l = size * (0.6 + r() * 0.8);
    d.push(petal(x + r() * w, y + r() * h, r() * 360, l, l * (notch ? 0.42 : 0.32), notch, false));
  }
  return <path d={d.join('')} fill="currentColor" fillOpacity={0.55} strokeWidth={0.6} />;
}

/** Sine-like wave lines, one under another, fading out. */
function Waves({ x, y, w, n, gap, amp, len, seed }: { x: number; y: number; w: number; n: number; gap: number; amp: number; len: number; seed: number }) {
  const r = rng(seed);
  const out: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const a = amp * (0.6 + r() * 0.8);
    const ph = r() * len;
    const pts: string[] = [];
    for (let px = 0; px <= w; px += 16) pts.push(`${f(x + px)} ${f(y + i * gap + Math.sin(((px + ph) / len) * Math.PI * 2) * a)}`);
    out.push(<path key={i} d={`M${pts.join('L')}`} fill="none" opacity={f(1 - (i / n) * 0.7)} />);
  }
  return <g>{out}</g>;
}

/** Ripples spreading on still water: flat ellipses, thinning outwards. */
function Ripples({ x, y, r, n, flat = 0.24 }: { x: number; y: number; r: number; n: number; flat?: number }) {
  return (
    <g fill="none">
      {Array.from({ length: n }, (_, i) => {
        const rr = (r * (i + 1)) / n;
        return <ellipse key={i} cx={x} cy={y} rx={f(rr)} ry={f(rr * flat)} strokeWidth={f(1.4 - (i / n) * 0.8)} strokeDasharray={i % 2 ? '3 6' : undefined} />;
      })}
    </g>
  );
}

/** A wisp of smoke: a long S-curve ending in a curl. */
function Wisp({ x, y, len, rise, curl, flip = false }: { x: number; y: number; len: number; rise: number; curl: number; flip?: boolean }) {
  const k = flip ? -1 : 1;
  const sweep = flip ? 0 : 1;
  const d = `M${x} ${y}C${f(x + len * 0.35 * k)} ${f(y - rise * 1.2)} ${f(x + len * 0.6 * k)} ${f(y + rise * 0.5)} ${f(x + len * k)} ${f(y - rise)}a${curl} ${curl} 0 1 ${sweep} ${f(-curl * 1.2 * k)} ${f(-curl * 0.6)}a${f(curl * 0.6)} ${f(curl * 0.6)} 0 1 ${sweep} ${f(curl * 0.7 * k)} ${f(curl * 0.4)}`;
  return <path d={d} fill="none" />;
}

/** A bamboo stalk, leaning a little, with nodes and a few leaves. */
function Bamboo({ x, y, h, lean, seg, seed, w = 14 }: { x: number; y: number; h: number; lean: number; seg: number; seed: number; w?: number }) {
  const r = rng(seed);
  const n = Math.round(h / seg);
  const at = (t: number) => [x + lean * t * t, y - h * t] as const;
  const stalk: string[] = [];
  const leaves: string[] = [];
  for (let i = 0; i < n; i++) {
    const [x0, y0] = at(i / n);
    const [x1, y1] = at((i + 0.94) / n);
    stalk.push(`M${f(x0 - w / 2)} ${f(y0 - 3)}L${f(x1 - w / 2)} ${f(y1)}M${f(x0 + w / 2)} ${f(y0 - 3)}L${f(x1 + w / 2)} ${f(y1)}`);
    stalk.push(`M${f(x1 - w / 2 - 2)} ${f(y1 - 2)}Q${f(x1)} ${f(y1 + 3)} ${f(x1 + w / 2 + 2)} ${f(y1 - 2)}`);
    if (i > 1 && r() > 0.45) {
      const side = r() > 0.5 ? 1 : -1;
      for (let j = 0; j < 3; j++) {
        const l = 60 + r() * 50;
        leaves.push(petal(x1 + (side * w) / 2, y1, (side > 0 ? -20 : 200) + side * (j * 24 - 10) + (r() - 0.5) * 16, l, l * 0.13));
      }
    }
  }
  return (
    <g fill="none">
      <path d={stalk.join('')} strokeWidth={1.3} />
      <path d={leaves.join('')} fill="currentColor" fillOpacity={0.3} />
    </g>
  );
}

/** A jade bi: a disc with a round hole, carved with rows of little grain spirals. */
function JadeDisc({ x, y, r }: { x: number; y: number; r: number }) {
  const hole = r * 0.36;
  const grains: string[] = [];
  for (let row = 0; row < 2; row++) {
    const rr = hole + ((r - hole) * (row + 0.8)) / 2.6;
    const count = Math.round((2 * Math.PI * rr) / 46);
    for (let i = 0; i < count; i++) {
      const ang = (2 * Math.PI * (i + row * 0.5)) / count;
      const gx = x + Math.cos(ang) * rr;
      const gy = y + Math.sin(ang) * rr;
      grains.push(`M${f(gx + 5)} ${f(gy)}a5 5 0 1 1 -5 -5a2.5 2.5 0 1 1 2.5 2.5`);
    }
  }
  return (
    <g fill="none">
      <circle cx={x} cy={y} r={r} strokeWidth={2} />
      <circle cx={x} cy={y} r={r * 0.96} strokeWidth={0.6} />
      <circle cx={x} cy={y} r={hole} strokeWidth={2} />
      <circle cx={x} cy={y} r={hole * 1.1} strokeWidth={0.6} />
      <path d={grains.join('')} strokeWidth={0.7} />
    </g>
  );
}

/** Velvet drapes hanging in swags across the top, with folds and tassels. */
function Drapes({ w, n, drop }: { w: number; n: number; drop: number }) {
  const sw = w / n;
  const folds: string[] = [];
  const tassels: ReactNode[] = [];
  for (let i = 0; i <= n; i++) {
    const x0 = i * sw;
    if (i < n) for (let k = 0; k < 4; k++) folds.push(`M${f(x0 + k * 10)} ${f(-10 + k * 6)}Q${f(x0 + sw / 2)} ${f(drop * (1 - k * 0.2))} ${f(x0 + sw - k * 10)} ${f(-10 + k * 6)}`);
    const ty = drop * 0.5;
    tassels.push(
      <g key={i}>
        <path d={`M${f(x0)} 0V${f(ty)}M${f(x0 - 5)} ${f(ty + 6)}l-3 ${f(drop * 0.22)}M${f(x0)} ${f(ty + 6)}v${f(drop * 0.25)}M${f(x0 + 5)} ${f(ty + 6)}l3 ${f(drop * 0.22)}`} />
        <circle cx={f(x0)} cy={f(ty + 3)} r={4} fill="currentColor" />
      </g>,
    );
  }
  return (
    <g fill="none">
      <path d={folds.join('')} />
      {tassels}
    </g>
  );
}

/** A simple open crown. */
function Crown({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} strokeWidth={1.6 / s} fill="none">
      <path d="M-50 20L-58 -22L-28 0L0 -36L28 0L58 -22L50 20ZM-50 30H50" />
      {[-58, 0, 58].map((cx) => (
        <circle key={cx} cx={cx} cy={cx ? -28 : -43} r={5} fill="currentColor" />
      ))}
    </g>
  );
}

/** An eight-point star (two crossed squares) with a ring inside, as on tiled arches. */
function StarTile({ x, y, r, rot = 0 }: { x: number; y: number; r: number; rot?: number }) {
  const sq = (a0: number) =>
    `M${Array.from({ length: 4 }, (_, i) => {
      const ang = ((a0 + rot + i * 90) * Math.PI) / 180;
      return `${f(x + Math.cos(ang) * r)} ${f(y + Math.sin(ang) * r)}`;
    }).join('L')}Z`;
  return (
    <g fill="none">
      <path d={sq(0) + sq(45)} />
      <circle cx={x} cy={y} r={f(r * 0.5)} strokeWidth={0.7} />
    </g>
  );
}

/** A pointed horseshoe arch, doubled, standing on a base line. */
function Arch({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const one = (ww: number, hh: number) =>
    `M${f(x - ww / 2)} ${y}V${f(y - hh * 0.55)}C${f(x - ww * 0.62)} ${f(y - hh * 0.9)} ${f(x - ww * 0.12)} ${f(y - hh * 0.92)} ${x} ${f(y - hh)}C${f(x + ww * 0.12)} ${f(y - hh * 0.92)} ${f(x + ww * 0.62)} ${f(y - hh * 0.9)} ${f(x + ww / 2)} ${f(y - hh * 0.55)}V${y}`;
  return (
    <g fill="none">
      <path d={one(w, h)} strokeWidth={1.6} />
      <path d={one(w * 0.84, h * 0.88)} strokeWidth={0.8} />
      <path d={`M${f(x - w * 0.8)} ${y}H${f(x + w * 0.8)}`} />
    </g>
  );
}

/** A cherry blossom: five notched petals round a dotted centre. */
function Blossom({ x, y, r, rot = 0 }: { x: number; y: number; r: number; rot?: number }) {
  const d = Array.from({ length: 5 }, (_, i) => petal(x, y, rot + i * 72, r, r * 0.42, true, false)).join('');
  return (
    <g>
      <path d={d} fill="currentColor" fillOpacity={0.3} />
      <circle cx={x} cy={y} r={f(r * 0.14)} fill="currentColor" />
    </g>
  );
}

/** A branch along a curve with twigs, blossoms and buds. */
function Branch({ d, seed, blossoms, size }: { d: [number, number][]; seed: number; blossoms: number; size: number }) {
  const r = rng(seed);
  const pt = spline(d);
  const twigs: string[] = [];
  const flowers: ReactNode[] = [];
  for (let i = 0; i < blossoms; i++) {
    const [x, y] = pt(Math.min(1, 0.15 + (0.85 * i) / blossoms + r() * 0.04));
    const side = i % 2 ? 1 : -1;
    const tl = size * (1.2 + r() * 1.4);
    const ang = (r() * 70 - 35 + (side > 0 ? -60 : 120)) * (Math.PI / 180);
    const ex = x + Math.cos(ang) * tl;
    const ey = y + Math.sin(ang) * tl;
    twigs.push(`M${f(x)} ${f(y)}Q${f((x + ex) / 2 + side * 6)} ${f((y + ey) / 2)} ${f(ex)} ${f(ey)}`);
    if (r() > 0.25) flowers.push(<Blossom key={i} x={f(ex)} y={f(ey)} r={f(size * (0.7 + r() * 0.5))} rot={f(r() * 72)} />);
    else flowers.push(<path key={i} d={petal(ex, ey, (ang * 180) / Math.PI, size * 0.7, size * 0.3, false, false)} fill="currentColor" fillOpacity={0.5} />);
  }
  return (
    <g fill="none">
      <path d={splinePath(d)} strokeWidth={3} />
      <path d={twigs.join('')} strokeWidth={1.4} />
      {flowers}
    </g>
  );
}

/** Wind-drawn dunes: long ridges with fine ripple lines on their slopes. */
function Dunes({ w, y, n, seed }: { w: number; y: number; n: number; seed: number }) {
  const r = rng(seed);
  const ridges: string[] = [];
  const ripples: string[] = [];
  for (let i = 0; i < n; i++) {
    const base = y + i * 70;
    const pts: [number, number][] = Array.from({ length: 6 }, (_, k) => [(w * k) / 5 + (r() - 0.5) * 120, base + (r() - 0.5) * 90]);
    ridges.push(splinePath(pts, 80));
    const pt = spline(pts);
    for (let k = 0; k < 14; k++) {
      const [px, py] = pt(0.04 + (0.92 * k) / 13 + r() * 0.02);
      const l = 30 + r() * 40;
      ripples.push(`M${f(px - l / 2)} ${f(py + 14 + r() * 16)}q${f(l / 2)} -6 ${f(l)} 0`);
    }
  }
  return (
    <g fill="none">
      <path d={ridges.join('')} strokeWidth={1.4} />
      <path d={ripples.join('')} strokeWidth={0.7} />
    </g>
  );
}

/** Heat shimmer: short wavy dashes, as air quivers over hot sand. */
function Shimmer({ x, y, w, n, seed }: { x: number; y: number; w: number; n: number; seed: number }) {
  const r = rng(seed);
  const d: string[] = [];
  for (let i = 0; i < n; i++) {
    const l = 40 + r() * 120;
    let s = `M${f(x + r() * w)} ${f(y + i * 14 + r() * 6)}`;
    for (let k = 0; k < l; k += 20) s += 'q5 -4 10 0t10 0';
    d.push(s);
  }
  return <path d={d.join('')} fill="none" strokeWidth={0.9} />;
}

/** A sun with a ring and short rays. */
function Sun({ x, y, r, rays = 24 }: { x: number; y: number; r: number; rays?: number }) {
  const d: string[] = [];
  for (let i = 0; i < rays; i++) {
    const ang = (2 * Math.PI * i) / rays;
    const r2 = r * (i % 2 ? 1.28 : 1.42);
    d.push(`M${f(x + Math.cos(ang) * r * 1.14)} ${f(y + Math.sin(ang) * r * 1.14)}L${f(x + Math.cos(ang) * r2)} ${f(y + Math.sin(ang) * r2)}`);
  }
  return (
    <g fill="none">
      <circle cx={x} cy={y} r={r} strokeWidth={2} />
      <circle cx={x} cy={y} r={r * 0.82} strokeWidth={0.6} strokeDasharray="2 6" />
      <path d={d.join('')} />
    </g>
  );
}

/** A black-and-white checker floor going back to a vanishing line (the tiles as outlines). */
function Checker({ x, y, w, rows, cols, depth }: { x: number; y: number; w: number; rows: number; cols: number; depth: number }) {
  // Row k sits at y + depth·(k/rows)^1.6, narrowing towards the back.
  const rowY = (k: number) => y + depth * (k / rows) ** 1.6;
  const half = (k: number) => (w / 2) * (0.45 + 0.55 * (k / rows));
  const lines: string[] = [];
  for (let k = 0; k <= rows; k++) lines.push(`M${f(x - half(k))} ${f(rowY(k))}H${f(x + half(k))}`);
  for (let c = 0; c <= cols; c++) {
    const t = c / cols - 0.5;
    lines.push(`M${f(x + t * 2 * half(0))} ${f(rowY(0))}L${f(x + t * 2 * half(rows))} ${f(rowY(rows))}`);
  }
  const fills: string[] = [];
  for (let k = 0; k < rows; k++)
    for (let c = (k % 2); c < cols; c += 2) {
      const t0 = c / cols - 0.5;
      const t1 = (c + 1) / cols - 0.5;
      fills.push(
        `M${f(x + t0 * 2 * half(k))} ${f(rowY(k))}L${f(x + t1 * 2 * half(k))} ${f(rowY(k))}L${f(x + t1 * 2 * half(k + 1))} ${f(rowY(k + 1))}L${f(x + t0 * 2 * half(k + 1))} ${f(rowY(k + 1))}Z`,
      );
    }
  return (
    <g>
      <path d={fills.join('')} fill="currentColor" stroke="none" opacity={0.35} />
      <path d={lines.join('')} fill="none" strokeWidth={0.8} />
    </g>
  );
}

/** An ornate picture frame: double border with scrolls at the corners. */
function OrnateFrame({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const corner = (cx: number, cy: number, sx: number, sy: number) =>
    `M${f(cx)} ${f(cy + sy * 34)}C${f(cx)} ${f(cy + sy * 10)} ${f(cx + sx * 10)} ${f(cy)} ${f(cx + sx * 34)} ${f(cy)}` +
    `M${f(cx + sx * 8)} ${f(cy + sy * 20)}c${f(sx * 8)} ${f(-sy * 2)} ${f(sx * 12)} ${f(-sy * 6)} ${f(sx * 12)} ${f(-sy * 12)}`;
  return (
    <g fill="none">
      <rect x={x} y={y} width={w} height={h} rx={6} strokeWidth={1.8} />
      <rect x={x + 12} y={y + 12} width={w - 24} height={h - 24} rx={3} strokeWidth={0.8} />
      <path d={corner(x - 10, y - 10, 1, 1) + corner(x + w + 10, y - 10, -1, 1) + corner(x - 10, y + h + 10, 1, -1) + corner(x + w + 10, y + h + 10, -1, -1)} strokeWidth={1.4} />
      <circle cx={x + w / 2} cy={y} r={7} fill="currentColor" />
      <circle cx={x + w / 2} cy={y + h} r={5} fill="currentColor" />
    </g>
  );
}

/** One warm shaft of light from a high window, falling to the right. */
function LightShaft({ x, y, w, len, id }: { x: number; y: number; w: number; len: number; id: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--art-ink)" stopOpacity={0.9} />
          <stop offset="1" stopColor="var(--art-ink)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`M${x} ${y}h${w}l${f(len * 0.62)} ${len}h${f(-w * 2.2)}Z`} fill={`url(#${id})`} stroke="none" />
      <rect x={x} y={y - w * 0.9} width={w} height={w * 0.9} fill="none" />
      <path d={`M${f(x + w / 2)} ${f(y - w * 0.9)}V${y}M${x} ${f(y - w * 0.45)}h${w}`} />
    </g>
  );
}

/** A small heart outline (or filled). */
const heart = (x: number, y: number, r: number) =>
  `M${f(x)} ${f(y + r * 0.9)}L${f(x - r)} ${f(y - r * 0.05)}A${f(r * 0.52)} ${f(r * 0.52)} 0 0 1 ${f(x)} ${f(y - r * 0.55)}A${f(r * 0.52)} ${f(r * 0.52)} 0 0 1 ${f(x + r)} ${f(y - r * 0.05)}Z`;

/** A lace edge: scallops with a dot in each, along a line. */
function Lace({ x, y, w, n, r }: { x: number; y: number; w: number; n: number; r: number }) {
  const step = w / n;
  const scallops = Array.from({ length: n }, (_, i) => `M${f(x + i * step)} ${y}a${f(step / 2)} ${f(r)} 0 0 0 ${f(step)} 0`).join('');
  return (
    <g fill="none">
      <path d={`M${x} ${y}h${w}`} strokeWidth={1.2} />
      <path d={scallops} />
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={f(x + i * step + step / 2)} cy={f(y + r * 0.55)} r={1.8} fill="currentColor" />
      ))}
    </g>
  );
}

// ── Compositions ────────────────────────────────────────────────────

const FIELD = { w: 1600, h: 1000 };

function Field({ seed, n, children }: { seed: number; n: number; children?: ReactNode }) {
  return (
    <svg className={a.field} viewBox={`0 0 ${FIELD.w} ${FIELD.h}`} preserveAspectRatio="xMidYMid slice" focusable="false">
      {children}
      <Stars seed={seed} n={n} w={FIELD.w} h={FIELD.h} big={9} />
    </svg>
  );
}

/** Top-right piece; scales with the window. */
const Crest = ({ children, view = '0 0 800 800' }: { children: ReactNode; view?: string }) => (
  <svg className={a.crest} viewBox={view} focusable="false">
    {children}
  </svg>
);
/** Bottom-left piece. */
const Base = ({ children, view = '0 0 600 600' }: { children: ReactNode; view?: string }) => (
  <svg className={a.base} viewBox={view} focusable="false">
    {children}
  </svg>
);

function Glacier() {
  return (
    <>
      <Field seed={7} n={70}>
        <Rays x={1180} y={-60} n={9} from={100} to={150} len={1100} id="ar-g" />
      </Field>
      <Crest>
        <Glow x={430} y={360} r={330} id="ag-g" strength={0.5} />
        <g className={a.turn}>
          <RuneRing x={430} y={360} r={300} size={20} count={24} />
        </g>
        <Rings x={430} y={360} r={250} />
        <NineWorlds x={430} y={360} r={130} />
      </Crest>
      <Base>
        <Raven x={180} y={380} s={1.5} />
        <Raven x={330} y={300} s={1.05} flip />
        <path d="M60 500C200 440 360 470 560 380" fill="none" strokeDasharray="1 9" />
      </Base>
    </>
  );
}

function Light() {
  return (
    <>
      <Field seed={3} n={26} />
      <Crest>
        <Rings x={430} y={360} r={250} ticks={48} />
        <NineWorlds x={430} y={360} r={130} />
      </Crest>
    </>
  );
}

function Candlelight() {
  return (
    <>
      <Field seed={11} n={60}>
        <Glow x={1220} y={140} r={620} id="ag-c" strength={0.9} />
        <Rays x={1220} y={140} n={14} from={60} to={200} len={1000} id="ar-c" />
      </Field>
      <Crest view="0 0 900 800">
        <g strokeWidth={1.2}>
          <Wing transform="translate(470 420)" />
          <Wing transform="translate(430 420)" flip />
        </g>
        <ellipse cx={450} cy={230} rx={92} ry={26} fill="none" strokeWidth={2} />
        <ellipse cx={450} cy={230} rx={110} ry={34} fill="none" strokeWidth={0.6} strokeDasharray="2 6" />
        <path d={glint(450, 120, 22)} fill="currentColor" className={a.twinkleSlow} />
      </Crest>
      <Base>
        <Filigree x={300} y={420} s={1.5} />
        <Sigil x={300} y={250} r={70} />
      </Base>
    </>
  );
}

function Crimson() {
  return (
    <>
      <Field seed={23} n={40}>
        <Glow x={1300} y={260} r={520} id="ag-r" strength={1} />
        <Glow x={160} y={900} r={420} id="ag-r2" strength={0.8} />
      </Field>
      <Crest>
        {/* A crown of thorns around a halo. */}
        <circle cx={440} cy={330} r={150} fill="none" strokeWidth={2} />
        <Thorns
          d={Array.from({ length: 13 }, (_, i) => {
            const ang = (i / 12) * Math.PI * 2;
            return [440 + Math.cos(ang) * (205 + (i % 2) * 14), 330 + Math.sin(ang) * (205 + (i % 2) * 14)];
          })}
          n={44}
          seed={5}
        />
        <Sigil x={440} y={330} r={110} />
        <RuneRing x={440} y={330} r={300} size={18} count={20} start={3} />
      </Crest>
      <Base>
        <Thorns
          d={[
            [-20, 600],
            [80, 470],
            [60, 330],
            [170, 220],
            [150, 90],
            [250, -10],
          ]}
          n={30}
          seed={9}
        />
        <Thorns
          d={[
            [-20, 420],
            [120, 400],
            [260, 470],
            [420, 440],
            [620, 520],
          ]}
          n={24}
          seed={13}
        />
        <Rose x={180} y={230} r={46} rot={20} />
        <Rose x={300} y={440} r={34} rot={140} />
        <Rose x={60} y={420} r={26} rot={250} />
      </Base>
    </>
  );
}

function Bifrost() {
  // The bridge: a fan of thin arcs, and a soft aurora band.
  const arcs = Array.from({ length: 7 }, (_, i) => <path key={i} d={`M-100 ${980 - i * 12}Q800 ${220 - i * 16} 1700 ${720 - i * 12}`} fill="none" strokeWidth={0.9} opacity={1 - i * 0.1} />);
  return (
    <>
      <Field seed={41} n={130}>
        <defs>
          <linearGradient id="aa-b" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--art-glow)" stopOpacity="0" />
            <stop offset="0.45" stopColor="var(--art-glow)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--art-ink)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 260C300 120 520 330 820 210S1350 60 1600 180V330C1350 220 1120 390 820 330S300 260 0 400Z" fill="url(#aa-b)" stroke="none" className={a.drift} />
        <g stroke="currentColor">{arcs}</g>
      </Field>
      <Crest>
        <Rings x={440} y={340} r={260} ticks={96} />
        <ellipse cx={440} cy={340} rx={330} ry={90} fill="none" transform="rotate(-18 440 340)" strokeWidth={0.8} />
        <ellipse cx={440} cy={340} rx={300} ry={60} fill="none" transform="rotate(24 440 340)" strokeWidth={0.6} strokeDasharray="3 6" />
        <circle cx={440} cy={340} r={36} fill="currentColor" opacity={0.5} />
      </Crest>
      <Base>
        <Raven x={200} y={360} s={1.3} />
        <Raven x={360} y={280} s={0.9} />
      </Base>
    </>
  );
}

function Ascendant() {
  return (
    <>
      <Field seed={5} n={50}>
        <Rays x={260} y={-40} n={12} from={20} to={80} len={1250} id="ar-a" />
        <Glow x={1180} y={420} r={540} id="ag-a" strength={0.9} />
      </Field>
      <Crest view="0 0 900 800">
        <circle cx={450} cy={250} r={96} fill="none" strokeWidth={2} />
        <circle cx={450} cy={250} r={120} fill="none" strokeWidth={0.6} strokeDasharray="2 6" />
        <g strokeWidth={1.3}>
          <Wing transform="translate(480 440) scale(1.05)" />
          <Wing transform="translate(420 440) scale(1.05)" flip />
        </g>
        <path d={glint(450, 250, 30)} fill="currentColor" className={a.twinkleSlow} />
      </Crest>
      <Base view="0 0 600 400">
        <g fill="none" strokeWidth={1.4}>
          <path d={CLOUD} transform="translate(40 200) scale(1.6)" />
          <path d={CLOUD} transform="translate(250 260) scale(1.1)" />
        </g>
        <Filigree x={300} y={150} s={1.1} />
      </Base>
    </>
  );
}

function NoctuneBloom() {
  return (
    <>
      <Field seed={61} n={60}>
        <Glow x={1240} y={220} r={560} id="ag-n" strength={0.9} />
        <Glow x={180} y={860} r={380} id="ag-n2" strength={0.6} />
        <Drift seed={62} n={26} w={1600} h={1000} size={12} />
      </Field>
      <Crest>
        <circle cx={520} cy={230} r={190} fill="none" strokeWidth={0.6} strokeDasharray="1 7" />
        <Crescent x={520} y={230} r={120} rot={-30} fill />
        <Bloom x={340} y={470} r={170} petals={9} rot={-8} />
        <path d={glint(680, 420, 18)} fill="currentColor" className={a.twinkleSlow} />
      </Crest>
      <Base>
        <path
          d={splinePath([
            [-20, 560],
            [110, 470],
            [180, 360],
            [330, 300],
            [420, 180],
          ])}
          fill="none"
          strokeWidth={1.6}
        />
        <path d={petal(180, 360, 200, 90, 22) + petal(250, 320, -40, 80, 20)} fill="none" />
        <Bloom x={420} y={180} r={70} petals={7} layers={2} rot={-20} />
        <Bloom x={110} y={470} r={44} petals={6} layers={2} rot={30} />
      </Base>
    </>
  );
}

function AstralLagoon() {
  return (
    <>
      <Field seed={73} n={90}>
        <Glow x={1200} y={200} r={520} id="ag-l" strength={0.8} />
        <g className={a.drift}>
          <Waves x={-80} y={640} w={1760} n={8} gap={38} amp={9} len={260} seed={74} />
        </g>
      </Field>
      <Crest>
        <circle cx={430} cy={230} r={100} fill="currentColor" fillOpacity={0.18} strokeWidth={1.6} />
        <circle cx={430} cy={230} r={128} fill="none" strokeWidth={0.6} strokeDasharray="2 6" />
        <path d="M60 420H800" strokeWidth={0.8} />
        {/* The moon's reflection: short strokes that narrow towards the viewer. */}
        <path d={Array.from({ length: 11 }, (_, i) => `M${f(430 - (90 - i * 6))} ${440 + i * 22}h${f((90 - i * 6) * 2)}`).join('')} strokeWidth={1.2} strokeDasharray="14 9" />
        <Ripples x={430} y={640} r={340} n={6} />
      </Crest>
      <Base>
        <Ripples x={260} y={380} r={230} n={5} flat={0.3} />
        <path d={glint(260, 340, 16) + glint(120, 250, 9) + glint(420, 280, 11)} fill="currentColor" className={a.twinkle} />
      </Base>
    </>
  );
}

function CrimsonHaze() {
  return (
    <>
      <Field seed={89} n={34}>
        <Glow x={1280} y={240} r={560} id="ag-h" strength={1} />
        <Glow x={220} y={940} r={460} id="ag-h2" strength={0.9} />
        <g className={a.drift} strokeWidth={1.2}>
          <Wisp x={-40} y={760} len={720} rise={120} curl={34} />
          <Wisp x={200} y={900} len={900} rise={180} curl={46} />
          <Wisp x={1640} y={620} len={640} rise={110} curl={30} flip />
          <Wisp x={1640} y={860} len={820} rise={160} curl={40} flip />
        </g>
      </Field>
      <Crest>
        {/* An eclipse: a dark disc with a ring of fire and a long corona. */}
        <Rays x={440} y={330} n={30} from={0} to={360} len={360} id="ar-h" />
        <circle cx={440} cy={330} r={120} fill="var(--bg-app)" fillOpacity={0.6} strokeWidth={2.4} />
        <circle cx={440} cy={330} r={134} fill="none" strokeWidth={0.8} />
        <circle cx={440} cy={330} r={200} fill="none" strokeWidth={0.6} strokeDasharray="1 8" />
        <path d={glint(355, 245, 20)} fill="currentColor" className={a.twinkleSlow} />
      </Crest>
      <Base>
        <g strokeWidth={1.4}>
          <Wisp x={20} y={560} len={360} rise={150} curl={30} />
          <Wisp x={-20} y={470} len={260} rise={170} curl={22} />
          <Wisp x={120} y={600} len={460} rise={90} curl={36} />
        </g>
        <Stars seed={90} n={18} w={500} h={420} big={0} />
      </Base>
    </>
  );
}

function JadeWhisper() {
  return (
    <>
      <Field seed={97} n={36}>
        <Glow x={1220} y={300} r={540} id="ag-j" strength={0.8} />
        {/* Mist lying in long bands. */}
        <g className={a.drift} strokeDasharray="60 18 4 18" strokeWidth={1.2}>
          <path d="M-60 620C300 580 620 660 980 610S1500 580 1700 620" fill="none" />
          <path d="M-60 700C260 670 700 740 1060 690S1520 670 1700 710" fill="none" opacity={0.7} />
          <path d="M-60 790C380 760 760 820 1140 780S1560 770 1700 800" fill="none" opacity={0.5} />
        </g>
      </Field>
      <Crest>
        <path d="M430 0V110" strokeWidth={1.2} />
        <JadeDisc x={430} y={330} r={220} />
        <path d="M430 550V640M418 640h24l-4 90h-16Z" fill="none" strokeWidth={1.2} />
      </Crest>
      <Base>
        <Bamboo x={160} y={640} h={620} lean={70} seg={92} seed={98} />
        <Bamboo x={270} y={660} h={480} lean={-40} seg={80} seed={99} w={11} />
        <Bamboo x={70} y={660} h={380} lean={30} seg={70} seed={100} w={9} />
      </Base>
    </>
  );
}

function VelvetTwilight() {
  return (
    <>
      <Field seed={103} n={90}>
        <Glow x={1220} y={300} r={600} id="ag-v" strength={1} />
        <Drapes w={1600} n={5} drop={150} />
      </Field>
      <Crest>
        <circle cx={440} cy={360} r={210} fill="none" strokeWidth={0.6} strokeDasharray="1 6" />
        <Crescent x={440} y={360} r={150} rot={200} fill />
        <Crown x={385} y={300} s={0.9} />
        <path d={glint(600, 230, 22) + glint(560, 520, 12)} fill="currentColor" className={a.twinkleSlow} />
      </Crest>
      <Base>
        <Filigree x={300} y={400} s={1.4} />
        <path d={glint(300, 220, 24)} fill="currentColor" className={a.twinkle} />
        <circle cx={300} cy={220} r={44} fill="none" strokeWidth={0.8} strokeDasharray="2 6" />
      </Base>
    </>
  );
}

function AmberMirage() {
  return (
    <>
      <Field seed={113} n={24}>
        <Glow x={1200} y={260} r={620} id="ag-m" strength={0.9} />
        <g className={a.drift}>
          <Shimmer x={-40} y={560} w={1600} n={18} seed={114} />
        </g>
      </Field>
      <Crest>
        <StarTile x={430} y={330} r={250} rot={22.5} />
        <Sun x={430} y={330} r={110} />
        <path d="M300 380h260M320 404h220M350 428h160" strokeWidth={1.2} strokeDasharray="18 8" />
      </Crest>
      <Base>
        <Arch x={280} y={560} w={300} h={420} />
        <StarTile x={280} y={250} r={46} />
        <path d="M0 560C120 520 220 540 330 520S520 500 600 530" fill="none" strokeWidth={0.8} />
      </Base>
    </>
  );
}

function MidnightSakura() {
  return (
    <>
      <Field seed={127} n={60}>
        <Glow x={1240} y={240} r={560} id="ag-s" strength={0.9} />
        <Drift seed={128} n={30} w={1600} h={1000} size={13} notch />
      </Field>
      <Crest>
        <circle cx={460} cy={320} r={180} fill="currentColor" fillOpacity={0.12} strokeWidth={1.2} />
        <circle cx={460} cy={320} r={206} fill="none" strokeWidth={0.6} strokeDasharray="1 7" />
        <Branch
          d={[
            [820, 120],
            [660, 190],
            [520, 220],
            [380, 320],
            [210, 360],
          ]}
          seed={7}
          blossoms={9}
          size={26}
        />
      </Crest>
      <Base>
        <Branch
          d={[
            [-30, 560],
            [100, 470],
            [170, 380],
            [300, 330],
            [430, 220],
          ]}
          seed={12}
          blossoms={8}
          size={24}
        />
      </Base>
    </>
  );
}

function EtherealDune() {
  return (
    <>
      <Field seed={131} n={20}>
        <Glow x={1180} y={280} r={600} id="ag-d" strength={0.9} />
        <Dunes w={1600} y={620} n={4} seed={132} />
      </Field>
      <Crest>
        <Sun x={440} y={300} r={120} rays={36} />
        <circle cx={440} cy={300} r={190} fill="none" strokeWidth={0.6} strokeDasharray="1 7" />
        <path d="M80 470C220 400 330 420 440 380S660 340 800 400" fill="none" strokeWidth={1.4} />
        <path d="M200 160q12 -10 24 0q12 -10 24 0M270 120q9 -8 18 0q9 -8 18 0" fill="none" />
      </Crest>
      <Base>
        <path d="M-20 440C120 380 260 470 380 400S520 330 560 360M-20 500C140 450 300 520 440 470M20 380c60 -30 130 -20 160 20" fill="none" strokeWidth={1.2} />
        <path d="M380 400c40 -30 30 -80 -10 -80c-30 0 -40 30 -20 46" fill="none" />
        <path d="M120 560l-6 -50M128 560l8 -44M136 560l-14 -38M300 560l-4 -40M306 560l10 -34" fill="none" />
      </Base>
    </>
  );
}

function EmeraldSalon() {
  return (
    <>
      <Field seed={141} n={20}>
        <Glow x={1240} y={260} r={620} id="ag-e" strength={0.9} />
        <Drapes w={1600} n={4} drop={170} />
        <Checker x={800} y={760} w={1500} rows={7} cols={14} depth={260} />
      </Field>
      <Crest>
        <OrnateFrame x={260} y={150} w={360} h={440} />
        <Filigree x={440} y={370} s={1.1} />
      </Crest>
      <Base>
        <path d="M120 120V560M150 120V560" strokeWidth={1.4} />
        <path d="M100 130C150 220 160 360 110 560M170 130C120 230 120 380 180 560" fill="none" strokeWidth={0.8} />
        <circle cx={135} cy={110} r={14} fill="none" />
      </Base>
    </>
  );
}

function IndigoHour() {
  return (
    <>
      <Field seed={151} n={50}>
        <LightShaft x={980} y={120} w={150} len={760} id="ag-ih" />
        <Glow x={1180} y={620} r={460} id="ag-ig" strength={0.8} />
        <g className={a.drift}>
          <Wisp x={200} y={780} len={420} rise={90} curl={30} />
          <Wisp x={1050} y={860} len={380} rise={70} curl={24} flip />
        </g>
      </Field>
      <Crest>
        <Crescent x={460} y={330} r={130} rot={210} />
        <path d={glint(620, 220, 20) + glint(300, 520, 12)} fill="currentColor" className={a.twinkleSlow} />
      </Crest>
      <Base>
        <Wisp x={40} y={420} len={360} rise={80} curl={26} />
        <Wisp x={80} y={500} len={300} rise={60} curl={20} />
      </Base>
    </>
  );
}

function RoseLace() {
  return (
    <>
      <Field seed={161} n={18}>
        <Glow x={1220} y={240} r={600} id="ag-r" strength={0.9} />
        <Lace x={-20} y={40} w={1640} n={40} r={22} />
        <path d={[heart(1180, 420, 18), heart(1320, 300, 12), heart(240, 700, 14), heart(1460, 620, 10)].join('')} fill="currentColor" className={a.twinkleSlow} />
      </Field>
      <Crest>
        <OrnateFrame x={300} y={190} w={300} h={380} />
        <path d={heart(450, 380, 60)} fill="none" strokeWidth={1.6} />
        <path d={heart(450, 380, 40)} fill="none" strokeWidth={0.8} />
      </Crest>
      <Base>
        <Lace x={40} y={460} w={520} n={13} r={18} />
        <path d={heart(200, 300, 30) + heart(320, 230, 18)} fill="none" strokeWidth={1.2} />
      </Base>
    </>
  );
}

const ART: Record<Theme, () => ReactNode> = {
  dark: Glacier,
  light: Light,
  candlelight: Candlelight,
  crimson: Crimson,
  bifrost: Bifrost,
  ascendant: Ascendant,
  'noctune-bloom': NoctuneBloom,
  'ethereal-dune': EtherealDune,
  'astral-lagoon': AstralLagoon,
  'crimson-haze': CrimsonHaze,
  'jade-whisper': JadeWhisper,
  'velvet-twilight': VelvetTwilight,
  'amber-mirage': AmberMirage,
  'midnight-sakura': MidnightSakura,
  'emerald-salon': EmeraldSalon,
  'indigo-hour': IndigoHour,
  'rose-lace': RoseLace,
};

/** One small emblem per theme, for the theme picker. Uses the colours of whatever theme box it sits in. */
export function ThemeMotif({ theme, className }: { theme: Theme; className?: string | undefined }) {
  const body: Record<Theme, ReactNode> = {
    dark: (
      <>
        <Rings x={200} y={200} r={150} ticks={48} />
        <NineWorlds x={200} y={200} r={80} />
      </>
    ),
    light: (
      <>
        <Rings x={200} y={200} r={150} ticks={36} />
        <path d={glint(200, 200, 40)} fill="currentColor" />
      </>
    ),
    candlelight: (
      <g strokeWidth={2.4}>
        <Wing transform="translate(215 300) scale(0.42)" />
        <Wing transform="translate(185 300) scale(0.42)" flip />
        <ellipse cx={200} cy={150} rx={46} ry={13} fill="none" strokeWidth={3} />
      </g>
    ),
    crimson: (
      <>
        <Sigil x={200} y={200} r={70} />
        <Thorns
          d={Array.from({ length: 13 }, (_, i) => {
            const ang = (i / 12) * Math.PI * 2;
            return [200 + Math.cos(ang) * (124 + (i % 2) * 10), 200 + Math.sin(ang) * (124 + (i % 2) * 10)];
          })}
          n={30}
          seed={5}
        />
      </>
    ),
    bifrost: (
      <>
        <Rings x={200} y={200} r={130} ticks={60} />
        <ellipse cx={200} cy={200} rx={180} ry={46} fill="none" transform="rotate(-18 200 200)" strokeWidth={1.6} />
        <Raven x={200} y={205} s={1.1} />
      </>
    ),
    ascendant: (
      <g strokeWidth={2.4}>
        <circle cx={200} cy={140} r={44} fill="none" strokeWidth={3} />
        <Wing transform="translate(215 300) scale(0.44)" />
        <Wing transform="translate(185 300) scale(0.44)" flip />
      </g>
    ),
    'noctune-bloom': (
      <>
        <Crescent x={270} y={120} r={56} rot={-30} />
        <Bloom x={190} y={240} r={120} petals={8} layers={2} rot={-8} />
      </>
    ),
    'astral-lagoon': (
      <>
        <circle cx={200} cy={130} r={62} fill="none" strokeWidth={3} />
        <path d="M40 230H360" />
        <Ripples x={200} y={300} r={170} n={4} flat={0.26} />
      </>
    ),
    'crimson-haze': (
      <>
        <Sun x={200} y={170} r={70} rays={32} />
        <circle cx={200} cy={170} r={70} fill="currentColor" fillOpacity={0.25} stroke="none" />
        <Wisp x={30} y={350} len={300} rise={60} curl={22} />
      </>
    ),
    'jade-whisper': (
      <>
        <JadeDisc x={230} y={200} r={130} />
        <Bamboo x={80} y={390} h={360} lean={20} seg={72} seed={98} w={10} />
      </>
    ),
    'velvet-twilight': (
      <>
        <Crescent x={200} y={210} r={120} rot={200} />
        <Crown x={160} y={180} s={0.75} />
      </>
    ),
    'ethereal-dune': (
      <>
        <Sun x={200} y={170} r={70} rays={24} />
        <path d="M20 300C120 250 200 280 260 250S340 230 380 250M20 350C140 310 260 360 380 320" fill="none" strokeWidth={2.4} />
      </>
    ),
    'amber-mirage': (
      <>
        <StarTile x={200} y={200} r={150} rot={22.5} />
        <circle cx={200} cy={200} r={56} fill="none" strokeWidth={3} />
      </>
    ),
    'midnight-sakura': (
      <>
        <circle cx={220} cy={180} r={110} fill="none" strokeWidth={1.6} />
        <Blossom x={150} y={250} r={60} rot={10} />
        <Blossom x={290} y={130} r={36} rot={40} />
      </>
    ),
    'emerald-salon': (
      <>
        <OrnateFrame x={110} y={70} w={180} h={220} />
        <Checker x={200} y={300} w={360} rows={3} cols={6} depth={80} />
      </>
    ),
    'indigo-hour': (
      <>
        <LightShaft x={150} y={80} w={70} len={260} id="am-ih" />
        <Crescent x={300} y={110} r={50} rot={210} />
      </>
    ),
    'rose-lace': (
      <>
        <path d={heart(200, 200, 110)} fill="none" strokeWidth={2.4} />
        <Lace x={40} y={340} w={320} n={8} r={16} />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden="true" focusable="false" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
      {body[theme]}
    </svg>
  );
}

/** The current theme's background art. Fixed behind the page, never takes clicks. */
export const ThemeArt = memo(function ThemeArt({ theme }: { theme: Theme }) {
  const Art = ART[theme];
  return (
    <div className={a.art} aria-hidden="true" data-art={theme}>
      <Art />
    </div>
  );
});
