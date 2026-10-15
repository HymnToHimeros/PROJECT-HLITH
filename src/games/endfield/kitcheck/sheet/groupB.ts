/**
 * Group B (E6c): the launch Heat, Cryo and Nature operators, read from data/kits.json (endfield.wiki.gg, cited
 * per kit) with the seven questions of docs/logic/endfield-method.md. Every quote is word for word from the kit text.
 */
import type { CharacterSheet } from '../types';

const OWN_STAT = 'Their own attribute only.';
const OWN_COST = 'Their own Ultimate Energy cost or cooldown only.';
const LINK = '+30% (next Battle Skill; +20% for an Ultimate, wiki: Link)';

const laevatain: CharacterSheet = {
  characterId: 'chr_0016_laevat',
  name: 'Laevatain',
  damage: {
    element: 'heat',
    skills: ['battle', 'ultimate', 'combo'],
    uses: ['arts-intensity'],
    ignores: [],
    quotes: [
      { piece: 'battle-skill', quote: 'perform 1 additional attack that deals Heat DMG and forcibly trigger temporary Combustion to all enemies in a large area' },
      { piece: 'ultimate', quote: 'the Sviga Lævi strikes together with Laevatain, with each attack dealing Heat DMG' },
      { piece: 'combo-skill', quote: 'Fire erupts beneath the feet of any enemy with Combustion or Corrosion, dealing Heat DMG to them.' },
    ],
  },
  entries: [
    { id: 'forced-combustion', piece: 'battle-skill', quote: 'forcibly trigger temporary Combustion to all enemies in a large area', tag: 'Forced Combustion', gives: [], to: 'enemy', causes: ['combustion'], setup: 'Build 4 Melting Flame stacks, then cast the Battle Skill (100 SP).' },
    {
      id: 'combo-on-reaction',
      piece: 'combo-skill',
      quote: 'COMBO TRIGGER: When an enemy suffers Combustion or Corrosion.',
      tag: 'Combo on Combustion or Corrosion',
      gives: [],
      to: 'self',
      reacts: ['combustion', 'corrosion'],
      setup: 'Someone applies Combustion or Corrosion: Heat or Nature Infliction on top of another element’s, or a forced reaction.',
    },
    { id: 'ultimate-heat', piece: 'ultimate', quote: 'BATK sequence 3 also applies Heat Infliction.', tag: 'Heat Infliction', gives: [], to: 'enemy', causes: ['heat-infliction', 'arts-infliction'], setup: 'Cast the Ultimate (300 Energy) and reach basic attack sequence 3.' },
    {
      id: 'absorb-heat',
      piece: 'talent-scorching-heart',
      quote: 'Every stack of Heat Infliction absorbed gives Laevatain 1 stack of Melting Flame (max stacks: 4).',
      tag: 'Melting Flame from Heat Infliction',
      gives: [],
      to: 'self',
      reacts: ['heat-infliction'],
      setup: 'Enemies carry Heat Infliction when the controlled operator’s Final Strike or Finisher hits.',
    },
    { id: 'heat-res-ignore', piece: 'talent-scorching-heart', quote: 'After reaching 4 stacks, DMG dealt by Laevatain ignores 20 Heat Resistance of the enemy for 20s.', tag: 'Ignores 20 Heat RES (self)', gives: [{ stat: 'res-ignore', amount: '20' }], to: 'self', setup: 'Reach 4 Melting Flame stacks.' },
    { id: 'p1-additional', piece: 'potential-1', quote: 'Additional attack multiplier is increased to 1.2 times the original', tag: 'Additional attack ×1.2 (self)', gives: [{ stat: 'dmg', amount: '×1.2' }], to: 'self', setup: 'Her Battle Skill’s additional attack.' },
    { id: 'p1-sp', piece: 'potential-1', quote: 'scoring a hit returns 20 SP', tag: '+20 SP', gives: [{ stat: 'sp', amount: '20' }], to: 'team', setup: 'Her Battle Skill’s additional attack hits.' },
    { id: 'p2-basic', piece: 'potential-2', quote: 'Basic Attack DMG Dealt +15%.', tag: 'Basic Attack DMG +15% (self)', gives: [{ stat: 'dmg', amount: '+15%' }], to: 'self', limits: { skills: ['basic'] }, setup: 'Nothing: always on.' },
    { id: 'p3-combustion', piece: 'potential-3', quote: 'DMG of the Combustion applied by the skills is increased to 1.5 times the original.', tag: 'Combustion ×1.5 (self)', gives: [{ stat: 'dmg', amount: '×1.5' }], to: 'self', setup: 'Her Battle Skill applies Combustion.' },
    { id: 'p5-enhanced', piece: 'potential-5', quote: 'Enhanced basic attack DMG multiplier is increased to 1.2 times the original', tag: 'Enhanced basic attack ×1.2 (self)', gives: [{ stat: 'dmg', amount: '×1.2' }], to: 'self', setup: 'During her Ultimate.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-re-ignition': 'Protects and heals herself only.',
    'talent-keen-mind': OWN_STAT,
    'potential-4': OWN_COST,
  },
};

const akekuri: CharacterSheet = {
  characterId: 'chr_0019_karin',
  name: 'Akekuri',
  entries: [
    { id: 'heat-infliction', piece: 'battle-skill', quote: 'A frontal slash that deals Heat DMG and applies Heat Infliction.', tag: 'Heat Infliction', gives: [], to: 'enemy', causes: ['heat-infliction', 'arts-infliction'], setup: 'Cast the Battle Skill (100 SP).' },
    { id: 'combo-sp', piece: 'combo-skill', quote: 'Performs a returning dash with 2 thrust sequences, with each sequence dealing Physical DMG and recovering some SP.', tag: 'SP on Stagger', gives: [{ stat: 'sp', amount: '15 (7.5 per sequence)' }], to: 'team', reacts: ['stagger'], setup: 'An enemy becomes Staggered or hits a Stagger Node (her combo trigger).' },
    { id: 'ultimate-sp', piece: 'ultimate', quote: 'Enters a channeling state and fires 3 Rallying Flares. Each firing recovers some SP.', tag: '+80 SP', gives: [{ stat: 'sp', amount: '80' }], to: 'team', setup: 'Cast the Ultimate (120 Energy).' },
    { id: 'link', piece: 'talent-staying-in-the-zone', quote: 'When ultimate is active, grants a Link buff.', tag: 'Link', gives: [{ stat: 'link', amount: LINK }], to: 'team', limits: { skills: ['battle', 'ultimate'] }, setup: 'Cast the Ultimate (120 Energy).' },
    { id: 'p3-team-atk', piece: 'potential-3', quote: 'While ultimate is active, entire team gains ATK +10%.', tag: 'Team ATK +10%', gives: [{ stat: 'atk', amount: '+10%' }], to: 'team', setup: 'During her Ultimate.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-cheer-of-victory': 'More SP from her combo skill: already counted as team support.',
    'talent-skirmisher': OWN_STAT,
    'potential-1': 'Her own ATK.',
    'potential-2': OWN_STAT,
    'potential-4': OWN_COST,
    'potential-5': 'Her Link lasts longer: already counted.',
  },
};

const wulfgard: CharacterSheet = {
  characterId: 'chr_0006_wolfgd',
  name: 'Wulfgard',
  damage: {
    element: 'heat',
    skills: ['battle', 'ultimate', 'combo'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'battle-skill', quote: 'consume the Arts Reaction to fire an additional shot that deals massive Heat DMG' },
      { piece: 'ultimate', quote: 'dealing 5 hits of Heat DMG and forcibly applying Combustion' },
    ],
  },
  entries: [
    { id: 'heat-infliction', piece: 'battle-skill', quote: 'The final shot also applies Heat Infliction.', tag: 'Heat Infliction', gives: [], to: 'enemy', causes: ['heat-infliction', 'arts-infliction'], setup: 'Cast the Battle Skill (100 SP) on a target without Combustion or Electrification.' },
    {
      id: 'consume-reaction',
      piece: 'battle-skill',
      quote: 'If the target has active Combustion or Electrification, do not apply Heat Infliction but instead consume the Arts Reaction to fire an additional shot that deals massive Heat DMG.',
      tag: 'Extra shot on Combustion or Electrification',
      gives: [],
      to: 'self',
      reacts: ['combustion', 'electrification'],
      setup: 'Combustion or Electrification on the target when he casts the Battle Skill.',
    },
    {
      id: 'combo-on-infliction',
      piece: 'combo-skill',
      quote: 'COMBO TRIGGER: When an Arts Infliction is applied to an enemy.',
      tag: 'Combo on an Arts Infliction',
      gives: [],
      to: 'self',
      reacts: ['arts-infliction'],
      causes: ['heat-infliction', 'arts-infliction'],
      setup: 'Someone applies an Arts Infliction; his grenade then adds Heat Infliction.',
    },
    { id: 'forced-combustion', piece: 'ultimate', quote: 'dealing 5 hits of Heat DMG and forcibly applying Combustion', tag: 'Forced Combustion', gives: [], to: 'enemy', causes: ['combustion'], setup: 'Cast the Ultimate (90 Energy).' },
    { id: 'scorching-fangs', piece: 'talent-scorching-fangs', quote: 'While active, Wulfgard gains Heat DMG Dealt +30%.', tag: 'Heat DMG +30% (self)', gives: [{ stat: 'dmg', amount: '+30%' }], to: 'self', setup: 'He applies Combustion (his Ultimate does); lasts 10s.' },
    { id: 'sp-on-consume', piece: 'talent-code-of-restraint', quote: 'Whenever the battle skill Thermite Tracers successfully consumes an Arts Reaction, return 10 SP.', tag: '+10 SP', gives: [{ stat: 'sp', amount: '10' }], to: 'team', setup: 'His Battle Skill consumes Combustion or Electrification.' },
    { id: 'p2-sp', piece: 'potential-2', quote: 'Returns 10 additional SP.', tag: '+10 SP more', gives: [{ stat: 'sp', amount: '10' }], to: 'team', setup: 'His Battle Skill consumes Combustion or Electrification.' },
    {
      id: 'p3-team-fangs',
      piece: 'potential-3',
      quote: 'grants other teammates Scorching Fangs with 50% of the base effects',
      tag: 'Heat DMG +15% for the others',
      gives: [{ stat: 'dmg', amount: '+15% (half of +30%)' }],
      to: 'team',
      limits: { elements: ['heat'] },
      setup: 'Scorching Fangs is on and his Battle Skill consumes a reaction.',
    },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-forged': OWN_STAT,
    'potential-1': OWN_STAT,
    'potential-4': OWN_COST,
    'potential-5': 'His own combo cooldown.',
  },
};

const ember: CharacterSheet = {
  characterId: 'chr_0009_azrila',
  name: 'Ember',
  entries: [
    { id: 'knock-down', piece: 'battle-skill', quote: 'A leap followed by a heavy slam that deals Heat DMG, Knock Down, and Stagger to all enemies in a fan-shaped area.', tag: 'Knock Down', gives: [], to: 'enemy', causes: ['knock-down', 'vulnerable'], setup: 'Cast the Battle Skill (100 SP).' },
    { id: 'combo-knock-down', piece: 'combo-skill', quote: 'unleashes a heavy slam that deals Physical DMG and Knock Down', tag: 'Knock Down', gives: [], to: 'enemy', causes: ['knock-down', 'vulnerable'], setup: 'The controlled operator is attacked (her combo trigger).' },
    { id: 'combo-heal', piece: 'combo-skill', quote: 'giving HP treatment to the controlled operator', tag: 'Heals the controlled operator', gives: [{ stat: 'heal', amount: '675 + 1.58 per Will' }], to: 'controlled', setup: 'The controlled operator is attacked (her combo trigger).' },
    { id: 'shields', piece: 'ultimate', quote: "granting every teammate a Shield based on Ember's Max HP", tag: 'Team shields', gives: [{ stat: 'shield', amount: '25% of her Max HP' }], to: 'team', setup: 'Cast the Ultimate (100 Energy); shields last 10s.' },
    { id: 'p3-heal', piece: 'potential-3', quote: 'Restores the HP of another teammate with the lowest percentage HP at 50% of the base effect.', tag: 'Heals one more teammate', gives: [{ stat: 'heal', amount: '50% of the base effect' }], to: 'teammate', setup: 'Her combo skill heals.' },
    { id: 'p5-shield-atk', piece: 'potential-5', quote: 'while this shield is active, the wielder gains ATK +10%.', tag: 'ATK +10% with her shield', gives: [{ stat: 'atk', amount: '+10%' }], to: 'team', setup: 'Her Ultimate’s shield is up.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-inflamed-for-the-assault': 'Protects herself only.',
    'talent-pay-the-ferric-price': 'Her own ATK.',
    'talent-forged': OWN_STAT,
    'potential-1': 'Protects herself only.',
    'potential-2': OWN_STAT,
    'potential-4': OWN_COST,
  },
};

const yvonne: CharacterSheet = {
  characterId: 'chr_0017_yvonne',
  name: 'Yvonne',
  damage: {
    element: 'cryo',
    skills: ['ultimate', 'battle', 'combo'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'ultimate', quote: "When the skill is about to end, Yvonne's last enhanced BATK becomes an enhanced Final Strike that deals massive Cryo DMG." },
      { piece: 'battle-skill', quote: 'forcibly apply Solidification, and deal Cryo DMG to the target based on the number of stacks consumed' },
    ],
  },
  entries: [
    {
      id: 'bomb-consumes',
      piece: 'battle-skill',
      quote: 'If hitting an enemy with Cryo Infliction or Nature Infliction, then consume all Arts Infliction stacks, forcibly apply Solidification, and deal Cryo DMG to the target based on the number of stacks consumed.',
      tag: 'Solidification from Cryo or Nature Infliction',
      gives: [],
      to: 'self',
      reacts: ['cryo-infliction', 'nature-infliction'],
      causes: ['solidification'],
      setup: 'Cryo or Nature Infliction stacks on the enemy when she casts the Battle Skill (100 SP).',
    },
    {
      id: 'combo-on-solidification',
      piece: 'combo-skill',
      quote: 'COMBO TRIGGER: When the controlled operator performs a Final Strike on an enemy with Solidification.',
      tag: 'Combo on a Final Strike vs Solidification',
      gives: [],
      to: 'self',
      reacts: ['solidification'],
      causes: ['solidification'],
      setup: 'Solidification on the enemy (her Battle Skill applies it), then a Final Strike.',
    },
    { id: 'barrage', piece: 'talent-barrage-of-technology', quote: 'After applying Solidification, the next basic attack directly becomes a Final Strike with DMG Dealt +50%.', tag: 'Final Strike DMG +50% (self)', gives: [{ stat: 'dmg', amount: '+50%' }], to: 'self', setup: 'Her Battle Skill applies Solidification.' },
    {
      id: 'freezing-point',
      piece: 'talent-freezing-point',
      quote: 'Against enemies with active Cryo Infliction, gains Critical DMG Dealt +20%. Effect is doubled against enemies with Solidification.',
      tag: 'CRIT DMG +20% vs Cryo Infliction (self)',
      gives: [{ stat: 'crit-dmg', amount: '+20% (+40% vs Solidification)' }],
      to: 'self',
      reacts: ['cryo-infliction', 'solidification'],
      setup: 'Cryo Infliction or Solidification on the enemy.',
    },
    { id: 'p2-crit', piece: 'potential-2', quote: 'Critical Rate +7%.', tag: 'CRIT Rate +7% (self)', gives: [{ stat: 'crit-rate', amount: '+7%' }], to: 'self', setup: 'Nothing: always on.' },
    { id: 'p3-crit-dmg', piece: 'potential-3', quote: 'Against enemies with Cryo Infliction, Critical DMG Dealt +10%', tag: 'CRIT DMG +10% vs Cryo Infliction (self)', gives: [{ stat: 'crit-dmg', amount: '+10%' }], to: 'self', setup: 'Cryo Infliction on the enemy.' },
    { id: 'p4-sp', piece: 'potential-4', quote: 'If the explosion hits only one enemy, return 10 SP.', tag: '+10 SP', gives: [{ stat: 'sp', amount: '10' }], to: 'team', setup: 'Her Battle Skill hits only one enemy.' },
    { id: 'p5-ultimate', piece: 'potential-5', quote: 'During the ultimate, ATK +10% and Critical DMG Dealt +30%.', tag: 'ATK +10%, CRIT DMG +30% (self)', gives: [{ stat: 'atk', amount: '+10%' }, { stat: 'crit-dmg', amount: '+30%' }], to: 'self', setup: 'During her Ultimate.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    ultimate: 'Her own damage and CRIT buffs only.',
    'talent-keen-mind': OWN_STAT,
    'potential-1': 'Her own combo skill.',
  },
};

const lastRite: CharacterSheet = {
  characterId: 'chr_0026_lastrite',
  name: 'Last Rite',
  damage: {
    element: 'cryo',
    skills: ['ultimate', 'combo', 'battle'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'ultimate', quote: 'Each slash deals massive Cryo DMG.' },
      { piece: 'combo-skill', quote: 'The number of Cryo Infliction stacks consumed determines the amount of Cryo DMG dealt to the said enemy' },
    ],
  },
  entries: [
    { id: 'mirage-cryo', piece: 'battle-skill', quote: 'This attack deals Cryo DMG and applies Cryo Infliction.', tag: 'Cryo Infliction on the next Final Strike', gives: [], to: 'enemy', causes: ['cryo-infliction', 'arts-infliction'], setup: 'Cast the Battle Skill (100 SP), then the controlled operator performs a Final Strike within 15s.' },
    { id: 'battle-sp', piece: 'battle-skill', quote: "Performs a Hypothermic Perfusion on the controlled operator's weapon and returns some SP.", tag: '+30 SP', gives: [{ stat: 'sp', amount: '30' }], to: 'team', setup: 'Cast the Battle Skill.' },
    {
      id: 'combo-on-3-cryo',
      piece: 'combo-skill',
      quote: 'COMBO TRIGGER: When an enemy has 3 or more Cryo Infliction stacks.',
      tag: 'Combo at 3 Cryo Infliction stacks',
      gives: [],
      to: 'self',
      reacts: ['cryo-infliction'],
      setup: 'The team brings an enemy to 3 Cryo Infliction stacks.',
    },
    {
      id: 'cryo-susceptibility',
      piece: 'talent-hypothermia',
      quote: 'After Last Rite consumes any Arts Infliction, she applies Cryo Susceptibility to the target with the effect of [Number of Arts Infliction stacks consumed × 4%] for 15s.',
      tag: 'Cryo Susceptibility up to 16%',
      gives: [{ stat: 'susceptibility', amount: 'up to 16% (4% per stack consumed)' }],
      to: 'enemy',
      limits: { elements: ['cryo'] },
      causes: ['cryo-susceptibility'],
      noStack: 'last-rite-hypothermia',
      setup: 'Her combo skill consumes Cryo Infliction stacks; does not stack.',
    },
    { id: 'p1-extra-hit', piece: 'potential-1', quote: 'When the controlled operator with Hypothermic Perfusion performs a Final Strike that hits the enemy, it deals another 20% DMG and 5 Stagger.', tag: 'Extra 20% on the next Final Strike', gives: [{ stat: 'extra-hit', amount: '20%' }], to: 'controlled', setup: 'Her Battle Skill is on the controlled operator’s weapon.' },
    { id: 'p2-cryo', piece: 'potential-2', quote: 'Cryo DMG Dealt +10%.', tag: 'Cryo DMG +10% (self)', gives: [{ stat: 'dmg', amount: '+10%' }], to: 'self', setup: 'Nothing: always on.' },
    { id: 'p3-multiplier', piece: 'potential-3', quote: 'DMG multiplier increased to 1.15 times the original.', tag: 'Combo and Ultimate ×1.15 (self)', gives: [{ stat: 'dmg', amount: '×1.15' }], to: 'self', setup: 'Nothing: always on.' },
    { id: 'p5-sp', piece: 'potential-5', quote: 'Amount of SP returned is increased by another 5', tag: '+5 SP', gives: [{ stat: 'sp', amount: '5' }], to: 'team', setup: 'Cast the Battle Skill.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    ultimate: 'Her own damage only.',
    'talent-cryogenic-embrittlement': 'Her own Ultimate only.',
    'talent-forged': OWN_STAT,
    'potential-4': OWN_COST,
  },
};

const ardelia: CharacterSheet = {
  characterId: 'chr_0025_ardelia',
  name: 'Ardelia',
  entries: [
    {
      id: 'susceptibility',
      piece: 'battle-skill',
      quote: 'If the target has Corrosion, then consume the Corrosion and apply Physical Susceptibility and Arts Susceptibility to the target.',
      tag: 'Physical and Arts Susceptibility 20%',
      gives: [{ stat: 'susceptibility', amount: '20%' }],
      to: 'enemy',
      causes: ['physical-susceptibility', 'arts-susceptibility'],
      reacts: ['corrosion'],
      setup: 'Corrosion on the target when she casts the Battle Skill (her combo skill applies it); lasts 30s.',
    },
    {
      id: 'forced-corrosion',
      piece: 'combo-skill',
      quote: 'forcibly applying temporary Corrosion to nearby enemies',
      tag: 'Forced Corrosion',
      gives: [],
      to: 'enemy',
      causes: ['corrosion'],
      reacts: ['final-strike'],
      setup: 'The controlled operator performs a Final Strike on an enemy with no Vulnerability or Arts Infliction stacks (her combo trigger).',
    },
    { id: 'heal', piece: 'talent-friendly-presence', quote: "When the controlled operator touches a Shadow of Mr. Dolly, Ardelia restores the said operator's HP by [90 + Will×0.75].", tag: 'Heals the controlled operator', gives: [{ stat: 'heal', amount: '[90 + Will×0.75]' }], to: 'controlled', setup: 'The controlled operator touches a Shadow of Mr. Dolly (her Battle Skill leaves 3).' },
    { id: 'p1-susceptibility', piece: 'potential-1', quote: 'Consuming Corrosion now applies Physical Susceptibility and Arts Susceptibility with effects +8%.', tag: 'Susceptibility +8%', gives: [{ stat: 'susceptibility', amount: '+8%' }], to: 'enemy', setup: 'Her Battle Skill consumes Corrosion.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    ultimate: 'Her own damage; its Shadows of Mr. Dolly heal (counted with her talent).',
    'talent-mountainpeak-surfer': 'Casts her Battle Skill again: the Susceptibility is already counted.',
    'talent-keen-mind': OWN_STAT,
    'potential-2': 'More healing: already counted as team support.',
    'potential-3': 'Her own Ultimate.',
    'potential-4': OWN_COST,
    'potential-5': 'Her own combo skill; Corrosion lasts longer.',
  },
};

const gilberta: CharacterSheet = {
  characterId: 'chr_0013_aglina',
  name: 'Gilberta',
  entries: [
    { id: 'nature-infliction', piece: 'battle-skill', quote: 'the gravity well implodes to deal Nature DMG and Nature Infliction to enemies in the area of effect', tag: 'Nature Infliction', gives: [], to: 'enemy', causes: ['nature-infliction', 'arts-infliction'], setup: 'Cast the Battle Skill (100 SP) and let the channel end.' },
    {
      id: 'combo-lift',
      piece: 'combo-skill',
      quote: 'deals Nature DMG and forcibly Lifts the target and nearby enemies',
      tag: 'Forced Lift on an Arts Reaction',
      gives: [],
      to: 'enemy',
      reacts: ['arts-reaction'],
      causes: ['lift', 'vulnerable'],
      setup: 'Someone applies an Arts Reaction (her combo trigger).',
    },
    { id: 'ultimate-nature', piece: 'ultimate', quote: 'Creates an Anomalous Gravity Field that instantly deals 1 hit of Nature DMG and applies Nature Infliction to enemies caught in the field.', tag: 'Nature Infliction', gives: [], to: 'enemy', causes: ['nature-infliction', 'arts-infliction'], setup: 'Cast the Ultimate (90 Energy).' },
    {
      id: 'arts-susceptibility',
      piece: 'ultimate',
      quote: 'Targets in the Anomalous Gravity Field also suffer from Slow and Arts Susceptibility.',
      tag: 'Arts Susceptibility 30%',
      gives: [{ stat: 'susceptibility', amount: '30% (+3% per Vulnerable stack)' }],
      to: 'enemy',
      limits: { arts: true },
      causes: ['arts-susceptibility'],
      setup: 'Cast the Ultimate (90 Energy); the field lasts 5s.',
    },
    { id: 'energy', piece: 'talent-messenger-s-song', quote: 'When fighting in the battlefield, all allied guards, casters, and supporters gain Ultimate Gain Efficiency +7%.', tag: 'Ultimate Gain +7%', gives: [{ stat: 'ultimate-energy', amount: '+7%' }], to: 'team', setup: 'Guards, casters and supporters in the team.' },
    { id: 'heal', piece: 'talent-late-reply', quote: 'restores [108 + Intellect×0.90] HP to the controlled operator', tag: 'Heals the controlled operator', gives: [{ stat: 'heal', amount: '[108 + Intellect×0.90]' }], to: 'controlled', setup: 'Her combo skill or last Battle Skill sequence hits at least 2 enemies.' },
    {
      id: 'p2-susceptibility',
      piece: 'potential-2',
      quote: 'double the Arts Susceptibility increase per Vulnerability stack',
      tag: 'Arts Susceptibility +3% more per Vulnerable stack',
      gives: [{ stat: 'susceptibility', amount: '+3% per Vulnerable stack' }],
      to: 'enemy',
      limits: { arts: true },
      setup: 'Vulnerable stacks on enemies in her field.',
    },
    { id: 'p3-energy', piece: 'potential-3', quote: 'Ultimate Gain Efficiency +5%.', tag: 'Ultimate Gain +5% more', gives: [{ stat: 'ultimate-energy', amount: '+5%' }], to: 'team', setup: 'Guards, casters and supporters in the team.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-stalwart': OWN_STAT,
    'potential-1': 'A bigger area only.',
    'potential-4': OWN_COST,
    'potential-5': 'Her own combo skill.',
  },
};

export const groupB: CharacterSheet[] = [laevatain, akekuri, wulfgard, ember, yvonne, lastRite, ardelia, gilberta];
