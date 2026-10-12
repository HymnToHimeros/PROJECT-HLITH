/**
 * A skin's pack (T74): the pictures its styles use, as one JSON file in the theme's private store.
 * Loaded only while the theme is worn, every drawing cleaned (svgClean.ts) before use:
 * - scene: drawings layered behind the page, shown inline so their sk-… motion follows Animations;
 * - frame, corner, side, head, flourish, divider, mark: still pictures the CSS paints (skins.css).
 */
import { useEffect, useState } from 'react';
import { cleanSvg } from './svgClean';

/** Where pack files come from (the theme's private store). */
export interface PackSource {
  download(path: string): Promise<Blob | null>;
}

export const SCENE_PLACES = ['fill', 'top', 'bottom', 'left', 'right', 'center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
export type ScenePlace = (typeof SCENE_PLACES)[number];
export const IMAGE_SLOTS = ['frame', 'corner', 'side', 'head', 'flourish', 'divider', 'mark'] as const;
export type ImageSlot = (typeof IMAGE_SLOTS)[number];

export interface SkinPack {
  scene: { markup: string; place: ScenePlace; opacity: number }[];
  /** CSS variables for <html>: the pictures as url(blob:…) plus the frame's numbers. */
  vars: Record<string, string>;
  /** Which pictures there are (data-skin-art). */
  art: ImageSlot[];
  urls: string[];
  problems: string[];
}

const num = (v: unknown, min: number, max: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);

/** A cleaned drawing mirrored for each corner: tl as drawn, tr flipped left-right, bl top-bottom, br both. */
export function turned(svg: string): Record<'tl' | 'tr' | 'bl' | 'br', string> {
  const box = /viewBox="([-\d.]+)[ ,]+([-\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)"/.exec(svg);
  const w = box ? Number(box[3]) : 100;
  const h = box ? Number(box[4]) : 100;
  const inner = svg.replace(/^<svg([^>]*)>/, (_m, a: string) => `<svg${a.replace(/\s(width|height)="[^"]*"/g, '')} width="${w}" height="${h}">`);
  const wrap = (t: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><g transform="${t}">${inner}</g></svg>`;
  return { tl: svg, tr: wrap(`translate(${w} 0) scale(-1 1)`), bl: wrap(`translate(0 ${h}) scale(1 -1)`), br: wrap(`translate(${w} ${h}) scale(-1 -1)`) };
}

/** Turns a pack's JSON into a ready pack (pictures cleaned and made into links). */
export function readPack(raw: unknown, makeUrl: (svg: string) => string = (svg) => URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))): SkinPack {
  const pack: SkinPack = { scene: [], vars: {}, art: [], urls: [], problems: [] };
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const scene = Array.isArray(r.scene) ? r.scene.slice(0, 8) : [];
  scene.forEach((layer, i) => {
    const l = layer && typeof layer === 'object' ? (layer as Record<string, unknown>) : {};
    const markup = cleanSvg(String(l.svg ?? ''));
    if (!markup) return void pack.problems.push(`scene ${i + 1}: not a usable drawing.`);
    const place = (SCENE_PLACES as readonly unknown[]).includes(l.place) ? (l.place as ScenePlace) : 'fill';
    pack.scene.push({ markup, place, opacity: num(l.opacity, 0.05, 1, 1) });
  });
  for (const slot of IMAGE_SLOTS) {
    const s = r[slot];
    if (!s || typeof s !== 'object') continue;
    const o = s as Record<string, unknown>;
    const svg = cleanSvg(String(o.svg ?? ''));
    if (!svg) {
      pack.problems.push(`${slot}: not a usable drawing.`);
      continue;
    }
    pack.art.push(slot);
    if (slot === 'corner') {
      // One drawing for the top-left corner, turned for the other three.
      for (const [at, svgAt] of Object.entries(turned(svg))) {
        const u = makeUrl(svgAt);
        pack.urls.push(u);
        pack.vars[`--skin-corner-${at}`] = `url("${u}")`;
      }
    } else {
      const url = makeUrl(svg);
      pack.urls.push(url);
      pack.vars[`--skin-${slot}`] = `url("${url}")`;
    }
    if (slot === 'frame') {
      pack.vars['--skin-frame-slice'] = String(num(o.slice, 2, 200, 24));
      pack.vars['--skin-frame-width'] = `${num(o.width, 2, 60, 16)}px`;
      pack.vars['--skin-frame-outset'] = `${num(o.outset, 0, 20, 0)}px`;
    }
    if (slot === 'corner') pack.vars['--skin-corner-size'] = `${num(o.size, 8, 96, 36)}px`;
    if (slot === 'side' || slot === 'head') pack.vars[`--skin-${slot}-size`] = `${num(o.size, 40, 900, slot === 'side' ? 320 : 120)}px`;
    if (slot === 'flourish' || slot === 'divider' || slot === 'mark') pack.vars[`--skin-${slot}-size`] = `${num(o.size, 8, 600, slot === 'mark' ? 18 : 180)}px`;
  }
  return pack;
}

const cache = new Map<string, Promise<SkinPack | null>>();

/** Loads a pack once per path (the store, or null when it isn't there or can't be read). */
export function loadPack(source: PackSource, path: string): Promise<SkinPack | null> {
  let p = cache.get(path);
  if (!p) {
    p = source
      .download(path)
      .then(async (blob) => (blob ? readPack(JSON.parse(await blob.text())) : null))
      .catch(() => null);
    cache.set(path, p);
  }
  return p;
}

/** Forget loaded packs (signed out, or themes reloaded). */
export function clearPacks(): void {
  for (const p of cache.values()) void p.then((pack) => pack?.urls.forEach((u) => URL.revokeObjectURL(u)));
  cache.clear();
}

let packSource: PackSource | null = null;
/** Where packs come from: set when the private themes load. */
export function setPackSource(source: PackSource | null): void {
  packSource = source;
}

/** The worn theme's pack, applied to <html> while it is worn. */
export function useSkinPack(path: string | undefined): SkinPack | null {
  const [loaded, setLoaded] = useState<{ path: string; pack: SkinPack | null } | null>(null);
  const pack = path && loaded?.path === path ? loaded.pack : null;
  useEffect(() => {
    if (!path || !packSource) return;
    let live = true;
    void loadPack(packSource, path).then((p) => live && setLoaded({ path, pack: p }));
    return () => {
      live = false;
    };
  }, [path]);
  useEffect(() => {
    if (!pack || typeof document === 'undefined') return;
    const root = document.documentElement;
    for (const [k, v] of Object.entries(pack.vars)) root.style.setProperty(k, v);
    root.dataset.skinArt = pack.art.join(' ');
    return () => {
      for (const k of Object.keys(pack.vars)) root.style.removeProperty(k);
      delete root.dataset.skinArt;
    };
  }, [pack]);
  return pack;
}
