import { describe, expect, it } from 'vitest';
import { lastFullImport, MARKER, type RunSteps } from '../scripts/last-import.ts';

const run = (startedAt: string, marker: 'success' | 'skipped' | null, extra: RunSteps['steps'] = []): RunSteps => ({
  startedAt,
  steps: [{ name: 'Leaks and characters (nanoka.cc)', conclusion: 'success' }, { name: 'Kits, leaks included', conclusion: 'success' }, ...extra, ...(marker ? [{ name: MARKER, conclusion: marker }] : [])],
});

describe('the data refresh counts a run as an import only when every import step succeeded', () => {
  it('skips a run whose kit import failed (marker skipped), even though GitHub calls each step "success"', () => {
    // 26 Nov: nanoka and kits both report "success" (continue-on-error), but the kit import had failed.
    const runs = [run('2026-11-26T10:51:52Z', 'skipped'), run('2026-11-25T14:20:00Z', 'success')];
    expect(lastFullImport(runs)).toBe('2026-11-25T14:20:00Z');
  });

  it('takes the newest run that imported everything', () => {
    expect(lastFullImport([run('2026-11-27T09:00:00Z', 'success'), run('2026-11-26T09:00:00Z', 'success')])).toBe('2026-11-27T09:00:00Z');
  });

  it('a timer run that only checked the schedule (no imports, marker absent) does not count', () => {
    const checkOnly: RunSteps = { startedAt: '2026-11-27T12:00:00Z', steps: [{ name: 'Is a check due?', conclusion: 'success' }] };
    expect(lastFullImport([checkOnly, run('2026-11-27T09:00:00Z', 'success')])).toBe('2026-11-27T09:00:00Z');
  });

  it('no full import in the list gives undefined (the workflow then falls back to the time window)', () => {
    expect(lastFullImport([run('2026-11-26T10:51:52Z', 'skipped'), run('2026-11-26T04:00:00Z', null)])).toBeUndefined();
    expect(lastFullImport([])).toBeUndefined();
  });
});
