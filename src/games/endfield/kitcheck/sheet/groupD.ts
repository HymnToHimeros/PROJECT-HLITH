/**
 * Group D (E6e): Pogranichnik, Rossi, Zhuang Fangyi, Perlica, Arclight, Xaihi. Read from data/kits.json
 * (endfield.wiki.gg, cited per kit) with the seven questions of docs/logic/endfield-method.md.
 * Every quote is word for word from the kit text.
 */
import type { CharacterSheet } from '../types';

const OWN_STAT = 'Their own attribute only.';
const OWN_COST = 'Their own Ultimate Energy cost or cooldown only.';

const pogranichnik: CharacterSheet = {
  characterId: 'chr_0029_pograni',
  name: 'Pogranichnik',
  entries: [
    { id: 'breach', piece: 'battle-skill', quote: 'dealing Physical DMG, applying Breach, and recovering SP based on the number of Vulnerability stacks consumed', tag: 'Breach and SP', gives: [{ stat: 'sp', amount: 'up to 35 (by stacks consumed)' }], to: 'team', causes: ['breach', 'vulnerable'], setup: 'Cast the Battle Skill (100 SP). On an enemy that is not Vulnerable, Breach adds a Vulnerable stack instead.' },
    { id: 'combo-sp', piece: 'combo-skill', quote: "COMBO TRIGGER: When Crush or Breach consumes the enemy's Vulnerability stack(s).", tag: 'SP when Crush or Breach consumes stacks', gives: [{ stat: 'sp', amount: 'up to 35 (by stacks consumed)' }], to: 'team', reacts: ['crush', 'breach'], setup: 'Someone’s Crush or Breach consumes Vulnerable stacks (his own Breach does).' },
    { id: 'shieldguards', piece: 'ultimate', quote: "After an enemy suffers a Physical Status or takes DMG from Pogranichnik's combo skill, Pogranichnik consumes 1 point of Steel Oath and summons 1 Shieldguard to harass the said enemy, dealing Physical DMG and recovering some SP.", tag: 'SP from Physical Statuses', gives: [{ stat: 'sp', amount: '10 per Shieldguard, 40 at the end' }], to: 'team', reacts: ['physical-status'], setup: 'Cast the Ultimate (90 Energy), then the team applies Physical Statuses.' },
    {
      id: 'team-morale',
      piece: 'talent-tactical-instruction',
      quote: "Any operator triggering the ultimate's subsequent effects also gains Fervent Morale for 10s.",
      tag: 'Fervent Morale: ATK +8%, Arts Intensity +8',
      gives: [
        { stat: 'atk', amount: '+8%' },
        { stat: 'arts-intensity', amount: '+8' },
      ],
      to: 'team',
      setup: 'During his Ultimate, an operator applies a Physical Status (Fervent Morale: "ATK +8% and Arts Intensity +8").',
    },
    { id: 'p1-sp', piece: 'potential-1', quote: 'When hitting at least 2 enemies, 15 SP is returned.', tag: '+15 SP', gives: [{ stat: 'sp', amount: '15' }], to: 'team', setup: 'His Battle Skill hits 2 or more enemies.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-the-living-banner': 'Fervent Morale on himself, from his own SP (the team’s is counted with Tactical Instruction).',
    'talent-stalwart': OWN_STAT,
    'potential-2': 'His own damage.',
    'potential-3': 'Fervent Morale on himself.',
    'potential-4': OWN_COST,
    'potential-5': 'More SP from his combo skill: already counted as team support.',
  },
};

const rossi: CharacterSheet = {
  characterId: 'chr_0028_wulfa',
  name: 'Rossi',
  damage: {
    element: 'physical',
    skills: ['combo', 'ultimate', 'battle'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'combo-skill', quote: 'deals Physical DMG based on the number of Arts Infliction stacks consumed' },
      { piece: 'battle-skill', quote: 'Charges to the target to deal Physical DMG and apply Lift.' },
    ],
  },
  entries: [
    { id: 'lift', piece: 'battle-skill', quote: 'Charges to the target to deal Physical DMG and apply Lift.', tag: 'Lift', gives: [], to: 'enemy', causes: ['lift', 'vulnerable'], setup: 'Cast the Battle Skill (100 SP).' },
    { id: 'wolven-ambrage', piece: 'battle-skill', quote: 'If the target already has Vulnerability stack(s), the skill also unleashes a Wolven Ambrage that charges at the target to deal Heat DMG.', tag: 'Wolven Ambrage on a Vulnerable enemy', gives: [], to: 'self', reacts: ['vulnerable'], setup: 'The target already has Vulnerable stacks.' },
    {
      id: 'combo-trigger',
      piece: 'combo-skill',
      quote: 'COMBO TRIGGER: When an enemy has both Vulnerability and Arts Infliction stacks.',
      tag: 'Combo on Vulnerable and an Arts Infliction',
      gives: [],
      to: 'self',
      reacts: ['vulnerable', 'arts-infliction'],
      causes: ['lift', 'vulnerable'],
      setup: 'The enemy has Vulnerable stacks and an Arts Infliction (each can come from a teammate).',
    },
    { id: 'combo-crit', piece: 'combo-skill', quote: "buffs Rossi's Critical Rate and Critical DMG Dealt at the same time", tag: 'CRIT Rate +25%, CRIT DMG +50% (self)', gives: [{ stat: 'crit-rate', amount: '+25%' }, { stat: 'crit-dmg', amount: '+50%' }], to: 'self', setup: 'Her combo’s second sequence; lasts 15s.' },
    { id: 'ultimate-heat', piece: 'ultimate', quote: 'deals massive Heat DMG and applies Heat Infliction', tag: 'Heat Infliction', gives: [], to: 'enemy', causes: ['heat-infliction', 'arts-infliction'], setup: 'Cast the Ultimate (110 Energy).' },
    {
      id: 'razor-clawmark',
      piece: 'talent-nicks-and-scratches',
      quote: 'suffers Physical DMG Taken and Heat DMG Taken +12%',
      tag: 'Physical and Heat DMG Taken +12%',
      gives: [{ stat: 'dmg-taken', amount: '+12%' }],
      to: 'enemy',
      limits: { elements: ['physical', 'heat'] },
      setup: 'Her Wolven Ambrage hits (a Vulnerable target); lasts 25s.',
    },
    { id: 'p1-multiplier', piece: 'potential-1', quote: 'The DMG Multipliers of these skills are increased to 1.15 times of the original.', tag: 'Battle and combo ×1.15 (self)', gives: [{ stat: 'dmg', amount: '×1.15' }], to: 'self', setup: 'Nothing: always on.' },
    { id: 'p1-sp', piece: 'potential-1', quote: 'Wolven Ambrage of the battle skill also returns 10 SP after hitting the enemy.', tag: '+10 SP', gives: [{ stat: 'sp', amount: '10' }], to: 'team', setup: 'Her Wolven Ambrage hits.' },
    { id: 'p2-crit', piece: 'potential-2', quote: 'Critical Rate +7%.', tag: 'CRIT Rate +7% (self)', gives: [{ stat: 'crit-rate', amount: '+7%' }], to: 'self', setup: 'Nothing: always on.' },
    { id: 'p5-ultimate', piece: 'potential-5', quote: 'Critical DMG Dealt is increased by +30%.', tag: 'Ultimate CRIT DMG +30% (self)', gives: [{ stat: 'crit-dmg', amount: '+30%' }], to: 'self', setup: 'Her Ultimate.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-seething-blood': 'Her own extra hits and healing.',
    'talent-skirmisher': OWN_STAT,
    'potential-3': 'Her own extra hits.',
    'potential-4': OWN_COST,
  },
};

const zhuangFangyi: CharacterSheet = {
  characterId: 'chr_0030_zhuangfy',
  name: 'Zhuang Fangyi',
  damage: {
    element: 'electric',
    skills: ['battle', 'combo', 'ultimate'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'battle-skill', quote: 'with the final Thunder Strike dealing 6 times the DMG' },
      { piece: 'combo-skill', quote: 'Zhuang Fangyi creates a Xiranblitz Array that attacks the enemy and deals Electric DMG.' },
    ],
  },
  entries: [
    { id: 'consume-electrification', piece: 'battle-skill', quote: "Consumes the target's Electrification to increase the DMG multiplier of this battle skill", tag: 'Stronger on Electrification', gives: [], to: 'self', reacts: ['electrification'], setup: 'Electrification on the target when she casts the Battle Skill.' },
    {
      id: 'combo-electrification',
      piece: 'combo-skill',
      quote: "COMBO TRIGGER: When the controlled operator's Final Strike or Finisher hits an enemy with Electric Infliction.",
      tag: 'Combo on Electric Infliction; forces Electrification',
      gives: [],
      to: 'self',
      reacts: ['electric-infliction'],
      causes: ['electrification'],
      setup: 'Electric Infliction on the enemy, then a Final Strike or Finisher.',
    },
    { id: 'ultimate-infliction', piece: 'ultimate', quote: 'the final Thunder Strike also applies Electric Infliction to the target hit', tag: 'Electric Infliction', gives: [], to: 'enemy', causes: ['electric-infliction', 'arts-infliction'], setup: 'Cast the Battle Skill during her Ultimate (240 Energy).' },
    { id: 'electric-amp', piece: 'talent-force-of-nature', quote: 'Casting the battle skill grants Zhuang Fangyi 18% Electric Amp for 5s.', tag: 'Electric Amp 18% (self)', gives: [{ stat: 'amp', amount: '18%' }], to: 'self', setup: 'Cast the Battle Skill.' },
    { id: 'p1-multiplier', piece: 'potential-1', quote: 'DMG multiplier is increased to 1.15 times the original.', tag: 'Battle Skill ×1.15 (self)', gives: [{ stat: 'dmg', amount: '×1.15' }], to: 'self', setup: 'Nothing: always on.' },
    { id: 'p2-battle', piece: 'potential-2', quote: 'Battle Skill DMG Dealt +15%.', tag: 'Battle Skill DMG +15% (self)', gives: [{ stat: 'dmg', amount: '+15%' }], to: 'self', limits: { skills: ['battle'] }, setup: 'Nothing: always on.' },
    { id: 'p3-sp', piece: 'potential-3', quote: 'After consuming Electrification, the battle skill returns 10 SP.', tag: '+10 SP', gives: [{ stat: 'sp', amount: '10' }], to: 'team', setup: 'Her Battle Skill consumes Electrification.' },
    { id: 'p5-res-ignore', piece: 'potential-5', quote: "DMG Dealt by Zhuang Fangyi ignores 15 of the enemy's Electric Resistance.", tag: 'Ignores 15 Electric RES (self)', gives: [{ stat: 'res-ignore', amount: '15' }], to: 'self', setup: 'During her Ultimate.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-ordained-by-heaven': 'Protects and heals herself only.',
    'talent-stalwart': OWN_STAT,
    'potential-4': OWN_COST,
  },
};

const perlica: CharacterSheet = {
  characterId: 'chr_0004_pelica',
  name: 'Perlica',
  damage: {
    element: 'electric',
    skills: ['ultimate', 'battle', 'combo'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'ultimate', quote: 'All enemies in the area of effect suffer massive Electric DMG.' },
      { piece: 'battle-skill', quote: 'Unleashes a bolt of electro-magnetic energy that deals Electric DMG and Electric Infliction to enemies in a small area.' },
    ],
  },
  entries: [
    { id: 'electric-infliction', piece: 'battle-skill', quote: 'Unleashes a bolt of electro-magnetic energy that deals Electric DMG and Electric Infliction to enemies in a small area.', tag: 'Electric Infliction', gives: [], to: 'enemy', causes: ['electric-infliction', 'arts-infliction'], setup: 'Cast the Battle Skill (100 SP).' },
    { id: 'forced-electrification', piece: 'combo-skill', quote: 'dealing Electric DMG and forcibly inflicting temporary Electrification', tag: 'Forced Electrification', gives: [], to: 'enemy', causes: ['electrification'], reacts: ['final-strike'], setup: 'The controlled operator performs a Final Strike (her combo trigger).' },
    { id: 'staggered', piece: 'talent-obliteration-protocol', quote: 'DMG Dealt +30% to Staggered enemies.', tag: 'DMG +30% vs Staggered (self)', gives: [{ stat: 'dmg', amount: '+30%' }], to: 'self', reacts: ['stagger'], setup: 'The enemy is Staggered.' },
    { id: 'chain-on-vulnerable', piece: 'talent-cycle-protocol', quote: 'When hitting a Vulnerable enemy, the hit chains 1 more time.', tag: 'Combo chains once more on a Vulnerable enemy', gives: [], to: 'self', reacts: ['vulnerable'], setup: 'The enemy is Vulnerable when her combo skill hits.' },
    { id: 'p3-atk', piece: 'potential-3', quote: 'After Perlica applies Electrification to the enemy, she gains ATK +20% for 5s. This effect can reach 2 stacks.', tag: 'ATK +20% per stack (self)', gives: [{ stat: 'atk', amount: '+20% per stack, up to 2' }], to: 'self', setup: 'She applies Electrification.' },
    { id: 'p5-crit', piece: 'potential-5', quote: 'Critical Rate +30%.', tag: 'Ultimate CRIT Rate +30% (self)', gives: [{ stat: 'crit-rate', amount: '+30%' }], to: 'self', setup: 'Her Ultimate.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    ultimate: 'Her own damage.',
    'talent-keen-mind': OWN_STAT,
    'potential-1': 'Her Electrification lasts longer.',
    'potential-2': OWN_COST,
    'potential-4': 'Makes her Electrification stronger: Electrification’s own Arts DMG Taken isn’t counted by the check yet.',
  },
};

const arclight: CharacterSheet = {
  characterId: 'chr_0007_ikut',
  name: 'Arclight',
  entries: [
    { id: 'battle-sp', piece: 'battle-skill', quote: 'If the enemy has active Electrification, consume the Electrification to unleash an additional attack that deals Electric DMG and recovers some SP.', tag: '+40 SP on Electrification', gives: [{ stat: 'sp', amount: '40' }], to: 'team', reacts: ['electrification'], setup: 'Electrification on the enemy when she casts the Battle Skill (100 SP).' },
    { id: 'combo-sp', piece: 'combo-skill', quote: "COMBO TRIGGER: When an enemy suffers Electrification or after an enemy's Electrification is consumed.", tag: '+10 SP on Electrification', gives: [{ stat: 'sp', amount: '10' }], to: 'team', reacts: ['electrification'], setup: 'Someone applies or consumes Electrification.' },
    { id: 'electric-infliction', piece: 'ultimate', quote: 'deal Electric DMG and apply Electric Infliction to all enemies in the path', tag: 'Electric Infliction', gives: [], to: 'enemy', causes: ['electric-infliction', 'arts-infliction'], setup: 'Cast the Ultimate (90 Energy).' },
    { id: 'forced-electrification', piece: 'ultimate', quote: 'If the enemy has active Electric Infliction, consume the Electric Infliction and forcibly apply Electrification.', tag: 'Forced Electrification', gives: [], to: 'enemy', causes: ['electrification'], setup: 'Her Ultimate’s lingering arcs explode on an enemy with Electric Infliction (her own dash applies it).' },
    { id: 'team-electric', piece: 'talent-wildland-trekker', quote: "grants the team Electric DMG Dealt +0.08% for every point of Arclight's Intellect", tag: 'Team Electric DMG (grows with Intellect)', gives: [{ stat: 'dmg', amount: 'Intellect × 0.08%' }], to: 'team', limits: { elements: ['electric'] }, setup: 'Her Battle Skill’s additional attack triggers 3 times (each needs Electrification); lasts 15s.' },
    { id: 'p1-sp', piece: 'potential-1', quote: 'After triggering additional effects, the skill recovers another 10 SP.', tag: '+10 SP', gives: [{ stat: 'sp', amount: '10' }], to: 'team', setup: 'Her Battle Skill’s additional attack.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-hannabit-wisdom': 'Protects herself only.',
    'talent-skirmisher': OWN_STAT,
    'potential-2': OWN_STAT,
    'potential-3': 'Her team Electric DMG ×1.3: its size grows with her Intellect, so it isn’t sized on its own (counted once, above).',
    'potential-4': OWN_COST,
    'potential-5': 'Her team Electric DMG comes sooner: already counted.',
  },
};

const xaihi: CharacterSheet = {
  characterId: 'chr_0011_seraph',
  name: 'Xaihi',
  entries: [
    { id: 'crystal-heal', piece: 'battle-skill', quote: "After the controlled operator performs a Final Strike on the enemy, the Auxiliary Crystal will restore the said operator's HP.", tag: 'Heals the controlled operator', gives: [{ stat: 'heal', amount: '324 + 0.76 per Will, twice' }], to: 'controlled', setup: 'Cast the Battle Skill (100 SP); the controlled operator performs Final Strikes.' },
    { id: 'crystal-amp', piece: 'battle-skill', quote: 'grant the said operator a temporary Arts Amp as well', tag: 'Arts Amp 15% for the controlled operator', gives: [{ stat: 'amp', amount: '15%' }], to: 'controlled', limits: { arts: true }, setup: 'The controlled operator is at Max HP when her crystal heals; lasts 25s.' },
    { id: 'cryo-infliction', piece: 'combo-skill', quote: 'Quickly charges up the Auxiliary Crystal and launches it at the enemy to deal Cryo DMG and Cryo Infliction.', tag: 'Cryo Infliction', gives: [], to: 'enemy', causes: ['cryo-infliction', 'arts-infliction'], setup: 'Her crystal uses up its heals (her combo trigger).' },
    { id: 'amp', piece: 'ultimate', quote: 'Applies temporary Cryo Amp and Nature Amp to the entire team.', tag: 'Cryo and Nature Amp 24%', gives: [{ stat: 'amp', amount: '24% (more with Intellect)' }], to: 'team', limits: { elements: ['cryo', 'nature'] }, setup: 'Cast the Ultimate (80 Energy); lasts 12s.' },
    { id: 'cryo-dmg-taken', piece: 'talent-execute-process', quote: 'Hitting an enemy with Cryo Infliction or Solidification also causes the enemy to suffer Cryo DMG Taken +10% for 5s.', tag: 'Cryo DMG Taken +10%', gives: [{ stat: 'dmg-taken', amount: '+10%' }], to: 'enemy', limits: { elements: ['cryo'] }, setup: 'Her combo skill hits an enemy with Cryo Infliction or Solidification.' },
    { id: 'p1-amp', piece: 'potential-1', quote: 'Arts Amp granted by the Auxiliary Crystal is increased by another 5%.', tag: 'Arts Amp +5% more', gives: [{ stat: 'amp', amount: '+5%' }], to: 'controlled', limits: { arts: true }, setup: 'Her crystal’s Arts Amp is on.' },
    { id: 'p5-amp', piece: 'potential-5', quote: 'Amp effect is increased to 1.1 times the original.', tag: 'Amp ×1.1 (+2.4%)', gives: [{ stat: 'amp', amount: '+2.4% (24% × 1.1)' }], to: 'team', limits: { elements: ['cryo', 'nature'] }, setup: 'Her Ultimate is on.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-freeze-protocol': 'Clears Cryo Infliction and Solidification from the team: protection, not a stat the check counts.',
    'talent-stalwart': OWN_STAT,
    'potential-2': OWN_COST,
    'potential-3': 'Her own combo skill hits one more enemy.',
    'potential-4': 'Her own attribute and healing.',
  },
};

export const groupD: CharacterSheet[] = [pogranichnik, rossi, zhuangFangyi, perlica, arclight, xaihi];
