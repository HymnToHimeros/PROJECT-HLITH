/**
 * Group C (E6d): what players pull for now (MANAGER's order): Si, Tangtang, Typhoeus, Liino, Arcane, Camille, Mi Fu.
 * Read from data/kits.json (endfield.wiki.gg, cited per kit) with the seven questions of docs/logic/endfield-method.md.
 * Every quote is word for word from the kit text.
 */
import type { CharacterSheet, Condition } from '../types';

const OWN_STAT = 'Their own attribute only.';
const OWN_COST = 'Their own Ultimate Energy cost or cooldown only.';
const LINK = '+30% (next Battle Skill; +20% for an Ultimate, wiki: Link)';
const NOT_A_STAT = 'not a stat the check counts';

const si: CharacterSheet = {
  characterId: 'chr_0036_jsspsi',
  name: 'Si',
  entries: [
    {
      id: 'cryo-infliction',
      piece: 'battle-skill',
      quote: 'Si deals Cryo DMG and applies Artful Intent, Immobilization, and Cryo Infliction',
      tag: 'Cryo Infliction',
      on: { lead: { elements: ['heat'], not: true, words: 'the operator in Team Position 01 (the damage dealer) is not Heat' } },
      gives: [],
      to: 'enemy',
      causes: ['cryo-infliction', 'arts-infliction'],
      setup: 'Cast the Battle Skill (100 SP).',
    },
    {
      id: 'heat-infliction',
      piece: 'battle-skill',
      quote: '(or Heat Infliction if a Heat element operator is in Team Position 01)',
      tag: 'Heat Infliction with a Heat lead',
      on: { lead: { elements: ['heat'], words: 'a Heat operator is in Team Position 01 (the damage dealer)' } },
      gives: [],
      to: 'enemy',
      causes: ['heat-infliction', 'arts-infliction'],
      setup: 'Cast the Battle Skill (100 SP) with a Heat operator in Team Position 01.',
    },
    {
      id: 'artful-intent',
      piece: 'battle-skill',
      quote: 'When the duration of Artful Intent ends, it bursts and deals Fixed DMG equal to the DMG recorded.',
      tag: 'Bursts recorded DMG as Fixed DMG',
      gives: [{ stat: 'own-damage', amount: '13% of the DMG taken, as Fixed DMG' }],
      to: 'enemy',
      setup: 'The team damages the enemy with Artful Intent for 20s.',
    },
    { id: 'amp', piece: 'ultimate', quote: 'grants temporary Cryo Amp and Heat Amp to the entire team', tag: 'Cryo and Heat Amp 36%', gives: [{ stat: 'amp', amount: '36%' }], to: 'team', limits: { elements: ['cryo', 'heat'] }, setup: 'Cast the Ultimate (80 Energy); lasts 12s.' },
    { id: 'p3-amp', piece: 'potential-3', quote: 'Amp effect is increased to 1.2 times the original.', tag: 'Amp ×1.2 (+7.2%)', gives: [{ stat: 'amp', amount: '+7.2% (36% × 1.2)' }], to: 'team', limits: { elements: ['cryo', 'heat'] }, setup: 'Her Ultimate is on.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'combo-skill': 'Her own damage, after someone consumes or absorbs Cryo or Heat Infliction.',
    'talent-proxy-s-patronage': `A shorter combo cooldown for Team Position 01: ${NOT_A_STAT}.`,
    'talent-unsoiled-brush': `Haste for the team: ${NOT_A_STAT}.`,
    'talent-keen-mind': OWN_STAT,
    'potential-1': 'Her own Fixed DMG burst.',
    'potential-2': 'Her own ATK.',
    'potential-4': OWN_COST,
    'potential-5': 'Her own combo skill.',
  },
};

const tangtang: CharacterSheet = {
  characterId: 'chr_0027_tangtang',
  name: 'Tangtang',
  damage: {
    element: 'cryo',
    skills: ['battle', 'ultimate', 'combo'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'battle-skill', quote: 'DMG dealt by the Waterspout is treated as Battle Skill DMG.' },
      { piece: 'ultimate', quote: 'a rogue wave comes crashing down to deal massive Cryo DMG to enemies in its AOE' },
    ],
  },
  entries: [
    { id: 'cryo-infliction', piece: 'battle-skill', quote: 'Applies 1 stack of Cryo Infliction on enemies within range and deals Cryo DMG over time.', tag: 'Cryo Infliction', gives: [], to: 'enemy', causes: ['cryo-infliction', 'arts-infliction'], setup: 'Cast the Battle Skill (100 SP).' },
    {
      id: 'arts-susceptibility',
      piece: 'battle-skill',
      quote: 'If the battle skill creates multiple Waterspouts, they also apply Arts Susceptibility to enemies',
      tag: 'Arts Susceptibility up to 10%',
      gives: [{ stat: 'susceptibility', amount: '5%/10% with 2/3 Waterspouts' }],
      to: 'enemy',
      limits: { arts: true },
      causes: ['arts-susceptibility'],
      setup: 'Whirlpools nearby (her combo skill makes them) when she casts the Battle Skill; lasts 15s.',
    },
    { id: 'whirlpool-sp', piece: 'battle-skill', quote: 'return some SP based on the number of Waterspouts created', tag: '+20 SP per Whirlpool', gives: [{ stat: 'sp', amount: '20 per Whirlpool' }], to: 'team', setup: 'Whirlpools nearby when she casts the Battle Skill.' },
    {
      id: 'combo-on-cryo',
      piece: 'combo-skill',
      quote: 'COMBO TRIGGER: When applying Cryo Infliction or dealing Arts Burst DMG to an enemy.',
      tag: 'Combo on Cryo Infliction or an Arts Burst',
      gives: [],
      to: 'self',
      reacts: ['cryo-infliction', 'arts-burst'],
      setup: 'Cryo Infliction is applied or an Arts Burst deals DMG; her combo then makes a Whirlpool.',
    },
    { id: 'p1-sp', piece: 'potential-1', quote: 'For every Whirlpool consumed and converted into a Waterspout, return 5 additional SP.', tag: '+5 SP per Whirlpool', gives: [{ stat: 'sp', amount: '5 per Whirlpool' }], to: 'team', setup: 'Whirlpools nearby when she casts the Battle Skill.' },
    { id: 'p2-cryo', piece: 'potential-2', quote: 'Cryo DMG Dealt +10%', tag: 'Cryo DMG +10% (self)', gives: [{ stat: 'dmg', amount: '+10%' }], to: 'self', setup: 'Nothing: always on.' },
    { id: 'p3-susceptibility', piece: 'potential-3', quote: 'When forming multiple Waterspouts, the resulting Arts Susceptibility effect is increased by +5%.', tag: 'Arts Susceptibility +5%', gives: [{ stat: 'susceptibility', amount: '+5%' }], to: 'enemy', limits: { arts: true }, setup: 'Her Battle Skill makes 2 or more Waterspouts.' },
    { id: 'p5-ultimate', piece: 'potential-5', quote: 'DMG Multiplier is increased to 1.15 times the original.', tag: 'Ultimate ×1.15 (self)', gives: [{ stat: 'dmg', amount: '×1.15' }], to: 'self', setup: 'Nothing: always on.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    ultimate: 'Her own damage.',
    'talent-fam-of-honor': `Haste for the team and Slow on enemies: ${NOT_A_STAT}.`,
    'talent-riot-bringer': 'More Waterspouts from her Ultimate: the same effects, already counted.',
    'talent-skirmisher': OWN_STAT,
    'potential-4': OWN_COST,
  },
};

const typhoeus: CharacterSheet = {
  characterId: 'chr_0034_typhoea',
  name: 'Typhoeus',
  damage: {
    element: 'nature',
    skills: ['battle', 'ultimate', 'combo'],
    uses: ['arts-intensity'],
    ignores: [],
    quotes: [
      { piece: 'battle-skill', quote: 'After hitting an enemy, Power Shot forcibly applies 1 instance of Nature Burst' },
      { piece: 'ultimate', quote: 'deals massive Nature DMG to enemies within the area of effect (AOE)' },
    ],
  },
  entries: [
    {
      id: 'consume-nature',
      piece: 'battle-skill',
      quote: 'Whenever an ABATK hits an enemy with Nature Infliction, it consumes 1 stack of Nature Infliction, grants Typhoeus 1 Sign, and gives additional Ultimate Energy.',
      tag: 'Signs from Nature Infliction',
      gives: [],
      to: 'self',
      reacts: ['nature-infliction'],
      setup: 'Enemies carry Nature Infliction when her Aerial Basic Attacks hit.',
    },
    { id: 'nature-burst', piece: 'battle-skill', quote: 'After hitting an enemy, Power Shot forcibly applies 1 instance of Nature Burst', tag: 'Forced Nature Burst', gives: [], to: 'enemy', causes: ['arts-burst'], setup: 'A Power Shot (it uses a Hunting Arrow).' },
    { id: 'barrage-array', piece: 'combo-skill', quote: 'suffer increased Nature Burst DMG Taken', tag: 'Nature Burst DMG Taken +10%', gives: [{ stat: 'dmg-taken', amount: '+10%' }], to: 'enemy', limits: { elements: ['nature'] }, setup: 'She reaches max Signs (her combo trigger).' },
    { id: 'signs-from-burst', piece: 'talent-prey-checklist', quote: 'Whenever a Nature Burst is triggered on an enemy, Typhoeus gains 1 Sign.', tag: 'Signs from Nature Bursts', gives: [], to: 'self', reacts: ['arts-burst'], setup: 'Nature Bursts on enemies.' },
    { id: 'p1-hovering', piece: 'potential-1', quote: 'When Hovering, ATK +18%', tag: 'ATK +18% when Hovering (self)', gives: [{ stat: 'atk', amount: '+18%' }], to: 'self', setup: 'While Hovering.' },
    { id: 'p2-arts-intensity', piece: 'potential-2', quote: 'Arts Intensity +16.', tag: 'Arts Intensity +16 (self)', gives: [{ stat: 'arts-intensity', amount: '+16' }], to: 'self', setup: 'Nothing: always on.' },
    { id: 'p3-dmg-taken', piece: 'potential-3', quote: 'Enemies in the Barrage Array suffer Nature Burst DMG Taken +6%.', tag: 'Nature Burst DMG Taken +6%', gives: [{ stat: 'dmg-taken', amount: '+6%' }], to: 'enemy', limits: { elements: ['nature'] }, setup: 'Enemies in her Barrage Array.' },
    { id: 'p5-ultimate', piece: 'potential-5', quote: 'Ultimate DMG Dealt is increased to 1.2 times the original', tag: 'Ultimate ×1.2 (self)', gives: [{ stat: 'dmg', amount: '×1.2' }], to: 'self', setup: 'Nothing: always on.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    ultimate: 'Her own damage and Hunting Arrows.',
    'talent-huntress-s-focus': 'Protects herself only.',
    'talent-skirmisher': OWN_STAT,
    'potential-4': OWN_COST,
  },
};

const liino: CharacterSheet = {
  characterId: 'chr_0035_liino',
  name: 'Liino',
  entries: [
    { id: 'vocalist-atk', piece: 'battle-skill', quote: 'While this stance is active, Liino grants the entire team an ATK Boost.', tag: 'Team ATK +10%', gives: [{ stat: 'atk', amount: '+10%' }], to: 'team', setup: 'Cast the Battle Skill (25 SP); Vocalist Stance lasts 60s. Cosmovoice Stance (her Ultimate) replaces it with the same ATK Boost, so it counts once.' },
    { id: 'vocalist-heal', piece: 'battle-skill', quote: 'Liino will also grant continuous HP Treatment to operators within range', tag: 'Heals nearby operators', gives: [{ stat: 'heal', amount: '41 + 0.09 per Agility, every beat' }], to: 'team', setup: 'Vocalist Stance is on.' },
    { id: 'combo-heal', piece: 'combo-skill', quote: 'grants HP Treatment to the controlled operator', tag: 'Heals the controlled operator', gives: [{ stat: 'heal', amount: '162 + 0.38 per Agility' }], to: 'controlled', reacts: ['arts-reaction'], setup: 'An Arts Reaction is applied or consumed while Vocalist Stance is on (her combo trigger).' },
    { id: 'electrification', piece: 'ultimate', quote: 'forcibly applies Electrification to enemies in a large area of effect (AOE)', tag: 'Forced Electrification', gives: [], to: 'enemy', causes: ['electrification'], setup: 'Cast the Ultimate (160 Energy).' },
    { id: 'cosmovoice-amp', piece: 'ultimate', quote: 'the stance grants the entire team Electric Amp and Nature Amp', tag: 'Electric and Nature Amp (grows with Will)', gives: [{ stat: 'amp', amount: 'Will × 0.04% (max 60%)' }], to: 'team', limits: { elements: ['electric', 'nature'] }, setup: 'Cast the Ultimate; Cosmovoice Stance lasts 15s.' },
    { id: 'ultimate-heal', piece: 'ultimate', quote: 'Liino grants HP Treatment to the entire team', tag: 'Heals the team', gives: [{ stat: 'heal', amount: '729 + 1.7 per Agility' }], to: 'team', setup: 'Cast the Ultimate.' },
    { id: 'idol-zone', piece: 'talent-idol-zone', quote: 'operators within the area of effect (AOE) gain Treatment Received Bonus +20% and DMG Taken -20%', tag: 'DMG Taken −20%', gives: [{ stat: 'protection', amount: '20%' }], to: 'team', setup: 'In her stance’s area.' },
    { id: 'starry-sp', piece: 'talent-starry-boost-of-1st-magnitude', quote: 'casting a battle skill of an Electric or Nature operator returns 10 SP', tag: '+10 SP', gives: [{ stat: 'sp', amount: '10' }], on: { another: { elements: ['electric', 'nature'] } }, to: 'team', setup: 'An Electric or Nature operator casts a Battle Skill within 30s of her combo skill.' },
    { id: 'p1-atk', piece: 'potential-1', quote: 'Effects of ATK Boost granted by Vocalist Stance and Cosmovoice Stance are increased by +6%.', tag: 'Team ATK +6% more', gives: [{ stat: 'atk', amount: '+6%' }], to: 'team', setup: 'A stance is on.' },
    { id: 'p1-sp', piece: 'potential-1', quote: 'the first casting of the battle skill Dazzling Focus returns 25 additional SP', tag: '+25 SP', gives: [{ stat: 'sp', amount: '25' }], to: 'team', setup: 'Her first Battle Skill in a fight.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-stalwart': OWN_STAT,
    'potential-2': 'More healing: already counted as team support.',
    'potential-3': 'Her own combo skill; more healing.',
    'potential-4': OWN_COST,
    'potential-5': 'Her Amp ×1.2: its size grows with her Will, so it isn’t sized on its own (the Amp is counted once, above).',
  },
};

/** Arcane's two modes depend on her build (Intellect against Will), which HLITH doesn't know: mode-only effects are shown, never counted. */
const INT: Condition = { unknown: 'only with Array Arcana: INT (Intellect ≥ Will), which depends on her build' };
const WILL: Condition = { unknown: 'only with Array Arcana: WILL (Will > Intellect), which depends on her build' };
const SAME = 'The same as the INT version, already counted; its WILL-only extras are listed with her talent and Potentials.';

const arcane: CharacterSheet = {
  characterId: 'chr_0032_lizhiyan',
  name: 'Arcane',
  entries: [
    { id: 'nature-infliction', piece: 'battle-skill-array-arcana-int', quote: 'Creates a Jadecrushing Grid that deals Nature DMG and applies Nature Infliction to enemies within the area of effect.', tag: 'Nature Infliction', gives: [], to: 'enemy', causes: ['nature-infliction', 'arts-infliction'], setup: 'Cast the Battle Skill (both modes).' },
    {
      id: 'combo-susceptibility',
      piece: 'combo-skill-array-arcana-int',
      quote: 'sets up 4 Tactical Doubles that apply Nature Susceptibility and Cryo Susceptibility',
      tag: 'Nature and Cryo Susceptibility',
      gives: [{ stat: 'susceptibility', amount: 'not stated' }],
      to: 'enemy',
      limits: { elements: ['nature', 'cryo'] },
      reacts: ['arts-infliction'],
      causes: ['nature-susceptibility', 'cryo-susceptibility'],
      setup: 'An Arts Infliction is applied (her combo trigger, both modes).',
    },
    { id: 'will-infliction', piece: 'combo-skill-array-arcana-will', quote: 'apply another stack of Arts Infliction of the same element', tag: 'One more Infliction stack (WILL)', on: WILL, gives: [], to: 'enemy', causes: ['arts-infliction'], setup: 'Her combo skill in WILL mode.' },
    { id: 'int-corrosion', piece: 'ultimate-array-arcana-int', quote: 'When created, the Gloompurger Array also forcibly applies Corrosion to enemies in the AOE.', tag: 'Forced Corrosion (INT)', on: INT, gives: [], to: 'enemy', causes: ['corrosion'], setup: 'Cast the Ultimate in INT mode.' },
    { id: 'will-ultimate-infliction', piece: 'ultimate-array-arcana-will', quote: 'applies another Arts Infliction stack of the same element to them', tag: 'One more Infliction stack (WILL)', on: WILL, gives: [], to: 'enemy', causes: ['arts-infliction'], setup: 'Cast the Ultimate in WILL mode on enemies with an Infliction.' },
    { id: 'int-amp', piece: 'talent-tactical-planning', quote: 'During the ultimate, Arcane gains 24% Arts Amp.', tag: 'Arts Amp 24% (self, INT)', on: INT, gives: [{ stat: 'amp', amount: '24%' }], to: 'self', setup: 'During her Ultimate in INT mode.' },
    {
      id: 'will-susceptibility',
      piece: 'talent-tactical-planning',
      quote: 'they also apply [Will × 0.02%] Nature Susceptibility and Cryo Susceptibility (max: 12.8%) for 10s',
      tag: 'Nature and Cryo Susceptibility up to 12.8% (WILL)',
      on: WILL,
      gives: [{ stat: 'susceptibility', amount: 'up to 12.8%' }],
      to: 'enemy',
      limits: { elements: ['nature', 'cryo'] },
      setup: 'Her Ultimate in WILL mode deals DMG.',
    },
    { id: 'p1-will', piece: 'potential-1', quote: 'Array Arcana: WILL: Effects of Nature Susceptibility and Cryo Susceptibility applied +6%.', tag: 'Susceptibility +6% (WILL)', on: WILL, gives: [{ stat: 'susceptibility', amount: '+6%' }], to: 'enemy', limits: { elements: ['nature', 'cryo'] }, setup: 'Her combo skill in WILL mode.' },
    { id: 'p5-will', piece: 'potential-5', quote: 'Further increases the effects of Nature Susceptibility and Cryo Susceptibility applied by Gloompurger Array (ultimate sequence 1) and Gloompurge Arcana (ultimate sequence 2) by +7%.', tag: 'Susceptibility +7% (WILL)', on: WILL, gives: [{ stat: 'susceptibility', amount: '+7%' }], to: 'enemy', limits: { elements: ['nature', 'cryo'] }, setup: 'Her Ultimate in WILL mode.' },
  ],
  nothing: {
    'basic-attack-array-arcana-int': 'Their own basic attacks.',
    'basic-attack-array-arcana-will': 'Their own basic attacks.',
    'battle-skill-array-arcana-will': SAME,
    'combo-skill-array-arcana-will': SAME,
    'ultimate-array-arcana-int': 'Her own damage; the INT-only Corrosion is listed above.',
    'talent-weapon-honing': 'Makes her Corrosion stronger: Corrosion’s own Resistance cut isn’t counted by the check yet.',
    'talent-keen-mind-stalwart': OWN_STAT,
    'potential-2': OWN_STAT,
    'potential-3': 'Makes her Corrosion stronger: Corrosion’s own Resistance cut isn’t counted by the check yet.',
    'potential-4': OWN_COST,
  },
};

const camille: CharacterSheet = {
  characterId: 'chr_0033_camille',
  name: 'Camille',
  damage: {
    element: 'heat',
    skills: ['combo', 'ultimate', 'battle'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'combo-skill', quote: 'Performs a returning dash that deals Heat DMG and recovers some SP.' },
      { piece: 'ultimate', quote: 'This deals Heat DMG and applies Heat Infliction to target(s) hit while recovering some SP.' },
    ],
  },
  entries: [
    { id: 'heat-infliction', piece: 'battle-skill', quote: 'deal Heat DMG and apply Heat Infliction on enemies in a small area of effect', tag: 'Heat Infliction', gives: [], to: 'enemy', causes: ['heat-infliction', 'arts-infliction'], setup: 'Cast the Battle Skill (100 SP).' },
    {
      id: 'heat-susceptibility',
      piece: 'battle-skill',
      quote: 'apply Weakness and Heat Susceptibility to the said target for the duration of the hovering',
      tag: 'Heat Susceptibility 7%',
      gives: [{ stat: 'susceptibility', amount: '7%' }],
      to: 'enemy',
      limits: { elements: ['heat'] },
      causes: ['heat-susceptibility'],
      setup: 'His Battle Skill’s Vesperwings hover over the target (45s).',
    },
    { id: 'weakness', piece: 'battle-skill', quote: 'apply Weakness and Heat Susceptibility to the said target for the duration of the hovering', tag: 'Weakness 7%', gives: [{ stat: 'dmg-taken', amount: '7% (Weakness: any damage)' }], to: 'enemy', setup: 'His Battle Skill’s Vesperwings hover over the target (45s).' },
    {
      id: 'combo-on-heat',
      piece: 'combo-skill',
      quote: "COMBO TRIGGER: When an enemy's Heat Infliction is consumed or absorbed.",
      tag: 'Combo when Heat Infliction is consumed or absorbed',
      gives: [{ stat: 'sp', amount: '20' }],
      to: 'team',
      reacts: ['heat-infliction'],
      setup: 'Someone applies Heat Infliction and someone consumes or absorbs it.',
    },
    { id: 'ultimate-heat', piece: 'ultimate', quote: 'This deals Heat DMG and applies Heat Infliction to target(s) hit while recovering some SP.', tag: 'Heat Infliction and +40 SP', gives: [{ stat: 'sp', amount: '40' }], to: 'team', causes: ['heat-infliction', 'arts-infliction'], setup: 'Cast the Ultimate (130 Energy).' },
    { id: 'link', piece: 'talent-hunter-of-transgression', quote: 'grants a Link buff for 15s', tag: 'Link', gives: [{ stat: 'link', amount: LINK }], to: 'team', limits: { skills: ['battle', 'ultimate'] }, setup: 'His combo skill hits an enemy with hovering Vesperwings (or Hunter Pursuit hits).' },
    { id: 'heat-dmg-self', piece: 'talent-bloodfount-revival', quote: 'he gains Heat DMG Dealt +4% (max stacks: 5) for 40s', tag: 'Heat DMG +4% per stack (self)', gives: [{ stat: 'dmg', amount: '+4% per stack, up to 5' }], to: 'self', setup: 'He restores HP with skills.' },
    { id: 'heat-dmg-team', piece: 'talent-bloodfount-revival', quote: 'other operators in the team gain 25% of this effect', tag: 'Heat DMG +1% per stack for the others', gives: [{ stat: 'dmg', amount: '+1% per stack, up to 5' }], to: 'team', limits: { elements: ['heat'] }, setup: 'He restores HP with skills.' },
    { id: 'p1-susceptibility', piece: 'potential-1', quote: 'The skill applies Weakness +5% and Heat Susceptibility +5%.', tag: 'Heat Susceptibility +5%', gives: [{ stat: 'susceptibility', amount: '+5%' }], to: 'enemy', limits: { elements: ['heat'] }, setup: 'His Battle Skill’s Vesperwings hover over the target.' },
    { id: 'p1-weakness', piece: 'potential-1', quote: 'The skill applies Weakness +5% and Heat Susceptibility +5%.', tag: 'Weakness +5%', gives: [{ stat: 'dmg-taken', amount: '+5% (Weakness: any damage)' }], to: 'enemy', setup: 'His Battle Skill’s Vesperwings hover over the target.' },
    { id: 'p5-heat-dmg', piece: 'potential-5', quote: 'Heat DMG boost per stack +6%.', tag: 'Heat DMG +6% more per stack (self)', gives: [{ stat: 'dmg', amount: '+6% per stack, up to 5' }], to: 'self', setup: 'He restores HP with skills.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-skirmisher': OWN_STAT,
    'potential-2': OWN_STAT,
    'potential-3': 'His own combo skill; a little more SP.',
    'potential-4': OWN_COST,
  },
};

const miFu: CharacterSheet = {
  characterId: 'chr_0031_mifu',
  name: 'Mi Fu',
  damage: {
    element: 'physical',
    skills: ['battle', 'ultimate', 'combo'],
    uses: [],
    ignores: [],
    quotes: [
      { piece: 'battle-skill', quote: 'Mi Fu deals massive Physical DMG to a specified area; this DMG is not treated as Battle Skill DMG, but as Crush DMG.' },
      { piece: 'ultimate', quote: 'then slams the said target to deal Physical DMG' },
    ],
  },
  entries: [
    { id: 'crush', piece: 'battle-skill', quote: 'the final punch applying Crush', tag: 'Crush', gives: [], to: 'enemy', causes: ['crush', 'vulnerable'], setup: 'Cast MOVE 2, Trail and Mangle (50 SP). On an enemy that is not Vulnerable, Crush adds a Vulnerable stack instead.' },
    {
      id: 'world-splitter',
      piece: 'battle-skill',
      quote: 'If this Crush consumes at least 3 Vulnerability stacks from a single target, then the next battle skill will be temporarily replaced with World Splitter.',
      tag: 'World Splitter at 3 Vulnerable stacks',
      gives: [],
      to: 'self',
      reacts: ['vulnerable'],
      setup: 'The team brings an enemy to 3 Vulnerable stacks before her Crush.',
    },
    { id: 'combo-on-3-stacks', piece: 'combo-skill', quote: 'COMBO TRIGGER: When an enemy has 3 or more Vulnerability stacks.', tag: 'Combo at 3 Vulnerable stacks', gives: [], to: 'self', reacts: ['vulnerable'], setup: 'The team brings an enemy to 3 Vulnerable stacks.' },
    { id: 'physical-susceptibility', piece: 'combo-skill', quote: 'dealing Physical DMG and applying temporary Physical Susceptibility', tag: 'Physical Susceptibility 5%', gives: [{ stat: 'susceptibility', amount: '5%' }], to: 'enemy', limits: { elements: ['physical'] }, causes: ['physical-susceptibility'], setup: 'Her combo skill hits; lasts 16s.' },
    { id: 'lift', piece: 'ultimate', quote: 'forcibly Lift a target into mid-air', tag: 'Forced Lift', gives: [], to: 'enemy', causes: ['lift', 'vulnerable'], setup: 'Cast the Ultimate (80 Energy).' },
    {
      id: 'stern-crackdown',
      piece: 'talent-stern-crackdown',
      quote: 'When hitting a target with Physical Susceptibility or Staggered, DMG Multiplier is increased to 1.2 times the original.',
      tag: 'World Splitter ×1.2 vs Physical Susceptibility or Stagger (self)',
      gives: [{ stat: 'dmg', amount: '×1.2' }],
      to: 'self',
      reacts: ['physical-susceptibility', 'stagger'],
      setup: 'The target has Physical Susceptibility or is Staggered.',
    },
    { id: 'p1-susceptibility', piece: 'potential-1', quote: 'Physical Susceptibility effect applied by the skill is further increased by +5%', tag: 'Physical Susceptibility +5%', gives: [{ stat: 'susceptibility', amount: '+5%' }], to: 'enemy', limits: { elements: ['physical'] }, setup: 'Her combo skill hits.' },
    { id: 'p3-atk', piece: 'potential-3', quote: 'Each time the shield is triggered, Mi Fu gains ATK +6% for 20s.', tag: 'ATK +6% (self)', gives: [{ stat: 'atk', amount: '+6%' }], to: 'self', setup: 'Her combo shield triggers.' },
    { id: 'p5-multiplier', piece: 'potential-5', quote: 'DMG Multipliers of the moves Cloudtrapper, Trail and Mangle, and World Splitter are increased to 1.1 times the original.', tag: 'Battle Skill moves ×1.1 (self)', gives: [{ stat: 'dmg', amount: '×1.1' }], to: 'self', setup: 'Nothing: always on.' },
  ],
  nothing: {
    'basic-attack': 'Their own basic attacks.',
    'talent-vigilant-fury': 'Shields herself only.',
    'talent-forged': OWN_STAT,
    'potential-2': OWN_STAT,
    'potential-4': OWN_COST,
  },
};

export const groupC: CharacterSheet[] = [si, tangtang, typhoeus, liino, arcane, camille, miFu];
