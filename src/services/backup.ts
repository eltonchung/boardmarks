import { defaults, type Backup, type BackupSpace, type Metadata } from '../types';
import { validUrl } from '../utils/url';
import { validateSettings } from '../chrome/storage';
function obj(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('備份格式不正確。');
  return value as Record<string, unknown>;
}
function name(value: unknown) {
  if (typeof value !== 'string' || value.length > 100_000) throw new Error('備份包含無效的名稱。');
  return value;
}
function meta(value: unknown): Metadata {
  if (value === undefined) return {};
  const m = obj(value);
  if (
    (m.starred !== undefined && typeof m.starred !== 'boolean') ||
    (m.collapsed !== undefined && typeof m.collapsed !== 'boolean')
  )
    throw new Error('metadata 格式錯誤。');
  return { starred: m.starred === true, collapsed: m.collapsed === true };
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('備份缺少必要清單。');
  return value;
}
export function validateBackup(value: unknown): Backup {
  const data = obj(value);
  if (data.version !== 1) throw new Error('僅支援 Boardmarks JSON version 1。');
  let count = 0;
  const spaces: BackupSpace[] = list(data.spaces).map((s) => {
    const space = obj(s);
    return {
      title: name(space.title ?? space.name),
      metadata: meta(space.metadata),
      collections: list(space.collections).map((c) => {
        const collection = obj(c);
        return {
          title: name(collection.title ?? collection.name),
          metadata: meta(collection.metadata),
          bookmarks: list(collection.bookmarks).map((b) => {
            if (++count > 50000) throw new Error('單次匯入上限為 50,000 個書籤。');
            const bookmark = obj(b);
            if (typeof bookmark.url !== 'string') throw new Error('書籤缺少 URL。');
            return { title: name(bookmark.title), url: validUrl(bookmark.url) };
          }),
        };
      }),
    };
  });
  if (spaces.length > 1000 || spaces.reduce((n, s) => n + s.collections.length, 0) > 10000)
    throw new Error('備份資料夾數量超過單次匯入上限。');
  return {
    version: 1,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    spaces,
    settings: data.settings ? validateSettings(data.settings) : { ...defaults },
  };
}
export function backupCounts(backup: Backup) {
  return {
    spaces: backup.spaces.length,
    collections: backup.spaces.reduce((n, s) => n + s.collections.length, 0),
    bookmarks: backup.spaces.reduce(
      (n, s) => n + s.collections.reduce((m, c) => m + c.bookmarks.length, 0),
      0,
    ),
  };
}
export function downloadBackup(backup: Backup) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `boardmarks-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
