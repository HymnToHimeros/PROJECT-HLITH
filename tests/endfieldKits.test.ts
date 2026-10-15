import { describe, expect, it } from 'vitest';
import { kitFrom, plain, templates } from '../scripts/import-endfield-kits';
import { endfield } from '../src/games/endfield/contract';
import rawKits from '../src/games/endfield/data/kits.json';
import { SHEETS } from '../src/games/endfield/kitcheck/library';

describe('Endfield kit import: wiki markup → plain words', () => {
  it('turns the wiki’s templates and tags into plain text', () => {
    expect(plain('<b>SKILL DESCRIPTION:</b> Deals {{Color|Nature DMG|5}} and applies {{G|Physical Susceptibility|Physical Susceptibility}}.<br />Lasts {{Color|+4|1d}}s.', 't')).toBe(
      'SKILL DESCRIPTION: Deals Nature DMG and applies Physical Susceptibility.\nLasts +4s.',
    );
    expect(plain('[[Arts Unit]] user, [[Nature|nature]] [[File:X.png|15px]]damage', 't')).toBe('Arts Unit user, nature damage');
  });
  it('stops on markup it doesn’t know instead of guessing', () => {
    expect(() => plain('Deals {{Mystery|x}} DMG', 'Who')).toThrow(/Who: unknown template \{\{Mystery\}\}/);
    expect(() => plain('Deals <table>x</table>', 'Who')).toThrow(/leftover markup/);
    // A tag rebuilt from the pieces around a removed one never gets through.
    expect(() => plain('<<b>iframe>', 'Who')).toThrow(/leftover markup/);
  });
  it('reads nested templates whole', () => {
    const [t] = templates('{{Combat skill\n|name= A {{Color|B|7}}\n|desc= x {{G|C|D}} y\n}}', 'Combat skill');
    expect(t).toMatchObject({ name: 'A {{Color|B|7}}', desc: 'x {{G|C|D}} y' });
  });
});

describe('Endfield kit import: one page → kit pieces', () => {
  const page = `{{Operator data
|pot1 = Battle skill {{Color|Rush|7}} improved: effects {{Color|+8%|1d}}.
|pot1t = First
|pot2 = Second text.
}}
==Combat Skills==
<tabber>
Mode: A=
{{Combat skill
|name= Strike
|type= {{SB|2}}
|desc= Deals {{Color|Heat DMG|5}}.
|stat1= DMG Multiplier, 100%, 110%, 120%, 130%, 140%, 150%, 160%, 170%, 180%, 190%, 200%, 220%
|stat2= SP Cost, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100
}}
|-|
Mode: B=
{{Combat skill
|name= Strike
|type= {{SB|2}}
|desc= Deals {{Color|Cryo DMG|5}}.
}}
</tabber>
{{Operator talent
|name = Keen Mind
|icon = Intellect
|cond1 = Elite 1
|desc1 = Operator Intellect +10.
|cond2 = Elite 4
|desc2 = Operator Intellect +20.
}}
{{Operator talent
|name = Warm Up
|cond1 = Elite 1
|desc1 = Old text.
|cond2 = Elite 2
|desc2 = Newest text.
}}
{{Operator talent
|name = Outfitting
|icon = Gear icon
|cond1 = Elite 1
|desc1 = Activate this to equip gear.
}}`;
  const kit = kitFrom(page, 'Test');
  it('skills get their numbers at level 12; a tabbed skill set keeps each tab apart', () => {
    expect(kit.filter((s) => s.kind === 'skill').map((s) => [s.id, s.label])).toEqual([
      ['battle-skill-mode-a', 'Battle Skill: Strike (Mode: A)'],
      ['battle-skill-mode-b', 'Battle Skill: Strike (Mode: B)'],
    ]);
    expect(kit[0]?.gameText).toBe('Deals Heat DMG.\nAt level 12: DMG Multiplier: 220%; SP Cost: 100.');
  });
  it('talents give their highest Elite text, in Elite order; gear unlocks are left out', () => {
    expect(kit.filter((s) => s.kind === 'core')).toEqual([
      { id: 'talent-warm-up', label: 'Talent: Warm Up (Elite 2)', kind: 'core', does: [], gameText: 'Newest text.' },
      { id: 'talent-keen-mind', label: 'Talent: Keen Mind (Elite 4)', kind: 'core', does: [], gameText: 'Operator Intellect +20.' },
    ]);
  });
  it('Potentials 1–5 unlock at their level', () => {
    expect(kit.filter((s) => s.kind === 'potential').map((s) => [s.id, s.label, s.unlock, s.gameText])).toEqual([
      ['potential-1', 'Potential 1: First', { potential: 1 }, 'Battle skill Rush improved: effects +8%.'],
      ['potential-2', 'Potential 2', { potential: 2 }, 'Second text.'],
    ]);
  });
});

describe('Endfield kit data (src/games/endfield/data/kits.json)', async () => {
  const kits = (await endfield.data.kits?.()) ?? [];
  const characters = await endfield.data.characters();
  it('every listed operator has a kit, cited to its wiki page and revision', () => {
    expect(kits.map((k) => k.characterId).sort()).toEqual(characters.map((c) => c.id).sort());
    for (const k of kits) {
      expect(k.source).toMatch(/^endfield\.wiki\.gg\/wiki\/\S+ \(CC BY-SA 4\.0\)$/);
      expect(k.version).toMatch(/^wiki revision \d+$/);
    }
  });
  it.each(kits.map((k) => [characters.find((c) => c.id === k.characterId)?.name ?? k.characterId, k] as const))('%s: four combat skills (per tab), Potentials 1–5, plain text, unique ids', (_name, k) => {
    const ids = k.skills.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(k.skills.filter((s) => s.kind === 'skill').length % 4).toBe(0);
    expect(k.skills.filter((s) => s.kind === 'potential').map((s) => s.unlock?.potential)).toEqual([1, 2, 3, 4, 5]);
    const ranks = k.skills.filter((s) => s.kind === 'core').map((s) => Number(/Elite (\d+)/.exec(s.label)?.[1]));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    for (const s of k.skills) {
      expect(s.gameText.trim()).not.toBe('');
      expect(s.gameText).not.toMatch(/\{\{|\}\}|\[\[|<\/?[a-z]/i);
    }
  });
  it('kits.json holds game text only; tags come from the cheat sheets, and only for operators read', () => {
    for (const k of rawKits) for (const s of k.skills) expect(s.does).toEqual([]);
    const read = new Set(SHEETS.map((s) => s.characterId));
    for (const k of kits) expect(k.skills.some((s) => s.does.length > 0), k.characterId).toBe(read.has(k.characterId));
  });
});
