// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTACT, PAGES, PRIVACY, TERMS } from '../config/legal/content';
import { inline, renderPage } from '../config/legal/pages';

const text = (p: (typeof PAGES)[number]) => JSON.stringify(p.blocks);

describe('public pages: About, Privacy, Terms (T55)', () => {
  it('render as complete pages that link to each other and carry the fan notice', () => {
    for (const p of PAGES) {
      const html = renderPage(p);
      expect(html).toMatch(/^<!doctype html>/);
      for (const href of ['/about', '/privacy', '/terms', '/']) expect(html).toContain(`href="${href}"`);
      expect(html).toContain('not affiliated with, endorsed or sponsored by HoYoverse');
      expect(html).not.toMatch(/<script/i);
    }
  });

  it('only allow bold and safe links in the text; anything else is shown as text', () => {
    expect(inline('**a** [b](/privacy) [c](javascript:alert(1)) <img>')).toBe('<strong>a</strong> <a href="/privacy">b</a> [c](javascript:alert(1)) &lt;img&gt;');
  });

  it('the project’s public contact address on every page, and no other address anywhere', () => {
    expect(CONTACT).toBe('hlidskjalf.contact@gmail.com');
    for (const p of PAGES) {
      expect(text(p)).toContain(CONTACT);
      const html = renderPage(p);
      expect(html).not.toContain('[CONTACT EMAIL]');
      for (const addr of html.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) expect(addr).toBe(CONTACT);
    }
    const license = readFileSync(resolve(__dirname, '../LICENSE'), 'utf8');
    for (const addr of license.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) expect(addr).toBe(CONTACT);
    expect(license).toContain(CONTACT);
  });

  it('the copyright line and the LICENSE link, on every page and in the terms', () => {
    for (const p of PAGES) {
      const html = renderPage(p);
      expect(html).toContain('© 2026 HymnToHimeros. All rights reserved. See <a href="https://github.com/HymnToHimeros/PROJECT-HLITH/blob/main/LICENSE">LICENSE</a>.');
    }
    expect(text(TERMS)).toContain('[LICENSE](https://github.com/HymnToHimeros/PROJECT-HLITH/blob/main/LICENSE)');
    const license = readFileSync(resolve(__dirname, '../LICENSE'), 'utf8');
    expect(license).toContain('Copyright (c) 2026 HymnToHimeros (HLIÐSKJÁLF / PROJECT-HLITH). All rights reserved.');
    expect(JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'))).toMatchObject({ private: true, license: 'SEE LICENSE IN LICENSE' });
  });

  it('the privacy policy says what the code does', () => {
    const t = text(PRIVACY);
    // Where: the Supabase project's real region.
    expect(t).toContain('London, United Kingdom');
    // How long: the purge job's grace period and backup retention.
    const purge = readFileSync(resolve(__dirname, '../supabase/functions/_shared/purgePlan.ts'), 'utf8');
    const account = readFileSync(resolve(__dirname, '../supabase/functions/_shared/accountPlan.ts'), 'utf8');
    expect(purge).toMatch(/BACKUP_KEEP_DAYS = 30;/);
    expect(account).toMatch(/GRACE_DAYS = 30;/);
    expect(t).toContain('30-day grace period');
    expect(t).toContain('kept for **30 days**');
    // No cookies, no analytics: nothing in the app sets a cookie or loads a tracker.
    expect(t).toContain('**sets no cookies**');
    const src = (dir: string): string[] =>
      readdirSync(resolve(__dirname, '..', dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? src(`${dir}/${e.name}`) : /\.(tsx?|html)$/.test(e.name) ? [`${dir}/${e.name}`] : []));
    const code = src('src').map((f) => readFileSync(resolve(__dirname, '..', f), 'utf8')).join('\n');
    expect(code).not.toMatch(/document\.cookie\s*=|gtag\(|googletagmanager|plausible|posthog|sentry/i);
    // Exactly what Discord sign-in gives us (Supabase always asks Discord for identify + email).
    expect(t).toContain('Discord user ID, username, display name, avatar picture link and the email address');
    // And Google sign-in: only the openid, email and profile permissions.
    expect(t).toContain('**Google** (open to everyone): your Google account ID, name, email address and profile picture link');
    expect(t).toContain('“openid”, “email” and “profile”');
    // The Assistant key never goes into a backup file.
    expect(t).toContain('never in backup files');
    expect(readFileSync(resolve(__dirname, '../src/core/data/backup.ts'), 'utf8')).toContain("k === 'hlith.assistant.key'");
  });
});
