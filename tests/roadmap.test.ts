// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse, problems, update } from '../scripts/roadmap-lib';

const ROOT = resolve(__dirname, '..');
const text = readFileSync(resolve(ROOT, 'docs/ROADMAP.md'), 'utf8');

describe('docs/ROADMAP.md checks itself', () => {
  it('has unique ids and a proof file on every item', () => {
    expect(problems(parse(text))).toEqual([]);
  });

  it('is up to date with the files on disk (run `npm run roadmap` if this fails)', () => {
    expect(update(text, (p) => existsSync(resolve(ROOT, p)))).toBe(text);
  });
});

describe('the roadmap script itself', () => {
  const sample = [
    '<!-- roadmap:summary -->',
    'old',
    '<!-- /roadmap:summary -->',
    '## Phase A',
    '- [ ] R01 First · proof: `a.ts`',
    '- [x] R02 Second · proof: `b.ts`, `c.ts`',
  ].join('\n');

  it('ticks an item only when every proof exists', () => {
    const out = update(sample, (p) => p === 'a.ts' || p === 'b.ts');
    expect(out).toContain('- [x] R01 First');
    expect(out).toContain('- [ ] R02 Second');
    expect(out).toContain('**1 of 2 done**');
    expect(out).toContain('**Next up:** R02 Second');
  });

  it('reports duplicates and missing proofs', () => {
    expect(problems(parse('- [ ] R01 A · proof: `a`\n- [ ] R01 B · proof: none'))).toEqual([
      'R01 is listed twice',
      'R01 has no proof file',
    ]);
  });
});
