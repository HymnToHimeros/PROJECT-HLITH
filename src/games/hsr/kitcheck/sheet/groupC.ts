/**
 * Group C, read with the seven questions (docs/logic/hsr-theory.md, Part A).
 * Every quote is word for word from src/games/hsr/data/kits.json (tested).
 */
import type { CharacterSheet } from '../types';

const WEAPON_SELF = "Raises the wearer's own stats; nothing for the team.";
const WIND = 'Deals Wind DMG only; nothing for the team.';
const QUANTUM = 'Deals Quantum DMG only; nothing for the team.';
const PHYS = 'Deals Physical DMG only; nothing for the team.';
const ICE = 'Deals Ice DMG only; nothing for the team.';
const LIGHTNING = 'Deals Lightning DMG only; nothing for the team.';
const IMAG = 'Deals Imaginary DMG only; nothing for the team.';
const TECH = 'Used before battle; not counted.';
const HIS_LEVELS = 'Raises his own skill levels; nothing for the team.';
const HER_LEVELS = 'Raises her own skill levels; nothing for the team.';
const HIM = 'Buffs only himself; nothing for the team.';
const HER = 'Buffs only herself; nothing for the team.';
const AGGRO = 'Lowers his own chance of being attacked; nothing for the team.';
const HER_AGGRO = 'Lowers her own chance of being attacked; nothing for the team.';

const danHeng: CharacterSheet = {
  characterId: '1002',
  name: 'Dan Heng',
  damage: {
    kinds: ['basic', 'skill', 'ultimate'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'skill-skill-cloudlancer-art-torrent', quote: "Deals Wind DMG equal to 260% of Dan Heng's ATK to one designated enemy." },
      { piece: 'skill-ultimate-ethereal-dream', quote: "Deals Wind DMG equal to 400% of Dan Heng's ATK to one designated enemy target." },
    ],
  },
  entries: [
    {
      id: 'slow',
      piece: 'skill-skill-cloudlancer-art-torrent',
      quote: "When DMG dealt by Skill triggers CRIT Hit, there is a 100% base chance to reduce the target's SPD by 12%, lasting for 2 turn(s).",
      tag: 'Enemy: Slowed (SPD −12%)',
      gives: [],
      to: 'enemy',
      causes: 'debuff',
      setup: 'His Skill must land a CRIT Hit.',
    },
  ],
  nothing: {
    'signature-weapon': WEAPON_SELF,
    'skill-basic-atk-cloudlancer-art-north-wind': WIND,
    'skill-ultimate-ethereal-dream': WIND,
    'skill-talent-superiority-of-reach': "Buffs only his own next attack (Wind RES PEN) when an ally targets him with an ability; nothing for the team.",
    'skill-technique-splitting-spearhead': TECH,
    'trace-hidden-dragon': AGGRO,
    'trace-faster-than-light': HIM,
    'trace-high-gale': HIM,
    'eidolon-1': HIM,
    'eidolon-2': 'Makes his own Talent come back sooner; nothing for the team.',
    'eidolon-3': HIS_LEVELS,
    'eidolon-4': 'Gives only himself another action; nothing for the team.',
    'eidolon-5': HIS_LEVELS,
    'eidolon-6': 'Makes his own Slow stronger; enemy SPD down is not counted.',
  },
};

