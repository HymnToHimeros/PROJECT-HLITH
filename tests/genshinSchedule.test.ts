import { describe, expect, it } from 'vitest';
import { abyssPeriod, cleanName, eventFrom, eventKind, followedBy, officialWishTimes, primogems, theaterSeason, versionFromGenshinNotice, versionNumber, versionOfTitle, wishBanner, wishType } from '../scripts/genshin/schedule.ts';

const notes = () => ({ notes: [] as string[] });
const ids: Record<string, string> = { skirk: '10000114', dahlia: '10000120', candace: '10000072', mika: '10000080', azurelight: '11517', 'symphonist of scents': '13517' };
const idOf = (n: string) => ids[n.toLowerCase()];

describe('Genshin versions from the official notices', () => {
  it('Luna I–VIII are 6.0–6.7; titles name either form', () => {
    expect(versionNumber('Luna I')).toBe('6.0');
    expect(versionNumber('Luna VIII')).toBe('6.7');
    expect(versionNumber('7.1')).toBe('7.1');
    expect(versionOfTitle('"Song of the Welkin Moon: Scherzo" Version "Luna VIII" Update Details')).toBe('6.7');
    expect(versionOfTitle('"A Rekviem for the Underworld" Version 7.1 Update Details')).toBe('7.1');
  });
  it('a version ends where the very next one starts; a gap leaves no end', () => {
    expect(followedBy('7.0', '7.1')).toBe(true);
    expect(followedBy('5.8', '6.0')).toBe(true);
    expect(followedBy('6.7', '7.0')).toBe(true);
    expect(followedBy('3.2', '3.5')).toBe(false);
  });
  it('"Update maintenance begins … (UTC+8) and is estimated to take 5 hours"', () => {
    expect(versionFromGenshinNotice('7.1', 'Update maintenance begins 2026/09/23 06:00 (UTC+8) and is estimated to take 5 hours.')).toEqual({
      id: '7.1',
      start: '2026-09-22T22:00:00.000Z',
      open: '2026-09-23T03:00:00.000Z',
    });
    expect(versionFromGenshinNotice('7.0', 'The development team will begin update maintenance on 2026/08/12 06:00 (UTC+8).')?.start).toBe('2026-08-11T22:00:00.000Z');
  });
});

const WISH = (name: string, type: string, pool: string, extra = '') => ({
  title: `${name}/2026-10-13`,
  text: `{{Wish\n|name = ${name}\n|type = ${type}\n${extra}|time_start = 2026-10-13 18:00:00\n|time_end = 2026-11-03 14:59:59\n}}\n{{Wish Pool\n${pool}}}`,
});

describe('Genshin wishes', () => {
  it('character wish: rate-up 5★ then 4★ as ids, server-time period from the wiki', () => {
    const b = wishBanner(WISH("Void Star's Advent", 'Character Event', '|character_5_F = Skirk\n|character_4_F = Dahlia; Candace; Mika\n'), idOf, notes());
    expect(b).toEqual({ id: 'void-stars-advent-2026-10-13', type: 'character', title: "Void Star's Advent", featured: ['10000114', '10000120', '10000072', '10000080'], start: '2026-10-13T10:00:00.000Z', end: '2026-11-03T06:59:59.000Z', serverTime: { base: 8, start: true, end: true } });
  });
  it('Event Wish-2, and a weapon pool is a weapon wish even when the page repeats type', () => {
    expect(wishType({ type: 'Character Event', type2: 'Character Event-2' }, {}, '')).toBe('character-2');
    const w = wishBanner(WISH('Epitome Invocation', 'Character Event', '|weapon_5_F = Azurelight; Symphonist of Scents\n'), idOf, notes());
    expect(w).toMatchObject({ type: 'weapon', featured: ['11517', '13517'] });
  });
  it('the official notice period wins for the run on now, and only for it', () => {
    const official = { start: '2026-10-13T10:00:00.000Z', end: '2026-11-03T06:59:00.000Z', startServer: true, endServer: true };
    expect(wishBanner(WISH("Void Star's Advent", 'Character Event', '|character_5_F = Skirk\n'), idOf, notes(), official)?.end).toBe('2026-11-03T06:59:00.000Z');
    const older = { ...WISH('Epitome Invocation', 'Weapon Event', '|weapon_5_F = Azurelight\n'), text: WISH('Epitome Invocation', 'Weapon Event', '|weapon_5_F = Azurelight\n').text.replace('2026-10-13 18:00:00', '2026-09-23 11:00:00') };
    expect(wishBanner(older, idOf, notes(), official)?.start).toBe('2026-09-23T03:00:00.000Z');
  });
  it('reads Event Wish periods from in-game notices (t_lc = server time)', () => {
    const t = officialWishTimes([{ title: 'Event Wish "Void Star\'s Advent"', html: 'Event Wish Duration<t class="t_lc" contenteditable="false">2026/10/13 18:00</t> – <t class="t_lc" contenteditable="false">2026/11/03 14:59</t>' }], new Map());
    expect(t.get("void star's advent")).toEqual({ start: '2026-10-13T10:00:00.000Z', end: '2026-11-03T06:59:00.000Z', startServer: true, endServer: true });
  });
  it('a permanent wish has no end of its own; unknown names are noted, not guessed', () => {
    const n = notes();
    const std = wishBanner({ title: 'Wanderlust Invocation', text: '{{Wish\n|name = Wanderlust Invocation\n|type = Standard\n|duration = perm\n|time_start = 2020-09-28 10:00:00\n|time_start_offset = GMT+8\n|time_end = none\n}}' }, idOf, n);
    expect(std).toMatchObject({ type: 'standard', permanent: true, end: '' });
    wishBanner(WISH('X', 'Character Event', '|character_5_F = Nobody\n'), idOf, n);
    expect(n.notes).toContain('wish "X/2026-10-13": "Nobody" not in our lists, not shown as featured');
  });
});

