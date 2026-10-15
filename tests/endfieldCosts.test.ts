import { describe, expect, it } from 'vitest';
import { acquisition, cargoString, costList, costSummary, levelTable, promotionLevels, RULINGS, skillTracks, slots } from '../scripts/import-endfield-costs';
import { endfield } from '../src/games/endfield/contract';
import { materialsFor, MAX_LEVEL, skillsOf } from '../src/games/endfield/costs';
import costs from '../src/games/endfield/data/costs.json';
import { farmPlan } from '../src/tools/farm/plan';
import type { Material } from '../src/core/contract';
import materials from '../src/games/endfield/data/materials.json';

describe('Endfield costs import: wiki text → costs', () => {
  it('reads "Name xN" lists and Elite slots; "-" is an empty slot', () => {
    expect(costList('Protoprism x5, T-Creds x1000')).toEqual({ Protoprism: 5, 'T-Creds': 1000 });
    expect(costList(' - ')).toBeNull();
    expect(slots('-; Protoprism x48, T-Creds x10000; -; -;')).toEqual([null, { Protoprism: 48, 'T-Creds': 10000 }, null, null]);
    expect(() => costList('Protoprism five')).toThrow();
  });
  it('skill costs: levels 2–9 shared by the four skills, 10–12 per skill', () => {
    const cells = [2, 3, 4, 5, 6, 7, 8, 9].map((l) => `{{Skill upgrade cell|level=${l}|m1=Protoprism,${l}|m2=T-Creds,100}}`).join('\n');
    const per = [10, 11, 12].map((l) => `{{Skill upgrade cell|level=${l}|skill1=A|skill2=B|skill3=C|skill4=D|m11=X,1|m12=T-Creds,${l}|m21=Y,1|m31=X,2|m41=Z,3}}`).join('\n');
    const t = skillTracks(`${cells}\n${per}`, 'test');
    expect(t.map((x) => x.id)).toEqual(['basic-attack', 'battle-skill', 'combo-skill', 'ultimate']);
    expect(t[1]?.steps['5']).toEqual({ Protoprism: 5, 'T-Creds': 100 });
    expect(t[0]?.steps['12']).toEqual({ X: 1, 'T-Creds': 12 });
    expect(t[3]?.steps['10']).toEqual({ Z: 3 });
    expect(() => skillTracks(cells, 'test')).toThrow(/expected 2–12/);
  });
  it('where an item comes from: top-level bullets and Protocol Space drop rows, in plain words', () => {
    const page = [
      '==Usage==',
      'x',
      '==Acquisition==',
      '*Acquisition Center: AIC Trading',
      '**AIC Quota Exchange: 5 for {{I|AIC Quota|40|gridview=false}}',
      '*Dijiang Production: [[Growth Chamber]]',
      '*Protocol Spaces:',
      '{{Drop head}}',
      '{{Drop cell|Hazardous Material Collection Site|20|1}}',
      '{{Drop cell|Crisis Calamity: Triaggelos|120|6|link=Crisis Calamity: Triaggelos (Deep Dive)}}',
      '{{Table end}}',
      '* Redeem codes.',
      '*Dijiang Production: Growth Chamber',
      '',
      '==Navigation==',
      '*not this',
    ].join('\n');
    expect(acquisition(page, 'test')).toEqual(['Acquisition Center: AIC Trading', 'Dijiang Production: Growth Chamber', 'Hazardous Material Collection Site (20 Sanity, fixed drop)', 'Crisis Calamity: Triaggelos (120 Sanity, random)', 'Redeem codes']);
    expect(acquisition('no section here', 'test')).toEqual([]);
    expect(() => acquisition('==Acquisition==\n*{{Unknown|x}}', 'test')).toThrow(/markup left/);
  });
  it('names in a Cargo query are escaped: backslashes first, then quotes', () => {
    expect(cargoString("Bob's")).toBe("'Bob\\'s'");
    expect(cargoString('a\\')).toBe("'a\\\\'");
    expect(cargoString("x\\' OR 1=1 --")).toBe("'x\\\\\\' OR 1=1 --'");
  });
  it('level table, promotion levels and the Cost Summary', () => {
    const rows = Array.from({ length: 89 }, (_, i) => `|-\n| ${i + 2} || ${(i + 2) * 10} || 0 || ${i + 2} || 0`).join('\n');
    const t = levelTable(rows);
    expect(t.exp[2]).toBe(20);
    expect(t.creds[90]).toBe(90);
    expect(() => levelTable(rows.replace('|-\n| 50 ||', '|-\n| 51 ||'))).toThrow(/expected level 50/);
    expect(promotionLevels('Promotion I: x and Operator Level 20\nPromotion II: y, Operator Level 40\nPromotion III: z, Operator Level 60\nPromotion IV: w, Operator Level 80')).toEqual([20, 40, 60, 80]);
    expect(costSummary('===Cost Summary===\n* {{I|T-Creds|1280020|gridview=false}}\n* {{I|A|75|gridview=false}} or {{I|A|74|gridview=false}}, {{I|B|7|gridview=false}}\n* 84 Plants such as {{I|P|gridview=false}}\n\n== Navigation ==')).toEqual({ 'T-Creds': 1280020, A: 75 });
  });
});

