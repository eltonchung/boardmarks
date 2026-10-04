import { api } from '../chrome/api';
import { findRoot } from '../chrome/bookmarks';
import {
  metadataStorageKey,
  readMetadata,
  writeMetadataBatch,
  writeMetadata,
} from '../chrome/storage';
import { parseTree } from '../utils/tree';
import { metadataIndex, readIndex, reconcileMetadata } from '../utils/metadata';
import type { Metadata } from '../types';
const indexKey = 'metadataIndexV1';
function locked<T>(action: () => Promise<T>): Promise<T> {
  return navigator.locks ? navigator.locks.request('boardmarks-metadata', action) : action();
}
export function loadBoardWithMetadata() {
  return locked(async () => {
    const board = parseTree(await findRoot());
    const next = metadataIndex(board);
    if (!next) return { board, metadata: {} };
    const previous = readIndex((await api.storage.local.get(indexKey))[indexKey]);
    const paths = [
      ...new Set([
        ...Object.values(next.folders),
        ...(previous?.rootId === next.rootId ? Object.values(previous.folders) : []),
      ]),
    ];
    const plan = reconcileMetadata(previous, next, await readMetadata(paths, true));
    await writeMetadataBatch(plan.writes);
    if (plan.remove.length)
      await api.storage.sync.remove(await Promise.all(plan.remove.map(metadataStorageKey)));
    if (JSON.stringify(previous) !== JSON.stringify(next))
      await api.storage.local.set({ [indexKey]: next });
    return { board, metadata: plan.metadata };
  });
}
export function patchMetadata(path: string, patch: Metadata) {
  return locked(async () => {
    const current = await readMetadata([path]);
    const value = { ...current[path], ...patch };
    await writeMetadata(path, value);
    return value;
  });
}
