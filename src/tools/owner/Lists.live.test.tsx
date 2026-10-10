import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameContract } from '../../core/contract';
import type { FakeDb } from './fakeBackend.testutil';

// A fake server holding the owner's tables; every write is recorded in db.writes.
const db = vi.hoisted(() => ({ current: null as FakeDb | null }));
vi.mock('../../core/data/backend', async () => {
  const { fakeBackend, fakeDb } = await import('./fakeBackend.testutil');
  db.current = fakeDb({}, { catalog_items: ['game_id', 'kind', 'id'] });
  return { backend: fakeBackend(db.current) };
});

const { default: OwnerConsole } = await import('./OwnerConsole');
const { withCatalog } = await import('../../core/data/catalog');
const { catalogRows, forgetCatalogRows } = await import('../../core/data/catalogSource');

const seedGame = {
  id: 'aa',
  short: 'AA',
  name: 'Game A',
  vent: '#A99BFF',
  terms: { rarity: { top: 'S', mid: 'A' } },
  elements: [
    { id: 'fire', label: 'Fire' },
    { id: 'ice', label: 'Ice' },
  ],
  roles: [{ id: 'attack', label: 'Attack' }],
  currencies: [{ id: 'gem', name: 'Gems', perPull: 160 }],
  bannerTypes: [{ id: 'limited', label: 'Limited' }],
  servers: [],
  reset: { hour: 4, weekday: 1 },
  modules: [],
  data: {
    characters: async () => [{ id: 'c1', name: 'Alpha', rarity: 'top', element: 'fire', role: 'attack' }],
    banners: async () => [],
    events: async () => [],
    materials: async () => [],
    backlog: async () => [],
    versions: async () => [],
    teams: async () => [],
  },
} as unknown as GameContract;
// As main.tsx registers it: the seed lists with the owner's rows laid over them.
const game = withCatalog(seedGame, () => catalogRows());

const finding = (id: string, kind: string, title: string, payload: Record<string, unknown>) => ({
  id,
  job_id: 'events-scan',
  game_id: 'aa',
  kind,
  title,
  payload,
  source_name: 'Official site',
  source_url: null,
  found_at: '2026-10-09T06:00:00Z',
  delivered_at: '2026-10-09T06:05:00Z',
  delivered_by: 'routine',
  status: 'new',
  decided_at: null,
});

beforeEach(() => {
  const d = db.current as FakeDb;
  d.tables = {
    catalog_items: [],
    announcements: [],
    scheduler_jobs: [],
    scheduler_runs: [],
    scheduler_findings: [
      finding('f2', 'event', 'Login event', { title: 'Autumn login', kind: 'login', start: '2026-10-12T04:00:00Z', end: '2026-10-19T04:00:00Z', reward: 1600, loginDays: 7 }),
      finding('f3', 'character', 'New character Beta', { character: 'Beta', element: 'Ice' }),
    ],
  };
  d.writes = [];
  d.rpc = {};
  forgetCatalogRows();
});

// The tab lives in the address, as in the app: openTab changes it.
function Harness({ start }: { start: string | undefined }) {
  const [tab, setTab] = useState(start);
  return <OwnerConsole games={[game]} scope="all" servers={{}} tab={tab} openTab={setTab} open={() => {}} openAccount={() => {}} />;
}
const renderConsole = (tab?: string) => render(<Harness start={tab} />);
const catalog = () => (db.current as FakeDb).tables.catalog_items as Record<string, unknown>[];

