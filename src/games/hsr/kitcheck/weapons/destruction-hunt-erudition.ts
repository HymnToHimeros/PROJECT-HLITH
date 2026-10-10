/** Light Cones (not signatures) for the destruction hunt erudition paths, read for the kit check (T18 step 4). */
import type { WeaponSheet } from '../types';

const WEAPON_SELF = "Raises the wearer's own stats; nothing for the team.";
const ENERGY_SELF = 'Gives only the wearer Energy and their own stats; nothing for the team.';
const HEAL_SELF = "Raises the wearer's own stats and heals only the wearer; nothing for the team.";

/** A Light Cone whose effect is all for the wearer. */
const own = (weaponId: string, name: string, nothing = WEAPON_SELF): WeaponSheet => ({ weaponId, name, entries: [], nothing });

export const WEAPONS_DESTRUCTION_HUNT_ERUDITION: WeaponSheet[] = [
  // Destruction
  own('20002', 'Collapsing Sky'),
  own('20009', 'Shattered Home', "Raises the wearer's own DMG against enemies above 50% HP; nothing for the team."),
  own('20016', 'Mutual Demise', "Raises the wearer's own CRIT Rate at low HP; nothing for the team."),
  own('21005', 'The Moles Welcome You'),
  own('21012', 'A Secret Vow'),
  own('21019', 'Under the Blue Sky'),
  {
    weaponId: '21026',
    name: 'Woof! Walk Time!',
    entries: [
      {
        id: 'lc-burn-bleed-dmg',
        piece: 'effect',
        quote: 'increases their DMG to enemies afflicted with Burn or Bleed by 16%. This also applies to DoT.',
        tag: 'Wearer: +16% DMG vs. Burn or Bleed',
        gives: [{ stat: 'dmg', amount: '+16%' }],
        to: 'self',
        reacts: { event: 'dot', from: 'any' },
        setup: 'The enemy has Burn or Bleed on it (from anyone); other DoTs (Shock, Wind Shear) do not switch it on.',
      },
    ],
  },
  own('21033', 'Nowhere to Run', HEAL_SELF),
  {
    weaponId: '21038',
    name: 'Flames Afar',
    entries: [
      {
        id: 'lc-hp-loss-dmg',
        piece: 'effect',
        quote: 'or if the amount of their own HP consumed at one time is greater than 25% of their Max HP',
        tag: 'Wearer: +25% DMG after a big HP loss',
        gives: [{ stat: 'dmg', amount: '+25% for 2 turns' }],
        to: 'self',
        reacts: { event: 'hp-loss', from: 'any' },
        setup: 'The wearer loses more than 25% of their Max HP in one attack or one HP cost; once every 3 turns.',
        unverified: 'The text says "their own HP consumed"; it does not say whether HP a teammate\'s ability consumes counts, and few teammate HP costs reach 25% of Max HP at once.',
      },
    ],
  },
  own('21042', 'Indelible Promise'),
  own('21058', 'A Trail of Bygone Blood'),
  {
    weaponId: '22003',
    name: 'Ninja Record: Sound Hunt',
    entries: [
      {
        id: 'lc-hp-change-crit-dmg',
        piece: 'effect',
        quote: "When losing or restoring this unit's HP, increases CRIT DMG by 18%, lasting for 2 turn(s).",
        tag: 'Wearer: +18% CRIT DMG when HP goes down or up',
        gives: [{ stat: 'crit-dmg', amount: '+18% for 2 turns' }],
        to: 'self',
        reacts: { event: 'hp-loss', from: 'any' },
        setup: 'The wearer loses HP (hit, own HP cost or a teammate consuming it) or is healed; once per turn.',
      },
    ],
  },
  own('23015', 'Brighter Than the Sun', "Raises the wearer's own stats and Energy Regeneration Rate; nothing for the team."),

  // Hunt
  own('20000', 'Arrows'),
  own('20007', 'Darting Arrow'),
  own('20014', 'Adversarial'),
  own('21003', 'Only Silence Remains'),
  own('21010', 'Swordplay'),
  own('21017', 'Subscribe for More!'),
  own('21024', 'River Flows in Spring'),
  own('21031', 'Return to Darkness', "Raises the wearer's own CRIT Rate and can remove a buff from the enemy (not a counted stat); nothing for the team."),
  own('21037', 'Final Victor'),
  own('21047', 'Shadowed by Night', "Raises the wearer's own stats after their own Break DMG; nothing for the team."),
  own('21062', 'See You at the End'),
  own('22008', 'Race to the Horizon', "Raises the wearer's own stats after their own Follow-Up ATK; nothing for the team."),
  own('23012', 'Sleep Like the Dead'),

  // Erudition
  own('20006', 'Data Bank'),
  own('20013', 'Passkey', ENERGY_SELF),
  own('20020', 'Sagacity'),
  own('21006', 'The Birth of the Self'),
  own('21013', 'Make the World Clamor', ENERGY_SELF),
  own('21020', "Geniuses' Repose"),
  own('21027', 'The Seriousness of Breakfast'),
  own('21034', 'Today Is Another Peaceful Day'),
  own('21040', 'The Day The Cosmos Fell', "Raises the wearer's own stats, more when enemies have the matching Weakness; nothing for the team."),
  own('21045', 'After the Charmony Fall'),
  own('21060', 'A Dream Scented in Wheat'),
  own('22004', 'The Great Cosmic Enterprise', "Raises the wearer's own stats, more against enemies with many Weakness types; nothing for the team."),
  own('23000', 'Night on the Milky Way', "Raises the wearer's own ATK (by enemy count) and own DMG after any Weakness Break; Weakness Break is not a counted event. Nothing for the team."),
  own('24004', 'Eternal Calculus'),
];
