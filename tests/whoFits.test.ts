// @vitest-environment node
/** T18: suggestions for your own teams come from your account, ranked by %, with theory only when asked. */
import { describe, expect, it } from 'vitest';
import weapons from '../src/games/hsr/data/weapons.json';
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
    expect(robin?.fromAccount?.[0]).toBe('Counted: E2.');
    expect(robin?.fromAccount).toContain('No weapon saved (signature Flowing Nightglow would count).');
  });

  it('"Include characters I don’t own" adds the rest, marked as theory', () => {
    const fits = hsrFits([fei], mine, h, { includeUnowned: true });
    const topaz = fits.find((f) => f.id === idOf(h, 'Topaz & Numby'));
    expect(topaz?.theory).toBe(true);
    expect(topaz?.fromAccount?.[0]).toMatch(/^Not owned: scored as theory at E0/);
  });

  it('the signature counts when saved; any other weapon counts when its path is theirs, and says why when not', () => {
    const robinId = idOf(h, 'Robin');
    const nightglow = h.unlocks.get(robinId)?.get('signature-weapon')?.weapon ?? '';
    const withSig = account({ [fei]: 0, [robinId]: 0 }, { weapon: (id) => (id === robinId ? { id: nightglow, name: 'Flowing Nightglow' } : undefined) });
    const robin = hsrFits([fei], withSig, h).find((f) => f.id === robinId);
    expect(robin?.fromAccount).toContain('Counted: E0 (no copies saved), signature Flowing Nightglow.');
    const unmatched = account({ [fei]: 0, [robinId]: 0 }, { weapon: (id) => (id === robinId ? { name: 'My own cone' } : undefined) });
    expect(hsrFits([fei], unmatched, h).find((f) => f.id === robinId)?.fromAccount).toContain("My own cone: not matched to the game's list, not counted.");
    // A Destruction Light Cone on Robin (Harmony): its effect only works for Destruction characters.
    const destruction = (weapons as { id: string; name: string; role?: string; madeFor?: string }[]).find((w) => w.role === 'destruction' && !w.madeFor);
    if (!destruction) throw new Error('no Destruction Light Cone');
    const wrong = account({ [fei]: 0, [robinId]: 0 }, { weapon: (id) => (id === robinId ? { id: destruction.id, name: destruction.name } : undefined) });
    const wrongNotes = hsrFits([fei], wrong, h).find((f) => f.id === robinId)?.fromAccount ?? [];
    expect(wrongNotes.some((n) => n === `${destruction.name}: works only for Destruction characters, not counted.` || n === `${destruction.name}: effect not read yet, not counted.`)).toBe(true);
  });

  it('ZZZ: Mindscapes and Agent Potential from the account', () => {
    const z = zzzLib();
    const billy = idOf(z, 'Starlight - Billy');
    const lucia = idOf(z, 'Lucia');
    const fits = zzzFits([billy], account({ [billy]: 0, [lucia]: 1 }), z);
    const l = fits.find((f) => f.id === lucia);
    expect(l?.fromAccount?.[0]).toMatch(/^Counted: M1/);
  });
});