const archer: CharacterSheet = {
  characterId: '1015',
  name: 'Archer',
  damage: {
    kinds: ['skill', 'ultimate', 'follow-up'],
    uses: ['skill-points'],
    ignores: [],
    quotes: [
      { piece: 'skill-skill-caladbolg-ii-fake-spiral-sword', quote: 'After using Skill in the "Circuit Connection" state, the current turn does not end, and the DMG dealt by Archer\'s Skill increases by 100%.' },
      { piece: 'skill-skill-caladbolg-ii-fake-spiral-sword', quote: 'After actively using Skill 5 time(s) or when Skill Points are insufficient to use Skill again, exits the "Circuit Connection" state.' },
      { piece: 'skill-talent-mind-s-eye-true', quote: "Archer consumes 1 Charge and immediately launches Follow-Up ATK on the primary target, dealing Quantum DMG equal to 200% of Archer's ATK" },
    ],
  },
  entries: [
    {
      id: 'minds-eye-follow-up',
      piece: 'skill-talent-mind-s-eye-true',
      quote: "After Archer's teammates attack enemy targets, Archer consumes 1 Charge and immediately launches Follow-Up ATK on the primary target, dealing Quantum DMG equal to 200% of Archer's ATK and recovering 1 Skill Point.",
      tag: 'Follow-Up ATK, +1 Skill Point',
      gives: [{ stat: 'skill-points', amount: '+1 per Follow-Up ATK' }],
      to: 'allies',
      causes: 'follow-up',
      setup: 'Teammates attack while he holds Charge (from his Ultimate).',
    },
    {
      id: 'projection-magecraft',
      piece: 'trace-projection-magecraft',
      quote: 'When Archer is on the field, increases the maximum Skill Point limit by 2.',
      tag: 'Team: +2 max Skill Points',
      gives: [{ stat: 'skill-points', amount: '+2 max Skill Points' }],
      to: 'allies',
      setup: 'Nothing; on while he is on the field.',
    },
    {
      id: 'e1-skill-points',
      piece: 'eidolon-1',
      quote: 'After using Skill 3 time(s) within one turn, recovers 2 Skill Point(s) for allies.',
      tag: 'Team: +2 Skill Points',
      gives: [{ stat: 'skill-points', amount: '+2' }],
      to: 'allies',
      setup: 'He uses his Skill 3 times in one turn.',
    },
    {
      id: 'e2-quantum-res',
      piece: 'eidolon-2',
      quote: "When using Ultimate, reduces the enemy target's Quantum RES by 20%, and applies Quantum Weakness to it, lasting for 2 turn(s).",
      tag: 'Enemy: Quantum RES −20%',
      gives: [{ stat: 'res-pen', amount: '20% Quantum RES' }],
      to: 'enemy',
      limits: { elements: ['quantum'] },
      causes: 'debuff',
      setup: 'He uses his Ultimate on the target.',
    },
    {
      id: 'e6-skill-points',
      piece: 'eidolon-6',
      quote: 'When the turn starts, recovers 1 Skill Point for allies.',
      tag: 'Team: +1 Skill Point each turn',
      gives: [{ stat: 'skill-points', amount: '+1 per his turn' }],
      to: 'allies',
      setup: 'Nothing; at the start of his turn.',
    },
  ],
  nothing: {
    'signature-weapon': WEAPON_SELF,
    'skill-basic-atk-kanshou-and-bakuya': QUANTUM,
    'skill-skill-caladbolg-ii-fake-spiral-sword': 'Deals Quantum DMG and buffs only his own Skill; nothing for the team.',
    'skill-ultimate-unlimited-blade-works': 'Deals Quantum DMG and gives himself Charge; nothing for the team.',
    'skill-technique-clairvoyance': TECH,
    'skill-skill-end': 'Ends his own turn; nothing for the team.',
    'trace-hero-of-justice': 'Gives himself Charge; nothing for the team.',
    'trace-guardian': 'Buffs only himself (with 4 or more Skill Points); nothing for the team.',
    'eidolon-3': HIS_LEVELS,
    'eidolon-4': HIM,
    'eidolon-5': HIS_LEVELS,
  },
};

const BUTTERFLY_SETUP = 'She hits the target with her Ultimate.';

