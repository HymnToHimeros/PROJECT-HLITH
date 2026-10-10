/**
 * Test helper: a small in-memory stand-in for the Supabase client, enough for the owner
 * console (tables, filters, upsert/insert/update, rpc, functions, auth). Every write is
 * also recorded in `db.writes`, so tests can check exactly what went to the server.
 */
export interface FakeDb {
  tables: Record<string, Record<string, unknown>[]>;
  writes: { table: string; op: 'insert' | 'upsert' | 'update'; value: unknown; where?: Record<string, unknown> }[];
  rpc: Record<string, () => { data: unknown; error: { message: string } | null }>;
  invoked: unknown[];
  keys: Record<string, string[]>;
}

export function fakeDb(tables: FakeDb['tables'], keys: FakeDb['keys'] = {}): FakeDb {
  return { tables, writes: [], rpc: {}, invoked: [], keys };
}

export function fakeBackend(db: FakeDb) {
  const from = (table: string) => {
    const rows = () => (db.tables[table] ??= []);
    const where: Record<string, unknown> = {};
    let op: { kind: 'select' } | { kind: 'update'; patch: Record<string, unknown> } = { kind: 'select' };
    const matches = (r: Record<string, unknown>) => Object.entries(where).every(([k, v]) => r[k] === v);
    const run = () => {
      if (op.kind === 'update') {
        const hit = rows().filter(matches);
        for (const r of hit) Object.assign(r, op.patch);
        db.writes.push({ table, op: 'update', value: op.patch, where: { ...where } });
        return { data: hit, error: null };
      }
      return { data: rows().filter(matches), error: null };
    };
    const q = {
      select: () => q,
      order: () => q,
      limit: () => q,
      lte: () => q,
      or: () => q,
      eq: (col: string, v: unknown) => {
        where[col] = v;
        return q;
      },
      match: (m: Record<string, unknown>) => {
        Object.assign(where, m);
        return q;
      },
      update: (patch: Record<string, unknown>) => {
        op = { kind: 'update', patch };
        return q;
      },
      insert: async (value: Record<string, unknown>) => {
        rows().push({ id: `row-${rows().length + 1}`, created_at: new Date().toISOString(), ...value });
        db.writes.push({ table, op: 'insert', value });
        return { error: null };
      },
      upsert: async (value: Record<string, unknown>) => {
        const key = db.keys[table] ?? ['id'];
        const found = rows().find((r) => key.every((k) => r[k] === value[k]));
        if (found) Object.assign(found, value);
        else rows().push({ status: 'active', ...value });
        db.writes.push({ table, op: 'upsert', value });
        return { error: null };
      },
      then: (ok: (a: { data: unknown; error: null }) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, bad),
    };
    return q;
  };
  return {
    from,
    auth: {
      getUser: async () => ({ data: { user: { id: 'owner-1' } } }),
      getSession: async () => ({ data: { session: { user: { id: 'owner-1' } } } }),
    },
    rpc: async (name: string) => {
      db.invoked.push([name, null]);
      const answer = db.rpc[name];
      return answer ? answer() : { data: null, error: null };
    },
    functions: {
      invoke: async (name: string, opts: unknown) => {
        db.invoked.push([name, opts]);
        return { data: { started: true }, error: null };
      },
    },
  };
}
