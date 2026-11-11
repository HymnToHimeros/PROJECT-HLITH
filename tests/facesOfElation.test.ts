// @vitest-environment node
/**
 * HSR 4.7's "Faces of Elation" traces: the trace pieces hold the base level (scripts/import-nanoka-hsr-kits.ts reads
 * level 1 of a skill an Eidolon raises), and Aeon ★ Aha's Eidolon 2 adds the step up to level 2, counted only at E2+.
 */
import { describe, expect, it } from 'vitest';
import { checkTeam, type Account } from '../src/games/hsr/kitcheck/check';
import { library, SHEETS } from '../src/games/hsr/kitcheck/library';

const [AHA, SPARXIE, YAO_GUANG, PEARL] = ['1511', '1501', '1502', '1503'];
const entry = (who: string, id: string) => SHEETS.find((s) => s.characterId === who)?.entries.find((e) => e.id === id);
const at = (ahaEidolon: number): Account => ({ eidolon: (id) => (id === AHA ? ahaEidolon : 0), enhanced: () => 1, ideal: true });

describe('Faces of Elation: base level, and Aeon ★ Aha E2 on top', () => {
  it('the traces quote the base numbers; Eidolon 2 quotes level 2', () => {
    expect(entry(SPARXIE, 'hat-trick-def-ignore')?.quote).toContain('ignore 15% of the enemy target');
    expect(entry(AHA, 'e2-hat-trick')?.quote).toContain('ignore 20% of the enemy target');
    expect(entry(YAO_GUANG, 'mind-reading-great-boon')?.quote).toContain('equal to 20% of its original value');
    expect(entry(AHA, 'e2-mind-reading')?.quote).toContain('equal to 40% of its original value');
  });

  const lines = (e: number) => checkTeam([AHA, SPARXIE, YAO_GUANG, PEARL], AHA, library(), at(e)).lines;
  const line = (e: number, who: string, id: string) => lines(e).find((l) => l.who === who && l.entry === id);

  // A base line is on at any Eidolon of Aha's. It may add no point of its own when the giver already counts for that
  // stat (Yao Guang's "Great Boon" extra DMG counts once), so "on" is checked, not points.
  const applies = (kind: string | undefined) => kind !== undefined && !['locked', 'off', 'unknown', 'replaced'].includes(kind);
  const BASE = [[SPARXIE, 'hat-trick-def-ignore'], [YAO_GUANG, 'mind-reading-great-boon']] as const;

  it('Aha below E2: the base lines apply, the E2 step is locked', () => {
    for (const [who, id] of BASE) expect(applies(line(0, who, id)?.kind), id).toBe(true);
    expect(line(0, SPARXIE, 'hat-trick-def-ignore')?.points).toBeGreaterThan(0);
    for (const id of ['e2-hat-trick', 'e2-mind-reading']) {
      expect(line(1, AHA, id)?.kind, id).toBe('locked');
      expect(line(1, AHA, id)?.points ?? 0, id).toBe(0);
    }
  });

  it('Aha at E2: the base lines still apply and the step up counts on top', () => {
    for (const [who, id] of BASE) expect(applies(line(2, who, id)?.kind), id).toBe(true);
    for (const id of ['e2-hat-trick', 'e2-mind-reading']) expect(line(2, AHA, id)?.points, id).toBeGreaterThan(0);
  });
});