const seele: CharacterSheet = {
  characterId: '1102',
  name: 'Seele',
  damage: {
    kinds: ['basic', 'skill', 'ultimate'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'skill-skill-sheathed-blade', quote: "deals Quantum DMG equal to 220% of Seele's ATK to one designated enemy." },
      { piece: 'skill-ultimate-butterfly-flurry', quote: 'Seele enters the Amplification state and deals Quantum DMG equal to 425% of her ATK to one designated enemy.' },
    ],
  },
  entries: [
    {
      id: 'e6-butterfly-flurry',
      piece: 'eidolon-6',
      quote: 'After attacking with Ultimate, Seele inflicts "Butterfly Flurry" on the attacked enemy target for 1 turn(s).',
      tag: 'Enemy: Butterfly Flurry',
      gives: [],
      to: 'enemy',
      causes: 'debuff',
      setup: BUTTERFLY_SETUP,
    },
    {
      id: 'e6-butterfly-flurry-enhanced',
      piece: 'eidolon-6-enhanced',
      quote: 'After attacking with Ultimate, Seele inflicts "Butterfly Flurry" on the target for 3 turn(s).',
      tag: 'Enemy: Butterfly Flurry (Enhanced)',
      gives: [],
      to: 'enemy',
      causes: 'debuff',
      setup: BUTTERFLY_SETUP,
    },
  ],
  nothing: {
    'signature-weapon': WEAPON_SELF,
    'skill-basic-atk-thwack': QUANTUM,
    'skill-skill-sheathed-blade': 'Deals Quantum DMG and raises only her own SPD; nothing for the team.',
    'skill-ultimate-butterfly-flurry': QUANTUM,
    'skill-talent-resurgence': 'Gives only herself an extra turn and DMG; nothing for the team.',
    'skill-technique-phantom-illusion': TECH,
    'trace-nightshade': HER_AGGRO,
    'trace-lacerate': HER,
    'trace-rippling-waves': 'Advances only her own action; nothing for the team.',
    'eidolon-1': HER,
    'eidolon-2': HER,
    'eidolon-3': HER_LEVELS,
    'eidolon-4': 'Regenerates only her own Energy; nothing for the team.',
    'eidolon-5': HER_LEVELS,
    'skill-basic-atk-thwack-enhanced': QUANTUM,
    'skill-skill-sheathed-blade-enhanced': 'Deals Quantum DMG and raises only her own SPD; her extra Skill after allies attack is her own damage (attacks are not an event).',
    'skill-ultimate-butterfly-flurry-enhanced': QUANTUM,
    'skill-talent-resurgence-enhanced': 'Gives only herself an extra turn and DMG; nothing for the team.',
    'skill-technique-phantom-illusion-enhanced': TECH,
    'trace-nightshade-enhanced': HER,
    'trace-lacerate-enhanced': HER,
    'trace-rippling-waves-enhanced': 'Advances only her own action; nothing for the team.',
    'eidolon-1-enhanced': HER,
    'eidolon-2-enhanced': HER,
    'eidolon-3-enhanced': HER_LEVELS,
    'eidolon-4-enhanced': 'Regenerates only her own Energy; nothing for the team.',
    'eidolon-5-enhanced': HER_LEVELS,
  },
};

const sushang: CharacterSheet = {
  characterId: '1206',
  name: 'Sushang',
  damage: {
    kinds: ['basic', 'skill', 'ultimate', 'additional'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'skill-skill-cloudfencer-art-mountainfall', quote: "Deals Physical DMG equal to 210% of Sushang's ATK to one designated enemy." },
      { piece: 'skill-skill-cloudfencer-art-mountainfall', quote: `In addition, there is a 33% chance to trigger "Sword Stance" on the final hit, dealing Physical Additional DMG equal to 100% of Sushang's ATK to the enemy.` },
    ],
  },
  entries: [
    {
      id: 'e1-skill-point',
      piece: 'eidolon-1',
      quote: 'After using Skill against a Weakness Broken enemy, regenerates 1 Skill Point.',
      tag: 'Team: +1 Skill Point',
      gives: [{ stat: 'skill-points', amount: '+1' }],
      to: 'allies',
      setup: 'She uses her Skill on a Weakness Broken enemy.',
    },
  ],
  nothing: {
    'skill-basic-atk-cloudfencer-art-starshine': PHYS,
    'skill-skill-cloudfencer-art-mountainfall': PHYS,
    'skill-ultimate-shape-of-taixu-dawn-herald': 'Deals Physical DMG and buffs only herself; nothing for the team.',
    'skill-talent-dancing-blade': 'Raises only her own SPD (when an enemy is Weakness Broken); nothing for the team.',
    'skill-technique-cloudfencer-art-warcry': TECH,
    'trace-guileless': HER_AGGRO,
    'trace-riposte': HER,
    'trace-vanquisher': 'Advances only her own action (when an enemy is Weakness Broken); nothing for the team.',
    'eidolon-2': 'Lowers only the DMG she takes; nothing for the team.',
    'eidolon-3': HER_LEVELS,
    'eidolon-4': HER,
    'eidolon-5': HER_LEVELS,
    'eidolon-6': HER,
  },
};

