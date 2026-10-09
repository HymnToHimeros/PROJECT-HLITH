import type { ComponentType } from 'react';
import type { GameContract, ModuleId } from '../contract';

/** Where inside a module a feature can appear. */
export type FeaturePlace =
  | 'today-card'
  | 'history-card'
  | 'teams-tab'
  | 'character-page'
  | 'banner-card'
  | 'farm-card'
  | 'account-section';

export interface FeatureProps {
  game: GameContract;
  /** The thing the feature is about, e.g. a character id on the character page. */
  subjectId?: string;
}

/**
 * Game-only things are features inside a module, switched on by data (Override 1),
 * e.g. Kit check: module 'roster', places teams-tab + character-page,
 * available = game => !!game.data.kits.
 */
export interface FeatureDef {
  id: string;
  module: ModuleId;
  label: string;
  places: FeaturePlace[];
  available: (game: GameContract) => boolean;
  component: () => Promise<{ default: ComponentType<FeatureProps> }>;
}

const features: FeatureDef[] = [];

export function registerFeature(def: FeatureDef): void {
  if (features.some((f) => f.id === def.id)) throw new Error(`Feature "${def.id}" registered twice`);
  features.push(def);
}

/** Features to render at a place for a game. Unavailable ones are returned too, flagged, so the place can say "No data yet". */
export function featuresAt(module: ModuleId, place: FeaturePlace, game: GameContract): { def: FeatureDef; available: boolean }[] {
  return features
    .filter((f) => f.module === module && f.places.includes(place))
    .map((def) => ({ def, available: def.available(game) }));
}

/** Test helper. */
export function clearFeatures(): void {
  features.length = 0;
}
