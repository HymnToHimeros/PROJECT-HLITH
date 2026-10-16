import { describe, expect, it } from 'vitest';
import { endfield } from '../src/games/endfield/contract';

describe('Endfield contract numbers', () => {
  it('Sanity: 1 point per 7 min 12 s, level-60 cap 360 (wiki; not stated officially, so not verified)', () => {
    expect(endfield.stamina).toEqual([{ id: 'sanity', name: 'Sanity', max: 360, minutesPerPoint: 7.2 }]);
    expect(endfield.sources.find((s) => s.what.startsWith('Sanity'))?.verified).toBe(false);
  });

  it('income: daily, weekly, pass and events, with amounts where a source states one', () => {
    const by = Object.fromEntries(endfield.income.map((r) => [r.id, r.amount]));
    expect(by).toMatchObject({ 'endfield.daily': 200, 'endfield.weekly-routine': 500, 'endfield.monthly-pass': 200, 'endfield.protocol-pass': 600, 'endfield.events': null });
    expect(endfield.income.filter((r) => r.schedule.kind === 'from-events')).toHaveLength(1);
  });

  it('the Endministrator is a once-only choice: male or female by the game id', () => {
    const p = endfield.protagonist;
    const c = (id: string) => ({ id, name: 'Endministrator', rarity: 'top' as const, element: 'physical', role: 'guard' });
    expect(p?.of(c('chr_0002_endminm'))).toEqual({ option: 'male', form: 'Endministrator' });
    expect(p?.of(c('chr_0003_endminf'))).toEqual({ option: 'female', form: 'Endministrator' });
    expect(p?.of(c('chr_0036_jsspsi'))).toBeUndefined();
  });
});
