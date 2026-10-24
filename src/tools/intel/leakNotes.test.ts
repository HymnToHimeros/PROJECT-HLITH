import { describe, expect, it } from 'vitest';
import type { CatalogRow } from '../../core/data/catalog';
import { eventFromInfo } from '../owner/approve';
import { noteFromFinding, notesFor, readNote } from './leakNotes';

const f = (over: Partial<Parameters<typeof noteFromFinding>[0]> = {}) => ({
  id: 'F1',
  game_id: 'hsr',
  kind: 'info',
  title: 'Leak (Seele): Something new',
  payload: { leak: true, post: { url: 'https://t.me/Seele_Leaks/1', at: '2026-10-13T01:00:00Z', text: 'orig', translation: 'eng', images: ['https://x/1.jpg', 'http://bad/2.jpg', 'javascript:alert(1)'] } } as Record<string, unknown>,
  source_name: 'Seele (Telegram)',
  source_url: null,
  found_at: '2026-10-13T02:00:00Z',
  ...over,
});
const row = (id: string, gameId: string, data: Record<string, unknown>, status: 'active' | 'retired' = 'active'): CatalogRow => ({ game_id: gameId, kind: 'leak', id, data, status, source: `finding:${id}`, updated_at: '' });

describe('leak notes', () => {
  it('a leak post becomes a note: cleaned title, credit, link, translation first; only https images', () => {
    expect(noteFromFinding(f())).toEqual({
      gameId: 'hsr',
      id: 'note-f1',
      data: { kind: 'info', topic: 'other', leak: true, title: 'Something new', at: '2026-10-13T01:00:00Z', credit: 'Seele (Telegram)', url: 'https://t.me/Seele_Leaks/1', text: 'orig', translation: 'eng', images: ['https://x/1.jpg'] },
    });
  });
  it('every finding with a game becomes a note, whatever its kind; without a post it gets a short line', () => {
    expect(noteFromFinding(f({ game_id: null }))).toBeNull();
    const event = noteFromFinding(f({ kind: 'event', title: 'Big Fest', payload: { start: '2026-10-13T20:00:00Z', end: '2026-10-18T19:59:00Z' }, source_url: 'https://hoyolab.example/1' }));
    expect(event?.data).toMatchObject({ kind: 'event', leak: false, title: 'Big Fest', text: '2026-10-13 → 2026-10-18', url: 'https://hoyolab.example/1', at: '2026-10-13T02:00:00Z', images: [] });
    expect(noteFromFinding(f({ kind: 'leak', title: 'New star', payload: { rarity: '5', element: 'Fire', featured: ['A', 'B'] } }))?.data).toMatchObject({ leak: true, text: 'Featured: A, B · 5 · Fire' });
    expect(noteFromFinding(f({ payload: { summary: 'Own words' } }))?.data.text).toBe('Own words');
  });
  it('reads rows back, drops malformed or retired ones, newest first, only the shown games', () => {
    const ok = { title: 'A', at: '2026-10-12T00:00:00Z', text: 't', credit: 'C', images: [] };
    const rows = [row('a', 'hsr', ok), row('b', 'hsr', { ...ok, title: 'B', at: '2026-10-13T00:00:00Z' }), row('c', 'zzz', ok), row('d', 'hsr', { title: 'no date' }), row('e', 'hsr', ok, 'retired')];
    expect(notesFor(rows, ['hsr']).map((n) => n.title)).toEqual(['B', 'A']);
    expect(readNote(row('x', 'hsr', { ...ok, url: 'javascript:alert(1)' }))?.url).toBeUndefined();
  });
  it('the same item approved twice shows once (same game and title, any spacing or case)', () => {
    const ok = { title: 'Lap Event', at: '2026-10-12T00:00:00Z', text: '', credit: 'C', images: [] };
    const rows = [row('a', 'zzz', ok), row('b', 'zzz', { ...ok, title: ' lap  event ', at: '2026-10-12T01:00:00Z' }), row('c', 'hsr', ok)];
    expect(notesFor(rows, ['zzz', 'hsr']).map((n) => `${n.gameId}:${n.id}`)).toEqual(['zzz:b', 'hsr:c']);
  });
  it('an event finding becomes a note named after the event, with its dates', () => {
    expect(noteFromFinding(f({ title: 'ZZZ: new event Data Bounty: Combat Simulation (2026-10-13 → 2026-10-18)', payload: {} }))?.data).toMatchObject({ title: 'Data Bounty: Combat Simulation', text: '2026-10-13 → 2026-10-18', leak: false });
  });
});

