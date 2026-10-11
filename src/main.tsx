// Composition root: the only file that may wire games/ into the app.
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/jetbrains-mono';
import './core/theme/tokens.css';
import './core/theme/tokens-light.css';
import './core/theme/tokens-themes.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { withCatalog } from './core/data/catalog';
import { catalogRows } from './core/data/catalogSource';
import { registerGame, registerIdentity, registerModuleScreen, registerPanel } from './core/registry';
import { startAppShell } from './core/shell/appShell';
import { applyMotion, savedMotion } from './core/theme/motion';
import { applyTheme, savedTheme } from './core/theme/theme';
import { games as seedGames } from './games';
import { SharedTeamRoute } from './tools/share/ShareTeam';
import { useShellIdentity } from './tools/account/useShellIdentity';

// Each game's built-in lists, with the owner's updates (Owner console → Lists) laid over them.
const games = seedGames.map((g) => withCatalog(g, () => catalogRows()));
for (const game of games) registerGame(game);
registerModuleScreen('pulls', () => import('./tools/pulls/PullsScreen'));
registerModuleScreen('events', () => import('./tools/events/EventsScreen'));
registerModuleScreen('backlog', () => import('./tools/backlog/BacklogScreen'));
registerModuleScreen('banners', () => import('./tools/banners/BannersScreen'));
registerModuleScreen('intel', () => import('./tools/intel/IntelScreen'));
registerModuleScreen('roster', () => import('./tools/roster/RosterScreen'));
registerModuleScreen('today', () => import('./tools/today/TodayScreen'));
registerModuleScreen('calendar', () => import('./tools/calendar/CalendarScreen'));
registerModuleScreen('farm', () => import('./tools/farm/FarmScreen'));
registerPanel('assistant', () => import('./tools/assistant/AssistantPanel'));
registerPanel('account', () => import('./tools/account/AccountPage'));
registerIdentity(useShellIdentity); // the sidebar's profile card: picture, banner, name
applyTheme(savedTheme()); // before the first paint, so nobody sees a flash of the wrong theme
applyMotion(savedMotion()); // animations on / reduced / off, before anything moves
startAppShell(); // installable app: offline, updates, install offer (T45)

const root = document.getElementById('root');
if (!root) throw new Error('PROJECT-HLITH: #root element missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
    {/* Opens a shared team link (#team=…) over any page: R54. */}
    <SharedTeamRoute games={games} />
  </StrictMode>,
);
