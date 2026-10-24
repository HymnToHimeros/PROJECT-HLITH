import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameContract } from '../../core/contract';
import type { FakeDb } from './fakeBackend.testutil';

// T77: every auto-approved finding reaches Intel (News and leaks); the Findings screen is a read-only log.
const db = vi.hoisted(() => ({ current: null as FakeDb | null }));
vi.mock('../../core/data/backend', async () => {
  const { fakeBackend, fakeDb } = await import('./fakeBackend.testutil');
  const post = (n: number, at: string, extra: object = {}) => ({ leak: true, post: { url: `https://t.me/Seele_Leaks/${n}`, at, text: `原文 ${n}`, images: [`https://cdn.example/${n}.jpg`], ...extra } });
  const finding = (id: string, title: string, payload: object, kind = 'info') => ({
    id,
    job_id: 'leaks-scan',
    game_id: 'aa',
    kind,
    title,
    payload,
    source_name: 'Seele (Telegram)',
    source_url: null,
    found_at: '2026-10-13T04:00:00Z',
    delivered_at: '2026-10-13T04:10:00Z',
    delivered_by: 'routine',
    status: 'approved',
    decided_at: '2026-10-13T04:10:00Z',
    auto_source: 'auto',
  });
  db.current = fakeDb(
    {
      scheduler_jobs: [],
      scheduler_runs: [],
      scheduler_findings: [
        finding('s-new', 'Leak (Seele): New planar set', post(37504, '2026-10-13T02:00:00Z', { translation: 'English words' })),
        finding('s-old', 'Leak (Seele): Earlier note', post(37486, '2026-10-12T20:00:00Z')),
        // The same event approved twice, as two findings: one note.
        finding('d-1', 'AA: new event Lap Event (2026-10-11 → 2026-10-16)', {}),
        finding('d-2', 'AA: new event Lap Event (2026-10-11 → 2026-10-16)', {}),
        finding('e-listed', 'AA: new event Big Fest (2026-10-13 → 2026-10-18)', {}),
        finding('e-missing', 'AA: new event Small Fair (2026-10-20 → 2026-10-25)', {}),
        finding('i-plain', 'Something worth knowing', {}),
        { ...finding('c-full', 'New star', { name: 'Nova', rarity: 'top', element: 'fire', role: 'attack' }, 'character'), source_name: 'nanoka.cc' },
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

describe('auto-approved findings reach Intel via backfill (T77)', () => {
  it('backfills all auto-approved findings into Intel notes, dedupes same event, and Intel renders them', async () => {
    const view = render(<OwnerConsole games={[game]} {...props} />);
    // All findings are auto-approved on intake; backfillNotes creates their Intel notes on load.
    // 8 findings, but d-1 and d-2 are the same event so one is deduped → 7 notes.
    await waitFor(() => expect(notes().filter((r) => r.kind === 'leak')).toHaveLength(7));

    // The deduped event: only one Intel note (kind 'leak'), with its dates.
    expect(notes().filter((r) => r.source.startsWith('finding:d-') && r.kind === 'leak')).toHaveLength(1);
    const lapNote = notes().find((r) => r.source === 'finding:d-1');
    expect(lapNote).toMatchObject({ data: { title: 'Lap Event', text: '2026-10-11 → 2026-10-16', kind: 'info', leak: false } });

    // A post with translation and images.
    const newSet = notes().find((r) => r.source === 'finding:s-new');
    expect(newSet?.data).toMatchObject({ title: 'New planar set', text: '原文 37504', translation: 'English words', images: ['https://cdn.example/37504.jpg'] });

    // The earlier post.
    const older = notes().find((r) => r.source === 'finding:s-old');
    expect(older).toMatchObject({ kind: 'leak', status: 'active', data: { title: 'Earlier note', credit: 'Seele (Telegram)', url: 'https://t.me/Seele_Leaks/37486', leak: true } });

    // A character finding makes an Intel note too (kind 'leak'; backfillListItems also adds a 'character' row).
    const charNote = notes().find((r) => r.source === 'finding:c-full' && r.kind === 'leak');
    expect(charNote?.data).toMatchObject({ kind: 'character', title: 'New star', credit: 'nanoka.cc' });

    // The Findings tab is a read-only log: no Approve or Move buttons.
    fireEvent.click(screen.getByRole('tab', { name: /Findings/ }));
    await screen.findByRole('region', { name: /Log/ });
    expect(screen.queryByRole('button', { name: /Approve/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Move back to new/ })).toBeNull();

    view.unmount();

    // Intel shows all notes, newest first, unverified, credited, English first with the original one tap away.
    forgetCatalogRows();
    render(<IntelScreen games={[game]} {...props} />);
    const section = await screen.findByRole('list', { name: 'News and leaks' });
    const cards = within(section).getAllByRole('article');
    // All 7 unique notes, newest (by post.at or found_at) first.
    // The five at 04:00 keep their insertion order; then s-new (02:00), s-old (20:00 previous day).
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['Lap Event', 'Big Fest', 'Small Fair', 'Something worth knowing', 'New star', 'New planar set', 'Earlier note']);
    expect(within(cards[1] as HTMLElement).queryByText('? UNVERIFIED')).toBeNull(); // Big Fest is not a leak
    expect(within(cards[4] as HTMLElement).getByText('Character')).toBeInTheDocument(); // New star shows its kind

    const leakCard = cards[5] as HTMLElement; // New planar set
    expect(within(leakCard).getByText('? UNVERIFIED')).toBeInTheDocument();
    expect(within(leakCard).getByText(/Seele \(Telegram\)/)).toBeInTheDocument();
    expect(within(leakCard).getByRole('link', { name: 'Post' })).toHaveAttribute('href', 'https://t.me/Seele_Leaks/37504');
    expect(within(leakCard).getByText('Translated, may be inexact')).toBeInTheDocument();
    expect(within(leakCard).getByText('English words')).toBeInTheDocument();
    fireEvent.click(within(leakCard).getByRole('button', { name: 'Show original' }));
    expect(within(leakCard).getByText('原文 37504')).toBeInTheDocument();
    expect(within(leakCard).getByRole('link', { name: /Image 1/ })).toHaveAttribute('href', 'https://cdn.example/37504.jpg');
    expect(document.querySelector('img[src^="https://cdn.example"]')).toBeNull(); // images stay links
  });
});
