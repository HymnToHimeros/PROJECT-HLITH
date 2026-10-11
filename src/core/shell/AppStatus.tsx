import { applyUpdate, useAppShell } from './appShell';
import a from './announcements.module.css';

/**
 * The installed app's two notes (T45), above every page like announcements: "Offline" while
 * there is no connection (the app keeps working from what this device has saved), and "Update
 * ready" when a new version has downloaded, with a button that reloads into it.
 */
export function AppStatus() {
  const { online, updateReady } = useAppShell();
  if (online && !updateReady) return null;
  return (
    <div className={a.stack}>
      {!online && (
        <section className={a.strip} role="status" aria-label="Offline">
          <span className={a.label}>OFFLINE</span>
          <span className={a.text}>
            <strong className={a.title}>No connection</strong>
            <span className={a.body}>Showing what this device has saved. Changes sync when you’re back online.</span>
          </span>
        </section>
      )}
      {updateReady && (
        <section className={a.strip} role="status" aria-label="Update ready">
          <span className={a.label}>UPDATE</span>
          <span className={a.text}>
            <strong className={a.title}>Update ready</strong>
            <span className={a.body}>A new version of HLITH is downloaded. Reload to use it.</span>
          </span>
          <button type="button" className={a.close} onClick={applyUpdate}>
            Reload
          </button>
        </section>
      )}
    </div>
  );
}
