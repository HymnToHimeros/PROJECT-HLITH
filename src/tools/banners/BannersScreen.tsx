import { useCallback, useState } from 'react';
import type { ModuleScreenProps } from '../../core/registry/modules';
import { HowTo, useNow } from '../../core/ui';
import { Filters, Switch } from '../pulls/shared';
import { GameBanners, SharedRuler, sameLane, type BannerFilter, type Lane } from './Banners';
import b from './banners.module.css';
import { setHideLeaks, useHideLeaks } from './leakPref';

/**
 * Banners (design: "Show leaks" switch over a grid of banner cards with big
 * art). Live and upcoming banners, leaks you can hide, owned / wanted / new
 * from your roster, team fit from your teams, Plan pulls. V1 features: filter
 * by live / upcoming / leaks / rerun watch, and the latest changes.
 */
export default function BannersScreen({ games, scope, open }: ModuleScreenProps) {
  const now = useNow(60_000);
  const hideLeaks = useHideLeaks();
  const [filter, setFilter] = useState<BannerFilter>('all');
  const shown = scope === 'all' ? games : games.filter((g) => g.id === scope);
  // Each game's board reports its row for the one shared ruler on top.
  const [lanes, setLanes] = useState<Record<string, Lane>>({});
  const onLane = useCallback((lane: Lane) => setLanes((prev) => (prev[lane.game.id] && sameLane(prev[lane.game.id] as Lane, lane) ? prev : { ...prev, [lane.game.id]: lane })), []);
  const shownLanes = shown.flatMap((g) => (lanes[g.id]?.game === g ? [lanes[g.id] as Lane] : []));
  return (
    <div className={b.page}>
      <HowTo
        title="How to use Banners"
        steps={[
          <>Each card is a banner that is live now or coming up. The time on the right counts down to its end (orange in the last 3 days) or to when it opens.</>,
          <>
            Under the title: “You own it (E2)” means the featured character is in your roster, with its copies. “On your wanted list” means you marked it as wanted. “New for you” means it isn’t in
            your roster. If your roster is empty HLITH says “No data yet” instead of guessing: add your characters in Roster.
          </>,
          <>“Teammates owned 2/3” counts how many of the other members of one of your saved teams you own. Save a team in Roster → Teams to see it.</>,
          <>
            “Show leaks” switches leaked banners on or off. Leaks always carry a dashed outline, “? UNVERIFIED” and their source, because the game hasn’t confirmed them. Your choice is remembered in
            this browser.
          </>,
          <>“Plan pulls” opens the Planner, where you see if you can afford the banner.</>,
        ]}
      />
      <div className={b.toolbar}>
        <span className={b.leakSwitch}>
          <Switch checked={!hideLeaks} onChange={(on) => setHideLeaks(!on)} label="Show leaks" />
          <span>Show leaks</span>
          <span className={b.hint}>Leaked banners stay marked unverified</span>
        </span>
        <Filters
          label="Show banners"
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All' },
            { id: 'live', label: 'Live' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'leaks', label: 'Leaks' },
            { id: 'reruns', label: 'Rerun watch' },
          ]}
        />
      </div>
      <SharedRuler lanes={shownLanes} now={now} />
      {shown.map((g) => (
        <GameBanners key={g.id} game={g} now={now} many={shown.length > 1} hideLeaks={hideLeaks} filter={filter} open={open} onLane={onLane} />
      ))}
    </div>
  );
}
