/**
 * The endgame gear sets' effects, read once by hand into rules HLITH can score (the 3-piece text is in
 * data/gear-sets.json; every `quote` here is word for word from it, a test checks). Each rule says what it
 * gives, how much, whether it's timed, and what the wearer's kit must do for it to switch on.
 */
import type { Element, SkillKind } from '../kitcheck/types';

/** What a kit must do for a rule to switch on (checked against the Kit check sheet in pick.ts). */
export type Need =
  | 'vulnerable'
  | 'crush-or-breach'
  | 'physical-status'
  | 'combustion'
  | 'corrosion'
  | 'electrification'
  | 'solidification'
  | 'nature-or-cryo-burst'
  | 'arts-infliction'
  | 'consumes-electrification-or-corrosion'
  | 'recovers-sp'
  | 'heals'
  | 'amp-protect-susceptibility-weaken';

export type Benefit =
  /** The wearer deals more damage: of these elements ('arts' = any Arts element) and / or from these skills. */
  | { kind: 'wearer-dmg'; amount: number; elements?: (Element | 'arts')[]; skills?: SkillKind[] }
  | { kind: 'atk'; amount: number }
  | { kind: 'crit-rate'; amount: number }
  | { kind: 'arts-intensity'; amount: number }
  /** The whole team (the wearer too) deals more damage. */
  | { kind: 'team-dmg'; amount: number }
  /** The other teammates (not the wearer) deal more damage. */
  | { kind: 'others-dmg'; amount: number }
  | { kind: 'combo-cooldown'; amount: number }
  | { kind: 'stagger'; amount: number }
  /** An extra hit: `amount` % ATK every `every` seconds. */
  | { kind: 'extra-hit'; amount: number; every: number }
  | { kind: 'hp'; amount: number }
  | { kind: 'dmg-reduction'; amount: number }
  | { kind: 'treatment'; amount: number };

export interface SetRule {
  quote: string;
  benefit: Benefit;
  /** "for 15s …": counted at TIMED_UPTIME. */
  timed?: boolean;
  needs?: Need;
}

