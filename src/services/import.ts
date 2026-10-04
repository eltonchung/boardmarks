import type { Backup } from '../types';
import { validUrl } from '../utils/url';
import { validateBackup } from './backup';

export interface ImportPreview {
  backup: Backup;
  source: 'Boardmarks' | 'Toby';
  notices: string[];
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('匯入檔案格式不正確。');
  return value as Record<string, unknown>;
}

function title(value: unknown): string {
  if (typeof value !== 'string' || value.length > 100_000)
    throw new Error('Toby 檔案包含無效的名稱或說明。');
  return value;
}

function optionalText(value: unknown): string {
  return value == null ? '' : title(value);
}

/** Convert only the observed Toby v3 export schema; do not guess unknown versions. */
export function parseImport(value: unknown): ImportPreview {
  const data = object(value);
  if ('spaces' in data) return { backup: validateBackup(data), source: 'Boardmarks', notices: [] };
  if (!('lists' in data)) throw new Error('請選擇 Boardmarks 備份或 Toby 匯出的 JSON 檔案。');
  if (data.version !== 3)
    throw new Error('目前支援 Toby JSON version 3，請使用 Toby 重新匯出的 JSON。');
  if (!Array.isArray(data.lists) || data.lists.length > 10000)
    throw new Error('Toby 收藏清單格式不正確或超過 10,000 個分類。');

  let cards = 0,
    notes = 0,
    unsupported = 0,
    descriptions = 0,
    labels = 0;
  const collections = data.lists.map((value) => {
    const collection = object(value);
    const collectionTitle = title(collection.title);
    if (!Array.isArray(collection.cards)) throw new Error('Toby 收藏缺少 cards 清單。');
    cards += collection.cards.length;
    if (cards > 50000) throw new Error('單次匯入上限為 50,000 張 Toby 卡片。');
    if (collection.labels !== undefined) {
      if (!Array.isArray(collection.labels)) throw new Error('Toby labels 格式不正確。');
      labels += collection.labels.length;
    }
    const bookmarks = collection.cards.flatMap((value) => {
      const card = object(value);
      const cardTitle = optionalText(card.customTitle) || title(card.title);
      const description = optionalText(card.customDescription);
      if (typeof card.url !== 'string') throw new Error('Toby 卡片缺少 URL。');
      // Toby notes use an internal relative URL, not a portable bookmark URL.
      if (/^\/note\.html(?:[?#]|$)/.test(card.url.trim())) {
        notes++;
        return [];
      }
      let url: string;
      try {
        url = validUrl(card.url);
      } catch {
        unsupported++;
        return [];
      }
      if (description) descriptions++;
      return [{ title: cardTitle, url }];
    });
    return { title: collectionTitle, metadata: {}, bookmarks };
  });
  const notices: string[] = [];
  if (notes) notices.push(`${notes} 張 Toby 筆記卡片無法轉成書籤，本次不匯入。`);
  if (unsupported)
    notices.push(
      `${unsupported} 張卡片的網址無效或不支援，本次不匯入（僅支援 http、https、ftp、file）。`,
    );
  if (descriptions)
    notices.push(`${descriptions} 個書籤含自訂說明；會保留名稱與網址，說明文字不會匯入。`);
  if (labels) notices.push(`${labels} 個分類標籤不會匯入。`);
  if (cards && !collections.some((c) => c.bookmarks.length))
    throw new Error('Toby 檔案沒有可匯入的網址；筆記卡片與不支援的網址無法轉成書籤。');

  return {
    source: 'Toby',
    notices,
    backup: validateBackup({
      version: 1,
      spaces: [{ title: 'Toby 匯入', metadata: {}, collections }],
    }),
  };
}

export function parseImportText(text: string): ImportPreview {
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('無法讀取 JSON，請選擇完整的 Boardmarks 或 Toby 匯出檔。');
  }
  return parseImport(value);
}
