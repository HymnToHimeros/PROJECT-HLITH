/**
 * App icons for the installable app (manifest, home screen, favicon, the loading mark).
 *
 * The icon is Hagalaz (the hail rune) inside the astrolabe ring: the owner picked "icon 4" from
 * the T64 option sheet as the official app icon (docs/progress/2026-10-11-frame-t64-options.md).
 * It replaced the first icon (the full astrolabe with the nine worlds, T45), whose files are kept
 * in docs/design/app-icon-astrolabe/.
 *
 * Writes public/icons/hagalaz-*.svg and renders the PNG sizes with Chromium.
 *
 *   node scripts/app-icons.ts            (PW_CHROMIUM=/path/to/chrome to use a given browser)
 *
 * The file names carry the icon's name on purpose: a new icon gets new names, so browsers, phone
 * home screens and the app's service worker never keep showing the old one from their cache.
 * Re-run only when the icon or the colours change; the files are committed.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BG = '#08090b'; // --bg-app
const INK = '#cfe3ef'; // --ink-2
const GLACIER = '#7fb4d6'; // --glacier
const EMBER = '#ff6a1f'; // --ember

const f = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

/** The ring's 48 ticks (every sixth one longer), as in the option sheet. */
function ticks(): string {
  const out: string[] = [];
  for (let i = 0; i < 48; i++) {
    const ang = (2 * Math.PI * i) / 48;
    const r2 = i % 6 === 0 ? 178 : 186;
    out.push(`M${f(Math.cos(ang) * 202)} ${f(Math.sin(ang) * 202)}L${f(Math.cos(ang) * r2)} ${f(Math.sin(ang) * r2)}`);
  }
  return out.join('');
}

/** The mark around 0,0 in the sheet's 512 units: ring, ticks, the Hagalaz rune, the ember. */
const MARK =
  `<circle r="220" fill="none" stroke="${INK}" stroke-width="10"/>` +
  `<path d="${ticks()}" stroke="${GLACIER}" stroke-width="6" stroke-linecap="round" fill="none"/>` +
  `<path d="M-60 -125V125M60 -125V125M-60 -40L60 40" fill="none" stroke="${INK}" stroke-width="22" stroke-linecap="round"/>` +
  `<circle r="20" fill="${EMBER}"/>`;

/** A square icon of 512 units. `scale` shrinks the mark (maskable keeps to the safe zone); `rounded` = the sheet's tile. */
const icon = (scale: number, rounded: boolean) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
  `<rect width="512" height="512" fill="${BG}"${rounded ? ' rx="112"' : ''}/>` +
  `<g transform="translate(256 256)${scale === 1 ? '' : ` scale(${scale})`}">${MARK}</g></svg>`;

const out = 'public/icons';
mkdirSync(out, { recursive: true });
const files: { name: string; svg: string; sizes: { size: number; file: string }[] }[] = [
  // "any": the rounded tile exactly as the owner saw it on the sheet.
  { name: 'hagalaz', svg: icon(1, true), sizes: [192, 512].map((size) => ({ size, file: `hagalaz-${size}` })) },
  // Maskable: the phone cuts its own shape, so the ring stays inside the middle 80% (the safe zone).
  { name: 'hagalaz-maskable', svg: icon(0.86, false), sizes: [192, 512].map((size) => ({ size, file: `hagalaz-maskable-${size}` })) },
  // iOS rounds the corners itself and wants no transparency.
  { name: 'hagalaz-apple-touch', svg: icon(0.92, false), sizes: [{ size: 180, file: 'hagalaz-apple-touch-180' }] },
  // Browser tab: the rounded tile, so it doesn't read as a black square.
  { name: 'hagalaz-favicon', svg: icon(1, true), sizes: [{ size: 32, file: 'hagalaz-favicon-32' }] },
];

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage();
for (const entry of files) {
  writeFileSync(`${out}/${entry.name}.svg`, entry.svg);
  for (const { size, file } of entry.sizes) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${entry.svg}`);
    await page.screenshot({ path: `${out}/${file}.png`, omitBackground: true });
  }
}
await browser.close();
console.log(`Icons written to ${out}/`);
