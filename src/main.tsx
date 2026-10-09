// Composition root: the only file that may wire games/ into the app.
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/jetbrains-mono';
import './core/theme/tokens.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerGame, registerModuleScreen } from './core/registry';
import { games } from './games';

for (const game of games) registerGame(game);
registerModuleScreen('pulls', () => import('./tools/pulls/PullsScreen'));
registerModuleScreen('events', () => import('./tools/events/EventsScreen'));
registerModuleScreen('backlog', () => import('./tools/backlog/BacklogScreen'));
registerModuleScreen('banners', () => import('./tools/banners/BannersScreen'));
registerModuleScreen('intel', () => import('./tools/intel/IntelScreen'));
registerModuleScreen('roster', () => import('./tools/roster/RosterScreen'));

const root = document.getElementById('root');
if (!root) throw new Error('PROJECT-HLITH: #root element missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
