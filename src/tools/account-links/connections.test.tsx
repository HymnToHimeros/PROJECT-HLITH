import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { gameData, resetUserData, setRosterEntry } from '../../core/data/userData';
import { fakeCharacters, fakeGame } from './fakeGame';
import { forgetLogin, readLogin, rememberLogin, savedLogin } from './hoyolab';
import { LinkAccount } from './LinkAccount';
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
  beforeEach(() => localStorage.clear());
  it('is off unless asked, and Forget deletes it', () => {
    expect(savedLogin('aa')).toBeNull();
    rememberLogin('aa', { ltuid_v2: '1', ltoken_v2: TOKEN }, '700');
    expect(savedLogin('aa')?.uid).toBe('700');
    expect(localStorage.getItem('hlith.userdata') ?? '').not.toContain(TOKEN); // never part of your synced data
    forgetLogin('aa');
    expect(savedLogin('aa')).toBeNull();
    expect(localStorage.getItem('hlith.secret.hoyolab')).toBeNull();
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

  it('only adds: never removes, never un-owns, never lowers dupes, keeps wanted', () => {
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
    expect(after['1003']).toEqual({ owned: true, wanted: true, dupes: 6 });
    expect(Object.keys(after).sort()).toEqual(['1001', '1003', '1004']);
  });

  it('shows the import sheet with an EXAMPLE preview and says why it can’t connect on this device', async () => {
    render(<RosterImport game={game} />);
    fireEvent.click(screen.getByRole('button', { name: 'Import from HoYoLAB' }));
    expect(await screen.findByRole('region', { name: 'Example preview' })).toHaveTextContent('EXAMPLE');
    expect(screen.getByText(/runs on this device only/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Find my characters' })).toBeDisabled();
  });

  it('is disabled for a game without a HoYoLAB character import', () => {
    render(<RosterImport game={fakeGame({ accountLinks: [] })} />);
    expect(screen.getByRole('button', { name: 'Import from HoYoLAB' })).toBeDisabled();
  });
});

describe('HoYoLAB link card', () => {
  it('explains every step, marks itself unverified and shows example readings until connected', () => {
    render(<LinkAccount game={fakeGame()} />);
    expect(screen.getByText('How to get your HoYoLAB login values')).toBeInTheDocument();
    expect(screen.getAllByText(/ltoken_v2/).length).toBeGreaterThan(0);
    expect(screen.getByText('? UNVERIFIED')).toBeInTheDocument();
    expect(screen.getByLabelText('Example readings')).toHaveTextContent('180/240');
    expect(screen.getByRole('button', { name: 'Check now' })).toBeDisabled();
  });
  it('says so for a game without a link', () => {
    render(<LinkAccount game={fakeGame({ accountLinks: [] })} />);
    expect(screen.getByText('No HoYoLAB link for this game')).toBeInTheDocument();
  });
});
