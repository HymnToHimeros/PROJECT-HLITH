import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { gameData, resetUserData, saveTeam } from '../../core/data/userData';
import { fakeGame } from '../account-links/fakeGame';
import { decodeTeam, encodeTeam, shareUrl, teamAsText } from './shareLink';
import { SharedTeamRoute } from './ShareTeam';

const team = { game: 'aa', name: 'Fire Party · ÐÁ 🔥', members: ['1003', '1002', '1001'] };

describe('share link', () => {
  it('round-trips a team through the link (any characters in the name)', () => {
    expect(decodeTeam(encodeTeam(team))).toEqual({ ok: true, team });
    const url = shareUrl('https://hlith.example', team);
    expect(url.startsWith('https://hlith.example/aa/roster#team=')).toBe(true);
    expect(decodeTeam(url)).toEqual({ ok: true, team });
    expect(decodeTeam(new URL(url).hash)).toEqual({ ok: true, team });
  });
  it('refuses damaged or empty links and cleans what it reads', () => {
    expect(decodeTeam('#other=1')).toEqual({ ok: false, error: 'missing' });
    expect(decodeTeam('#team=%%%')).toEqual({ ok: false, error: 'broken' });
    expect(decodeTeam(`#team=${encodeTeam({ ...team, members: [] })}`)).toEqual({ ok: false, error: 'empty' });
    const messy = btoa(JSON.stringify({ v: 1, g: 'aa', n: '', m: ['1001', '1001', '<script>', 5] }))
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    expect(decodeTeam(messy)).toEqual({ ok: true, team: { game: 'aa', name: 'Shared team', members: ['1001'] } });
  });
  it('writes the team as plain text', () => {
    expect(teamAsText('Game A', team, (id) => `N${id}`)).toBe('Fire Party · ÐÁ 🔥 · Game A\n1. N1003\n2. N1002\n3. N1001');
  });
});

describe('opening a shared link', () => {
  beforeEach(() => {
    resetUserData();
    window.history.replaceState(null, '', '/aa/roster');
  });

  it('shows the team read-only and saves it as a new team, leaving your others alone', async () => {
    saveTeam('aa', { id: 'mine', name: 'My team', members: ['1001'] });
    window.history.replaceState(null, '', `/aa/roster#team=${encodeTeam(team)}`);
    render(<SharedTeamRoute games={[fakeGame()]} />);
    expect(await screen.findByText('Fire Queen')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save to my teams' }));
    const teams = gameData('aa').teams;
    expect(teams).toHaveLength(2);
    expect(teams[0]).toEqual({ id: 'mine', name: 'My team', members: ['1001'] });
    expect(teams[1]).toMatchObject({ name: team.name, members: team.members });
    expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled();
  });

  it('closes and clears the link from the address bar', async () => {
    window.history.replaceState(null, '', `/aa/roster#team=${encodeTeam(team)}`);
    render(<SharedTeamRoute games={[fakeGame()]} />);
    await screen.findByText('Fire Queen');
    const [close] = screen.getAllByRole('button', { name: 'Close' });
    if (close) act(() => fireEvent.click(close));
    expect(window.location.hash).toBe('');
    expect(screen.queryByText('Fire Queen')).not.toBeInTheDocument();
  });

  it('explains a broken link or an unknown game', () => {
    window.history.replaceState(null, '', '/aa/roster#team=@@');
    const { unmount } = render(<SharedTeamRoute games={[fakeGame()]} />);
    expect(screen.getByRole('alert')).toHaveTextContent('damaged');
    unmount();
    window.history.replaceState(null, '', `/aa/roster#team=${encodeTeam({ ...team, game: 'zz' })}`);
    render(<SharedTeamRoute games={[fakeGame()]} />);
    expect(screen.getByRole('alert')).toHaveTextContent('game HLITH doesn’t have');
  });
});