export const SET_RULES: Record<string, SetRule[]> = {
  Æthertech: [
    { quote: "Wearer's ATK +8%", benefit: { kind: 'atk', amount: 8 } },
    { quote: 'the wearer gains Physical DMG +8% for 15s. This effect can reach 4 stacks', benefit: { kind: 'wearer-dmg', amount: 32, elements: ['physical'] }, timed: true, needs: 'vulnerable' },
    { quote: 'the wearer gains an additional Physical DMG +16% for 10s', benefit: { kind: 'wearer-dmg', amount: 16, elements: ['physical'] }, timed: true, needs: 'vulnerable' },
  ],
  Bonekrusha: [
    { quote: "Wearer's ATK +15%", benefit: { kind: 'atk', amount: 15 } },
    { quote: "grants the wearer's next battle skill DMG Dealt +30%", benefit: { kind: 'wearer-dmg', amount: 30, skills: ['battle'] }, timed: true },
  ],
  'Deep Rampart': [
    { quote: "Wearer's Arts DMG Dealt +16%", benefit: { kind: 'wearer-dmg', amount: 16, elements: ['arts'] } },
    { quote: 'the wearer gains Arts Intensity +16 for 20s. Max stacks for this effect: 3', benefit: { kind: 'arts-intensity', amount: 48 }, timed: true, needs: 'nature-or-cryo-burst' },
  ],
  'Eternal Xiranite': [
    { quote: "Wearer's HP +1000", benefit: { kind: 'hp', amount: 1000 } },
    { quote: 'other teammates gain DMG Dealt +16% for 15s', benefit: { kind: 'others-dmg', amount: 16 }, timed: true, needs: 'amp-protect-susceptibility-weaken' },
  ],
  Frontiers: [
    { quote: "Wearer's Combo Skill Cooldown Reduction +15%", benefit: { kind: 'combo-cooldown', amount: 15 } },
    { quote: "After the wearer's skill recovers SP, the team gains DMG +16% for 15s", benefit: { kind: 'team-dmg', amount: 16 }, timed: true, needs: 'recovers-sp' },
  ],
  'Grizzled Edge': [
    { quote: "Wearer's ATK +8%", benefit: { kind: 'atk', amount: 8 } },
    { quote: 'the wearer gains Physical DMG Dealt +[6% × Max number of Vulnerability stacks consumed from one enemy] for 20s', benefit: { kind: 'wearer-dmg', amount: 24, elements: ['physical'] }, timed: true, needs: 'crush-or-breach' },
  ],
  'Hot Work': [
    { quote: "Wearer's Arts Intensity +30", benefit: { kind: 'arts-intensity', amount: 30 } },
    { quote: 'After the wearer applies Combustion, the wearer gains Heat DMG +50% for 10s', benefit: { kind: 'wearer-dmg', amount: 50, elements: ['heat'] }, timed: true, needs: 'combustion' },
    { quote: 'After the wearer applies Corrosion, the wearer gains Nature DMG +50% for 10s', benefit: { kind: 'wearer-dmg', amount: 50, elements: ['nature'] }, timed: true, needs: 'corrosion' },
  ],
  LYNX: [
    { quote: "Wearer's HP Treatment Efficiency +20%", benefit: { kind: 'treatment', amount: 20 } },
    { quote: 'that target also gains 15% DMG Reduction against all types of DMG for 10s', benefit: { kind: 'dmg-reduction', amount: 15 }, timed: true, needs: 'heals' },
  ],
  'MI Security': [
    { quote: "Wearer's Critical Rate +5%", benefit: { kind: 'crit-rate', amount: 5 } },
    { quote: 'the wearer gains ATK +5% for 5s. This effect can reach 5 stacks', benefit: { kind: 'atk', amount: 25 }, timed: true },
    { quote: 'At max stacks, grant an additional Critical Rate +5%', benefit: { kind: 'crit-rate', amount: 5 }, timed: true },
  ],
  'Pulser Labs': [
    { quote: "Wearer's Arts Intensity +30", benefit: { kind: 'arts-intensity', amount: 30 } },
    { quote: 'After the wearer applies Electrification, the wearer gains Electric DMG +50% for 10s', benefit: { kind: 'wearer-dmg', amount: 50, elements: ['electric'] }, timed: true, needs: 'electrification' },
    { quote: 'After the wearer applies Solidification, the wearer gains Cryo DMG +50% for 10s', benefit: { kind: 'wearer-dmg', amount: 50, elements: ['cryo'] }, timed: true, needs: 'solidification' },
  ],
  Qingbo: [
    { quote: "Wearer's Combo Skill Cooldown Reduction +15%", benefit: { kind: 'combo-cooldown', amount: 15 } },
    { quote: 'the wearer gains Skill DMG Dealt +20% (for every skill) for 15s. This effect can reach 2 stacks', benefit: { kind: 'wearer-dmg', amount: 40, skills: ['battle', 'combo', 'ultimate'] }, timed: true },
  ],
  Swordmancer: [
    { quote: "Wearer's Stagger Efficiency Bonus +20%", benefit: { kind: 'stagger', amount: 20 } },
    { quote: 'the wearer also performs 1 hit that deals 250% ATK of Physical DMG', benefit: { kind: 'extra-hit', amount: 250, every: 15 }, needs: 'physical-status' },
  ],
  'Tide Surge': [
    { quote: "Wearer's Skill DMG Dealt +20%", benefit: { kind: 'wearer-dmg', amount: 20, skills: ['battle', 'combo', 'ultimate'] } },
    { quote: 'the wearer gains Arts DMG Dealt +35% for 15s', benefit: { kind: 'wearer-dmg', amount: 35, elements: ['arts'] }, timed: true, needs: 'arts-infliction' },
  ],
  'Type 50 Yinglung': [
    { quote: "Wearer's ATK +15%", benefit: { kind: 'atk', amount: 15 } },
    { quote: "gives DMG +20% to the wearer's next combo skill. Yinglung's Edge can stack 3 time(s)", benefit: { kind: 'wearer-dmg', amount: 60, skills: ['combo'] }, timed: true },
  ],
  Xiranflow: [
    { quote: "Wearer's ATK +10%", benefit: { kind: 'atk', amount: 10 } },
    { quote: 'each buff stack giving Electric DMG Dealt and Nature DMG Dealt +15% for 25s. The number of buff stacks maxes out at 3 stacks', benefit: { kind: 'wearer-dmg', amount: 45, elements: ['electric', 'nature'] }, timed: true, needs: 'consumes-electrification-or-corrosion' },
  ],
};
