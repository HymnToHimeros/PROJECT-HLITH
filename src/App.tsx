import { listGames } from './core/registry';
import { Shell } from './core/shell/Shell';
import { Preview } from './core/ui/Preview';

export function App() {
  if (window.location.pathname.replace(/\/$/, '') === '/preview') return <Preview />;
  return <Shell games={listGames()} />;
}
