/**
 * What HLITH's build logic knows about one operator, all read from data the app already has: the Kit check
 * sheet (what each kit line causes and gives, with its quote), the kit's level-12 numbers (kitNumbers.ts), the
 * operator's class, element and main / secondary attribute. Nothing here is a judgement; weights.ts holds those.
 */
import type { CharacterSheet, Element, Entry, GameEvent, OpClass, SkillKind, Stat } from '../kitcheck/types';
import { kitSkills, type KitSkillText, type SkillNumbers } from './kitNumbers';

export interface OperatorProfile {
  id: string;
  name: string;
  opClass: OpClass;
  element: Element;
  /** The Kit check reads them as a damage dealer (their sheet has damage notes). */
  damageDealer: boolean;
  main?: string;
  secondary?: string;
  skills: SkillNumbers[];
  /** Each skill's share of the kit's estimated damage a minute (0–1). */
  damageShare: Partial<Record<SkillKind, number>>;
  /** Events the kit sets up (Kit check `causes`), and what it reacts to. */
  causes: Set<GameEvent>;
  reacts: Set<GameEvent>;
  /** What the kit gives others, by stat, with the kit lines that give it (the quotes). */
  gives: Map<Stat, Entry[]>;
  /** Kit lines that help the team (not only the operator), by the combat skill they come from. */
  teamLines: Partial<Record<SkillKind, Entry[]>>;
  /** Stats the damage notes say the kit uses (e.g. Arts Intensity). */
  uses: Stat[];
}

const PIECE_KIND: Record<string, SkillKind> = { 'basic-attack': 'basic', 'battle-skill': 'battle', 'combo-skill': 'combo', ultimate: 'ultimate' };
/** The combat skill a kit piece belongs to (variants like "battle-skill-int" count as their skill); talents and potentials: none. */
export const kindOfPiece = (piece: string): SkillKind | undefined => PIECE_KIND[piece] ?? Object.entries(PIECE_KIND).find(([p]) => piece.startsWith(`${p}-`))?.[1];

export function profileOf(
  c: { id: string; name: string; role: string; element: string },
  sheet: CharacterSheet | undefined,
  kit: KitSkillText[],
  attributes?: { main: string; secondary?: string },
): OperatorProfile {
  const skills = kitSkills(kit);
  const total = skills.reduce((s, k) => s + k.perMinuteDamage, 0);
  const damageShare = Object.fromEntries(skills.map((k) => [k.kind, total ? k.perMinuteDamage / total : 0])) as Partial<Record<SkillKind, number>>;
  const entries = (sheet?.entries ?? []).filter((e) => !e.unverified && !e.piece.startsWith('potential'));
  const causes = new Set<GameEvent>(entries.flatMap((e) => e.causes ?? []));
  const reacts = new Set<GameEvent>(entries.flatMap((e) => e.reacts ?? []));
  const gives = new Map<Stat, Entry[]>();
  for (const e of entries) for (const g of e.gives) gives.set(g.stat, [...(gives.get(g.stat) ?? []), e]);
  const teamLines: Partial<Record<SkillKind, Entry[]>> = {};
  for (const e of entries) {
    const kind = kindOfPiece(e.piece);
    if (!kind || e.to === 'self') continue;
    if (!e.gives.length && !(e.causes ?? []).length) continue;
    teamLines[kind] = [...(teamLines[kind] ?? []), e];
  }
  return {
    id: c.id,
    name: c.name,
    opClass: c.role as OpClass,
    element: (sheet?.damage?.element ?? c.element) as Element,
    damageDealer: !!sheet?.damage,
    ...(attributes?.main ? { main: attributes.main } : {}),
    ...(attributes?.secondary ? { secondary: attributes.secondary } : {}),
    skills,
    damageShare,
    causes,
    reacts,
    gives,
    teamLines,
    uses: sheet?.damage?.uses ?? [],
  };
}

/** Whether the kit sets up any of these events (the Kit check's own covering rules: an element's infliction is an Arts Infliction). */
export const causesAny = (p: OperatorProfile, events: GameEvent[]) => events.some((e) => p.causes.has(e));
