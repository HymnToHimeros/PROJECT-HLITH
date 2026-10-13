import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameContract } from '../../core/contract';
import type { FakeDb } from './fakeBackend.testutil';

// T77: every approved finding reaches Intel (News and leaks); list findings still go into their list; every Approve says where it went.
const db = vi.hoisted(() => ({ current: null as FakeDb | null }));
vi.mock('../../core/data/backend', async () => {
  const { fakeBackend, fakeDb } = await import('./fakeBackend.testutil');
  const post = (n: number, at: string, extra: object = {}) => ({ leak: true, post: { url: `https://t.me/Seele_Leaks/${n}`, at, text: `原文 ${n}`, images: [`https://cdn.example/${n}.jpg`], ...extra } });
  const finding = (id: string, title: string, payload: object, status = 'new') => ({
    id,
    job_id: 'leaks-scan',
    game_id: 'aa',
    kind: 'info',
    title,
    payload,
    source_name: 'Seele (Telegram)',
    source_url: null,
    found_at: '2026-10-13T04:00:00Z',
    delivered_at: '2026-10-13T04:10:00Z',
    delivered_by: 'routine',
    status,
    decided_at: status === 'approved' ? '2026-10-13T04:57:00Z' : null,
  });
  db.current = fakeDb(
    {
      scheduler_jobs: [],
      scheduler_runs: [],
      scheduler_findings: [
        finding('s-new', 'Leak (Seele): New planar set', post(37504, '2026-10-13T02:00:00Z', { translation: 'English words' })),
        finding('s-old', 'Leak (Seele): Earlier note', post(37486, '2026-10-12T20:00:00Z'), 'approved'),
        // The same event approved twice, as two findings: one note.
        finding('d-1', 'AA: new event Lap Event (2026-10-11 → 2026-10-16)', {}, 'approved'),
        finding('d-2', 'AA: new event Lap Event (2026-10-11 → 2026-10-16)', {}, 'approved'),
        finding('e-listed', 'AA: new event Big Fest (2026-10-13 → 2026-10-18)', {}),
        finding('e-missing', 'AA: new event Small Fair (2026-10-20 → 2026-10-25)', {}),
        finding('i-plain', 'Something worth knowing', {}),
        { ...finding('c-full', 'New star', { name: 'Nova', rarity: 'top', element: 'fire', role: 'attack' }), kind: 'character', source_name: 'nanoka.cc' },
      ],
      catalog_items: [],
    },
    { catalog_items: ['game_id', 'kind', 'id'] },
  );
  return { backend: fakeBackend(db.current) };
});

const { default: OwnerConsole } = await import('./OwnerConsole');
const { default: IntelScreen } = await import('../intel/IntelScreen');
const { forgetCatalogRows } = await import('../../core/data/catalogSource');

const game = {
  id: 'aa',
  short: 'AA',
  name: 'Game A',
  vent: '#A99BFF',
  terms: { rarity: { top: 'S', mid: 'A' }, gear: 'G', weapon: 'W', skill: 'S', character: 'Agent', endgame: [] },
  elements: [{ id: 'fire', label: 'Fire' }],
  roles: [{ id: 'attack', label: 'Attack' }],
  currencies: [{ id: 'gem', name: 'Gems', perPull: 160 }],
  bannerTypes: [],
  servers: [],
  reset: { hour: 4, weekday: 1 },
  modules: ['intel'],
  income: [],
  historyImporters: [],
  data: {
    characters: async () => [],
    banners: async () => [],
    events: async () => [{ id: 'big-fest', title: 'Big Fest', kind: 'bonus', start: '2026-10-13T20:00:00Z', end: '2026-10-18T19:59:00Z', reward: 0, currency: 'gem' }],
    materials: async () => [],
    backlog: async () => [],
    teams: async () => [],
    versions: async () => [],
  },
  rules: {},
  sources: [],
} as unknown as GameContract;

const props = { scope: 'aa', servers: {}, openTab: () => {}, open: () => {}, openAccount: () => {} } as const;
const notes = () => (db.current?.tables.catalog_items ?? []) as { kind: string; id: string; source: string; status: string; data: Record<string, unknown> }[];

