// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSkportToken } from '../src/tools/account-links/skport';

describe('SKPort token paste', () => {
  it('decodes the URL-encoded cookie value the browser shows (%2F → /)', () => {
    expect(readSkportToken('abcDEF123%2Fxyz%2B%3D%3D')).toEqual({ ok: true, token: 'abcDEF123/xyz+==' });
  });
  it('keeps a plain token as it is, and refuses broken encoding or pasted cookie lists', () => {
    expect(readSkportToken('  abcDEF123/xyz+==  ')).toEqual({ ok: true, token: 'abcDEF123/xyz+==' });
    expect(readSkportToken('abcDEF123%E0%A4%A')).toEqual({ ok: false });
    expect(readSkportToken('ACCOUNT_TOKEN=abc; other=def')).toEqual({ ok: false });
  });
});

describe('SKPort steps point at a page a player can open', () => {
  const src = readFileSync(resolve(__dirname, '../src/tools/account-links/SkportLogin.tsx'), 'utf8');
  it('sends players to the Endfield sign-in page, never to the API host', () => {
    expect(src).toContain('https://game.skport.com/endfield/sign-in');
    expect(src).not.toMatch(/open\s*<span[^>]*>zonai\.skport\.com/);
    expect(src).not.toContain('zonai.skport.com/web/cookie_store</span>');
  });
});
