/**
 * App icons for the installable app (manifest, home screen, favicon), drawn from the dark theme's
 * emblem: the astrolabe rings and the nine worlds (ThemeArt.tsx, ThemeMotif "dark"), thicker so
 * they read at icon size. Writes public/icons/*.svg and renders the PNG sizes with Chromium.
 *
 *   node scripts/app-icons.ts
 *
 * Re-run only when the emblem or the colours change; the files are committed.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BG = '#08090b'; // --bg-app
const INK = '#cfe3ef'; // --ink-2
const GLACIER = '#7fb4d6'; // --glacier
const EMBER = '#ff6a1f'; // --ember

const f = (n: number) => Math.round(n * 10) / 10;

/** The emblem around 0,0 with radius 1 (rings) for a given scale. */
function emblem(scale: number): string {
  const r = 150 * scale;
  const ticks: string[] = [];
  for (let i = 0; i < 48; i++) {
    const ang = (2 * Math.PI * i) / 48;
    const long = i % 6 === 0;
    const r1 = r * 0.92;
    const r2 = r * (long ? 0.8 : 0.86);
    ticks.push(`M${f(Math.cos(ang) * r1)} ${f(Math.sin(ang) * r1)}L${f(Math.cos(ang) * r2)} ${f(Math.sin(ang) * r2)}`);
  }
  const w = (n: number) => f(n * scale);
  const star = Array.from({ length: 9 }, (_, i) => {
    const ang = -Math.PI / 2 + (2 * Math.PI * i) / 9;
    return [Math.cos(ang) * 80 * scale, Math.sin(ang) * 80 * scale] as const;
  });
  const path = star.map((_, i) => star[(i * 4) % 9] as readonly [number, number]);
  return [
    `<g fill="none" stroke="${INK}" stroke-linecap="round">`,
    `<circle r="${f(r)}" stroke-width="${w(7)}"/>`,
    `<path d="${ticks.join('')}" stroke="${GLACIER}" stroke-width="${w(4)}"/>`,
    `<circle r="${f(r * 0.62)}" stroke="${GLACIER}" stroke-width="${w(3)}" stroke-dasharray="${w(4)} ${w(10)}"/>`,
    `<path d="M${path.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z" stroke-width="${w(4)}" stroke-linejoin="round"/>`,
    `<path d="M0 ${f(-104 * scale)}V${f(104 * scale)}" stroke="${GLACIER}" stroke-width="${w(3)}"/>`,
    '</g>',
    `<g fill="${INK}">${star.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${w(9)}"/>`).join('')}</g>`,
    `<circle r="${w(14)}" fill="${EMBER}"/>`,
  ].join('');
}

/** A square icon of 512 units; `fill` = how much of the width the rings take (maskable keeps to the safe zone). */
const icon = (fill: number, rounded = false) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
  `<rect width="512" height="512" fill="${BG}"${rounded ? ' rx="112"' : ''}/>` +
  `<g transform="translate(256 256)">${emblem((512 * fill) / 2 / 150)}</g></svg>`;

const out = 'public/icons';
mkdirSync(out, { recursive: true });
const files: { name: string; svg: string; sizes: number[] }[] = [
  // "any": the rings fill most of the square. Maskable: inside the middle 80% (the safe zone).
  { name: 'icon', svg: icon(0.84), sizes: [192, 512] },
  { name: 'maskable', svg: icon(0.62), sizes: [192, 512] },
  // iOS rounds the corners itself and wants no transparency.
  { name: 'apple-touch-icon', svg: icon(0.74), sizes: [180] },
  // Browser tab: rounded, so it doesn't read as a black square.
  { name: 'favicon', svg: icon(0.86, true), sizes: [32] },
];

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage();
for (const file of files) {
  writeFileSync(`${out}/${file.name}.svg`, file.svg);
  for (const size of file.sizes) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${file.svg}`);
    const name = file.sizes.length > 1 ? `${file.name}-${size}` : file.name;
    await page.screenshot({ path: `${out}/${name}.png`, omitBackground: true });
  }
}
await browser.close();
console.log(`Icons written to ${out}/`);
