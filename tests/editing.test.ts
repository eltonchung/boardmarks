import { beforeEach, expect, test, vi } from 'vitest';
import type { Node, Bookmark } from '../src/types';
const mock = vi.hoisted(() => ({ root: {} as Node, update: vi.fn(), move: vi.fn() }));
vi.mock('../src/chrome/api', () => ({
  exclusive: (fn: () => Promise<unknown>) => fn(),
  api: {
    storage: { local: { get: async () => ({ rootId: 'r' }) } },
    bookmarks: {
      getSubTree: async () => [structuredClone(mock.root)],
      update: mock.update,
      move: mock.move,
    },
  },
}));
import { editBookmarkNode } from '../src/chrome/bookmarks';
const original: Bookmark = {
  id: 'b',
  parentId: 'c',
  title: 'Original',
  url: 'https://example.com/old',
  index: 0,
};
function node() {
  return mock.root.children![0].children![0].children![0];
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.root = {
    id: 'r',
    title: 'Boardmarks',
    children: [
      {
        id: 's',
        parentId: 'r',
        title: 'Work',
        children: [
          { id: 'c', parentId: 's', title: 'Source', children: [{ ...original }] },
          { id: 'd', parentId: 's', title: 'Destination', children: [] },
        ],
      },
    ],
  };
  mock.update.mockImplementation(async (_id: string, changes: Partial<Node>) => {
    Object.assign(node(), changes);
    return structuredClone(node());
  });
  mock.move.mockResolvedValue({ ...original, parentId: 'd' });
});
test('validates destination before updating the title or URL', async () => {
  await expect(
    editBookmarkNode(original, 'Edited', 'https://example.com/new', 'absent'),
  ).rejects.toThrow();
  expect(mock.update).not.toHaveBeenCalled();
});
test('rejects an edit made stale by external changes', async () => {
  node().title = 'Changed externally';
  await expect(
    editBookmarkNode(original, 'Edited', 'https://example.com/new', 'c'),
  ).rejects.toThrow('編輯期間');
  expect(mock.update).not.toHaveBeenCalled();
});
test('failed move compensates title and URL edits under the same write lock', async () => {
  mock.move.mockRejectedValue(new Error('move failed'));
  await expect(
    editBookmarkNode(original, 'Edited', 'https://example.com/new', 'd'),
  ).rejects.toThrow('已復原');
  expect(node()).toMatchObject(original);
  expect(mock.update).toHaveBeenCalledTimes(2);
});
test('failed compensation reports partial state instead of a false success', async () => {
  mock.move.mockRejectedValue(new Error('move failed'));
  mock.update
    .mockImplementationOnce(async (_id: string, changes: Partial<Node>) => {
      Object.assign(node(), changes);
      return structuredClone(node());
    })
    .mockRejectedValueOnce(new Error('update failed'));
  await expect(
    editBookmarkNode(original, 'Edited', 'https://example.com/new', 'd'),
  ).rejects.toThrow('無法安全復原');
  expect(mock.update).toHaveBeenCalledTimes(2);
  expect(node()).toMatchObject({ title: 'Edited', url: 'https://example.com/new' });
});
test('does not overwrite a concurrent external edit while compensating', async () => {
  mock.move.mockImplementation(async () => {
    node().title = 'External edit';
    throw new Error('move failed');
  });
  await expect(
    editBookmarkNode(original, 'Edited', 'https://example.com/new', 'd'),
  ).rejects.toThrow('無法安全復原');
  expect(node().title).toBe('External edit');
  expect(mock.update).toHaveBeenCalledOnce();
});
test('same-collection edits do not move the bookmark', async () => {
  await editBookmarkNode(original, 'Edited', 'https://example.com/new', 'c');
  expect(node()).toMatchObject({ title: 'Edited', url: 'https://example.com/new', parentId: 'c' });
  expect(mock.move).not.toHaveBeenCalled();
});
