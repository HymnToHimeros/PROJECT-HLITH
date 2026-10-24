import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameContract } from '../../core/contract';

// A fake server: the tables as an owner reads them, and a record of every change.
const calls = vi.hoisted(() => ({ updates: [] as { table: string; patch: object; id: unknown }[], invoked: [] as unknown[] }));
const tables = vi.hoisted(() => ({
  scheduler_jobs: [{ id: 'backup', enabled: true, cadence: null, last_run_at: null, last_status: null, last_message: null, next_due_at: null, lock_until: null }],
  scheduler_runs: [] as object[],
  scheduler_findings: [
    {
      id: 'f1',
      job_id: 'leaks-scan',
      game_id: 'aa',
      kind: 'leak',
      title: 'Real leak',
      payload: {},
      source_name: 'nanoka.cc',
      source_url: 'https://nanoka.cc/x',
      found_at: '2026-10-09T06:00:00Z',
      delivered_at: '2026-10-09T06:05:00Z',
      delivered_by: 'routine',
      status: 'approved',
      decided_at: '2026-10-09T06:05:00Z',
      auto_source: 'auto',
    },
  ],
  catalog_items: [] as object[],
}));
vi.mock('../../core/data/backend', () => {
  const query = (table: keyof typeof tables) => {
    const q = {
      select: () => q,
      order: () => q,
      limit: () => q,
      eq: () => q,
      upsert: async () => ({ error: null }),
      update: (patch: object) => ({
        eq: async (_c: string, id: unknown) => {
          calls.updates.push({ table, patch, id });
          return { error: null };
        },
      }),
      then: (ok: (a: { data: unknown; error: null }) => unknown) => Promise.resolve({ data: tables[table], error: null }).then(ok),
    };
    return q;
  };
  return {
    backend: {
      from: query,
      auth: { getUser: async () => ({ data: { user: { id: 'owner-1' } } }) },
      rpc: async (name: string) => {
        calls.invoked.push([name, null]);
        return { data: name === 'scheduler_timer_status' ? { running: false, key_saved: false } : null, error: null };
      },
      functions: {
        invoke: async (name: string, opts: unknown) => {
          calls.invoked.push([name, opts]);
          return { data: { started: true }, error: null };
        },
      },
    },
  };
});

const { default: OwnerConsole } = await import('./OwnerConsole');

const game = {
  id: 'aa',
  short: 'AA',
  name: 'Game A',
  vent: '#A99BFF',
  currencies: [],
  servers: [],
  reset: { hour: 4, weekday: 1 },
  modules: [],
  data: { characters: async () => [], banners: async () => [], events: async () => [], materials: async () => [], backlog: async () => [] },
} as unknown as GameContract;
const renderConsole = () => render(<OwnerConsole games={[game]} scope="all" servers={{}} openTab={() => {}} open={() => {}} openAccount={() => {}} />);

describe('Owner console · Scheduler with the server', () => {
  it('the timer is off until the owner presses Start, and says the Vault secret is missing', async () => {
    renderConsole();
    fireEvent.click(screen.getByRole('tab', { name: 'Scheduler' }));
    expect(await screen.findByText(/Off: nothing runs on its own until you press Start/)).toBeInTheDocument();
    expect(screen.getByText(/Before starting: add the Vault secret/)).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Start timer' })));
    expect(calls.invoked).toContainEqual(['scheduler_timer_start', null]);
    expect(screen.queryByText(/is an example/)).toBeNull();
    const log = screen.getByRole('region', { name: 'Run log' });
    expect(within(log).getByText('No data yet')).toBeInTheDocument();
  });

  it('Run now asks the scheduler function for that one job; the switch saves', async () => {
    renderConsole();
    fireEvent.click(screen.getByRole('tab', { name: 'Scheduler' }));
    const backup = await screen.findByRole('article', { name: 'Nightly backup' });
    await act(async () => fireEvent.click(within(backup).getByRole('button', { name: 'Run now' })));
    expect(calls.invoked).toContainEqual(['scheduler', { body: { job: 'backup' } }]);
    expect(within(backup).getByText(/Started/)).toBeInTheDocument();
    await act(async () => fireEvent.click(within(backup).getByRole('switch', { name: 'Nightly backup on' })));
    expect(calls.updates).toContainEqual({ table: 'scheduler_jobs', patch: { enabled: false }, id: 'backup' });
  });

  it('Findings is a read-only log: auto-approved findings show their source, no action buttons', async () => {
    renderConsole();
    // The tab says just "Findings" (no count) because nothing is new — everything is auto-approved.
    const tab = screen.getByRole('tab', { name: 'Findings' });
    fireEvent.click(tab);
    const log = await screen.findByRole('region', { name: /Log/ });
    expect(await within(log).findByText('Real leak')).toBeInTheDocument();
    expect(within(log).getByText('Auto-approved (auto)')).toBeInTheDocument();
    // Read-only: no Approve or Move-back-to-new buttons anywhere.
    expect(screen.queryByRole('button', { name: /Approve/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Move back to new/ })).toBeNull();
    // Filters still work on the read-only log.
    fireEvent.change(within(log).getByLabelText('Kind'), { target: { value: 'event' } });
    expect(within(log).getByText('Nothing matches these filters.')).toBeInTheDocument();
    fireEvent.change(within(log).getByLabelText('Kind'), { target: { value: 'all' } });
    expect(within(log).getByText('Real leak')).toBeInTheDocument();
    // No writes to scheduler_findings: the owner doesn't decide anything.
    expect(calls.updates.filter((u) => u.table === 'scheduler_findings')).toEqual([]);
  });
});
