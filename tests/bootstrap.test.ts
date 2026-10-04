import { expect, test } from 'vitest';
import manifest from '../public/manifest.json';
test('MV3 new tab entry and least privilege permissions', () => {
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.chrome_url_overrides.newtab).toBe('index.html');
  expect(manifest.permissions).toEqual(['bookmarks', 'tabs', 'storage', 'favicon']);
});
