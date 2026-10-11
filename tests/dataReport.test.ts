import { describe, expect, it } from 'vitest';
import { kitDiff, report, type Lists } from '../scripts/schedule/report.ts';

const NOW = Date.parse('2026-10-10T12:00:00Z');
const empty: Lists = { characters: [], banners: [], events: [], versions: [], kits: [] };
const kit = (gameText: string, extra: { id: string; label: string; gameText: string }[] = []) => ({
  id: 'k',
  characterId: '1511',
  beta: true,
  version: '4.6.52',
  skills: [{ id: 'skill', label: 'Skill: Laugh', gameText }, ...extra],
});

describe('what an automatic refresh changed', () => {
  it('names changed, new and gone kit parts', () => {
    expect(kitDiff(kit('Deals 100%'), kit('Deals 120%', [{ id: 'trace', label: 'Trace: Encore', gameText: '…' }]))).toEqual(['changed: Skill: Laugh', 'new: Trace: Encore']);
    expect(kitDiff(kit('a', [{ id: 'trace', label: 'Trace: Encore', gameText: '…' }]), kit('a'))).toEqual(['gone: Trace: Encore']);
  });

  it('reports a leak\'s beta kit change with the kit\'s own build and its stale sheet, as an info finding', () => {
    const chars = [{ id: '1511', name: 'Aeon ★ Aha', leak: { source: 'nanoka.cc' } }];
    const r = report('hsr', { ...empty, characters: chars, kits: [kit('Deals 100%')] }, { ...empty, characters: chars, kits: [kit('Deals 120%')] }, {
      build: '4.6.53',
      now: NOW,
      staleSheet: (id) => (id === '1511' ? 'its beta kit changed since it was read (1 quoted line changed)' : undefined),
    });
    expect(r.kitChanged).toEqual(['1511']);
    expect(r.lines).toEqual(['HSR: Aeon ★ Aha: beta kit changed in build 4.6.52 (1 part)', '  - changed: Skill: Laugh', "  - LOGIC-CORE: re-read Aeon ★ Aha's kit sheet (its beta kit changed since it was read (1 quoted line changed))"]);
    expect(r.findings).toEqual([
      expect.objectContaining({ job: 'leaks-scan', kind: 'info', source: { name: 'nanoka.cc, build 4.6.52', url: 'https://nanoka.cc/hsr' }, payload: expect.objectContaining({ build: '4.6.52', staleSheet: expect.stringContaining('1 quoted line') }) }),
    ]);
  });

  it('ignores kit changes of released characters', () => {
    const released = { ...kit('a'), beta: false };
    const r = report('hsr', { ...empty, characters: [{ id: '1511', name: 'X' }], kits: [released] }, { ...empty, characters: [{ id: '1511', name: 'X' }], kits: [{ ...released, skills: [] }] }, { now: NOW });
    expect(r.lines).toEqual([]);
  });

  it('reports new leaks, confirmations, new banners and events, and a moved version end', () => {
    const before: Lists = {
      ...empty,
      characters: [{ id: '1641', name: 'Phoenix', leak: { source: 'nanoka.cc' } }],
      versions: [{ id: '3.3', start: '2026-10-20T22:00:00.000Z', end: '2026-12-01T22:00:00.000Z' }],
    };
    const after: Lists = {
      ...empty,
      characters: [
        { id: '1641', name: 'Phoenix', releasedAt: '2026-10-21T04:00:00.000Z' },
        { id: '1651', name: 'Pyre', leak: { source: 'nanoka.cc' } },
      ],
      versions: [{ id: '3.3', start: '2026-10-20T22:00:00.000Z', end: '2026-12-02T22:00:00.000Z' }],
      banners: [{ id: 'b', title: 'Flame Run', start: '2026-10-21T04:00:00.000Z', end: '2026-11-11T03:59:00.000Z' }],
      events: [{ id: 'e', title: 'Hollow Fest', start: '2026-10-22T04:00:00.000Z', end: '2026-11-01T03:59:00.000Z' }],
    };
    const r = report('zzz', before, after, { build: '3.4.1', now: NOW });
    expect(r.lines).toEqual([
      'ZZZ: version 3.3 end 2026-12-01 → 2026-12-02',
      'ZZZ: Phoenix officially confirmed, out 2026-10-21',
      'ZZZ: new character Pyre (leak)',
      'ZZZ: new banner Flame Run (2026-10-21 → 2026-11-11)',
      'ZZZ: new event Hollow Fest (2026-10-22 → 2026-11-01)',
    ]);
    expect(r.findings.every((f) => f.kind === 'info')).toBe(true);
    expect(r.findings.find((f) => f.title.includes('Pyre'))?.source.name).toBe('nanoka.cc, build 3.4.1');
  });

  it('says nothing when nothing changed', () => {
    expect(report('hsr', empty, empty, { now: NOW })).toEqual({ lines: [], findings: [], kitChanged: [] });
  });
});
