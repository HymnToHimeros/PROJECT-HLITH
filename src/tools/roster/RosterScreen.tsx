import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import type { GameContract } from '../../core/contract';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { usePrefs } from '../../core/data/prefs';
import { ProtagonistPicker } from '../../core/shell/ProtagonistPicker';
import { CharacterPage } from './CharacterPage';
import { Characters } from './Characters';
import r from './roster.module.css';
import { WithUserData } from './shared';
import { Teams, type PresetDraft } from './Teams';
import { useRosterLists, type RosterData } from './useRosterData';

type Tab = 'characters' | 'teams';

// Which game Roster shows in All games, remembered on this device (per viewer).
const GAME_KEY = 'hlith.roster.game';
const readGame = (): string | null => {
  try {
    return localStorage.getItem(GAME_KEY);
  } catch {
    return null;
  }
};
const writeGame = (id: string) => {
  try {
    localStorage.setItem(GAME_KEY, id);
  } catch {
    // Storage blocked (private window): the choice just isn't remembered.
  }
};

/**
 * Roster module (design: Roster → Characters | Teams, and the character page).
 * Always one game at a time: in All games a game switch at the top picks which.
 * Opening a character replaces the grid with its page, with "← Roster" back.
 */
export default function RosterScreen({ games, scope, tab, openTab, open, openAccount }: ModuleScreenProps) {
  const inScope = useMemo(() => (scope === 'all' ? games : games.filter((g) => g.id === scope)), [games, scope]);
  const [picked, setPicked] = useState<string | null>(readGame);
  const game = inScope.find((g) => g.id === picked) ?? inScope[0];
  const shown = useMemo(() => (game ? [game] : []), [game]);
  const lists = useRosterLists(shown);
  const current: Tab = tab === 'teams' ? 'teams' : 'characters';
  // The open character belongs to the tab it was opened from; switching tabs goes back to that tab's list.
  const [page, setPage] = useState<{ tab: Tab; game: string; id: string } | null>(null);
  // "Make a preset with them" on a character page: Teams opens its editor with this, once.
  const [draft, setDraft] = useState<PresetDraft | null>(null);
  const draftUsed = useCallback(() => setDraft(null), []);
  const choose = (id: string) => {
    setPicked(id);
    writeGame(id);
    setPage(null);
  };

  const switcher = inScope.length > 1 && game ? <GameSwitch games={inScope} value={game.id} onChange={choose} /> : null;
  if (!lists) {
    return (
      <div className={r.stack}>
        {switcher}
        <p className={r.muted}>Loading characters…</p>
      </div>
    );
  }

  return (
    <WithUserData games={shown}>
      {(users) => {
        const data: RosterData[] = shown.flatMap((g) => {
          const l = lists[g.id];
          const user = users[g.id];
          return l && user ? [{ ...l, game: g, user }] : [];
        });
        const openPage = (gameId: string, id: string) => setPage({ tab: current, game: gameId, id });
        const pageData = page && page.tab === current ? data.find((d) => d.game.id === page.game) : undefined;
        const character = page && pageData?.byId.get(page.id);
        if (pageData && character) {
          return (
            <CharacterPage
              key={`${pageData.game.id}:${character.id}`}
              data={pageData}
              character={character}
              several={false}
              onBack={() => setPage(null)}
              openPulls={pageData.game.modules.includes('pulls') ? (t) => open('pulls', t) : undefined}
              openFarm={pageData.game.modules.includes('farm') ? () => open('farm') : undefined}
              makePreset={() => {
                setDraft({ game: pageData.game.id, members: [character.id] });
                setPage(null);
                openTab('teams');
              }}
            />
          );
        }
        return (
          <div className={r.stack}>
            {switcher}
            {game && <MainCharacterPrompt game={game} />}
            {current === 'teams' ? (
              <Teams data={data} several={false} onOpen={openPage} openCharacters={() => openTab('characters')} openAccount={openAccount} draft={draft} onDraftUsed={draftUsed} />
            ) : (
              <Characters data={data} several={false} onOpen={openPage} />
            )}
          </div>
        );
      }}
    </WithUserData>
  );
}

/** Until you pick your main character (HSR: Caelus or Stelle), both show; this asks once, at the top. */
function MainCharacterPrompt({ game }: { game: GameContract }) {
  const picked = usePrefs().protagonists?.[game.id];
  if (!game.protagonist || picked) return null;
  return (
    <section className={r.mainPick} aria-label={`Pick your ${game.protagonist.label}`}>
      <p className={r.mainPickText}>
        <strong>Which {game.protagonist.label} is yours?</strong> Pick one: their entries count as owned, and the other one is hidden everywhere. You can switch in Account → Game settings.
      </p>
      <ProtagonistPicker game={game} />
    </section>
  );
}

/** One game at a time: the game short names, tinted with each game's vent like the shell's switch. */
function GameSwitch({ games, value, onChange }: { games: GameContract[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className={r.gameSwitch} role="group" aria-label="Roster game">
      {games.map((g) => (
        <button
          key={g.id}
          type="button"
          className={r.gameSwitchBtn}
          aria-pressed={g.id === value}
          title={g.name}
          style={{ '--game-vent': g.vent } as CSSProperties}
          onClick={() => onChange(g.id)}
        >
          {g.short}
        </button>
      ))}
    </div>
  );
}
