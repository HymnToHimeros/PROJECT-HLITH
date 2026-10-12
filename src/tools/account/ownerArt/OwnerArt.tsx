import { useId, type CSSProperties } from 'react';
import { OWNER_BADGE_ART, OWNER_FRAME_ART, OWNER_FRAME_VARIANTS } from './art';
import './svgMotion.css';
import './names.css';

/**
 * The owner's badges, frames and name styles (T64), drawn from art.ts. This file and the
 * drawings load only when the owner's look is shown (Owner.tsx loads it lazily), so nobody
 * else downloads them.
 */

/** Every id inside a drawing gets this use's own suffix, so two drawings on a page never mix. */
function uniq(svg: string, suffix: string): string {
  return svg.replace(/\bid="([^"]+)"/g, `id="$1-${suffix}"`).replace(/url\(#([^)]+)\)/g, `url(#$1-${suffix})`);
}
const useSuffix = () => useId().replace(/[^a-zA-Z0-9]/g, '');

export function OwnerBadge({ n, size, title }: { n: number; size: number; title?: string | undefined }) {
  const suffix = useSuffix();
  const art = OWNER_BADGE_ART[n - 1];
  if (!art) return null;
  // The drawings are fixed text from art.ts, never anything a person typed.
  return (
    <svg
      className="oa-art"
      width={size}
      height={size}
      viewBox={art.viewBox}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ overflow: 'visible' }}
      dangerouslySetInnerHTML={{ __html: uniq(art.body, suffix) }}
    />
  );
}

/** The picture in an owner frame. The whole drawing fits in `size` px; the picture sits inside it. */
export function OwnerFrame({ n, variant = 0, src, letter, size }: { n: number; variant?: number; src: string | null; letter: string; size: number }) {
  const suffix = useSuffix();
  const art = OWNER_FRAME_VARIANTS[n]?.[variant] ?? OWNER_FRAME_ART[n - 1];
  if (!art) return null;
  const [x, y, w, h] = art.fit;
  const clip = `pic-${suffix}`;
  const style: CSSProperties = { position: 'absolute', inset: 0, width: size, height: size, overflow: 'visible', pointerEvents: 'none' };
  return (
    <span className="oa-frame" style={{ position: 'relative', display: 'inline-block', width: size, height: size, flex: 'none' }}>
      <svg className="oa-art" viewBox={`0 0 ${art.box} ${art.box}`} style={style} aria-hidden="true">
        <g dangerouslySetInnerHTML={{ __html: uniq(art.under, suffix) }} />
        <clipPath id={clip}>
          <path d={art.clip} />
        </clipPath>
        <g clipPath={`url(#${clip})`}>
          <rect x={x} y={y} width={w} height={h} fill="#1b2230" />
          {src ? (
            <image href={src} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMin slice" />
          ) : (
            <text x={x + w / 2} y={y + h / 2} dominantBaseline="central" textAnchor="middle" fill="#cfe3ef" fontWeight="700" fontSize={Math.min(w, h) * 0.38} fontFamily="var(--font-numbers)">
              {letter.charAt(0).toUpperCase() || '?'}
            </text>
          )}
        </g>
        <g dangerouslySetInnerHTML={{ __html: uniq(art.over, suffix) }} />
      </svg>
    </span>
  );
}

/** Elder Futhark runes for the letters (name style 17 starts as runes). */
const RUNE: Record<string, string> = {
  a: 'ᚨ', b: 'ᛒ', c: 'ᚲ', d: 'ᛞ', e: 'ᛖ', f: 'ᚠ', g: 'ᚷ', h: 'ᚺ', i: 'ᛁ', j: 'ᛃ', k: 'ᚲ', l: 'ᛚ', m: 'ᛗ',
  n: 'ᚾ', o: 'ᛟ', p: 'ᛈ', q: 'ᚲ', r: 'ᚱ', s: 'ᛊ', t: 'ᛏ', u: 'ᚢ', v: 'ᚹ', w: 'ᚹ', x: 'ᛉ', y: 'ᛃ', z: 'ᛉ',
};
export const runeFor = (ch: string) => RUNE[ch.toLowerCase()] ?? ch;

const RAVEN = 'M-6 0.5 Q-3.5 -3.5 -0.5 -1 Q1.5 -5 6 -4 Q3 -1.6 2.2 0.6 L5 2.6 L1.2 1.9 L-0.6 3.4 Q-1 1.2 -6 0.5 Z';
const CLIPPED = new Set([1, 2, 3, 8, 9, 10]);