describe('Owner console · Lists', () => {
  it('adds a new event for everyone, and the game’s list loader then includes it', async () => {
    renderConsole('lists');
    expect(await screen.findByText('No data yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
    const form = screen.getByRole('form', { name: 'Add event' });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Moon Festival' } });
    fireEvent.change(within(form).getByLabelText('Starts (your time)'), { target: { value: '2026-10-12T10:00' } });
    fireEvent.change(within(form).getByLabelText('Ends (your time)'), { target: { value: '2026-10-26T10:00' } });
    fireEvent.change(within(form).getByLabelText('Reward (empty = unknown)'), { target: { value: '420' } });
    expect(within(form).getByText(/for everyone\. They see it after reload/)).toBeInTheDocument();
    await act(async () => fireEvent.click(within(form).getByRole('button', { name: 'Add event' })));

    expect(catalog()).toEqual([
      expect.objectContaining({ game_id: 'aa', kind: 'event', id: 'moon-festival', status: 'active', data: expect.objectContaining({ title: 'Moon Festival', kind: 'event', reward: 420, currency: 'gem' }) }),
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('Everyone sees this after reload.');
    const row = await screen.findByRole('listitem', { name: 'Moon Festival' });
    expect(within(row).getByText('OWNER')).toBeInTheDocument();
    // Every screen reads lists through the game's loaders: they now include it.
    expect((await game.data.events()).map((e) => e.title)).toEqual(['Moon Festival']);
  });

  it('changes a built-in character (only what differs is saved), retires it and brings it back', async () => {
    renderConsole('lists');
    fireEvent.click(await screen.findByRole('tab', { name: 'Characters' }));
    const alpha = await screen.findByRole('listitem', { name: 'Alpha' });
    expect(within(alpha).getByText('LIST')).toBeInTheDocument();
    fireEvent.click(within(alpha).getByRole('button', { name: 'Change: Alpha' }));
    const form = screen.getByRole('form', { name: 'Change Alpha' });
    fireEvent.change(within(form).getByLabelText('Element'), { target: { value: 'ice' } });
    await act(async () => fireEvent.click(within(form).getByRole('button', { name: 'Save change' })));
    expect(catalog()).toEqual([expect.objectContaining({ kind: 'character', id: 'c1', data: { element: 'ice' } })]);
    expect((await game.data.characters())[0]).toMatchObject({ id: 'c1', name: 'Alpha', element: 'ice' });

    const changed = await screen.findByRole('listitem', { name: 'Alpha' });
    await act(async () => fireEvent.click(within(changed).getByRole('button', { name: 'Retire: Alpha' })));
    expect(catalog()[0]).toMatchObject({ status: 'retired', data: { element: 'ice' } });
    expect(screen.getByRole('status')).toHaveTextContent(/Progress on it stays saved/);
    expect(await game.data.characters()).toEqual([]);
    const retired = await screen.findByRole('listitem', { name: 'Alpha' });
    expect(within(retired).getByText('RETIRED')).toBeInTheDocument();
    await act(async () => fireEvent.click(within(retired).getByRole('button', { name: 'Bring back: Alpha' })));
    expect(catalog()[0]).toMatchObject({ status: 'active' });
    expect(await game.data.characters()).toHaveLength(1);
  });

  it('retiring a built-in item that has no owner row yet adds one with only the status', async () => {
    renderConsole('lists');
    fireEvent.click(await screen.findByRole('tab', { name: 'Characters' }));
    const alpha = await screen.findByRole('listitem', { name: 'Alpha' });
    await act(async () => fireEvent.click(within(alpha).getByRole('button', { name: 'Retire: Alpha' })));
    expect(catalog()).toEqual([expect.objectContaining({ id: 'c1', data: {}, status: 'retired' })]);
  });
});

describe('Owner console · Findings → lists', () => {
  it('approving a complete finding adds it to the list; moving it back retires it again', async () => {
    renderConsole('findings');
    const approve = await screen.findByRole('button', { name: 'Approve: Login event' });
    await act(async () => fireEvent.click(approve));
    expect(catalog()).toEqual([
      expect.objectContaining({
        kind: 'event',
        id: 'autumn-login-2026-10-12',
        source: 'finding:f2',
        data: expect.objectContaining({ title: 'Autumn login', kind: 'login', reward: 1600, loginDays: 7, currency: 'gem' }),
      }),
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('Added “Autumn login” to AA · Events. Everyone sees it after reload.');

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'approved' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Move back to new: Login event' })));
    expect(catalog()[0]).toMatchObject({ status: 'retired' });
    expect(screen.getByRole('status')).toHaveTextContent(/Retired “Autumn login” again/);
  });

  it('approving an incomplete finding opens the Lists form, pre-filled, and saving completes it', async () => {
    renderConsole('findings');
    const approve = await screen.findByRole('button', { name: 'Approve: New character Beta' });
    await act(async () => fireEvent.click(approve));
    expect(catalog()).toEqual([]);
    const form = await screen.findByRole('form', { name: 'Add character' });
    expect(within(form).getByText(/Still needed: rarity, role/)).toBeInTheDocument();
    expect(within(form).getByLabelText('Name')).toHaveValue('Beta');
    expect(within(form).getByLabelText('Element')).toHaveValue('ice');
    fireEvent.change(within(form).getByLabelText('Rarity'), { target: { value: 'top' } });
    fireEvent.change(within(form).getByLabelText('Role'), { target: { value: 'attack' } });
    await act(async () => fireEvent.click(within(form).getByRole('button', { name: 'Add character' })));
    expect(catalog()).toEqual([expect.objectContaining({ kind: 'character', id: 'beta', source: 'finding:f3', data: expect.objectContaining({ name: 'Beta', rarity: 'top', element: 'ice', role: 'attack' }) })]);
  });
});

describe('Owner console · Announcements', () => {
  it('publishes one to everyone and ends it now', async () => {
    renderConsole('announcements');
    expect(await screen.findByText('No data yet')).toBeInTheDocument();
    const form = screen.getByRole('form', { name: 'New announcement' });
    fireEvent.change(within(form).getByLabelText('Title'), { target: { value: 'Servers down Friday' } });
    fireEvent.change(within(form).getByLabelText('Kind'), { target: { value: 'warning' } });
    await act(async () => fireEvent.click(within(form).getByRole('button', { name: 'Publish' })));
    const ann = (db.current as FakeDb).tables.announcements as Record<string, unknown>[];
    expect(ann).toEqual([expect.objectContaining({ title: 'Servers down Friday', level: 'warning', ends_at: null })]);
    expect(screen.getByRole('status')).toHaveTextContent(/everyone signed in sees it/);
    const row = await screen.findByRole('listitem', { name: 'Servers down Friday' });
    expect(within(row).getByText('SHOWING')).toBeInTheDocument();
    await act(async () => fireEvent.click(within(row).getByRole('button', { name: 'End now: Servers down Friday' })));
    expect(ann[0]?.ends_at).toEqual(expect.any(String));
    expect(within(await screen.findByRole('listitem', { name: 'Servers down Friday' })).getByText('ENDED')).toBeInTheDocument();
  });
});

describe('Owner console · Overview numbers', () => {
  it('shows the server’s counts', async () => {
    (db.current as FakeDb).rpc.owner_stats = () => ({
      data: { users: 12, active_7d: 5, hoyolab_links: 3, findings_waiting: 2, jobs: [{ id: 'backup', last_run_at: null, last_status: null }], counted_at: '2026-10-10T00:00:00Z' },
      error: null,
    });
    renderConsole();
    const numbers = screen.getByRole('region', { name: 'Numbers' });
    expect(await within(numbers).findByText('12')).toBeInTheDocument();
    expect(within(numbers).getByText('5')).toBeInTheDocument();
    expect(within(numbers).getByText('3')).toBeInTheDocument();
    expect(screen.getByText('never')).toBeInTheDocument();
  });

  it('says No data yet when the call is refused', async () => {
    (db.current as FakeDb).rpc.owner_stats = () => ({ data: null, error: { message: 'owner only' } });
    renderConsole();
    const numbers = screen.getByRole('region', { name: 'Numbers' });
    expect(await within(numbers).findAllByText('No data yet')).toHaveLength(4);
  });
});
