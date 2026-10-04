import { test, expect, chromium, type Page, type BrowserContext } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const executablePath = process.env.CHROMIUM_PATH;
test.describe.configure({ mode: 'serial' });
let context: BrowserContext, page: Page, profile: string;
async function addBookmark(title: string, url: string, collection = 'Favorites') {
  await page.getByRole('button', { name: `新增書籤至 ${collection}`, exact: true }).click();
  await page.getByRole('textbox', { name: '名稱', exact: true }).fill(title);
  await page.getByRole('textbox', { name: '網址', exact: true }).fill(url);
  await page.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function folder(label: string, name: string) {
  await page
    .getByRole('button', { name: `新增 ${label}`, exact: true })
    .first()
    .click();
  await page.getByRole('textbox', { name: '名稱', exact: true }).fill(name);
  await page.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function drag(from: ReturnType<Page['locator']>, to: ReturnType<Page['locator']>) {
  // Wait for sortable layout transitions before taking pointer coordinates.
  await from.hover();
  const a = await from.boundingBox(),
    b = await to.boundingBox();
  if (!a || !b) throw new Error('missing drag elements');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 5, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 });
  await page.waitForTimeout(180);
  await page.mouse.up();
  await page.waitForTimeout(250);
}
test.beforeAll(async () => {
  profile = await mkdtemp(path.join(tmpdir(), 'boardmarks-e2e-'));
  context = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: true,
    args: [
      `--disable-extensions-except=${path.resolve('dist')}`,
      `--load-extension=${path.resolve('dist')}`,
    ],
    viewport: { width: 1440, height: 1000 },
  });
  page = context.pages()[0] ?? (await context.newPage());
});
test.afterAll(async () => {
  await context?.close();
  if (profile) await rm(profile, { recursive: true, force: true });
});
test('real MV3 extension: onboarding, bookmarks, drag, duplicate, undo, backup, persistence', async () => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('chrome://newtab/');
  await expect(page.getByRole('heading', { name: '你的連結， 井然有序。' })).toBeVisible();
  await page.getByRole('button', { name: '建立我的工作區' }).click();
  await expect(page.getByRole('heading', { name: 'Favorites', exact: true })).toBeVisible();
  await addBookmark('Example A', 'https://example.com/a');
  await addBookmark('Example B', 'https://example.com/b');
  await folder('Collection', 'Development');
  const dest = page
    .locator('.collection')
    .filter({ has: page.getByRole('heading', { name: 'Development', exact: true }) });
  await drag(
    page.getByRole('button', { name: '拖曳書籤 Example A', exact: true }),
    dest.getByRole('button', { name: '拖曳右側分頁到這裡，或新增書籤' }),
  );
  await expect(dest.getByRole('button', { name: 'Example A', exact: true })).toBeVisible();
  const external = await context.newPage();
  await external.route('https://example.org/**', (route) =>
    route.fulfill({
      body: '<title>Research tab</title><h1>Research</h1>',
      contentType: 'text/html',
    }),
  );
  await external.goto('https://example.org/research');
  await page.bringToFront();
  await expect(
    page.getByRole('button', { name: '拖曳分頁 Research tab', exact: true }),
  ).toBeVisible();
  await drag(
    page.getByRole('button', { name: '拖曳分頁 Research tab', exact: true }),
    dest.getByRole('heading', { name: 'Development', exact: true }),
  );
  await expect(dest.getByRole('button', { name: 'Research tab', exact: true })).toBeVisible();
  expect(external.isClosed()).toBe(false);
  await page.getByRole('button', { name: 'Research tab 選單', exact: true }).click();
  await page.getByRole('menuitem', { name: '刪除書籤', exact: true }).click();
  await expect(dest.getByRole('button', { name: 'Research tab', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '復原', exact: true }).click();
  await expect(dest.getByRole('button', { name: 'Research tab', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '新增書籤至 Development', exact: true }).click();
  await page.getByRole('textbox', { name: '名稱', exact: true }).fill('Duplicate');
  await page
    .getByRole('textbox', { name: '網址', exact: true })
    .fill('https://example.org/research/');
  await page.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '此書籤已存在', exact: true })).toBeVisible();
  await page
    .getByRole('dialog', { name: '此書籤已存在', exact: true })
    .getByRole('button', { name: '取消', exact: true })
    .click();
  await page.keyboard.press('/');
  await page.getByRole('textbox', { name: '搜尋全部書籤' }).fill('Research');
  await expect(page.getByRole('heading', { name: '搜尋結果', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '搜尋全部書籤' }).fill('');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('combobox', { name: '主題', exact: true }).selectOption('dark');
  await page.getByRole('button', { name: '儲存設定', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Research tab', exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出 JSON', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^boardmarks-.*\.json$/);
  await page.getByRole('button', { name: '關閉對話框', exact: true }).click();
  await page.screenshot({ path: 'test-results/workspace-dark.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('real extension: reorder, safe deletion, import, external edits, commands, Save & Close', async () => {
  await page.goto('chrome://newtab/');
  // Chrome IDs and actual order are verified, not just React state.
  await addBookmark('Example C', 'https://example.com/c', 'Development');
  const development = page
    .locator('.collection')
    .filter({ has: page.getByRole('heading', { name: 'Development', exact: true }) });
  await drag(
    page.getByRole('button', { name: '拖曳書籤 Example C', exact: true }),
    development.getByRole('button', { name: 'Example A', exact: true }),
  );
  await expect(development.locator('.bookmark-link').first()).toHaveText('Example C');
  await drag(
    page.getByRole('button', { name: '拖曳書籤 Example C', exact: true }),
    development.getByRole('button', { name: 'Research tab', exact: true }),
  );
  await expect(development.locator('.bookmark-link').last()).toHaveText('Example C');
  await page.getByRole('button', { name: 'Development 選單', exact: true }).click();
  await page.getByRole('menuitem', { name: '刪除 Collection', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '刪除「Development」？' })).toBeVisible();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(development).toBeVisible();
  await page.getByRole('button', { name: 'Development 選單', exact: true }).click();
  await page.getByRole('menuitem', { name: '刪除 Collection', exact: true }).click();
  await page.getByRole('button', { name: '確認刪除', exact: true }).click();
  await expect(development).toHaveCount(0);
  await page.getByRole('button', { name: '復原', exact: true }).click();
  await expect(development.locator('.bookmark-link')).toHaveCount(3);
  await page.getByRole('button', { name: '加上星號 Development', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '取消星號 Development', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  const backup = {
    version: 1,
    spaces: [
      {
        title: 'Imported',
        metadata: { starred: true },
        collections: [
          {
            title: 'Read later',
            metadata: { collapsed: false },
            bookmarks: [{ title: 'Import test', url: 'https://example.com/import' }],
          },
        ],
      },
    ],
  };
  await page.getByLabel('匯入備份檔').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByRole('dialog', { name: '匯入備份預覽' })).toBeVisible();
  await page.getByRole('button', { name: '確認匯入', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Imported 1', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const { rootId } = await chrome.storage.local.get('rootId');
    const [root] = await chrome.bookmarks.getSubTree(rootId);
    const collection = root.children![0].children!.find((n) => n.title === 'Favorites')!;
    await chrome.bookmarks.create({
      parentId: collection.id,
      title: 'Outside edit',
      url: 'https://example.com/external',
    });
  });
  await expect(page.getByRole('button', { name: 'Outside edit', exact: true })).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: '命令選單' })).toBeVisible();
  await page.getByRole('textbox', { name: '搜尋命令或書籤' }).fill('切換深色');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.keyboard.press('Control+k');
  await page.getByRole('textbox', { name: '搜尋命令或書籤' }).fill('切換深色');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const closing = await context.newPage();
  await closing.route('https://example.net/**', (r) =>
    r.fulfill({ body: '<title>Close after saving</title>', contentType: 'text/html' }),
  );
  await closing.goto('https://example.net/save-close');
  await page.bringToFront();
  await page.getByRole('button', { name: '分頁 Close after saving 選單', exact: true }).click();
  await page.getByRole('menuitem', { name: '收藏並關閉', exact: true }).click();
  await page.getByRole('button', { name: '儲存', exact: true }).click();
  await expect.poll(() => closing.isClosed()).toBe(true);
  await expect(
    page.locator('.bookmark-link').filter({ hasText: 'Close after saving' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '收藏視窗 1', exact: true }).click();
  await page.getByRole('checkbox', { name: '建立新的 Collection' }).check();
  await page.getByRole('textbox', { name: 'Collection 名稱', exact: true }).fill('Window snapshot');
  await page.getByRole('button', { name: '儲存', exact: true }).click();
  const snapshot = page
    .locator('.collection')
    .filter({ has: page.getByRole('heading', { name: 'Window snapshot', exact: true }) });
  await expect(snapshot.locator('.bookmark-link')).toHaveCount(1);
  await expect(snapshot.getByRole('button', { name: 'Research tab', exact: true })).toBeVisible();
  await folder('Space', 'Work');
  await folder('Collection', 'Project links');
  await page.getByRole('button', { name: /^Personal \d+$/, exact: true }).click();
  await drag(
    page.getByRole('button', { name: '拖曳書籤 Example B', exact: true }),
    page.getByRole('button', { name: 'Work 0', exact: true }),
  );
  await page
    .getByRole('dialog', { name: '選擇 Collection', exact: true })
    .getByRole('button', { name: 'Project links', exact: true })
    .click();
  await page.getByRole('button', { name: 'Work 1', exact: true }).click();
  await expect(page.locator('.bookmark-link').filter({ hasText: 'Example B' })).toBeVisible();
  await drag(
    page.getByRole('button', { name: '拖曳 Space Work', exact: true }),
    page.getByRole('button', { name: /^Personal \d+$/, exact: true }),
  );
  await expect(page.locator('.space-name').first()).toContainText('Work');
  await page.getByRole('button', { name: /^Personal \d+$/, exact: true }).click();
  await page.getByRole('button', { name: 'Development 選單', exact: true }).click();
  await page.getByRole('menuitem', { name: '重新命名', exact: true }).click();
  await page.getByRole('textbox', { name: '名稱', exact: true }).fill('Engineering');
  await page.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '取消星號 Engineering', exact: true }),
  ).toBeVisible();
  // Reopen the entire browser against the same isolated profile to exercise persistence.
  await context.close();
  context = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: true,
    args: [
      `--disable-extensions-except=${path.resolve('dist')}`,
      `--load-extension=${path.resolve('dist')}`,
    ],
    viewport: { width: 1440, height: 1000 },
  });
  page = context.pages()[0] ?? (await context.newPage());
  await page.goto('chrome://newtab/');
  await page.getByRole('button', { name: /^Personal \d+$/, exact: true }).click();
  await expect(
    page.locator('.bookmark-link').filter({ hasText: 'Close after saving' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '取消星號 Engineering', exact: true }),
  ).toBeVisible();
});
test('large workspace: 10 spaces, 100 collections, 1000 bookmarks, 100 open tabs', async () => {
  test.setTimeout(120000);
  await page.evaluate(async () => {
    const { rootId } = await chrome.storage.local.get('rootId');
    for (let s = 0; s < 10; s++) {
      const space = await chrome.bookmarks.create({ parentId: rootId, title: `Space ${s + 1}` });
      for (let c = 0; c < 10; c++) {
        const collection = await chrome.bookmarks.create({
          parentId: space.id,
          title: `Collection ${c + 1}`,
        });
        for (let b = 0; b < 10; b++)
          await chrome.bookmarks.create({
            parentId: collection.id,
            title: `Reference ${s + 1}-${c + 1}-${b + 1}`,
            url: `https://example.com/${s}/${c}/${b}`,
          });
      }
    }
    for (let i = 0; i < 99; i++)
      await chrome.tabs.create({ url: `about:blank#performance-${i}`, active: false });
  });
  const start = Date.now();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Space 10 100', exact: true })).toBeVisible();
  console.log(`1000-bookmark ready after reload: ${Date.now() - start}ms`);
  await page.getByRole('button', { name: 'Space 1 100', exact: true }).click();
  await expect(page.locator('.bookmark-card')).toHaveCount(100);
  const search = page.getByRole('textbox', { name: '搜尋全部書籤' });
  const searchStart = Date.now();
  await search.fill('Reference 10-10-10');
  await expect(page.locator('.bookmark-card')).toHaveCount(1);
  console.log(`1000-bookmark search including browser automation: ${Date.now() - searchStart}ms`);
  await search.fill('');
  await page.screenshot({ path: 'test-results/large-workspace.png', fullPage: true });
  const all = await page.evaluate(async () => {
    const { rootId } = await chrome.storage.local.get('rootId');
    const [root] = await chrome.bookmarks.getSubTree(rootId);
    return { spaces: root.children!.length, tabs: (await chrome.tabs.query({})).length };
  });
  expect(all.spaces).toBeGreaterThanOrEqual(10);
  expect(all.tabs).toBeGreaterThanOrEqual(100);
});