const yanqing: CharacterSheet = {
  characterId: '1209',
  name: 'Yanqing',
  damage: {
    kinds: ['basic', 'skill', 'ultimate', 'follow-up'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'skill-skill-darting-ironthorn', quote: "Deals Ice DMG equal to 220% of Yanqing's ATK to one designated enemy" },
      { piece: 'skill-ultimate-amidst-the-raining-bliss', quote: "Afterwards, deals Ice DMG equal to 350% of Yanqing's ATK to one designated enemy." },
      { piece: 'skill-talent-one-with-the-sword', quote: 'After Yanqing attacks an enemy, there is a 60% fixed chance to launch Follow-Up ATK' },
    ],
  },
  entries: [
    {
      id: 'follow-up',
      piece: 'skill-talent-one-with-the-sword',
      quote: 'After Yanqing attacks an enemy, there is a 60% fixed chance to launch Follow-Up ATK',
      tag: 'Follow-Up ATK',
      gives: [],
      to: 'enemy',
      causes: 'follow-up',
      setup: 'He attacks (60% fixed chance each time).',
    },
    {
      id: 'freeze',
      piece: 'skill-talent-one-with-the-sword',
      quote: 'The Frozen target cannot take action and receives Ice Additional DMG equal to 50% of Yanqing\'s ATK at the beginning of each turn.',
      tag: 'Enemy: Frozen, skips its turn',
      gives: [{ stat: 'delay', amount: 'Frozen for 1 turn (65% base chance)' }],
      to: 'enemy',
      causes: 'debuff',
      setup: 'His Follow-Up ATK lands and the 65% base chance to Freeze hits.',
    },
  ],
  nothing: {
    'skill-basic-atk-frost-thorn': ICE,
    'skill-skill-darting-ironthorn': 'Deals Ice DMG and turns on his own "Soulsteel Sync"; nothing for the team.',
    'skill-ultimate-amidst-the-raining-bliss': 'Deals Ice DMG and buffs only himself; nothing for the team.',
    'skill-technique-the-one-true-sword': TECH,
    'trace-icing-on-the-kick': 'Adds his own Ice Additional DMG; nothing for the team.',
    'trace-frost-favors-the-brave': HIM,
    'trace-gentle-blade': HIM,
    'eidolon-1': 'Adds his own Ice Additional DMG on Frozen enemies; nothing for the team.',
    'eidolon-2': HIM,
    'eidolon-3': HIS_LEVELS,
    'eidolon-4': HIM,
    'eidolon-5': HIS_LEVELS,
    'eidolon-6': 'Makes his own buffs last longer; nothing for the team.',
  },
};

const PREY = 'Hit the enemy his Skill marked as "Prey".';

const moze: CharacterSheet = {
  characterId: '1223',
  name: 'Moze',
  damage: {
    kinds: ['ultimate', 'follow-up', 'additional'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'trace-vengewise', quote: 'When dealing DMG by using Ultimate, it is considered as having launched a Follow-Up ATK.' },
      { piece: 'skill-talent-cascading-featherblade', quote: 'After ally targets attack "Prey," Moze will additionally deal 1 instance of Lightning Additional DMG equal to 30% of his ATK and consumes 1 point of Charge.' },
      { piece: 'skill-talent-cascading-featherblade', quote: 'For every 3 point(s) of Charge consumed, Moze launches 1 Follow-Up ATK to "Prey," dealing Lightning DMG equal to 160% of his ATK.' },
    ],
  },
  entries: [
    {
      id: 'featherblade-follow-up',
      piece: 'skill-talent-cascading-featherblade',
      quote: 'For every 3 point(s) of Charge consumed, Moze launches 1 Follow-Up ATK to "Prey," dealing Lightning DMG equal to 160% of his ATK.',
      tag: 'Follow-Up ATK on "Prey"',
      gives: [],
      to: 'enemy',
      causes: 'follow-up',
      setup: 'Allies attack the enemy his Skill marked as "Prey" (each attack uses 1 Charge; every 3 Charge is 1 Follow-Up ATK).',
    },
    {
      id: 'vengewise',
      piece: 'trace-vengewise',
      quote: 'The Follow-Up ATK DMG taken by the "Prey" increases by 25%.',
      tag: 'Prey: Follow-Up ATK DMG taken +25%',
      gives: [{ stat: 'vulnerability', amount: '+25%' }],
      to: 'enemy',
      limits: { kinds: ['follow-up'] },
      setup: PREY,
    },
    {
      id: 'nightfeather',
      piece: 'trace-nightfeather',
      quote: "After using Talent's Follow-Up ATK, recovers 1 Skill Point(s).",
      tag: 'Team: +1 Skill Point',
      gives: [{ stat: 'skill-points', amount: '+1 (once per turn)' }],
      to: 'allies',
      setup: 'He launches his Talent\'s Follow-Up ATK.',
    },
    {
      id: 'e2-crit-dmg',
      piece: 'eidolon-2',
      quote: 'When all allies deal DMG to the enemy target marked as "Prey," increases CRIT DMG by 40%.',
      tag: 'Allies: +40% CRIT DMG on "Prey"',
      gives: [{ stat: 'crit-dmg', amount: '+40%' }],
      to: 'allies',
      setup: PREY,
    },
  ],
  nothing: {
    'skill-basic-atk-hurlthorn': LIGHTNING,
    'skill-skill-fleetwinged-raid': 'Deals Lightning DMG and marks "Prey" for his own Talent; its team effects are read under Talent, Vengewise and Eidolon 2.',
    'skill-ultimate-dash-in-gash-out': 'Deals Lightning DMG and launches his own Follow-Up ATK (counted under Talent); nothing more for the team.',
    'skill-technique-bated-wings': TECH,
    'trace-daggerhold': 'Advances only his own action; nothing for the team.',
    'eidolon-1': 'Regenerates only his own Energy; nothing for the team.',
    'eidolon-3': HIS_LEVELS,
    'eidolon-4': HIM,
    'eidolon-5': HIS_LEVELS,
    'eidolon-6': HIM,
  },
};

