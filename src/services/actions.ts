import {
  addBookmark,
  createFolder,
  deleteNode,
  DuplicateError,
  initializeRoot,
  moveNode,
  restoreNode,
  updateNode,
  editBookmarkNode,
} from '../chrome/bookmarks';
import { api } from '../chrome/api';
import { openAll, openUrl, closeTab } from '../chrome/tabs';
import { writeMetadataBatch } from '../chrome/storage';
import { state, choose, notify, refreshBoard } from '../stores/board';
import type { Backup, Bookmark, Node } from '../types';
import { nodeCount, parseTree } from '../utils/tree';
import { isSaveable } from '../utils/url';
import { validateBackup } from './backup';
export async function createWorkspace() {
  await initializeRoot();
  await refreshBoard();
}
export async function createNamedFolder(parent: string, title: string) {
  const n = await createFolder(parent, title);
  await refreshBoard();
  return n;
}
async function preserveMetadata(action: () => Promise<unknown>) {
  await action();
  await refreshBoard();
}
export async function rename(id: string, title: string) {
  await preserveMetadata(() => updateNode(id, title));
}
export async function move(id: string, parent: string, index?: number) {
  const [before] = await api.bookmarks.get(id);
  await preserveMetadata(() => moveNode(id, parent, index));
  notify('已移動', false, async () => {
    await preserveMetadata(() => moveNode(id, before.parentId!, before.index));
    notify('已復原移動');
  });
}
export async function remove(id: string) {
  await refreshBoard();
  const metadataSnapshot = new Map(
    state()
      .board.spaces.flatMap((s) => [s, ...s.collections])
      .map((n) => [n.id, state().metadata[n.metaKey]]),
  );
  const [snapshot] = await api.bookmarks.getSubTree(id);
  if (!snapshot.url && (snapshot.children?.length ?? 0) > 0) {
    const count = nodeCount(snapshot);
    const folders = snapshot.children?.filter((n) => !n.url).length ?? 0;
    const result = await choose(
      `刪除「${snapshot.title}」？`,
      `${folders ? `${folders} 個資料夾、` : ''}${count} 個書籤將被刪除。可在 5 秒內復原。`,
      [
        { label: '取消', value: 'cancel' },
        { label: '確認刪除', value: 'delete', danger: true },
      ],
    );
    if (result !== 'delete') return;
  }
  const deleted = await deleteNode(id, snapshot);
  const undo = async () => {
    const restored = await restoreNode(deleted);
    await refreshBoard();
    const [restoredTree] = await api.bookmarks.getSubTree(restored.id);
    const values = new Map<string, { starred?: boolean; collapsed?: boolean }>();
    const match = (old: Node, current: Node) => {
      const meta = metadataSnapshot.get(old.id);
      if (meta) values.set(current.id, meta);
      old.children?.forEach((child, index) => {
        const next = current.children?.[index];
        if (next) match(child, next);
      });
    };
    match(deleted, restoredTree);
    await writeMetadataBatch(
      state()
        .board.spaces.flatMap((s) => [s, ...s.collections])
        .flatMap((n) => {
          const value = values.get(n.id);
          return value ? [[n.metaKey, value] as [string, typeof value]] : [];
        }),
    );
    await refreshBoard();
    notify('已復原');
  };
  notify('已刪除', false, undo);
  try {
    await refreshBoard();
  } catch {
    notify('已刪除，但畫面更新失敗。仍可按復原。', true, undo);
  }
}
export async function saveBookmark(
  parent: string,
  title: string,
  url: string,
  index?: number,
): Promise<Node | null> {
  try {
    const node = await addBookmark(parent, title, url, false, index);
    await refreshBoard();
    return node;
  } catch (error) {
    if (!(error instanceof DuplicateError)) throw error;
    const choice = await choose(
      '此書籤已存在',
      `「${error.existing.title}」已儲存在這個 Collection。`,
      [
        { label: '取消', value: 'cancel' },
        { label: '開啟既有書籤', value: 'open' },
        { label: '仍然加入', value: 'add' },
      ],
    );
    if (choice === 'open') await openUrl(error.existing.url!);
    if (choice !== 'add') return null;
    const node = await addBookmark(parent, title, url, true, index);
    await refreshBoard();
    return node;
  }
}
export async function editBookmark(bookmark: Bookmark, title: string, url: string, parent: string) {
  try {
    await editBookmarkNode(bookmark, title, url, parent);
  } finally {
    await refreshBoard();
  }
  notify('已儲存書籤');
}
export async function saveTab(tab: chrome.tabs.Tab, parent: string, close = false, index?: number) {
  const url = tab.url ?? tab.pendingUrl;
  if (!isSaveable(url)) throw new Error('Chrome 內部頁面或此分頁無法收藏。');
  const saved = await saveBookmark(parent, tab.title || url, url, index);
  if (!saved) return;
  if (close && tab.id !== undefined) {
    const current = await api.tabs.get(tab.id).catch(() => null);
    if (current && current.url === url) await closeTab(tab.id);
    else {
      notify('已收藏；原分頁已變更或關閉，保留目前頁面。');
      return;
    }
  }
  notify(close ? '已收藏；原網址分頁已處理' : '已收藏，保留原分頁');
}
export async function saveWindow(windowId: number, parent: string) {
  const windows = await api.windows.getAll({ populate: true });
  const win = windows.find((w) => w.id === windowId);
  if (!win) throw new Error('視窗已關閉。');
  let count = 0,
    skipped = 0;
  try {
    for (const tab of win.tabs ?? []) {
      if (!isSaveable(tab.url)) {
        skipped++;
        continue;
      }
      try {
        await addBookmark(parent, tab.title || tab.url, tab.url);
        count++;
      } catch (error) {
        if (error instanceof DuplicateError) {
          skipped++;
          continue;
        }
        throw error;
      }
    }
  } catch (error) {
    throw new Error(
      `已儲存 ${count} 個分頁，剩餘未完成：${error instanceof Error ? error.message : ''}。原分頁均保留。`,
    );
  } finally {
    await refreshBoard();
  }
  notify(`已收藏 ${count} 個分頁${skipped ? `，略過 ${skipped} 個重複或不支援的頁面` : ''}`);
}
export async function openCollection(urls: string[]) {
  if (urls.length > 10) {
    const choice = await choose(`開啟 ${urls.length} 個分頁？`, '大量分頁可能增加記憶體使用量。', [
      { label: '取消', value: 'cancel' },
      { label: '全部開啟', value: 'open' },
    ]);
    if (choice !== 'open') return;
  }
  await openAll(urls, state().settings.openIn === 'window');
}
export async function exportData(): Promise<Backup> {
  await refreshBoard();
  const { board, metadata, settings } = state();
  if (board.irregularCount)
    throw new Error(
      '存在非標準層級的書籤，無法完整匯出為 Boardmarks JSON。請先在 Chrome 書籤管理員整理，或使用 Chrome 原生 HTML 匯出。',
    );
  const backup: Backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    spaces: board.spaces.map((s) => ({
      title: s.title,
      metadata: metadata[s.metaKey] ?? {},
      collections: s.collections.map((c) => ({
        title: c.title,
        metadata: metadata[c.metaKey] ?? {},
        bookmarks: c.bookmarks.map((b) => ({ title: b.title, url: b.url })),
      })),
    })),
  };
  // Do not download a file that our own importer would reject.
  validateBackup(backup);
  return backup;
}
export async function importData(backup: Backup) {
  backup = validateBackup(backup);
  const root = state().board.root;
  if (!root) throw new Error('請先建立工作區。');
  let count = 0;
  const metadataById = new Map<string, { starred?: boolean; collapsed?: boolean }>();
  try {
    for (const space of backup.spaces) {
      const s = await createFolder(root.id, space.title, true);
      metadataById.set(s.id, space.metadata);
      for (const collection of space.collections) {
        const c = await createFolder(s.id, collection.title, true);
        metadataById.set(c.id, collection.metadata);
        for (const b of collection.bookmarks) {
          await addBookmark(c.id, b.title, b.url, true, undefined, true);
          count++;
        }
      }
    }
    const [tree] = await api.bookmarks.getSubTree(root.id);
    await writeMetadataBatch(
      parseTree(tree)
        .spaces.flatMap((s) => [s, ...s.collections])
        .flatMap((n) => {
          const meta = metadataById.get(n.id);
          return meta ? [[n.metaKey, meta] as [string, typeof meta]] : [];
        }),
    );
  } catch (error) {
    throw new Error(
      `匯入未完成，已加入 ${count} 個書籤並保留；既有資料未覆蓋。${error instanceof Error ? error.message : ''}`,
    );
  } finally {
    await refreshBoard();
  }
  notify(`已匯入 ${count} 個書籤`);
}
