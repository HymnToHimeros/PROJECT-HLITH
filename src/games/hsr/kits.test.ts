// @vitest-environment node
import { describe, expect, it } from 'vitest';
import characters from './data/characters.json';
import kits from './data/kits.json';

type K = { characterId: string; source: string; version: string; beta?: boolean; skills: { id: string; kind: string; gameText: string; unlock?: { dupes?: number; potential?: number }; replacedAt?: { potential: number } }[] };
const list = kits as K[];
const ids = new Set(characters.map((c) => c.id));
const text = (id: string, piece: string) => list.find((k) => k.characterId === id)?.skills.find((s) => s.id === piece)?.gameText ?? '';

describe('HSR kit text', () => {
  it('every character has kit text (read group by group: A, then one group per path); unreleased ones are marked beta', () => {
    expect(list.map((k) => k.characterId).sort()).toEqual(characters.map((c) => c.id).sort());
    for (const c of characters) if ('leak' in c && c.leak) expect(list.find((k) => k.characterId === c.id)?.beta, c.id).toBe(true);
  });

  it.each(list.map((k) => [k.characterId, k] as const))('%s: known character, skills, three Traces, Eidolons 1–6, no markup left', (id, kit) => {
    expect(ids.has(id)).toBe(true);
    expect(kit.source).toBe('nanoka.cc');
    const base = kit.skills.filter((s) => !s.id.endsWith('-enhanced'));
    const pieceIds = base.map((s) => s.id);
    expect(new Set(kit.skills.map((s) => s.id)).size).toBe(kit.skills.length);
    expect(base.filter((s) => s.kind === 'trace')).toHaveLength(3);
    for (let e = 1; e <= 6; e++) expect(base.find((s) => s.id === `eidolon-${e}`)?.unlock?.dupes).toBe(e);
    expect(pieceIds.some((p) => p.startsWith('skill-basic-atk'))).toBe(true);
    expect(pieceIds.some((p) => p.startsWith('skill-ultimate'))).toBe(true);
    for (const s of kit.skills) {
      expect(s.gameText.length, s.id).toBeGreaterThan(10);
      expect(s.gameText, s.id).not.toMatch(/<[^>]+>|#\d+\[/);
    }
  });

  it('fills in the game’s numbers (Robin’s Skill, Ruan Mei’s Trace)', () => {
    expect(text('1309', 'skill-skill-pinion-s-aria')).toContain('Increase DMG dealt by all allies by 50%, lasting for 3 turn(s).');
    expect(text('1303', 'trace-inert-respiration')).toBe('Increases Break Effect by 20% for all allies.');
  });

  it('an Enhanced kit replaces the base one for players who have it (Silver Wolf)', () => {
    const sw = list.find((k) => k.characterId === '1006');
    const enhanced = sw?.skills.filter((s) => s.id.endsWith('-enhanced')) ?? [];
    expect(enhanced.length).toBeGreaterThan(10);
    for (const s of enhanced) expect(s.unlock?.potential).toBe(1);
    for (const s of sw?.skills.filter((x) => !x.id.endsWith('-enhanced')) ?? []) expect(s.replacedAt).toEqual({ potential: 1 });
  });
});
