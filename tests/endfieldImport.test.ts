import { describe, expect, it } from 'vitest';
import { bannerType, banners, eventKind, events, operators, rarityOf, serverTime, utc, versions, weapons, type Row } from '../scripts/endfield/map.ts';

// Rows as endfield.wiki.gg's Cargo tables return them (times in UTC).
const OPS: Row[] = [
  { Operator: 'Si', Id: 'chr_0036_jsspsi', Icon: 'Si icon.png', Splash: 'Si Splash Art.png', Rarity: '6', Class: 'Caster', Element: 'Nature', Headhunting: 'chartered' },
  { Operator: 'Endministrator', Id: 'chr_0002_endminm', Icon: 'Endministrator_(Male)_ icon.png', Rarity: '6', Class: 'Guard', Element: 'Physical', Headhunting: '' },
  { Operator: 'Endministrator', Id: 'chr_0003_endminf', Icon: 'Endministrator_(Female)_ icon.png', Rarity: '6', Class: 'Guard', Element: 'Physical', Headhunting: '' },
  { Operator: 'Purrchena', Id: 'chr_0038_purrche', Rarity: '5', Class: 'Defender', Element: 'Physical', Headhunting: 'welfare' },
  { Operator: 'Akekuri', Id: 'chr_0011_akekur', Rarity: '4', Class: 'Vanguard', Element: 'Heat', Headhunting: 'standard' },
];
const BANNERS: Row[] = [
  { Banner: 'Basic Headhunting', LimitedOperators: 'Ardelia', AsiaStartTime: '2026-01-22 03:00:00', AsiaEndTime: '', AmeuStartTime: '2026-01-22 16:00:00', AmeuEndTime: '' },
  { Banner: 'Rejuvenation', RateUpOperator: 'Si', LimitedOperators: 'Si;Typhoeus;Liino', QuotaOperator: 'Xaihi', AsiaStartTime: '2026-10-15 04:00:00', AsiaEndTime: '2026-11-05 03:59:59', AmeuStartTime: '2026-10-15 04:00:00', AmeuEndTime: '2026-11-05 16:59:59' },
  { Banner: 'Ancestral Spring Flows Anew', RateUpOperator: '', LimitedOperators: 'Tangtang', AsiaStartTime: '2026-10-29 04:00:00', AsiaEndTime: '2026-11-19 03:59:59', AmeuStartTime: '2026-10-29 17:00:00', AmeuEndTime: '2026-11-19 16:59:59' },
  { Banner: 'Fest of Brilliance', RateUpOperator: '', LimitedOperators: 'Laevatain;Gilberta;Si', AsiaStartTime: '2026-05-14 04:00:00', AsiaEndTime: '2026-06-04 03:59:59', AmeuStartTime: '2026-05-14 17:00:00', AmeuEndTime: '2026-06-04 21:59:59' },
];
const images = new Map([['Si icon.png', 'https://endfield.wiki.gg/images/Si_icon.png'], ['Si Splash Art.png', 'https://endfield.wiki.gg/images/Si_Splash_Art.png']]);
const LAUNCH = '2026-01-22T03:00:00.000Z';

