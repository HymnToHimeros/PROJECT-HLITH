// @vitest-environment node
/** T18: suggestions for your own teams come from your account, ranked by %, with theory only when asked. */
import { describe, expect, it } from 'vitest';
import type { TeamAccount } from '../src/core/contract';
import { library as hsrLib } from '../src/games/hsr/kitcheck/library';
import { whoFits as hsrFits } from '../src/games/hsr/kitcheck/team';
import { library as zzzLib } from '../src/games/zzz/kitcheck/library';
import { whoFits as zzzFits } from '../src/games/zzz/kitcheck/team';

const idOf = (lib: { names: Map<string, string> }, n: string) => [...lib.names].find(([, v]) => v === n)?.[0] ?? n;
const account = (owned: Record<string, number>, extra: Partial<TeamAccount> = {}): TeamAccount => ({ owned: (id) => id in owned, dupes: (id) => owned[id] ?? 0, ...extra });

describe('Who fits from your account (T18)', () => {
  const h = hsrLib();
  const fei = idOf(h, 'Feixiao');
  const mine = account({ [fei]: 0, [idOf(h, 'Robin')]: 2, [idOf(h, 'Aventurine')]: 0, [idOf(h, 'Pela')]: 0 });

  it('by default only your own characters, ranked by %, each saying what came from your account', () => {
    const fits = hsrFits([fei], mine, h);
    expect(fits.length).toBeGreaterThan(0);
    for (const f of fits) expect(mine.owned(f.id), h.names.get(f.id)).toBe(true);
    const percents = fits.map((f) => f.percent ?? 0);
    expect([...percents].sort((a, b) => b - a)).toEqual(percents);
    const robin = fits.find((f) => f.id === idOf(h, 'Robin'));
    expect(robin?.theory).toBe(false);
    expect(robin?.fromAccount).toContain('E2 counted.');
    expect(robin?.fromAccount?.some((n) => /Signature Flowing Nightglow: not counted \(no weapon in their saved build\)/.test(n))).toBe(true);
  });

  it('"Include characters I don’t own" adds the rest, marked as theory', () => {
    const fits = hsrFits([fei], mine, h, { includeUnowned: true });
    const topaz = fits.find((f) => f.id === idOf(h, 'Topaz & Numby'));
    expect(topaz?.theory).toBe(true);
    expect(topaz?.fromAccount?.[0]).toMatch(/^Not owned: scored as theory at E0/);
  });

  it('the signature weapon counts only when the saved build has it; another weapon is named and not counted', () => {
    const robinId = idOf(h, 'Robin');
    const nightglow = h.unlocks.get(robinId)?.get('signature-weapon')?.weapon ?? '';
    const withSig = account({ [fei]: 0, [robinId]: 0 }, { weapon: (id) => (id === robinId ? { id: nightglow, name: 'Flowing Nightglow' } : undefined) });
    const robin = hsrFits([fei], withSig, h).find((f) => f.id === robinId);
    expect(robin?.fromAccount).toContain('Signature weapon counted: Flowing Nightglow (from your saved build).');
    const other = account({ [fei]: 0, [robinId]: 0 }, { weapon: (id) => (id === robinId ? { name: 'Dance! Dance! Dance!' } : undefined) });
    expect(hsrFits([fei], other, h).find((f) => f.id === robinId)?.fromAccount).toContain('Your build has Dance! Dance! Dance!, not their signature Flowing Nightglow: not counted.');
  });

  it('ZZZ: Mindscapes and Agent Potential from the account', () => {
    const z = zzzLib();
    const billy = idOf(z, 'Starlight - Billy');
    const lucia = idOf(z, 'Lucia');
    const fits = zzzFits([billy], account({ [billy]: 0, [lucia]: 1 }), z);
    const l = fits.find((f) => f.id === lucia);
    expect(l?.fromAccount).toContain('M1 counted.');
  });
});
