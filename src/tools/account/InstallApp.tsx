import { useState } from 'react';
import { promptInstall, useAppShell } from '../../core/shell/appShell';
import { Button, HowTo } from '../../core/ui';
import a from './account.module.css';

export type Platform = 'iphone' | 'android' | 'pc';

/** Which steps to show first, from the browser's own description of the device. */
export function platformOf(ua: string, touchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return 'iphone'; // iPadOS says "Macintosh"
  if (/Android/.test(ua)) return 'android';
  return 'pc';
}

const STEPS: Record<Platform, { title: string; steps: string[] }> = {
  iphone: {
    title: 'iPhone or iPad (Safari)',
    steps: ['Open HLITH in Safari (other browsers on iPhone can’t install it).', 'Tap the Share button (the square with an arrow).', 'Scroll down and tap “Add to Home Screen”, then “Add”.', 'Open HLITH from its icon on your home screen.'],
  },
  android: {
    title: 'Android (Chrome)',
    steps: ['Open HLITH in Chrome.', 'Tap the ⋮ menu at the top right.', 'Tap “Install app” (or “Add to Home screen”), then “Install”.', 'Open HLITH from its icon.'],
  },
  pc: {
    title: 'PC (Chrome or Edge)',
    steps: ['Open HLITH in Chrome or Edge.', 'Click the install icon at the right end of the address bar (a screen with an arrow), or the ⋮ menu → “Install HLIÐSKJÁLF”.', 'Click “Install”. HLITH opens in its own window and gets a Start menu / Dock icon.'],
  },
};

/**
 * "Install app" (T45): HLITH on the home screen, opening in its own window like an app, and
 * working offline with what this device has saved. Shown only while it isn't installed: a real
 * Install button where the browser offers one (Chrome, Edge), otherwise the steps for this device,
 * with the other devices folded away. Installing is also what lets iPhone send phone alerts later.
 */
export function InstallApp({ platform = platformOf(navigator.userAgent, navigator.maxTouchPoints) }: { platform?: Platform }) {
  const { installed, canPrompt } = useAppShell();
  const [declined, setDeclined] = useState(false);
  if (installed) return null;
  const mine = STEPS[platform];
  const others = (Object.keys(STEPS) as Platform[]).filter((p) => p !== platform);
  return (
    <section className={a.card} id="install-app" aria-labelledby="install-app-title">
      <h3 className={a.cardTitle} id="install-app-title">
        Install HLITH as an app
      </h3>
      <p className={a.text}>
        Put HLITH on your home screen: it opens in its own window like an app, without the browser bars, and still opens when you’re offline (with what this device has
        saved). Phone alerts on iPhone will need it too.
      </p>
      {canPrompt && (
        <div className={a.actions}>
          <Button
            variant="primary"
            onClick={() => {
              void promptInstall().then((ok) => setDeclined(!ok));
            }}
          >
            Install app
          </Button>
        </div>
      )}
      {declined && <p className={a.small}>Not installed. You can install it any time from here or with the steps below.</p>}
      <HowTo title={`How to install: ${mine.title}`} steps={mine.steps} open={!canPrompt} />
      {others.map((p) => (
        <HowTo key={p} title={STEPS[p].title} steps={STEPS[p].steps} />
      ))}
    </section>
  );
}
