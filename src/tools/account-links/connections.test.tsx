import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { gameData, resetUserData, setRosterEntry } from '../../core/data/userData';
import { fakeCharacters, fakeGame } from './fakeGame';
import { accountsFor, codeLoginRefused, fromDevice, fromServerRows, importSources, lastCheckinLine, latestRedemptions, maskId, mergeAccounts, nextLabel, readCodes, readRedeemLogin, sameAccount, type LinkedAccount, type ServerRow } from './accounts';
import { deviceAccounts, forgetDeviceAccount, forgetLogin, readLogin, rememberLogin, resetDeviceAccountsForTests, savedLogin, saveDeviceAccount } from './hoyolab';
import { LinkAccounts } from './LinkAccount';
import { RosterImport } from './RosterImport';
import { applyImport, planImport } from './rosterImport';

const TOKEN = 'v2_ABCDEFGHIJKLMNOP123';

describe('reading the pasted login', () => {
  it('takes bare values in any order', () => {
    expect(readLogin(`${TOKEN}\n123456789`)).toEqual({ ok: true, login: { ltuid_v2: '123456789', ltoken_v2: TOKEN } });
    expect(readLogin(`123456789 ${TOKEN} abc12_hy`)).toEqual({ ok: true, login: { ltuid_v2: '123456789', ltoken_v2: TOKEN, ltmid_v2: 'abc12_hy' } });
  });
  it('takes name=value lines (a cookie line)', () => {
    expect(readLogin(`ltuid_v2=123456789; ltoken_v2=${TOKEN}; other=1`)).toEqual({ ok: true, login: { ltuid_v2: '123456789', ltoken_v2: TOKEN } });
  });
  it('says which value is missing', () => {
    expect(readLogin('123456789')).toEqual({ ok: false, missing: ['ltoken_v2'] });
    expect(readLogin('')).toEqual({ ok: false, missing: ['ltuid_v2', 'ltoken_v2'] });
  });
});

describe('remember on this device', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDeviceAccountsForTests();
  });
  it('is off unless asked, and Forget deletes it', () => {
    expect(savedLogin('aa')).toBeNull();
    rememberLogin('aa', { ltuid_v2: '1', ltoken_v2: TOKEN }, '700');
    expect(savedLogin('aa')?.uid).toBe('700');
    expect(localStorage.getItem('hlith.userdata') ?? '').not.toContain(TOKEN); // never part of your synced data
    forgetLogin('aa');
    expect(savedLogin('aa')).toBeNull();
    expect(localStorage.getItem('hlith.secret.hoyolab')).toBeNull();
    expect(localStorage.getItem('hlith.secret.hoyolab.accounts')).toBeNull();
  });
  it('keeps one entry per login across games, with a label each (main and alt)', () => {
    rememberLogin('aa', { ltuid_v2: '111', ltoken_v2: TOKEN }, '700');
    rememberLogin('bb', { ltuid_v2: '111', ltoken_v2: TOKEN }, '1500');
    saveDeviceAccount({ label: 'Alt', login: { ltuid_v2: '222', ltoken_v2: TOKEN }, games: [{ gameId: 'aa', uid: '800' }] });
    const list = deviceAccounts();
    expect(list.map((a) => [a.label, a.games.map((g) => `${g.gameId}:${g.uid}`)])).toEqual([
      ['Main', ['aa:700', 'bb:1500']],
      ['Alt', ['aa:800']],
    ]);
    forgetDeviceAccount(list[1]?.id ?? '');
    expect(deviceAccounts().map((a) => a.label)).toEqual(['Main']);
  });
  it('still reads logins an older HLITH saved per game, and forgets them only when asked', () => {
    localStorage.setItem('hlith.secret.hoyolab', JSON.stringify({ aa: { login: { ltuid_v2: '9', ltoken_v2: TOKEN }, uid: '700', savedAt: '2026-10-01T00:00:00Z' }, bb: { login: { ltuid_v2: '9', ltoken_v2: TOKEN }, savedAt: '2026-10-01T00:00:00Z' } }));
    const list = deviceAccounts();
    expect(list).toHaveLength(1);
    expect(list[0]?.games.map((g) => g.gameId)).toEqual(['aa', 'bb']);
    expect(savedLogin('bb')?.login.ltuid_v2).toBe('9');
    forgetDeviceAccount(list[0]?.id ?? '');
    expect(localStorage.getItem('hlith.secret.hoyolab')).toBeNull();
  });
});

