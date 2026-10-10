/** T34: what "assume signature + average build" reads for ZZZ: the game's recommended builds, signature weapons and gear slots. */
import type { RecommendedBuild, TeamAccount, Weapon } from '../../core/contract';
import { withAssumedBuilds, type AssumeFacts } from '../../core/rules/averageBuild';
import builds from './data/builds.json';
import weapons from './data/weapons.json';
import { GEAR_SLOTS, LEVEL_MAX, SET_SLOTS } from './gear';

const recommended = new Map((builds as unknown as RecommendedBuild[]).map((b) => [b.characterId, b]));
const signatures = new Map((weapons as Weapon[]).flatMap((w) => (w.madeFor ? [[w.madeFor, { id: w.id, name: w.name }] as const] : [])));

export const ASSUME: AssumeFacts = {
  levelMax: LEVEL_MAX,
  slots: GEAR_SLOTS,
  setSlots: SET_SLOTS,
  recommended: (id) => recommended.get(id),
  signature: (id) => signatures.get(id),
};

export const assume = (a: TeamAccount): TeamAccount => withAssumedBuilds(a, ASSUME);
