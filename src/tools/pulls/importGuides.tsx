/**
 * How to get your pull history into HLITH, written for players.
 *
 * CLAUDE.md Override 2: history comes only from the in-game history link and
 * export files (UIGF v4 / SRGF). HoYoLAB does not provide it.
 *
 * The guides are keyed by the game's UIGF section name (historyMapping.uigfKey),
 * a property of the file format, so tools/ still imports no game. Ideally the
 * game record would carry this text itself; that needs a contract field.
 *
 * Sources checked on 2026-10-09 (what reputable trackers document):
 * - Star Rail Station, Warp import (PC 1 = PowerShell command, PC 2 = upload the
 *   game's web-cache file "data_2"; iOS / Android guides; Android help is in
 *   their Discord): https://starrailstation.com/en/warp#import
 * - The Star Rail Station script, read line by line (finds the game folder from
 *   Player.log, opens the newest webCaches/<version>/Cache/Cache_Data/data_2,
 *   picks the last getGachaLog link, checks it with HoYoverse, copies it):
 *   https://gist.githubusercontent.com/Star-Rail-Station/2512df54c4f35d399cc9abbde665e8f0/raw/get_warp_link_os.ps1
 * - stardb.gg, Warp import and Signal import (Windows only, one PowerShell
 *   command per region; also accepts UIGF v4, SRGF):
 *   https://stardb.gg/en/warp-import · https://stardb.gg/en/zzz/signal-import
 * - The stardb.gg Signal script, read line by line (same steps for ZZZ: reads
 *   LocalLow/miHoYo/ZenlessZoneZero/Player.log for the game folder, then
 *   ZenlessZoneZero_Data/webCaches/<newest>/Cache/Cache_Data/data_2):
 *   https://stardb.gg/signal
 * - UIGF partner list (which apps import / export UIGF v4 and SRGF):
 *   https://uigf.org/en/partnership.html
 */
import type { ReactNode } from 'react';
import k from './kit.module.css';

export interface ImportGuide {
  /** What the game calls its history page. */
  historyPage: string;
  /** The game's data folder inside its install folder. */
  dataFolder: string;
  /** Where the game writes its log (that log names the install folder). */
  logFile: string;
  /** The line near the top of that log that contains the install folder. */
  logLine: string;
  /** A usual install folder, only when a tracker documents one. */
  usualInstall?: string;
  trackers: { name: string; url: string }[];
  /** Export formats this game's files come in. */
  formats: string;
  /** Apps the UIGF project lists as exporting those formats for this game. */
  exportApps: string[];
}

const GUIDES: Record<string, ImportGuide> = {
  // Honkai: Star Rail
  hkrpg: {
    historyPage: 'Warp Records (the history page in the Warp menu)',
    dataFolder: 'StarRail_Data',
    logFile: '%USERPROFILE%\\AppData\\LocalLow\\Cognosphere\\Star Rail\\Player.log',
    logLine: '“Loading player data from …”',
    usualInstall: 'C:\\Program Files\\Star Rail\\Games\\StarRail_Data',
    trackers: [
      { name: 'Star Rail Station', url: 'https://starrailstation.com/en/warp#import' },
      { name: 'stardb.gg', url: 'https://stardb.gg/en/warp-import' },
    ],
    formats: 'SRGF or UIGF v4 (.json)',
    exportApps: ['Starward (SRGF)', 'Firefly', 'Moonward', 'Snap.Hutao Remastered', 'Hoyo Buddy (Discord bot)', 'PaimonsNotebook (Android)', 'The Latte Helper (Apple)'],
  },
  // Zenless Zone Zero
  nap: {
    historyPage: 'Signal Search records (the history page in the Signal Search menu)',
    dataFolder: 'ZenlessZoneZero_Data',
    logFile: '%USERPROFILE%\\AppData\\LocalLow\\miHoYo\\ZenlessZoneZero\\Player.log',
    logLine: '“[Subsystems] Discovering subsystems at path …”',
    trackers: [{ name: 'stardb.gg', url: 'https://stardb.gg/en/zzz/signal-import' }],
    formats: 'UIGF v4 (.json)',
    exportApps: ['ZZZ Signal Search History Exporter', 'ZenlessTools', 'Firefly', 'Snap.Hutao Remastered', 'Hoyo Buddy (Discord bot)', 'PaimonsNotebook (Android)', 'The Latte Helper (Apple)'],
  },
};

export const guideFor = (uigfKey: string | undefined): ImportGuide | null => (uigfKey ? (GUIDES[uigfKey] ?? null) : null);

