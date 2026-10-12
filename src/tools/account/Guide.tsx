import { useState } from 'react';
import type { ModuleId } from '../../core/contract';
import { MODULES } from '../../core/registry/modules';
import { Button } from '../../core/ui';
import a from './account.module.css';

interface Topic {
  id: string;
  module?: ModuleId;
  tab?: string;
  name: string;
  what: string;
  how: string[];
}

/** Page by page, in plain words. Every module has a button that opens it. */
export const TOPICS: Topic[] = [
  {
    id: 'today',
    module: 'today',
    name: 'Today',
    what: 'Your evening at a glance: when the daily and weekly resets come, how many pulls you have, what is still open and what ends soon.',
    how: ['Tick a task when you’ve done it. Ticks clear by themselves at your server’s next reset.', 'Tonight’s run puts whatever runs out first at the top.', 'Tap the Server chip to choose your server.'],
  },
  {
    id: 'pulls',
    module: 'pulls',
    tab: 'planner',
    name: 'Pulls',
    what: 'Four tabs. Planner: can you afford each banner? Calculator: what you will have by the end of the version. Bank log: what you have and spend. History: your imported pulls and your luck report.',
    how: ['Start in Bank log: type the currency you have right now.', 'Import your pull history in History (link from the game on PC, or an export file).', 'Planner and Calculator then fill in by themselves.'],
  },
  {
    id: 'calendar',
    module: 'calendar',
    name: 'Calendar',
    what: 'One timeline from a week ago to five weeks ahead: banners, events, endgame cycles, your resets and your plans. Leaks are dashed and marked unverified.',
    how: ['The white line is now.', 'On a phone, swipe the timeline sideways.', 'The list underneath has every date in order.'],
  },
  {
    id: 'roster',
    module: 'roster',
    tab: 'characters',
    name: 'Roster',
    what: 'Every character: owned or not, how many copies, and your teams. Open a character for its page.',
    how: ['Tap a character and mark it owned (and how many copies).', 'Mark characters you want: Today’s wishlist and the evening message follow them.', 'Teams: build a team from what you own.'],
  },
  { id: 'banners', module: 'banners', name: 'Banners', what: 'Live and upcoming banners, whether you own the character, and how it fits your teams. Leaks can be hidden.', how: ['Use the leak switch to show or hide unverified banners.', '“Plan pulls” takes you to the Planner.'] },
  { id: 'events', module: 'events', name: 'Events', what: 'Every event with its end date. Mark each one open, done or skipped; done rewards count as already earned in Pulls.', how: ['Tap Done when you finished an event, Skip if you won’t play it.', 'Login events: count the days you claimed.'] },
  { id: 'farm', module: 'farm', name: 'Farm', what: 'Pick characters to build; HLITH lists the materials, the stamina it costs and how many days it takes.', how: ['Tap characters at the top to add them to your Farm list.', 'Today then tells you what to spend stamina on.'] },
  { id: 'backlog', module: 'backlog', name: 'Backlog', what: 'Story, side quests, exploration and achievements still open, and the pulls they would give you.', how: ['Enter how much of each category you’ve done.', 'Switch off categories you will never play.', 'Import from old app: pick a backlog file (from Gacha Tracker, or one you made in HLITH’s format: see “File format” there, with a template to download). Its items become your own, with their progress; the same file again only raises progress. Export my backlog writes the same format.'] },
  { id: 'intel', module: 'intel', name: 'Intel', what: 'What might be coming: leaks and datamines. Everything here stays unverified until the game confirms it, and always shows its source.', how: ['Filter by type at the top.', 'Treat it as rumours, not plans.'] },
  {
    id: 'account',
    name: 'Account',
    what: 'Sync, backups, notifications, servers, this guide, layout and theme.',
    how: ['Backup: download your data now and then; Restore only adds, it never removes anything.', 'Notifications: the evening message and a calendar link for your phone.', 'Game settings: your server per game, which games you play, which tasks show on Today.'],
  },
  {
    id: 'honest',
    name: 'Why some places say “No data yet”',
    what: 'HLITH never shows a number it can’t back up. When something is missing it shows a dash, “No data yet” and the one thing that fixes it. Anything marked EXAMPLE (and the SAMPLE DATA badge at the top) is a stand-in, not yours.',
    how: ['Follow the button next to “No data yet”.', 'Examples disappear by themselves once the real data arrives.'],
  },
];

/** ★ Guide (R55, no design yet: built from the shared tokens). */
export function Guide({ open }: { open: (module: ModuleId, tab?: string) => void }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = needle ? TOPICS.filter((t) => `${t.name} ${t.what} ${t.how.join(' ')}`.toLowerCase().includes(needle)) : TOPICS;
  return (
    <section className={a.card} aria-label="Guide">
      <h3 className={a.cardTitle}>How HLITH works</h3>
      <input className={a.input} type="search" placeholder="Search the guide (pity, backup, server…)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the guide" />
      {shown.length === 0 && <p className={a.small}>Nothing matches “{q}”. Try another word.</p>}
      <div>
        {shown.map((t) => (
          <article key={t.id} className={a.guidePage}>
            <div className={a.guideHead}>
              <span className={a.guideName}>
                {t.module && (
                  <span className={a.glyph} aria-hidden="true">
                    {MODULES[t.module].glyph}
                  </span>
                )}
                {t.name}
              </span>
              {t.module && (
                <Button variant="quiet" onClick={() => open(t.module as ModuleId, t.tab)}>
                  Open {t.name}
                </Button>
              )}
            </div>
            <p className={a.text}>{t.what}</p>
            <ol className={a.small} style={{ paddingLeft: '1.3em', margin: 0, display: 'grid', gap: 4 }}>
              {t.how.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
}