describe('account list handling', () => {
  const a = fakeGame();
  const b = fakeGame({ id: 'bb', short: 'BB', name: 'Game B', accountLinks: [{ provider: 'hoyolab', supports: ['roster'], config: { gameBiz: 'nap_global' } }] });
  const row = (over: Partial<ServerRow>): ServerRow => ({ id: 's1', label: 'Main', hoyolab_id: '123456789', games: [], has_redeem_login: false, auto_checkin: false, auto_redeem: false, forgotten_at: null, ...over });

  it('names new accounts Main, Alt, Alt 2… and masks the HoYoLAB number', () => {
    expect(nextLabel([])).toBe('Main');
    expect(nextLabel(['Main'])).toBe('Alt');
    expect(nextLabel(['main', 'Alt', 'Alt 2'])).toBe('Alt 3');
    expect(maskId('123456789')).toBe('1234•••89');
  });

  it('maps saved rows to games by the game records, and leaves forgotten ones out of the list', () => {
    const list = fromServerRows(
      [
        row({ games: [{ gameBiz: 'hkrpg_global', uid: '700000001', nickname: 'Me', server: 'Europe' }, { gameBiz: 'nap_global', uid: '1500000001' }, { gameBiz: 'genshin', uid: '1' }] }),
        row({ id: 's2', label: 'Old', forgotten_at: '2026-10-01T00:00:00Z' }),
      ],
      [a, b],
    );
    expect(list).toHaveLength(1);
    expect(list[0]?.games).toEqual([
      { gameId: 'aa', uid: '700000001', nickname: 'Me', server: 'Europe' },
      { gameId: 'bb', uid: '1500000001' },
    ]);
    expect(list[0]?.login).toBeUndefined(); // a saved login never reaches the browser
  });

  it('shows a login once even when it is both saved on the server and on this device', () => {
    const server = fromServerRows([row({ hoyolab_id: '111' })], [a]);
    const device = fromDevice([
      { id: 'd1', label: 'Main', login: { ltuid_v2: '111', ltoken_v2: TOKEN }, games: [], savedAt: '' },
      { id: 'd2', label: 'Alt', login: { ltuid_v2: '222', ltoken_v2: TOKEN }, games: [], savedAt: '' },
    ]);
    expect(mergeAccounts(server, device).map((x) => `${x.where}:${x.label}`)).toEqual(['server:Main', 'device:Alt']);
  });

  it('feeds each game’s roster from one account, the first by default or the one picked', () => {
    const main: LinkedAccount = { id: 'm', label: 'Main', where: 'server', hoyolabId: '1', games: [{ gameId: 'aa', uid: '700' }, { gameId: 'bb', uid: '1500' }], autoCheckin: false, autoRedeem: false, hasRedeemLogin: false };
    const alt: LinkedAccount = { ...main, id: 'x', label: 'Alt', games: [{ gameId: 'aa', uid: '800' }] };
    expect(accountsFor([main, alt], 'aa').map((x) => x.label)).toEqual(['Main', 'Alt']);
    expect(importSources([main, alt], [a, b]).map((s) => [s.game.id, s.account.label, s.uid])).toEqual([
      ['aa', 'Main', '700'],
      ['bb', 'Main', '1500'],
    ]);
    expect(importSources([main, alt], [a, b], { aa: 'x' }).map((s) => [s.game.id, s.account.label, s.uid])).toEqual([
      ['aa', 'Alt', '800'],
      ['bb', 'Main', '1500'],
    ]);
    expect(importSources([alt], [a, b]).map((s) => s.game.id)).toEqual(['aa']); // no account for bb: nothing guessed
  });

  it('says when the last automatic check-in ran and what it got, or why it failed', () => {
    const now = new Date(2026, 9, 9, 12, 0).getTime();
    const at = new Date(2026, 9, 9, 5, 2).toISOString();
    const rows = [
      { link_id: 'm', game_biz: 'hkrpg_global', ran_at: at, started_by: 'auto' as const, status: 'claimed' as const, message: null, reward: '20 × Stellar Jade' },
      { link_id: 'm', game_biz: 'nap_global', ran_at: at, started_by: 'auto' as const, status: 'error' as const, message: 'HoYoLAB wants a captcha first.', reward: null },
    ];
    expect(lastCheckinLine(rows, 'm', 'hkrpg_global', now)).toEqual({ text: 'Last automatic check-in: today 05:02 · got 20 × Stellar Jade', ok: true });
    expect(lastCheckinLine(rows, 'm', 'nap_global', now)).toEqual({ text: 'Last automatic check-in failed: today 05:02 · HoYoLAB wants a captcha first.', ok: false });
    expect(lastCheckinLine(rows, 'other', 'hkrpg_global', now)).toBeNull();
  });

  it('keeps the latest answer per code and UID', () => {
    const r = (code: string, status: string, ran_at: string, game_uid = '700') => ({ link_id: 'm', game_biz: 'hkrpg_global', game_uid, code, ran_at, status, message: null });
    const list = latestRedemptions([r('A', 'cooldown', '2026-10-08'), r('A', 'redeemed', '2026-10-09'), r('B', 'expired', '2026-10-07'), r('A', 'redeemed', '2026-10-09', '800')], 'm');
    expect(list.map((x) => `${x.game_uid}:${x.code}:${x.status}`)).toEqual(['700:A:redeemed', '800:A:redeemed', '700:B:expired']);
  });

  it('reads the code login and pasted codes', () => {
    expect(readRedeemLogin('account_id_v2=123456; account_mid_v2=abc12_hy; cookie_token_v2=v2_ABCDEFGHIJKLMNOP')).toEqual({ ok: true, login: { account_id_v2: '123456', account_mid_v2: 'abc12_hy', cookie_token_v2: 'v2_ABCDEFGHIJKLMNOP' } });
    expect(readRedeemLogin('v2_ABCDEFGHIJKLMNOP 123456')).toEqual({ ok: false, missing: ['account_mid_v2'] });
    expect(readCodes('starrailgift\nAB12CD34, starrailgift')).toEqual(['STARRAILGIFT', 'AB12CD34']);
  });

  it('the code login must be this account’s own: account_id_v2 is the HoYoLAB ID', () => {
    const redeem = { account_id_v2: '123456', account_mid_v2: 'abc12_hy', cookie_token_v2: 'v2_ABCDEFGHIJKLMNOP' };
    expect(sameAccount(redeem, '123456')).toBe(true);
    expect(sameAccount(redeem, '999999')).toBe(false);
  });

  it('notices when HoYoverse’s latest answer refused the code login', () => {
    const r = (code: string, status: string, ran_at: string) => ({ link_id: 'm', game_biz: 'hkrpg_global', game_uid: '700', code, ran_at, status, message: 'x' });
    expect(codeLoginRefused([r('A', 'redeemed', '2026-10-08'), r('B', 'login', '2026-10-09')], 'm')?.code).toBe('B');
    expect(codeLoginRefused([r('B', 'login', '2026-10-08'), r('A', 'redeemed', '2026-10-09')], 'm')).toBeNull();
    expect(codeLoginRefused([], 'm')).toBeNull();
  });
});

