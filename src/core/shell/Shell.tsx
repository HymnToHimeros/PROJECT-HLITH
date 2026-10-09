import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import type { GameContract, ModuleId } from '../contract';
import { updatePrefs, usePrefs } from '../data/prefs';
import { defaultLayout, phoneBar, slot, type LayoutState, type Scope } from '../registry/layout';
import { MODULES } from '../registry/modules';
import { formatTime, nextDailyReset, serverRule } from '../time/reset';
import { BottomSheet } from '../ui/BottomSheet';
import { Segmented } from '../ui/Segmented';
import { useNow } from '../ui/useNow';
import { EditLayout } from './EditLayout';
import { navigate, parseRoute, routePath, usePath } from './route';
import { ServerPicker } from './ServerPicker';
import s from './shell.module.css';

interface Props {
  /** Every registered game. Which ones show is the viewer's choice. */
  games: GameContract[];
}

type Sheet = null | 'more' | 'edit' | 'account' | 'games' | 'assistant' | 'pick-game';

const LONG_PRESS_MS = 500;

/**
 * Layer 1: same for every game, never moves, never hides. Knows nothing about
 * servers, resets or currencies; those come from the game record.
 */
export function Shell({ games: registered }: Props) {
  const prefs = usePrefs();
  const path = usePath();
  const now = useNow(60_000);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [tabs, setTabs] = useState<Record<string, string>>({});

  // Games in the switcher: the viewer's choice, else all. Never empty.
  const chosen = (prefs.games ?? registered.map((g) => g.id)).filter((id) => registered.some((g) => g.id === id));
  const games = chosen.length ? chosen.map((id) => registered.find((g) => g.id === id) as GameContract) : registered;
  const scopes: Scope[] = games.length > 1 ? ['all', ...games.map((g) => g.id)] : games.map((g) => g.id);

  const route = parseRoute(path);
  const scope: Scope = route.scope && scopes.includes(route.scope) ? route.scope : (scopes[0] ?? 'all');
  const game = scope === 'all' ? undefined : games.find((g) => g.id === scope);
  const layout: LayoutState = prefs.layouts[scope] ?? defaultLayout(games, scope);
  const visible = slot(games, scope, layout);
  const remembered = prefs.lastModule[scope];
  const active: ModuleId | undefined =
    route.module && visible.includes(route.module)
      ? route.module
      : remembered && visible.includes(remembered)
        ? remembered
        : visible[0];
  const { bar, more } = phoneBar(visible);

  // Keep the address in step with what is shown.
  useEffect(() => {
    if (active && path !== routePath(scope, active)) navigate(routePath(scope, active), true);
  }, [active, scope, path]);

  useEffect(() => {
    if (active && prefs.lastModule[scope] !== active) {
      updatePrefs((p) => ({ ...p, lastModule: { ...p.lastModule, [scope]: active } }));
    }
  }, [active, scope, prefs.lastModule]);

  // ⌘K / Ctrl+K opens the Assistant from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSheet((cur) => (cur === 'assistant' ? null : 'assistant'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = useCallback(() => setSheet(null), []);
  const setLayout = (next: LayoutState) => updatePrefs((p) => ({ ...p, layouts: { ...p.layouts, [scope]: next } }));
  const setServer = (gameId: string, serverId: string) => updatePrefs((p) => ({ ...p, servers: { ...p.servers, [gameId]: serverId } }));
  const go = (nextScope: Scope, module?: ModuleId) => (e?: MouseEvent) => {
    e?.preventDefault();
    const nextLayout = prefs.layouts[nextScope] ?? defaultLayout(games, nextScope);
    const nextVisible = slot(games, nextScope, nextLayout);
    const target = module ?? (prefs.lastModule[nextScope] && nextVisible.includes(prefs.lastModule[nextScope]) ? prefs.lastModule[nextScope] : nextVisible[0]);
    if (target) navigate(routePath(nextScope, target));
    setSheet(null);
  };

  const ventOf = (sc: Scope) => (sc === 'all' ? 'var(--vent-all)' : (games.find((g) => g.id === sc)?.vent ?? 'var(--vent-all)'));
  const labelOf = (sc: Scope) => (sc === 'all' ? 'ALL' : (games.find((g) => g.id === sc)?.short ?? sc));
  const scopeName = game ? game.name : 'All games';
  const moduleDef = active ? MODULES[active] : undefined;
  const serverId = game ? prefs.servers[game.id] : undefined;
  const server = game?.servers.find((sv) => sv.id === serverId);

  return (
    <div className={s.root} style={{ '--vent': ventOf(scope) } as CSSProperties}>
      {/* ── PC sidebar ── */}
      <aside className={s.sidebar} aria-label="Main">
        <div className={s.brand}>
          <span className={s.wordmark}>HLITH</span>
          <span className={s.brandSub}>HLIÐSKJÁLF</span>
        </div>
        <div className={s.switcher} role="group" aria-label="Game">
          {scopes.map((sc) => (
            <button
              key={sc}
              type="button"
              className={s.gameBtn}
              aria-pressed={sc === scope}
              style={{ '--game-vent': ventOf(sc) } as CSSProperties}
              onClick={go(sc)}
              title={sc === 'all' ? 'All games' : games.find((g) => g.id === sc)?.name}
            >
              {labelOf(sc)}
            </button>
          ))}
          <button type="button" className={s.gameBtn} aria-label="Add or remove games" onClick={() => setSheet('games')}>
            +
          </button>
        </div>
        <span className={s.navLabel}>MODULES</span>
        <nav className={s.nav} aria-label="Modules">
          {visible.map((id) => (
            <a key={id} href={routePath(scope, id)} className={s.navItem} aria-current={id === active ? 'page' : undefined} onClick={go(scope, id)}>
              <span className={s.glyph} aria-hidden="true">
                {MODULES[id].glyph}
              </span>
              {MODULES[id].label}
            </a>
          ))}
        </nav>
        <button type="button" className={s.linkBtn} onClick={() => setSheet('edit')}>
          Edit layout
        </button>
        <div className={s.sideFoot}>
          <span className={s.sync}>
            <span className={s.syncDot} aria-hidden="true" />
            Saved on this device · no sync yet
          </span>
          <button type="button" className={s.assistantBtn} onClick={() => setSheet('assistant')}>
            Assistant <span className={s.kbd}>⌘K</span>
          </button>
          <button type="button" className={s.accountBtn} onClick={() => setSheet('account')}>
            Account
          </button>
        </div>
      </aside>

      {/* ── Phone top bar ── */}
      <header className={s.topBar}>
        <button type="button" className={s.gamePick} onClick={() => setSheet('pick-game')} aria-label={`Game: ${scopeName}. Change game`}>
          <span className={s.gamePickDot} aria-hidden="true" />
          {labelOf(scope)} ▾
        </button>
        <span className={s.topSpacer} />
        <button type="button" className={s.iconBtn} onClick={() => setSheet('account')}>
          Account
        </button>
        <button type="button" className={s.askBtn} onClick={() => setSheet('assistant')}>
          Ask
        </button>
      </header>

      {/* ── Module slot ── */}
      <main className={s.main}>
        <div className={s.header}>
          <div className={s.headerInner}>
            <div>
              <div className="t-label">{scopeName.toUpperCase()}</div>
              <h1 className={s.title}>{moduleDef?.label}</h1>
            </div>
            {game &&
              (server ? (
                <button type="button" className={s.serverChip} onClick={() => setSheet('account')}>
                  {server.label} · reset {formatTime(nextDailyReset(now, serverRule(game, server.id)))} your time
                </button>
              ) : (
                <button type="button" className={`${s.serverChip} ${s.serverChipEmpty}`} onClick={() => setSheet('account')}>
                  Choose your {game.short} server
                </button>
              ))}
          </div>
        </div>
        <div className={s.content}>
          {moduleDef?.tabs && (
            <Segmented
              label={moduleDef.label}
              options={moduleDef.tabs}
              value={tabs[moduleDef.id] ?? moduleDef.tabs[0]?.id ?? ''}
              onChange={(t) => setTabs((cur) => ({ ...cur, [moduleDef.id]: t }))}
            />
          )}
          <section className={s.placeholder}>
            <span className="t-label">BEING BUILT</span>
            <p>
              {moduleDef?.label} for {scopeName} isn’t built yet. It shows nothing rather than made-up numbers. Progress is tracked in the
              roadmap.
            </p>
          </section>
        </div>
      </main>

      {/* ── Phone bottom bar ── */}
      <nav className={s.bottomBar} aria-label="Modules (phone)">
        {bar.map((id) => (
          <PhoneTab key={id} id={id} current={id === active} onOpen={go(scope, id)} onLongPress={() => setSheet('edit')} />
        ))}
        <button type="button" className={s.tab} aria-current={active && more.includes(active) ? 'page' : undefined} onClick={() => setSheet('more')}>
          <span className={s.glyph} aria-hidden="true">
            ···
          </span>
          More
        </button>
      </nav>

      {/* ── Sheets ── */}
      <BottomSheet open={sheet === 'more'} title="More" onClose={close}>
        <div className={s.sheetGrid}>
          {more.map((id) => (
            <a key={id} href={routePath(scope, id)} className={s.sheetTile} aria-current={id === active ? 'page' : undefined} onClick={go(scope, id)}>
              {MODULES[id].label}
            </a>
          ))}
        </div>
        <button type="button" className={s.linkBtn} onClick={() => setSheet('edit')}>
          Edit layout
        </button>
      </BottomSheet>

      <BottomSheet open={sheet === 'pick-game'} title="Game" onClose={close}>
        <div className={s.sheetGrid}>
          {scopes.map((sc) => (
            <button key={sc} type="button" className={s.sheetTile} aria-current={sc === scope ? 'page' : undefined} onClick={go(sc)} style={{ '--vent': ventOf(sc) } as CSSProperties}>
              {labelOf(sc)}
            </button>
          ))}
        </div>
        <button type="button" className={s.linkBtn} onClick={() => setSheet('games')}>
          Add or remove games
        </button>
      </BottomSheet>

      <BottomSheet open={sheet === 'edit'} title={`Edit layout · ${scopeName}`} onClose={close} side>
        <EditLayout games={games} scope={scope} layout={layout} onChange={setLayout} onDone={close} />
      </BottomSheet>

      <BottomSheet open={sheet === 'games'} title="Your games" onClose={close} side>
        <p className={s.note}>Pick which games appear in the switcher. Turning a game off never deletes its data.</p>
        {registered.map((g) => {
          const on = chosen.includes(g.id);
          return (
            <label key={g.id} className={s.gameRow} style={{ '--game-vent': g.vent } as CSSProperties}>
              <input
                type="checkbox"
                checked={on}
                disabled={on && chosen.length === 1}
                onChange={() =>
                  updatePrefs((p) => ({
                    ...p,
                    games: on ? chosen.filter((id) => id !== g.id) : registered.map((r) => r.id).filter((id) => id === g.id || chosen.includes(id)),
                  }))
                }
              />
              {g.name}
            </label>
          );
        })}
      </BottomSheet>

      <BottomSheet open={sheet === 'account'} title="Account" onClose={close} side>
        <div className={s.section}>
          <span className={s.sectionLabel}>LAYOUT</span>
          <button type="button" className={s.linkBtn} onClick={() => setSheet('edit')}>
            Edit layout for {scopeName}
          </button>
        </div>
        <div className={s.section}>
          <span className={s.sectionLabel}>GAME SETTINGS</span>
          {games.map((g) => (
            <ServerPicker key={g.id} game={g} value={prefs.servers[g.id]} onChange={(id) => setServer(g.id, id)} now={now} />
          ))}
        </div>
        <div className={s.section}>
          <span className={s.sectionLabel}>SIGN IN · SYNC · BACKUP</span>
          <p className={s.note}>Not built yet. Until then your settings stay on this device only.</p>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'assistant'} title="Assistant" onClose={close} side>
        <p className={s.note}>
          The Assistant isn’t built yet. It will use your own Claude key, answer from your data, and show what each message costs.
        </p>
      </BottomSheet>
    </div>
  );
}

/** Phone tab: tap opens the module, a 500 ms press opens Edit layout. */
function PhoneTab({ id, current, onOpen, onLongPress }: { id: ModuleId; current: boolean; onOpen: () => void; onLongPress: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const start = () => {
    fired.current = false;
    timer.current = setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  };
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <button
      type="button"
      className={s.tab}
      aria-current={current ? 'page' : undefined}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (!fired.current) onOpen();
      }}
    >
      <span className={s.glyph} aria-hidden="true">
        {MODULES[id].glyph}
      </span>
      {MODULES[id].label}
    </button>
  );
}
