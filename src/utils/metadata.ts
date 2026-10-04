import type { Board, Metadata } from '../types';
export interface MetadataIndex {
  version: 1;
  rootId: string;
  folders: Record<string, string>;
}
export function metadataIndex(board: Board): MetadataIndex | null {
  return board.root
    ? {
        version: 1,
        rootId: board.root.id,
        folders: Object.fromEntries(
          board.spaces.flatMap((s) => [s, ...s.collections]).map((n) => [n.id, n.metaKey]),
        ),
      }
    : null;
}
export function readIndex(value: unknown): MetadataIndex | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<MetadataIndex>;
  if (
    v.version !== 1 ||
    typeof v.rootId !== 'string' ||
    !v.folders ||
    typeof v.folders !== 'object' ||
    Array.isArray(v.folders) ||
    !Object.values(v.folders).every((path) => typeof path === 'string')
  )
    return null;
  return v as MetadataIndex;
}
const clean = (meta?: Metadata): Metadata => ({
  starred: meta?.starred === true,
  collapsed: meta?.collapsed === true,
});
export function reconcileMetadata(
  previous: MetadataIndex | null,
  next: MetadataIndex,
  stored: Record<string, Metadata>,
) {
  const old = previous?.rootId === next.rootId ? previous.folders : {};
  const oldPaths = new Set(Object.values(old)),
    currentPaths = new Set(Object.values(next.folders));
  const metadata: Record<string, Metadata> = {};
  const writes: [string, Metadata][] = [];
  for (const [id, path] of Object.entries(next.folders)) {
    const oldPath = old[id];
    // New folders must not inherit the metadata of a deleted folder with the same name.
    const remoteRename =
      oldPath && oldPath !== path && !currentPaths.has(oldPath) && !Object.hasOwn(stored, oldPath);
    const value = clean(
      remoteRename
        ? stored[path]
        : oldPath
          ? stored[oldPath]
          : oldPaths.has(path)
            ? undefined
            : stored[path],
    );
    metadata[path] = value;
    const current = clean(stored[path]);
    if (value.starred !== current.starred || value.collapsed !== current.collapsed)
      writes.push([path, value]);
  }
  return { metadata, writes, remove: [...oldPaths].filter((path) => !currentPaths.has(path)) };
}