describe('Endfield lists from the wiki', () => {
  it('reads Cargo times as UTC and marks server-time ends', () => {
    expect(utc('2026-10-15 04:00:00')).toBe('2026-10-15T04:00:00.000Z');
    expect(utc('')).toBeUndefined();
    expect(serverTime(BANNERS[1] as Row)).toEqual({ base: 8, end: true });
    expect(serverTime({ AsiaStartTime: 'a', AmeuStartTime: 'a', AsiaEndTime: 'b', AmeuEndTime: 'b' })).toBeUndefined();
  });

  it('operators: rarity, element, class, art; release date from their first banner, launch for the Endministrator, none otherwise', () => {
    const notes = { notes: [] as string[] };
    const ops = operators(OPS, BANNERS, images, false, notes, LAUNCH);
    expect(ops.map((o) => [o.name, o.rarity, o.element, o.role, o.releasedAt ?? null])).toEqual([
      ['Endministrator (Male)', 'top', 'physical', 'guard', LAUNCH],
      ['Endministrator (Female)', 'top', 'physical', 'guard', LAUNCH],
      ['Si', 'top', 'nature', 'caster', '2026-05-14T04:00:00.000Z'],
      ['Purrchena', 'mid', 'physical', 'defender', null],
    ]);
    expect(ops.find((o) => o.name === 'Si')).toMatchObject({ art: 'https://endfield.wiki.gg/images/Si_Splash_Art.png', portrait: 'https://endfield.wiki.gg/images/Si_icon.png', source: 'endfield.wiki.gg (CC BY-SA)' });
    expect(notes.notes).toContain('operator "Akekuri" left out: 4★ has no rarity tier in the contract yet');
    expect(operators(OPS, BANNERS, images, true, { notes: [] }, LAUNCH).find((o) => o.name === 'Akekuri')?.rarity).toBe('low');
    expect(rarityOf('3', true)).toBeUndefined();
  });

  it('banner types follow the game: rate-up = Chartered, Basic, one returning operator = rerun, several = joint', () => {
    expect(BANNERS.map(bannerType)).toEqual(['basic', 'chartered', 'rerun', 'joint']);
    expect(bannerType({ Banner: 'New Horizons Headhunting' })).toBe('beginner');
  });

  it('banners: featured ids, permanent ones end with the current version, weapon Issues with their weapon', () => {
    const notes = { notes: [] as string[] };
    const ops = operators(OPS, BANNERS, images, false, { notes: [] }, LAUNCH);
    const wpns = weapons([{ Weapon: 'Jade Vessel', Id: 'wpn_claym_0018', Icon: 'Jade Vessel icon.png', Type: 'Great Sword', Rarity: '6' }, { Weapon: 'Tarr 11', Id: 'wpn_x', Rarity: '3', Type: 'Sword' }], new Map([['Jade Vessel icon.png', 'https://x/j.png']]), notes);
    expect(wpns).toEqual([{ id: 'wpn_claym_0018', name: 'Jade Vessel', rarity: 'top', icon: 'https://x/j.png', type: 'great-sword', source: 'endfield.wiki.gg (CC BY-SA)' }]);
    const issues: Row[] = [{ Issue: 'Seal of Jade', RateUpWeapon: 'Jade Vessel', IsPermanent: '0', AsiaStartTime: '2026-10-15 04:00:00', AsiaEndTime: '2026-12-17 03:59:59', AmeuStartTime: '2026-10-15 04:00:00', AmeuEndTime: '2026-12-17 16:59:59' }];
    const list = banners(BANNERS, issues, ops, wpns, '2026-11-24T22:00:00.000Z', notes);
    const by = (t: string) => list.find((b) => b.title === t);
    expect(by('Basic Headhunting')).toBeUndefined(); // its pool (Ardelia) is not in this test's operator list
    expect(notes.notes).toContain('banner "Basic Headhunting" left out until its operator is on the wiki');
    // Typhoeus and Liino are not in this test's operator list, so no alsoAvailable here (never guessed).
    expect(by('Rejuvenation')).toEqual({ id: 'rejuvenation-2026-10-15', type: 'chartered', title: 'Rejuvenation', featured: ['chr_0036_jsspsi'], start: '2026-10-15T04:00:00.000Z', end: '2026-11-05T03:59:59.000Z', serverTime: { base: 8, end: true } });
    const withPool = banners([{ ...(BANNERS[1] as Row), LimitedOperators: 'Si;Endministrator' }], [], [...ops, { id: 'chr_x', name: 'Endministrator', rarity: 'top', element: 'physical', role: 'guard', source: 'w' }], wpns, undefined, { notes: [] });
    expect(withPool[0]).toMatchObject({ featured: ['chr_0036_jsspsi'], alsoAvailable: ['chr_x'] });
    expect(by('Seal of Jade Issue')).toMatchObject({ type: 'weapon', featured: ['wpn_claym_0018'], art: 'https://x/j.png' });
    expect(by('Ancestral Spring Flows Anew')).toBeUndefined();
    expect(by('Fest of Brilliance')).toMatchObject({ type: 'joint', featured: ['chr_0036_jsspsi'] });
    const basic = banners([{ ...(BANNERS[0] as Row), LimitedOperators: 'Si' }], [], ops, wpns, '2026-11-24T22:00:00.000Z', { notes: [] });
    expect(basic[0]).toMatchObject({ type: 'basic', permanent: true, end: '2026-11-24T22:00:00.000Z', featured: ['chr_0036_jsspsi'] });
    expect(notes.notes).toContain('banner "Ancestral Spring Flows Anew": Tangtang not in the operator list yet (no wiki entry), so not shown as featured');
    expect(notes.notes).toContain('weapon "Tarr 11" left out: 3★ has no rarity tier');
  });

  it('events: Contingency Contract is the endgame, sign-ins are login events, rewards stay unknown, no end = left out', () => {
    const notes = { notes: [] as string[] };
    const rows: Row[] = [
      { Page: 'Contingency Contract: Re-Ignition Experimental Operation', Event: 'Contingency Contract: Re-Ignition Experimental Operation', Type: 'Challenge', AsiaStartTime: '2026-06-19 04:00:00', AsiaEndTime: '2026-07-15 22:00:00', AmeuStartTime: '2026-06-19 04:00:00', AmeuEndTime: '2026-07-15 22:00:00' },
      { Page: 'The Stars Are With Me', Event: 'The Stars Are With Me', Type: 'Sign-In', AsiaStartTime: '2026-11-05 04:00:00', AsiaEndTime: '2026-11-25 03:59:00', AmeuStartTime: '2026-11-06 04:00:00', AmeuEndTime: '2026-11-25 16:59:00' },
      { Page: 'Protocol Reconnection', Event: 'Protocol Reconnection', Type: 'Return', AsiaStartTime: '2026-10-15 04:00:00', AsiaEndTime: '' },
    ];
    const list = events(rows, notes);
    expect(list.map((e) => [e.title, e.kind, e.reward])).toEqual([
      ['Contingency Contract: Re-Ignition Experimental Operation', 'endgame', null],
      ['The Stars Are With Me', 'login', null],
    ]);
    expect(list[1]?.serverTime).toEqual({ base: 8, start: true, end: true });
    expect(notes.notes).toEqual(['event "Protocol Reconnection" left out: no end yet']);
    expect(eventKind({ Type: 'Guide' })).toBe('web');
    const bad = events([{ Event: 'Northward to Peril', Type: 'Narrative', AsiaStartTime: '2026-07-10 04:00:00', AsiaEndTime: '2026-07-10 04:00:00' }], notes);
    expect(bad).toEqual([]);
  });

  it('versions: from the wiki, checked against the official update notes; the last one needs a stated end', () => {
    const notes = { notes: [] as string[] };
    const rows: Row[] = [
      { Version: 'Zeroth Directive', VersionNumber: '1.0', StartTime: '2026-01-22 03:00:00', EndTime: '' },
      { Version: 'Homecoming', VersionNumber: '1.4', StartTime: '2026-07-16 04:00:00', EndTime: '2026-09-01 22:00:00' },
      { Version: 'Sanctuary of Ink', VersionNumber: '1.6', StartTime: '2026-10-15 04:00:00', EndTime: '' },
    ];
    const list = versions(rows, [{ title: '[Homecoming] Version Update Notes', displayTime: 0 }], notes);
    expect(list.map((v) => [v.id, v.end])).toEqual([
      ['1.0', '2026-07-16T04:00:00.000Z'],
      ['1.4', '2026-09-01T22:00:00.000Z'],
    ]);
    expect(notes.notes).toEqual(['version 1.6 "Sanctuary of Ink" left out: no end yet']);
  });
});

