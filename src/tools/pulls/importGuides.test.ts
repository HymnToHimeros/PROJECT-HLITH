import { describe, expect, it } from 'vitest';
import { findHistoryLink, guideFor } from './importGuides';

const link = (key: string) => `https://public-operation-hkrpg-sg.hoyoverse.com/common/gacha_record/api/getGachaLog?authkey_ver=1&sign_type=2&authkey=${key}&game_biz=hkrpg_global&lang=en`;

describe('reading the history link out of the game’s cache file', () => {
  it('takes the newest (last) link with an authkey, cut at the first binary byte', () => {
    const text = `\u0000junk 1/0/${link('old')}\u0000\u0001more bytes 1/0/${link('new')}\u0000�trailing`;
    expect(findHistoryLink(text)).toBe(link('new'));
  });

  it('ignores links without an authkey and other addresses', () => {
    const text = `https://example.com/page 1/0/https://public-operation-nap-sg.hoyoverse.com/common/gacha_record/api/getGachaLog?lang=en\u0000`;
    expect(findHistoryLink(text)).toBeNull();
  });

  it('returns null when there is no link at all', () => {
    expect(findHistoryLink('nothing here')).toBeNull();
  });
});

describe('guides', () => {
  it('exist for the UIGF sections of the two current games and name their data folders', () => {
    expect(guideFor('hkrpg')?.dataFolder).toBe('StarRail_Data');
    expect(guideFor('nap')?.dataFolder).toBe('ZenlessZoneZero_Data');
    expect(guideFor('xyz')).toBeNull();
    expect(guideFor(undefined)).toBeNull();
  });
});
