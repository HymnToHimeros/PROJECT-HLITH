/**
 * Group E (E6e): Avywenna, Snowshine, Alesh, Estella, Fluorite, Purrchena. Read from data/kits.json
 * (endfield.wiki.gg, cited per kit) with the seven questions of docs/logic/endfield-method.md.
 * Every quote is word for word from the kit text. Effects that need luck are shown, never counted (decision 11).
 */
import type { CharacterSheet } from '../types';

const OWN_STAT = 'Their own attribute only.';
const OWN_COST = 'Their own Ultimate Energy cost or cooldown only.';
const OWN_ENERGY = 'Their own Ultimate Energy only.';

const avywenna: CharacterSheet = {
  characterId: 'chr_0012_avywen',
  name: 'Avywenna',
  damage: {
    element: 'electric',
    skills: ['ultimate', 'battle', 'combo'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'ultimate', quote: 'Throws a Thunderlance EX at the target area that deals massive Electric DMG to enemies nearby.' },
      { piece: 'battle-skill', quote: 'returning Thunderlances EX deal more Electric DMG and also apply Electric Infliction' },
    ],
  },
  entries: [
    { id: 'electric-infliction', piece: 'battle-skill', quote: 'returning Thunderlances EX deal more Electric DMG and also apply Electric Infliction', tag: 'Electric Infliction', gives: [], to: 'enemy', causes: ['electric-infliction', 'arts-infliction'], setup: 'Cast the Battle Skill (100 SP) with a Thunderlance EX out (her Ultimate throws one).' },
    {
      id: 'combo-trigger',
      piece: 'combo-skill',
      quote: 'COMBO TRIGGER: When controlled operator performs a Final Strike on a target with active Electric Infliction or Electrification.',
      tag: 'Combo on Electric Infliction or Electrification',
      gives: [],
      to: 'self',
      reacts: ['electric-infliction', 'electrification'],
      setup: 'Electric Infliction or Electrification on the target, then a Final Strike.',
    },
    { id: 'electric-susceptibility', piece: 'talent-tactful-approach', quote: 'Also applies 10% Electric Susceptibility for 10s to enemies it hits.', tag: 'Electric Susceptibility 10%', gives: [{ stat: 'susceptibility', amount: '10%' }], to: 'enemy', limits: { elements: ['electric'] }, causes: ['electric-susceptibility'], setup: 'Her Ultimate (100 Energy) hits.' },
    { id: 'p3-electric', piece: 'potential-3', quote: 'Electric DMG Dealt +8%.', tag: 'Electric DMG +8% (self)', gives: [{ stat: 'dmg', amount: '+8%' }], to: 'self', setup: 'Nothing: always on.' },
    { id: 'p5-susceptible', piece: 'potential-5', quote: 'When returning Thunderlances or Thunderlances EX hit an Electric Susceptible enemy, the DMG multipliers are increased to 1.15 times the original.', tag: 'Returning lances ×1.15 vs Electric Susceptibility (self)', gives: [{ stat: 'dmg', amount: '×1.15' }], to: 'self', reacts: ['electric-susceptibility'], setup: 'The enemy has Electric Susceptibility.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    ultimate: 'Her own damage; its Electric Susceptibility is listed with Tactful Approach.',
    'talent-expedited-delivery': OWN_ENERGY,
    'talent-stalwart': OWN_STAT,
    'potential-1': OWN_ENERGY,
    'potential-2': 'Her Thunderlances last longer.',
    'potential-4': OWN_COST,
  },
};

