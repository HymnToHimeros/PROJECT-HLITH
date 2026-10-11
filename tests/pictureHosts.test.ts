// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Hosts that refuse their pictures to other sites: an <img> on HLITH gets 404 (found 2026-10-11:
// Severian's and Phoenix's portraits were blank in Roster and Farm). Never link pictures there.
const BLOCKED = ['static.wikia.nocookie.net'];

describe('game lists only link pictures that can show on HLITH', () => {
  it('no picture comes from a host that blocks other sites', () => {
    const root = resolve(__dirname, '../src/games');
    const found: string[] = [];
    for (const game of readdirSync(root)) {
      const dir = join(root, game, 'data');
      if (!existsSync(dir)) continue;
      const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
      for (const f of files) {
        const text = readFileSync(join(root, game, 'data', f), 'utf8');
        for (const host of BLOCKED) if (text.includes(host)) found.push(`${game}/data/${f}: ${host}`);
      }
    }
    expect(found).toEqual([]);
  });
});
