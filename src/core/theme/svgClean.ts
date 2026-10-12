/**
 * Cleans an SVG drawing from a theme's private pack before it is shown (T74). Only plain drawing
 * elements and attributes on the list below survive; scripts, event handlers, links to other
 * files, foreign content, styles and animation elements are dropped. Ids are given a prefix so two
 * drawings on one page never clash. Classes keep only the generic motion names of skins.css
 * (sk-…), so the app's Animations setting decides what moves.
 */

const ELEMENTS = new Set([
  'svg', 'g', 'defs', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'lineargradient', 'radialgradient', 'stop',
  'clippath', 'mask', 'pattern', 'symbol', 'use', 'filter', 'fegaussianblur', 'feoffset', 'femerge', 'femergenode', 'fecolormatrix',
  'feblend', 'feflood', 'fecomposite', 'fedropshadow', 'femorphology',
]);
/** Lower-case names; the original spelling is written back from the element. */
const ATTRS = new Set([
  'id', 'class', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'viewbox',
  'preserveaspectratio', 'transform', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
  'stroke-dashoffset', 'stroke-opacity', 'stroke-miterlimit', 'fill-opacity', 'opacity', 'fill-rule', 'clip-rule', 'clip-path', 'mask',
  'filter', 'offset', 'stop-color', 'stop-opacity', 'gradientunits', 'gradienttransform', 'spreadmethod', 'fx', 'fy', 'fr',
  'patternunits', 'patterntransform', 'patterncontentunits', 'maskunits', 'maskcontentunits', 'clippathunits', 'href', 'xlink:href',
  'stddeviation', 'dx', 'dy', 'in', 'in2', 'result', 'mode', 'values', 'type', 'flood-color', 'flood-opacity', 'operator', 'k1', 'k2',
  'k3', 'k4', 'radius', 'vector-effect', 'paint-order', 'filterunits', 'primitiveunits', 'color', 'pathlength',
]);
const PAINT = new Set(['fill', 'stroke', 'stop-color', 'flood-color', 'color']);
const REF = new Set(['clip-path', 'mask', 'filter']);
const PAINT_VALUE = /^(none|currentColor|transparent|#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\)|url\(#[\w-]+\))$/i;
const REF_VALUE = /^(none|url\(#[\w-]+\))$/;
/** Numbers, lists, path data, transforms and plain names: no quotes, colons, slashes or brackets. */
const PLAIN = /^[\w\s.,%+()-]*$/;
const MOTION_CLASS = /^sk-[a-z0-9-]{1,24}$/;
export const MAX_SVG = 300_000;

let counter = 0;

/** The cleaned drawing as SVG text, or null when it isn't a usable SVG. */
export function cleanSvg(text: string, prefix = `s${(counter++).toString(36)}`): string | null {
  if (typeof text !== 'string' || text.length > MAX_SVG || typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
  const ids = new Map<string, string>();
  root.querySelectorAll('[id]').forEach((el) => {
    const id = el.getAttribute('id') ?? '';
    if (/^[\w-]{1,60}$/.test(id)) ids.set(id, `${prefix}-${id}`);
  });
  const fixRef = (v: string) => v.replace(/url\(#([\w-]+)\)/g, (_m, id: string) => (ids.has(id) ? `url(#${ids.get(id)})` : 'none'));
  const out: string[] = [];
  const walk = (el: Element) => {
    const tag = el.localName;
    if (!ELEMENTS.has(tag.toLowerCase())) return;
    const attrs: string[] = [];
    for (const a of Array.from(el.attributes)) {
      const name = a.name;
      const lower = name.toLowerCase();
      const v = a.value.trim();
      if (lower === 'xmlns' || lower === 'xmlns:xlink') continue;
      if (!ATTRS.has(lower) || v.length > 20_000) continue;
      let value: string | null = v;
      if (lower === 'id') value = ids.get(v) ?? null;
      else if (lower === 'class') value = v.split(/\s+/).filter((c) => MOTION_CLASS.test(c)).join(' ') || null;
      else if (lower === 'href' || lower === 'xlink:href') value = /^#[\w-]+$/.test(v) && ids.has(v.slice(1)) ? `#${ids.get(v.slice(1))}` : null;
      else if (PAINT.has(lower)) value = PAINT_VALUE.test(v) ? fixRef(v) : null;
      else if (REF.has(lower)) value = REF_VALUE.test(v) ? fixRef(v) : null;
      else if (!PLAIN.test(v) || /url|script|expression|javascript/i.test(v)) value = null;
      if (value !== null) attrs.push(`${lower === 'xlink:href' ? 'href' : name}="${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"`);
    }
    if (tag === 'svg' && el === root) attrs.push('xmlns="http://www.w3.org/2000/svg"');
    out.push(`<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}>`);
    for (const c of Array.from(el.children)) walk(c);
    out.push(`</${tag}>`);
  };
  walk(root);
  return out.join('');
}
