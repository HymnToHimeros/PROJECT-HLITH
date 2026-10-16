/**
 * Endfield builds as the character page shows them. Per field, the first source that has it:
 * the game's own recommendation > community guides that agree (data/community-builds.json) > HLITH's pick from
 * the kit (pick.ts). Where community guides and HLITH disagree, the community pick stays and HLITH's is a note.
 */
import type { RecommendedBuild } from '../../../core/contract';
import characters from '../data/characters.json';
import community from '../data/community-builds.json';
import gearPieces from '../data/gear-pieces.json';
import gearSets from '../data/gear-sets.json';
import attributes from '../data/operator-attributes.json';
import weaponSkills from '../data/weapon-skills.json';
import { KITS, SHEETS } from '../kitcheck/library';
import type { SkillKind } from '../kitcheck/types';
import { KIND_LABEL } from './kitNumbers';
import { orderWeapons, pickSet, rankSkills, rankStats, type GearPieceData, type GearSetData, type WeaponSkillData } from './pick';
import { profileOf, type OperatorProfile } from './profile';

const HLITH = "HLITH's pick from the kit";
const PIECES = gearPieces as GearPieceData[];
const SETS = gearSets as GearSetData[];
const WEAPON_SKILLS = new Map((weaponSkills as WeaponSkillData[]).map((w) => [w.weapon, w]));
const ATTRS = attributes as Record<string, { main: string; secondary?: string }>;
type Guide = { source: string; date: string };
const COMMUNITY = community as unknown as { sources: Record<string, { name: string }>; operators: Record<string, { sets?: (Guide & { set: string })[]; skills?: (Guide & { tiers: string[][] })[] }> };
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const guide = (g: Guide) => `${COMMUNITY.sources[g.source]?.name ?? g.source}, ${day(g.date)}`;

/** Every stat an endgame piece offers: what the stat ranking chooses from. */
const PIECE_STATS = [...new Set(PIECES.filter((p) => p.level >= 70).flatMap((p) => p.stats.map((s) => s.stat)))];

export function profiles(): Map<string, OperatorProfile> {
  const sheets = new Map(SHEETS.map((s) => [s.characterId, s]));
  const kits = new Map(KITS.map((k) => [k.characterId, k.skills]));
  return new Map(characters.map((c) => [c.id, profileOf(c, sheets.get(c.id), kits.get(c.id) ?? [], ATTRS[c.id])]));
}

const words = (tiers: SkillKind[][]) => tiers.map((t) => t.map((k) => KIND_LABEL[k]).join(' and ')).join(', then ');

/** One operator's build: the imported one (game weapons, community picks) filled in with HLITH's picks. */
export function withHlith(b: RecommendedBuild, p: OperatorProfile | undefined): RecommendedBuild {
  const sheet = SHEETS.find((s) => s.characterId === b.characterId);
  if (!p || !sheet) {
    // Kit not read yet (an operator not out): HLITH can't decide; the reason says so.
    const why = ['Their kit hasn’t been read into the Kit check yet, so HLITH can’t pick from it.'];
    return { ...b, stepWhy: { sets: why, subStats: why, skills: why } };
  }
  const out: RecommendedBuild = { ...b, stepSources: { ...b.stepSources }, stepWhy: {}, stepNotes: {} };
  const sources = out.stepSources as NonNullable<RecommendedBuild['stepSources']>;
  const why = out.stepWhy as NonNullable<RecommendedBuild['stepWhy']>;
  const notes = out.stepNotes as NonNullable<RecommendedBuild['stepNotes']>;

  // Weapons: the game's list, ordered by HLITH's kit match.
  if (b.weapons.length > 1) {
    const order = orderWeapons(p, b.weapons, WEAPON_SKILLS);
    out.weapons = order.value;
    out.ranked = true;
    out.source = `${b.source}; ordered by HLITH's kit match`;
    why.weapons = order.why;
  }

  // Gear set: community when two guides agree, else HLITH's. HLITH's off-piece either way.
  const set = pickSet(p, sheet, SETS, PIECES);
  const community = b.sets[0]?.options[0];
  if (set) {
    const off = set.value.offPiece;
    const offItem = off ? PIECES.find((x) => x.name === off) : undefined;
    if (community) {
      if (community !== set.value.set) notes.sets = `${HLITH} would be ${set.value.set}: ${set.why[0] ?? ''}`;
      why.sets = [`HLITH’s reading of ${community}: ${set.value.set === community ? set.why.join(' ') : 'see the note.'}`];
    } else {
      out.sets = [{ pieces: 3, options: [set.value.set] }];
      sources.sets = HLITH;
      why.sets = set.why;
      const effects = SETS.find((s) => s.name === set.value.set)?.effects ?? [];
      out.items = { ...out.items, [set.value.set]: { effects } };
      // A guide alone isn't agreement, but a different pick from one is shown, never hidden.
      const others = (COMMUNITY.operators[b.characterId]?.sets ?? []).filter((g) => g.set !== set.value.set);
      if (others.length) notes.sets = `community guides that name a different set: ${others.map((g) => `${g.set} (${guide(g)})`).join('; ')}.`;
    }
    if (off && offItem && (!community || community === set.value.set)) {
      out.sets = [...out.sets, { pieces: 1, options: [off] }];
      out.items = { ...out.items, [off]: { effects: [{ label: 'Stats', text: offItem.stats.map((s) => s.stat).join(', ') }] } };
      sources.sets = community ? `${sources.sets ?? ''}; off-piece: ${HLITH}` : HLITH;
    }
  } else if (!community) why.sets = ['No endgame set’s effect does anything for this kit.'];

  // Stats to look for on pieces: HLITH's ranking (no source gives one).
  const stats = rankStats(p, sheet, PIECE_STATS);
  if (stats.value.length) {
    out.subStats = stats.value;
    sources.subStats = HLITH;
    why.subStats = stats.why;
  }

  // Skills: community when two guides agree, else HLITH's.
  const skills = rankSkills(p);
  if (skills) {
    if (b.skillsFirst.length) {
      const hlith = skills.value.map((t) => t.map((k) => KIND_LABEL[k]));
      if (JSON.stringify(hlith) !== JSON.stringify(b.skillsFirst)) notes.skills = `${HLITH} would be ${words(skills.value)}: ${skills.why[0] ?? ''}`;
    } else {
      out.skillsFirst = skills.value.map((t) => t.map((k) => KIND_LABEL[k]));
      sources.skills = HLITH;
      why.skills = skills.why;
      const mine = JSON.stringify(out.skillsFirst);
      const others = (COMMUNITY.operators[b.characterId]?.skills ?? []).filter((g) => JSON.stringify(g.tiers) !== mine);
      if (others.length) notes.skills = `a community guide orders them differently: ${others.map((g) => `${g.tiers.map((t) => t.join(' and ')).join(', then ')} (${guide(g)})`).join('; ')}.`;
    }
  }
  return out;
}

export function endfieldBuilds(imported: RecommendedBuild[]): RecommendedBuild[] {
  const all = profiles();
  return imported.map((b) => withHlith(b, all.get(b.characterId)));
}