const march7thHunt: CharacterSheet = {
  characterId: '1224',
  name: 'March 7th',
  damage: {
    kinds: ['basic', 'ultimate', 'additional'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'skill-basic-atk-brows-be-smitten-heart-be-bitten', quote: "Initially, deals 3 hits, each causing Imaginary DMG equal to 80% of March 7th's ATK to one designated enemy target." },
      { piece: 'skill-skill-master-it-s-tea-time', quote: `Erudition, Destruction, The Hunt, Remembrance, Elation: Deals Additional DMG (DMG Type based on "Shifu"'s Combat Type) equal to 20% of March 7th's ATK.` },
    ],
  },
  entries: [
    {
      id: 'shifu-spd',
      piece: 'skill-skill-master-it-s-tea-time',
      quote: `Designates one ally (excluding this unit) as "Shifu" and increases "Shifu"'s SPD by 10.0%.`,
      tag: 'Shifu: +10% SPD',
      gives: [{ stat: 'spd', amount: '+10%' }],
      to: 'chosen-ally',
      setup: 'She uses her Skill on the damage dealer to make them "Shifu".',
    },
    {
      id: 'shifu-dmg-path',
      piece: 'skill-skill-master-it-s-tea-time',
      quote: `Erudition, Destruction, The Hunt, Remembrance, Elation: Deals Additional DMG (DMG Type based on "Shifu"'s Combat Type) equal to 20% of March 7th's ATK.`,
      tag: 'Own Additional DMG with an Erudition, Destruction, Hunt, Remembrance or Elation Shifu',
      on: { count: { paths: ['erudition', 'destruction', 'hunt', 'remembrance', 'elation'], atLeast: 1, others: true } },
      gives: [{ stat: 'extra-dmg', amount: '20% of her ATK per Basic ATK hit' }],
      to: 'self',
      setup: 'She makes that teammate "Shifu" with her Skill.',
      noStack: 'march-7th-shifu-path',
    },
    {
      id: 'shifu-support-path',
      piece: 'skill-skill-master-it-s-tea-time',
      quote: 'Harmony, Nihility, Preservation, Abundance: Increases the Toughness Reduction of this instance of DMG by 100%.',
      tag: 'Own Toughness Reduction +100% with a Harmony, Nihility, Preservation or Abundance Shifu',
      on: { count: { paths: ['harmony', 'nihility', 'preservation', 'abundance'], atLeast: 1, others: true } },
      gives: [{ stat: 'break-efficiency', amount: '+100% per Basic ATK hit' }],
      to: 'self',
      setup: 'She makes that teammate "Shifu" with her Skill.',
      noStack: 'march-7th-shifu-path',
    },
    {
      id: 'tide-tamer',
      piece: 'trace-tide-tamer',
      quote: "After using Enhanced Basic ATK, increases Shifu's CRIT DMG by 60% and Break Effect by 36%, lasting for 2 turn(s).",
      tag: 'Shifu: +60% CRIT DMG, +36% Break Effect',
      gives: [
        { stat: 'crit-dmg', amount: '+60%' },
        { stat: 'break-effect', amount: '+36%' },
      ],
      to: 'chosen-ally',
      setup: 'The damage dealer is "Shifu" and she uses her Enhanced Basic ATK.',
    },
    {
      id: 'e2-follow-up',
      piece: 'eidolon-2',
      quote: 'After "Shifu" uses Basic ATK or Skill to attack an enemy target, March 7th immediately launches a Follow-Up ATK and deals Imaginary DMG equal to 60% of March 7th\'s ATK to the primary target of this attack.',
      tag: 'Follow-Up ATK after Shifu attacks',
      gives: [],
      to: 'enemy',
      causes: 'follow-up',
      setup: '"Shifu" attacks with Basic ATK or Skill (once per turn).',
    },
  ],
  nothing: {
    'skill-basic-atk-my-sword-zaps-demons': 'Deals Imaginary DMG and gives herself Charge; nothing for the team.',
    'skill-ultimate-march-7th-the-apex-heroine': 'Deals Imaginary DMG and strengthens her own Enhanced Basic ATK; nothing for the team.',
    'skill-talent-master-i-ve-ascended': 'Gains her own Charge when "Shifu" attacks (attacks are not an event) and buffs only herself; nothing for the team.',
    'skill-technique-feast-in-one-go': TECH,
    'skill-basic-atk-brows-be-smitten-heart-be-bitten': IMAG,
    'trace-swan-soar': 'Advances only her own action; nothing for the team.',
    'trace-filigree': 'Lets her own attacks reduce Toughness; nothing for the team.',
    'eidolon-1': HER,
    'eidolon-3': HER_LEVELS,
    'eidolon-4': 'Regenerates only her own Energy; nothing for the team.',
    'eidolon-5': HER_LEVELS,
    'eidolon-6': HER,
  },
};