const snowshine: CharacterSheet = {
  characterId: 'chr_0014_aurora',
  name: 'Snowshine',
  entries: [
    { id: 'protection', piece: 'battle-skill', quote: 'grants Protection to self and nearby operators, and immediately returns some SP', tag: 'Protection 90% and SP', gives: [{ stat: 'protection', amount: '90%' }, { stat: 'sp', amount: '30' }], to: 'team', noStack: 'protection', setup: 'Cast the Battle Skill (100 SP); only the strongest Protection applies (wiki: Protection).' },
    { id: 'retaliation', piece: 'battle-skill', quote: 'perform a retaliation bash that deals Cryo DMG and applies Cryo Infliction on the attacker', tag: 'Cryo Infliction on retaliation', gives: [], to: 'enemy', causes: ['cryo-infliction', 'arts-infliction'], setup: 'An enemy attacks her while the shield is raised.' },
    { id: 'heal', piece: 'combo-skill', quote: 'the Assistant gives massive instant HP Treatment to nearby operators', tag: 'Heals nearby operators', gives: [{ stat: 'heal', amount: '216 + 0.5 per Will' }], to: 'team', setup: 'The controlled operator drops below 60% HP (her combo trigger).' },
    { id: 'solidification', piece: 'ultimate', quote: 'The Snow Zone forcibly applies Solidification to enemies caught within it for a certain duration.', tag: 'Forced Solidification', gives: [], to: 'enemy', causes: ['solidification'], setup: 'Cast the Ultimate (80 Energy).' },
    { id: 'p5-sp', piece: 'potential-5', quote: 'Successfully retaliating an enemy attack returns 10 SP.', tag: '+10 SP', gives: [{ stat: 'sp', amount: '10' }], to: 'team', setup: 'She retaliates against an attack.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-polar-survival': 'More healing: already counted as team support.',
    'talent-sar-professional': OWN_ENERGY,
    'talent-forged': OWN_STAT,
    'potential-1': 'Keeps Arts Inflictions off the team: protection, not a stat the check counts.',
    'potential-2': 'A bigger area only.',
    'potential-3': 'Her Solidification lasts longer.',
    'potential-4': OWN_STAT,
  },
};

const alesh: CharacterSheet = {
  characterId: 'chr_0024_deepfin',
  name: 'Alesh',
  entries: [
    {
      id: 'solidification',
      piece: 'battle-skill',
      quote: "Alesh consumes all of the target's Cryo Infliction stacks, forcibly applies Solidification to the target, and recovers some SP based on the number of stacks consumed",
      tag: 'Solidification from Cryo Infliction, and SP',
      gives: [{ stat: 'sp', amount: 'up to 45 (by stacks consumed)' }],
      to: 'team',
      reacts: ['cryo-infliction'],
      causes: ['solidification'],
      setup: 'Cryo Infliction on the target when he casts the Battle Skill (100 SP).',
    },
    { id: 'combo-sp', piece: 'combo-skill', quote: 'COMBO TRIGGER: When the Arts Reaction or Originium Crystals of a nearby target is consumed.', tag: '+15 SP when a reaction is consumed', gives: [{ stat: 'sp', amount: '15' }], to: 'team', reacts: ['arts-reaction'], setup: 'Someone consumes an Arts Reaction or Originium Crystals.' },
    { id: 'cryo-infliction', piece: 'ultimate', quote: 'deal Cryo DMG and apply Cryo Infliction to enemies in a large area of effect in front of him', tag: 'Cryo Infliction and SP', gives: [{ stat: 'sp', amount: '25 (more per target defeated)' }], to: 'team', causes: ['cryo-infliction', 'arts-infliction'], setup: 'Cast the Ultimate (100 Energy).' },
    { id: 'p1-sp', piece: 'potential-1', quote: 'SP Recovery grants an additional 10 SP.', tag: '+10 SP', gives: [{ stat: 'sp', amount: '10' }], to: 'team', setup: 'His Battle Skill consumes Cryo Infliction.' },
    { id: 'p3-team-atk', piece: 'potential-3', quote: 'After catching a Rare Fin, the entire team gains ATK +15% for 10s.', tag: 'Team ATK +15% after a Rare Fin', on: { unknown: 'only after his combo catches a Rare Fin, which is a chance' }, gives: [{ stat: 'atk', amount: '+15%' }], to: 'team', setup: 'His combo skill catches a Rare Fin (10% chance, more with Intellect).' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-flash-frozen-for-freshness': OWN_ENERGY,
    'talent-veteran-angler': 'His own Rare Fin chance.',
    'talent-forged': OWN_STAT,
    'potential-2': OWN_STAT,
    'potential-4': OWN_COST,
    'potential-5': 'His own damage.',
  },
};

const estella: CharacterSheet = {
  characterId: 'chr_0021_whiten',
  name: 'Estella',
  damage: {
    element: 'physical',
    skills: ['ultimate', 'combo'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'ultimate', quote: 'dealing Physical DMG to all enemies in a circular area around self' },
      { piece: 'combo-skill', quote: 'If the skill hits a target with Solidification, the skill deals additional DMG and applies Physical Susceptibility.' },
    ],
  },
  entries: [
    { id: 'cryo-infliction', piece: 'battle-skill', quote: 'fires a stream of freezing sound waves that deal Cryo DMG and apply Cryo Infliction to all enemies along its straight path', tag: 'Cryo Infliction', gives: [], to: 'enemy', causes: ['cryo-infliction', 'arts-infliction'], setup: 'Cast the Battle Skill (100 SP).' },
    {
      id: 'combo-on-solidification',
      piece: 'combo-skill',
      quote: 'COMBO TRIGGER: When an enemy suffers Solidification.',
      tag: 'Combo on Solidification',
      gives: [],
      to: 'self',
      reacts: ['solidification'],
      causes: ['lift', 'vulnerable'],
      setup: 'Someone applies Solidification: Cryo Infliction on top of another element’s, or a forced one.',
    },
    { id: 'physical-susceptibility', piece: 'combo-skill', quote: 'If the skill hits a target with Solidification, the skill deals additional DMG and applies Physical Susceptibility.', tag: 'Physical Susceptibility 15%', gives: [{ stat: 'susceptibility', amount: '15%' }], to: 'enemy', limits: { elements: ['physical'] }, causes: ['physical-susceptibility'], setup: 'Her combo skill hits a Solidified target; lasts 6s.' },
    { id: 'ultimate-lift', piece: 'ultimate', quote: 'To enemies with Physical Susceptibility, the skill forcibly applies Lift to them.', tag: 'Forced Lift on Physical Susceptibility', gives: [], to: 'enemy', reacts: ['physical-susceptibility'], causes: ['lift', 'vulnerable'], setup: 'Cast the Ultimate (70 Energy) on enemies with Physical Susceptibility.' },
    { id: 'shatter-sp', piece: 'talent-commiseration', quote: 'When triggering Shatter, the next battle skill Onomatopoeia cast returns 15 SP.', tag: '+15 SP after a Shatter', gives: [{ stat: 'sp', amount: '15' }], to: 'team', setup: 'She triggers Shatter (a Physical Status on a Solidified enemy).' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-laziness-pays-off-now': 'Protects herself only.',
    'talent-stalwart': OWN_STAT,
    'potential-1': 'Her Physical Susceptibility lasts longer.',
    'potential-2': OWN_COST,
    'potential-3': 'Her own Battle Skill.',
    'potential-4': OWN_STAT,
    'potential-5': OWN_ENERGY,
  },
};

const fluorite: CharacterSheet = {
  characterId: 'chr_0022_bounda',
  name: 'Fluorite',
  damage: {
    element: 'nature',
    skills: ['battle', 'ultimate'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'battle-skill', quote: 'The explosion deals Nature DMG and Nature Infliction to enemies in the area of effect.' },
      { piece: 'ultimate', quote: 'rapidly fires at the target within the arc to deal 4 sequences of Nature DMG' },
    ],
  },
  entries: [
    { id: 'nature-infliction', piece: 'battle-skill', quote: 'The explosion deals Nature DMG and Nature Infliction to enemies in the area of effect.', tag: 'Nature Infliction', gives: [], to: 'enemy', causes: ['nature-infliction', 'arts-infliction'], setup: 'Cast the Battle Skill (100 SP).' },
    {
      id: 'combo-repeat',
      piece: 'combo-skill',
      quote: 'COMBO TRIGGER: When an enemy has 2 or more stacks of Cryo Infliction or Nature Infliction.',
      tag: 'Repeats a Cryo or Nature Infliction',
      gives: [],
      to: 'enemy',
      reacts: ['cryo-infliction', 'nature-infliction'],
      causes: ['arts-infliction'],
      setup: 'The team puts 2 Cryo or Nature Infliction stacks on an enemy.',
    },
    { id: 'ultimate-repeat', piece: 'ultimate', quote: 'If the final DMG sequence hits a target with at least 2 stacks of Cryo Infliction or Nature Infliction, then apply the same Arts Infliction again.', tag: 'Repeats a Cryo or Nature Infliction', gives: [], to: 'enemy', causes: ['arts-infliction'], setup: 'Cast the Ultimate (100 Energy) on a target with 2 Cryo or Nature Infliction stacks.' },
    { id: 'vs-slowed', piece: 'talent-love-the-stab-and-twist', quote: 'Fluorite gains DMG Dealt +20% against Slowed targets.', tag: 'DMG +20% vs Slowed (self)', gives: [{ stat: 'dmg', amount: '+20%' }], to: 'self', setup: 'Her Battle Skill Slows the target.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-unpredictable': 'Protects herself, and her own ATK.',
    'talent-skirmisher': OWN_STAT,
    'potential-1': OWN_STAT,
    'potential-2': 'Protects herself only.',
    'potential-3': 'A wider Slow only.',
    'potential-4': OWN_COST,
    'potential-5': 'Her own combo cooldown.',
  },
};

const purrchena: CharacterSheet = {
  characterId: 'chr_0038_purrche',
  name: 'Purrchena',
  entries: [
    { id: 'protection', piece: 'battle-skill', quote: "While Purrchena's shield is up, she grants Protection to herself and nearby operators.", tag: 'Protection 90%', gives: [{ stat: 'protection', amount: '90%' }], to: 'team', noStack: 'protection', setup: 'Cast the Battle Skill (100 SP); only the strongest Protection applies (wiki: Protection).' },
    { id: 'sp', piece: 'battle-skill', quote: 'Purrchena raises up her shield to block an attack and immediately returns some SP.', tag: '+20 SP', gives: [{ stat: 'sp', amount: '20 (40 after a block)' }], to: 'team', setup: 'Cast the Battle Skill.' },
    { id: 'nature-infliction', piece: 'battle-skill', quote: 'Purrchena headbutts a target in front of her to deal Nature DMG and apply Nature Infliction.', tag: 'Nature Infliction', gives: [], to: 'enemy', causes: ['nature-infliction', 'arts-infliction'], setup: 'Cast LEAVE MY FRIENDS ALONE! (her Battle Skill’s second cast).' },
    { id: 'heal', piece: 'combo-skill', quote: 'granting HP Treatment to nearby operators', tag: 'Heals nearby operators', gives: [{ stat: 'heal', amount: '486 + 1.13 per Will' }], to: 'team', setup: 'The controlled operator is attacked (her combo trigger).' },
    { id: 'ambassador', piece: 'ultimate', quote: "There is a chance that the Prezzie reveals Ambassador's Special that applies Arts Susceptibility", tag: 'Arts Susceptibility 2.5% (by chance)', on: { unknown: 'only when a Prezzie reveals Ambassador’s Special, which is a chance' }, gives: [{ stat: 'susceptibility', amount: '2.5%' }], to: 'enemy', limits: { arts: true }, setup: 'Cast the Ultimate (100 Energy); a 20% chance per Prezzie.' },
    { id: 'next-hit', piece: 'talent-ambassador-s-duty', quote: 'all Max HP operators in the team take 50% less DMG from the next hit taken', tag: 'Next hit −50%', gives: [{ stat: 'protection', amount: '50% (one hit)' }], to: 'team', setup: 'When she is deployed; once every 90s per operator.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-your-sorry-came-late': 'Her own Ultimate Energy and Ambassador’s Special chance.',
    'talent-forged': OWN_STAT,
    'potential-1': 'A better chance of Ambassador’s Special, which is luck: not counted.',
    'potential-2': OWN_STAT,
    'potential-3': 'Her own combo skill and healing.',
    'potential-4': OWN_COST,
    'potential-5': 'A bigger Arts Susceptibility from Ambassador’s Special, which is luck: not counted.',
  },
};

export const groupE: CharacterSheet[] = [avywenna, snowshine, alesh, estella, fluorite, purrchena];
