/**
 * Your main character (owner's job T27). Some games let the player pick one of two forms of the
 * main character (HSR: the Trailblazer, Caelus or Stelle). Once picked:
 * - the other one's entries are hidden everywhere: roster, kits, builds, team suggestions; game
 *   teams that name them use your pick's matching form instead;
 * - your pick's entries are marked owned when you pick, only where you haven't set them
 *   yourself, so unticking one sticks. Only then: never on load, so a fresh device can't write
 *   over a roster that sync hasn't brought in yet.
 * Nothing is deleted: switching the pick back shows the other entries again with their data.
 */
import type { Character, GameContract, TeamPreset } from '../contract';
import { getPrefs, updatePrefs } from './prefs';
import { gameData, setRosterEntry } from './userData';

interface Forms {
  /** Entries of the option you didn't pick. */
  hidden: Set<string>;
  /** Hidden entry → your pick's entry in the same form. */
  swap: Map<string, string>;
  /** Your pick's entries. */
  mine: string[];
}

/** Which entries are hidden, swapped or yours, from the game's character list. */
export function protagonistForms(game: GameContract, pick: string, characters: Character[]): Forms {
  const p = game.protagonist;
  const hidden = new Set<string>();
  const swap = new Map<string, string>();
  const mine: string[] = [];
  if (!p) return { hidden, swap, mine };
  const byForm = new Map<string, string>();
  for (const c of characters) {
    const f = p.of(c);
    if (f?.option === pick) {
      mine.push(c.id);
      byForm.set(f.form, c.id);
    }
  }
  for (const c of characters) {
    const f = p.of(c);
    if (!f || f.option === pick) continue;
    hidden.add(c.id);
    const to = byForm.get(f.form);
    if (to) swap.set(c.id, to);
  }
  return { hidden, swap, mine };
}

/** Game teams: a hidden form becomes your pick's form; an id never shows twice in a slot. */
export function swapTeams(teams: TeamPreset[], forms: Forms): TeamPreset[] {
  return teams.map((t) => ({
    ...t,
    slots: t.slots.map((s) => ({ characters: [...new Set(s.characters.map((id) => forms.swap.get(id) ?? id).filter((id) => !forms.hidden.has(id)))] })),
  }));
}

/** Mark your pick's entries owned where you haven't set them yourself. */
function ownMine(game: GameContract, forms: Forms): void {
  const roster = gameData(game.id).roster;
  for (const id of forms.mine) if (!roster[id]) setRosterEntry(game.id, id, { owned: true, wanted: false, dupes: 0 });
}

const cache = new WeakMap<GameContract, Map<string, GameContract>>();
/** Wrapped game → the game as registered (with both options). */
const originals = new WeakMap<GameContract, GameContract>();
/** Wrapped game → is this character hidden by your pick? */
const hiders = new WeakMap<GameContract, (id: string) => boolean>();
const nothingHidden = () => false;

/**
 * Is a character hidden by your pick, for the game a screen was given? Team rules use it to leave
 * hidden characters out of every pool (TeamAccount.skip). Always false with nothing picked.
 */
export const hiddenBy = (game: GameContract): ((id: string) => boolean) => hiders.get(game) ?? nothingHidden;

/**
 * The game as every screen should see it with your pick. Same object for the same game and pick,
 * so screens don't reload. No pick (or no such choice in the game) = the game unchanged.
 */
export function withProtagonist(game: GameContract, pick: string | undefined): GameContract {
  if (!game.protagonist || !pick || !game.protagonist.options.some((o) => o.id === pick)) return game;
  let byPick = cache.get(game);
  if (!byPick) cache.set(game, (byPick = new Map()));
  const hit = byPick.get(pick);
  if (hit) return hit;
  // Filled once the list loads; team rules are called after the screens have loaded it.
  let forms: Forms | null = null;
  const ready = game.data.characters().then((all) => (forms = protagonistForms(game, pick, all)));
  const kept = <T extends { characterId: string }>(list: T[], f: Forms) => list.filter((x) => !f.hidden.has(x.characterId));
  const { kits, builds } = game.data;
  const teamRules = game.rules.teams;
  const wrapped: GameContract = {
    ...game,
    data: {
      ...game.data,
      characters: async () => {
        const [all, f] = await Promise.all([game.data.characters(), ready]);
        return all.filter((c) => !f.hidden.has(c.id));
      },
      teams: async () => swapTeams(await game.data.teams(), await ready),
      ...(kits ? { kits: async () => kept(await kits(), await ready) } : {}),
      ...(builds ? { builds: async () => kept(await builds(), await ready) } : {}),
    },
    rules: {
      ...game.rules,
      ...(teamRules
        ? {
            teams: {
              ...teamRules,
              whoFits: (members, account, options) => teamRules.whoFits(members, account, options).filter((s) => !forms?.hidden.has(s.id)),
              lineUps: (account) => teamRules.lineUps(account).filter((idea) => !idea.members.some((id) => forms?.hidden.has(id))),
            },
          }
        : {}),
    },
  };
  byPick.set(pick, wrapped);
  originals.set(wrapped, game);
  hiders.set(wrapped, (id) => forms?.hidden.has(id) ?? false);
  return wrapped;
}

/** Pick your main character for a game: saved and synced with your settings, and their entries marked owned where you haven't set them. */
export async function chooseProtagonist(game: GameContract, pick: string): Promise<void> {
  updatePrefs((p) => ({ ...p, protagonists: { ...p.protagonists, [game.id]: pick } }));
  const all = originals.get(game) ?? game;
  ownMine(game, protagonistForms(all, pick, await all.data.characters()));
}

export const protagonistOf = (game: GameContract): string | undefined => getPrefs().protagonists?.[game.id];