const drRatio: CharacterSheet = {
  characterId: '1305',
  name: 'Dr. Ratio',
  damage: {
    kinds: ['skill', 'ultimate', 'follow-up'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'skill-talent-cogito-ergo-sum', quote: "When using his Skill, Dr. Ratio has a 40% fixed chance of launching a Follow-Up ATK against his target for 1 time, dealing Imaginary DMG equal to 270% of Dr. Ratio's ATK." },
      { piece: 'skill-ultimate-syllogistic-paradox', quote: `When Dr. Ratio's teammates attack a target afflicted with "Wiseman's Folly," Dr. Ratio launches 1 instance of his Talent's Follow-Up ATK against this target.` },
    ],
  },
  entries: [
    {
      id: 'cogito-follow-up',
      piece: 'skill-talent-cogito-ergo-sum',
      quote: "When using his Skill, Dr. Ratio has a 40% fixed chance of launching a Follow-Up ATK against his target for 1 time, dealing Imaginary DMG equal to 270% of Dr. Ratio's ATK.",
      tag: 'Follow-Up ATK after his Skill',
      gives: [],
      to: 'enemy',
      causes: 'follow-up',
      setup: 'He uses his Skill; each debuff on the target raises the chance by 20%, so teammates who debuff help.',
    },
    {
      id: 'inference',
      piece: 'trace-inference',
      quote: "When Skill is used to attack an enemy target, there is a 100% base chance to reduce the attacked enemy target's Effect RES by 10% for 2 turn(s).",
      tag: 'Enemy: Effect RES −10%',
      gives: [],
      to: 'enemy',
      causes: 'debuff',
      setup: 'He uses his Skill on the target.',
    },
  ],
  nothing: {
    'signature-weapon': WEAPON_SELF,
    'skill-basic-atk-mind-is-might': IMAG,
    'skill-skill-intellectual-midwifery': 'Deals Imaginary DMG; its Follow-Up ATK and debuff are read under Talent and Inference.',
    'skill-ultimate-syllogistic-paradox': `Deals Imaginary DMG; "Wiseman's Folly" gives him more of his own Follow-Up ATKs when teammates attack (attacks are not an event).`,
    'skill-technique-mold-of-idolatry': TECH,
    'trace-summation': 'Buffs only himself (more with debuffs on the target); nothing for the team.',
    'trace-deduction': 'Buffs only his own DMG (with 3 or more debuffs on the target); nothing for the team.',
    'eidolon-1': HIM,
    'eidolon-2': 'Adds his own Additional DMG per debuff on the target; nothing for the team.',
    'eidolon-3': HIS_LEVELS,
    'eidolon-4': 'Regenerates only his own Energy; nothing for the team.',
    'eidolon-5': HIS_LEVELS,
    'eidolon-6': HIM,
  },
};