describe('roster import', () => {
  beforeEach(() => resetUserData());
  const game = fakeGame();

  it('plans new, raise, no change and unknown', () => {
    const roster = { '1001': { owned: true, wanted: false, dupes: 1 }, '1002': { owned: true, wanted: false, dupes: 3 } };
    const rows = planImport(
      game,
      [
        { id: '1001', name: 'Ice Friend', level: 80, dupes: 2, weapon: null },
        { id: '1002', name: 'Wind Blade', level: 80, dupes: 3, weapon: null },
        { id: '9999', name: 'Fire Queen', level: 70, dupes: 0, weapon: { name: 'Cone', level: 70 } }, // matched by name
        { id: '8888', name: 'Nobody Known', level: 1, dupes: 0, weapon: null },
      ],
      fakeCharacters,
      roster,
    );
    expect(rows.map((r) => [r.name, r.status, r.dupesAfter])).toEqual([
      ['Fire Queen', 'new', 0],
      ['Ice Friend', 'update', 2],
      ['Wind Blade', 'same', 3],
      ['Nobody Known', 'unknown', 0],
    ]);
  });

  it('only adds: never removes, never un-owns, never lowers dupes; a newly owned character leaves the wanted list', () => {
    setRosterEntry('aa', '1001', { owned: true, wanted: true, dupes: 5 }); // higher than HoYoLAB says
    setRosterEntry('aa', '1004', { owned: true, wanted: false, dupes: 2 }); // not on HoYoLAB at all
    setRosterEntry('aa', '1003', { owned: false, wanted: true, dupes: 0 }); // wanted, now owned
    const before = gameData('aa').roster;
    const rows = planImport(
      game,
      [
        { id: '1001', name: 'Ice Friend', level: 80, dupes: 1, weapon: null },
        { id: '1003', name: 'Fire Queen', level: 80, dupes: 9, weapon: null }, // more than max: capped
      ],
      fakeCharacters,
      before,
    );
    const counts = applyImport('aa', rows, before);
    const after = gameData('aa').roster;
    expect(counts).toEqual({ added: 1, updated: 0 });
    expect(after['1001']).toEqual({ owned: true, wanted: true, dupes: 5 });
    expect(after['1004']).toEqual({ owned: true, wanted: false, dupes: 2 });
    expect(after['1003']).toEqual({ owned: true, wanted: false, dupes: 6 });
    expect(Object.keys(after).sort()).toEqual(['1001', '1003', '1004']);
  });

  it('shows the import sheet with an EXAMPLE preview and says why it can’t connect on this device', async () => {
    render(<RosterImport games={[game]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Import from HoYoLAB' }));
    expect(await screen.findByRole('region', { name: 'Example preview' })).toHaveTextContent('EXAMPLE');
    expect(screen.getAllByText(/runs on this device only/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Find my characters' })).toBeDisabled();
  });

  it('is one button for several games, and the sheet picks the game or every connected game', async () => {
    const other = fakeGame({ id: 'bb', short: 'BB', name: 'Game B', accountLinks: [{ provider: 'hoyolab', supports: ['roster'], config: { gameBiz: 'nap_global' } }] });
    render(<RosterImport games={[game, other]} />);
    const buttons = screen.getAllByRole('button', { name: 'Import from HoYoLAB' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0] as HTMLElement);
    const tabs = await screen.findByRole('tablist', { name: 'Which game to import' });
    expect(tabs).toHaveTextContent('Every connected game');
    expect(tabs).toHaveTextContent('AA');
    expect(tabs).toHaveTextContent('BB');
    expect(screen.getByText(/No linked account covers Game A or Game B/)).toBeInTheDocument();
  });

  it('is disabled for games without a HoYoLAB character import', () => {
    render(<RosterImport games={[fakeGame({ accountLinks: [] })]} />);
    expect(screen.getByRole('button', { name: 'Import from HoYoLAB' })).toBeDisabled();
  });
});

describe('Connected accounts', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDeviceAccountsForTests();
  });
  it('explains itself, marks itself unverified and shows EXAMPLE accounts until one is added', () => {
    render(<LinkAccounts games={[fakeGame()]} />);
    expect(screen.getByText('How connected accounts work')).toBeInTheDocument();
    expect(screen.getByText('How to get your HoYoLAB login values')).toBeInTheDocument();
    expect(screen.getByText('How the automatic jobs work')).toBeInTheDocument();
    expect(screen.getAllByText(/ltoken_v2/).length).toBeGreaterThan(0);
    expect(screen.getByText('? UNVERIFIED')).toBeInTheDocument();
    expect(screen.getByLabelText('Example accounts')).toHaveTextContent('EXAMPLE');
    expect(screen.getByLabelText('Example readings')).toHaveTextContent('180/240');
    expect(screen.getByRole('button', { name: /^Add Main/ })).toBeDisabled();
  });
  it('says plainly what HLITH can and can’t do by itself', () => {
    render(<LinkAccounts games={[fakeGame()]} />);
    const own = screen.getByRole('region', { name: 'What HLITH can do on its own' });
    expect(own).toHaveTextContent('Daily check-in');
    expect(own).toHaveTextContent('Gift codes');
    expect(own).toHaveTextContent('Web events need you to open them yourself');
  });
  it('shows one list of accounts, each with every game it covers (not one block per game)', () => {
    const other = fakeGame({ id: 'bb', short: 'BB', name: 'Game B', accountLinks: [{ provider: 'hoyolab', supports: ['stamina'], config: { gameBiz: 'nap_global' } }] });
    rememberLogin('aa', { ltuid_v2: '111111', ltoken_v2: TOKEN }, '700000001');
    rememberLogin('bb', { ltuid_v2: '111111', ltoken_v2: TOKEN }, '1500000001');
    saveDeviceAccount({ label: 'Alt', login: { ltuid_v2: '222222', ltoken_v2: TOKEN }, games: [{ gameId: 'aa', uid: '800000001' }] });
    render(<LinkAccounts games={[fakeGame(), other]} />);
    const main = screen.getByRole('region', { name: 'HoYoLAB account Main' });
    expect(main).toHaveTextContent('Game A');
    expect(main).toHaveTextContent('Game B');
    expect(main).toHaveTextContent('Remembered on this device only');
    expect(screen.getByRole('region', { name: 'HoYoLAB account Alt' })).toHaveTextContent('UID 800000001');
    expect(screen.getByText('Your HoYoLAB accounts · 2')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(TOKEN);
  });
  it('the example check-in reward uses the game’s own currency', () => {
    const g = fakeGame({ currencies: [{ id: 'poly', name: 'Polychrome', perPull: 160 }] } as never);
    render(<LinkAccounts games={[g]} />);
    expect(screen.getByLabelText('Example accounts')).toHaveTextContent('got 20 × Polychrome');
    expect(screen.getByLabelText('Example accounts')).not.toHaveTextContent('Stellar Jade');
  });
  it('an account covering a switched-off game says so, instead of quietly hiding it', () => {
    const other = fakeGame({ id: 'bb', short: 'BB', name: 'Game B', accountLinks: [{ provider: 'hoyolab', supports: ['stamina'], config: { gameBiz: 'nap_global' } }] });
    saveDeviceAccount({ label: 'Main', login: { ltuid_v2: '111111', ltoken_v2: TOKEN }, games: [{ gameId: 'aa' }, { gameId: 'bb' }] });
    render(<LinkAccounts games={[fakeGame()]} allGames={[fakeGame(), other]} />);
    const main = screen.getByRole('region', { name: 'HoYoLAB account Main' });
    expect(main).toHaveTextContent('Also covers Game B, switched off in your games');
  });
  it('says so when no game has a link', () => {
    render(<LinkAccounts games={[fakeGame({ accountLinks: [] })]} />);
    expect(screen.getByText('No HoYoLAB link for your games')).toBeInTheDocument();
  });
});
