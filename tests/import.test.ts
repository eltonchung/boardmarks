import { describe, expect, test } from 'vitest';
import { parseImport, parseImportText } from '../src/services/import';
import { backupCounts } from '../src/services/backup';

const link = {
  title: 'Original',
  customTitle: '',
  customDescription: '',
  url: 'https://example.com/?q=1#part',
};
const toby = (cards: unknown[] = [link]) => ({
  version: 3,
  lists: [{ title: '工作', cards, labels: [] }],
});

describe('Toby v3 import', () => {
  test('preserves collection/card order, duplicate URLs, empty collections and custom titles', () => {
    const data = toby([link, { ...link, customTitle: '我的名稱' }]);
    data.lists.push({ title: '空分類', cards: [], labels: [] });
    const result = parseImport(data);
    expect(result.source).toBe('Toby');
    expect(result.notices).toEqual([]);
    expect(backupCounts(result.backup)).toEqual({ spaces: 1, collections: 2, bookmarks: 2 });
    expect(result.backup.spaces[0]).toMatchObject({
      title: 'Toby 匯入',
      collections: [
        {
          title: '工作',
          bookmarks: [
            { title: 'Original', url: link.url },
            { title: '我的名稱', url: link.url },
          ],
        },
        { title: '空分類', bookmarks: [] },
      ],
    });
  });

  test('reports notes, unsupported URLs, descriptions and tags before importing', () => {
    const data = {
      version: 3,
      lists: [
        {
          title: 'Work',
          labels: ['tag'],
          cards: [
            { ...link, customDescription: 'A useful description' },
            { ...link, url: '/note.html', customDescription: 'Private note' },
            { ...link, url: 'javascript:alert(1)' },
            { ...link, url: 'chrome://settings/' },
            { ...link, url: 'broken' },
          ],
        },
      ],
    };
    const result = parseImport(data);
    expect(backupCounts(result.backup).bookmarks).toBe(1);
    expect(result.notices).toHaveLength(4);
    expect(result.notices[0]).toContain('1 張 Toby 筆記');
    expect(result.notices[1]).toContain('3 張卡片');
    expect(result.notices[2]).toContain('1 個書籤含自訂說明');
    expect(result.notices[3]).toContain('1 個分類標籤');
  });

  test('does not create a misleading successful empty import when all cards are unsupported', () => {
    expect(() => parseImport(toby([{ ...link, url: '/note.html?id=1' }]))).toThrow('沒有可匯入');
  });

  test.each([
    { version: 4, lists: [] },
    { version: 3, lists: {} },
    { version: 3, lists: [{ title: 'No cards' }] },
    toby([{ title: 'No URL' }]),
    toby([{ ...link, customTitle: 42 }]),
    toby([{ ...link, customDescription: {} }]),
    toby([{ ...link, title: 'x'.repeat(100001) }]),
  ])('rejects malformed or unknown schemas', (data) => {
    expect(() => parseImport(data)).toThrow();
  });

  test('enforces limits even for skipped note cards and empty collections', () => {
    expect(() => parseImport(toby(Array(50001).fill({ ...link, url: '/note.html' })))).toThrow(
      '50,000',
    );
    expect(() =>
      parseImport({ version: 3, lists: Array(10001).fill({ title: 'Empty', cards: [] }) }),
    ).toThrow('10,000');
  });
});

test('Boardmarks import retains metadata and rejects unknown backup versions', () => {
  const data = {
    version: 1,
    spaces: [{ title: 'Native', metadata: { starred: true }, collections: [] }],
  };
  expect(parseImport(data)).toMatchObject({
    source: 'Boardmarks',
    notices: [],
    backup: { spaces: data.spaces },
  });
  expect(() => parseImport({ ...data, version: 2 })).toThrow('version 1');
});

test('file parsing tolerates a UTF-8 BOM and explains malformed JSON or unknown format', () => {
  expect(parseImportText('\uFEFF' + JSON.stringify(toby())).source).toBe('Toby');
  expect(() => parseImportText('{')).toThrow('無法讀取 JSON');
  expect(() => parseImport({ unrelated: [] })).toThrow('Boardmarks 備份或 Toby');
});
