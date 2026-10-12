import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gameData, resetUserData, saveTeam } from '../../core/data/userData';
import { fakeGame } from '../account-links/fakeGame';
import { decodeTeam, encodeTeam, shareUrl, teamAsText } from './shareLink';
import { setStanding } from '../../core/auth/standing';
import { SharedTeamRoute, SharedTeamView, ShareTeam } from './ShareTeam';
import type { CardRow } from './SharedBy';

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
  it('carries the sharer’s account id only when it is one, never anything else about them (T52)', () => {
    const by = '11111111-1111-4111-8111-111111111111';
    expect(decodeTeam(encodeTeam({ ...team, by }))).toEqual({ ok: true, team: { ...team, by } });
    expect(decodeTeam(encodeTeam({ ...team, by: 'not-an-id' }))).toEqual({ ok: true, team });
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

describe('shared by: the sharer’s profile card (T52)', () => {
  const row = (over: Partial<CardRow> = {}): CardRow => ({
    display_name: 'Mira',
    avatar_path: null,
    banner_path: null,
    title: 'Seer of worlds',
    frame: 'sky',
    name_color: 'gold',
    avatar_char: null,
    banner_char: null,
    owner: false,
    owner_title: null,
    badges: ['seated', 'first-light'],
    pinned_badge: 'first-light',
    stats: [{ game: 'aa', total: 120, tops: 2 }],
    featured: [],
    ...over,
  });
  const shared = { ...team, by: '11111111-1111-4111-8111-111111111111' };

  it('shows the card the server returned: checked badge, numbers, and never the owner’s sky frame for others', async () => {
    render(<SharedTeamView game={fakeGame()} team={shared} load={async () => row()} />);
    const card = await screen.findByRole('article', { name: 'Profile card: Mira' });
    expect(card).toHaveTextContent('First Light');
    expect(card).toHaveTextContent('120 pulls');
    expect(card.querySelector('[data-frame="sky"]')).toBeNull();
  });

  it('the owner’s card carries the owner badge with the name they chose', async () => {
    render(<SharedTeamView game={fakeGame()} team={shared} load={async () => row({ owner: true, owner_title: 'The Watcher Above', badges: ['owner', 'seated'], pinned_badge: null })} />);
    const card = await screen.findByRole('article', { name: 'Profile card: Mira' });
    expect(card).toHaveTextContent('The Watcher Above');
    expect(card.querySelector('[data-frame="sky"]')).not.toBeNull();
  });

  it('the owner’s chosen look (T64) shows on the owner’s card: badge, frame and name style', async () => {
    render(<SharedTeamView game={fakeGame()} team={shared} load={async () => row({ owner: true, badges: ['owner', 'seated'], pinned_badge: null, owner_style: { badge: 2, frame: 14, name: 14 } })} />);
    const card = await screen.findByRole('article', { name: 'Profile card: Mira' });
    await vi.waitFor(() => expect(card.querySelector('.oa-n14')).not.toBeNull());
    expect(card.querySelector('.oa-frame')).not.toBeNull();
    expect(card.querySelector('h2')).toHaveTextContent('Mira');
  });

  it('nobody else can wear the owner’s look, whatever their row says', async () => {
    render(<SharedTeamView game={fakeGame()} team={shared} load={async () => row({ owner_style: { badge: 2, frame: 14, name: 14 } })} />);
    const card = await screen.findByRole('article', { name: 'Profile card: Mira' });
    await new Promise((r) => setTimeout(r, 50));
    expect(card.querySelector('.oa-art')).toBeNull();
  });

  it('a private card (server says null) or no sharer shows nothing extra', async () => {
    const { unmount } = render(<SharedTeamView game={fakeGame()} team={shared} load={async () => null} />);
    expect(await screen.findByText('Fire Queen')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Shared by' })).toBeNull();
    unmount();
    render(<SharedTeamView game={fakeGame()} team={team} load={async () => row()} />);
    expect(await screen.findByText('Fire Queen')).toBeInTheDocument();
    expect(screen.queryByRole('article')).toBeNull();
  });
});

describe('a silenced account (T60b)', () => {
  it('keeps its teams but can’t share them while the silence runs', () => {
    setStanding({ bannedUntil: null, silencedUntil: Date.now() + 86_400_000 });
    render(<ShareTeam game={fakeGame()} team={{ id: 't1', name: 'Night', members: [] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.getByRole('status')).toHaveTextContent(/Sharing is paused for your account until .*Your teams are all still here\./);
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull();
    setStanding(null);
  });
});