type Data = typeof costs & { operators: Record<string, { source: string; version: string; promotions: { atLevel: number }[]; tracks: { id: string; max: number; steps: Record<string, Record<string, number>> }[] }> };
const data = costs as Data;
const ids = Object.keys(data.operators);

describe('Endfield costs data (src/games/endfield/data/costs.json)', async () => {
  const characters = await endfield.data.characters();
  it('every operator with a wiki page has costs, cited to its page and revision', () => {
    expect(ids.length).toBeGreaterThanOrEqual(34);
    for (const id of ids) {
      expect(characters.some((c) => c.id === id)).toBe(true);
      expect(data.operators[id]?.source).toMatch(/^endfield\.wiki\.gg\/wiki\/\S+ \(CC BY-SA 4\.0\)$/);
      expect(data.operators[id]?.version).toMatch(/^wiki revision \d+$/);
      expect(data.operators[id]?.promotions.map((p) => p.atLevel)).toEqual([20, 40, 60, 80]);
      expect(skillsOf(id).slice(0, 4)).toEqual(['basic-attack', 'battle-skill', 'combo-skill', 'ultimate'].map((x) => expect.objectContaining({ id: x, max: 12 })));
    }
    expect(MAX_LEVEL).toBe(90);
  });
  it('every item it names is in materials.json; pictures are wiki images', () => {
    const known = new Set(materials.map((m) => m.id));
    for (const id of ids) for (const n of materialsFor(id, { level: 1 }, { level: 90 })) expect(known.has(n.material), n.material).toBe(true);
    for (const m of materials as { icon?: string }[]) if (m.icon !== undefined) expect(m.icon).toMatch(/^https:\/\/endfield\.wiki\.gg\/images\//);
  });
  it('to max without talents equals the wiki’s own Cost Summary (Operator page); the Outfitting conflict follows its ruling', () => {
    const summary = data.summary as Record<string, number>;
    expect(RULINGS['outfitting-t-creds']).toMatchObject({ use: 'operator-page', by: 'MANAGER' });
    expect(data.conflicts.find((c) => c.startsWith('Gear Outfitting'))).toMatch(/Ruling \(MANAGER, 2026-10-15\): use the operator page \(unverified in game; the owner may correct it/);
    const checked = ids.filter((id) => data.operators[id]?.tracks.some((t) => t.id === 'base-skill-1'));
    expect(checked.length).toBeGreaterThan(30);
    for (const id of checked) {
      const tracks = data.operators[id]?.tracks ?? [];
      const noTalents = tracks.map((t) => (t.id.startsWith('talent') ? 0 : t.max));
      const got = new Map(materialsFor(id, { level: 1 }, { level: 90, skills: noTalents }).map((n) => [n.material, n.amount]));
      for (const [item, amount] of Object.entries(summary)) {
        expect(got.get(item), `${id}: ${item}`).toBe(amount);
      }
    }
  });
  it('every item says where it comes from, and Farm passes it on with each row', () => {
    for (const m of materials as Material[]) expect(m.sources?.length, m.name).toBeGreaterThan(0);
    const plan = farmPlan(endfield, ['chr_0005_chen'], materials as Material[]);
    expect(plan.needs.known).toBe(true);
    if (plan.needs.known) {
      const disk = plan.needs.value.find((r) => r.name === 'Protodisk');
      expect(disk?.sources).toContain('Protocol Space: Promotions');
      // Sanity per run isn't on the wiki: runs and Sanity stay unknown.
      expect(disk?.runs.known).toBe(false);
    }
  });
  it('from and to: nothing between equal levels; a promotion only to pass its level cap', () => {
    const chen = 'chr_0005_chen';
    const all = Object.fromEntries(skillsOf(chen).map((t, i) => [i, t.max]));
    const maxed = { level: 90, skills: Object.values(all) };
    expect(materialsFor(chen, maxed, maxed)).toEqual([]);
    const to20 = materialsFor(chen, { level: 1, skills: Object.values(all) }, { level: 20, skills: Object.values(all) });
    expect(to20.find((n) => n.material === 'item_char_break_stage_1_2')).toBeUndefined();
    const to21 = materialsFor(chen, { level: 1, skills: Object.values(all) }, { level: 21, skills: Object.values(all) });
    expect(to21.find((n) => n.material === 'item_char_break_stage_1_2')?.amount).toBe(8);
    expect(materialsFor('chr_argent-flow', { level: 1 }, { level: 90 })).toEqual([]);
  });
});
