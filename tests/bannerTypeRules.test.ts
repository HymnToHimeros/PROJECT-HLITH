// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { games } from '../src/games';
import { bannerRulesOf } from '../src/tools/pity/pity';
import { findDestructive } from './lib/migration-rules';

const DIR = resolve(__dirname, '../supabase/migrations');
const sql = readFileSync(join(DIR, '0026_pull_numbers_rules.sql'), 'utf8');

/** Extract the banner-type ids from a CASE branch in banner_type_rules. */
function parseCaseBranch(block: string, value: string): string[] {
  const re = new RegExp(`when bt in \\(([^)]+)\\) then ${value}`, 'g');
  const ids: string[] = [];
  for (const m of block.matchAll(re)) {
    const group = m[1] ?? '';
    ids.push(...group.replace(/'/g, '').split(',').map((s) => s.trim()));
  }
  return ids;
}

const fnBody = sql.match(/create or replace function public\.banner_type_rules[\s\S]*?\$\$;/)?.[0] ?? '';
const guaranteeBlock = fnBody.match(/select\s+case([\s\S]*?)end as guarantee/)?.[1] ?? '';
const featuredBlock = fnBody.match(/end as guarantee,\s+case([\s\S]*?)end as featured/)?.[1] ?? '';

const sqlGuaranteeTrue = parseCaseBranch(guaranteeBlock, 'true');
const sqlGuaranteeFalse = parseCaseBranch(guaranteeBlock, 'false');
const sqlFeaturedTrue = parseCaseBranch(featuredBlock, 'true');
const sqlFeaturedFalse = parseCaseBranch(featuredBlock, 'false');

describe('banner_type_rules (0026) matches bannerRulesOf() from the game contracts', () => {
  it('only adds', () => {
    expect(findDestructive(sql)).toEqual([]);
  });

  for (const game of games) {
    const rules = bannerRulesOf(game);
    describe(game.id, () => {
      for (const [btId, rule] of Object.entries(rules)) {
        it(`${btId}: guarantee=${rule.guarantee}, featured=${rule.featured}`, () => {
          const inGuaranteeTrue = sqlGuaranteeTrue.includes(btId);
          const inGuaranteeFalse = sqlGuaranteeFalse.includes(btId);
          const inFeaturedTrue = sqlFeaturedTrue.includes(btId);
          const inFeaturedFalse = sqlFeaturedFalse.includes(btId);
          if (rule.guarantee) {
            expect(inGuaranteeFalse, `${btId}: guarantee should not be false`).toBe(false);
          } else {
            expect(inGuaranteeFalse, `${btId}: guarantee=false must be explicit`).toBe(true);
            expect(inGuaranteeTrue, `${btId}: guarantee conflicts`).toBe(false);
          }
          if (rule.featured) {
            expect(inFeaturedFalse, `${btId}: featured should not be false`).toBe(false);
          } else {
            expect(inFeaturedFalse, `${btId}: featured=false must be explicit`).toBe(true);
            expect(inFeaturedTrue, `${btId}: featured conflicts`).toBe(false);
          }
        });
      }
    });
  }

  it('every game banner type appears in the SQL (no missing entries)', () => {
    const sqlAll = new Set([...sqlGuaranteeTrue, ...sqlGuaranteeFalse, ...sqlFeaturedTrue, ...sqlFeaturedFalse]);
    for (const game of games) {
      for (const bt of game.bannerTypes) {
        expect(sqlAll, `${game.id}/${bt.id} is missing from the SQL CASE`).toContain(bt.id);
      }
    }
  });

  it('pull_numbers calls banner_type_rules internally', () => {
    expect(sql).toContain('from public.banner_type_rules(bt) btr');
  });

  it('profile_card (0019) calls pull_numbers with one argument', () => {
    const live = readFileSync(join(DIR, '0019_rewards.sql'), 'utf8');
    expect(live).toContain('nums := public.pull_numbers(pulls);');
  });

  it('both functions are revoked from public access', () => {
    expect(sql).toContain('revoke execute on function public.banner_type_rules(text) from public, anon, authenticated;');
    expect(sql).toContain('revoke execute on function public.pull_numbers(jsonb) from public, anon, authenticated;');
  });

  it('no migration after 0019 re-creates profile_card without the rewards key', () => {
    const files = readdirSync(DIR).filter((f) => f > '0019_' && f.endsWith('.sql')).sort();
    for (const f of files) {
      const body = readFileSync(join(DIR, f), 'utf8');
      if (/create\s+or\s+replace\s+function\s+public\.profile_card/i.test(body)) {
        expect(body, `${f} re-creates profile_card but must include rewards`).toContain("'rewards'");
      }
    }
  });
});
