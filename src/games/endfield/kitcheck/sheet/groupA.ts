/**
 * Group A (E6b): the Physical side, read from data/kits.json (endfield.wiki.gg, cited per kit) with the
 * seven questions of docs/logic/endfield-method.md. Every quote is word for word from the kit text.
 */
import type { CharacterSheet, Entry } from '../types';

const OWN_STAT = 'Their own attribute only.';
const OWN_COST = 'Their own Ultimate Energy cost or cooldown only.';

const chen: CharacterSheet = {
  characterId: 'chr_0005_chen',
  name: 'Chen Qianyu',
  damage: {
    element: 'physical',
    skills: ['battle', 'combo', 'ultimate'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'battle-skill', quote: 'Performs an uppercut slash at the target enemy, dealing Physical DMG and Lift.' },
      { piece: 'ultimate', quote: 'A 7-sequence slash attack that deals Physical DMG with each sequence to the target enemy.' },
    ],
  },
  entries: [
    { id: 'lift', piece: 'battle-skill', quote: 'dealing Physical DMG and Lift', tag: 'Lift', gives: [], to: 'enemy', causes: ['lift', 'vulnerable'], setup: 'Cast the Battle Skill (100 SP). On an enemy that is not Vulnerable, Lift adds a Vulnerable stack instead.' },
    {
      id: 'combo-on-vulnerable',
      piece: 'combo-skill',
      quote: 'COMBO TRIGGER: When an enemy becomes Vulnerable.',
      tag: 'Combo when an enemy becomes Vulnerable',
      gives: [],
      to: 'self',
      reacts: ['vulnerable'],
      causes: ['lift', 'vulnerable'],
      setup: 'Someone makes an enemy Vulnerable: a Physical Status on an enemy that is not Vulnerable yet.',
    },
    { id: 'atk-stacks', piece: 'talent-slashing-edge', quote: 'After hitting an enemy with skills, Chen gains ATK +8% for 10s. This effect can reach 5 stacks.', tag: 'ATK +8% per stack (self)', gives: [{ stat: 'atk', amount: '+8% per stack, up to 5' }], to: 'self', setup: 'Hit enemies with skills to build 5 stacks.' },
    { id: 'stagger-interrupt', piece: 'talent-momentum-breaker', quote: "Interrupting the enemy's charge up deals another 10 Stagger.", tag: '+10 Stagger on interrupt', gives: [{ stat: 'stagger', amount: '10' }], to: 'enemy', setup: 'Interrupt an enemy charging up.' },
    { id: 'p1-low-hp', piece: 'potential-1', quote: 'DMG Dealt +20% to enemies below 50% HP.', tag: 'DMG +20% vs low HP (self)', gives: [{ stat: 'dmg', amount: '+20%' }], to: 'self', setup: 'Enemies below 50% HP.' },
    { id: 'p2-physical', piece: 'potential-2', quote: 'Physical DMG Dealt +8%.', tag: 'Physical DMG +8% (self)', gives: [{ stat: 'dmg', amount: '+8%' }], to: 'self', setup: 'Nothing: always on.' },
    { id: 'p3-multiplier', piece: 'potential-3', quote: 'DMG Multiplier is increased to 1.1 times the original.', tag: 'Skills ×1.1 (self)', gives: [{ stat: 'dmg', amount: '×1.1' }], to: 'self', setup: 'Nothing: always on.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks; the Final Strike Stagger is the controlled operator’s own.',
    ultimate: 'Their own damage only.',
    'talent-skirmisher': OWN_STAT,
    'potential-4': OWN_COST,
    'potential-5': OWN_COST,
  },
};

