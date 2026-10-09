import { describe, expect, it } from 'vitest';
import { formatCountdown, formatNumber, isUrgent, ticksLive } from './format';

const H = 3_600_000;

describe('formatCountdown', () => {
  it('shows days and hours at a day or more', () => {
    expect(formatCountdown(2 * 24 * H + 4 * H + 59_000)).toBe('2d 04h');
    expect(formatCountdown(24 * H)).toBe('1d 00h');
  });
  it('shows a live clock under a day', () => {
    expect(formatCountdown(14 * H + 22 * 60_000 + 7_000)).toBe('14:22:07');
  });
  it('never goes negative', () => {
    expect(formatCountdown(-5)).toBe('00:00:00');
  });
});

describe('urgency and ticking', () => {
  it('is urgent under 72 hours only', () => {
    expect(isUrgent(71 * H)).toBe(true);
    expect(isUrgent(72 * H)).toBe(false);
    expect(isUrgent(0)).toBe(false);
  });
  it('ticks only under a day', () => {
    expect(ticksLive(23 * H)).toBe(true);
    expect(ticksLive(25 * H)).toBe(false);
  });
});

it('formats numbers by locale', () => {
  expect(formatNumber(14280, 'en-US')).toBe('14,280');
  expect(formatNumber(14280, 'de-DE')).toBe('14.280');
});
