import { describe, expect, it } from 'vitest';
import { duplicateIds } from '../src/core/data/catalog';
import { games } from '../src/games';
import { amountOf, at, nameKey, noticeText, slug, spanIn, versionFromNotice, type VersionTimes } from '../scripts/schedule/text.ts';
import { infobox, mainBox, poolBox, poolFeatured, rewardTotal, sectionLinks, wikiTime } from '../scripts/schedule/wiki.ts';

const v46: VersionTimes = { id: '4.6', start: '2026-09-27T22:00:00.000Z', open: '2026-09-28T03:00:00.000Z', end: '2026-11-10T22:00:00.000Z' };
const versions = new Map([['4.6', v46]]);

describe('reading official notices', () => {
  it('turns UTC+8 and server times into absolute times (server time at the Asia server)', () => {
    expect(at('2026/11/11 03:59', 8)).toBe('2026-11-10T19:59:00.000Z');
    expect(spanIn('2026/10/05 04:00 – 2026/11/16 03:59 (server time)', versions)).toEqual({
      start: '2026-10-04T20:00:00.000Z',
      end: '2026-11-15T19:59:00.000Z',
    });
  });

  it('reads "after the update" and "end of version" from the version', () => {
    expect(spanIn('Event Period: After the Version 4.6 update – End of Version 4.6', versions)).toEqual({ start: v46.open, end: v46.end });
  });

  it('keeps time tags, also when the notice escapes them', () => {
    const plain = noticeText('<p>After the Version 4.6 update – <t class="t_lc">2026/11/10 15:00:00</t></p>');
    const escaped = noticeText('<p>After the Version 4.6 update – &lt;t class=&quot;t_lc&quot;&gt;2026/11/10 15:00:00&lt;/t&gt;</p>');
    expect(plain).toBe(escaped);
    expect(spanIn(plain, versions)?.end).toBe('2026-11-10T07:00:00.000Z');
  });

  it('a line with only one time is not a period', () => {
    expect(spanIn('Availability: After the Version 4.6 update', versions)).toBeUndefined();
  });

  it('reads a version notice: update start, maintenance length, stated end', () => {
    const text = 'Version 4.6 will run from after the Version 4.6 update until 2026/11/11 06:00 (UTC+8).\n■ Update Time\nBegins at 2026/09/28 06:00 (UTC+8). The update will take approximately 5 hours.';
    expect(versionFromNotice('4.6', text)).toEqual(v46);
    const zzz = '[Update Start Time]\n2026/09/09 06:00 (UTC+8)\nIt will take about five hours to complete.\nPlease note that Version 3.2 will run for 42 days, ending on 2026/10/21 06:00 (UTC+8).';
    expect(versionFromNotice('3.2', zzz)?.end).toBe('2026-10-20T22:00:00.000Z');
  });

  it('adds up premium currency named in the text', () => {
    expect(amountOf('unlock Trendible Voucher ×18, Stellar Jade ×500, and a medal', 'Stellar Jade')).toBe(500);
  });

  it('makes stable ids and matches names loosely', () => {
    expect(slug('Love, Ghosts & Robots')).toBe('love-ghosts-and-robots');
    expect(slug('"En-Nah" Into Your Lap')).toBe('en-nah-into-your-lap');
    expect(nameKey('Himeko • Nova')).toBe(nameKey('himeko nova'));
  });
});

describe('reading the wikis', () => {
  const warp = `{{Warp
|name              = An Ocean in a Pearl 2026-09-28
|type              = Character Event
|time_start        = 2026-09-28 11:00:00
|time_start_offset = GMT+8
|time_end          = 2026-11-10 15:00:00
<!--|time_end_offset   = GMT+8-->
}}
==Item Pool==
{{Warp Pool
|character_5_F = Pearl
|character_4_F = Qingque; Xueyi; Misha
|character_5   = Bailu; Blade
}}`;

  it('reads the infobox and its times (no offset = server time)', () => {
    const box = infobox(warp);
    expect(box.type).toBe('Character Event');
    expect(wikiTime(box, 'start')).toBe('2026-09-28T03:00:00.000Z');
    expect(wikiTime(box, 'end')).toBe('2026-11-10T07:00:00.000Z');
  });

  it('skips tab bars to find the main infobox', () => {
    const page = '{{Event Tabs\n|subpage1 = Mechatron Exhibition\n}}\n{{Event\n|time_known = yes\n|time_start = 2026-09-28 11:00:00\n}}';
    expect(mainBox(page).time_start).toBe('2026-09-28 11:00:00');
  });

  it('reads featured items from the pool', () => {
    expect(poolFeatured(poolBox(warp))).toEqual({ top: ['Pearl'], mid: ['Qingque', 'Xueyi', 'Misha'] });
  });

  it('collects links from a section of a version page', () => {
    const page = '===Warps===\n* Character Event Warps:\n** [[An Ocean in a Pearl/2026-09-28|An Ocean in a Pearl]] ([[Pearl]]) - Phase 1\n===Events===\n* [[Love, Ghosts & Robots]]';
    expect(sectionLinks(page, /^Warps$/)).toEqual(['An Ocean in a Pearl/2026-09-28']);
    expect(sectionLinks(page, /^Events$/)).toEqual(['Love, Ghosts & Robots']);
  });

  it('totals rewards; a stated total wins; named without a number is unknown', () => {
    expect(rewardTotal('{{Card List|delim=;|Stellar Jade*100;Credit*80,000}}\n| 3 || {{Card|Stellar Jade|60}}', 'Stellar Jade')).toBe(160);
    expect(rewardTotal('{{Event Rewards\n|Polychrome = 300\n}}', 'Polychrome')).toBe(300);
    expect(rewardTotal('{{Card List|Polychrome; Boopon; Denny}}', 'Polychrome')).toBeNull();
    expect(rewardTotal('{{Card List|Boopon*2}}', 'Polychrome')).toBe(0);
  });
});

describe('the imported lists', () => {
  it.each(games.map((g) => [g.id, g] as const))('%s: banners, events and versions fit the game record', async (_id, g) => {
    const [banners, events, versions, characters] = await Promise.all([g.data.banners(), g.data.events(), g.data.versions(), g.data.characters()]);
    const types = new Set(g.bannerTypes.map((b) => b.id));
    const currencies = new Set(g.currencies.map((c) => c.id));
    const chars = new Set(characters.map((c) => c.id));
    for (const list of [banners, events, versions]) {
      expect(duplicateIds(list)).toEqual([]);
      for (const x of list) expect(Date.parse(x.start) < Date.parse(x.end), x.id).toBe(true);
    }
    for (const b of banners) {
      expect(types.has(b.type), `${b.id}: type ${b.type}`).toBe(true);
      // Character banners lead with a character from the list.
      if (g.bannerTypes.find((t) => t.id === b.type)?.target === 'character') expect(chars.has(b.featured[0] ?? ''), b.id).toBe(true);
    }
    for (const e of events) expect(currencies.has(e.currency), `${e.id}: ${e.currency}`).toBe(true);
  });
});
