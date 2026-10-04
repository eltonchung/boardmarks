import { beforeEach, expect, test, vi } from 'vitest';
import type { Node } from '../src/types';
const mock = vi.hoisted(() => ({
  getSubTree: vi.fn(),
  get: vi.fn(),
  getTree: vi.fn(),
  create: vi.fn(),
  move: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  removeTree: vi.fn(),
  localGet: vi.fn(),
  localSet: vi.fn(),
}));
vi.mock('../src/chrome/api', () => ({
  exclusive: (fn: () => Promise<unknown>) => fn(),
  api: {
    bookmarks: {
      getSubTree: mock.getSubTree,
      get: mock.get,
      getTree: mock.getTree,
      create: mock.create,
      move: mock.move,
      update: mock.update,
      remove: mock.remove,
      removeTree: mock.removeTree,
    },
    storage: { local: { get: mock.localGet, set: mock.localSet } },
  },
}));
import {
  addBookmark,
  createFolder,
  deleteNode,
  DuplicateError,
  moveNode,
  restoreNode,
  updateNode,
} from '../src/chrome/bookmarks';
const root: Node = {
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
          children: [{ id: 'b', parentId: 'c', title: 'Docs', url: 'https://example.com/' }],
        },
      ],
    },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  mock.localGet.mockResolvedValue({ rootId: 'r' });
  mock.getSubTree.mockResolvedValue([structuredClone(root)]);
  mock.create.mockImplementation(async (data) => ({ ...data, id: 'new' }));
});
test('rejects writes outside Boardmarks and mutation of the root', async () => {
  await expect(deleteNode('outside')).rejects.toThrow();
  await expect(updateNode('r', 'oops')).rejects.toThrow();
  await expect(moveNode('b', 'outside')).rejects.toThrow();
  expect(mock.removeTree).not.toHaveBeenCalled();
  expect(mock.update).not.toHaveBeenCalled();
  expect(mock.move).not.toHaveBeenCalled();
});
test('enforces Space / Collection / Bookmark levels', async () => {
  await expect(createFolder('c', 'nested')).rejects.toThrow();
  await expect(addBookmark('s', 'bookmark', 'https://example.com')).rejects.toThrow();
  await expect(moveNode('s', 'c')).rejects.toThrow();
  await expect(moveNode('c', 'r')).rejects.toThrow();
  expect(mock.create).not.toHaveBeenCalled();
});
test('detects normalized duplicates before writing', async () => {
  await expect(addBookmark('c', 'Duplicate', 'https://example.com')).rejects.toBeInstanceOf(
    DuplicateError,
  );
  expect(mock.create).not.toHaveBeenCalled();
  await addBookmark('c', 'Duplicate', 'https://example.com', true);
  expect(mock.create).toHaveBeenCalledOnce();
});
test('failed Chrome move does not fake a successful move', async () => {
  mock.move.mockRejectedValue(new Error('API failed'));
  await expect(moveNode('b', 'c', 0)).rejects.toThrow('API failed');
  expect(root.children![0].children![0].children![0].parentId).toBe('c');
});
test('deletes bookmark with remove and folder with removeTree', async () => {
  await deleteNode('b');
  expect(mock.remove).toHaveBeenCalledWith('b');
  expect(mock.removeTree).not.toHaveBeenCalled();
  await deleteNode('c');
  expect(mock.removeTree).toHaveBeenCalledWith('c');
});
test('undo refuses restoration into an absent parent', async () => {
  await expect(
    restoreNode({ id: 'old', parentId: 'missing', title: 'Recover', url: 'https://example.org/' }),
  ).rejects.toThrow();
  expect(mock.create).not.toHaveBeenCalled();
});
test('converts final index to Chrome pre-removal index for forward moves', async () => {
  await moveNode('b', 'c', 2);
  expect(mock.move).toHaveBeenCalledWith('b', { parentId: 'c', index: 3 });
});
test('refuses deletion when folder changed during confirmation', async () => {
  const expected = structuredClone(root.children![0].children![0]);
  expected.children = [];
  await expect(deleteNode('c', expected)).rejects.toThrow('確認期間');
  expect(mock.removeTree).not.toHaveBeenCalled();
});
