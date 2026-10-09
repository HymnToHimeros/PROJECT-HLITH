// Composition root: the only file that may wire games/ into the app.
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/jetbrains-mono';
import './core/theme/tokens.css';
import './core/theme/tokens-light.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerGame, registerModuleScreen, registerPanel } from './core/registry';
import { applyTheme, savedTheme } from './core/theme/theme';
import { games } from './games';

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
registerPanel('settings', () => import('./tools/account/AccountPanel'));
applyTheme(savedTheme()); // before the first paint, so a light-theme user never sees a dark flash

const root = document.getElementById('root');
if (!root) throw new Error('PROJECT-HLITH: #root element missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