describe('Endfield: the official notices win', () => {
  const NOTES = [
    '5. [The Hearth Fire Beckons the Starry Flow] Chartered Headhunting',
    '· Availability: Nov. 5, 2026 at 12:00 (server time) – Before version update and maintenance',
    '6. [Moongleam Issue] Arsenal Issue Open',
    '· Availability: Opens Nov. 5, 2026 at 12:00 (server time); ends after 3 [Chartered Headhunting] banners (starting from [The Hearth Fire Beckons the Starry Flow])',
    '· Issue Details: [Moongleam Issue] Arsenal Issue features the Rate-UP 6★ weapon [Lunar Calling (Sword)].',
    '6★ weapons [Jade Vessel (Greatsword)], [Lunar Calling (Sword)]',
  ].join('\n');

  it('reads server-time dates as the Asia instant', async () => {
    const { serverDate } = await import('../scripts/endfield/map.ts');
    expect(serverDate('Sept. 24, 2026 at 12:00')).toBe('2026-09-24T04:00:00.000Z');
    expect(serverDate('Nov. 5, 2026 at 11:59')).toBe('2026-11-05T03:59:00.000Z');
  });

  it('banner periods: server-time starts, "before version update" ends, no end for "after 3 banners"', async () => {
    const { officialTimes } = await import('../scripts/endfield/map.ts');
    const t = officialTimes([
      { title: '[Sanctuary of Ink] Version Update Notes', text: NOTES },
      { title: '[Resplendent Spectrum] RE-Factor Headhunting #1 and [Tag Artist Issue] RE-Factor Issue #1 Open', text: '▼// Availability\nSept. 24, 2026 at 12:00 (server time) – Before version update and maintenance' },
    ]);
    expect(t.get('the hearth fire beckons the starry flow')).toEqual({ start: { at: '2026-11-05T04:00:00.000Z', server: true }, end: { version: true } });
    expect(t.get('moongleam issue')).toEqual({ start: { at: '2026-11-05T04:00:00.000Z', server: true } });
  });

  it('the official period replaces the wiki copy (Argent Flow starts 12:00 on each server, ends with the version)', async () => {
    const { officialTimes } = await import('../scripts/endfield/map.ts');
    const notes = { notes: [] as string[] };
    const ops = operators([{ Operator: 'Argent Flow', Id: '', Rarity: '6', Class: 'Guard', Element: 'Electric', Headhunting: 'chartered' }], [], new Map(), true, { notes: [] });
    expect(ops[0]?.id).toBe('chr_argent-flow');
    const wiki: Row = { Banner: 'The Hearth Fire Beckons the Starry Flow', RateUpOperator: 'Argent Flow', LimitedOperators: 'Argent Flow', AsiaStartTime: '2026-11-05 04:00:00', AsiaEndTime: '2026-11-26 03:59:59', AmeuStartTime: '2026-11-05 04:00:00', AmeuEndTime: '2026-11-26 16:59:59' };
    const list = banners([wiki], [], ops, [], '2026-11-24T22:00:00.000Z', notes, officialTimes([{ title: 'notes', text: NOTES }]));
    expect(list[0]).toMatchObject({ start: '2026-11-05T04:00:00.000Z', end: '2026-11-24T22:00:00.000Z', serverTime: { base: 8, start: true }, featured: ['chr_argent-flow'] });
  });

  it('6★ weapons named in the notes, and ids that never change once given', async () => {
    const { officialWeapons, keepIds } = await import('../scripts/endfield/map.ts');
    expect(officialWeapons([NOTES])).toEqual([
      { name: 'Lunar Calling', type: 'sword' },
      { name: 'Jade Vessel', type: 'great-sword' },
    ]);
    // The wiki later gives Argent Flow a game id: she keeps the one she was first listed with.
    expect(keepIds([{ id: 'chr_0040_argent', name: 'Argent Flow' }], [{ id: 'chr_argent-flow', name: 'Argent Flow' }])).toEqual([{ id: 'chr_argent-flow', name: 'Argent Flow' }]);
  });
});
