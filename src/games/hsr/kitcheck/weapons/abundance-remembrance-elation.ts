/** Light Cones (not signatures) for the abundance remembrance elation paths, read for the kit check (T18 step 4). */
import type { WeaponSheet } from '../types';

const SELF = "Raises the wearer's own stats; nothing for the team.";
const SELF_HEAL = "Raises the wearer's own healing (or heals only the wearer); nothing for the team.";
const SELF_MEMO = "Raises only the wearer's and their own memosprite's stats; nothing for the team.";

export const WEAPONS_ABUNDANCE_REMEMBRANCE_ELATION: WeaponSheet[] = [
  // Abundance
  { weaponId: '20001', name: 'Cornucopia', entries: [], nothing: SELF_HEAL },
  {
    weaponId: '20008',
    name: 'Fine Fruit',
    entries: [
      {
        id: 'battle-start-energy',
        piece: 'effect',
        quote: 'At the start of the battle, immediately regenerates 6 Energy for all allies.',
        tag: 'Allies: +6 Energy at battle start',
        gives: [{ stat: 'energy', amount: '6 at battle start' }],
        to: 'allies',
        setup: 'Nothing; at the start of the battle.',
      },
    ],
  },
  {
    weaponId: '20015',
    name: 'Multiplication',
    entries: [],
    nothing: "Advances the wearer's own next action; nothing for the team.",
  },
  {
    weaponId: '21000',
    name: 'Post-Op Conversation',
    entries: [],
    nothing: SELF_HEAL,
  },
  {
    weaponId: '21007',
    name: 'Shared Feeling',
    entries: [
      {
        id: 'skill-energy',
        piece: 'effect',
        quote: 'When using Skill, regenerates 2.0 Energy for all allies.',
        tag: 'Allies: +2 Energy per Skill',
        gives: [{ stat: 'energy', amount: '2 per Skill' }],
        to: 'allies',
        setup: 'The wearer uses their Skill.',
      },
    ],
  },
  {
    weaponId: '21014',
    name: 'Perfect Timing',
    entries: [],
    nothing: SELF_HEAL,
  },
  {
    weaponId: '21021',
    name: 'Quid Pro Quo',
    entries: [
      {
        id: 'turn-energy',
        piece: 'effect',
        quote: "At the start of the wearer's turn, regenerates 8 Energy for a randomly chosen ally (excluding the wearer) whose current Energy is lower than 50%.",
        tag: 'Teammates: +8 Energy',
        gives: [{ stat: 'energy', amount: '8 per turn' }],
        to: 'teammates',
        setup: "A random teammate below 50% Energy, at the start of the wearer's turn.",
      },
    ],
  },
  {
    weaponId: '21028',
    name: 'Warmth Shortens Cold Nights',
    entries: [
      {
        id: 'heal',
        piece: 'effect',
        quote: "When using Basic ATK or Skill, restores all allies' HP by an amount equal to 2.0% of their respective Max HP.",
        tag: 'Allies: heal',
        gives: [{ stat: 'heal', amount: '2% of their Max HP' }],
        to: 'allies',
        setup: 'The wearer uses Basic ATK or Skill.',
      },
    ],
  },
  {
    weaponId: '21035',
    name: 'What Is Real?',
    entries: [],
    nothing: "Raises the wearer's own Break Effect and heals only the wearer; nothing for the team.",
  },
  {
    weaponId: '21048',
    name: "Dream's Montage",
    entries: [],
    nothing: "Raises the wearer's own SPD and gives only the wearer Energy; nothing for the team.",
  },
  {
    weaponId: '21055',
    name: "Unto Tomorrow's Morrow",
    entries: [
      {
        id: 'high-hp-dmg',
        piece: 'effect',
        quote: "When an ally target's current HP percentage is greater than or equal to 50%, increases the DMG dealt by 12%.",
        tag: 'Allies: +12% DMG',
        gives: [{ stat: 'dmg', amount: '+12%' }],
        to: 'allies',
        setup: 'The ally is at 50% HP or more.',
        unverified: "The text doesn't say whose DMG goes up (the wearer's, or the ally at 50% HP); shown, never counted.",
      },
    ],
  },
  {
    weaponId: '22001',
    name: 'Hey, Over Here',
    entries: [],
    nothing: SELF_HEAL,
  },

  // Remembrance
  {
    weaponId: '20021',
    name: 'Shadowburn',
    entries: [
      {
        id: 'first-summon-sp',
        piece: 'effect',
        quote: 'When the wearer summons memosprite for the first time, recovers 1 Skill Point(s)',
        tag: 'Team: +1 Skill Point',
        gives: [{ stat: 'skill-points', amount: '+1 once' }],
        to: 'allies',
        setup: 'The wearer summons their memosprite for the first time.',
      },
    ],
  },
  { weaponId: '20022', name: 'Reminiscence', entries: [], nothing: SELF_MEMO },
  {
    weaponId: '21050',
    name: 'Victory In a Blink',
    entries: [
      {
        id: 'memo-ally-dmg',
        piece: 'effect',
        quote: "When the wearer's memosprite uses an ability on an ally target, increases the DMG dealt by all ally targets by 8%, lasting for 3 turn(s).",
        tag: 'Allies: +8% DMG',
        gives: [{ stat: 'dmg', amount: '+8%' }],
        to: 'allies',
        setup: "The wearer's memosprite uses an ability on an ally; 3 turns.",
      },
    ],
  },
  {
    weaponId: '21051',
    name: "Geniuses' Greetings",
    entries: [],
    nothing: SELF_MEMO,
  },
  {
    weaponId: '21052',
    name: 'Sweat Now, Cry Less',
    entries: [],
    nothing: SELF_MEMO,
  },
  {
    weaponId: '21054',
    name: "The Story's Next Page",
    entries: [],
    nothing: "Raises the wearer's own Max HP and the healing of the wearer and their memosprite; nothing for the team.",
  },
  {
    weaponId: '21057',
    name: 'The Flower Remembers',
    entries: [],
    nothing: SELF_MEMO,
  },
  {
    weaponId: '22006',
    name: 'Fly Into a Pink Tomorrow',
    entries: [
      {
        id: 'trailblazer-ally-dmg',
        piece: 'effect',
        quote: "When equipped by Trailblazer (Remembrance), increases all ally targets' DMG dealt by 8%",
        tag: 'Allies: +8% DMG (on Trailblazer)',
        on: { unknown: 'the wearer is Trailblazer (Remembrance)' },
        gives: [{ stat: 'dmg', amount: '+8%' }],
        to: 'allies',
        setup: 'Worn by Trailblazer (Remembrance).',
      },
    ],
  },
  {
    weaponId: '24005',
    name: "Memory's Curtain Never Falls",
    entries: [
      {
        id: 'skill-ally-dmg',
        piece: 'effect',
        quote: 'After the wearer uses Skill, increases the DMG dealt by all allies by 8%, lasting for 3 turn(s).',
        tag: 'Allies: +8% DMG',
        gives: [{ stat: 'dmg', amount: '+8%' }],
        to: 'allies',
        setup: 'The wearer uses their Skill; 3 turns.',
      },
    ],
  },

  // Elation
  {
    weaponId: '20023',
    name: 'Sneering',
    entries: [
      {
        id: 'aha-instant-elation',
        piece: 'effect',
        quote: "When Aha Instant is activated, the wearer's Elation increases by 16%, lasting until Aha Instant ends.",
        tag: 'Own +16% Elation during Aha Instant',
        gives: [{ stat: 'elation', amount: '+16%' }],
        to: 'self',
        reacts: { event: 'extra-turn', from: 'any' },
        setup: 'An Aha Instant is active.',
      },
    ],
  },
  {
    weaponId: '20024',
    name: 'Lingering Tear',
    entries: [
      {
        id: 'punchline-crit-dmg',
        piece: 'effect',
        quote: "When the Punchline held is 10 or more, the wearer's CRIT DMG increases by 20%.",
        tag: 'Own +20% CRIT DMG with 10+ Punchline',
        gives: [{ stat: 'crit-dmg', amount: '+20%' }],
        to: 'self',
        reacts: { event: 'elation-skill', from: 'any' },
        setup: 'The team holds 10 or more Punchline.',
      },
    ],
  },
  {
    weaponId: '21064',
    name: "Mushy Shroomy's Adventures",
    entries: [
      {
        id: 'elation-vulnerability',
        piece: 'effect',
        quote: 'When the wearer uses an Elation Skill, increases Elation DMG taken by all enemies by 6% for 2 turn(s).',
        tag: 'Enemy: Elation DMG taken +6%',
        gives: [{ stat: 'vulnerability', amount: '+6%' }],
        to: 'enemy',
        limits: { kinds: ['elation'] },
        setup: 'The wearer uses an Elation Skill; 2 turns.',
      },
    ],
  },
  { weaponId: '21065', name: "Today's Good Luck", entries: [], nothing: SELF },
  {
    weaponId: '21066',
    name: 'A Little Getaway',
    entries: [],
    nothing: "Raises the wearer's own Elation and ignores DEF only for the wearer's own Elation Skill; nothing for the team.",
  },
  {
    weaponId: '22007',
    name: 'Tomorrow, Together',
    entries: [
      {
        id: 'ult-ally-elation',
        piece: 'effect',
        quote: "After the wearer uses their Ultimate, increases all allies' Elation by 8%, lasting for 1 turn(s).",
        tag: 'Allies: +8% Elation',
        gives: [{ stat: 'elation', amount: '+8%' }],
        to: 'allies',
        setup: 'The wearer uses their Ultimate; 1 turn.',
      },
    ],
  },
  {
    weaponId: '22009',
    name: "See You at the World's End!",
    entries: [
      {
        id: 'elation-team-crit-dmg',
        piece: 'effect',
        quote: "For every Elation character on the team, increase the wearer's CRIT DMG by 6%.",
        tag: 'Own +6% CRIT DMG per Elation character',
        on: { count: { paths: ['elation'], atLeast: 1, others: true } },
        gives: [
          {
            stat: 'crit-dmg',
            amount: '+6% per Elation character (the wearer too)',
          },
        ],
        to: 'self',
        setup: 'Nothing; Elation characters in the team.',
      },
      {
        id: 'aha-crit-dmg',
        piece: 'effect',
        quote: "When Aeon ★ Aha is on the field, the wearer's CRIT DMG increases by 12%.",
        tag: 'Own +12% CRIT DMG with Aha',
        on: { unknown: 'Aeon ★ Aha is in the team' },
        gives: [{ stat: 'crit-dmg', amount: '+12%' }],
        to: 'self',
        setup: 'Aeon ★ Aha on the field.',
      },
    ],
  },
  {
    weaponId: '23054',
    name: 'When She Decided to See',
    entries: [
      {
        id: 'great-fortune-crit',
        piece: 'effect',
        quote: 'While the wearer holds "Great Fortune," all allies\' CRIT Rate increases by 10%, CRIT DMG increases by 30%',
        tag: 'Allies: +10% CRIT Rate, +30% CRIT DMG',
        gives: [
          { stat: 'crit-rate', amount: '+10%' },
          { stat: 'crit-dmg', amount: '+30%' },
        ],
        to: 'allies',
        setup: 'The wearer enters combat or uses their Ultimate on an ally ("Great Fortune" lasts 3 turns).',
      },
    ],
  },
  {
    weaponId: '24006',
    name: 'Elation Brimming With Blessings',
    entries: [
      {
        id: 'chosen-ally-elation',
        piece: 'effect',
        quote: "After the wearer uses Skill or Ultimate on one ally character, increases the target's Elation stat by 12% for 2 turn(s).",
        tag: 'One ally: +12% Elation',
        gives: [{ stat: 'elation', amount: '+12%' }],
        to: 'chosen-ally',
        setup: 'The wearer uses Skill or Ultimate on the ally; 2 turns.',
      },
    ],
  },
];
