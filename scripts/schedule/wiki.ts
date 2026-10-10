/**
 * Reading the community wikis (honkai-star-rail.fandom.com,
 * zenless-zone-zero.fandom.com) through their public MediaWiki API. The wikis
 * copy the official notices (each page links the HoYoLAB post it came from) and
 * add what the notices only show as pictures: reward amounts and the featured
 * items of each banner. Pure parsing here; fetching is in fetchWiki().
 */
import { at, SERVER_OFFSET } from './text.ts';

export interface WikiPage {
  title: string;
  text: string;
}

/** Fields of the first {{Template ...}} block on a page ("|time_start = 2026-09-28 11:00:00"). */
export function infobox(text: string): Record<string, string> {
  const start = text.indexOf('{{');
  if (start < 0) return {};
  // Walk to the matching "}}" so nested templates don't cut it short.
  let depth = 0;
  let end = start;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') {
      depth++;
      i++;
    } else if (text[i] === '}' && text[i + 1] === '}') {
      depth--;
      i++;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = text.slice(start, end).replace(/<!--[\s\S]*?-->/g, '');
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/^\|[ \t]*([a-z0-9_-]+)[ \t]*=[ \t]*(.*)$/gim)) out[m[1]!.toLowerCase()] = m[2]!.trim();
  return out;
}

/**
 * time_start / time_end with their offset. The wikis write "GMT+8"/"UTC+8" when the
 * notice gave UTC+8, and leave the offset out (or commented out) for server time,
 * which this project reads at the Asia server's UTC+8 (see text.ts).
 */
export function wikiTime(box: Record<string, string>, which: 'start' | 'end'): string | undefined {
  const raw = box[`time_${which}`];
  if (!raw || !/^\d{4}-\d{2}-\d{2}/.test(raw)) return undefined;
  const off = /([+-]\d+)/.exec(box[`time_${which}_offset`] ?? '')?.[1];
  const stamp = raw.length <= 10 ? `${raw} 00:00:00` : raw;
  return at(stamp, off === undefined ? SERVER_OFFSET : Number(off));
}

/** Links in a "===Heading===" section of a version page: [[Page/2026-09-28|Label]] → "Page/2026-09-28". */
export function sectionLinks(text: string, heading: RegExp): string[] {
  const lines = text.split('\n');
  const out: string[] = [];
  let inside = false;
  let level = 0;
  for (const line of lines) {
    const h = /^(=+)\s*(.*?)\s*=+\s*$/.exec(line);
    if (h) {
      if (inside && h[1]!.length <= level) inside = false;
      if (heading.test(h[2]!)) {
        inside = true;
        level = h[1]!.length;
      }
      continue;
    }
    if (!inside || !/^\s*\*/.test(line)) continue;
    // The first link on a list line is the item; later ones are featured characters.
    const m = /\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/.exec(line);
    if (m) out.push(m[1]!.trim());
  }
  return [...new Set(out)];
}

/** Total of an item in the page's reward cards: {{Card|Stellar Jade|100}}, {{Card List|Stellar Jade*100;…}}, Stellar Jade*100. */
export function rewardTotal(text: string, item: string): number {
  const esc = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let total = 0;
  for (const m of text.matchAll(new RegExp(String.raw`\{\{Card\|${esc}\|([\d,]+)`, 'g'))) total += Number(m[1]!.replace(/,/g, ''));
  for (const m of text.matchAll(new RegExp(String.raw`(?:^|[|;])\s*${esc}\s*\*\s*([\d,]+)`, 'gm'))) total += Number(m[1]!.replace(/,/g, ''));
  return total;
}

/** Featured items from a banner's pool template: character_5_F = Pearl; lightcone_4_F = A; B. */
export function poolFeatured(box: Record<string, string>): { top: string[]; mid: string[] } {
  const pick = (re: RegExp) =>
    Object.entries(box)
      .filter(([k]) => re.test(k))
      .flatMap(([, v]) => v.split(';'))
      .map((s) => s.trim())
      .filter(Boolean);
  return { top: pick(/_5_f$|^s_f$|_s_f$/), mid: pick(/_4_f$|^a_f$|_a_f$/) };
}

/** The pool template on a banner page (Warp Pool / Signal Pool …), found by its featured fields. */
export function poolBox(text: string): Record<string, string> {
  const at = text.search(/\{\{[^{}|]*Pool\s*\n?\|/);
  return at < 0 ? {} : infobox(text.slice(at));
}

const UA = 'PROJECT-HLITH data import (https://github.com/hymntohimeros/project-hlith)';

/** Pages by title, 40 per request, following redirects. Missing pages are left out. */
export async function fetchWiki(host: string, titles: string[]): Promise<Map<string, WikiPage>> {
  const out = new Map<string, WikiPage>();
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40);
    const url = `https://${host}/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&redirects=1&titles=${encodeURIComponent(batch.join('|'))}`;
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (!res.ok) throw new Error(`${host}: HTTP ${res.status}`);
    const data = (await res.json()) as {
      query?: {
        pages?: { title: string; missing?: boolean; revisions?: { slots: { main: { content: string } } }[] }[];
        redirects?: { from: string; to: string }[];
        normalized?: { from: string; to: string }[];
      };
    };
    const q = data.query ?? {};
    const alias = new Map<string, string>();
    for (const n of [...(q.normalized ?? []), ...(q.redirects ?? [])]) alias.set(n.from, n.to);
    const byTitle = new Map<string, WikiPage>();
    for (const p of q.pages ?? []) {
      const text = p.revisions?.[0]?.slots.main.content;
      if (!p.missing && text !== undefined) byTitle.set(p.title, { title: p.title, text });
    }
    for (const t of batch) {
      let real = t.replace(/_/g, ' ');
      for (let k = 0; k < 3 && alias.has(real); k++) real = alias.get(real)!;
      const page = byTitle.get(real) ?? byTitle.get(t);
      if (page) out.set(t, page);
    }
  }
  return out;
}

/** Titles starting with a prefix (e.g. "Deadly Assault/2026-"). */
export async function wikiPrefix(host: string, prefix: string): Promise<string[]> {
  const url = `https://${host}/api.php?action=query&list=allpages&aplimit=500&format=json&formatversion=2&apprefix=${encodeURIComponent(prefix)}`;
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${host}: HTTP ${res.status}`);
  const data = (await res.json()) as { query?: { allpages?: { title: string }[] } };
  return (data.query?.allpages ?? []).map((p) => p.title);
}
