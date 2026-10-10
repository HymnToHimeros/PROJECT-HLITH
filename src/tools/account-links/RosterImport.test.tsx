import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { gameData, resetUserData, setRosterEntry } from '../../core/data/userData';
import { fakeGame } from './fakeGame';
import { GameImport } from './RosterImport';

const game = fakeGame();
const found = [
  { id: '1001', name: 'Ice Friend', level: 80, dupes: 2, weapon: null },
  { id: '1003', name: 'Fire Queen', level: 70, dupes: 0, weapon: null },
];

describe('Roster import: Add to my roster', () => {
  beforeEach(() => resetUserData());

  it('Undo after "Add" puts back the entries as they were before', async () => {
    setRosterEntry('aa', '1001', { owned: true, wanted: false, dupes: 0 });
    setRosterEntry('aa', '1003', { owned: false, wanted: true, dupes: 0 });
    render(<GameImport game={game} imported={found} who="test account" />);
    fireEvent.click(await screen.findByRole('button', { name: /Add to my AA roster \(2\)/ }));
    expect(gameData('aa').roster['1001']).toEqual({ owned: true, wanted: false, dupes: 2 });
    expect(gameData('aa').roster['1003']).toEqual({ owned: true, wanted: false, dupes: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(gameData('aa').roster['1001']).toEqual({ owned: true, wanted: false, dupes: 0 });
    expect(gameData('aa').roster['1003']).toEqual({ owned: false, wanted: true, dupes: 0 });
    expect(screen.getByRole('status')).toHaveTextContent('back as it was before this import');
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });

  it('Undo leaves alone anything you changed after the import', async () => {
    render(<GameImport game={game} imported={found} who="test account" />);
    fireEvent.click(await screen.findByRole('button', { name: /Add to my AA roster/ }));
    setRosterEntry('aa', '1003', { owned: true, wanted: false, dupes: 3 });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(gameData('aa').roster['1001']).toEqual({ owned: false, wanted: false, dupes: 0 });
    expect(gameData('aa').roster['1003']).toEqual({ owned: true, wanted: false, dupes: 3 });
    expect(screen.getByRole('status')).toHaveTextContent('One you changed since stays as you set it');
  });
});
