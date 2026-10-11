import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GameContract, PullRecord } from '../../core/contract';
import { LuckReport } from './LuckReport';

const game = (standardTop?: string[]) =>
  ({
    id: 'aa',
    terms: { rarity: { top: '5★', mid: '4★', low: '3★' } },
    currencies: [],
    bannerTypes: [{ id: 'character', label: 'Character banner', pullItem: 'ticket', target: 'character', pity: { kind: 'hard-pity', hardPity: 90, baseRate: 0.006, featured: { winRate: 0.5, guaranteeAfterLoss: true } } }],
    historyMapping: { uigfKey: 'x', gachaTypes: { '11': 'character' }, rarity: { '5': 'top' }, ...(standardTop ? { standardTop } : {}) },
  }) as unknown as GameContract;

const pull = (id: string, rarity: 'top' | 'low', featured?: boolean): PullRecord => ({ id, bannerType: 'character', itemId: id, name: id, rarity, time: `2026-01-01T00:00:${id.padStart(2, '0')}.000Z`, ...(featured === undefined ? {} : { featured }) });

describe('Luck report', () => {
  it('no history: the 50/50 tile asks for History', () => {
    const { container } = render(<LuckReport game={game()} history={[]} example={false} />);
    expect(container.textContent).toContain('needs History');
    expect(container.textContent).not.toContain('standard pool not listed yet');
  });

  it('history imported, but the game lists no standard pool: says why, not "needs History"', () => {
    const { container } = render(<LuckReport game={game()} history={[pull('1', 'low'), pull('2', 'top')]} example={false} />);
    expect(container.textContent).toContain('standard pool not listed yet');
    expect(container.textContent).not.toMatch(/50\/50 won[^·]*·\s*needs History/);
  });

  it('with featured known, it counts wins', () => {
    const { container } = render(<LuckReport game={game(['std'])} history={[pull('1', 'low'), pull('2', 'top', true)]} example={false} />);
    expect(container.textContent).toContain('1/1');
  });
});
