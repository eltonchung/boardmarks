import { api, exclusive } from './api';
import type { Bookmark, Node } from '../types';
import { flatten, parseTree } from '../utils/tree';
import { duplicate, validUrl } from '../utils/url';
export class DuplicateError extends Error {
  constructor(public existing: Node) {
    super('此 Collection 已有相同網址。');
  }
}
export async function findRoot(): Promise<Node | null> {
  const { rootId } = await api.storage.local.get('rootId');
  if (typeof rootId === 'string') {
    try {
      const [root] = await api.bookmarks.getSubTree(rootId);
      if (root && !root.url && !root.unmodifiable) return root;
    } catch {
      /* rediscover a synced or moved root */
    }
  }
  const tree = await api.bookmarks.getTree();
  const candidates = tree.flatMap((n) =>
    (n.children ?? []).flatMap((top) =>
      (top.children ?? []).filter((n) => !n.url && !n.unmodifiable && n.title === 'Boardmarks'),
    ),
  );
  if (candidates.length > 1)
    throw new Error(
      '找到多個 Boardmarks 根目錄。請在 Chrome 書籤管理員將不使用的同名根目錄重新命名，再重試。',
    );
  const root = candidates[0] ?? null;
  if (root) await api.storage.local.set({ rootId: root.id });
  return root;
}
export async function initializeRoot(): Promise<Node> {
  return exclusive(async () => {
    const existing = await findRoot();
    if (existing) return existing;
    const tree = await api.bookmarks.getTree();
    const folders = ((tree[0]?.children ?? []) as Node[]).filter((n) => !n.unmodifiable && !n.url);
    const parent =
      folders.find((n) => n.syncing && n.folderType === 'other') ??
      folders.find((n) => n.syncing) ??
      folders.find((n) => n.folderType === 'other') ??
      folders.find((n) => n.id === '2') ??
      folders[0];
    if (!parent) throw new Error('找不到可寫入的 Chrome 書籤資料夾。');
    const root = await api.bookmarks.create({ parentId: parent.id, title: 'Boardmarks' });
    await api.storage.local.set({ rootId: root.id });
    const space = await api.bookmarks.create({ parentId: root.id, title: 'Personal' });
    await api.bookmarks.create({ parentId: space.id, title: 'Favorites' });
    return (await api.bookmarks.getSubTree(root.id))[0];
  });
}
async function scoped(id: string, allowRoot = false): Promise<{ root: Node; node: Node }> {
  const root = await findRoot();
  if (!root) throw new Error('Boardmarks 根目錄不存在，請重新整理。');
  const node = flatten(root).find((n) => n.id === id);
  if (!node || (!allowRoot && id === root.id) || node.unmodifiable)
    throw new Error('此操作只能修改 Boardmarks 內的項目。');
  return { root, node };
}
function title(value: string) {
  const clean = value.trim();
  if (!clean) throw new Error('名稱不能為空白。');
  if (clean.length > 500) throw new Error('名稱不能超過 500 字元。');
  return clean;
}
function backupTitle(value: string) {
  if (typeof value !== 'string' || value.length > 100_000)
    throw new Error('備份名稱格式或長度不支援。');
  return value;
}
export async function createFolder(parentId: string, name: string, preserveTitle = false) {
  return exclusive(async () => {
    const { root, node } = await scoped(parentId, true);
    if (node.url || (node.id !== root.id && node.parentId !== root.id))
      throw new Error('Space 只能放在根目錄，Collection 只能放在 Space。');
    return api.bookmarks.create({
      parentId,
      title: preserveTitle ? backupTitle(name) : title(name),
    });
  });
}
export async function addBookmark(
  parentId: string,
  name: string,
  url: string,
  allowDuplicate = false,
  index?: number,
  preserveTitle = false,
) {
  return exclusive(async () => {
    const { root, node } = await scoped(parentId);
    const board = parseTree(root);
    if (!board.spaces.some((s) => s.collections.some((c) => c.id === node.id)))
      throw new Error('請選擇有效的 Collection。');
    const clean = validUrl(url);
    const existing = duplicate(
      (node.children ?? []).filter((n): n is Node & { url: string } => !!n.url),
      clean,
    );
    if (existing && !allowDuplicate) throw new DuplicateError(existing);
    return api.bookmarks.create({
      parentId,
      title: preserveTitle ? backupTitle(name) : title(name),
      url: clean,
      ...(index === undefined ? {} : { index }),
    });
  });
}
export async function updateNode(id: string, name: string, url?: string) {
  return exclusive(async () => {
    const { node } = await scoped(id);
    if (url !== undefined && !node.url) throw new Error('不能將資料夾改成書籤。');
    return api.bookmarks.update(id, {
      title: title(name),
      ...(url !== undefined ? { url: validUrl(url) } : {}),
    });
  });
}
/** One local write lock covers edit + move and compensates a failed move. */
export async function editBookmarkNode(
  expected: Bookmark,
  name: string,
  url: string,
  parentId: string,
) {
  return exclusive(async () => {
    const { root, node } = await scoped(expected.id);
    const collection = parseTree(root)
      .spaces.flatMap((s) => s.collections)
      .find((c) => c.id === parentId);
    if (!collection || !node.url) throw new Error('目標 Collection 或原書籤已不存在。');
    if (
      node.title !== expected.title ||
      node.url !== expected.url ||
      node.parentId !== expected.parentId
    ) {
      throw new Error('書籤在編輯期間已被修改，請重新開啟編輯器後再儲存。');
    }
    const changes = { title: title(name), url: validUrl(url) };
    const updated = await api.bookmarks.update(node.id, changes);
    if (node.parentId === parentId) return updated;
    try {
      return await api.bookmarks.move(node.id, { parentId });
    } catch (error) {
      try {
        const { node: current } = await scoped(node.id);
        if (
          current.title !== changes.title ||
          current.url !== changes.url ||
          current.parentId !== node.parentId
        ) {
          throw new Error('書籤已被其他操作修改');
        }
        await api.bookmarks.update(node.id, { title: node.title, url: node.url });
      } catch {
        throw new Error(
          '搬移失敗，且無法安全復原編輯。書籤仍保留，請重新整理後檢查目前名稱、網址與位置。',
        );
      }
      throw new Error(
        `搬移失敗，已復原原本的名稱與網址。${error instanceof Error ? error.message : ''}`,
      );
    }
  });
}
export async function moveNode(id: string, parentId: string, index?: number) {
  return exclusive(async () => {
    const { root, node } = await scoped(id);
    const target = flatten(root).find((n) => n.id === parentId);
    if (!target || target.url || target.unmodifiable) throw new Error('目標資料夾不存在。');
    const board = parseTree(root);
    const isSpace = node.parentId === root.id;
    const isCollection = board.spaces.some((s) => s.collections.some((c) => c.id === id));
    const allowed = node.url
      ? board.spaces.some((s) => s.collections.some((c) => c.id === parentId))
      : isSpace
        ? parentId === root.id
        : isCollection && board.spaces.some((s) => s.id === parentId);
    if (!allowed) throw new Error('不允許變更 Boardmarks 的資料夾層級。');
    // Chrome indexes the destination before removing the source. Our callers use final indexes.
    const destinationIndex =
      index !== undefined && node.parentId === parentId && (node.index ?? 0) < index
        ? index + 1
        : index;
    return api.bookmarks.move(id, {
      parentId,
      ...(destinationIndex === undefined ? {} : { index: destinationIndex }),
    });
  });
}
export async function deleteNode(id: string, expected?: Node) {
  return exclusive(async () => {
    const { node } = await scoped(id);
    if (
      expected &&
      JSON.stringify(flatten(node).map((n) => [n.id, n.parentId, n.title, n.url])) !==
        JSON.stringify(flatten(expected).map((n) => [n.id, n.parentId, n.title, n.url]))
    ) {
      throw new Error('此項目在確認期間已被修改。請重新檢查後再刪除。');
    }
    if (node.url) await api.bookmarks.remove(id);
    else await api.bookmarks.removeTree(id);
    return node;
  });
}
export async function restoreNode(snapshot: Node, parentId = snapshot.parentId!): Promise<Node> {
  return exclusive(async () => {
    const { node: parent } = await scoped(parentId, true);
    if (parent.url) throw new Error('原資料夾已不存在，無法復原。');
    async function restore(n: Node, p: string, index?: number): Promise<Node> {
      const created = await api.bookmarks.create({
        parentId: p,
        title: n.title,
        ...(n.url ? { url: n.url } : {}),
        ...(index === undefined ? {} : { index }),
      });
      try {
        for (const child of n.children ?? []) await restore(child, created.id);
      } catch (error) {
        throw new Error(
          `復原部分完成；已復原的資料保留在「${n.title}」。${error instanceof Error ? error.message : ''}`,
        );
      }
      return created;
    }
    return restore(snapshot, parentId, Math.min(snapshot.index ?? 0, parent.children?.length ?? 0));
  });
}
