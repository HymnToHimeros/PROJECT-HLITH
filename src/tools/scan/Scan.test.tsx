import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { gameData, resetUserData, setRosterEntry } from '../../core/data/userData';
import { fakeGame } from '../account-links/fakeGame';
import { checkValues, fieldsFor } from './scan';
import { Scan } from './Scan';

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

  it('saves what you typed: owned + dupes, keeping wanted', async () => {
    setRosterEntry('aa', '1003', { owned: false, wanted: true, dupes: 0 });
    render(<Scan game={game} />);
    const who = await screen.findByLabelText('Character');
    await screen.findByRole('option', { name: 'Fire Queen' });
    fireEvent.change(who, { target: { value: '1003' } });
    fireEvent.change(screen.getByLabelText(/Eidolon/), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save to my roster' }));
    await waitFor(() => expect(gameData('aa').roster['1003']).toEqual({ owned: true, wanted: true, dupes: 2 }));
    expect(screen.getByRole('status')).toHaveTextContent('Fire Queen is owned, E2');
  });

  it('leaves dupes as they were when the field is empty', async () => {
    setRosterEntry('aa', '1001', { owned: true, wanted: false, dupes: 4 });
    render(<Scan game={game} characterId="1001" />);
    await screen.findByRole('option', { name: 'Ice Friend' });
    fireEvent.click(screen.getByRole('button', { name: 'Save to my roster' }));
    await waitFor(() => expect(gameData('aa').roster['1001']).toEqual({ owned: true, wanted: false, dupes: 4 }));
  });

  it('marks "Read it for me" as needing the Assistant key until one is set', () => {
    render(<Scan game={game} />);
    expect(screen.getByRole('button', { name: 'Read it for me (uses your Assistant key)' })).toBeDisabled();
    expect(screen.getByText(/needs the Assistant with your own key/)).toBeInTheDocument();
  });

  it('refuses an out-of-range number', async () => {
    render(<Scan game={game} characterId="1001" />);
    await screen.findByRole('option', { name: 'Ice Friend' });
    fireEvent.change(screen.getByLabelText(/Eidolon/), { target: { value: '9' } });
    expect(screen.getByRole('button', { name: 'Save to my roster' })).toBeDisabled();
  });
});
