import type { Plugin } from 'vite';
import { COPYRIGHT, FAN_NOTICE, LICENSE_URL, PAGES, type Block, type LegalPage } from './content.ts';

/**
 * The public pages (T55) as plain HTML files: /about, /privacy and /terms. They open without
 * signing in and without the app's JavaScript (what Google's review and search engines need),
 * in HLIÐSKJÁLF's Glacier colours, light or dark with the device. The hosting serves
 * privacy.html at /privacy (Cloudflare's default HTML handling).
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** **bold** and [text](link), on already-escaped text. Links are only site paths or https. */
export function inline(text: string): string {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((\/[a-z]*|https:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

function block(b: Block): string {
  if ('h' in b) return `<h2>${inline(b.h)}</h2>`;
  if ('p' in b) return `<p>${inline(b.p)}</p>`;
  if ('note' in b) return `<p class="note">${inline(b.note)}</p>`;
  return `<ul>${b.list.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`;
}

const STYLE = `
:root{color-scheme:dark;--bg:#08090b;--card:#0e1115;--line:#1e242c;--ink1:#e6eef3;--ink2:#cfe3ef;--ink3:#a9bbc8;--ink4:#768b9c;--accent:#7fb4d6}
@media (prefers-color-scheme:light){:root{color-scheme:light;--bg:#f4f7f9;--card:#ffffff;--line:#d5dee5;--ink1:#0b1620;--ink2:#1d2b37;--ink3:#3a4b59;--ink4:#4d5f6d;--accent:#1d5f8c}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink2);font:16px/1.6 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:24px 16px 64px}
header{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px 16px;padding-bottom:16px;border-bottom:1px solid var(--line)}
.brand{font-weight:800;letter-spacing:.04em;color:var(--ink1);text-decoration:none;font-size:18px}
nav{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:14px}
a{color:var(--accent);text-underline-offset:3px}
h1{color:var(--ink1);font-size:32px;line-height:1.2;margin:28px 0 4px}
.updated{color:var(--ink4);font-size:14px;margin:0 0 20px}
h2{color:var(--ink1);font-size:20px;margin:32px 0 8px}
p,li{color:var(--ink3)}
strong{color:var(--ink1)}
ul{padding-left:22px}li{margin:6px 0}
.note{margin-top:36px;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--card);font-size:14px}
footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);font-size:14px;color:var(--ink4)}
footer p{margin:0 0 6px;color:var(--ink4)}
`;

export function renderPage(page: LegalPage): string {
  const nav = [
    ['/', 'Open HLIÐSKJÁLF'],
    ['/about', 'About'],
    ['/privacy', 'Privacy'],
    ['/terms', 'Terms'],
  ]
    .map(([href, label]) => `<a href="${href}"${href === `/${page.slug}` ? ' aria-current="page"' : ''}>${label}</a>`)
    .join('');
  const heading = page.slug === 'about' ? '<h1>HLIÐSKJÁLF</h1>' : `<h1>${esc(page.title)}</h1><p class="updated">Last updated ${esc(page.updated)}</p>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="referrer" content="same-origin" />
<meta name="description" content="${esc(page.description)}" />
<link rel="icon" href="/icons/hagalaz-favicon.svg" type="image/svg+xml" />
<link rel="icon" href="/icons/hagalaz-favicon-32.png" type="image/png" sizes="32x32" />
<title>${esc(page.slug === 'about' ? 'HLIÐSKJÁLF · PROJECT-HLITH' : `${page.title} · HLIÐSKJÁLF`)}</title>
<style>${STYLE.trim()}</style>
</head>
<body>
<div class="wrap">
<header><a class="brand" href="/about">HLIÐSKJÁLF</a><nav aria-label="Pages">${nav}</nav></header>
<main>
${heading}
${page.blocks.map(block).join('\n')}
</main>
<footer><p>PROJECT-HLITH · ${esc(FAN_NOTICE)}</p><p>${esc(COPYRIGHT).replace('LICENSE', `<a href="${LICENSE_URL}">LICENSE</a>`)}</p></footer>
</div>
</body>
</html>
`;
}

/** Writes about.html, privacy.html and terms.html into the build. */
export function legalPages(): Plugin {
  return {
    name: 'hlith-legal-pages',
    apply: 'build',
    generateBundle() {
      for (const page of PAGES) this.emitFile({ type: 'asset', fileName: `${page.slug}.html`, source: renderPage(page) });
    },
  };
}
