import { describe, expect, it } from 'vitest';
import type { Character } from '../../core/contract';
import { protagonistForms } from '../../core/data/protagonist';
import { hsr } from './contract';

describe('HSR Trailblazer pick (T27)', () => {
  it('knows every Trailblazer entry, and each of Caelus’s Paths has Stelle’s', async () => {
    const all: Character[] = await hsr.data.characters();
    const trail = all.filter((c) => c.name.startsWith('Trailblazer'));
    expect(trail.length).toBeGreaterThan(0);
    expect(trail.every((c) => hsr.protagonist?.of(c))).toBe(true);
    expect(all.filter((c) => !c.name.startsWith('Trailblazer')).some((c) => hsr.protagonist?.of(c))).toBe(false);
    const caelus = protagonistForms(hsr, 'caelus', all);
    expect(caelus.mine.length * 2).toBe(trail.length);
    expect(caelus.swap.size).toBe(caelus.hidden.size);
  });
});
