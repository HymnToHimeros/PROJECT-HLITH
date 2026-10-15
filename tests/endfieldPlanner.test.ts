import { act, cleanup, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PullRecord } from '../src/core/contract';
import { reloadPrefs } from '../src/core/data/prefs';
import { importPulls, resetUserData } from '../src/core/data/userData';
import { endfield } from '../src/games/endfield/contract';
import PullsScreen from '../src/tools/pulls/PullsScreen';

// The owner-only Endfield Pulls screen with its real contract and banner list: Rejuvenation (Si) is the
// Chartered banner open on 20 October 2026; a lost 50/50 there can also give Typhoeus or Liino.
const NOW = '2026-10-20T12:00:00.000Z';
const OPENED = Date.parse('2026-10-15T04:00:00.000Z');

/** `n` pulls on the Chartered banner since it opened, the last one a 6★ `top` (or none). */
const pulls = (n: number, top?: string): PullRecord[] =>
  Array.from({ length: n }, (_, i) => {
    const last = i === n - 1 && top !== undefined;
    return {
      id: `p${i}`,
      bannerType: 'chartered',
      itemId: last ? top : 'chr_0020_meurs',
      name: last ? top : 'A 4★',
      rarity: last ? 'top' : 'low',
      time: new Date(OPENED + (i + 1) * 60_000).toISOString(),
    };
  });

const card = async (name = /Rejuvenation/) => {
  render(createElement(PullsScreen, { games: [endfield], scope: 'endfield', tab: 'planner', servers: { endfield: 'eu' }, openTab: () => {}, open: () => {}, openAccount: () => {} }));
  return within(await screen.findByRole('article', { name }));
};
const worst = (c: ReturnType<typeof within>) => c.getByText('Worst case').parentElement?.textContent;

describe('Endfield Pulls → Planner reads the banner open at each pull', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    localStorage.clear();
    reloadPrefs();
    resetUserData();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('Si on her own banner uses up the 120 guarantee: the next copy is the 240 token (170 more), pity back to 0/80', async () => {
    act(() => void importPulls('endfield', pulls(70, 'chr_0036_jsspsi')));
    const c = await card();
    expect(worst(c)).toBe('Worst case170');
    expect(c.getByText('Pity from your history').nextElementSibling?.textContent).toBe('0/80 · 50/50');
  });

  it('Typhoeus there is a lost 50/50 (alsoAvailable): the 120 guarantee still stands, 50 more', async () => {
    act(() => void importPulls('endfield', pulls(70, 'chr_0034_typhoea')));
    const c = await card();
    expect(worst(c)).toBe('Worst case50');
    expect(c.getByText('Pity from your history').nextElementSibling?.textContent).toBe('0/80 · 50/50');
  });

  it('69 pulls with no 6★: pity 69/80 (soft pity from 66), 51 to the 120 guarantee', async () => {
    act(() => void importPulls('endfield', pulls(69)));
    const c = await card();
    expect(c.getByText('Pity from your history').nextElementSibling?.textContent).toBe('69/80 · 50/50');
    expect(worst(c)).toBe('Worst case51');
  });

  it('names the earlier limited operators a lost 50/50 can give', async () => {
    const c = await card();
    expect(c.getByText(/A lost 50\/50 can also give Typhoeus, Liino/)).toBeInTheDocument();
  });

  it('a weapon banner says its real odds: 25% featured, not 50/50', async () => {
    const c = await card(/Bedazzled Issue/);
    expect(c.getByText('Pity from example pulls').nextElementSibling?.textContent).toMatch(/\/40 · 25% featured$/);
  });
});
