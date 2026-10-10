// Composition root: the only file that may wire games/ into the app.
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/jetbrains-mono';
import './core/theme/tokens.css';
import './core/theme/tokens-light.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { withCatalog } from './core/data/catalog';
import { catalogRows } from './core/data/catalogSource';
import { registerGame, registerModuleScreen, registerPanel } from './core/registry';
import { applyTheme, savedTheme } from './core/theme/theme';
import { games as seedGames } from './games';
import { SharedTeamRoute } from './tools/share/ShareTeam';

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
applyTheme(savedTheme()); // before the first paint, so a light-theme user never sees a dark flash

const root = document.getElementById('root');
if (!root) throw new Error('PROJECT-HLITH: #root element missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
    {/* Opens a shared team link (#team=…) over any page: R54. */}
    <SharedTeamRoute games={games} />
  </StrictMode>,
);