const boothill: CharacterSheet = {
  characterId: '1315',
  name: 'Boothill',
  damage: {
    kinds: ['basic', 'break'],
    uses: ['break-effect'],
    ignores: [],
    quotes: [
      { piece: 'skill-basic-atk-fanning-the-hammer', quote: "Deals Physical DMG equal to 220% of Boothill's ATK to one designated enemy target." },
      { piece: 'skill-talent-five-peas-in-a-pod', quote: "If the target is Weakness Broken while the Enhanced Basic ATK is being used, based on the number of Pocket Trickshot stacks, deals Break DMG to this target equal to 70%/120%/170% of Boothill's Physical Break DMG." },
      { piece: 'trace-ghost-load', quote: "Increase this character's CRIT Rate/CRIT DMG, by an amount equal to 10%/50% of Break Effect, up to a max increase of 30%/150%." },
    ],
  },
  entries: [
    {
      id: 'standoff-taunt',
      piece: 'skill-skill-sizzlin-tango',
      quote: 'The enemy target in the "Standoff" becomes Taunted.',
      tag: 'Enemy: Taunted in the Standoff',
      gives: [{ stat: 'taunt', amount: 'one enemy attacks only Boothill' }],
      to: 'enemy',
      causes: 'debuff',
      setup: 'He uses his Skill on the target.',
    },
    {
      id: 'ultimate-delay',
      piece: 'skill-ultimate-dust-devil-s-sunset-rodeo',
      quote: "Deals Physical DMG equal to 400% of Boothill's ATK to the target and delays their action by 40%.",
      tag: 'Enemy: action delayed 40% (and gets Physical Weakness)',
      gives: [{ stat: 'delay', amount: '40%' }],
      to: 'enemy',
      setup: 'He uses his Ultimate on the target.',
    },
    {
      id: 'e2-skill-point',
      piece: 'eidolon-2',
      quote: 'When in Standoff and gaining Pocket Trickshot, recovers 1 Skill Point(s) and increases Break Effect by 30%, lasting for 2 turn(s).',
      tag: 'Team: +1 Skill Point',
      gives: [{ stat: 'skill-points', amount: '+1 (once per turn)' }],
      to: 'allies',
      setup: 'He gains Pocket Trickshot in the Standoff (the target is defeated or Weakness Broken).',
    },
  ],
  nothing: {
    'signature-weapon': WEAPON_SELF,
    'skill-basic-atk-skullcrush-spurs': PHYS,
    'skill-talent-five-peas-in-a-pod': 'Deals his own Break DMG; nothing for the team.',
    'skill-technique-3-9-smile': TECH,
    'skill-basic-atk-fanning-the-hammer': PHYS,
    'trace-ghost-load': HIM,
    'trace-above-snakes': 'Lowers only the DMG he takes; nothing for the team.',
    'trace-point-blank': 'Regenerates only his own Energy; nothing for the team.',
    'eidolon-1': HIM,
    'eidolon-3': HIS_LEVELS,
    'eidolon-4': 'The extra DMG taken counts only for his own attacks; nothing for the team.',
    'eidolon-5': HIS_LEVELS,
    'eidolon-6': 'Adds his own Break DMG; nothing for the team.',
  },
};

const ONLY_ASHVEIL = 'Buffs only Ashveil; nothing for the team.';
const ASHVEIL_LEVELS = "Raises Ashveil's own skill levels; nothing for the team.";
const BAIT = `Ashveil's Skill or Ultimate keeps a "Bait" on the field.`;

