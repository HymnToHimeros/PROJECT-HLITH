import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GameContract, HistoryMapping } from '../../core/contract';
import { gameData, resetUserData } from '../../core/data/userData';
import { documentBlock, FILES_MAX, PDF_MAX_BYTES, prepareFile, TEXT_MAX_BYTES } from './files';
import { HistoryOffer, historyFileFor } from './HistoryOffer';

const file = (name: string, body: BlobPart | BlobPart[], type = '') => new File(Array.isArray(body) ? body : [body], name, { type });

describe('Assistant files (T71)', () => {
  it('reads .json, .md, .txt and .csv as text and a .pdf as base64; titles each block with its name', async () => {
    for (const name of ['a.json', 'b.md', 'c.txt', 'd.csv']) {
      const f = await prepareFile(file(name, 'hello'));
      expect(f).toMatchObject({ name, kind: 'text', data: 'hello', size: 5 });
      expect(documentBlock(f)).toEqual({ type: 'document', title: name, source: { type: 'text', media_type: 'text/plain', data: 'hello' } });
    }
    const pdf = await prepareFile(file('guide.pdf', '%PDF-1.7 tiny', 'application/pdf'));
    expect(pdf.kind).toBe('pdf');
    expect(atob(pdf.data)).toBe('%PDF-1.7 tiny');
    expect(documentBlock(pdf)).toMatchObject({ type: 'document', title: 'guide.pdf', source: { type: 'base64', media_type: 'application/pdf' } });
    expect(FILES_MAX).toBe(5);
  });

  it('says clearly when a file is too big, empty, not really a PDF, or of a kind it can’t send', async () => {
    await expect(prepareFile(file('big.txt', new Uint8Array(TEXT_MAX_BYTES + 1)))).rejects.toThrow(/up to 500 KB/);
    await expect(prepareFile(file('big.pdf', new Uint8Array(PDF_MAX_BYTES + 1), 'application/pdf'))).rejects.toThrow(/up to 4.0 MB/);
    await expect(prepareFile(file('blank.md', '   '))).rejects.toThrow(/empty/);
    await expect(prepareFile(file('fake.pdf', 'not a pdf'))).rejects.toThrow(/isn’t a PDF/);
    await expect(prepareFile(file('song.mp3', 'x', 'audio/mpeg'))).rejects.toThrow(/\.json, \.md, \.txt, \.csv or \.pdf/);
  });
});

describe('a pull history export attached to the Assistant (T71)', () => {
  const mapping: HistoryMapping = { uigfKey: 'hkrpg', gachaTypes: { '11': 'character' }, rarity: { '5': 'top', '4': 'mid', '3': 'low' } };
  const game = { id: 'aa', short: 'AA', name: 'Game A', historyMapping: mapping } as unknown as GameContract;
  const row = (id: string, rank: string, time: string) => ({ id, gacha_type: '11', gacha_id: '1', item_id: '1001', count: '1', name: `Item ${id}`, item_type: 'Character', rank_type: rank, time });
  const text = JSON.stringify({
    info: { export_timestamp: 1, export_app: 'test', export_app_version: '1', version: 'v4.0' },
    hkrpg: [{ uid: '800000001', timezone: 8, lang: 'en-us', list: [row('1700000000000000001', '3', '2026-10-01 12:00:00'), row('1700000000000000002', '5', '2026-10-01 12:00:01')] }],
  });
  beforeEach(() => resetUserData());

  it('is recognised for the game it belongs to; other JSON is not', () => {
    expect(historyFileFor(text, [game])?.account.records).toHaveLength(2);
    expect(historyFileFor('{"todo":[1,2]}', [game])).toBeNull();
  });

  it('“Import into History” adds the pulls with the usual importer, and Undo removes exactly those', async () => {
    render(<HistoryOffer text={text} games={[game]} />);
    expect(screen.getByText(/UIGF pull history for AA \(2 pulls\)/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Import into History' }));
    });
    expect(gameData('aa').pulls).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('Added 2 new pulls to AA History');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(gameData('aa').pulls).toHaveLength(0);
  });
});