describe('approved leak posts and info findings (T77)', () => {
  it('backfills earlier approvals, adds new ones to Intel with a plain message, checks events, and undoes', async () => {
    const view = render(<OwnerConsole games={[game]} {...props} />);
    // The post approved before notes existed gets its note once the findings load.
    await waitFor(() => expect(notes().map((r) => r.source)).toEqual(['finding:s-old', 'finding:d-1']));
    expect(notes()[1]).toMatchObject({ data: { title: 'Lap Event', text: '2026-10-11 → 2026-10-16', kind: 'info', leak: false } });
    expect(notes()[0]).toMatchObject({ kind: 'leak', status: 'active', data: { title: 'Earlier note', credit: 'Seele (Telegram)', url: 'https://t.me/Seele_Leaks/37486', leak: true } });

    fireEvent.click(screen.getByRole('tab', { name: /Findings/ }));
    await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Approve: Leak (Seele): New planar set' })));
    expect(screen.getByRole('status')).toHaveTextContent('Added to AA · Intel. Everyone sees it after reload');
    expect(notes().find((r) => r.source === 'finding:s-new')?.data).toMatchObject({ title: 'New planar set', text: '原文 37504', translation: 'English words', images: ['https://cdn.example/37504.jpg'] });

    // An event already listed: nothing new, and it says so.
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Approve: AA: new event Big Fest (2026-10-13 → 2026-10-18)' })));
    expect(screen.getByRole('status')).toHaveTextContent('Added to AA · Intel. “Big Fest” is already in AA · Events (2026-10-13 → 2026-10-18), so nothing new went into the list.');

    // Plain info: Intel only.
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Approve: Something worth knowing' })));
    expect(screen.getByRole('status')).toHaveTextContent('Added to AA · Intel. Everyone sees it after reload');

    // A complete character: into Characters and into Intel.
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Approve: New star' })));
    expect(screen.getByRole('status')).toHaveTextContent('Added to AA · Intel. Added “Nova” to AA · Characters.');
    expect((db.current?.tables.catalog_items ?? []).filter((r) => (r as { source: string }).source === 'finding:c-full').map((r) => (r as { kind: string }).kind).sort()).toEqual(['character', 'leak']);

    // A new event not in the list: the Lists form opens with its name and dates.
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Approve: AA: new event Small Fair (2026-10-20 → 2026-10-25)' })));
    expect(screen.getByRole('tab', { name: 'Lists' })).toHaveAttribute('aria-selected', 'true');
    const form = await screen.findByRole('form', { name: 'Add event' });
    expect(within(form).getByDisplayValue('Small Fair')).toBeInTheDocument();
    view.unmount();

    // Intel shows both notes, newest first, unverified, credited, English first with the original one tap away.
    forgetCatalogRows();
    render(<IntelScreen games={[game]} {...props} />);
    const section = await screen.findByRole('list', { name: 'News and leaks' });
    const cards = within(section).getAllByRole('article');
    // Every approval, newest first (the posts by when they were posted).
    // (The first five were found at the same time, so they keep the order they were written in.)
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['Lap Event', 'Big Fest', 'Something worth knowing', 'New star', 'Small Fair', 'New planar set', 'Earlier note']);
    expect(within(cards[1] as HTMLElement).queryByText('? UNVERIFIED')).toBeNull(); // not a leak
    expect(within(cards[3] as HTMLElement).getByText('Character')).toBeInTheDocument();
    const first = cards[5] as HTMLElement;
    expect(within(first).getByText('? UNVERIFIED')).toBeInTheDocument();
    expect(within(first).getByText(/Seele \(Telegram\)/)).toBeInTheDocument();
    expect(within(first).getByRole('link', { name: 'Post' })).toHaveAttribute('href', 'https://t.me/Seele_Leaks/37504');
    expect(within(first).getByText('Translated, may be inexact')).toBeInTheDocument();
    expect(within(first).getByText('English words')).toBeInTheDocument();
    fireEvent.click(within(first).getByRole('button', { name: 'Show original' }));
    expect(within(first).getByText('原文 37504')).toBeInTheDocument();
    expect(within(first).getByRole('link', { name: /Image 1/ })).toHaveAttribute('href', 'https://cdn.example/37504.jpg');
    expect(document.querySelector('img[src^="https://cdn.example"]')).toBeNull(); // images stay links
  });

  it('“Move back to new” takes the note out of Intel again (retired, not deleted)', async () => {
    forgetCatalogRows();
    render(<OwnerConsole games={[game]} {...props} />);
    fireEvent.click(screen.getByRole('tab', { name: /Findings/ }));
    fireEvent.change(await screen.findByLabelText('Status'), { target: { value: 'approved' } });
    await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Move back to new: Leak (Seele): New planar set' })));
    expect(screen.getByRole('status')).toHaveTextContent('Took it out of AA · Intel again.');
    expect(notes().find((r) => r.source === 'finding:s-new')).toMatchObject({ status: 'retired' });
    expect(notes().filter((r) => r.kind === 'leak')).toHaveLength(7); // nothing deleted
    // A list finding: both its Intel note and its list item are retired.
    await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Move back to new: New star' })));
    expect(screen.getByRole('status')).toHaveTextContent('Took it out of AA · Intel again. Retired “Nova” again');
    expect(notes().filter((r) => r.source === 'finding:c-full').map((r) => r.status)).toEqual(['retired', 'retired']);
  });
});
