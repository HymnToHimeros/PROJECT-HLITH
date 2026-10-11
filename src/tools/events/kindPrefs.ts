/**
 * Customise → Events, banners and calendar (T52c): which kinds of event you see, and your own
 * colour per kind. Colours come from the tested accent list (theme/look.ts), so a chosen colour
 * stays readable on every theme. Missing = every kind shown, in the default ink.
 */
import type { GameEvent } from '../../core/contract';
import { getPrefs } from '../../core/data/prefs';
import { ACCENT_VALUE, type Accent } from '../../core/theme/look';

export const EVENT_KINDS: GameEvent['kind'][] = ['event', 'login', 'web', 'endgame', 'bonus'];
export const KIND_LABEL: Record<GameEvent['kind'], string> = { event: 'Event', login: 'Login', web: 'Web', endgame: 'Endgame', bonus: 'Bonus' };

type Colour = Exclude<Accent, 'theme'>;
const isKind = (v: unknown): v is GameEvent['kind'] => (EVENT_KINDS as unknown[]).includes(v);

/** Kinds switched off. */
export const hiddenKinds = (raw: unknown = getPrefs().hiddenEventKinds): GameEvent['kind'][] => (Array.isArray(raw) ? raw.filter(isKind) : []);

/** The colour for a kind on this tone, or undefined for the default. */
export function kindColour(kind: GameEvent['kind'], tone: 'dark' | 'light', raw: unknown = getPrefs().eventKindColours): string | undefined {
  const id = raw && typeof raw === 'object' ? (raw as Record<string, unknown>)[kind] : undefined;
  return typeof id === 'string' && id in ACCENT_VALUE ? ACCENT_VALUE[id as Colour][tone] : undefined;
}
