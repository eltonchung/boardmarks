import { expect, test } from 'vitest';
import { reconcileMetadata, type MetadataIndex } from '../src/utils/metadata';
const index = (folders: Record<string, string>, rootId = 'root'): MetadataIndex => ({
  version: 1,
  rootId,
  folders,
});
test('rename moves metadata and clears orphaned keys', () => {
  expect(
    reconcileMetadata(index({ a: 'old' }), index({ a: 'new' }), { old: { starred: true } }),
  ).toMatchObject({
    metadata: { new: { starred: true, collapsed: false } },
    writes: [['new', { starred: true, collapsed: false }]],
    remove: ['old'],
  });
});
test('same-name sibling reorder keeps metadata with Chrome IDs', () => {
  const result = reconcileMetadata(
    index({ a: 'name0', b: 'name1' }),
    index({ b: 'name0', a: 'name1' }),
    { name0: { starred: true }, name1: { collapsed: true } },
  );
  expect(result.metadata).toEqual({
    name0: { starred: false, collapsed: true },
    name1: { starred: true, collapsed: false },
  });
  expect(result.remove).toEqual([]);
});
test('deleting one same-name folder does not apply its star to the next folder', () => {
  const result = reconcileMetadata(index({ a: 'name0', b: 'name1' }), index({ b: 'name0' }), {
    name0: { starred: true },
    name1: {},
  });
  expect(result.metadata.name0.starred).toBe(false);
  expect(result.remove).toEqual(['name1']);
});
test('recreating a deleted folder starts with clean metadata', () => {
  const result = reconcileMetadata(index({ deleted: 'path' }), index({ created: 'path' }), {
    path: { starred: true, collapsed: true },
  });
  expect(result.metadata.path).toEqual({ starred: false, collapsed: false });
});
test('a new profile reads synced metadata by path', () => {
  expect(
    reconcileMetadata(null, index({ localId: 'shared' }), { shared: { starred: true } }).metadata
      .shared.starred,
  ).toBe(true);
});
test('metadata from another root never migrates via coincident local IDs', () => {
  expect(
    reconcileMetadata(index({ a: 'old' }, 'oldRoot'), index({ a: 'new' }, 'newRoot'), {
      old: { starred: true },
      new: { collapsed: true },
    }),
  ).toMatchObject({ metadata: { new: { starred: false, collapsed: true } }, remove: [] });
});
test('a rename already synced by another device preserves the destination metadata', () => {
  const plan = reconcileMetadata(index({ a: 'old' }), index({ a: 'new' }), {
    new: { starred: true, collapsed: true },
  });
  expect(plan.metadata.new).toEqual({ starred: true, collapsed: true });
  expect(plan.writes).toEqual([]);
});
