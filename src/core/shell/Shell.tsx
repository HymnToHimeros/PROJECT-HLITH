import { createElement, useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import type { GameContract, GameId, ModuleId } from '../contract';
import { withProtagonist } from '../data/protagonist';
import { updatePrefs, usePrefs } from '../data/prefs';
import { canSync, syncNow, useSyncStatus, type SyncStatus } from '../data/sync';
import { defaultLayout, hiddenIn, phoneBar, restore, slot, type LayoutState, type Scope } from '../registry/layout';
import { moduleScreen, MODULES, type ModuleScreenProps } from '../registry/modules';
import { useIdentity } from '../registry/identity';
import { panel, type PanelAccount, type PanelId, type PanelProps } from '../registry/panels';
import { useLook } from '../theme/look';
import { withVent } from '../theme/vents';
import { setDisplayFormat } from '../time/displayFormat';
import { useMotion } from '../theme/motion';
import { useGlide } from './useGlide';
import { LazyArea } from './LazyArea';
import { useOwnerTheme, useTheme } from '../theme/theme';
import { OwnerArt } from '../theme/OwnerArt';
import a from '../theme/art.module.css';
import { useBackground } from '../data/backgrounds';
import { ThemeArt, ThemeMotif } from '../theme/ThemeArt';
import { formatTime, serverRule } from '../time/reset';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { initials } from '../ui/CharacterTile';
import { useSampleShown } from '../ui/sampleMarker';
import { Segmented } from '../ui/Segmented';
import { useNow } from '../ui/useNow';
import { AnnouncementStrip } from './AnnouncementStrip';
import { AppStatus } from './AppStatus';
import { EditLayout } from './EditLayout';
import { accountPath, COMMUNITY_PATH, isCommunityPath, navigate, parseAccountRoute, parseRoute, routePath, usePath } from './route';
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
  /** False while the server is still being asked whether this account is an owner. */
  ownerChecked?: boolean;
  /** A community member: tester or owner (public.is_member() on the server, T60). Shows the Community link. */
  isMember?: boolean;
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
/** The start screen (Account → Layout) is for the first screen of a visit only. */
let startShown = false;
/** For tests: a fresh visit. */
export const resetStartScreen = () => {
  startShown = false;
};

export function Shell({ games: registered, account = null, isOwner = false, ownerChecked = true, isMember = false }: Props) {
  const prefs = usePrefs();
  const sync = useSyncStatus();
  const path = usePath();
  const now = useNow(60_000);
  const phone = useIsPhone();
  const sample = useSampleShown();
  useMotion();
  useLook();
  const identity = useIdentity(account);
  const [sheet, setSheet] = useState<Sheet>(null);
  // The game scope you came from, so the Account page keeps its colour and "back" lands there.
  const [homeScope, setHomeScope] = useState<Scope | null>(null);
  const [tabs, setTabs] = useState<Record<string, string>>({});

  // Games in the switcher: the viewer's choice, else all. Never empty.
  const chosen = (prefs.games ?? registered.map((g) => g.id)).filter((id) => registered.some((g) => g.id === id));
  // Each game as you see it: with your main character picked, the other one is hidden everywhere (protagonist.ts).
  // Each game as you see it: with your main character picked, the other one is hidden everywhere (protagonist.ts),
  // and in your own colour if you picked one (Customise → Look → Game colours).
  const games = (chosen.length ? chosen.map((id) => registered.find((g) => g.id === id) as GameContract) : registered).map((g) => withVent(withProtagonist(g, prefs.protagonists?.[g.id]), prefs.gameVents));
  // Customise → Time and format: every formatter reads it while this draws.
  setDisplayFormat(prefs.format);
  const scopes: Scope[] = games.length > 1 ? ['all', ...games.map((g) => g.id)] : games.map((g) => g.id);

  const acct = parseAccountRoute(path);
  // Pages outside the modules: Account (/account/…) and Community (/community, T60).
  const community = isCommunityPath(path);
  const page = Boolean(acct) || community;
  const route = page ? { scope: homeScope, module: null, tab: null } : parseRoute(path);
  const scope: Scope = route.scope && scopes.includes(route.scope) ? route.scope : prefs.defaultScope && scopes.includes(prefs.defaultScope) ? prefs.defaultScope : (scopes[0] ?? 'all');
  const theme = useTheme(scope, now);
  const ownerTheme = useOwnerTheme(scope, now);
  const game = scope === 'all' ? undefined : games.find((g) => g.id === scope);
  // One layout for every game and All games, so the bars mirror each other; modules a game lacks just drop out.
  const layout: LayoutState = prefs.layouts[SHARED] ?? defaultLayout();
  const visible = slot(games, scope, layout);
  // Hidden modules stay reachable: a Guide or checklist button (or an old link) opens them, with a Restore note.
  const hiddenHere = hiddenIn(games, scope, layout);
  // Account → Layout → Start screen: only for the first screen of a visit opened without a module in the address.
  const start = !startShown && !page && !route.module ? prefs.startModule : undefined;
  const remembered = (start && visible.includes(start) ? start : undefined) ?? prefs.lastModule[scope];
  const active: ModuleId | undefined = page
    ? undefined
    : route.module && (visible.includes(route.module) || hiddenHere.includes(route.module))
      ? route.module
      : remembered && visible.includes(remembered)
        ? remembered
        : visible[0];
  useEffect(() => {
    if (route.module || page) startShown = true;
  }, [route.module, page]);
  const { bar, more } = phoneBar(visible);
  // The sliding "you are here" markers (T50): sidebar row and bottom-bar glyph.
  const navRef = useGlide<HTMLElement>('[aria-current="page"]', [active, visible.join(','), phone]);
  const barRef = useGlide<HTMLElement>(`[aria-current="page"] .${s.tabGlyph}`, [active, bar.join(','), phone]);
  // The open tab. The address is the truth once it names the module: /hsr/pulls/log is the Bank log, /hsr/pulls the first tab
  // (so the back button works). Without the module in the address, the last tab you picked there.
  const urlTab = route.module === active && route.tab && tabsOf(active)?.some((t) => t.id === route.tab) ? route.tab : null;
  // Customise → Layout can name the tab a module opens on.
  const startTab = active ? prefs.startTabs?.[active] : undefined;
  const openingTab = startTab && tabsOf(active)?.some((t) => t.id === startTab) ? startTab : tabsOf(active)?.[0]?.id;
  const activeTab = tabsOf(active) ? ((route.module === active ? urlTab : active ? tabs[active] : null) ?? openingTab) : undefined;
  const setTab = (m: ModuleId, t: string) => {
    setTabs((cur) => ({ ...cur, [m]: t }));
    if (m === active) navigate(routePath(scope, m, tabInPath(m, t)));
  };

  // Keep the address in step with what is shown.
  useEffect(() => {
    if (page || !active) return;
    const want = routePath(scope, active, tabInPath(active, activeTab));
    if (path !== want) navigate(want, true);
  }, [page, active, activeTab, scope, path]);

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
    if (!page) setHomeScope(scope);
    setSheet(null);
    // Screens often pass this straight to onClick, so ignore anything that isn't a section name.
    navigate(accountPath(typeof section === 'string' ? section : null, detail));
  };
  /** The Community page (members only, T60). */
  const openCommunity = (e?: MouseEvent) => {
    e?.preventDefault();
    if (!page) setHomeScope(scope);
    setSheet(null);
    navigate(COMMUNITY_PATH);
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
    close: page ? () => go(scope)() : close,
    open: (m, t) => go(scope, m, t)(),
    editLayout: () => setSheet('edit'),
    // Shows the Owner console section; every owner write is still checked on the server by public.is_owner().
    isOwner,
    ownerChecked,
    isMember,
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
      <button type="button" className={s.addBtn} aria-label="Choose which games show" title="Choose which games show" onClick={() => setSheet('games')}>
        +
      </button>
    </div>
  );
  // Your name from Account → Profile, else the part of your email before the @.
  // Customise → Background picture: this page's, else this theme's, else every page's.
  const background = useBackground([...(active ? [`page:${active}` as const] : []), `theme:${ownerTheme ? `owner:${ownerTheme.id}` : theme}`, 'all']);
  const displayName = identity?.name ?? (account ? (account.email.split('@')[0] ?? null) : null);

  return (
    <div className={s.root} style={{ '--vent': ventOf(scope) } as CSSProperties}>
      {ownerTheme ? <OwnerArt theme={ownerTheme} /> : <ThemeArt theme={theme} />}
      {background && (
        <div className={a.art} style={{ opacity: 1 }} aria-hidden="true" data-art="yours">
          <img className={a.yourPicture} src={background.url} alt="" decoding="async" style={{ opacity: background.strength }} />
        </div>
      )}
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
          <nav ref={navRef} className={s.nav} aria-label="Modules">
            {visible.map((id) => (
              <a key={id} href={routePath(scope, id)} className={s.navItem} aria-current={id === active ? 'page' : undefined} onClick={go(scope, id)}>
                <span className={s.glyph} aria-hidden="true">
                  {MODULES[id].glyph}
                </span>
                {MODULES[id].label}
              </a>
            ))}
          </nav>
          {isMember && (
            <>
              <div className={s.navHead}>
                <span className={s.navLabel}>COMMUNITY</span>
              </div>
              <nav className={s.nav} aria-label="Community">
                <a href={COMMUNITY_PATH} className={s.navItem} aria-current={community ? 'page' : undefined} onClick={openCommunity}>
                  <span className={s.glyph} aria-hidden="true">
                    CM
                  </span>
                  Community
                </a>
              </nav>
            </>
          )}
          {/* The theme's emblem fills the empty part of the sidebar; it shrinks away when the menu needs the room. */}
          <div className={s.sideArt} aria-hidden="true">
            <ThemeMotif theme={theme} className={s.sideMotif} />
          </div>
          <div className={s.sideFoot}>
            <SyncLine status={sync} now={now} onClick={onSyncClick} />
            <button type="button" className={s.assistantBtn} onClick={() => setSheet('assistant')}>
              <span className={s.emberMark} aria-hidden="true" />
              <span className={s.grow}>Assistant</span>
              <span className={s.kbd} aria-hidden="true">
                ⌘K
              </span>
            </button>
            <ProfileCard name={displayName} avatarUrl={identity?.avatarUrl ?? null} bannerUrl={identity?.bannerUrl ?? null} current={Boolean(acct)} onClick={() => openAccount()} />
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
            <Avatar url={identity?.avatarUrl ?? null} name={displayName} className={`${s.avatar} ${s.avatarMd}`} />
          </button>
        </header>
      )}

      {/* ── Module slot ── */}
      <main className={s.main}>
        <AppStatus />
        <AnnouncementStrip />
        {community ? (
          <>
            <div className={s.header}>
              <div className={s.headerText}>
                <div className={s.scopeLabel}>MEMBERS ONLY</div>
                <h1 className={s.title}>Community</h1>
              </div>
            </div>
            <div className={s.content}>
              {panel('community') ? (
                <LazyArea resetKey="community">
                  <div className="hlith-enter">
                    <PanelSlot id="community" {...panelProps} />
                  </div>
                </LazyArea>
              ) : (
                <p className={s.note}>The community page isn’t available here.</p>
              )}
            </div>
          </>
        ) : acct ? (
          <>
            <div className={s.header}>
              <div className={s.headerText}>
                <div className={s.scopeLabel}>YOUR ACCOUNT</div>
                <h1 className={s.title}>Account</h1>
              </div>
            </div>
            <div className={s.content}>
              {accountPage ? (
                <LazyArea resetKey="account">
                  <PanelSlot id="account" {...panelProps} />
                </LazyArea>
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
              {active && hiddenHere.includes(active) && (
                <p className={s.hiddenNote} role="status">
                  <span className={s.grow}>{MODULES[active].label} is hidden in your layout, so it isn’t in the menu.</span>
                  <Button variant="quiet" onClick={() => setLayout(restore(layout, active))}>
                    Restore {MODULES[active].label}
                  </Button>
                </p>
              )}
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
                <LazyArea resetKey={`${scope}:${active}`}>
                  {/* Keyed by screen and tab, so each change plays the enter animation once (T50). */}
                  <div key={`${scope}:${active}:${activeTab ?? ''}`} className="hlith-enter">
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
                  </div>
                </LazyArea>
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
          <nav ref={barRef} className={s.bottomBar} aria-label="Modules (phone)">
            {bar.map((id) => (
              <PhoneTab key={id} id={id} current={id === active} onOpen={go(scope, id)} onLongPress={() => setSheet('edit')} />
            ))}
            <button type="button" className={s.tab} aria-current={(active && more.includes(active)) || community ? 'page' : undefined} onClick={() => setSheet('more')}>
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
          {isMember && (
            <a href={COMMUNITY_PATH} className={s.sheetTile} aria-current={community ? 'page' : undefined} onClick={openCommunity}>
              <span className={s.tileGlyph} aria-hidden="true">
                CM
              </span>
              Community
            </a>
          )}
        </div>
        <p className={s.note}>Your first 4 modules sit in the bar. Long-press any tab to change the order.</p>
      </BottomSheet>

      <BottomSheet open={sheet === 'edit'} title={`Edit layout · ${scopeName}`} onClose={close} placement="left" hideTitle>
        <EditLayout games={games} scope={scope} layout={layout} onChange={setLayout} onDone={close} scopeName={scopeName} />
      </BottomSheet>

      <BottomSheet open={sheet === 'games'} title="Choose which games show" onClose={close} placement="center" closeButton>
        <p className={s.sheetText}>
          Switch on the games you play. Switched-off games leave the switcher and the All games view, but everything you saved for them is kept and
          comes back when you switch them on again.
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
                <span className={s.gameMeta}>{on ? 'Shown' : 'Switched off'}</span>
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
        <p className={s.note}>More games will appear here when HLITH supports them.</p>
      </BottomSheet>

      <BottomSheet open={sheet === 'assistant'} title="Assistant" onClose={close} side>
        {panel('assistant') ? (
          <LazyArea resetKey="assistant">
            <PanelSlot id="assistant" {...panelProps} />
          </LazyArea>
        ) : (
          <p className={s.note}>
            The Assistant isn’t built yet. It will use your own Claude key, answer from your data, and show what each message costs.
          </p>
        )}
      </BottomSheet>
    </div>
  );
}

/** Your picture, or your initials, or a plain figure when there is no name yet. */
export function Avatar({ url, name, className }: { url: string | null; name: string | null; className: string | undefined }) {
  // A picture that fails to load (deleted, offline) falls back to the initials.
  const [broken, setBroken] = useState<string | null>(null);
  const letters = name ? initials(name) : '';
  return (
    <span className={className} aria-hidden="true">
      {url && url !== broken ? (
        <img src={url} alt="" onError={() => setBroken(url)} />
      ) : letters ? (
        letters
      ) : (
        <svg viewBox="0 0 24 24" className={s.figure} focusable="false">
          <circle cx="12" cy="9" r="4" />
          <path d="M4.5 21c.8-4.2 3.8-6.5 7.5-6.5s6.7 2.3 7.5 6.5" />
        </svg>
      )}
    </span>
  );
}

/**
 * The sidebar's account row as a small profile card: your banner behind, fading into
 * the sidebar, and your picture and name over it. Without a banner it shows the
 * theme's own glow; without a picture, your initials.
 */
export function ProfileCard({ name, avatarUrl, bannerUrl, current, onClick }: { name: string | null; avatarUrl: string | null; bannerUrl: string | null; current: boolean; onClick: () => void }) {
  const [broken, setBroken] = useState<string | null>(null);
  const banner = bannerUrl && bannerUrl !== broken ? bannerUrl : null;
  return (
    <button type="button" className={s.profileCard} onClick={onClick} aria-current={current ? 'page' : undefined} data-banner={banner ? 'picture' : 'theme'}>
      <span className={s.profileBanner} aria-hidden="true">
        {banner && <img src={banner} alt="" onError={() => setBroken(banner)} />}
      </span>
      <span className={s.profileRow}>
        <Avatar url={avatarUrl} name={name} className={s.profileAvatar} />
        <span className={s.profileText}>
          <span className={s.profileName}>{name ?? 'Your profile'}</span>
          <span className={s.profileSub}>Account</span>
        </span>
        <span className={s.dots} aria-hidden="true">
          ···
        </span>
      </span>
    </button>
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
