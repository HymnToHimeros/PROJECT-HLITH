import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { GameContract } from '../../core/contract';
import { beforeEach, describe, expect, it } from 'vitest';
import { gameData, resetUserData, setRosterEntry } from '../../core/data/userData';
import { fakeGame } from '../account-links/fakeGame';
import { checkValues, fieldsFor } from './scan';
import { Scan, ScanEntry } from './Scan';

const game = fakeGame();

describe('scan fields', () => {
  it('names each field from the game record’s own words', () => {
    expect(fieldsFor(game).map((f) => [f.label, f.kind, f.saved])).toEqual([
      ['Level', 'level', false],
      ['Eidolon', 'dupes', true],
      ['Light Cone', 'text', false],
      ['Relics', 'text', false],
      ['Traces', 'text', false],
    ]);
  });
  it('checks numbers are in range and lets empty fields through', () => {
    const f = fieldsFor(game);
    expect(checkValues(f, { eidolon: '7' })).toHaveProperty('eidolon');
    expect(checkValues(f, { level: '0' })).toHaveProperty('level');
    expect(checkValues(f, { eidolon: '', level: '80', 'light-cone': 'anything' })).toEqual({});
  });
});

describe('Scan', () => {
  beforeEach(() => resetUserData());

  it('saves what you typed: owned + dupes; newly owned leaves the wanted list', async () => {
    setRosterEntry('aa', '1003', { owned: false, wanted: true, dupes: 0 });
    render(<Scan game={game} />);
    const who = await screen.findByLabelText('Character');
    await screen.findByRole('option', { name: 'Fire Queen' });
    fireEvent.change(who, { target: { value: '1003' } });
    fireEvent.change(screen.getByLabelText(/Eidolon/), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save to my roster' }));
    await waitFor(() => expect(gameData('aa').roster['1003']).toEqual({ owned: true, wanted: false, dupes: 2 }));
    expect(screen.getByRole('status')).toHaveTextContent('Fire Queen is owned, E2');
  });

  it('leaves dupes as they were when the field is empty', async () => {
    setRosterEntry('aa', '1001', { owned: true, wanted: false, dupes: 4 });
    render(<Scan game={game} characterId="1001" />);
    await screen.findByRole('option', { name: 'Ice Friend' });
    fireEvent.click(screen.getByRole('button', { name: 'Save to my roster' }));
    await waitFor(() => expect(gameData('aa').roster['1001']).toEqual({ owned: true, wanted: false, dupes: 4 }));
  });

  it('says plainly the screenshot reader isn’t built yet, without blaming your setup', () => {
    render(<Scan game={game} />);
    expect(screen.getByRole('button', { name: 'Read it for me' })).toBeDisabled();
    expect(screen.getByText(/HLITH can’t read screenshots by itself yet/)).toBeInTheDocument();
    expect(screen.queryByText(/isn’t set up/)).not.toBeInTheDocument();
  });

  it('marks fields that aren’t saved, and the save message lists what was kept and what wasn’t', async () => {
    render(<Scan game={game} characterId="1003" />);
    await screen.findByRole('option', { name: 'Fire Queen' });
    expect(screen.getByLabelText('Level · not saved')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Eidolon/).closest('div')).not.toHaveTextContent('not saved');
    fireEvent.change(screen.getByLabelText('Level · not saved'), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText('Relics · not saved'), { target: { value: 'Two sets' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save to my roster' }));
    await waitFor(() => expect(gameData('aa').roster['1003']?.owned).toBe(true));
    const msg = screen.getByRole('status');
    expect(msg).toHaveTextContent('Fire Queen is owned, E0 (as it was).');
    expect(msg).toHaveTextContent('Not saved, because HLITH can’t store builds yet: Level, Relics.');
  });

  it('refuses an out-of-range number', async () => {
    render(<Scan game={game} characterId="1001" />);
    await screen.findByRole('option', { name: 'Ice Friend' });
    fireEvent.change(screen.getByLabelText(/Eidolon/), { target: { value: '9' } });
    expect(screen.getByRole('button', { name: 'Save to my roster' })).toBeDisabled();
  });
});

/** The same made-up game without a screenshot scan. */
function noScan(g: GameContract): GameContract {
  const { scan, ...rest } = g;
  void scan;
  return rest;
}

describe('Scan a screenshot button', () => {
  it('is one button for several games; the sheet asks which game the screenshot is from', async () => {
    const other = fakeGame({ id: 'bb', short: 'BB', name: 'Game B' });
    render(<ScanEntry games={[game, other, noScan(fakeGame({ id: 'cc', short: 'CC' }))]} />);
    const buttons = screen.getAllByRole('button', { name: 'Scan a screenshot' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0] as HTMLElement);
    const tabs = await screen.findByRole('tablist', { name: 'Which game is the screenshot from' });
    expect(within(tabs).getAllByRole('tab').map((t) => t.textContent)).toEqual(['AA', 'BB']);
  });
  it('is disabled when no game has a scan', () => {
    render(<ScanEntry games={[noScan(fakeGame())]} />);
    expect(screen.getByRole('button', { name: 'Scan a screenshot' })).toBeDisabled();
  });
});
