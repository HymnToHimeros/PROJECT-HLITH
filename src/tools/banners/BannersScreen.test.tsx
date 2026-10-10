import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Banner, Character, GameContract } from '../../core/contract';
import type { ModuleId } from '../../core/contract';
import { reloadPrefs, updatePrefs } from '../../core/data/prefs';
import { gameData, resetUserData, setRosterEntry } from '../../core/data/userData';
import BannersScreen from './BannersScreen';
import { resetHideLeaks } from './leakPref';

const DAY = 86_400_000;
const now = Date.now();
const iso = (offsetDays: number) => new Date(now + offsetDays * DAY).toISOString();

const chars: Character[] = [
  { id: 'c1', name: 'Star One', rarity: 'top', element: 'e', role: 'r' },
  { id: 'c2', name: 'Star Two', rarity: 'top', element: 'e', role: 'r' },
  { id: 'c3', name: 'Helper Three', rarity: 'mid', element: 'e', role: 'r' },
];

const realBanners: Banner[] = [
  { id: 'up-late', type: 'character', title: 'Upcoming late', featured: ['c2'], start: iso(10), end: iso(30) },
  { id: 'live-long', type: 'character', title: 'Live long', featured: ['c1', 'c3'], start: iso(-5), end: iso(5) },
  { id: 'live-short', type: 'character', title: 'Live short', featured: ['c2'], start: iso(-10), end: iso(2) },
  { id: 'up-soon', type: 'character', title: 'Upcoming soon', featured: ['c1'], start: iso(3), end: iso(20) },
  { id: 'ended', type: 'character', title: 'Already over', featured: ['c1'], start: iso(-30), end: iso(-1) },
  { id: 'leak-1', type: 'character', title: 'Leaked one', featured: ['c3'], start: iso(25), end: iso(45), leak: { source: 'a test leaker' } },
];

const makeGame = (banners: Banner[]): GameContract =>
  ({
    id: 'aa',
    short: 'AA',
    name: 'Game A',
    vent: '#A99BFF',
    terms: { rarity: { top: '5★', mid: '4★' }, gear: 'G', weapon: 'Cone', skill: 'S', character: 'Character', endgame: [] },
    elements: [{ id: 'e', label: 'Spark', color: '#ffffff' }],
    roles: [{ id: 'r', label: 'Runner' }],
    dupes: { prefix: 'E', name: 'Eidolon', max: 6 },
    currencies: [{ id: 'gem', name: 'Gem', perPull: 160 }],
    teamSize: 4,
    stamina: [],
    servers: [{ id: 'eu', label: 'Europe', utcOffset: 1 }],
    reset: { hour: 4, weekday: 1 },
    modules: ['banners'],
    bannerTypes: [
      {
        id: 'character',
        label: 'Character banner',
        pullItem: 'gem',
        target: 'character',
        pity: { kind: 'hard-pity', hardPity: 90, baseRate: 0.006, featured: { winRate: 0.5, guaranteeAfterLoss: true } },
      },
    ],
    income: [],
    historyImporters: [],
    data: {
      characters: async () => chars,
      banners: async () => banners,
      events: async () => [],
      backlog: async () => [],
      materials: async () => [],
      teams: async () => [],
      versions: async () => [],
    },
    rules: {},
    sources: [],
  }) as GameContract;

const show = async (banners: Banner[], open: (m: ModuleId, t?: string) => void = () => {}) => {
  render(<BannersScreen games={[makeGame(banners)]} scope="aa" servers={{}} openTab={() => {}} open={open} openAccount={() => {}} />);
  await screen.findAllByRole('article');
};
const cardTitles = () => screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'));

