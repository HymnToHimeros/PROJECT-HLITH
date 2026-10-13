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
      data: { title: 'Something new', at: '2026-10-13T01:00:00Z', credit: 'Seele (Telegram)', url: 'https://t.me/Seele_Leaks/1', text: 'orig', translation: 'eng', images: ['https://x/1.jpg'] },
    });
  });
  it('only info findings marked as a leak, with a post and a game', () => {
    expect(noteFromFinding(f({ kind: 'leak' }))).toBeNull(); // goes into a list instead
    expect(noteFromFinding(f({ payload: { post: { text: 'x' } } }))).toBeNull();
    expect(noteFromFinding(f({ payload: { leak: true } }))).toBeNull();
    expect(noteFromFinding(f({ game_id: null }))).toBeNull();
  });
  it('reads rows back, drops malformed or retired ones, newest first, only the shown games', () => {
    const ok = { title: 'A', at: '2026-10-12T00:00:00Z', text: 't', credit: 'C', images: [] };
    const rows = [row('a', 'hsr', ok), row('b', 'hsr', { ...ok, title: 'B', at: '2026-10-13T00:00:00Z' }), row('c', 'zzz', ok), row('d', 'hsr', { title: 'no text' }), row('e', 'hsr', ok, 'retired')];
    expect(notesFor(rows, ['hsr']).map((n) => n.title)).toEqual(['B', 'A']);
    expect(readNote(row('x', 'hsr', { ...ok, url: 'javascript:alert(1)' }))?.url).toBeUndefined();
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
