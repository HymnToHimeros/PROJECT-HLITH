/** Light Cones (not signatures) for the harmony nihility preservation paths, read for the kit check (T18 step 4). */
import type { WeaponSheet } from '../types';

export const WEAPONS_HARMONY_NIHILITY_PRESERVATION: WeaponSheet[] = [
  // ---------------------------------------------------------------- Harmony
  {
    weaponId: '20005',
    name: 'Chorus',
    entries: [
      {
        id: 'atk',
        piece: 'effect',
        quote: 'After entering battle, increases the ATK of all allies by 8%. Abilities of the same type cannot stack.',
        tag: 'Allies: ATK +8%',
        gives: [{ stat: 'atk', amount: '+8%' }],
        to: 'allies',
        setup: 'Nothing; from the start of battle.',
        noStack: 'lc-20005-atk',
      },
    ],
  },
  { weaponId: '20012', name: 'Meshing Cogs', entries: [], nothing: "Only the wearer's own Energy." },
  {
    weaponId: '20019',
    name: 'Mediation',
    entries: [
      {
        id: 'spd',
        piece: 'effect',
        quote: 'Upon entering battle, increases SPD of all allies by 12 points for 1 turn(s).',
        tag: 'Allies: SPD +12 at battle start',
        gives: [{ stat: 'spd', amount: '+12 for 1 turn' }],
        to: 'allies',
        setup: 'Nothing; only the first turn after entering battle.',
      },
    ],
  },
  { weaponId: '21004', name: 'Memories of the Past', entries: [], nothing: "Only the wearer's own Break Effect and Energy." },
  {
    weaponId: '21011',
    name: 'Planetary Rendezvous',
    entries: [
      {
        id: 'same-type-dmg',
        piece: 'effect',
        quote: 'After entering battle, if an ally deals the same DMG Type as the wearer, DMG dealt increases by 12%.',
        tag: "Allies of the wearer's element: DMG +12%",
        // Judgement call: the element is the wearer's own, so it can't be written as a fixed element limit.
        on: {
          unknown: 'the ally deals the same DMG Type (element) as the wearer',
        },
        gives: [{ stat: 'dmg', amount: '+12%' }],
        to: 'allies',
        setup: 'Nothing beyond the element match; from the start of battle.',
      },
    ],
  },
  {
    weaponId: '21018',
    name: 'Dance! Dance! Dance!',
    entries: [
      {
        id: 'advance',
        piece: 'effect',
        quote: "When the wearer uses their Ultimate, all allies' actions are Advanced Forward by 16%.",
        tag: 'Allies: action forward 16%',
        gives: [{ stat: 'action-advance', amount: '16%' }],
        to: 'allies',
        setup: 'The wearer uses their Ultimate.',
      },
    ],
  },
  {
    weaponId: '21025',
    name: 'Past and Future',
    entries: [
      {
        id: 'next-ally-dmg',
        piece: 'effect',
        quote: 'When the wearer uses their Skill, the next ally taking action (except the wearer) deals 16% increased DMG for 1 turn(s).',
        tag: 'Next ally: DMG +16%',
        gives: [{ stat: 'dmg', amount: '+16% for 1 turn' }],
        // Judgement call: one ally, the next to act; the player times it for the damage dealer.
        to: 'chosen-ally',
        setup: "The wearer uses their Skill right before the damage dealer's turn.",
      },
    ],
  },
  {
    weaponId: '21032',
    name: 'Carve the Moon, Weave the Clouds',
    // One of the three at a time, picked at random: the shared key counts only one.
    entries: [
      {
        id: 'atk',
        piece: 'effect',
        quote: "All allies' ATK increases by 10%",
        tag: 'Allies: ATK +10% (random)',
        gives: [{ stat: 'atk', amount: '+10%' }],
        to: 'allies',
        setup: "Random at battle start and each wearer's turn; only one of the three effects at a time.",
        noStack: 'lc-21032-secret',
      },
      {
        id: 'crit-dmg',
        piece: 'effect',
        quote: "all allies' CRIT DMG increases by 12%",
        tag: 'Allies: CRIT DMG +12% (random)',
        gives: [{ stat: 'crit-dmg', amount: '+12%' }],
        to: 'allies',
        setup: "Random at battle start and each wearer's turn; only one of the three effects at a time.",
        noStack: 'lc-21032-secret',
      },
      {
        id: 'err',
        piece: 'effect',
        quote: "all allies' Energy Regeneration Rate increases by 6%",
        tag: 'Allies: Energy Regeneration +6% (random)',
        gives: [{ stat: 'energy-regen', amount: '+6%' }],
        to: 'allies',
        setup: "Random at battle start and each wearer's turn; only one of the three effects at a time.",
        noStack: 'lc-21032-secret',
      },
    ],
  },
  {
    weaponId: '21036',
    name: 'Dreamville Adventure',
    entries: [
      {
        id: 'childishness',
        piece: 'effect',
        quote: "all allies gain Childishness, which increases allies' DMG for the same type of ability as used by the wearer by 12%.",
        tag: 'Allies: DMG +12% for the ability type the wearer used',
        gives: [{ stat: 'dmg', amount: '+12%' }],
        to: 'allies',
        limits: { kinds: ['basic', 'skill', 'ultimate'] },
        setup: "Only the type the wearer used last (Basic ATK, Skill or Ultimate) is boosted; match it to the damage dealer's main hit.",
        noStack: 'lc-21036-childishness',
      },
    ],
  },
  {
    weaponId: '21046',
    name: 'Poised to Bloom',
    entries: [
      {
        id: 'same-path-crit-dmg',
        piece: 'effect',
        quote: "Upon entering battle, if two or more characters follow the same Path, then these characters' CRIT DMG increases by 16%. Abilities of the same type cannot stack.",
        tag: 'Same-Path allies: CRIT DMG +16%',
        // Judgement call: it depends on the receiver's own Path matching another member's; no fixed Path to count.
        on: { unknown: 'the ally shares their Path with another team member' },
        gives: [{ stat: 'crit-dmg', amount: '+16%' }],
        to: 'allies',
        setup: 'Nothing beyond the team; from the start of battle.',
        noStack: 'lc-21046-crit-dmg',
      },
    ],
  },
  {
    weaponId: '21056',
    name: 'In Pursuit of the Wind',
    entries: [
      {
        id: 'break-dmg',
        piece: 'effect',
        quote: "After entering combat, increases all allies' Break DMG dealt by 16%. Abilities of the same type cannot stack.",
        tag: 'Allies: Break DMG +16%',
        gives: [{ stat: 'dmg', amount: '+16% Break DMG' }],
        to: 'allies',
        limits: { kinds: ['break'] },
        setup: 'Nothing; from the start of battle.',
        noStack: 'lc-21056-break-dmg',
      },
    ],
  },
  { weaponId: '22002', name: "For Tomorrow's Journey", entries: [], nothing: "Only the wearer's own ATK and DMG." },
  { weaponId: '22005', name: 'The Forever Victual', entries: [], nothing: "Only the wearer's own ATK." },

  // ---------------------------------------------------------------- Nihility
  { weaponId: '20004', name: 'Void', entries: [], nothing: "Only the wearer's own Effect Hit Rate." },
  { weaponId: '20011', name: 'Loop', entries: [], nothing: "Only the wearer's own DMG against Slowed enemies." },
  { weaponId: '20018', name: 'Hidden Shadow', entries: [], nothing: "Only the wearer's own Additional DMG." },
  {
    weaponId: '21001',
    name: 'Good Night and Sleep Well',
    entries: [
      {
        id: 'dmg-per-debuff',
        piece: 'effect',
        quote: 'For every debuff the target enemy has, the DMG dealt by the wearer increases by 12%, stacking up to 3 time(s).',
        tag: 'Wearer: DMG +12% per debuff on the enemy',
        gives: [{ stat: 'dmg', amount: '+12% per debuff, up to 3' }],
        to: 'self',
        reacts: { event: 'debuff', from: 'any' },
        setup: 'The enemy carries debuffs from anyone; up to 3 count (also for DoT).',
      },
    ],
  },
  { weaponId: '21008', name: 'Eyes of the Prey', entries: [], nothing: "Only the wearer's own Effect Hit Rate and DoT." },
  {
    weaponId: '21015',
    name: 'Resolution Shines As Pearls of Sweat',
    entries: [
      {
        id: 'ensnare',
        piece: 'effect',
        quote: '"Ensnared" enemies\' DEF decreases by 12% for 1 turn(s).',
        tag: 'Enemy: DEF −12% (Ensnared)',
        gives: [{ stat: 'def-shred', amount: '12% for 1 turn' }],
        to: 'enemy',
        causes: 'debuff',
        setup: 'The wearer hits an enemy that is not already Ensnared (60% base chance).',
      },
    ],
  },
  { weaponId: '21022', name: 'Fermata', entries: [], nothing: "Only the wearer's own Break Effect and DMG against Shocked or Wind Sheared enemies." },
  { weaponId: '21029', name: 'We Will Meet Again', entries: [], nothing: "Only the wearer's own Additional DMG." },
  { weaponId: '21041', name: "It's Showtime", entries: [], nothing: "Only the wearer's own DMG and ATK, from the wearer's own debuffs." },
  { weaponId: '21044', name: 'Boundless Choreo', entries: [], nothing: "Only the wearer's own CRIT Rate and CRIT DMG against Slowed or DEF-reduced enemies." },
  {
    weaponId: '21061',
    name: 'Holiday Thermae Escapade',
    entries: [
      {
        id: 'vulnerability',
        piece: 'effect',
        quote: 'After the wearer attacks, there is a 100% base chance to inflict the attacked target with Vulnerability, increasing the DMG they receive by 10% for 2 turn(s).',
        tag: 'Enemy: DMG taken +10%',
        gives: [{ stat: 'vulnerability', amount: '+10% for 2 turns' }],
        to: 'enemy',
        causes: 'debuff',
        setup: 'The wearer attacks the enemy (100% base chance).',
        noStack: 'lc-21061-vulnerability',
      },
    ],
  },
  { weaponId: '22000', name: 'Before the Tutorial Mission Starts', entries: [], nothing: "Only the wearer's own Effect Hit Rate and Energy." },
  { weaponId: '24003', name: 'Solitary Healing', entries: [], nothing: "Only the wearer's own Break Effect, DoT and Energy." },

  // ---------------------------------------------------------------- Preservation
  { weaponId: '20003', name: 'Amber', entries: [], nothing: "Only the wearer's own DEF." },
  { weaponId: '20010', name: 'Defense', entries: [], nothing: 'Heals only the wearer; nothing for the team.' },
  { weaponId: '20017', name: 'Pioneering', entries: [], nothing: 'Heals only the wearer; nothing for the team.' },
  {
    weaponId: '21002',
    name: 'Day One of My New Life',
    entries: [],
    // Judgement call: All-Type RES is damage taken, which has no stat in the check (not a Shield or a heal).
    nothing: "Raises the wearer's DEF and all allies' All-Type RES; the check has no stat for damage taken.",
  },
  {
    weaponId: '21009',
    name: "Landau's Choice",
    entries: [
      {
        id: 'aggro',
        piece: 'effect',
        quote: 'The wearer is more likely to be attacked, and DMG taken is reduced by 16%.',
        tag: 'Draws enemy attacks to the wearer',
        gives: [{ stat: 'taunt', amount: 'higher chance to be attacked' }],
        to: 'enemy',
        setup: 'Nothing; always on.',
      },
    ],
  },
  {
    weaponId: '21016',
    name: 'Trend of the Universal Market',
    entries: [
      {
        id: 'burn',
        piece: 'effect',
        quote: 'When the wearer is attacked, there is a 100% base chance to Burn the enemy.',
        tag: 'Enemy: Burned when it attacks the wearer',
        gives: [
          {
            stat: 'own-damage',
            amount: "40% of the wearer's DEF per turn, 2 turns",
          },
        ],
        to: 'enemy',
        causes: 'dot',
        scales: {
          stat: 'def',
          quote: "the wearer deals DoT that is equal to 40% of the wearer's DEF for 2 turn(s).",
        },
        setup: 'An enemy attacks the wearer (100% base chance).',
      },
    ],
  },
  {
    weaponId: '21023',
    name: 'We Are Wildfire',
    entries: [
      {
        id: 'heal',
        piece: 'effect',
        quote: "immediately restores HP to all allies equal to 30% of the respective HP difference between the characters' Max HP and current HP.",
        tag: 'Allies: heal at battle start',
        gives: [{ stat: 'heal', amount: '30% of missing HP, once' }],
        to: 'allies',
        // The 8% less DMG taken for 5 turns in the same text has no stat in the check (not a Shield or a heal).
        setup: 'Nothing; once at the start of battle.',
      },
    ],
  },
  { weaponId: '21030', name: 'This Is Me!', entries: [], nothing: "Only the wearer's own DEF and Ultimate DMG." },
  { weaponId: '21039', name: "Destiny's Threads Forewoven", entries: [], nothing: "Only the wearer's own Effect RES and DMG." },
  // Judgement call: the Shields that raise it can come from teammates, but it only helps the wearer, and Shields are no event the check knows.
  { weaponId: '21043', name: 'Concert for Two', entries: [], nothing: "Only the wearer's own DEF and DMG (more for each Shield on the field)." },
  {
    weaponId: '21053',
    name: 'Journey, Forever Peaceful',
    entries: [
      {
        id: 'shielded-dmg',
        piece: 'effect',
        quote: 'While an ally target has a Shield, their DMG dealt increases by 12%.',
        tag: 'Shielded allies: DMG +12%',
        gives: [{ stat: 'dmg', amount: '+12%' }],
        to: 'allies',
        setup: 'The ally has a Shield (from the wearer or anyone).',
      },
    ],
  },
  {
    weaponId: '23005',
    name: 'Moment of Victory',
    entries: [
      {
        id: 'aggro',
        piece: 'effect',
        quote: 'Increases the chance for the wearer to be attacked by enemies.',
        tag: 'Draws enemy attacks to the wearer',
        gives: [{ stat: 'taunt', amount: 'higher chance to be attacked' }],
        to: 'enemy',
        setup: 'Nothing; always on.',
      },
    ],
  },
  { weaponId: '24002', name: 'Texture of Memories', entries: [], nothing: 'Shields only the wearer; nothing for the team.' },
];
