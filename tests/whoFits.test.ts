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
  const mine = account({ [fei]: 0, [idOf(h, 'Topaz & Numby')]: 2, [idOf(h, 'Aventurine')]: 0, [idOf(h, 'Tribbie')]: 0 });

  it('by default only your own characters, ranked by %, each saying what came from your account', () => {
    const fits = hsrFits([fei], mine, h);
    expect(fits.length).toBeGreaterThan(0);
    for (const f of fits) expect(mine.owned(f.id), h.names.get(f.id)).toBe(true);
    const percents = fits.map((f) => f.percent ?? 0);
    expect([...percents].sort((a, b) => b - a)).toEqual(percents);
    const topaz = fits.find((f) => f.id === idOf(h, 'Topaz & Numby'));
    expect(topaz?.theory).toBe(false);
    expect(topaz?.fromAccount?.[0]).toBe('Counted: E2.');
    expect(topaz?.fromAccount?.some((n) => /^No weapon saved \(signature .+ would count\)\.$/.test(n))).toBe(true);
  });

  it('"Include characters I don’t own" adds the rest, marked as theory', () => {
    const fits = hsrFits([fei], mine, h, { includeUnowned: true });
    const ratio = fits.find((f) => f.id === idOf(h, 'Dr. Ratio'));
    expect(ratio?.theory).toBe(true);
    expect(ratio?.fromAccount?.[0]).toMatch(/^Not owned: scored as theory at E0/);
  });

  it('the signature counts when saved; any other weapon counts when its path is theirs, and says why when not', () => {
    // Topaz is in Feixiao's own game team (Robin isn't, so she is never suggested for him).
    const topazId = idOf(h, 'Topaz & Numby');
    const sigId = h.unlocks.get(topazId)?.get('signature-weapon')?.weapon ?? '';
    const sigName = (h.pieceLabels.get(topazId)?.get('signature-weapon') ?? '').replace(/^Signature [^:]+: /, '').replace(/ · .*$/, '');
    const withSig = account({ [fei]: 0, [topazId]: 0 }, { weapon: (id) => (id === topazId ? { id: sigId, name: sigName } : undefined) });
    const topaz = hsrFits([fei], withSig, h).find((f) => f.id === topazId);
    expect(topaz?.fromAccount).toContain(`Counted: E0 (no copies saved), signature ${sigName}.`);
    const unmatched = account({ [fei]: 0, [topazId]: 0 }, { weapon: (id) => (id === topazId ? { name: 'My own cone' } : undefined) });
    expect(hsrFits([fei], unmatched, h).find((f) => f.id === topazId)?.fromAccount).toContain("My own cone: not matched to the game's list, not counted.");
    // A Destruction Light Cone on Topaz (Hunt): its effect only works for Destruction characters.
    const destruction = (weapons as { id: string; name: string; role?: string; madeFor?: string }[]).find((w) => w.role === 'destruction' && !w.madeFor);
    if (!destruction) throw new Error('no Destruction Light Cone');
    const wrong = account({ [fei]: 0, [topazId]: 0 }, { weapon: (id) => (id === topazId ? { id: destruction.id, name: destruction.name } : undefined) });
    const wrongNotes = hsrFits([fei], wrong, h).find((f) => f.id === topazId)?.fromAccount ?? [];
    expect(wrongNotes).toContain(`${destruction.name}: works only for Destruction characters, not counted.`);
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
