import { describe, expect, it } from 'vitest';
import { hsr } from '../src/games/hsr/contract';
import { zzz } from '../src/games/zzz/contract';
import { chance, worstCase } from '../src/tools/pity/pity';

/**
 * HSR and ZZZ chances and worst cases, pinned before the pity engine learned
 * a game's own rules (Endfield, E3). Any change here changes what players see.
 * Key: game|banner type|odds mode|pity|guaranteed|pulls|copies → [chance, worst case].
 */
const PINNED: Record<string, [number | null, number | null]> = {
  'hsr|character|official|0|false|90|1': [0.551064886295, 180],
  'hsr|character|official|40|false|60|1': [0.546370843978, 140],
  'hsr|character|official|70|true|30|1': [1, 20],
  'hsr|character|official|10|false|200|2': [0.509761119918, 350],
  'hsr|character|official|0|false|1|1': [0.003, 180],
  'hsr|character|community|0|false|90|1': [0.593938349423, 180],
  'hsr|character|community|40|false|60|1': [0.572049189464, 140],
  'hsr|character|community|70|true|30|1': [1, 20],
  'hsr|character|community|10|false|200|2': [0.603205747527, 350],
  'hsr|character|community|0|false|1|1': [0.003, 180],
  'hsr|light-cone|official|0|false|90|1': [0.810167508699, 160],
  'hsr|light-cone|official|40|false|60|1': [0.795796820068, 120],
  'hsr|light-cone|official|70|true|30|1': [1, 10],
  'hsr|light-cone|official|10|false|200|2': [0.840693140658, 310],
  'hsr|light-cone|official|0|false|1|1': [0.006, 160],
  'hsr|light-cone|community|0|false|90|1': [0.830891526374, 160],
  'hsr|light-cone|community|40|false|60|1': [0.808982234774, 120],
  'hsr|light-cone|community|70|true|30|1': [1, 10],
  'hsr|light-cone|community|10|false|200|2': [0.941389581365, 310],
  'hsr|light-cone|community|0|false|1|1': [0.006, 160],
  'hsr|collab-character|official|0|false|90|1': [null, null],
  'hsr|collab-character|official|40|false|60|1': [null, null],
  'hsr|collab-character|official|70|true|30|1': [null, null],
  'hsr|collab-character|official|10|false|200|2': [null, null],
  'hsr|collab-character|official|0|false|1|1': [null, null],
  'hsr|collab-character|community|0|false|90|1': [null, null],
  'hsr|collab-character|community|40|false|60|1': [null, null],
  'hsr|collab-character|community|70|true|30|1': [null, null],
  'hsr|collab-character|community|10|false|200|2': [null, null],
  'hsr|collab-character|community|0|false|1|1': [null, null],
  'hsr|collab-light-cone|official|0|false|90|1': [null, null],
  'hsr|collab-light-cone|official|40|false|60|1': [null, null],
  'hsr|collab-light-cone|official|70|true|30|1': [null, null],
  'hsr|collab-light-cone|official|10|false|200|2': [null, null],
  'hsr|collab-light-cone|official|0|false|1|1': [null, null],
  'hsr|collab-light-cone|community|0|false|90|1': [null, null],
  'hsr|collab-light-cone|community|40|false|60|1': [null, null],
  'hsr|collab-light-cone|community|70|true|30|1': [null, null],
  'hsr|collab-light-cone|community|10|false|200|2': [null, null],
  'hsr|collab-light-cone|community|0|false|1|1': [null, null],
  'hsr|departure|official|0|false|90|1': [1, 50],
  'hsr|departure|official|40|false|60|1': [1, 10],
  'hsr|departure|official|70|true|30|1': [1, -20],
  'hsr|departure|official|10|false|200|2': [1, 90],
  'hsr|departure|official|0|false|1|1': [0.006, 50],
  'hsr|departure|community|0|false|90|1': [null, 50],
  'hsr|departure|community|40|false|60|1': [null, 10],
  'hsr|departure|community|70|true|30|1': [null, -20],
  'hsr|departure|community|10|false|200|2': [null, 90],
  'hsr|departure|community|0|false|1|1': [null, 50],
  'hsr|standard|official|0|false|90|1': [1, 90],
  'hsr|standard|official|40|false|60|1': [1, 50],
  'hsr|standard|official|70|true|30|1': [1, 20],
  'hsr|standard|official|10|false|200|2': [1, 170],
  'hsr|standard|official|0|false|1|1': [0.006, 90],
  'hsr|standard|community|0|false|90|1': [1, 90],
  'hsr|standard|community|40|false|60|1': [1, 50],
  'hsr|standard|community|70|true|30|1': [1, 20],
  'hsr|standard|community|10|false|200|2': [1, 170],
  'hsr|standard|community|0|false|1|1': [0.006, 90],
  'zzz|exclusive|official|0|false|90|1': [0.551064886295, 180],
  'zzz|exclusive|official|40|false|60|1': [0.546370843978, 140],
  'zzz|exclusive|official|70|true|30|1': [1, 20],
  'zzz|exclusive|official|10|false|200|2': [0.509761119918, 350],
  'zzz|exclusive|official|0|false|1|1': [0.003, 180],
  'zzz|exclusive|community|0|false|90|1': [0.593938349423, 180],
  'zzz|exclusive|community|40|false|60|1': [0.572049189464, 140],
  'zzz|exclusive|community|70|true|30|1': [1, 20],
  'zzz|exclusive|community|10|false|200|2': [0.603205747527, 350],
  'zzz|exclusive|community|0|false|1|1': [0.003, 180],
  'zzz|w-engine|official|0|false|90|1': [0.827273476306, 160],
  'zzz|w-engine|official|40|false|60|1': [0.807942491686, 120],
  'zzz|w-engine|official|70|true|30|1': [1, 10],
  'zzz|w-engine|official|10|false|200|2': [0.878031163848, 310],
  'zzz|w-engine|official|0|false|1|1': [0.0075, 160],
  'zzz|w-engine|community|0|false|90|1': [null, 160],
  'zzz|w-engine|community|40|false|60|1': [null, 120],
  'zzz|w-engine|community|70|true|30|1': [null, 10],
  'zzz|w-engine|community|10|false|200|2': [null, 310],
  'zzz|w-engine|community|0|false|1|1': [null, 160],
  'zzz|standard|official|0|false|90|1': [1, 90],
  'zzz|standard|official|40|false|60|1': [1, 50],
  'zzz|standard|official|70|true|30|1': [1, 20],
  'zzz|standard|official|10|false|200|2': [1, 170],
  'zzz|standard|official|0|false|1|1': [0.006, 90],
  'zzz|standard|community|0|false|90|1': [null, 90],
  'zzz|standard|community|40|false|60|1': [null, 50],
  'zzz|standard|community|70|true|30|1': [null, 20],
  'zzz|standard|community|10|false|200|2': [null, 170],
  'zzz|standard|community|0|false|1|1': [null, 90],
  'zzz|bangboo|official|0|false|90|1': [1, 80],
  'zzz|bangboo|official|40|false|60|1': [1, 40],
  'zzz|bangboo|official|70|true|30|1': [1, 10],
  'zzz|bangboo|official|10|false|200|2': [1, 150],
  'zzz|bangboo|official|0|false|1|1': [0.01, 80],
  'zzz|bangboo|community|0|false|90|1': [null, 80],
  'zzz|bangboo|community|40|false|60|1': [null, 40],
  'zzz|bangboo|community|70|true|30|1': [null, 10],
  'zzz|bangboo|community|10|false|200|2': [null, 150],
  'zzz|bangboo|community|0|false|1|1': [null, 80],
};

describe('HSR and ZZZ pity results stay the same', () => {
  it.each(Object.entries(PINNED))('%s', (k, [c, w]) => {
    const [id, type, mode, pulls, guaranteed, n, copies] = k.split('|');
    const game = [hsr, zzz].find((g) => g.id === id);
    const t = game?.bannerTypes.find((b) => b.id === type);
    if (!t) throw new Error(`no banner type ${k}`);
    const state = { pulls: Number(pulls), guaranteed: guaranteed === 'true' };
    const got = chance(t.pity, state, Number(n), mode as 'official' | 'community', Number(copies));
    const worst = worstCase(t.pity, state, Number(copies));
    if (c === null) expect(got.known).toBe(false);
    else expect(got.known ? got.value : NaN).toBeCloseTo(c, 10);
    expect(worst.known ? worst.value : null).toBe(w);
  });
});