const ashveil: CharacterSheet = {
  characterId: '1504',
  name: 'Ashveil',
  damage: {
    kinds: ['skill', 'ultimate', 'follow-up'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'skill-talent-rancor-enmity-reprisal', quote: 'consumes 1 Charge to launch Follow-Up ATK against the "Bait," dealing Lightning DMG equal to 200% of Ashveil\'s ATK.' },
      { piece: 'skill-ultimate-banquet-insatiable-appetite', quote: 'Makes one designated enemy become the "Bait," dealing it Lightning DMG equal to 400% of Ashveil\'s ATK.' },
      { piece: 'trace-phantom-limb', quote: "DMG dealt by Ashveil's Follow-Up ATK increases by 80%." },
    ],
  },
  entries: [
    {
      id: 'bait-def-down',
      piece: 'skill-skill-flog-smite-evil',
      quote: `When the "Bait" exists on the field, all enemies' DEF gets reduced by 40%.`,
      tag: 'Enemies: DEF −40%',
      gives: [{ stat: 'def-shred', amount: '40%' }],
      to: 'enemy',
      causes: 'debuff',
      setup: BAIT,
    },
    {
      id: 'bait-skill-point',
      piece: 'skill-skill-flog-smite-evil',
      quote: `If the target is already the "Bait," additionally deals it Lightning DMG equal to 100% of Ashveil's ATK, and recovers 1 Skill Point(s).`,
      tag: 'Team: +1 Skill Point',
      gives: [{ stat: 'skill-points', amount: '+1' }],
      to: 'allies',
      setup: 'Ashveil uses the Skill on the enemy that is already the "Bait".',
    },
    {
      id: 'rancor-follow-up',
      piece: 'skill-talent-rancor-enmity-reprisal',
      quote: 'After the "Bait" gets attacked by other ally targets, Ashveil regenerates a fixed amount of 8 Energy, then consumes 1 Charge to launch Follow-Up ATK against the "Bait,"',
      tag: 'Follow-Up ATK on the "Bait"',
      gives: [],
      to: 'enemy',
      causes: 'follow-up',
      setup: 'Other allies attack the "Bait" while Ashveil holds Charge.',
    },
    {
      id: 'first-fang',
      piece: 'trace-first-fang',
      quote: 'CRIT DMG dealt by ally targets increases by 40%',
      tag: 'Allies: +40% CRIT DMG',
      gives: [{ stat: 'crit-dmg', amount: '+40%' }],
      to: 'allies',
      setup: 'Nothing; on while Ashveil is on the field.',
    },
    {
      id: 'first-fang-follow-up',
      piece: 'trace-first-fang',
      quote: "CRIT DMG dealt by ally target's Follow-Up ATK additionally increases by 80%.",
      tag: 'Allies: Follow-Up ATK CRIT DMG +80%',
      gives: [{ stat: 'crit-dmg', amount: '+80%' }],
      to: 'allies',
      limits: { kinds: ['follow-up'] },
      setup: 'Nothing; on while Ashveil is on the field.',
    },
    {
      id: 'e1-vulnerability',
      piece: 'eidolon-1',
      quote: 'While Ashveil is on the field, increases DMG taken by all enemies by 24%.',
      tag: 'Enemies: DMG taken +24%',
      gives: [{ stat: 'vulnerability', amount: '+24% (+36% at 50% HP or lower)' }],
      to: 'enemy',
      setup: 'Nothing; on while Ashveil is on the field.',
    },
    {
      id: 'e6-res-down',
      piece: 'eidolon-6',
      quote: `When the "Bait" exists on the field, reduces all enemies' All-Type RES by 20%.`,
      tag: 'Enemies: All-Type RES −20%',
      gives: [{ stat: 'res-pen', amount: '20%' }],
      to: 'enemy',
      setup: BAIT,
    },
    {
      id: 'lc-umbra-devourer',
      piece: 'signature-weapon',
      quote: 'While the wearer holds "Umbra Devourer," increases ATK by 40% and increases the DMG taken by all enemies by 20%.',
      tag: 'Enemies: DMG taken +20% (Umbra Devourer)',
      gives: [{ stat: 'vulnerability', amount: '+20% for 3 turns' }],
      to: 'enemy',
      setup: 'Nothing at the start of battle; then again after every 4 of her Follow-Up ATKs.',
    },
  ],
  nothing: {
    'skill-basic-atk-talons-inculcate-decorum': LIGHTNING,
    'skill-ultimate-banquet-insatiable-appetite': `Deals Lightning DMG and launches Ashveil's own enhanced Follow-Up ATK (counted under Talent); the "Bait" it marks is read under Skill.`,
    'skill-technique-devour-o-loathsome-hand': TECH,
    'trace-damnation-trail': 'Gives Ashveil "Gluttony" stacks; nothing for the team.',
    'trace-phantom-limb': ONLY_ASHVEIL,
    'eidolon-2': 'Gives Ashveil more "Gluttony"; nothing for the team.',
    'eidolon-3': ASHVEIL_LEVELS,
    'eidolon-4': ONLY_ASHVEIL,
    'eidolon-5': ASHVEIL_LEVELS,
  },
};

export const groupC: CharacterSheet[] = [danHeng, archer, seele, sushang, yanqing, moze, march7thHunt, drRatio, boothill, ashveil];