const daPan: CharacterSheet = {
  characterId: 'chr_0018_dapan',
  name: 'Da Pan',
  damage: {
    element: 'physical',
    skills: ['combo', 'ultimate', 'battle'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'combo-skill', quote: 'Swings the wok at the enemy to deal massive Physical DMG and Crush.' },
      { piece: 'ultimate', quote: 'The final step is to bash every enemy to the ground to forcibly Knock Down and deal massive Physical DMG to them.' },
    ],
  },
  entries: [
    { id: 'lift', piece: 'battle-skill', quote: 'performs a powerful wok flip that deals Physical DMG and Lift to the enemy', tag: 'Lift', gives: [], to: 'enemy', causes: ['lift', 'vulnerable'], setup: 'Cast the Battle Skill (100 SP). On an enemy that is not Vulnerable, Lift adds a Vulnerable stack instead.' },
    {
      id: 'combo-on-4-stacks',
      piece: 'combo-skill',
      quote: 'COMBO TRIGGER: When an enemy reaches 4 stacks of Vulnerability.',
      tag: 'Combo at 4 Vulnerable stacks',
      gives: [],
      to: 'self',
      reacts: ['vulnerable'],
      causes: ['crush'],
      setup: 'The team brings an enemy to 4 Vulnerable stacks.',
    },
    { id: 'ultimate-lift-knock-down', piece: 'ultimate', quote: 'Da Pan slams the chopping board to forcibly Lift all enemies in the area of effect in front of him.', tag: 'Forced Lift, then Knock Down', gives: [], to: 'enemy', causes: ['lift', 'knock-down', 'vulnerable'], setup: 'Cast the Ultimate (90 Energy).' },
    { id: 'consume-stacks', piece: 'talent-reduce-and-thicken', quote: 'After consuming 1 Vulnerability stack, Da Pan gains Physical DMG Dealt +6% for 10s. This effect can reach 4 stacks.', tag: 'Physical DMG +6% per stack (self)', gives: [{ stat: 'dmg', amount: '+6% per stack, up to 4' }], to: 'self', setup: 'Consume Vulnerability stacks (his Crush does).' },
    { id: 'p1-defeat', piece: 'potential-1', quote: 'If the ultimate defeats at least one enemy, Da Pan deals +30% Physical DMG for 15s.', tag: 'Physical DMG +30% (self)', gives: [{ stat: 'dmg', amount: '+30%' }], to: 'self', setup: 'The Ultimate defeats an enemy.' },
    { id: 'p3-physical', piece: 'potential-3', quote: 'Physical DMG Dealt +8%.', tag: 'Physical DMG +8% (self)', gives: [{ stat: 'dmg', amount: '+8%' }], to: 'self', setup: 'Nothing: always on.' },
    { id: 'p5-vulnerable', piece: 'potential-5', quote: 'If the skill hits only one enemy, apply 1 more stack of Vulnerability on the target.', tag: '+1 Vulnerable stack', gives: [], to: 'enemy', causes: ['vulnerable'], setup: 'The Battle Skill hits only one enemy; once every 45s.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-forged': OWN_STAT,
    'talent-salty-or-mild': 'Shorter cooldown for his own combo skill.',
    'potential-2': 'Improves his own talent Salty or Mild.',
    'potential-4': OWN_COST,
  },
};

