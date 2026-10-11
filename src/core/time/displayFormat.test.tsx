import { afterEach, describe, expect, it } from 'vitest';
import { cleanFormat, firstDayOfWeek, setDisplayFormat } from './displayFormat';
import { formatNumber } from './format';
import { formatDate, formatDateTime, formatFullDate, formatRange, formatTime } from './reset';

// 2026-10-11 15:05 UTC, shown in UTC so the test doesn't depend on the machine.
const t = Date.UTC(2026, 9, 11, 15, 5);
const v = { locale: 'en-GB', timeZone: 'UTC' };

describe('Customise → Time and format (T52b)', () => {
  afterEach(() => setDisplayFormat({}));

  it('nothing chosen = the locale’s own way, as before', () => {
    expect(formatTime(t, v)).toBe('15:05');
    expect(formatDate(t, v)).toBe('11 Oct');
    expect(firstDayOfWeek()).toBe(1);
  });

  it('clock, date order and the first day of the week follow the choice', () => {
    setDisplayFormat({ clock: '12h', date: 'mdy', weekStart: 'sun' });
    expect(formatTime(t, v).toLowerCase().replace(/\s/g, ' ')).toMatch(/^03:05 pm$/);
    expect(formatDate(t, v)).toBe('Oct 11');
    expect(formatFullDate(t, v)).toBe('Oct 11 2026');
    expect(formatRange(t, t + 3 * 86_400_000, v)).toBe('Oct 11 – Oct 14');
    expect(formatDateTime(t, v)).toMatch(/^Sun Oct 11, 03:05/);
    expect(firstDayOfWeek()).toBe(0);
    setDisplayFormat({ date: 'ymd' });
    expect(formatDate(t, v)).toBe('10-11');
    expect(formatFullDate(t, v)).toBe('2026-10-11');
  });

  it('numbers are grouped the chosen way', () => {
    setDisplayFormat({ numbers: 'comma' });
    expect(formatNumber(12480.5)).toBe('12,480.5');
    setDisplayFormat({ numbers: 'dot' });
    expect(formatNumber(12480.5)).toBe('12.480,5');
    setDisplayFormat({ numbers: 'space' });
    expect(formatNumber(12480).replace(/\s/g, ' ')).toBe('12 480');
  });

  it('keeps only known choices', () => {
    expect(cleanFormat({ clock: '36h', date: 'mdy', numbers: 7 })).toEqual({ date: 'mdy' });
  });
});

describe('countdown style (T52c)', () => {
  afterEach(() => setDisplayFormat({}));
  it('time left by default; the date or both when chosen', async () => {
    const { render } = await import('@testing-library/react');
    const { Timer } = await import('../ui/Timer');
    const to = Date.now() + 3 * 86_400_000 + 3_600_000;
    const { rerender, container } = render(<Timer to={to} prefix="ends in" />);
    const text = () => container.querySelector('time')?.textContent ?? '';
    expect(text()).toMatch(/^ends in 3d/);
    setDisplayFormat({ countdown: 'date' });
    rerender(<Timer to={to + 1} prefix="ends in" />);
    expect(text()).toMatch(/^ends [A-Z][a-z]{2}/);
    expect(text()).not.toMatch(/ in /);
    setDisplayFormat({ countdown: 'both' });
    rerender(<Timer to={to + 2} prefix="in" />);
    expect(text()).toMatch(/^in 3d \d\dh · /);
  });
});
