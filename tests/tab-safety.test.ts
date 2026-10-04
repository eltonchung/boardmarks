import { beforeEach, expect, test, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  add: vi.fn(),
  close: vi.fn(),
  getTab: vi.fn(),
  refresh: vi.fn(),
  notify: vi.fn(),
  choose: vi.fn(),
  openAll: vi.fn(),
}));
vi.mock('../src/chrome/bookmarks', () => ({
  addBookmark: mock.add,
  DuplicateError: class extends Error {},
  createFolder: vi.fn(),
  deleteNode: vi.fn(),
  initializeRoot: vi.fn(),
  moveNode: vi.fn(),
  restoreNode: vi.fn(),
  updateNode: vi.fn(),
}));
vi.mock('../src/chrome/api', () => ({ api: { tabs: { get: mock.getTab } } }));
vi.mock('../src/chrome/tabs', () => ({
  closeTab: mock.close,
  openAll: mock.openAll,
  openUrl: vi.fn(),
}));
vi.mock('../src/stores/board', () => ({
  state: () => ({ settings: { openIn: 'current' } }),
  choose: mock.choose,
  notify: mock.notify,
  refreshBoard: mock.refresh,
}));
vi.mock('../src/chrome/storage', () => ({ writeMetadataBatch: vi.fn() }));
import { saveTab, openCollection } from '../src/services/actions';
const tab = {
  id: 7,
  title: 'Saved tab',
  url: 'https://example.com/',
  windowId: 1,
} as chrome.tabs.Tab;
beforeEach(() => {
  vi.resetAllMocks();
  mock.add.mockResolvedValue({ id: 'saved' });
  mock.getTab.mockResolvedValue(tab);
});
test('never closes tab when bookmark write fails', async () => {
  mock.add.mockRejectedValue(new Error('disk error'));
  await expect(saveTab(tab, 'c', true)).rejects.toThrow();
  expect(mock.close).not.toHaveBeenCalled();
});
test('closes only after successful bookmark persistence', async () => {
  await saveTab(tab, 'c', true);
  expect(mock.close).toHaveBeenCalledWith(7);
  expect(mock.add.mock.invocationCallOrder[0]).toBeLessThan(mock.close.mock.invocationCallOrder[0]);
});
test('keeps a tab that navigated after saving', async () => {
  mock.getTab.mockResolvedValue({ ...tab, url: 'https://example.org/changed' });
  await saveTab(tab, 'c', true);
  expect(mock.close).not.toHaveBeenCalled();
});
test('drag-save default keeps original tab', async () => {
  await saveTab(tab, 'c');
  expect(mock.close).not.toHaveBeenCalled();
});
test('internal pages cannot be saved or closed by save action', async () => {
  await expect(saveTab({ ...tab, url: 'chrome://settings' }, 'c', true)).rejects.toThrow();
  expect(mock.add).not.toHaveBeenCalled();
  expect(mock.close).not.toHaveBeenCalled();
});
test('opening more than ten tabs requires confirmation and honors cancellation', async () => {
  mock.choose.mockResolvedValue('cancel');
  await openCollection(Array.from({ length: 11 }, (_, i) => `https://example.com/${i}`));
  expect(mock.choose).toHaveBeenCalledOnce();
  expect(mock.openAll).not.toHaveBeenCalled();
});
test('confirmed bulk opening opens requested URLs', async () => {
  const urls = Array.from({ length: 11 }, (_, i) => `https://example.com/${i}`);
  mock.choose.mockResolvedValue('open');
  await openCollection(urls);
  expect(mock.openAll).toHaveBeenCalledWith(urls, false);
});
