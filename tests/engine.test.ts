import { describe, expect, test } from 'vitest';
import { duplicate, normalizeUrl, validUrl } from '../src/utils/url';
import { parseTree, searchBoard } from '../src/utils/tree';
import { validateBackup } from '../src/services/backup';
import { validateSettings } from '../src/chrome/storage';
import type { Node } from '../src/types';
export const sample: Node = {
  id: 'r',
  title: 'Boardmarks',
  children: [
    {
      id: 's',
      parentId: 'r',
      title: 'Work',
      children: [
        {
          id: 'c',
          parentId: 's',
          title: 'Development',
          children: [{ id: 'b', parentId: 'c', title: 'Docs', url: 'https://example.com/?page=1' }],
        },
      ],
    },
  ],
};
describe('URL safety and duplicates', () => {
  test('ignores trailing slash but preserves meaningful query and hash', () => {
    expect(normalizeUrl('https://EXAMPLE.com/path/')).toBe(
      normalizeUrl('https://example.com/path'),
    );
    expect(normalizeUrl('https://example.com/?page=1')).not.toBe(
      normalizeUrl('https://example.com/?page=2'),
    );
    expect(normalizeUrl('https://example.com/#a')).not.toBe(normalizeUrl('https://example.com/#b'));
    expect(duplicate([{ url: 'https://example.com/' }], 'https://example.com')).toBeDefined();
  });
  test.each(['javascript:alert(1)', 'data:text/html,x', 'chrome://settings', 'bad', ''])(
    'rejects unsafe URL %s',
    (value) => expect(() => validUrl(value)).toThrow(),
  );
});
test('tree preserves IDs, hierarchy and order without modifying source', () => {
  const before = JSON.stringify(sample);
  const board = parseTree(sample);
  expect(board.spaces[0].id).toBe('s');
  expect(board.spaces[0].collections[0].spaceId).toBe('s');
  expect(board.spaces[0].collections[0].bookmarks[0].parentId).toBe('c');
  expect(JSON.stringify(sample)).toBe(before);
  expect(searchBoard(board.spaces, 'page=1')).toHaveLength(1);
  expect(searchBoard(board.spaces, 'work')).toHaveLength(1);
  expect(searchBoard(board.spaces, 'missing')).toHaveLength(0);
});
test('portable metadata keys do not depend on profile IDs', () => {
  const other = JSON.parse(JSON.stringify(sample).replaceAll('"s"', '"different"')) as Node;
  expect(parseTree(other).spaces[0].metaKey).toBe(parseTree(sample).spaces[0].metaKey);
});
test('validates backup completely before importing', () => {
  expect(() => validateBackup({ version: 2, spaces: [] })).toThrow();
  expect(() =>
    validateBackup({
      version: 1,
      spaces: [
        {
          title: 'Test',
          collections: [{ title: 'Links', bookmarks: [{ title: 'Bad', url: 'javascript:x' }] }],
        },
      ],
    }),
  ).toThrow();
  expect(validateBackup({ version: 1, spaces: [] })).toMatchObject({ version: 1, spaces: [] });
});
test('migrates legacy settings and rejects future schema', () => {
  expect(validateSettings({ theme: 'dark', sidebarWidth: 999 })).toMatchObject({
    theme: 'dark',
    sidebarWidth: 320,
    schemaVersion: 1,
    fontSize: 16,
  });
  expect(() => validateSettings({ schemaVersion: 2 })).toThrow();
});
test('font preference accepts supported sizes and upgrades missing or invalid settings', () => {
  for (const value of [14, 16, 18])
    expect(validateSettings({ fontSize: value }).fontSize).toBe(value);
  for (const value of [undefined, null, '18', 0, 200, NaN])
    expect(validateSettings({ fontSize: value }).fontSize).toBe(16);
});
test('panel font settings migrate independently and permit following the main font', () => {
  for (const value of ['inherit', 16, 18, 20, 22])
    expect(validateSettings({ tabsFontSize: value, fontSize: 14 }).tabsFontSize).toBe(value);
  for (const value of [undefined, null, '22', 14, 24, NaN])
    expect(validateSettings({ tabsFontSize: value }).tabsFontSize).toBe(18);
});
test('sidebar font settings upgrade old preferences without changing the right panel', () => {
  for (const size of ['inherit', 16, 18, 20, 22]) {
    const settings = validateSettings({ sidebarFontSize: size, tabsFontSize: 20, fontSize: 14 });
    expect(settings.sidebarFontSize).toBe(size);
    expect(settings.tabsFontSize).toBe(20);
    expect(settings.fontSize).toBe(14);
  }
  for (const value of [undefined, null, 14, 24, '22', NaN])
    expect(validateSettings({ sidebarFontSize: value }).sidebarFontSize).toBe(18);
});
test('parses and searches 5000 bookmarks without changing source', () => {
  const tree: Node = {
    id: 'root',
    title: 'Boardmarks',
    children: Array.from({ length: 10 }, (_, s) => ({
      id: `s${s}`,
      title: `Space ${s}`,
      children: Array.from({ length: 10 }, (_, c) => ({
        id: `c${s}-${c}`,
        title: `Collection ${c}`,
        children: Array.from({ length: 50 }, (_, b) => ({
          id: `b${s}-${c}-${b}`,
          title: `Link ${s}-${c}-${b}`,
          url: `https://example.com/${s}/${c}/${b}`,
        })),
      })),
    })),
  };
  const start = performance.now();
  const board = parseTree(tree);
  expect(searchBoard(board.spaces, 'Link 9-9-49')[0].bookmarks[0].id).toBe('b9-9-49');
  expect(board.spaces.flatMap((s) => s.collections.flatMap((c) => c.bookmarks))).toHaveLength(5000);
  expect(performance.now() - start).toBeLessThan(500);
});
test('normalization preserves slashes inside query values and fragments', () => {
  expect(normalizeUrl('https://example.com/path?next=https://target/')).not.toBe(
    normalizeUrl('https://example.com/path?next=https://target'),
  );
  expect(normalizeUrl('https://example.com/path#route/')).not.toBe(
    normalizeUrl('https://example.com/path#route'),
  );
  expect(normalizeUrl('https://example.com/path/?next=https://target/')).toBe(
    normalizeUrl('https://example.com/path?next=https://target/'),
  );
});
test('backup roundtrip retains native empty names, whitespace and long titles', () => {
  const backup = {
    version: 1,
    spaces: [
      {
        title: ' Work ',
        collections: [
          {
            title: '',
            bookmarks: [
              { title: '', url: 'https://example.com/' },
              { title: 'Long title '.repeat(100), url: 'https://example.org/' },
            ],
          },
        ],
      },
    ],
  };
  const parsed = validateBackup(backup);
  expect(parsed.spaces[0].title).toBe(' Work ');
  expect(parsed.spaces[0].collections[0].title).toBe('');
  expect(parsed.spaces[0].collections[0].bookmarks[0].title).toBe('');
  expect(parsed.spaces[0].collections[0].bookmarks[1].title).toBe('Long title '.repeat(100));
});

test('sidebar visibility defaults on for old settings and preserves explicit collapse', () => {
  expect(validateSettings({}).showSidebar).toBe(true);
  expect(validateSettings({ showSidebar: false }).showSidebar).toBe(false);
  expect(validateSettings({ showSidebar: 'false' }).showSidebar).toBe(true);
});