describe('Banners screen', () => {
  beforeEach(() => {
    localStorage.clear();
    reloadPrefs();
    resetUserData();
    resetHideLeaks();
  });

  it('lists live banners first (ending soonest on top), then upcoming (starting soonest on top), and drops ended ones', async () => {
    await show(realBanners);
    expect(cardTitles()).toEqual(['Live short', 'Live long', 'Upcoming soon', 'Upcoming late', 'Leaked one']);
    expect(screen.queryByText('Already over')).not.toBeInTheDocument();
    expect(screen.queryByText(/Example data/)).not.toBeInTheDocument();
  });

  it('timeline board: Now holds live banners, Next the next phase, Later the rest; permanent banners sit in "Always open"', async () => {
    await show([...realBanners, { id: 'collab', type: 'character', title: 'Collab forever', featured: ['c1'], start: iso(-60), end: iso(3650), permanent: true }]);
    const column = (label: string) => screen.getByText(label, { selector: 'span' }).closest('div')?.parentElement as HTMLElement;
    const titles = (el: HTMLElement) => within(el).queryAllByRole('article').map((a) => a.getAttribute('aria-label'));
    expect(titles(column('Now'))).toEqual(['Live short', 'Live long']);
    expect(titles(column('Next'))).toEqual(['Upcoming soon']);
    expect(titles(column('Later'))).toEqual(['Upcoming late', 'Leaked one']);
    const rail = screen.getByRole('complementary', { name: 'Always open · AA' });
    expect(titles(rail)).toEqual(['Collab forever']);
    expect(titles(column('Now'))).not.toContain('Collab forever');
    // The ruler shows the limited banners with a TODAY line.
    expect(screen.getByRole('img', { name: 'AA banner timeline' })).toHaveTextContent('TODAY');
  });

  it('a weapon banner stacks under the character banner it belongs to', async () => {
    const game = makeGame([
      { id: 'char', type: 'character', title: 'Star banner', featured: ['c1'], start: iso(-2), end: iso(8) },
      { id: 'cone', type: 'weapon', title: 'Cone banner', featured: ['w1'], start: iso(-2), end: iso(8) },
    ]);
    const withWeapons = {
      ...game,
      bannerTypes: [...game.bannerTypes, { id: 'weapon', label: 'Cone banner', pullItem: 'gem', target: 'weapon', pity: { kind: 'hard-pity', hardPity: 80, baseRate: 0.008 } }],
      data: { ...game.data, weapons: async () => [{ id: 'w1', name: 'Bright Cone', rarity: 'top', madeFor: 'c1' }] },
    } as GameContract;
    render(<BannersScreen games={[withWeapons]} scope="aa" servers={{}} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    const star = (await screen.findAllByRole('article')).find((a) => a.getAttribute('aria-label') === 'Star banner') as HTMLElement;
    expect(star.parentElement?.querySelectorAll('article')).toHaveLength(2);
    expect(star.nextElementSibling?.getAttribute('aria-label')).toBe('Cone banner');
  });

  it('a permanent banner says "Permanent" instead of a countdown', async () => {
    await show([{ id: 'collab', type: 'character', title: 'Collab forever', featured: ['c1'], start: iso(-60), end: iso(3650), permanent: true }]);
    const card = screen.getByRole('article', { name: 'Collab forever' });
    expect(within(card).getByText('Permanent')).toBeInTheDocument();
    expect(within(card).queryByText(/ends in/)).not.toBeInTheDocument();
  });

  it('shows leaks as unverified with their source, and the switch hides them and is remembered', async () => {
    await show(realBanners);
    const leak = screen.getByRole('article', { name: 'Leaked one' });
    expect(within(leak).getByText('? UNVERIFIED')).toBeInTheDocument();
    expect(within(leak).getByText('a test leaker')).toBeInTheDocument();

    expect(screen.getByRole('switch', { name: 'Show leaks' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('switch', { name: 'Show leaks' }));
    expect(screen.queryByRole('article', { name: 'Leaked one' })).not.toBeInTheDocument();
    expect(screen.getByText('1 leaked banner hidden.')).toBeInTheDocument();
    expect(localStorage.getItem('hlith.hideLeaks')).toBe('1');
  });

  it('labels each featured character’s fit from your roster', async () => {
    setRosterEntry('aa', 'c1', { owned: true, wanted: false, dupes: 2 });
    setRosterEntry('aa', 'c2', { owned: false, wanted: true, dupes: 0 });
    await show(realBanners);
    const liveLong = screen.getByRole('article', { name: 'Live long' });
    expect(within(liveLong).getByText('You own it (E2)')).toBeInTheDocument();
    expect(within(liveLong).getByText('New for you')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Live short' })).getByText('On your wanted list')).toBeInTheDocument();
  });

  it('says "No data yet" for fit while your roster is empty, never "new for you"', async () => {
    await show(realBanners);
    expect(screen.queryByText('New for you')).not.toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Live short' })).getAllByText(/No data yet/).length).toBeGreaterThan(0);
  });

  it('Plan pulls opens Pulls on the Planner tab', async () => {
    const open = vi.fn();
    await show(realBanners, open);
    fireEvent.click(within(screen.getByRole('article', { name: 'Live short' })).getByRole('button', { name: 'Plan pulls' }));
    expect(open).toHaveBeenCalledWith('pulls', 'planner');
  });

  it('shows clearly marked example banners while the game’s list is empty', async () => {
    await show([]);
    expect(screen.getByText(/banner list for this game still has to be added by us/)).toBeInTheDocument();
    expect(cardTitles().length).toBeGreaterThan(1);
    expect(screen.getAllByRole('article').every((a) => within(a).queryByText('EXAMPLE'))).toBe(true);
  });

  it('filters live, upcoming and leaked banners, and rerun watch says when release dates are missing', async () => {
    await show(realBanners);
    fireEvent.click(screen.getByRole('button', { name: 'Live' }));
    expect(cardTitles()).toEqual(['Live short', 'Live long']);
    fireEvent.click(screen.getByRole('button', { name: 'Upcoming' }));
    expect(cardTitles()).toEqual(['Upcoming soon', 'Upcoming late', 'Leaked one']);
    fireEvent.click(screen.getByRole('button', { name: 'Leaks' }));
    expect(cardTitles()).toEqual(['Leaked one']);
    fireEvent.click(screen.getByRole('button', { name: 'Rerun watch' }));
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByText(/5 banners have no release date .*no data yet/)).toBeInTheDocument();
  });

  it('rerun watch shows the banners the cards label “Rerun”', async () => {
    const dated = makeGame(realBanners);
    const withDates = { ...dated, data: { ...dated.data, characters: async () => [{ ...chars[0], releasedAt: iso(-400) }, { ...chars[1], releasedAt: iso(9) }, chars[2]] } } as GameContract;
    render(<BannersScreen games={[withDates]} scope="aa" servers={{}} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    await screen.findAllByRole('article');
    expect(within(screen.getByRole('article', { name: 'Upcoming late' })).getByText(/· New/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rerun watch' }));
    expect(cardTitles()).toEqual(['Live long', 'Upcoming soon']);
  });

  it('marks a featured character as wanted without touching owned or copies', async () => {
    setRosterEntry('aa', 'c1', { owned: true, wanted: false, dupes: 2 });
    await show(realBanners);
    const card = screen.getByRole('article', { name: 'Live long' });
    act(() => fireEvent.click(within(card).getByRole('button', { name: 'Add Star One to my wanted list' })));
    expect(gameData('aa').roster.c1).toEqual({ owned: true, wanted: true, dupes: 2 });
    expect(within(card).getByText('You own it (E2) · on your wanted list')).toBeInTheDocument();
    act(() => fireEvent.click(within(card).getByRole('button', { name: 'Remove Star One from my wanted list' })));
    expect(gameData('aa').roster.c1).toEqual({ owned: true, wanted: false, dupes: 2 });
  });

  it('“build a team first” opens Roster → Teams', async () => {
    const open = vi.fn();
    await show(realBanners, open);
    const tile = screen.getByRole('article', { name: 'Live short' });
    fireEvent.click(within(tile).getByRole('button', { name: 'Details' }));
    fireEvent.click(within(tile).getByRole('button', { name: 'build a team first' }));
    expect(open).toHaveBeenCalledWith('roster', 'teams');
  });

  it('with no banners at all, “Add my own banner” opens Edit mode', async () => {
    act(() => updatePrefs((p) => ({ ...p, hideExamples: true })));
    render(<BannersScreen games={[makeGame([])]} scope="aa" servers={{}} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add my own banner' }));
    expect(await screen.findByText(/Edit mode · Banners/)).toBeInTheDocument();
  });

  it('real banners without art get a full-size placeholder panel with the name, never sample art', async () => {
    const game = makeGame(realBanners);
    const withSample = { ...game, data: { ...game.data, sampleArt: async () => [{ characterId: 'c1', art: 'https://example.test/c1.webp', portrait: '' }] } } as GameContract;
    render(<BannersScreen games={[withSample]} scope="aa" servers={{}} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    const card = (await screen.findAllByRole('article'))[0] as HTMLElement;
    expect(card.querySelector('img')).toBeNull();
    expect(within(card).getByText('NO ART YET')).toBeInTheDocument();
  });

  it('example banners feature characters with sample art and show it', async () => {
    const game = makeGame([]);
    const withSample = { ...game, data: { ...game.data, sampleArt: async () => [{ characterId: 'c2', art: 'https://example.test/c2.webp', portrait: '' }] } } as GameContract;
    render(<BannersScreen games={[withSample]} scope="aa" servers={{}} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    const first = (await screen.findAllByRole('article'))[0] as HTMLElement;
    expect(first.querySelector('img')?.getAttribute('src')).toBe('https://example.test/c2.webp');
    expect(within(first).getByText('SAMPLE ART')).toBeInTheDocument();
  });

  it('weapon banners show each weapon with its picture, and who it is made for with your roster fit', async () => {
    const game = makeGame([{ id: 'cone', type: 'weapon', title: 'Cone banner', featured: ['w1', 'w2'], start: iso(-2), end: iso(8) }]);
    const withWeapons = {
      ...game,
      bannerTypes: [...game.bannerTypes, { id: 'weapon', label: 'Cone banner', pullItem: 'gem', target: 'weapon', pity: { kind: 'hard-pity', hardPity: 80, baseRate: 0.008, featured: { winRate: 0.75, guaranteeAfterLoss: true } } }],
      data: {
        ...game.data,
        weapons: async () => [
          { id: 'w1', name: 'Bright Cone', rarity: 'top', icon: 'https://example.test/w1.webp', madeFor: 'c1' },
          { id: 'w2', name: 'Plain Cone', rarity: 'mid', icon: 'https://example.test/w2.webp' },
        ],
      },
    } as GameContract;
    setRosterEntry('aa', 'c1', { owned: true, wanted: false, dupes: 0 });
    render(<BannersScreen games={[withWeapons]} scope="aa" servers={{}} openTab={() => {}} open={() => {}} openAccount={() => {}} />);
    const card = (await screen.findAllByRole('article'))[0] as HTMLElement;
    const srcs = [...card.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    // The banner picture is the lead weapon's; the other weapons have their own under Details.
    expect(srcs).toEqual(['https://example.test/w1.webp', 'https://example.test/w2.webp']);
    expect(within(card).queryByText('NO ART YET')).toBeNull();
    expect(within(card).getByText('Bright Cone')).toBeInTheDocument();
    expect(within(card).getByText('Plain Cone')).toBeInTheDocument();
    expect(within(card).getByText('Star One')).toBeInTheDocument();
    expect(within(card).getByText('You own it (E0)')).toBeInTheDocument();
  });
});
