export type Node = chrome.bookmarks.BookmarkTreeNode & { syncing?: boolean; folderType?: string };
export interface Metadata {
  starred?: boolean;
  collapsed?: boolean;
}
export interface Bookmark {
  id: string;
  parentId: string;
  title: string;
  url: string;
  index: number;
}
export interface Collection {
  id: string;
  spaceId: string;
  title: string;
  index: number;
  metaKey: string;
  bookmarks: Bookmark[];
}
export interface Space {
  id: string;
  title: string;
  index: number;
  metaKey: string;
  collections: Collection[];
}
export interface Board {
  root: Node | null;
  spaces: Space[];
  irregularCount: number;
}
export interface Settings {
  schemaVersion: 1;
  theme: 'system' | 'dark' | 'light';
  density: 'compact' | 'comfortable';
  fontSize: 14 | 16 | 18;
  tabsFontSize: 'inherit' | 16 | 18 | 20 | 22;
  sidebarFontSize: 'inherit' | 16 | 18 | 20 | 22;
  sidebarWidth: number;
  tabsWidth: number;
  showTabs: boolean;
  showSidebar: boolean;
  openIn: 'current' | 'window';
  closeAfterSave: boolean;
}
export const defaults: Settings = {
  schemaVersion: 1,
  theme: 'system',
  density: 'comfortable',
  fontSize: 16,
  tabsFontSize: 18,
  sidebarFontSize: 18,
  sidebarWidth: 220,
  tabsWidth: 300,
  showTabs: true,
  showSidebar: true,
  openIn: 'current',
  closeAfterSave: false,
};
export interface BackupCollection {
  title: string;
  metadata: Metadata;
  bookmarks: { title: string; url: string }[];
}
export interface BackupSpace {
  title: string;
  metadata: Metadata;
  collections: BackupCollection[];
}
export interface Backup {
  version: 1;
  exportedAt: string;
  spaces: BackupSpace[];
  settings?: Settings;
}