function Letters({ text, rune = false }: { text: string; rune?: boolean }) {
  return (
    <>
      {[...text].map((ch, i) => (
        <span key={i} className="oa-l" style={{ '--i': i } as CSSProperties} data-r={rune ? runeFor(ch) : undefined}>
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </>
  );
}

/** A name in owner name style n (1–20). The plain name stays readable for screen readers. */
export function OwnerName({ n, text }: { n: number; text: string }) {
  const cls = `oa-art oa-name oa-n${n} ${CLIPPED.has(n) ? 'oa-clip' : ''}`;
  const deco = (inner: React.ReactNode) => (
    <span className="oa-deco" aria-hidden="true">
      {inner}
    </span>
  );
  let body: React.ReactNode = text;
  switch (n) {
    case 5:
    case 8:
      body = (
        <>
          {text}
          {deco([12, 50, 84].map((l, i) => <i key={l} className="oa-dot" style={{ left: `${l}%`, top: i === 1 ? '78%' : '18%', animationDelay: `${i * 0.8}s` }} />))}
        </>
      );
      break;
    case 7:
      body = (
        <>
          <span className="oa-rune" aria-hidden="true">
            ᚺᛚ
          </span>
          <span className="oa-text">{text}</span>
          <span className="oa-rune" aria-hidden="true">
            ᛁᚦ
          </span>
        </>
      );
      break;
    case 11:
      body = (
        <>
          <svg viewBox="-7 -6 14 10" aria-hidden="true">
            <path d={RAVEN} fill="#0b0a14" stroke="#e8b85c" strokeWidth="0.5" />
          </svg>
          {text}
        </>
      );
      break;
    case 13:
      body = (
        <>
          <span className="oa-text oa-clip">{text}</span>
          {deco(
            <>
              <span className="oa-stars">
                {[0, 1, 2, 3, 4].map((i) => (
                  <b key={i} style={{ '--i': i } as CSSProperties}>
                    ★
                  </b>
                ))}
              </span>
              {[14, 36, 58, 80].map((l, i) => (
                <i key={l} className="oa-ember" style={{ left: `${l}%`, animationDelay: `${[0, 0.9, 0.4, 1.5][i]}s` }} />
              ))}
            </>,
          )}
        </>
      );
      break;
    case 15:
      body = (
        <>
          {text}
          {deco(
            <svg viewBox="0 0 200 40" preserveAspectRatio="none">
              <path d="M0 22 L30 14 L44 26 L70 10 L92 24 L120 12 L140 26 L168 14 L200 20" fill="none" stroke="#dff4ff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>,
          )}
        </>
      );
      break;
    case 16: {
      const pts: [number, number][] = [
        [8, 12],
        [30, 8],
        [52, 16],
        [86, 6],
        [112, 14],
        [140, 6],
        [168, 16],
        [192, 10],
      ];
      body = (
        <>
          {text}
          {deco(
            <svg viewBox="0 0 200 22" preserveAspectRatio="none">
              <path className="oa-cline" d={`M${pts.map(([a, b]) => `${a} ${b}`).join(' L')}`} fill="none" stroke="#fbe7a6" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
              {pts.map(([a, b], i) => (
                <circle key={i} cx={a} cy={b} r="2" fill="#fff" style={{ animationDelay: `${i * 0.3}s` }} />
              ))}
            </svg>,
          )}
        </>
      );
      break;
    }
    case 17:
    case 20:
      body = (
        <>
          <span className="oa-sr">{text}</span>
          <span aria-hidden="true">
            <Letters text={text} rune={n === 17} />
          </span>
          {n === 20 &&
            deco(
              [
                [6, 20, 0],
                [22, 60, 0.6],
                [40, 14, 1.2],
                [58, 64, 0.3],
                [74, 22, 0.9],
                [90, 58, 1.5],
              ].map(([l, t, d]) => (
                <i key={l} className="oa-cry" style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${d}s` }}>
                  ✻
                </i>
              )),
            )}
        </>
      );
      break;
    case 19:
      body = (
        <>
          {deco(
            <svg className="oa-rib" viewBox="0 0 300 70" preserveAspectRatio="none">
              <path d="M6 18 L28 22 L28 54 L6 50 L16 36 Z M294 18 L272 22 L272 54 L294 50 L284 36 Z" fill="#5a0f15" />
              <path className="oa-ribwave" d="M24 16 Q90 4 150 16 T276 16 V54 Q210 66 150 54 T24 54 Z" fill="#8c1d22" stroke="#e8b85c" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
            </svg>,
          )}
          <span className="oa-sr">{text}</span>
          <span className="oa-text" aria-hidden="true">
            <Letters text={text} />
          </span>
          {deco(
            <svg className="oa-seal" viewBox="0 0 40 40">
              <path d="M20 2 Q26 4 30 3 Q33 8 37 11 Q36 16 38 20 Q36 25 37 29 Q32 32 30 37 Q25 36 20 38 Q15 36 10 37 Q8 32 3 29 Q4 24 2 20 Q4 15 3 11 Q7 8 10 3 Q15 4 20 2 Z" fill="#a3161c" />
              <circle cx="20" cy="20" r="11" fill="none" stroke="#6a0c10" strokeWidth="1.4" />
              <path d="M15 13 V27 M25 13 V27 M15 18 L25 22" stroke="#6a0c10" strokeWidth="2" strokeLinecap="round" />
            </svg>,
          )}
        </>
      );
      break;
  }
  return <span className={cls}>{body}</span>;
}
