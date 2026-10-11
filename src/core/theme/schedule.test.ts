import { describe, expect, it } from 'vitest';
import type { GameContract } from '../contract';
import { cleanSchedule, scheduledTheme } from './schedule';
import { VENT_CHOICES, withVent } from './vents';

const at = (h: number, m = 0) => new Date(2026, 9, 11, h, m);

describe('Customise → Theme schedule (T52b)', () => {
  it('off = your one theme', () => {
    expect(scheduledTheme('crimson', undefined, 'all', at(12))).toBe('crimson');
    expect(scheduledTheme('crimson', { mode: 'nonsense' }, 'all', at(12))).toBe('crimson');
  });

  it('day and night switch at the chosen times, also across midnight', () => {
    const s = { mode: 'day-night', day: 'light', night: 'dark', dayFrom: '07:00', nightFrom: '19:30' };
    expect(scheduledTheme('crimson', s, 'all', at(6, 59))).toBe('dark');
    expect(scheduledTheme('crimson', s, 'all', at(7))).toBe('light');
    expect(scheduledTheme('crimson', s, 'all', at(19, 29))).toBe('light');
    expect(scheduledTheme('crimson', s, 'all', at(19, 30))).toBe('dark');
    const nightOwl = { ...s, dayFrom: '22:00', nightFrom: '06:00' };
    expect(scheduledTheme('crimson', nightOwl, 'all', at(23))).toBe('light');
    expect(scheduledTheme('crimson', nightOwl, 'all', at(3))).toBe('light');
    expect(scheduledTheme('crimson', nightOwl, 'all', at(12))).toBe('dark');
  });

  it('one theme per game; a game without one keeps your theme', () => {
    const s = { mode: 'per-game', themes: { hsr: 'bifrost', zzz: 'nope' } };
    expect(cleanSchedule(s)).toEqual({ mode: 'per-game', themes: { hsr: 'bifrost' } });
    expect(scheduledTheme('dark', s, 'hsr', at(12))).toBe('bifrost');
    expect(scheduledTheme('dark', s, 'zzz', at(12))).toBe('dark');
  });
});

describe('Customise → Game colours (T52b)', () => {
  const game = { id: 'aa', vent: '#A99BFF' } as unknown as GameContract;
  it('uses your colour only when it is one of the tested choices', () => {
    const sky = VENT_CHOICES.find((v) => v.id === 'sky')?.value as string;
    expect(withVent(game, { aa: sky }).vent).toBe(sky);
    expect(withVent(game, { aa: '#ff0000' })).toBe(game);
    expect(withVent(game, undefined)).toBe(game);
  });
});
