import { Preview } from './core/ui/Preview';

// Placeholder until the shell lands (ROADMAP R17). /preview shows the shared components.
export function App() {
  if (window.location.pathname.replace(/\/$/, '') === '/preview') return <Preview />;
  return (
    <main style={{ minHeight: '100vh', padding: 24 }}>
      <h1 className="t-display">HLIÐSKJÁLF</h1>
      <p style={{ color: 'var(--ink-3)' }}>
        PROJECT-HLITH is being built. Nothing to show yet. <a href="/preview">See the shared components</a>.
      </p>
    </main>
  );
}
