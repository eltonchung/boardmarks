import { create } from 'zustand';
import { api } from '../chrome/api';
import { readSettings, writeSettings } from '../chrome/storage';
import { loadBoardWithMetadata, patchMetadata } from '../services/metadata';
import { readWindows } from '../chrome/tabs';
import { defaults, type Board, type Metadata, type Settings } from '../types';
import { logger } from '../utils/logger';
export interface Toast {
  id: number;
  text: string;
  error?: boolean;
  undo?: () => Promise<void>;
  expires: number;
}
export interface Choice {
  title: string;
  body: string;
  options: { label: string; value: string; danger?: boolean }[];
  resolve: (value: string) => void;
}
interface State {
  board: Board;
  metadata: Record<string, Metadata>;
  settings: Settings;
  windows: chrome.windows.Window[];
  ready: boolean;
  error: string | null;
  selected: string;
  query: string;
  view: 'space' | 'all' | 'starred';
  toast: Toast | null;
  choice: Choice | null;
  set: (patch: Partial<State>) => void;
}
export const useBoard = create<State>((set) => ({
  board: { root: null, spaces: [], irregularCount: 0 },
  metadata: {},
  settings: defaults,
  windows: [],
  ready: false,
  error: null,
  selected: '',
  query: '',
  view: 'space',
  toast: null,
  choice: null,
  set,
}));
export const state = () => useBoard.getState();
export function notify(text: string, error = false, undo?: () => Promise<void>) {
  useBoard.setState({
    toast: { id: Date.now(), text, error, undo, expires: Date.now() + (error ? 9000 : 5000) },
  });
}
export async function run(action: () => Promise<unknown>): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (error) {
    logger.debug(error);
    notify(error instanceof Error ? error.message : '操作失敗，請重試。', true);
    return false;
  }
}
export function choose(title: string, body: string, options: Choice['options']): Promise<string> {
  return new Promise((resolve) => {
    const previous = state().choice;
    previous?.resolve('cancel');
    useBoard.setState({ choice: { title, body, options, resolve } });
  });
}
export function answer(value: string) {
  const choice = state().choice;
  useBoard.setState({ choice: null });
  choice?.resolve(value);
}
let refreshQueue: Promise<void> = Promise.resolve();
export function refreshBoard(): Promise<void> {
  const next = refreshQueue.catch(() => undefined).then(readBoard);
  refreshQueue = next;
  return next;
}
async function readBoard() {
  const { board, metadata } = await loadBoardWithMetadata();
  const selected = board.spaces.some((s) => s.id === state().selected)
    ? state().selected
    : (board.spaces[0]?.id ?? '');
  useBoard.setState({ board, metadata, selected, ready: true, error: null });
}
export async function saveSettings(patch: Partial<Settings>) {
  const value = { ...state().settings, ...patch };
  await writeSettings(value);
  useBoard.setState({ settings: value });
}
export async function setMetadata(key: string, patch: Metadata) {
  const value = await patchMetadata(key, patch);
  useBoard.setState({ metadata: { ...state().metadata, [key]: value } });
}
let timer: ReturnType<typeof setTimeout>;
let refreshing = false,
  dirty = false;
async function reload() {
  if (refreshing) {
    dirty = true;
    return;
  }
  refreshing = true;
  try {
    await refreshBoard();
  } catch (error) {
    useBoard.setState({
      ready: true,
      error: error instanceof Error ? error.message : '無法讀取書籤。',
    });
  } finally {
    refreshing = false;
    if (dirty) {
      dirty = false;
      void reload();
    }
  }
}
export function subscribe() {
  let tabsTimer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void reload(), 70);
  };
  const refreshTabs = () => {
    clearTimeout(tabsTimer);
    tabsTimer = setTimeout(() => {
      void run(async () => useBoard.setState({ windows: await readWindows() }));
    }, 60);
  };
  const storage = (_changes?: Record<string, chrome.storage.StorageChange>, area?: string) => {
    if (area && area !== 'sync') return;
    void run(async () => {
      useBoard.setState({ settings: await readSettings() });
      schedule();
    });
  };
  const bookmarkEvents = [
    api.bookmarks.onCreated,
    api.bookmarks.onRemoved,
    api.bookmarks.onChanged,
    api.bookmarks.onMoved,
    api.bookmarks.onChildrenReordered,
    api.bookmarks.onImportEnded,
  ];
  const tabEvents = [
    api.tabs.onCreated,
    api.tabs.onRemoved,
    api.tabs.onUpdated,
    api.tabs.onMoved,
    api.tabs.onActivated,
    api.tabs.onAttached,
    api.tabs.onDetached,
    api.tabs.onReplaced,
    api.windows.onCreated,
    api.windows.onRemoved,
    api.windows.onFocusChanged,
  ];
  bookmarkEvents.forEach((e) => e.addListener(schedule));
  tabEvents.forEach((e) => e.addListener(refreshTabs));
  api.storage.onChanged.addListener(storage);
  void reload();
  refreshTabs();
  storage();
  return () => {
    clearTimeout(timer);
    clearTimeout(tabsTimer);
    bookmarkEvents.forEach((e) => e.removeListener(schedule));
    tabEvents.forEach((e) => e.removeListener(refreshTabs));
    api.storage.onChanged.removeListener(storage);
  };
}