describe('Genshin events and endgame', () => {
  it('kinds: login group, web type, Stygian Onslaught = endgame, Overflowing = bonus', () => {
    expect(eventKind({ type: 'In-Game', group: 'Login' }, "Rainbow's End")).toBe('login');
    expect(eventKind({ type: 'Web' }, 'Anniversary Memories Album')).toBe('web');
    expect(eventKind({ type: 'In-Game', group: 'Stygian Onslaught' }, 'Stygian Onslaught/2026-09-30')).toBe('endgame');
    expect(eventKind({ type: 'In-Game' }, 'Overflowing Favor/2026-10-26')).toBe('bonus');
    expect(cleanName('Overflowing Favor 2026-10-26')).toBe('Overflowing Favor');
  });
  it('Primogems: stated total, reward cards or {{Item|x=}}; named without an amount = unknown, never 0', () => {
    expect(primogems('==Total Rewards==\n{{Event Rewards\n|Primogem = 420\n}}')).toBe(420);
    expect(primogems('{{Item|Primogem|x=1,600}} and {{Item|Primogem|x=60}}')).toBe(1660);
    expect(primogems('Rewards include Primogems and Mora.')).toBeNull();
    expect(primogems('No currency here.')).toBe(0);
  });
  it('an event page with its offset; no end = left out', () => {
    const e = eventFrom({ title: 'Predictive Victory Dynamics', text: '{{Event\n|type = In-Game\n|time_start = 2026-10-11 22:00:00\n|time_start_offset = GMT-4\n|time_end = 2026-10-19 21:59:59\n|time_end_offset = GMT-4\n}}\n==Total Rewards==\n{{Event Rewards\n|Primogem = 420\n}}' }, notes());
    expect(e).toMatchObject({ title: 'Predictive Victory Dynamics', kind: 'event', start: '2026-10-12T02:00:00.000Z', end: '2026-10-20T01:59:59.000Z', reward: 420, currency: 'primogem' });
    const n = notes();
    expect(eventFrom({ title: 'Fate Foretold', text: '{{Event\n|time_start = 2026-10-01\n}}' }, n)).toBeUndefined();
    expect(n.notes).toEqual(['event "Fate Foretold" left out: no end yet']);
  });
  it('Imaginarium Theater seasons (times stated) and Spiral Abyss periods (dates; reset 04:00 server time)', () => {
    expect(theaterSeason({ title: 'Imaginarium Theater/Seasons/2026-10-01', text: '{{Imaginarium Theater Season\n|season = 28\n|start = 2026-10-01 04:00:00\n|end = 2026-11-01 03:59:59\n}}' }, notes())).toMatchObject({ id: 'imaginarium-theater-2026-09-30', start: '2026-09-30T20:00:00.000Z', end: '2026-10-31T19:59:59.000Z', reward: null, serverTime: { base: 8, start: true, end: true } });
    expect(abyssPeriod({ title: 'Spiral Abyss/Floors/2026-09-16', text: '{{Abyssal Moon Spire\n|start = 2026-09-16\n|end = 2026-10-15\n}}' }, 800, notes())).toMatchObject({ id: 'spiral-abyss-2026-09-16', start: '2026-09-15T20:00:00.000Z', end: '2026-10-15T19:59:59.000Z', reward: 800 });
  });
});
