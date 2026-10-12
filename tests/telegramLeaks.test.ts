import { describe, expect, it } from 'vitest';
import { alreadyKnown, channelSet, gamesOf, isChinese, olderPage, parseChannelPage, plainText, SEELE, wanted } from '../scripts/leaks/telegram.ts';

// Trimmed from the real t.me/s/<channel> markup (class names and nesting as served).
const post = (n: number, at: string, text: string, photos: string[] = []) => `
<div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message text_not_supported_wrap js-widget_message" data-post="leakchan/${n}" data-view="x">
  <div class="tgme_widget_message_bubble">
    ${photos.map((p) => `<a class="tgme_widget_message_photo_wrap grouped_media_wrap blured js-message_photo" style="width:400px;background-image:url('${p}')" href="https://t.me/leakchan/${n}?single"></a>`).join('')}
    <div class="media_supported_cont"><div class="tgme_widget_message_text js-message_text" dir="auto">${text}</div></div>
    <div class="tgme_widget_message_footer compact js-message_footer"><a class="tgme_widget_message_date" href="https://t.me/leakchan/${n}"><time datetime="${at}" class="time">14:52</time></a></div>
  </div>
</div></div>`;

const PAGE = `<html><body>${[
  post(101, '2026-10-10T08:00:00+00:00', '<b>#HSR</b> 4.7 beta: Aeon ★ Aha kit changes<br/>Skill multiplier 120% → 140%', ['https://cdn4.telesco.pe/file/abc']),
  post(102, '2026-10-11T09:30:00+00:00', '<i class="emoji" style="background-image:url(\'//telegram.org/img/emoji/40/E29CA8.png\')"><b>✨</b></i> 绝区零 3.4 新角色：「某某」 冰属性 强攻<br/>来源：内测', ['//cdn5.telesco.pe/file/def', 'https://cdn5.telesco.pe/file/ghi']),
  post(103, '2026-10-11T10:00:00+00:00', '#Genshin 7.2 banners &amp; weapons'),
  post(104, '2026-10-11T11:00:00+00:00', 'Severian &quot;Night Watch&quot; skill preview #ZZZ'),
].join('')}</body></html>`;

describe('Seele Telegram leaks (public web view)', () => {
  const posts = parseChannelPage(PAGE, 'leakchan');

  it('reads every post: id, link, time, text, images by link', () => {
    expect(posts.map((p) => p.id)).toEqual([101, 102, 103, 104]);
    expect(posts[0]).toMatchObject({ url: 'https://t.me/leakchan/101', at: '2026-10-10T08:00:00.000Z', images: ['https://cdn4.telesco.pe/file/abc'] });
    expect(posts[0]?.text).toBe('#HSR 4.7 beta: Aeon ★ Aha kit changes\nSkill multiplier 120% → 140%');
    expect(posts[1]?.images).toEqual(['https://cdn5.telesco.pe/file/def', 'https://cdn5.telesco.pe/file/ghi']);
    expect(posts[2]?.text).toBe('#Genshin 7.2 banners & weapons');
    expect(plainText('a&#39;b&#x4E2D;')).toBe("a'b中");
  });

  it('tags the game in English and Chinese; other games are tagged, not kept', () => {
    expect(posts.map((p) => p.games)).toEqual([['hsr'], ['zzz'], ['gi'], ['zzz']]);
    expect(gamesOf('崩坏：星穹铁道 4.7')).toEqual(['hsr']);
    expect(gamesOf('崩坏3 8.5')).toEqual(['hi3']);
    expect(gamesOf('Wuthering Waves 3.8')).toEqual(['other']);
    expect(wanted(posts, Date.parse('2026-10-10T12:00:00Z')).map((p) => p.id)).toEqual([102, 104]);
    expect(wanted(posts, 0, ['hsr', 'zzz', 'gi']).map((p) => p.id)).toEqual([101, 102, 103, 104]);
  });

  it('marks mostly-Chinese posts for translation, not Japanese or English ones', () => {
    expect(posts.map((p) => p.chinese)).toEqual([false, true, false, false]);
    expect(isChinese('ゼンレスゾーンゼロ 新キャラ')).toBe(false);
  });

  it('flags posts about leaks we already show from nanoka.cc (same character)', () => {
    const known = [
      { game: 'hsr', words: ['Aeon ★ Aha', 'Aeon Aha', '1511'], what: 'Aeon ★ Aha (leak, in our lists)' },
      { game: 'zzz', words: ['Severian', '1631'], what: 'Severian (not out yet, in our lists)' },
    ];
    expect(posts.map((p) => alreadyKnown(p, known))).toEqual([['Aeon ★ Aha (leak, in our lists)'], [], [], ['Severian (not out yet, in our lists)']]);
    // Whole words only: "Severianna" is someone else.
    expect(alreadyKnown({ ...(posts[3] as (typeof posts)[number]), text: 'Severianna kit #ZZZ' }, known)).toEqual([]);
  });

  it('pages back with ?before=, and waits for the channel name', () => {
    expect(olderPage(posts)).toBe(101);
    expect(olderPage([])).toBeUndefined();
    expect(channelSet('SEELE_CHANNEL_NOT_SET')).toBe(false);
    expect(channelSet('seeleleaks')).toBe(true);
    expect(SEELE.keep).toEqual(['hsr', 'zzz']);
    expect(SEELE.credit).toBe('Source: Seele (Telegram)');
  });
});
