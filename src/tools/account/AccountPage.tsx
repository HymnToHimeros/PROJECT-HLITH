import { useEffect, useRef, type ReactNode } from 'react';
import { BACKUP_EVERY_DAYS, daysSinceBackup } from '../../core/data/backup';
import { usePrefs } from '../../core/data/prefs';
import { useSyncStatus } from '../../core/data/sync';
import type { PanelProps } from '../../core/registry/panels';
import { accountPath, cameFromApp, navigate } from '../../core/shell/route';
import { themeInfo, useOwnerTheme } from '../../core/theme/theme';
import { Button, HowTo, useNow } from '../../core/ui';
import { LinkAccounts } from '../account-links/LinkAccount';
import { FeedSettings } from '../feeds/FeedSettings';
import OwnerConsole from '../owner/OwnerConsole';
import a from './account.module.css';
import { Guide } from './Guide';
import { InstallApp } from './InstallApp';
import pg from './page.module.css';
import { ProfileSection } from './Profile';
import { BackupPage, ExamplesPage, GameSettingsPage, SignInPage, SyncPage, syncSub, ThemePage } from './sections';
import { SetupChecklist } from './SetupChecklist';

export type SectionId = 'profile' | 'sync' | 'backup' | 'notifications' | 'game-settings' | 'examples' | 'connections' | 'guide' | 'layout' | 'theme' | 'owner' | 'sign-in';

export interface SectionDef {
  id: SectionId;
  label: string;
}

/** The section bar, in order. Owner console only for owners; Sign in only without an account (Sign out is an action, not a section). */
export function sectionsFor({ isOwner, signedIn }: { isOwner: boolean; signedIn: boolean }): SectionDef[] {
  const list: (SectionDef | false)[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'sync', label: 'Sync' },
    { id: 'backup', label: 'Backup' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'game-settings', label: 'Game settings' },
    { id: 'examples', label: 'Example data' },
    { id: 'connections', label: 'Connected accounts' },
    { id: 'guide', label: 'Guide' },
    { id: 'layout', label: 'Layout' },
    { id: 'theme', label: 'Theme' },
    isOwner && { id: 'owner', label: 'Owner console' },
    !signedIn && { id: 'sign-in', label: 'Sign in' },
  ];
  return list.filter((x): x is SectionDef => Boolean(x));
}

/** Which section the address asks for. Unknown, or Owner console for a non-owner, falls back to Profile. */
export function resolveSection(requested: string | undefined, sections: SectionDef[]): SectionId {
  return sections.find((s) => s.id === requested)?.id ?? 'profile';
}

/**
 * Account (design: Account sheet, now a full page at /account/<section>). A section bar
 * (left column on PC, scrolling tabs on phone) beside the open section. Profile is a
 * customisable showcase; the other sections are the settings the sheet had.
 */
