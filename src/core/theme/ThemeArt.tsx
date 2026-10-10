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

/** A thorned vine along a gentle curve. */
function Thorns({ d, n, seed }: { d: [number, number][]; n: number; seed: number }) {
  // Catmull-Rom through the points, sampled for thorn positions.
  const r = rng(seed);
  const pt = (t: number) => {
    const seg = Math.min(d.length - 2, Math.floor(t * (d.length - 1)));
    const u = t * (d.length - 1) - seg;
    const p0 = d[Math.max(0, seg - 1)] as [number, number];
    const p1 = d[seg] as [number, number];
    const p2 = d[seg + 1] as [number, number];
    const p3 = d[Math.min(d.length - 1, seg + 2)] as [number, number];
    const cr = (a0: number, a1: number, a2: number, a3: number) => 0.5 * (2 * a1 + (-a0 + a2) * u + (2 * a0 - 5 * a1 + 4 * a2 - a3) * u * u + (-a0 + 3 * a1 - 3 * a2 + a3) * u * u * u);
    return [cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])] as const;
  };
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

const ART: Record<Theme, () => ReactNode> = { dark: Glacier, light: Light, candlelight: Candlelight, crimson: Crimson, bifrost: Bifrost, ascendant: Ascendant };

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
