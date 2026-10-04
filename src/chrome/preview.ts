import type { Node } from '../types';
// Development-only browser sandbox. This adapter never accesses actual Chrome bookmarks.
function event() {
  const listeners = new Set<() => void>();
  return {
    addListener: (fn: () => void) => listeners.add(fn),
    removeListener: (fn: () => void) => listeners.delete(fn),
    emit: () => listeners.forEach((fn) => fn()),
  };
}
const changed = event(),
  tabChanged = event(),
  storageChanged = event();
const key = 'boardmarks-preview-v1';
const initial: Node[] = [
  {
    id: '0',
    title: '',
    children: [{ id: '1', parentId: '0', title: 'Bookmarks bar', children: [] }],
  },
];
let tree: Node[] = initial;
try {
  tree = JSON.parse(localStorage.getItem(key) || 'null') ?? initial;
} catch {
  /* corrupt demo data is reset */
}
function all(nodes = tree): Node[] {
  return nodes.flatMap((n) => [n, ...all(n.children ?? [])]);
}
function find(id: string) {
  const n = all().find((n) => n.id === id);
  if (!n) throw new Error('找不到書籤');
  return n;
}
function persist() {
  localStorage.setItem(key, JSON.stringify(tree));
  changed.emit();
}
function reindex(n: Node) {
  n.children?.forEach((c, i) => {
    c.index = i;
  });
}
const store = (area: string) => ({
  remove: async (keys: string | string[]) => {
    const values = JSON.parse(localStorage.getItem(`${key}-${area}`) || '{}');
    for (const name of typeof keys === 'string' ? [keys] : keys) delete values[name];
    localStorage.setItem(`${key}-${area}`, JSON.stringify(values));
    storageChanged.emit();
  },
  get: async (keys?: string | string[] | null) => {
    const values = JSON.parse(localStorage.getItem(`${key}-${area}`) || '{}') as Record<
      string,
      unknown
    >;
    return !keys
      ? values
      : Object.fromEntries(
          (typeof keys === 'string' ? [keys] : keys)
            .filter((k) => k in values)
            .map((k) => [k, values[k]]),
        );
  },
  set: async (data: Record<string, unknown>) => {
    localStorage.setItem(
      `${key}-${area}`,
      JSON.stringify({ ...JSON.parse(localStorage.getItem(`${key}-${area}`) || '{}'), ...data }),
    );
    storageChanged.emit();
  },
});
let tabs: chrome.tabs.Tab[] = [
  {
    id: 101,
    windowId: 1,
    title: 'Chrome for Developers',
    url: 'https://developer.chrome.com/',
    active: true,
    index: 0,
    pinned: false,
    highlighted: true,
    incognito: false,
    selected: true,
    discarded: false,
    autoDiscardable: true,
    groupId: -1,
    frozen: false,
  },
  {
    id: 102,
    windowId: 1,
    title: 'GitHub · Build and ship software',
    url: 'https://github.com/',
    active: false,
    index: 1,
    pinned: false,
    highlighted: false,
    incognito: false,
    selected: false,
    discarded: false,
    autoDiscardable: true,
    groupId: -1,
    frozen: false,
  },
  {
    id: 103,
    windowId: 1,
    title: 'MDN Web Docs',
    url: 'https://developer.mozilla.org/',
    active: false,
    index: 2,
    pinned: false,
    highlighted: false,
    incognito: false,
    selected: false,
    discarded: false,
    autoDiscardable: true,
    groupId: -1,
    frozen: false,
  },
];
// The cast bridges the deliberately small preview API surface; production uses Chrome directly.
export const previewApi = {
  bookmarks: {
    getTree: async () => structuredClone(tree),
    getSubTree: async (id: string) => [structuredClone(find(id))],
    get: async (id: string) => [structuredClone(find(id))],
    getChildren: async (id: string) => structuredClone(find(id).children ?? []),
    create: async (data: { parentId?: string; title?: string; url?: string; index?: number }) => {
      const parent = find(data.parentId ?? '1');
      const node: Node = {
        id: crypto.randomUUID(),
        parentId: parent.id,
        title: data.title ?? '',
        ...(data.url ? { url: data.url } : { children: [] }),
      };
      parent.children ??= [];
      parent.children.splice(data.index ?? parent.children.length, 0, node);
      reindex(parent);
      persist();
      return structuredClone(node);
    },
    update: async (id: string, data: { title?: string; url?: string }) => {
      Object.assign(find(id), data);
      persist();
      return structuredClone(find(id));
    },
    move: async (id: string, to: { parentId?: string; index?: number }) => {
      const n = find(id),
        old = find(n.parentId!),
        dest = find(to.parentId ?? n.parentId!);
      const index =
        to.index !== undefined && old.id === dest.id && (n.index ?? 0) < to.index
          ? to.index - 1
          : to.index;
      old.children = old.children?.filter((x) => x.id !== id);
      reindex(old);
      dest.children ??= [];
      dest.children.splice(index ?? dest.children.length, 0, n);
      n.parentId = dest.id;
      reindex(dest);
      persist();
      return structuredClone(n);
    },
    remove: async (id: string) => {
      const n = find(id),
        p = find(n.parentId!);
      if (n.children?.length) throw new Error('資料夾非空');
      p.children = p.children?.filter((x) => x.id !== id);
      reindex(p);
      persist();
    },
    removeTree: async (id: string) => {
      const n = find(id),
        p = find(n.parentId!);
      p.children = p.children?.filter((x) => x.id !== id);
      reindex(p);
      persist();
    },
    onCreated: changed,
    onRemoved: changed,
    onChanged: changed,
    onMoved: changed,
    onChildrenReordered: changed,
    onImportEnded: changed,
  },
  tabs: {
    create: async (data: { url?: string; active?: boolean }) => {
      if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
    },
    update: async (id: number) => {
      tabs = tabs.map((t) => ({ ...t, active: t.id === id }));
      tabChanged.emit();
    },
    remove: async (id: number) => {
      tabs = tabs.filter((t) => t.id !== id);
      tabChanged.emit();
    },
    get: async (id: number) => {
      const t = tabs.find((t) => t.id === id);
      if (!t) throw new Error('分頁已關閉');
      return { ...t };
    },
    onCreated: tabChanged,
    onRemoved: tabChanged,
    onUpdated: tabChanged,
    onMoved: tabChanged,
    onActivated: tabChanged,
    onAttached: tabChanged,
    onDetached: tabChanged,
    onReplaced: tabChanged,
  },
  windows: {
    getAll: async () => [{ id: 1, focused: true, tabs: [...tabs], type: 'normal' }],
    getCurrent: async () => ({ id: 1 }),
    update: async () => {},
    create: async (data: { url?: string | string[] }) => {
      for (const url of typeof data.url === 'string' ? [data.url] : (data.url ?? []))
        window.open(url, '_blank', 'noopener,noreferrer');
    },
    onCreated: tabChanged,
    onRemoved: tabChanged,
    onFocusChanged: tabChanged,
  },
  storage: { local: store('local'), sync: store('sync'), onChanged: storageChanged },
} as unknown as Pick<typeof chrome, 'bookmarks' | 'tabs' | 'windows' | 'storage'>;
