// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { saveCodeList, type Db, type Query } from '../supabase/functions/_shared/hoyolabStore';

/** Minimal fake db that tracks calls and can reject specific operations. */
function fakeDb(opts: { existingCodes?: string[]; rejectUpdate?: string } = {}): { db: Db; calls: { method: string; table: string; args: unknown[] }[] } {
  const calls: { method: string; table: string; args: unknown[] }[] = [];
  const existing = opts.existingCodes ?? [];

  function makeQuery(table: string): Query {
    const chain: { method: string; args: unknown[] }[] = [];

    const q = {
      select(columns: string) { chain.push({ method: 'select', args: [columns] }); return q; },
      insert(row: object) { chain.push({ method: 'insert', args: [row] }); return q; },
      upsert(rows: object[], options?: object) { chain.push({ method: 'upsert', args: [rows, options] }); return q; },
      update(patch: object) { chain.push({ method: 'update', args: [patch] }); return q; },
      eq(column: string, value: unknown) { chain.push({ method: 'eq', args: [column, value] }); return q; },
      in(column: string, values: unknown[]) { chain.push({ method: 'in', args: [column, values] }); return q; },
      is(column: string, value: null) { chain.push({ method: 'is', args: [column, value] }); return q; },
      gte(column: string, value: string) { chain.push({ method: 'gte', args: [column, value] }); return q; },
      or(filter: string) { chain.push({ method: 'or', args: [filter] }); return q; },
      order(column: string, options?: object) { chain.push({ method: 'order', args: [column, options] }); return q; },
      limit(n: number) { chain.push({ method: 'limit', args: [n] }); return q; },
      then(resolve?: unknown, reject?: unknown) {
        const methods = chain.map((c) => c.method);
        calls.push(...chain.map((c) => ({ method: c.method, table, args: c.args })));

        let result: { data: unknown; error: { message: string } | null } = { data: null, error: null };
        if (methods.includes('select') && methods.includes('in')) {
          const inArgs = chain.find((c) => c.method === 'in')?.args;
          const codes = (inArgs?.[1] as string[]) ?? [];
          const matched = codes.filter((c) => existing.includes(c));
          result = { data: matched.map((code) => ({ code })), error: null };
        } else if (methods.includes('update')) {
          result = opts.rejectUpdate ? { data: null, error: { message: opts.rejectUpdate } } : { data: [], error: null };
        } else if (methods.includes('upsert')) {
          result = { data: [], error: null };
        }

        return Promise.resolve(result).then(
          resolve as ((v: unknown) => unknown) | undefined,
          reject as ((r: unknown) => unknown) | undefined,
        );
      },
    } as unknown as Query;
    return q;
  }

  const db: Db = {
    from(table: string) { return makeQuery(table); },
    rpc(fn: string, args?: object) { calls.push({ method: 'rpc', table: '', args: [fn, args] }); return Promise.resolve({ data: null, error: null }); },
  };
  return { db, calls };
}

describe('saveCodeList', () => {
  const NOW = '2026-10-31T10:00:00Z';

  it('inserts fresh codes with source and updates known codes with just last_seen', async () => {
    const { db, calls } = fakeDb({ existingCodes: ['KNOWN1'] });
    const result = await saveCodeList(db, 'hkrpg_global', [
      { code: 'KNOWN1', rewards: null },
      { code: 'FRESH1', rewards: '60 Stellar Jade' },
    ], 'hoyo-codes', NOW);

    expect(result).toEqual({ total: 2, fresh: 1 });
    const upsertCall = calls.find((c) => c.method === 'upsert');
    expect(upsertCall).toBeDefined();
    const upsertRows = (upsertCall?.args[0] ?? []) as object[];
    expect(upsertRows[0]).toMatchObject({ code: 'FRESH1', source: 'hoyo-codes' });

    const updateCall = calls.find((c) => c.method === 'update');
    expect(updateCall).toBeDefined();
    expect(updateCall?.args[0]).toEqual({ last_seen: NOW });
  });

  it('uses update (not upsert) for known codes, avoiding NOT NULL source violation', async () => {
    const { db, calls } = fakeDb({ existingCodes: ['A', 'B'] });
    await saveCodeList(db, 'nap_global', [
      { code: 'A', rewards: null },
      { code: 'B', rewards: null },
    ], 'finding', NOW);

    const upsertCalls = calls.filter((c) => c.method === 'upsert');
    expect(upsertCalls).toHaveLength(0);
    const updateCalls = calls.filter((c) => c.method === 'update');
    expect(updateCalls).toHaveLength(1);
  });

  it('throws on a failed update with the db error message', async () => {
    const { db } = fakeDb({ existingCodes: ['X'], rejectUpdate: 'null value in column "source"' });
    await expect(saveCodeList(db, 'hkrpg_global', [{ code: 'X', rewards: null }], 'finding', NOW)).rejects.toThrow('Refreshing known codes failed: null value in column "source"');
  });

  it('handles all-fresh codes without any update call', async () => {
    const { db, calls } = fakeDb({ existingCodes: [] });
    const result = await saveCodeList(db, 'hkrpg_global', [{ code: 'NEW1', rewards: null }], 'finding', NOW);
    expect(result).toEqual({ total: 1, fresh: 1 });
    expect(calls.filter((c) => c.method === 'update')).toHaveLength(0);
    expect(calls.filter((c) => c.method === 'upsert')).toHaveLength(1);
  });
});
