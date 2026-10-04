import { metadataKeys } from './metadata-cache';
import { api } from './api';
import { defaults, type Metadata, type Settings } from '../types';
export function validateSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') return { ...defaults };
  const v = value as Record<string, unknown>;
  if (typeof v.schemaVersion === 'number' && v.schemaVersion > 1)
    throw new Error('設定來自較新版本，請先更新 Boardmarks。');
  return {
    schemaVersion: 1,
    theme: v.theme === 'dark' || v.theme === 'light' ? v.theme : 'system',
    density: v.density === 'compact' ? 'compact' : 'comfortable',
    fontSize: v.fontSize === 14 || v.fontSize === 18 ? v.fontSize : defaults.fontSize,
    tabsFontSize:
      v.tabsFontSize === 'inherit' ||
      v.tabsFontSize === 16 ||
      v.tabsFontSize === 20 ||
      v.tabsFontSize === 22
        ? v.tabsFontSize
        : defaults.tabsFontSize,
    sidebarFontSize:
      v.sidebarFontSize === 'inherit' ||
      v.sidebarFontSize === 16 ||
      v.sidebarFontSize === 20 ||
      v.sidebarFontSize === 22
        ? v.sidebarFontSize
        : defaults.sidebarFontSize,
    sidebarWidth:
      typeof v.sidebarWidth === 'number' && Number.isFinite(v.sidebarWidth)
        ? Math.max(180, Math.min(320, v.sidebarWidth))
        : 220,
    tabsWidth:
      typeof v.tabsWidth === 'number' && Number.isFinite(v.tabsWidth)
        ? Math.max(240, Math.min(440, v.tabsWidth))
        : 300,
    showTabs: typeof v.showTabs === 'boolean' ? v.showTabs : true,
    showSidebar: typeof v.showSidebar === 'boolean' ? v.showSidebar : true,
    openIn: v.openIn === 'window' ? 'window' : 'current',
    closeAfterSave: v.closeAfterSave === true,
  };
}
export async function readSettings() {
  return validateSettings((await api.storage.sync.get('settings')).settings);
}
export async function writeSettings(value: Settings) {
  await api.storage.sync.set({ settings: validateSettings(value) });
}
export function metadataStorageKey(path: string): Promise<string> {
  let pending = metadataKeys.get(path);
  if (!pending) {
    pending = crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(path))
      .then(
        (bytes) =>
          'meta:' +
          Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, '0')).join(''),
      );
    metadataKeys.set(path, pending);
  }
  return pending;
}
export async function readMetadata(
  paths: string[],
  onlyStored = false,
): Promise<Record<string, Metadata>> {
  const pairs = await Promise.all(
    paths.map(async (path) => [path, await metadataStorageKey(path)] as const),
  );
  const raw = await api.storage.sync.get(pairs.map(([, key]) => key));
  return Object.fromEntries(
    pairs
      .filter(([, key]) => !onlyStored || Object.hasOwn(raw, key))
      .map(([path, key]) => [
        path,
        { starred: raw[key]?.starred === true, collapsed: raw[key]?.collapsed === true },
      ]),
  );
}
export async function writeMetadata(path: string, value: Metadata) {
  await api.storage.sync.set({
    [await metadataStorageKey(path)]: {
      starred: value.starred === true,
      collapsed: value.collapsed === true,
    },
  });
}

export async function writeMetadataBatch(entries: [string, Metadata][]) {
  if (!entries.length) return;
  const data = Object.fromEntries(
    await Promise.all(
      entries.map(async ([path, value]) => [
        await metadataStorageKey(path),
        { starred: value.starred === true, collapsed: value.collapsed === true },
      ]),
    ),
  );
  await api.storage.sync.set(data);
}
