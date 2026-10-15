// @vitest-environment node
import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_HOSTS,
  ERROR_TEXT,
  claimCheckin,
  findRoles,
  parseRequest,
  readSkport,
  type BoundRole,
  type Deps,
} from '../supabase/functions/_shared/skport';

const hmacSha256 = async (key: string, data: string) => createHmac('sha256', key).update(data).digest('hex');
const md5 = (s: string) => createHash('md5').update(s).digest('hex');
const NOW = 1700000000000;

// ── Host allowlist ──────────────────────────────────────────────

describe('host allowlist', () => {
  it('includes only the two SKPort hosts', () => {
    expect(ALLOWED_HOSTS.has('zonai.skport.com')).toBe(true);
    expect(ALLOWED_HOSTS.has('as.gryphline.com')).toBe(true);
    expect(ALLOWED_HOSTS.size).toBe(2);
  });

  it('blocks hosts not in the allowlist', () => {
    expect(ALLOWED_HOSTS.has('evil.example.com')).toBe(false);
    expect(ALLOWED_HOSTS.has('zonai.skport.com.evil.com')).toBe(false);
  });
});

// ── Request parsing ─────────────────────────────────────────────

describe('parseRequest', () => {
  it('accepts a valid token with default wants', () => {
    const r = parseRequest({ accountToken: 'abc123' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.request.accountToken).toBe('abc123');
      expect(r.request.want).toEqual(['account', 'stamina']);
    }
  });

  it('rejects missing or empty token', () => {
    expect(parseRequest({}).ok).toBe(false);
    expect(parseRequest({ accountToken: '' }).ok).toBe(false);
    expect(parseRequest({ accountToken: '   ' }).ok).toBe(false);
  });

  it('filters invalid want parts', () => {
    const r = parseRequest({ accountToken: 'x', want: ['stamina', 'fake', 'checkin'] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.request.want).toEqual(['stamina', 'checkin']);
  });

  it('defaults claim to false', () => {
    const r = parseRequest({ accountToken: 'x' });
    if (r.ok) expect(r.request.claim).toBe(false);
  });
});

// ── Error text never echoes the token ───────────────────────────

describe('error text safety', () => {
  it('no error text echoes actual credential values', () => {
    for (const [, text] of Object.entries(ERROR_TEXT)) {
      expect(text).not.toMatch(/cred|salt|secret|password/i);
    }
  });

  it('error text exists for every error code', () => {
    const codes = ['bad-request', 'login', 'expired', 'no-account', 'pick-role', 'busy', 'server'] as const;
    for (const c of codes) {
      expect(ERROR_TEXT[c]).toBeTruthy();
    }
  });
});

// ── Token exchange → readSkport ─────────────────────────────────

function mockDeps(overrides: Partial<Record<string, unknown>> = {}): Deps & { calls: Array<{ url: string; init: Record<string, unknown> }> } {
  const calls: Array<{ url: string; init: Record<string, unknown> }> = [];
  const grantOk = overrides.grantFail !== true;
  const credOk = overrides.credFail !== true;
  const refreshOk = overrides.refreshFail !== true;
  const bindingRoles = (overrides.roles ?? [{ uid: '100001', nickName: 'Tester', level: 30, serverId: 'gs01', serverName: 'Global' }]) as Array<Record<string, unknown>>;
  const cardDetail = overrides.cardDetail ?? { base: { name: 'Tester', level: 30, worldLevel: 5, serverName: 'Global' }, dungeon: { curStamina: 80, maxStamina: 240, maxTs: NOW / 1000 + 3600 } };
  const checkinData = overrides.checkinData ?? { calendar: [{ checked: true }, { checked: true }], hasSigned: false };

  const fakeFetch = async (url: string, init: Record<string, unknown>) => {
    calls.push({ url, init });
    if (url.includes('/user/oauth2/v2/grant')) {
      if (!grantOk) return { ok: false, status: 401, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ status: 0, data: { code: 'GRANT_CODE' } }) };
    }
    if (url.includes('/generate_cred_by_code')) {
      if (!credOk) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ code: 0, data: { cred: 'CRED_VALUE' } }) };
    }
    if (url.includes('/auth/refresh')) {
      if (!refreshOk) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ code: 0, data: { token: 'SALT_VALUE' } }) };
    }
    if (url.includes('/game/player/binding')) {
      return { ok: true, status: 200, json: async () => ({ code: 0, data: { list: [{ bindingList: bindingRoles }] } }) };
    }
    if (url.includes('/card/detail')) {
      return { ok: true, status: 200, json: async () => ({ code: 0, data: cardDetail }) };
    }
    if (url.includes('/attendance')) {
      if (init.method === 'POST') return { ok: true, status: 200, json: async () => ({ code: 0, data: {} }) };
      return { ok: true, status: 200, json: async () => ({ code: 0, data: checkinData }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  return { fetch: fakeFetch as Deps['fetch'], hmacSha256, md5, now: () => NOW, calls };
}

describe('readSkport', () => {
  it('reads stamina and account level from a valid token', async () => {
    const d = mockDeps();
    const result = await readSkport({ accountToken: 'TEST_TOKEN', want: ['account', 'stamina'] }, d);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answer.account.uid).toBe('100001');
    expect(result.answer.account.level).toBe(30);
    expect(result.answer.account.worldLevel).toBe(5);
    expect(result.answer.stamina?.current).toBe(80);
    expect(result.answer.stamina?.max).toBe(240);
    expect(result.answer.stamina?.fullInSeconds).toBe(3600);
  });

  it('reads check-in status', async () => {
    const d = mockDeps();
    const result = await readSkport({ accountToken: 'TEST_TOKEN', want: ['checkin'] }, d);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answer.checkin?.checkedInToday).toBe(false);
    expect(result.answer.checkin?.daysThisMonth).toBe(2);
    expect(result.answer.checkin?.claimedNow).toBe(false);
  });

  it('claims check-in when asked and not yet signed', async () => {
    const d = mockDeps();
    const result = await readSkport({ accountToken: 'TEST_TOKEN', want: ['checkin'], claim: true }, d);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answer.checkin?.checkedInToday).toBe(true);
    expect(result.answer.checkin?.claimedNow).toBe(true);
    expect(result.answer.checkin?.daysThisMonth).toBe(3);
  });

  it('returns expired when grant fails with 401', async () => {
    const d = mockDeps({ grantFail: true });
    const result = await readSkport({ accountToken: 'BAD_TOKEN', want: ['account'] }, d);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('expired');
  });

  it('returns no-account when no roles found', async () => {
    const d = mockDeps({ roles: [] });
    const result = await readSkport({ accountToken: 'TEST_TOKEN', want: ['account'] }, d);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('no-account');
  });

  it('returns pick-role when multiple roles and no uid given', async () => {
    const d = mockDeps({
      roles: [
        { uid: '100001', nickName: 'A', level: 1, serverId: 'gs01', serverName: 'Global' },
        { uid: '100002', nickName: 'B', level: 2, serverId: 'gs02', serverName: 'Asia' },
      ],
    });
    const result = await readSkport({ accountToken: 'TEST_TOKEN', want: ['account'] }, d);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('pick-role');
  });

  it('picks the requested uid when multiple roles exist', async () => {
    const d = mockDeps({
      roles: [
        { uid: '100001', nickName: 'A', level: 1, serverId: 'gs01', serverName: 'Global' },
        { uid: '100002', nickName: 'B', level: 2, serverId: 'gs02', serverName: 'Asia' },
      ],
    });
    const result = await readSkport({ accountToken: 'TEST_TOKEN', uid: '100002', want: ['account'] }, d);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answer.account.uid).toBe('100002');
  });

  it('only contacts allowed hosts', async () => {
    const d = mockDeps();
    await readSkport({ accountToken: 'TEST_TOKEN', want: ['account', 'stamina', 'checkin'] }, d);
    for (const c of d.calls) {
      const url = new URL(c.url);
      expect(ALLOWED_HOSTS.has(url.hostname)).toBe(true);
    }
  });

  it('never includes the token in error responses', async () => {
    const d = mockDeps({ grantFail: true });
    const result = await readSkport({ accountToken: 'SUPER_SECRET_TOKEN', want: ['account'] }, d);
    expect(result.ok).toBe(false);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('SUPER_SECRET_TOKEN');
  });
});

// ── findRoles ────────────────────────────────────────────────────

describe('findRoles', () => {
  it('extracts roles from the binding response', async () => {
    const d = mockDeps();
    const cred = { cred: 'C', salt: 'S' };
    const result = await findRoles(cred, d);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.roles).toHaveLength(1);
    expect(result.roles[0]?.uid).toBe('100001');
  });
});

// ── claimCheckin ─────────────────────────────────────────────────

describe('claimCheckin', () => {
  it('POSTs to the attendance endpoint', async () => {
    const d = mockDeps();
    const role: BoundRole = { uid: '100001', nickname: 'Tester', level: 30, serverId: 'gs01', serverName: 'Global' };
    const cred = { cred: 'C', salt: 'S' };
    const result = await claimCheckin(role, cred, d);
    expect(result.ok).toBe(true);
    const attendanceCall = d.calls.find((c) => c.url.includes('/attendance') && c.init.method === 'POST');
    expect(attendanceCall).toBeTruthy();
  });
});