const ext = (url: string, label: string) => (
  <a className={k.link} href={url} target="_blank" rel="noreferrer noopener">
    {label}
  </a>
);

/** Steps for the in-game link on PC, without running anything: pick the game's cache file. */
export function cacheFileSteps(g: ImportGuide): ReactNode[] {
  return [
    <>
      Start the game on your PC and open <strong>{g.historyPage}</strong>. Let the list load. That puts a fresh history link in the game’s web cache.
    </>,
    <>
      Press <strong>Choose the cache file</strong> below. Go to the game’s install folder, then <code>{g.dataFolder}</code> → <code>webCaches</code> → the folder with the highest version number →{' '}
      <code>Cache</code> → <code>Cache_Data</code> and pick the file <code>data_2</code>.
      {g.usualInstall && (
        <>
          {' '}
          With the official launcher the data folder is usually <code>{g.usualInstall}</code>.
        </>
      )}
    </>,
    <>
      Don’t know the install folder? Open <code>{g.logFile}</code> in Notepad: the line {g.logLine} near the top shows it. (This is the same place the trackers’ scripts look.)
    </>,
    <>
      HLITH reads the file here in your browser, takes the newest history link out of it and sends only that link to import your pulls. The file itself is not uploaded, and the link is not kept.
    </>,
  ];
}

/** Steps for pasting a link you got with a tracker's helper. */
export function pasteSteps(g: ImportGuide): ReactNode[] {
  return [
    <>
      Start the game on your PC and open <strong>{g.historyPage}</strong>.
    </>,
    <>
      Get the link with the helper a tracker provides:{' '}
      {g.trackers.map((t, i) => (
        <span key={t.url}>
          {i > 0 && ' or '}
          {ext(t.url, t.name)}
        </span>
      ))}{' '}
      (their import page, PC section). It is a one-line PowerShell command. What it does, from reading it: it finds the game folder in the game’s log file, opens the newest web-cache file,
      finds the history link, checks it with HoYoverse and copies it to your clipboard. Only run commands from sites you trust; you can open the script in your browser to read it first.
    </>,
    <>Paste the link (or the whole text that contains it) in the box below and press Import from link.</>,
  ];
}

/** Steps for an export file from another app. */
export function fileSteps(g: ImportGuide | null): ReactNode[] {
  return [
    <>
      In the app that already tracks your pulls, look for <strong>Export</strong> and choose <strong>{g ? g.formats : 'UIGF v4 or SRGF (.json)'}</strong>. Each app puts it in a different
      place; we haven’t tested every app.
    </>,
    g ? (
      <>
        Apps the UIGF project lists as exporting this: {g.exportApps.join(', ')}. Full list: {ext('https://uigf.org/en/partnership.html', 'uigf.org')}.
      </>
    ) : (
      <>Apps that export these formats are listed at {ext('https://uigf.org/en/partnership.html', 'uigf.org')}.</>
    ),
    <>Press Upload a file below and pick the .json file. Pulls you already have are skipped, so importing again only adds new ones.</>,
  ];
}

/** Honest notes that apply to every way in. */
export function goodToKnow(): ReactNode[] {
  return [
    <>
      <strong>Phone or console:</strong> we know of no simple way there; the game doesn’t show the link. Star Rail Station lists guides for iOS and Android (Android help is in its Discord); we
      haven’t tested them, so we don’t repeat them here. The easy route: import once on a PC (your history belongs to your game account, not the device) or use an export file.
    </>,
    <>The game only keeps recent history (trackers say about six months), so import now and then. HLITH keeps everything you imported and only adds new pulls (unless you undo an import right after it).</>,
    <>History links stop working after a while (trackers say about a day). If one fails, open the history page in the game again and repeat.</>,
  ];
}

/**
 * The newest history link in the text of the game's web-cache file (data_2),
 * or null. The cache holds many entries separated by binary bytes; links end at
 * the first space, quote or control byte.
 */
export function findHistoryLink(text: string): string | null {
  // Printable ASCII only, without quotes and angle brackets: a link ends at the first other byte.
  // Spelled out character by character (the same set as the ranges !#-&(-;=?-~), so no range reaches further than meant.
  const matches = text.match(/https:\/\/[\w!#$%&()*+,\-./:;=?@[\\\]^`{|}~]*getGachaLog\?[\w!#$%&()*+,\-./:;=?@[\\\]^`{|}~]*/g);
  if (!matches) return null;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (m && m.includes('authkey=')) return m;
  }
  return null;
}