export default function AccountPage(props: PanelProps) {
  const { account, games, scope, isOwner = false } = props;
  const prefs = usePrefs();
  const sync = useSyncStatus();
  const now = useNow(60_000);
  const sections = sectionsFor({ isOwner, signedIn: Boolean(account) });
  const current = resolveSection(props.section, sections);
  const go = (id: string, detail?: string) => props.goSection?.(id, detail);
  // An unknown section (or Owner console for a non-owner) shows Profile: make the address say so too.
  // Waits for the owner check, so an owner reloading /account/owner isn't sent away.
  const wrongAddress = Boolean(props.section) && props.section !== current && (props.section !== 'owner' || props.ownerChecked !== false);
  useEffect(() => {
    if (wrongAddress) navigate(accountPath(), true);
  }, [wrongAddress, props.section]);
  const barRef = useRef<HTMLElement>(null);
  // On a phone the bar scrolls sideways: keep the open section in view.
  useEffect(() => {
    barRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [current]);
  const days = daysSinceBackup(now);
  const ownerTheme = useOwnerTheme();
  const scopeShort = scope === 'all' ? 'All games' : (games.find((g) => g.id === scope)?.short ?? scope);

  const hint: Partial<Record<SectionId, string | undefined>> = {
    sync: syncSub(sync, now),
    backup: days === null ? 'No backup yet' : days >= BACKUP_EVERY_DAYS ? 'Time for a new one' : `Last ${days === 0 ? 'today' : `${days}d ago`}`,
    // The evening message can't be sent yet (no push on the server), so no "Evening at 21:00" promise here.
    notifications: prefs.notify?.enabled ? 'Preview only' : undefined,
    theme: ownerTheme?.name ?? themeInfo(prefs.theme).name,
    examples: prefs.hideExamples ? 'Hidden' : 'Shown',
  };

  let body: ReactNode;
  switch (current) {
    case 'profile':
      body = <ProfileSection games={games} account={account} open={props.open} goSection={go} />;
      break;
    case 'sync':
      body = <SyncPage status={sync} now={now} signedIn={Boolean(account)} />;
      break;
    case 'backup':
      body = <BackupPage now={now} signedIn={Boolean(account)} />;
      break;
    case 'notifications':
      body = <FeedSettings games={games} servers={prefs.servers} signedIn={Boolean(account)} chooseServer={() => go('game-settings')} />;
      break;
    case 'game-settings':
      body = <GameSettingsPage games={games} allGames={props.allGames} now={now} focus={props.detail} onBack={cameFromApp() ? () => window.history.back() : undefined} />;
      break;
    case 'examples':
      body = <ExamplesPage />;
      break;
    case 'connections':
      body = <LinkAccounts games={games} allGames={props.allGames} />;
      break;
    case 'guide':
      body = (
        <>
          <InstallApp />
          <SetupChecklist games={games} open={props.open} goTo={(id) => go(id)} />
          <Guide open={props.open} />
        </>
      );
      break;
    case 'layout':
      body = (
        <>
          <section className={a.card} aria-label="Layout">
            <h3 className={a.cardTitle}>Your modules</h3>
            <p className={a.text}>
              One order for every game: the sidebar on PC, and on a phone the first four in the bottom bar with the rest under More. Hide what you don’t use; it stays in the
              game and can be restored.
            </p>
            <div className={a.actions}>
              <Button variant="primary" onClick={props.editLayout}>
                Edit layout for {scopeShort}
              </Button>
            </div>
          </section>
          <HowTo steps={['Press “Edit layout”.', 'Drag the ⋮⋮ handle (or use the arrow keys on it) to change the order.', 'Hide a module you never use; “Restore” brings it back. “Reset to default” undoes everything.']} />
        </>
      );
      break;
    case 'theme':
      body = <ThemePage />;
      break;
    case 'owner':
      // Every game record, not only the ones switched on in your switcher; the tab lives in the address (/account/owner/findings).
      body = <OwnerConsole games={props.allGames} scope={scope} servers={props.servers} tab={props.detail} openTab={(t) => go('owner', t)} open={props.open} openAccount={() => go('profile')} />;
      break;
    case 'sign-in':
      body = <SignInPage />;
      break;
  }

  const label = sections.find((s) => s.id === current)?.label ?? 'Profile';
  return (
    <div className={pg.page}>
      <nav ref={barRef} className={pg.bar} aria-label="Account sections">
        {sections.map((s) => (
          <a
            key={s.id}
            href={s.id === 'profile' ? '/account' : `/account/${s.id}`}
            className={pg.item}
            aria-current={s.id === current ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              go(s.id);
            }}
          >
            <span className={pg.itemLabel}>{s.label}</span>
            {hint[s.id] && <span className={pg.itemHint}>{hint[s.id]}</span>}
          </a>
        ))}
        {account && (
          <button type="button" className={`${pg.item} ${pg.signOut}`} onClick={account.onSignOut}>
            <span className={pg.itemLabel}>Sign out</span>
            <span className={pg.itemHint}>Your data stays on your account</span>
          </button>
        )}
      </nav>
      <section className={pg.body} aria-label={label}>
        {current !== 'profile' && <h2 className={pg.sectionTitle}>{label}</h2>}
        <div className={a.stack}>{body}</div>
      </section>
    </div>
  );
}
