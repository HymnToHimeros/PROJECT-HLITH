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
      status: 'new',
      decided_at: null,
    },
  ],
}));
vi.mock('../../core/data/backend', () => {
  const query = (table: keyof typeof tables) => {
    const q = {
      select: () => q,
      order: () => q,
      limit: () => q,
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
  it('says plainly that the cron job has not started until the Vault secret exists', async () => {
    renderConsole();
    fireEvent.click(screen.getByRole('tab', { name: 'Scheduler' }));
    expect(await screen.findByText(/Not started: add the Vault secret/)).toBeInTheDocument();
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

  it('Approve saves the decision with who and when', async () => {
    renderConsole();
    fireEvent.click(screen.getByRole('tab', { name: /Findings/ }));
    const approve = await screen.findByRole('button', { name: 'Approve: Real leak' });
    await act(async () => fireEvent.click(approve));
    const saved = calls.updates.find((u) => u.table === 'scheduler_findings');
    expect(saved).toMatchObject({ id: 'f1', patch: { status: 'approved', decided_by: 'owner-1' } });
    expect(screen.getByText('0 new')).toBeInTheDocument();
  });
});
