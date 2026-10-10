// @vitest-environment node
/** T43: a leak's beta kit changes between builds; a sheet that no longer matches it is not used until read again. */
import { describe, expect, it } from 'vitest';
import type { Kit } from '../src/core/contract';
import { staleReason } from '../src/core/rules/leaks';
import { check } from '../src/games/hsr/kitcheck/check';
import { buildLibrary, KITS, SHEETS } from '../src/games/hsr/kitcheck/library';
import characters from '../src/games/hsr/data/characters.json';

const NIHILUX = '1511';
const ideal = { eidolon: () => 0, enhanced: () => 1, ideal: true };

describe('core: when a sheet is stale', () => {
  const kit = [
    { id: 'a', gameText: 'Increases DMG by 20%.' },
    { id: 'b', gameText: 'Nothing for the team.' },
  ];
  it('matches: undefined; a quoted line changed or a new piece: why', () => {
    expect(staleReason([{ piece: 'a', quote: 'DMG by 20%' }], new Set(['a', 'b']), kit)).toBeUndefined();
    expect(staleReason([{ piece: 'a', quote: 'DMG by 30%' }], new Set(['a', 'b']), kit)).toBe('its beta kit changed since it was read (1 quoted line changed)');
    expect(staleReason([{ piece: 'a', quote: 'DMG by 20%' }], new Set(['a']), kit)).toBe('its beta kit changed since it was read (1 new piece)');
    expect(staleReason([], new Set(), undefined)).toBe('its beta kit text is gone');
  });
});

describe('HSR: Nihilux (Aeon ★ Aha), a leak', () => {
  it('is a leak with a sheet that matches today’s beta text', () => {
    expect((characters as { id: string; leak?: unknown }[]).find((c) => c.id === NIHILUX)?.leak).toBeTruthy();
    expect(SHEETS.some((s) => s.characterId === NIHILUX)).toBe(true);
    const lib = buildLibrary();
    expect(lib.stale?.has(NIHILUX) ?? false).toBe(false);
    expect(lib.sheets.has(NIHILUX)).toBe(true);
  });

  it('when SCHEDULER imports changed beta text, the old sheet is not used and teams say why', () => {
    const sheet = SHEETS.find((s) => s.characterId === NIHILUX);
    const quoted = sheet?.entries[0];
    if (!quoted) throw new Error('no Nihilux entry');
    // The quoted line's numbers change in the new beta build.
    const changed = (KITS as Kit[]).map((k) =>
      k.characterId === NIHILUX ? { ...k, skills: k.skills.map((s) => (s.id === quoted.piece ? { ...s, gameText: s.gameText.replace(quoted.quote, `${quoted.quote} (changed)`).replace(quoted.quote, 'reworded') } : s)) } : k,
    );
    const lib = buildLibrary(SHEETS, changed);
    expect(lib.stale?.get(NIHILUX)).toMatch(/beta kit changed since it was read \(1 quoted line changed\)/);
    expect(lib.sheets.has(NIHILUX)).toBe(false);
    const team = [NIHILUX, ...[...lib.sheets.keys()].slice(0, 3)];
    const out = check(team, lib, ideal);
    expect(out.rated).toBe(false);
    if (!out.rated) expect(out.why).toMatch(/^not rated yet: .*\(its beta kit changed since it was read \(1 quoted line changed\)\) not read yet$/);
  });

  it('a new piece in the beta kit makes it stale too', () => {
    const changed = (KITS as Kit[]).map((k) => (k.characterId === NIHILUX ? { ...k, skills: [...k.skills, { id: 'skill-new-beta', label: 'New', does: [], gameText: 'A new beta line.' }] } : k));
    expect(buildLibrary(SHEETS, changed).stale?.get(NIHILUX)).toMatch(/1 new piece/);
  });
});