describe('topic re-tagging (fix 2: topic-only update in findings_decide)', () => {
  it('an explicit topic on the finding overrides the kind default', () => {
    const note = noteFromFinding(f({ kind: 'info', topic: 'characters', payload: { summary: 'Character leak' } }));
    expect(note?.data.topic).toBe('characters');
  });
  it('without an explicit topic, the kind fallback applies', () => {
    const note = noteFromFinding(f({ kind: 'info', topic: null, payload: { summary: 'x' } }));
    expect(note?.data.topic).toBe('other');
    expect(noteFromFinding(f({ kind: 'character', payload: { name: 'X' } }))?.data.topic).toBe('characters');
    expect(noteFromFinding(f({ kind: 'event', payload: { start: '2026-10-12' } }))?.data.topic).toBe('events-modes');
  });
  it('re-tagging from other → weapons-items changes only the topic', () => {
    const before = noteFromFinding(f({ topic: 'other', payload: { summary: 'Weapon stats' } }));
    const after = noteFromFinding(f({ topic: 'weapons-items', payload: { summary: 'Weapon stats' } }));
    expect(before?.data.topic).toBe('other');
    expect(after?.data.topic).toBe('weapons-items');
    expect(before?.data.title).toBe(after?.data.title);
    expect(before?.data.text).toBe(after?.data.text);
  });
});

describe('notes from decision-approved findings (fix 3: findings_decide calls findings_create_notes)', () => {
  it('a finding approved via decision (not at delivery) still produces a valid note', () => {
    const note = noteFromFinding(f({ kind: 'leak', title: 'Leak (Seele): Firefly rerun', topic: 'characters', payload: { leak: true, post: { url: 'https://t.me/Seele_Leaks/42', at: '2026-10-14T01:00:00Z', text: 'banner rerun confirmed', images: [] } } }));
    expect(note).not.toBeNull();
    expect(note?.data).toMatchObject({ kind: 'leak', topic: 'characters', leak: true, title: 'Firefly rerun', credit: 'Seele (Telegram)', text: 'banner rerun confirmed' });
  });
  it('an info finding without a post gets a note with its summary line', () => {
    const note = noteFromFinding(f({ kind: 'info', topic: 'systems', payload: { summary: 'New stamina system details' } }));
    expect(note?.data).toMatchObject({ kind: 'info', topic: 'systems', text: 'New stamina system details', leak: false });
  });
  it('an event parsed from the title gets the event name, not the raw title', () => {
    const note = noteFromFinding(f({ kind: 'info', title: 'ZZZ: new event Withering Garden (2026-11-01 → 2026-11-15)', payload: {} }));
    expect(note?.data).toMatchObject({ title: 'Withering Garden', text: '2026-11-01 → 2026-11-15', leak: false });
  });
});

describe('event info findings', () => {
  const info = (title: string, payload: Record<string, unknown> = {}) => ({ id: 'e', game_id: 'zzz', kind: 'info', title, payload, source_name: null });
  it('reads the name and dates from the delivered title', () => {
    expect(eventFromInfo(info('ZZZ: new event Data Bounty: Combat Simulation (2026-10-13 → 2026-10-18)'))).toEqual({
      title: 'Data Bounty: Combat Simulation',
      start: '2026-10-13T00:00:00.000Z',
      end: '2026-10-18T00:00:00.000Z',
    });
  });
  it('or from the payload; anything else is not an event', () => {
    expect(eventFromInfo(info('x', { title: 'Fest', start: '2026-10-20T00:00:00Z' }))).toEqual({ title: 'Fest', start: '2026-10-20T00:00:00.000Z' });
    expect(eventFromInfo(info('Something worth knowing'))).toBeNull();
    expect(eventFromInfo({ ...info('ZZZ: new event X (2026-10-13 → 2026-10-18)'), payload: { leak: true } })).toBeNull();
  });
});