const catcher: CharacterSheet = {
  characterId: 'chr_0020_meurs',
  name: 'Catcher',
  entries: [
    { id: 'protection', piece: 'battle-skill', quote: 'grants Protection to self and nearby operators, and immediately returns some SP', tag: 'Protection 90% and SP', gives: [{ stat: 'protection', amount: '90%' }, { stat: 'sp', amount: '30' }], to: 'team', noStack: 'protection', setup: 'Cast the Battle Skill (100 SP); only the strongest Protection applies (wiki: Protection).' },
    { id: 'retaliation', piece: 'battle-skill', quote: 'perform a retaliation bash that deals Physical DMG and applies 1 stack of Vulnerability to the attacking enemy', tag: 'Vulnerable on retaliation', gives: [], to: 'enemy', causes: ['vulnerable'], setup: 'An enemy attacks him while the shield is raised.' },
    { id: 'shields', piece: 'combo-skill', quote: 'granting shields to self and another teammate (controlled operator prioritized)', tag: 'Shields', gives: [{ stat: 'shield', amount: '810' }], to: 'controlled', setup: 'An enemy starts charging up a skill, or the controlled operator falls below 40% HP.' },
    { id: 'knock-down', piece: 'ultimate', quote: 'applies Knock Down to all enemies within the area of effect', tag: 'Knock Down', gives: [], to: 'enemy', causes: ['knock-down', 'vulnerable'], setup: 'Cast the Ultimate (80 Energy).' },
    { id: 'p5-sp', piece: 'potential-5', quote: 'Hitting an enemy while the shield is active returns 10 SP.', tag: '+10 SP', gives: [{ stat: 'sp', amount: '10' }], to: 'team', setup: 'Hit an enemy while his shield is up.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-forged': OWN_STAT,
    'talent-resilient-defense': 'His own DEF.',
    'talent-comprehensive-mindset': 'His own damage only.',
    'potential-1': 'His own damage only.',
    'potential-2': OWN_STAT,
    'potential-3': 'Longer shields: the shield is already counted as team support.',
    'potential-4': OWN_COST,
  },
};

const antal: CharacterSheet = {
  characterId: 'chr_0023_antal',
  name: 'Antal',
  entries: [
    {
      id: 'focus-susceptibility',
      piece: 'battle-skill',
      quote: 'An enemy with an active Focus also suffers Electric Susceptibility and Heat Susceptibility.',
      tag: 'Electric and Heat Susceptibility 10%',
      gives: [{ stat: 'susceptibility', amount: '10%' }],
      to: 'enemy',
      limits: { elements: ['electric', 'heat'] },
      causes: ['electric-susceptibility', 'heat-susceptibility'],
      setup: 'Cast the Battle Skill on the enemy (Focus lasts 60s, one enemy at a time).',
    },
    {
      id: 'combo-repeat',
      piece: 'combo-skill',
      quote: 'applies another stack of the same Physical Status or Arts Infliction',
      tag: 'Repeats a Physical Status or Infliction',
      gives: [],
      to: 'enemy',
      reacts: ['physical-status', 'arts-infliction'],
      causes: ['physical-status', 'arts-infliction'],
      setup: 'An enemy with Focus suffers a Physical Status or Arts Infliction from the team.',
    },
    { id: 'amp', piece: 'ultimate', quote: 'Applies temporary Electric Amp and Heat Amp to the entire team.', tag: 'Electric and Heat Amp 20%', gives: [{ stat: 'amp', amount: '20%' }], to: 'team', limits: { elements: ['electric', 'heat'] }, setup: 'Cast the Ultimate (100 Energy); lasts 12s.' },
    { id: 'heal-amped', piece: 'talent-improviser', quote: "After an Amped teammate's skill deals DMG, Antal restores the said teammate's HP", tag: 'Heals Amped teammates', gives: [{ stat: 'heal', amount: '[108 + Strength×0.9]' }], to: 'team', setup: 'His Amp is on a teammate; once every 30s each.' },
    { id: 'p1-amp', piece: 'potential-1', quote: 'Electric Amp and Heat Amp effects are increased to 1.1 times the original.', tag: 'Amp ×1.1 (+2%)', gives: [{ stat: 'amp', amount: '+2% (20% × 1.1)' }], to: 'team', limits: { elements: ['electric', 'heat'] }, setup: 'His Ultimate is on.' },
    { id: 'p3-sp', piece: 'potential-3', quote: 'When an enemy with an active Focus debuff is defeated, return 15 SP.', tag: '+15 SP', gives: [{ stat: 'sp', amount: '15' }], to: 'team', setup: 'The enemy with Focus is defeated.' },
    { id: 'p5-susceptibility', piece: 'potential-5', quote: 'Applying Focus on the same target for 20s increases Electric Susceptibility and Heat Susceptibility effects by 4%.', tag: 'Susceptibility +4%', gives: [{ stat: 'susceptibility', amount: '+4%' }], to: 'enemy', limits: { elements: ['electric', 'heat'] }, setup: 'Focus stays on the same enemy for 20s.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-keen-mind': OWN_STAT,
    'talent-subconscious-act': 'Protects and heals himself only.',
    'potential-2': OWN_COST,
    'potential-4': OWN_STAT,
  },
};

/** The Endministrator, male and female: the same kit on two ids. */
const endministratorEntries: Entry[] = [
  { id: 'crush', piece: 'battle-skill', quote: 'Deals Physical DMG and applies Crush.', tag: 'Crush', gives: [], to: 'enemy', causes: ['crush', 'vulnerable'], setup: 'Cast the Battle Skill (100 SP). On an enemy that is not Vulnerable, Crush adds a Vulnerable stack instead.' },
  {
    id: 'shatter-crystals',
    piece: 'combo-skill',
    quote: 'Applying Physical Status or Vulnerability to the sealed enemy shatters the Originium Crystals and deals additional Physical DMG.',
    tag: 'Crystals shattered by a Physical Status',
    gives: [],
    to: 'self',
    reacts: ['physical-status', 'vulnerable'],
    setup: "Another operator's combo skill deals DMG (his combo trigger), then someone applies a Physical Status or Vulnerability to the sealed enemy.",
  },
  { id: 'atk-on-shatter', piece: 'talent-essence-disintegration', quote: 'When the Originium Crystals attached to the enemy are consumed, the Endministrator gains ATK +30% for 15s.', tag: 'ATK +30% (self)', gives: [{ stat: 'atk', amount: '+30%' }], to: 'self', setup: 'His crystals are shattered.' },
  { id: 'physical-dmg-taken', piece: 'talent-realspace-stasis', quote: 'Enemies with attached Originium Crystals suffer Physical DMG Taken +20%.', tag: 'Physical DMG Taken +20%', gives: [{ stat: 'dmg-taken', amount: '+20%' }], to: 'enemy', limits: { elements: ['physical'] }, setup: 'His combo skill attaches crystals.' },
  { id: 'p1-sp', piece: 'potential-1', quote: 'Consuming Originium Crystals returns 50 SP.', tag: '+50 SP', gives: [{ stat: 'sp', amount: '50' }], to: 'team', setup: 'His Battle Skill shatters crystals.' },
  { id: 'p2-team-atk', piece: 'potential-2', quote: 'When the Endministrator gains the ATK buff, other allied operators gain half of this ATK buff.', tag: 'ATK +15% for the others', gives: [{ stat: 'atk', amount: '+15% (half of +30%)' }], to: 'team', setup: 'His crystals are shattered.' },
  { id: 'p4-arts-intensity', piece: 'potential-4', quote: 'Arts Intensity +16.', tag: 'Arts Intensity +16 (self)', gives: [{ stat: 'arts-intensity', amount: '+16' }], to: 'self', setup: 'Nothing: always on.' },
];
const endministratorNothing: Record<string, string> = {
  'basic-attack': 'Their own basic attacks.',
  ultimate: 'His own damage only.',
  'talent-skirmisher': OWN_STAT,
  'potential-3': OWN_COST,
  'potential-5': 'Not on the wiki yet (its text reads "???").',
};
const endministratorDamage: CharacterSheet['damage'] = {
  element: 'physical',
  skills: ['battle', 'ultimate', 'combo'],
  uses: [],
  ignores: [],
  quotes: [
    { piece: 'battle-skill', quote: 'Deals Physical DMG and applies Crush.' },
    { piece: 'ultimate', quote: 'Bombards the ground with Originium Crystals, dealing massive Physical DMG to all enemies within a fan-shaped area.' },
  ],
};

const lifeng: CharacterSheet = {
  characterId: 'chr_0015_lifeng',
  name: 'Lifeng',
  damage: {
    element: 'physical',
    skills: ['ultimate', 'battle', 'combo'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'ultimate', quote: 'The Slam deals Physical DMG and applies Knock Down to all enemies in a large area of effect (AOE)' },
      { piece: 'battle-skill', quote: 'Swings the polearm multiple times to deal 2 hits of Physical DMG' },
    ],
  },
  entries: [
    { id: 'knock-down', piece: 'battle-skill', quote: 'slams the ground to deal Physical DMG and Knock Down to all enemies in the area of effect', tag: 'Knock Down', gives: [], to: 'enemy', causes: ['knock-down', 'vulnerable'], setup: 'Cast the Battle Skill (100 SP).' },
    {
      id: 'physical-susceptibility',
      piece: 'battle-skill',
      quote: 'If the enemy struck by the last hit of this skill has no Vulnerability stacks, apply Physical Susceptibility to the said enemy as well.',
      tag: 'Physical Susceptibility 12%',
      gives: [{ stat: 'susceptibility', amount: '12%' }],
      to: 'enemy',
      limits: { elements: ['physical'] },
      causes: ['physical-susceptibility'],
      setup: 'Hit an enemy with no Vulnerability stacks with the last hit; lasts 12s.',
    },
    {
      id: 'link',
      piece: 'combo-skill',
      quote: 'Unleashes an aspect that performs a spear thrust to deal Physical DMG and grants Link.',
      tag: 'Link',
      gives: [{ stat: 'link', amount: '+30% (next Battle Skill; +20% for an Ultimate, wiki: Link)' }],
      to: 'team',
      limits: { skills: ['battle', 'ultimate'] },
      reacts: ['physical-susceptibility', 'breach'],
      setup: 'The controlled operator performs a Final Strike on an enemy with Physical Susceptibility or Breach (his own Battle Skill applies the Susceptibility).',
    },
    { id: 'ultimate-knock-down', piece: 'ultimate', quote: 'applies another Knock Down to enemies still within its AOE', tag: 'Knock Down twice', gives: [], to: 'enemy', causes: ['knock-down', 'vulnerable'], setup: 'Cast the Ultimate (90 Energy).' },
    { id: 'p1-susceptibility', piece: 'potential-1', quote: 'Physical Susceptibility +5%', tag: 'Physical Susceptibility +5%', gives: [{ stat: 'susceptibility', amount: '+5%' }], to: 'enemy', limits: { elements: ['physical'] }, setup: 'His Battle Skill applies it.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-skirmisher': OWN_STAT,
    'talent-illumination': 'His own ATK from his own attributes.',
    'talent-subduer-of-evil': 'His own extra damage on Knock Down.',
    'potential-2': OWN_STAT,
    'potential-3': 'His own ATK from his own attributes.',
    'potential-4': OWN_COST,
    'potential-5': 'His own extra damage on Knock Down.',
  },
};

export const groupA: CharacterSheet[] = [
  chen,
  daPan,
  catcher,
  antal,
  { characterId: 'chr_0002_endminm', name: 'Endministrator (Male)', damage: endministratorDamage, entries: endministratorEntries, nothing: endministratorNothing },
  { characterId: 'chr_0003_endminf', name: 'Endministrator (Female)', damage: endministratorDamage, entries: endministratorEntries, nothing: endministratorNothing },
  lifeng,
];
