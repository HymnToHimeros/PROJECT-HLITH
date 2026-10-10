import { createElement, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import type { GameContract, GameId, ModuleId } from '../contract';
import { updatePrefs, usePrefs } from '../data/prefs';
import { canSync, syncNow, useSyncStatus, type SyncStatus } from '../data/sync';
import { defaultLayout, phoneBar, slot, type LayoutState, type Scope } from '../registry/layout';
import { moduleScreen, MODULES, type ModuleScreenProps } from '../registry/modules';
import { panel, type PanelAccount, type PanelId, type PanelProps } from '../registry/panels';
import { useTheme } from '../theme/theme';
import { formatTime, serverRule } from '../time/reset';
import { BottomSheet } from '../ui/BottomSheet';
import { useSampleShown } from '../ui/sampleMarker';
import { Segmented } from '../ui/Segmented';
import { useNow } from '../ui/useNow';
import { EditLayout } from './EditLayout';
import { accountPath, navigate, parseAccountRoute, parseRoute, routePath, usePath } from './route';
import { ServerPicker } from './ServerPicker';
import { useIsPhone } from './useIsPhone';
import s from './shell.module.css';

interface Props {
  /** Every registered game. Which ones show is the viewer's choice. */
  games: GameContract[];
  /** Signed-in account, or null in "this device only" mode. */
  account?: PanelAccount | null;
  /** The signed-in account is an owner (checked on the server with public.is_owner()). */
  isOwner?: boolean;
}

type Sheet = null | 'more' | 'edit' | 'games' | 'assistant';

/** Saved-layout key shared by every scope (older per-game layouts are ignored, never deleted). */
const SHARED = 'shared';
const LONG_PRESS_MS = 500;

const tabsOf = (m: ModuleId | undefined) => (m ? MODULES[m]?.tabs : undefined);
/** The tab part of the address: left out for a module's first tab, so /hsr/pulls stays /hsr/pulls. */
const tabInPath = (m: ModuleId, t: string | undefined) => (t && t !== tabsOf(m)?.[0]?.id ? t : null);

/**
 * Layer 1: same for every game, never moves, never hides. Knows nothing about
 * servers, resets or currencies; those come from the game record.
 * Drawn to docs/design/HLITH App.dc.html: PC sidebar 248 px; phone top bar,
 * bottom bar with the first four modules + More, and a floating ASK button.
 */
export function Shell({ games: registered, account = null, isOwner = false }: Props) {
  const prefs = usePrefs();
  const sync = useSyncStatus();
  const path = usePath();
  const now = useNow(60_000);
  const phone = useIsPhone();
  const sample = useSampleShown();
  useTheme();
  const [sheet, setSheet] = useState<Sheet>(null);
  // The game scope you came from, so the Account page keeps its colour and "back" lands there.
  const [homeScope, setHomeScope] = useState<Scope | null>(null);
  const [tabs, setTabs] = useState<Record<string, string>>({});

  // Games in the switcher: the viewer's choice, else all. Never empty.
  const chosen = (prefs.games ?? registered.map((g) => g.id)).filter((id) => registered.some((g) => g.id === id));
  const games = chosen.length ? chosen.map((id) => registered.find((g) => g.id === id) as GameContract) : registered;
  const scopes: Scope[] = games.length > 1 ? ['all', ...games.map((g) => g.id)] : games.map((g) => g.id);

  const acct = parseAccountRoute(path);
  const route = acct ? { scope: homeScope, module: null, tab: null } : parseRoute(path);
  const scope: Scope = route.scope && scopes.includes(route.scope) ? route.scope : (scopes[0] ?? 'all');
  const game = scope === 'all' ? undefined : games.find((g) => g.id === scope);
  // One layout for every game and All games, so the bars mirror each other; modules a game lacks just drop out.
  const layout: LayoutState = prefs.layouts[SHARED] ?? defaultLayout();
  const visible = slot(games, scope, layout);
  const remembered = prefs.lastModule[scope];
  const active: ModuleId | undefined = acct
    ? undefined
    : route.module && visible.includes(route.module)
      ? route.module
      : remembered && visible.includes(remembered)
        ? remembered
        : visible[0];
  const { bar, more } = phoneBar(visible);
  // The open tab. The address is the truth once it names the module: /hsr/pulls/log is the Bank log, /hsr/pulls the first tab
  // (so the back button works). Without the module in the address, the last tab you picked there.
  const urlTab = route.module === active && route.tab && tabsOf(active)?.some((t) => t.id === route.tab) ? route.tab : null;
  const activeTab = tabsOf(active) ? ((route.module === active ? urlTab : active ? tabs[active] : null) ?? tabsOf(active)?.[0]?.id) : undefined;
  const setTab = (m: ModuleId, t: string) => {
    setTabs((cur) => ({ ...cur, [m]: t }));
    if (m === active) navigate(routePath(scope, m, tabInPath(m, t)));
  };

  // Keep the address in step with what is shown.
  useEffect(() => {
    if (acct || !active) return;
    const want = routePath(scope, active, tabInPath(active, activeTab));
    if (path !== want) navigate(want, true);
  }, [acct, active, activeTab, scope, path]);

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
  /** The Account page is a full page at /account/<section>; the browser's back button returns. */
  const openAccount = (section?: unknown, detail?: string) => {
    if (!acct) setHomeScope(scope);
    setSheet(null);
    // Screens often pass this straight to onClick, so ignore anything that isn't a section name.
    navigate(accountPath(typeof section === 'string' ? section : null, detail));
  };
  /** "Choose server" anywhere: Account → Game settings, with that game's picker first. */
  const openServer = (id: GameId) => openAccount('game-settings', id);
  const go = (nextScope: Scope, module?: ModuleId, tab?: string) => (e?: MouseEvent) => {
    e?.preventDefault();
    // Remember the tab you leave (it may have come from the address), so coming back keeps it.
    if (active && activeTab && tabs[active] !== activeTab) setTabs((cur) => ({ ...cur, [active]: activeTab }));
    if (module && tab) setTabs((cur) => ({ ...cur, [module]: tab }));
    const nextLayout = prefs.layouts[SHARED] ?? defaultLayout();
    const nextVisible = slot(games, nextScope, nextLayout);
    // Switching games keeps the page you're on when the other game has it.
    const remembered = prefs.lastModule[nextScope];
    const target = module ?? (active && nextVisible.includes(active) ? active : remembered && nextVisible.includes(remembered) ? remembered : nextVisible[0]);
    if (target) navigate(routePath(nextScope, target, tabInPath(target, tab ?? (target === active ? activeTab : tabs[target]))));
    setSheet(null);
  };
  const panelProps: PanelProps = {
    games,
    allGames: registered,
    scope,
    servers: prefs.servers,
    account,
    close: acct ? () => go(scope)() : close,
    open: (m, t) => go(scope, m, t)(),
    editLayout: () => setSheet('edit'),
    // Shows the Owner console section; every owner write is still checked on the server by public.is_owner().
    isOwner,
    section: acct?.section ?? undefined,
    detail: acct?.detail ?? undefined,
    goSection: (section, detail) => openAccount(section, detail),
  };
  const setLayout = (next: LayoutState) => updatePrefs((p) => ({ ...p, layouts: { ...p.layouts, [SHARED]: next } }));
  const setServer = (gameId: string, serverId: string) => updatePrefs((p) => ({ ...p, servers: { ...p.servers, [gameId]: serverId } }));
  const onSyncClick = () => {
    if (canSync()) void syncNow();
    else openAccount('sync');
  };

  const ventOf = (sc: Scope) => (sc === 'all' ? 'var(--vent-all)' : (games.find((g) => g.id === sc)?.vent ?? 'var(--vent-all)'));
  const labelOf = (sc: Scope) => (sc === 'all' ? 'ALL' : (games.find((g) => g.id === sc)?.short ?? sc));
  const scopeName = game ? game.name : 'All games';
  const moduleDef = active ? MODULES[active] : undefined;
  const accountPage = panel('account');
  const serverFor = (g: GameContract) => g.servers.find((sv) => sv.id === prefs.servers[g.id]);
  const clockGames = prefs.showServerTime ? (game ? [game] : games).filter((g) => serverFor(g)) : [];

  const switcher = (
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
      <button type="button" className={s.addBtn} aria-label="Add or remove games" title="Add a game" onClick={() => setSheet('games')}>
        +
      </button>
    </div>
  );
  const avatar = (size: 'sm' | 'md' | 'lg') => (
    <span className={`${s.avatar} ${size === 'lg' ? s.avatarLg : size === 'md' ? s.avatarMd : ''}`} aria-hidden="true">
      {account?.email.charAt(0).toUpperCase()}
    </span>
  );

  return (
    <div className={s.root} style={{ '--vent': ventOf(scope) } as CSSProperties}>
      {!phone && (
        <aside className={s.sidebar} aria-label="Main">
          <div className={s.brand}>
            <span className={s.wordmark}>HLITH</span>
            <span className={s.brandSub}>HLIÐSKJÁLF</span>
          </div>
          {switcher}
          <div className={s.navHead}>
            <span className={s.navLabel}>MODULES</span>
            <button type="button" className={s.editLink} onClick={() => setSheet('edit')}>
              Edit layout
            </button>
          </div>
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
          <div className={s.sideFoot}>
            <SyncLine status={sync} now={now} onClick={onSyncClick} />
            <button type="button" className={s.assistantBtn} onClick={() => setSheet('assistant')}>
              <span className={s.emberMark} aria-hidden="true" />
              <span className={s.grow}>Assistant</span>
              <span className={s.kbd} aria-hidden="true">
                ⌘K
              </span>
            </button>
            <button type="button" className={s.accountBtn} onClick={() => openAccount()} aria-current={acct ? 'page' : undefined}>
              {avatar('sm')}
              <span className={s.grow}>Account</span>
              <span className={s.dots} aria-hidden="true">
                ···
              </span>
            </button>
          </div>
        </aside>
      )}

      {phone && (
        <header className={s.topBar}>
          <span className={s.topWordmark}>HLITH</span>
          {switcher}
          <span className={s.topSpacer} />
          <SyncDot status={sync} now={now} onClick={onSyncClick} />
          <button type="button" className={s.avatarBtn} onClick={() => openAccount()} aria-label="Account" aria-current={acct ? 'page' : undefined}>
            {avatar('md')}
          </button>
        </header>
      )}

      {/* ── Module slot ── */}
      <main className={s.main}>
        {acct ? (
          <>
            <div className={s.header}>
              <div className={s.headerText}>
                <div className={s.scopeLabel}>YOUR ACCOUNT</div>
                <h1 className={s.title}>Account</h1>
              </div>
            </div>
            <div className={s.content}>
              {accountPage ? (
                <Suspense fallback={<p className={s.note}>Loading…</p>}>
                  <PanelSlot id="account" {...panelProps} />
                </Suspense>
              ) : (
                <>
                  <button type="button" className={s.sheetRow} onClick={() => setSheet('edit')}>
                    <span className={s.grow}>
                      <span className={s.rowTitle}>Layout settings</span>
                      <span className={s.rowSub}>Edit layout for {scope === 'all' ? 'All games' : labelOf(scope)}</span>
                    </span>
                    <span className={s.chev} aria-hidden="true">
                      ›
                    </span>
                  </button>
                  {games.map((g) => (
                    <ServerPicker key={g.id} game={g} value={prefs.servers[g.id]} onChange={(id) => setServer(g.id, id)} now={now} legend />
                  ))}
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <div className={s.header}>
              <div className={s.headerText}>
                <div className={s.scopeLabel}>{scopeName.toUpperCase()}</div>
                <h1 className={s.title}>{moduleDef?.label}</h1>
              </div>
              {clockGames.map((g) => (
                <ServerClock key={g.id} game={g} serverId={serverFor(g)?.id ?? ''} now={now} tag={!game} />
              ))}
              {sample && (
                <span className={s.sampleMark} title="Example values stand in until your own data or the game’s lists arrive. Look for the EXAMPLE notice on the page.">
                  SAMPLE DATA
                </span>
              )}
            </div>
            <div className={s.content}>
              {moduleDef?.tabs && (
                <Segmented
                  label={moduleDef.label}
                  tone="vent"
                  options={moduleDef.tabs}
                  value={activeTab ?? ''}
                  onChange={(t) => setTab(moduleDef.id, t)}
                />
              )}
              {active && moduleScreen(active) ? (
                <Suspense fallback={<p className={s.note}>Loading…</p>}>
                  <ModuleSlot
                    id={active}
                    games={games}
                    scope={scope}
                    tab={activeTab}
                    servers={prefs.servers}
                    openTab={(t) => setTab(active, t)}
                    open={(m, t) => go(scope, m, t)()}
                    openAccount={() => openAccount()}
                    openServer={openServer}
                  />
                </Suspense>
              ) : (
                <section className={s.placeholder}>
                  <span className="t-label">BEING BUILT</span>
                  <p>
                    {moduleDef?.label} for {scopeName} isn’t built yet. It shows nothing rather than made-up numbers. Progress is tracked in the
                    roadmap.
                  </p>
                </section>
              )}
            </div>
          </>
        )}
      </main>

      {phone && (
        <>
          <nav className={s.bottomBar} aria-label="Modules (phone)">
            {bar.map((id) => (
              <PhoneTab key={id} id={id} current={id === active} onOpen={go(scope, id)} onLongPress={() => setSheet('edit')} />
            ))}
            <button type="button" className={s.tab} aria-current={active && more.includes(active) ? 'page' : undefined} onClick={() => setSheet('more')}>
              <span className={s.tabGlyph} aria-hidden="true">
                ···
              </span>
              More
            </button>
          </nav>
          <button type="button" className={s.askFab} onClick={() => setSheet('assistant')} aria-label="Assistant">
            ASK
          </button>
        </>
      )}

      {/* ── Sheets ── */}
      <BottomSheet
        open={sheet === 'more'}
        title="More"
        onClose={close}
        placement="center"
        headerAction={
          <button type="button" className={s.sheetBtn} onClick={() => setSheet('edit')}>
            Edit layout
          </button>
        }
      >
        <div className={s.sheetGrid}>
          {more.map((id) => (
            <a key={id} href={routePath(scope, id)} className={s.sheetTile} aria-current={id === active ? 'page' : undefined} onClick={go(scope, id)}>
              <span className={s.tileGlyph} aria-hidden="true">
                {MODULES[id].glyph}
              </span>
              {MODULES[id].label}
            </a>
          ))}
        </div>
        <p className={s.note}>Your first 4 modules sit in the bar. Long-press any tab to change the order.</p>
      </BottomSheet>

      <BottomSheet open={sheet === 'edit'} title={`Edit layout · ${scopeName}`} onClose={close} placement="left" hideTitle>
        <EditLayout games={games} scope={scope} layout={layout} onChange={setLayout} onDone={close} scopeName={scopeName} />
      </BottomSheet>

      <BottomSheet open={sheet === 'games'} title="Add a game" onClose={close} placement="center" closeButton>
        <p className={s.sheetText}>
          A game is one record: name, vent colour, icon, currencies, reset times and the modules it supports. The shell stays the same. Turning a game off
          never deletes its data.
        </p>
        {registered.map((g) => {
          const on = chosen.includes(g.id);
          const last = on && chosen.length === 1;
          return (
            <div key={g.id} className={on ? s.gameRow : `${s.gameRow} ${s.gameRowOff}`} style={{ '--game-vent': g.vent } as CSSProperties}>
              <span className={s.gameIcon} aria-hidden="true">
                {g.short}
              </span>
              <span className={s.grow}>
                <span className={s.gameName}>{g.name}</span>
                <span className={s.gameMeta}>{on ? 'In your switcher' : 'not added yet'}</span>
              </span>
              <label className={s.switchLabel}>
                <input
                  type="checkbox"
                  role="switch"
                  className={s.switchInput}
                  checked={on}
                  disabled={last}
                  aria-label={g.name}
                  onChange={() =>
                    updatePrefs((p) => ({
                      ...p,
                      games: on ? chosen.filter((id) => id !== g.id) : registered.map((r) => r.id).filter((id) => id === g.id || chosen.includes(id)),
                    }))
                  }
                />
                <span className={s.switchTrack} aria-hidden="true" />
              </label>
            </div>
          );
        })}
        <p className={s.note}>More games arrive as their records are added. Nothing else changes.</p>
      </BottomSheet>

      <BottomSheet open={sheet === 'assistant'} title="Assistant" onClose={close} side>
        {panel('assistant') ? (
          <Suspense fallback={<p className={s.note}>Loading…</p>}>
            <PanelSlot id="assistant" {...panelProps} />
          </Suspense>
        ) : (
          <p className={s.note}>
            The Assistant isn’t built yet. It will use your own Claude key, answer from your data, and show what each message costs.
          </p>
        )}
      </BottomSheet>
    </div>
  );
}

/** Draws a registered panel. */
function PanelSlot({ id, ...props }: { id: PanelId } & PanelProps) {
  const p = panel(id);
  return p ? createElement(p, props) : null;
}

/** Draws the registered screen for a module (screens are prepared once at registration). */
function ModuleSlot({ id, ...props }: { id: ModuleId } & ModuleScreenProps) {
  const screen = moduleScreen(id);
  return screen ? createElement(screen, props) : null;
}

export function syncText(status: SyncStatus, now: number): string {
  if (status.state === 'synced') {
    const min = Math.floor((now - status.at) / 60_000);
    return min < 1 ? 'Synced just now' : min < 60 ? `Synced ${min} min ago` : `Synced ${formatTime(status.at)}`;
  }
  if (status.state === 'syncing') return 'Syncing…';
  if (status.state === 'failed') return 'Sync failed · saved on this device';
  if (status.state === 'signed-out') return 'Signed out';
  return 'Saved on this device only';
}

const syncTone = (status: SyncStatus) => (status.state === 'synced' ? s.syncOk : status.state === 'failed' ? s.syncFailed : '');

function SyncLine({ status, now, onClick }: { status: SyncStatus; now: number; onClick: () => void }) {
  return (
    <button type="button" className={`${s.sync} ${syncTone(status)}`} onClick={onClick} title={status.state === 'failed' ? status.message : 'Sync now'}>
      <span className={s.syncDot} aria-hidden="true" />
      <span role="status">{syncText(status, now)}</span>
    </button>
  );
}

function SyncDot({ status, now, onClick }: { status: SyncStatus; now: number; onClick: () => void }) {
  const text = syncText(status, now);
  return (
    <button type="button" className={`${s.syncDotBtn} ${syncTone(status)}`} onClick={onClick} title={text} aria-label={text}>
      <span className={s.syncDot} aria-hidden="true" />
    </button>
  );
}

/** "HSR 14:32 server time" next to the title (Account → Game settings → Show server time). */
function ServerClock({ game, serverId, now, tag }: { game: GameContract; serverId: string; now: number; tag: boolean }) {
  const rule = serverRule(game, serverId);
  const offset = rule.utcOffset * 3_600_000;
  const t = new Date(now + offset);
  const hh = String(t.getUTCHours()).padStart(2, '0');
  const mm = String(t.getUTCMinutes()).padStart(2, '0');
  return (
    <span className={s.serverClock} title={`${game.name}: time on your server`}>
      {tag ? `${game.short} ` : ''}
      {hh}:{mm} server time
    </span>
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
      <span className={s.tabGlyph} aria-hidden="true">
        {MODULES[id].glyph}
      </span>
      {MODULES[id].label}
    </button>
  );
}
