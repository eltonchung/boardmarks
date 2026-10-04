import { create } from 'zustand';
import type { Bookmark } from '../types';
import type { ImportPreview } from '../services/import';
import type { MenuItem } from '../components/common';
export type Editor =
  | { kind: 'folder'; parent: string; id?: string; title?: string; label: string }
  | { kind: 'bookmark'; parent: string; bookmark?: Bookmark }
  | { kind: 'save'; tab?: chrome.tabs.Tab; windowId?: number; close?: boolean }
  | { kind: 'move'; id: string; nodeType: 'bookmark' | 'collection'; parent: string }
  | { kind: 'settings' }
  | ({ kind: 'import' } & ImportPreview)
  | { kind: 'commands' };
interface UI {
  editor: Editor | null;
  menu: { x: number; y: number; items: MenuItem[] } | null;
  edit: (editor: Editor | null) => void;
  showMenu: (x: number, y: number, items: MenuItem[]) => void;
}
export const useUI = create<UI>((set) => ({
  editor: null,
  menu: null,
  edit: (editor) => set({ editor, menu: null }),
  showMenu: (x, y, items) => set({ menu: { x, y, items } }),
}));
export const edit = (editor: Editor | null) => useUI.getState().edit(editor);
export const menu = (
  event: { preventDefault: () => void; clientX: number; clientY: number },
  items: MenuItem[],
) => {
  event.preventDefault();
  useUI.getState().showMenu(event.clientX, event.clientY, items);
};
