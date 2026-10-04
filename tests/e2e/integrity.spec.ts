import { test as base, expect, type Page } from '@playwright/test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const test = base.extend<{ app: Page }>({
  app: async ({ playwright }, provideApp) => {
    const profile = await mkdtemp(path.join(tmpdir(), 'boardmarks-integrity-'));
    const context = await playwright.chromium.launchPersistentContext(profile, {
      executablePath: process.env.CHROMIUM_PATH,
      headless: true,
      args: [
        `--disable-extensions-except=${path.resolve('dist')}`,
        `--load-extension=${path.resolve('dist')}`,
      ],
      viewport: { width: 1280, height: 720 },
    });
    try {
      const app = context.pages()[0] ?? (await context.newPage());
      await app.goto('chrome://newtab/');
      await app.getByRole('button', { name: '建立我的工作區' }).click();
      await expect(app.getByRole('heading', { name: 'Favorites', exact: true })).toBeVisible();
      await provideApp(app);
    } finally {
      await context.close();
      await rm(profile, { recursive: true, force: true });
    }
  },
});
test('Save Window appends to an existing collection and Copy URL passes the original URL', async ({
  app,
}) => {
  const context = app.context();
  const research = await context.newPage();
  const url = 'https://example.com/research?topic=bookmarks#notes';
  await research.route('https://example.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<title>Existing collection research</title>',
    }),
  );
  await research.goto(url);
  const collectionId = await app.evaluate(async () => {
    const { rootId } = await chrome.storage.local.get('rootId');
    const [root] = await chrome.bookmarks.getSubTree(rootId);
    const id = root.children![0].children![0].id;
    await chrome.bookmarks.create({
      parentId: id,
      title: 'Already saved',
      url: 'https://example.org/old',
    });
    return id;
  });
  await app.bringToFront();
  await app.getByRole('button', { name: '收藏視窗 1', exact: true }).click();
  await expect(app.getByRole('checkbox', { name: '建立新的 Collection' })).not.toBeChecked();
  await app.getByRole('combobox', { name: 'Collection', exact: true }).selectOption(collectionId);
  await app.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(app.getByRole('dialog')).toHaveCount(0);
  await expect(app.locator('.bookmark-link')).toHaveCount(2);
  expect(
    await app.evaluate(
      async (id) => (await chrome.bookmarks.getChildren(id)).map((n) => n.url),
      collectionId,
    ),
  ).toEqual(['https://example.org/old', url]);
  expect(research.isClosed()).toBe(false);
  // Verify the UI boundary without changing the user's system clipboard.
  await app.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: async (value: string) => {
        document.body.dataset.copiedUrl = value;
      },
    });
  });
  await app.getByRole('button', { name: 'Existing collection research 選單', exact: true }).click();
  await app.getByRole('menuitem', { name: '複製網址', exact: true }).click();
  await expect(app.locator('body')).toHaveAttribute('data-copied-url', url);
  await expect(app.getByRole('status').filter({ hasText: '已複製網址' })).toBeVisible();
});
test('empty Spaces appear in search, starred view and the command palette', async ({ app }) => {
  await app.evaluate(async () => {
    const { rootId } = await chrome.storage.local.get('rootId');
    await chrome.bookmarks.create({ parentId: rootId, title: 'Empty space' });
  });
  await expect(app.getByRole('button', { name: 'Empty space 0', exact: true })).toBeVisible();
  await app.getByRole('textbox', { name: '搜尋全部書籤' }).fill('Empty space');
  await app.getByRole('navigation', { name: '符合的 Spaces' }).getByRole('button').click();
  await expect(app.getByRole('heading', { name: 'Empty space', exact: true })).toBeVisible();
  await app.getByRole('button', { name: 'Empty space 選單', exact: true }).click();
  await app.getByRole('menuitem', { name: '加入星號', exact: true }).click();
  await app.getByRole('button', { name: '星號收藏 1', exact: true }).click();
  await expect(app.getByRole('navigation', { name: '符合的 Spaces' })).toContainText('Empty space');
  await app.keyboard.press('Control+k');
  await app.getByRole('textbox', { name: '搜尋命令或書籤' }).fill('Empty space');
  await app.keyboard.press('Enter');
  await expect(app.getByRole('heading', { name: 'Empty space', exact: true })).toBeVisible();
});
test('metadata follows external rename and duplicate-folder reorder, survives Undo, and clears on deletion', async ({
  app,
}) => {
  const ids = await app.evaluate(async () => {
    const { rootId } = await chrome.storage.local.get('rootId');
    const [root] = await chrome.bookmarks.getSubTree(rootId);
    const parentId = root.children![0].id;
    const a = await chrome.bookmarks.create({ parentId, title: 'Twin' });
    const b = await chrome.bookmarks.create({ parentId, title: 'Twin' });
    return { a: a.id, b: b.id, parentId };
  });
  const a = app.locator(`[data-collection="${ids.a}"]`),
    b = app.locator(`[data-collection="${ids.b}"]`);
  await a.getByRole('button', { name: '加上星號 Twin', exact: true }).click();
  await a.getByRole('button', { name: 'Twin 0', exact: true }).click();
  await expect(a.getByRole('button', { name: 'Twin 0', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await app.evaluate(async ({ a, parentId }) => {
    await chrome.bookmarks.move(a, { parentId, index: 3 });
  }, ids);
  await expect(a.getByRole('button', { name: '取消星號 Twin', exact: true })).toBeVisible();
  await expect(b.getByRole('button', { name: '加上星號 Twin', exact: true })).toBeVisible();
  await app.evaluate(async (id) => {
    await chrome.bookmarks.update(id, { title: 'Renamed' });
  }, ids.a);
  await expect(a.getByRole('button', { name: '取消星號 Renamed', exact: true })).toBeVisible();
  await expect(a.getByRole('button', { name: 'Renamed 0', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await a.getByRole('button', { name: 'Renamed 選單', exact: true }).click();
  await app.getByRole('menuitem', { name: '刪除 Collection', exact: true }).click();
  await expect(a).toHaveCount(0);
  await app.getByRole('button', { name: '復原', exact: true }).click();
  await expect(app.getByRole('button', { name: '取消星號 Renamed', exact: true })).toBeVisible();
  const restored = app
    .locator('.collection')
    .filter({ has: app.getByRole('heading', { name: 'Renamed', exact: true }) });
  await expect(restored.getByRole('button', { name: 'Renamed 0', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await restored.getByRole('button', { name: 'Renamed 選單', exact: true }).click();
  await app.getByRole('menuitem', { name: '刪除 Collection', exact: true }).click();
  await expect(restored).toHaveCount(0);
  await app.evaluate(async (parentId) => {
    await chrome.bookmarks.create({ parentId, title: 'Renamed' });
  }, ids.parentId);
  await expect(app.getByRole('button', { name: '加上星號 Renamed', exact: true })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Renamed 0', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
});
test('native bookmark titles roundtrip through downloaded JSON and confirmed import', async ({
  app,
}) => {
  await app.evaluate(async () => {
    const { rootId } = await chrome.storage.local.get('rootId');
    const space = await chrome.bookmarks.create({ parentId: rootId, title: ' Native ' });
    const collection = await chrome.bookmarks.create({ parentId: space.id, title: '' });
    for (const [title, url] of [
      ['', 'https://example.com/empty'],
      ['long'.repeat(200), 'https://example.com/long'],
    ])
      await chrome.bookmarks.create({ parentId: collection.id, title, url });
  });
  await expect(app.getByRole('button', { name: 'Native 2', exact: true })).toBeVisible();
  await app.getByRole('button', { name: '設定', exact: true }).click();
  const pending = app.waitForEvent('download');
  await app.getByRole('button', { name: '匯出 JSON', exact: true }).click();
  const downloaded = await pending;
  const contents = await readFile((await downloaded.path())!, 'utf8');
  const backup = JSON.parse(contents);
  const native = backup.spaces.find((s: { title: string }) => s.title === ' Native ');
  expect(native.collections[0].title).toBe('');
  expect(native.collections[0].bookmarks.map((b: { title: string }) => b.title)).toEqual([
    '',
    'long'.repeat(200),
  ]);
  await app.getByLabel('匯入備份檔').setInputFiles({
    name: 'roundtrip.json',
    mimeType: 'application/json',
    buffer: Buffer.from(contents),
  });
  await app.getByRole('button', { name: '確認匯入', exact: true }).click();
  await expect(app.getByRole('dialog')).toHaveCount(0);
  const imported = await app.evaluate(async () => {
    const { rootId } = await chrome.storage.local.get('rootId');
    const [root] = await chrome.bookmarks.getSubTree(rootId);
    return root
      .children!.filter((s) => s.title === ' Native ')
      .map((s) => s.children![0].children!.map((b) => b.title));
  });
  expect(imported).toEqual([
    ['', 'long'.repeat(200)],
    ['', 'long'.repeat(200)],
  ]);
});
test('collection reorder and keyboard sorting persist in native bookmarks', async ({ app }) => {
  const targetId = await app.evaluate(async () => {
    const { rootId } = await chrome.storage.local.get('rootId');
    const [root] = await chrome.bookmarks.getSubTree(rootId);
    const second = await chrome.bookmarks.create({
      parentId: root.children![0].id,
      title: 'Second',
    });
    await chrome.bookmarks.create({ parentId: root.children![0].id, title: 'Third' });
    return second.id;
  });
  const handle = app.getByRole('button', { name: '拖曳 Collection Third', exact: true });
  await handle.focus();
  await app.keyboard.press('Space');
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  await app.keyboard.press('ArrowUp');
  await expect(app.getByRole('status').filter({ hasText: 'Draggable item' })).toContainText(
    `was moved over droppable area collection:${targetId}.`,
  );
  await app.keyboard.press('Space');
  await expect(app.locator('.collection-title h2')).toHaveText(['Favorites', 'Third', 'Second']);
  await app.reload();
  await expect(app.locator('.collection-title h2')).toHaveText(['Favorites', 'Third', 'Second']);
});
test('foreground/background opening, new-window opening and window activation use native APIs', async ({
  app,
}) => {
  await app
    .context()
    .route('https://example.test/**', (route) =>
      route.fulfill({ body: '<title>Native open target</title>', contentType: 'text/html' }),
    );
  await app.evaluate(async () => {
    const { rootId } = await chrome.storage.local.get('rootId');
    const [root] = await chrome.bookmarks.getSubTree(rootId);
    await chrome.bookmarks.create({
      parentId: root.children![0].children![0].id,
      title: 'Open target',
      url: 'https://example.test/open',
    });
  });
  const link = app.locator('.bookmark-link').filter({ hasText: 'Open target' });
  const tabs = () => app.evaluate(() => chrome.tabs.query({ url: 'https://example.test/open' }));
  await link.click({ modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'] });
  await expect.poll(async () => (await tabs()).length).toBe(1);
  expect((await tabs())[0].active).toBe(false);
  await link.click({ button: 'middle' });
  await expect.poll(async () => (await tabs()).length).toBe(2);
  expect((await tabs()).every((t) => !t.active)).toBe(true);
  await link.click();
  await expect.poll(async () => (await tabs()).length).toBe(3);
  expect((await tabs()).some((t) => t.active)).toBe(true);
  await app.bringToFront();
  await app.getByRole('button', { name: 'Open target 選單', exact: true }).click();
  await app.getByRole('menuitem', { name: '在新視窗開啟', exact: true }).click();
  await expect.poll(async () => new Set((await tabs()).map((t) => t.windowId)).size).toBe(2);
  const ownWindow = await app.evaluate(async () => (await chrome.windows.getCurrent()).id);
  const other = (await tabs()).find((t) => t.windowId !== ownWindow)!;
  await app.bringToFront();
  const row = app.locator(`[data-tab-id="${other.id}"]`);
  await row.locator('.tab-link').click();
  await expect
    .poll(() => app.evaluate(async (id) => (await chrome.windows.get(id)).focused, other.windowId))
    .toBe(true);
  await app.bringToFront();
  await row.getByRole('button', { name: '分頁 Native open target 選單', exact: true }).click();
  await app.getByRole('menuitem', { name: '關閉分頁', exact: true }).click();
  await expect.poll(async () => (await tabs()).length).toBe(3);
});
test('system theme follows media changes; density and panel preferences survive reload', async ({
  app,
}) => {
  await app.emulateMedia({ colorScheme: 'dark' });
  await expect(app.locator('html')).toHaveAttribute('data-theme', 'dark');
  await app.emulateMedia({ colorScheme: 'light' });
  await expect(app.locator('html')).toHaveAttribute('data-theme', 'light');
  const contrast = await app.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const luminance = (hex: string) => {
      const channels = hex
        .trim()
        .slice(1)
        .match(/../g)!
        .map((value) => parseInt(value, 16) / 255)
        .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const text = luminance(css.getPropertyValue('--muted')),
      background = luminance(css.getPropertyValue('--panel'));
    return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await app.screenshot({ path: 'test-results/workspace-light-1280.png', fullPage: true });
  await app.getByRole('button', { name: '設定', exact: true }).click();
  await app.getByRole('combobox', { name: '卡片密度', exact: true }).selectOption('compact');
  await app.getByRole('combobox', { name: '主題', exact: true }).selectOption('dark');
  await app.getByRole('button', { name: '儲存設定', exact: true }).click();
  await expect(app.locator('.app')).toHaveClass(/compact/);
  await app.getByRole('separator', { name: '調整側邊欄寬度' }).focus();
  await app.keyboard.press('ArrowRight');
  await expect(app.getByRole('separator', { name: '調整側邊欄寬度' })).toHaveAttribute(
    'aria-valuenow',
    '230',
  );
  await app.getByRole('button', { name: '收起分頁面板', exact: true }).click();
  await expect(app.locator('.tabs-panel')).toHaveCount(0);
  await app.reload();
  await expect(app.locator('.app')).toHaveClass(/compact/);
  await expect(app.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(app.getByRole('separator', { name: '調整側邊欄寬度' })).toHaveAttribute(
    'aria-valuenow',
    '230',
  );
  await expect(app.locator('.tabs-panel')).toHaveCount(0);
  await app.getByRole('button', { name: '顯示開啟的分頁', exact: true }).click();
  await expect(app.locator('.tabs-panel')).toBeVisible();
  await app.screenshot({ path: 'test-results/workspace-1280.png', fullPage: true });
});
test('dragging at the board edge scrolls and Escape keeps the original bookmark unchanged', async ({
  app,
}) => {
  const id = await app.evaluate(async () => {
    const { rootId } = await chrome.storage.local.get('rootId');
    const [root] = await chrome.bookmarks.getSubTree(rootId);
    const parentId = root.children![0].id;
    const first = await chrome.bookmarks.create({
      parentId: root.children![0].children![0].id,
      title: 'Scroll candidate',
      url: 'https://example.test/scroll',
    });
    for (let c = 0; c < 12; c++) {
      const collection = await chrome.bookmarks.create({ parentId, title: `Long ${c}` });
      for (let b = 0; b < 6; b++)
        await chrome.bookmarks.create({
          parentId: collection.id,
          title: `Long bookmark ${c}-${b}`,
          url: `https://example.test/${c}/${b}`,
        });
    }
    return first.id;
  });
  await expect(app.getByRole('heading', { name: 'Long 11', exact: true })).toBeAttached();
  const before = await app.evaluate(async (id) => (await chrome.bookmarks.get(id))[0], id);
  const source = app.getByRole('button', { name: '拖曳書籤 Scroll candidate', exact: true });
  await source.hover();
  const a = (await source.boundingBox())!,
    board = (await app.locator('.main-board').boundingBox())!;
  await app.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await app.mouse.down();
  await app.mouse.move(a.x + 20, a.y + 10, { steps: 4 });
  await expect(app.locator('.drag-overlay')).toBeVisible();
  await app.mouse.move(board.x + board.width / 2, board.y + board.height - 12, { steps: 15 });
  await expect
    .poll(() => app.locator('.main-board').evaluate((el) => el.scrollTop))
    .toBeGreaterThan(100);
  await app.screenshot({ path: 'test-results/drag-feedback.png' });
  await app.keyboard.press('Escape');
  await app.mouse.up();
  await expect(app.locator('.drag-overlay')).toHaveCount(0);
  const after = await app.evaluate(async (id) => (await chrome.bookmarks.get(id))[0], id);
  expect(after.parentId).toBe(before.parentId);
  expect(after.index).toBe(before.index);
});
test('duplicate choices, move Undo and nonempty Space deletion preserve expected bookmarks', async ({
  app,
}) => {
  await app
    .context()
    .route('https://example.test/**', (route) =>
      route.fulfill({ body: '<title>Duplicate target</title>', contentType: 'text/html' }),
    );
  const ids = await app.evaluate(async () => {
    const { rootId } = await chrome.storage.local.get('rootId');
    const [root] = await chrome.bookmarks.getSubTree(rootId);
    const space = root.children![0],
      collection = space.children![0];
    const other = await chrome.bookmarks.create({ parentId: space.id, title: 'Destination' });
    const bookmark = await chrome.bookmarks.create({
      parentId: collection.id,
      title: 'Duplicate original',
      url: 'https://example.test/duplicate/',
    });
    return { space: space.id, collection: collection.id, other: other.id, bookmark: bookmark.id };
  });
  const add = async () => {
    await app.getByRole('button', { name: '新增書籤至 Favorites', exact: true }).click();
    await app.getByRole('textbox', { name: '名稱', exact: true }).fill('Duplicate copy');
    await app
      .getByRole('textbox', { name: '網址', exact: true })
      .fill('https://example.test/duplicate');
    await app.getByRole('button', { name: '儲存', exact: true }).click();
    await expect(app.getByRole('dialog', { name: '此書籤已存在', exact: true })).toBeVisible();
  };
  await add();
  await app.getByRole('button', { name: '仍然加入', exact: true }).click();
  await expect(app.locator(`[data-collection="${ids.collection}"] .bookmark-card`)).toHaveCount(2);
  await add();
  await app.getByRole('button', { name: '開啟既有書籤', exact: true }).click();
  await expect
    .poll(() =>
      app.evaluate(
        async () => (await chrome.tabs.query({ url: 'https://example.test/duplicate/' })).length,
      ),
    )
    .toBe(1);
  await app.bringToFront();
  await expect(app.locator(`[data-collection="${ids.collection}"] .bookmark-card`)).toHaveCount(2);
  await app.getByRole('button', { name: 'Duplicate original 選單', exact: true }).click();
  await app.getByRole('menuitem', { name: '移動', exact: true }).click();
  await app.getByRole('combobox', { name: 'Collection', exact: true }).selectOption(ids.other);
  await app.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(app.locator(`[data-collection="${ids.other}"] .bookmark-card`)).toHaveCount(1);
  await app.getByRole('button', { name: '復原', exact: true }).click();
  await expect
    .poll(() =>
      app.evaluate(async (id) => (await chrome.bookmarks.get(id))[0].parentId, ids.bookmark),
    )
    .toBe(ids.collection);
  await app.getByRole('button', { name: 'Personal 選單', exact: true }).click();
  await app.getByRole('menuitem', { name: '刪除 Space', exact: true }).click();
  const dialog = app.getByRole('dialog', { name: '刪除「Personal」？', exact: true });
  await expect(dialog).toContainText('2 個資料夾、2 個書籤');
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(app.getByRole('heading', { name: 'Personal', exact: true })).toBeVisible();
  await app.getByRole('button', { name: 'Personal 選單', exact: true }).click();
  await app.getByRole('menuitem', { name: '刪除 Space', exact: true }).click();
  await app.getByRole('button', { name: '確認刪除', exact: true }).click();
  await expect(app.locator('.space-name')).toHaveCount(0);
  await app.getByRole('button', { name: '復原', exact: true }).click();
  await expect(app.getByRole('heading', { name: 'Personal', exact: true })).toBeVisible();
  await expect(app.locator('.bookmark-card')).toHaveCount(2);
});

test('font sizes preview, cancel, persist and keep compact cards readable', async ({ app }) => {
  await app.setViewportSize({ width: 1920, height: 900 });
  await app.evaluate(async () => {
    const { rootId } = await chrome.storage.local.get('rootId');
    const [root] = await chrome.bookmarks.getSubTree(rootId);
    const space = root.children![0];
    await chrome.bookmarks.update(space.id, { title: '我的工作空間' });
    await chrome.bookmarks.update(space.children![0].id, { title: '每天常用' });
    for (const title of [
      '收件匣 · 工作郵件',
      '專案進度與待辦事項',
      '設計文件 Design Docs',
      '團隊知識庫 Knowledge Base',
    ])
      await chrome.bookmarks.create({
        parentId: space.children![0].id,
        title,
        url: `https://example.test/${encodeURIComponent(title)}`,
      });
    const collection = await chrome.bookmarks.create({
      parentId: space.id,
      title: '參考資料與開發工具',
    });
    for (const title of [
      'Chrome Developers',
      'TypeScript Handbook',
      'React Documentation',
      '長標題測試：每週工作計畫與重要專案參考資料',
    ])
      await chrome.bookmarks.create({
        parentId: collection.id,
        title,
        url: `https://example.test/${encodeURIComponent(title)}`,
      });
    const { settings } = await chrome.storage.sync.get('settings');
    await chrome.storage.sync.set({ settings: { ...settings, theme: 'dark' } });
  });
  const cards = app.locator('.bookmark-link');
  await expect(cards).toHaveCount(8);
  const unlabeledButtons = () =>
    app
      .locator('button')
      .evaluateAll((buttons) =>
        buttons
          .filter(
            (button) =>
              !button.getAttribute('aria-label')?.trim() || !button.getAttribute('title')?.trim(),
          )
          .map((button) => button.outerHTML),
      );
  expect(await unlabeledButtons()).toEqual([]);
  await expect(cards.first()).toHaveCSS('font-size', '16px');
  await expect(app.locator('.collection-title h2').first()).toHaveCSS('font-size', '18px');
  await expect(app.locator('.tab-link').first()).toHaveCSS('font-size', '18px');
  await app.screenshot({ path: 'test-results/font-standard-1920.png' });
  await app.getByRole('button', { name: '設定', exact: true }).click();
  const size = app.getByRole('combobox', { name: '字體大小', exact: true });
  await size.selectOption('18');
  expect(await unlabeledButtons()).toEqual([]);
  await expect(app.getByLabel('字體大小預覽', { exact: true }).locator('span')).toHaveCSS(
    'font-size',
    '18px',
  );
  await app.getByRole('button', { name: '取消', exact: true }).click();
  await expect(cards.first()).toHaveCSS('font-size', '16px');
  for (const value of ['14', '18']) {
    await app.getByRole('button', { name: '設定', exact: true }).click();
    await size.selectOption(value);
    await app.getByRole('combobox', { name: '卡片密度', exact: true }).selectOption('compact');
    if (value === '18') await app.screenshot({ path: 'test-results/font-settings.png' });
    await app.getByRole('button', { name: '儲存設定', exact: true }).click();
    await app.reload();
    await expect(cards.first()).toHaveCSS('font-size', `${value}px`);
    await expect(app.locator('.tab-link').first()).toHaveCSS('font-size', '18px');
    expect(
      await app.evaluate(async () => (await chrome.storage.sync.get('settings')).settings.fontSize),
    ).toBe(Number(value));
  }
  for (const width of [1280, 1000, 768]) {
    await app.setViewportSize({ width, height: 800 });
    expect(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(
      await app.locator('.main-board').evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    if (width === 1280) await app.screenshot({ path: 'test-results/font-large-1280.png' });
  }
  await app.getByRole('button', { name: '設定', exact: true }).click();
  await expect(size).toHaveValue('18');
  await app.getByRole('combobox', { name: '主題', exact: true }).selectOption('light');
  await app.getByRole('button', { name: '儲存設定', exact: true }).click();
  await app.setViewportSize({ width: 1280, height: 800 });
  await app.screenshot({ path: 'test-results/font-large-light-1280.png' });
});

test('large-font context menus stay inside short viewports and support keyboard dismissal', async ({
  app,
}) => {
  await app.setViewportSize({ width: 1280, height: 480 });
  await app.evaluate(async () => {
    const { rootId } = await chrome.storage.local.get('rootId');
    const [root] = await chrome.bookmarks.getSubTree(rootId);
    await chrome.bookmarks.create({
      parentId: root.children![0].children![0].id,
      title: 'Menu edge case',
      url: 'https://example.test/menu',
    });
    const { settings } = await chrome.storage.sync.get('settings');
    await chrome.storage.sync.set({ settings: { ...settings, fontSize: 18 } });
  });
  const trigger = app.getByRole('button', { name: 'Menu edge case 選單', exact: true });
  await expect(app.locator('.bookmark-link')).toHaveCSS('font-size', '18px');
  await trigger.click();
  const menu = app.getByRole('menu');
  await expect(menu).toBeVisible();
  const fits = async () =>
    menu.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return (
        rect.top >= 7 &&
        rect.left >= 7 &&
        rect.bottom <= innerHeight - 7 &&
        rect.right <= innerWidth - 7
      );
    });
  await expect.poll(fits).toBe(true);
  await app.keyboard.press('End');
  await expect(app.getByRole('menuitem', { name: '刪除書籤', exact: true })).toBeFocused();
  await app.keyboard.press('Home');
  await expect(app.getByRole('menuitem', { name: '開啟', exact: true })).toBeFocused();
  await app.setViewportSize({ width: 700, height: 240 });
  await expect.poll(fits).toBe(true);
  await app.keyboard.press('End');
  await expect(app.getByRole('menuitem', { name: '刪除書籤', exact: true })).toBeInViewport();
  await app.screenshot({ path: 'test-results/menu-short-viewport.png' });
  await app.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await app.keyboard.press('Tab');
  await expect(menu).toHaveCount(0);
  await expect(app.locator('.bookmark-link')).toHaveCount(1);
});

test('right panel font controls persist independently and both palettes keep readable contrast', async ({
  app,
}) => {
  await app.setViewportSize({ width: 1440, height: 900 });
  await app.evaluate(async () => {
    const { rootId } = await chrome.storage.local.get('rootId');
    const [root] = await chrome.bookmarks.getSubTree(rootId);
    const space = root.children![0];
    await chrome.bookmarks.update(space.id, { title: '我的工作空間' });
    await chrome.bookmarks.update(space.children![0].id, { title: '每天常用' });
    for (const title of ['收件匣 · 工作郵件', '專案待辦事項', '設計文件 Design Docs'])
      await chrome.bookmarks.create({
        parentId: space.children![0].id,
        title,
        url: `https://example.test/${encodeURIComponent(title)}`,
      });
    for (const [title, names] of [
      ['開發工具', ['React Documentation', 'Chrome Developers', 'TypeScript Handbook']],
      ['閱讀與靈感', ['設計參考', '每週閱讀清單']],
    ] as const) {
      const collection = await chrome.bookmarks.create({ parentId: space.id, title });
      for (const name of names)
        await chrome.bookmarks.create({
          parentId: collection.id,
          title: name,
          url: `https://example.test/${encodeURIComponent(name)}`,
        });
    }
  });
  await app.context().route('https://example.test/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<meta charset="utf-8"><title>${decodeURIComponent(new URL(route.request().url()).pathname.slice(1))}</title>`,
    }),
  );
  for (const title of [
    '工作郵件 Outlook',
    '專案進度與每週計畫',
    'React Documentation',
    '團隊知識庫',
  ]) {
    const tab = await app.context().newPage();
    await tab.goto(`https://example.test/${encodeURIComponent(title)}`);
  }
  await app.bringToFront();
  const main = app.locator('.bookmark-link').first();
  const tab = app.locator('.tab-link').first();
  await expect(tab).toHaveCSS('font-size', '18px');
  await app.getByRole('button', { name: '放大分頁字體', exact: true }).click();
  await expect(tab).toHaveCSS('font-size', '20px');
  await app.getByRole('button', { name: '放大分頁字體', exact: true }).click();
  await expect(tab).toHaveCSS('font-size', '22px');
  await expect(main).toHaveCSS('font-size', '16px');
  await expect(app.getByRole('button', { name: '放大分頁字體', exact: true })).toBeDisabled();
  await app.reload();
  await expect(tab).toHaveCSS('font-size', '22px');
  await app.getByRole('button', { name: '縮小分頁字體', exact: true }).click();
  await expect(tab).toHaveCSS('font-size', '20px');
  await app.getByRole('button', { name: '設定', exact: true }).click();
  const panelSize = app.getByRole('combobox', { name: '右側分頁字體', exact: true });
  await expect(panelSize).toHaveValue('20');
  await panelSize.selectOption('16');
  await expect(app.getByLabel('右側分頁字體預覽').locator('span')).toHaveCSS('font-size', '16px');
  await app.getByRole('button', { name: '取消', exact: true }).click();
  await expect(tab).toHaveCSS('font-size', '20px');
  for (const size of ['16', 'inherit', '22']) {
    await app.getByRole('button', { name: '設定', exact: true }).click();
    await app.getByRole('combobox', { name: '字體大小', exact: true }).selectOption('14');
    await panelSize.selectOption(size);
    await app.getByRole('button', { name: '儲存設定', exact: true }).click();
    await app.reload();
    await expect(main).toHaveCSS('font-size', '14px');
    await expect(tab).toHaveCSS('font-size', `${size === 'inherit' ? 14 : size}px`);
  }
  for (const theme of ['dark', 'light']) {
    await app.getByRole('button', { name: '設定', exact: true }).click();
    await app.getByRole('combobox', { name: '字體大小', exact: true }).selectOption('16');
    await app.getByRole('combobox', { name: '主題', exact: true }).selectOption(theme);
    await app.getByRole('button', { name: '儲存設定', exact: true }).click();
    await expect(app.locator('html')).toHaveAttribute('data-theme', theme);
    const textColor = theme === 'dark' ? 'rgb(241, 244, 255)' : 'rgb(32, 44, 72)';
    await expect(main).toHaveCSS('color', textColor);
    await expect(tab).toHaveCSS('color', textColor);
    const contrasts = await app.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      const luminance = (name: string) => {
        let hex = css.getPropertyValue(name).trim().slice(1);
        if (hex.length === 3) hex = [...hex].map((x) => x + x).join('');
        const values = hex
          .match(/../g)!
          .map((x) => parseInt(x, 16) / 255)
          .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
        return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
      };
      return [
        ['--text', '--surface'],
        ['--muted', '--panel'],
        ['--accent', '--accent-soft'],
        ['--teal', '--bg'],
        ['--amber', '--bg'],
      ].map(([a, b]) => {
        const x = luminance(a),
          y = luminance(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
      });
    });
    for (const ratio of contrasts) expect(ratio).toBeGreaterThanOrEqual(4.5);
    await app.screenshot({ path: `test-results/palette-${theme}-1.0.4.png` });
  }
  await app.setViewportSize({ width: 1000, height: 800 });
  expect(
    await app.locator('.tabs-font-controls').evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  expect(await app.locator('.tabs-panel').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
});

test('left sidebar font controls resize search and navigation independently and persist', async ({
  app,
}) => {
  await app.setViewportSize({ width: 1440, height: 900 });
  await app.evaluate(async () => {
    const { rootId } = await chrome.storage.local.get('rootId');
    const [root] = await chrome.bookmarks.getSubTree(rootId);
    const personal = root.children![0];
    await chrome.bookmarks.update(personal.id, { title: '個人收藏' });
    for (const title of ['工作專案', '閱讀與靈感', '稍後處理'])
      await chrome.bookmarks.create({ parentId: rootId, title });
    await chrome.bookmarks.create({
      parentId: personal.children![0].id,
      title: '工作文件與常用連結',
      url: 'https://example.test/sidebar',
    });
  });
  const nav = app.getByRole('button', { name: '所有收藏 1', exact: true });
  const search = app.getByRole('textbox', { name: '搜尋全部書籤', exact: true });
  const space = app.locator('.space-name').first();
  const main = app.locator('.bookmark-link').first();
  const right = app.locator('.tab-link').first();
  await expect(nav).toHaveCSS('font-size', '18px');
  await expect(search).toHaveCSS('font-size', '18px');
  await app.getByRole('button', { name: '放大左側字體', exact: true }).click();
  await expect(nav).toHaveCSS('font-size', '20px');
  await app.getByRole('button', { name: '放大左側字體', exact: true }).click();
  await expect(nav).toHaveCSS('font-size', '22px');
  await expect(search).toHaveCSS('font-size', '22px');
  await expect(space).toHaveCSS('font-size', '22px');
  await expect(main).toHaveCSS('font-size', '16px');
  await expect(right).toHaveCSS('font-size', '18px');
  await expect(app.getByRole('button', { name: '放大左側字體', exact: true })).toBeDisabled();
  await app.reload();
  await expect(nav).toHaveCSS('font-size', '22px');
  await app.getByRole('button', { name: '縮小左側字體', exact: true }).click();
  await expect(nav).toHaveCSS('font-size', '20px');
  await app.getByRole('button', { name: '設定', exact: true }).click();
  const size = app.getByRole('combobox', { name: '左側側欄字體', exact: true });
  await expect(size).toHaveValue('20');
  await size.selectOption('16');
  await expect(app.getByLabel('左側側欄字體預覽').locator('span')).toHaveCSS('font-size', '16px');
  await app.getByRole('button', { name: '取消', exact: true }).click();
  await expect(nav).toHaveCSS('font-size', '20px');
  for (const value of ['16', 'inherit', '22']) {
    await app.getByRole('button', { name: '設定', exact: true }).click();
    await size.selectOption(value);
    await app.getByRole('combobox', { name: '字體大小', exact: true }).selectOption('14');
    await app.getByRole('combobox', { name: '右側分頁字體', exact: true }).selectOption('20');
    await app.getByRole('combobox', { name: '主題', exact: true }).selectOption('dark');
    await app.getByRole('button', { name: '儲存設定', exact: true }).click();
    await app.reload();
    await expect(nav).toHaveCSS('font-size', `${value === 'inherit' ? 14 : value}px`);
    await expect(search).toHaveCSS('font-size', `${value === 'inherit' ? 14 : value}px`);
    await expect(main).toHaveCSS('font-size', '14px');
    await expect(right).toHaveCSS('font-size', '20px');
  }
  await app.screenshot({ path: 'test-results/sidebar-large-1.0.5.png' });
  for (const width of [1280, 1000, 768]) {
    await app.setViewportSize({ width, height: 800 });
    expect(await app.locator('.sidebar').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    expect(
      await app
        .locator('.sidebar-font-controls')
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
  await app.setViewportSize({ width: 1280, height: 800 });
  await app.getByRole('button', { name: '設定', exact: true }).click();
  await app.getByRole('slider', { name: /側邊欄寬度/ }).fill('180');
  await app.getByRole('button', { name: '儲存設定', exact: true }).click();
  expect(await app.locator('.sidebar').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await app.screenshot({ path: 'test-results/sidebar-narrow-1.0.5.png' });
});

test('short Windows-style viewport keeps Spaces reachable and panel toggle clear of text', async ({
  app,
}) => {
  await app.setViewportSize({ width: 1280, height: 494 });
  await app.evaluate(async () => {
    const { settings } = await chrome.storage.sync.get('settings');
    await chrome.storage.sync.set({
      settings: { ...settings, sidebarFontSize: 16, showTabs: false, theme: 'dark' },
    });
  });
  const personal = app.getByRole('button', { name: 'Personal 0', exact: true });
  await expect(app.locator('.tabs-panel')).toHaveCount(0);
  await expect(personal).toBeInViewport({ ratio: 1 });
  await personal.click();
  const overlaps = await app.evaluate(() => {
    const a = document.querySelector('.board-heading > .primary')!.getBoundingClientRect();
    const b = document.querySelector('.restore-panel')!.getBoundingClientRect();
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  });
  expect(overlaps).toBe(false);
  await app.screenshot({ path: 'test-results/short-viewport-1.0.6.png' });
  await app.evaluate(async () => {
    const { rootId } = await chrome.storage.local.get('rootId');
    for (let i = 1; i <= 15; i++)
      await chrome.bookmarks.create({ parentId: rootId, title: `Space ${i}` });
    const { settings } = await chrome.storage.sync.get('settings');
    await chrome.storage.sync.set({ settings: { ...settings, sidebarFontSize: 22 } });
  });
  for (const height of [494, 360]) {
    await app.setViewportSize({ width: 1280, height });
    const last = app.getByRole('button', { name: 'Space 15 0', exact: true });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport({ ratio: 1 });
    await last.click();
    await expect(app.getByRole('heading', { name: 'Space 15', exact: true })).toBeVisible();
    await app.getByRole('button', { name: '設定', exact: true }).click();
    await expect(app.getByRole('dialog', { name: '設定', exact: true })).toBeVisible();
    await app.keyboard.press('Escape');
    await app.keyboard.press('/');
    const search = app.getByRole('textbox', { name: '搜尋全部書籤' });
    await expect(search).toBeFocused();
    await expect(search).toBeInViewport({ ratio: 1 });
    expect(await app.locator('.sidebar').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
  }
  await app.getByRole('button', { name: '顯示開啟的分頁', exact: true }).click();
  await expect(app.locator('.tab-link').first()).toBeInViewport({ ratio: 1 });
  await expect(app.getByRole('button', { name: '設定', exact: true })).toBeInViewport({ ratio: 1 });
  await app.screenshot({ path: 'test-results/short-both-panels-1.0.6.png' });
});

test('Toby import previews omissions, cancels safely, preserves data and survives reload', async ({
  app,
}) => {
  const payload = {
    version: 3,
    lists: [
      {
        title: '工作',
        labels: ['研究'],
        cards: [
          {
            title: 'Original title',
            customTitle: '自訂名稱',
            customDescription: 'Extra description',
            url: 'https://example.com/docs?q=1#section',
          },
          {
            title: 'New note',
            customTitle: '',
            customDescription: 'Note content',
            url: '/note.html',
          },
          {
            title: 'Unsafe URL',
            customTitle: '',
            customDescription: '',
            url: 'javascript:alert(1)',
          },
          { title: 'Second', customTitle: '', customDescription: '', url: 'https://example.org/' },
        ],
      },
      { title: '空分類', cards: [], labels: [] },
    ],
  };
  const snapshot = () =>
    app.evaluate(async () => {
      const { rootId } = await chrome.storage.local.get('rootId');
      return (await chrome.bookmarks.getSubTree(rootId))[0];
    });
  const before = await snapshot();
  async function selectFile() {
    await app.getByRole('button', { name: '設定', exact: true }).click();
    await app.getByLabel('匯入備份檔').setInputFiles({
      name: 'toby-export.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(payload)),
    });
  }
  await selectFile();
  const dialog = app.getByRole('dialog', { name: '匯入備份預覽' });
  await expect(dialog).toContainText('來源：Toby');
  await expect(dialog.locator('.import-counts')).toHaveText('1Spaces2Collections2書籤');
  const notices = dialog.getByRole('note', { name: '匯入限制' });
  await expect(notices).toContainText('1 張 Toby 筆記卡片');
  await expect(notices).toContainText('1 張卡片的網址');
  await expect(notices).toContainText('1 個書籤含自訂說明');
  await expect(notices).toContainText('1 個分類標籤');
  await expect(notices).toHaveCSS('font-size', '16px');
  await app.setViewportSize({ width: 1280, height: 900 });
  await app.screenshot({ path: 'test-results/toby-import-preview-1.0.7.png' });
  await app.setViewportSize({ width: 1280, height: 494 });
  await dialog.getByRole('button', { name: '取消', exact: true }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole('button', { name: '取消', exact: true })).toBeInViewport({
    ratio: 1,
  });
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  expect(await snapshot()).toEqual(before);
  await selectFile();
  await dialog.getByRole('button', { name: '確認匯入', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await app.reload();
  await expect(app.getByRole('button', { name: 'Toby 匯入 2', exact: true })).toBeVisible();
  const after = await snapshot();
  expect(after.children!.filter((s) => s.title !== 'Toby 匯入')).toEqual(before.children);
  const collections = after.children!.find((s) => s.title === 'Toby 匯入')!.children!;
  expect(
    collections.map((c) => ({
      title: c.title,
      bookmarks: c.children!.map((b) => ({ title: b.title, url: b.url })),
    })),
  ).toEqual([
    {
      title: '工作',
      bookmarks: [
        { title: '自訂名稱', url: 'https://example.com/docs?q=1#section' },
        { title: 'Second', url: 'https://example.org/' },
      ],
    },
    { title: '空分類', bookmarks: [] },
  ]);
});

test('local Toby export imports exact collection and bookmark contents in isolated Chrome', async ({
  app,
}) => {
  test.skip(
    !process.env.TOBY_IMPORT_FILE,
    'Optional local export; private contents are never checked in.',
  );
  const contents = await readFile(process.env.TOBY_IMPORT_FILE!, 'utf8');
  const source = JSON.parse(contents) as {
    lists: { title: string; cards: { title: string; customTitle: string; url: string }[] }[];
  };
  const expected = source.lists.map((c) => ({
    title: c.title,
    bookmarks: c.cards
      .filter((b) => /^https?:/.test(b.url))
      .map((b) => ({ title: b.customTitle || b.title, url: new URL(b.url).href })),
  }));
  await app.getByRole('button', { name: '設定', exact: true }).click();
  await app.getByLabel('匯入備份檔').setInputFiles({
    name: 'toby-export.json',
    mimeType: 'application/json',
    buffer: Buffer.from(contents),
  });
  const preview = app.getByRole('dialog', { name: '匯入備份預覽' });
  await expect(preview.locator('.import-counts')).toHaveText(
    `1Spaces${expected.length}Collections${expected.reduce((n, c) => n + c.bookmarks.length, 0)}書籤`,
  );
  await expect(preview.getByRole('note', { name: '匯入限制' })).toContainText('1 張 Toby 筆記卡片');
  await expect(preview.getByRole('note', { name: '匯入限制' })).toContainText(
    '12 個書籤含自訂說明',
  );
  await preview.getByRole('button', { name: '確認匯入', exact: true }).click();
  await expect(preview).toHaveCount(0);
  await app.reload();
  await expect(app.getByRole('button', { name: 'Toby 匯入 41', exact: true })).toBeVisible();
  const actual = await app.evaluate(async () => {
    const { rootId } = await chrome.storage.local.get('rootId');
    const [root] = await chrome.bookmarks.getSubTree(rootId);
    return root
      .children!.find((s) => s.title === 'Toby 匯入')!
      .children!.map((c) => ({
        title: c.title,
        bookmarks: c.children!.map((b) => ({ title: b.title, url: b.url })),
      }));
  });
  expect(actual).toEqual(expected);
});

test('left panel collapses, remembers state and restores search and width', async ({ app }) => {
  await app.evaluate(async () => {
    const { settings } = await chrome.storage.sync.get('settings');
    await chrome.storage.sync.set({ settings: { ...settings, sidebarWidth: 300, theme: 'dark' } });
  });
  await expect(app.locator('.sidebar')).toHaveCSS('width', '300px');
  const expandedWidth = (await app.locator('.main-board').boundingBox())!.width;
  await app.getByRole('button', { name: '收合左側面板', exact: true }).click();
  await expect(app.locator('.sidebar')).toBeHidden();
  await expect(app.getByRole('separator', { name: '調整側邊欄寬度', exact: true })).toHaveCount(0);
  expect((await app.locator('.main-board').boundingBox())!.width).toBeGreaterThan(
    expandedWidth + 240,
  );
  await app.reload();
  await expect(app.getByRole('button', { name: '展開左側面板', exact: true })).toBeVisible();
  await app.getByRole('button', { name: '設定', exact: true }).click();
  await expect(app.getByRole('dialog', { name: '設定', exact: true })).toBeVisible();
  await app.keyboard.press('Escape');
  await app.keyboard.press('/');
  await expect(app.getByRole('textbox', { name: '搜尋全部書籤' })).toBeFocused();
  await expect(app.locator('.sidebar')).toHaveCSS('width', '300px');
  await app.getByRole('button', { name: '收合左側面板', exact: true }).click();
  await app.getByRole('button', { name: '搜尋書籤', exact: true }).click();
  await expect(app.getByRole('textbox', { name: '搜尋全部書籤' })).toBeFocused();
  await app.getByRole('button', { name: '收合左側面板', exact: true }).click();
  for (const showTabs of [true, false]) {
    await app.evaluate(async (showTabs) => {
      const { settings } = await chrome.storage.sync.get('settings');
      await chrome.storage.sync.set({ settings: { ...settings, showTabs } });
    }, showTabs);
    for (const width of [1280, 1000, 768]) {
      await app.setViewportSize({ width, height: 494 });
      await expect(app.getByRole('button', { name: '展開左側面板', exact: true })).toBeInViewport({
        ratio: 1,
      });
      await expect(app.getByRole('button', { name: '設定', exact: true })).toBeInViewport({
        ratio: 1,
      });
      expect(
        await app.locator('.workspace').evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      expect((await app.locator('.main-board').boundingBox())!.width).toBeGreaterThan(600);
    }
  }
  await app.setViewportSize({ width: 1280, height: 720 });
  await app.screenshot({ path: 'test-results/sidebar-collapsed-1.0.8.png' });
  await app.getByRole('button', { name: '展開左側面板', exact: true }).click();
  await expect(app.locator('.sidebar')).toHaveCSS('width', '300px');
  await app.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
  await app.getByRole('button', { name: '切換左側面板', exact: true }).click();
  await expect(app.locator('.sidebar')).toBeHidden();
});

test('direct title and card dragging reorders both ways, moves across collections and does not open links', async ({
  app,
}) => {
  const ids = await app.evaluate(async () => {
    const { rootId } = await chrome.storage.local.get('rootId');
    const [root] = await chrome.bookmarks.getSubTree(rootId);
    const space = root.children![0];
    const a = space.children![0];
    await chrome.bookmarks.update(a.id, { title: 'Alpha' });
    const b = await chrome.bookmarks.create({ parentId: space.id, title: 'Beta' });
    await chrome.bookmarks.create({ parentId: space.id, title: 'Gamma' });
    for (const title of ['One', 'Two', 'Three', 'Four'])
      await chrome.bookmarks.create({
        parentId: a.id,
        title,
        url: `https://example.test/${title}`,
      });
    const { settings } = await chrome.storage.sync.get('settings');
    await chrome.storage.sync.set({ settings: { ...settings, showTabs: false, theme: 'dark' } });
    return { a: a.id, b: b.id };
  });
  await expect(app.locator('.collection-title h2')).toHaveText(['Alpha', 'Beta', 'Gamma']);
  async function drag(
    from: ReturnType<Page['locator']>,
    to: ReturnType<Page['locator']>,
    cancel = false,
  ) {
    await from.hover();
    const a = (await from.boundingBox())!,
      b = (await to.boundingBox())!;
    await app.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await app.mouse.down();
    await app.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 6, { steps: 3 });
    await expect(app.locator('.drag-overlay')).toBeVisible();
    await app.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 });
    await app.waitForTimeout(200);
    if (await app.locator('.collection.sort-before, .collection.sort-after').count())
      await app.screenshot({ path: 'test-results/sorting-in-progress-1.0.8.png' });
    if (cancel) await app.keyboard.press('Escape');
    await app.mouse.up();
    await expect(app.locator('.drag-overlay')).toHaveCount(0);
    await app.waitForTimeout(250);
  }
  const heading = (title: string) => app.locator('.collection-title').filter({ hasText: title });
  const card = (title: string) => app.getByRole('button', { name: title, exact: true });
  const aCards = app.locator(`[data-collection="${ids.a}"] .bookmark-link span`);
  const tabCount = await app.evaluate(async () => (await chrome.tabs.query({})).length);
  await drag(heading('Gamma'), heading('Alpha'));
  await expect(app.locator('.collection-title h2')).toHaveText(['Gamma', 'Alpha', 'Beta']);
  await drag(heading('Gamma'), heading('Beta'));
  await expect(app.locator('.collection-title h2')).toHaveText(['Alpha', 'Beta', 'Gamma']);
  await expect(heading('Alpha')).toHaveAttribute('aria-expanded', 'true');
  await drag(card('Three'), card('One'));
  await expect(aCards).toHaveText(['Three', 'One', 'Two', 'Four']);
  await drag(card('Three'), card('Four'));
  await expect(aCards).toHaveText(['One', 'Two', 'Four', 'Three']);
  await drag(card('Two'), heading('Beta'));
  await expect(aCards).toHaveText(['One', 'Four', 'Three']);
  await expect(app.locator(`[data-collection="${ids.b}"] .bookmark-link span`)).toHaveText(['Two']);
  await drag(card('Three'), card('One'), true);
  await expect(aCards).toHaveText(['One', 'Four', 'Three']);
  expect(await app.evaluate(async () => (await chrome.tabs.query({})).length)).toBe(tabCount);
  await heading('Alpha').click();
  await expect(heading('Alpha')).toHaveAttribute('aria-expanded', 'false');
  await heading('Alpha').click();
  await expect(heading('Alpha')).toHaveAttribute('aria-expanded', 'true');
  await app.reload();
  await expect(app.locator('.collection-title h2')).toHaveText(['Alpha', 'Beta', 'Gamma']);
  await expect(aCards).toHaveText(['One', 'Four', 'Three']);
  await app.screenshot({ path: 'test-results/direct-sort-1.0.8.png' });
});

async function dragSideRow(
  app: Page,
  from: ReturnType<Page['locator']>,
  to: ReturnType<Page['locator']>,
  cancel = false,
) {
  await from.hover();
  const a = (await from.boundingBox())!,
    b = (await to.boundingBox())!;
  await app.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await app.mouse.down();
  await app.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 6, { steps: 3 });
  await expect(app.locator('.drag-overlay')).toBeVisible();
  await app.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 });
  await app.waitForTimeout(200);
  if (cancel) await app.keyboard.press('Escape');
  await app.mouse.up();
  await expect(app.locator('.drag-overlay')).toHaveCount(0);
  await app.waitForTimeout(250);
}

test('side panel rows: Space text and icon drag without changing selection; clicks and menus work', async ({
  app,
}) => {
  await app.evaluate(async () => {
    const { rootId } = await chrome.storage.local.get('rootId');
    await chrome.bookmarks.create({ parentId: rootId, title: 'Second' });
    await chrome.bookmarks.create({ parentId: rootId, title: 'Third' });
  });
  const names = app.locator('.space-name > span:not(.count)');
  const row = (title: string) => app.getByRole('button', { name: `${title} 0`, exact: true });
  await expect(names).toHaveText(['Personal', 'Second', 'Third']);
  await dragSideRow(app, row('Third').locator('span:not(.count)'), row('Personal'));
  await expect(names).toHaveText(['Third', 'Personal', 'Second']);
  await expect(app.getByRole('heading', { name: 'Personal', exact: true })).toBeVisible();
  await dragSideRow(app, row('Third').locator('svg'), row('Second'));
  await expect(names).toHaveText(['Personal', 'Second', 'Third']);
  await dragSideRow(app, row('Third'), row('Personal'), true);
  await expect(names).toHaveText(['Personal', 'Second', 'Third']);
  await app.getByRole('button', { name: 'Third 選單', exact: true }).click();
  await expect(app.getByRole('menu')).toBeVisible();
  await expect(app.locator('.drag-overlay')).toHaveCount(0);
  await app.keyboard.press('Escape');
  await row('Third').click();
  await expect(app.getByRole('heading', { name: 'Third', exact: true })).toBeVisible();
  await app.reload();
  await expect(names).toHaveText(['Personal', 'Second', 'Third']);
});

test('side panel rows: tab text and favicon drag save without switching or closing; internal tabs stay non-draggable', async ({
  app,
}) => {
  const url = 'https://example.test/wide-row';
  await app
    .context()
    .route('https://example.test/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>Row target</title>' }),
    );
  for (const suffix of ['text', 'icon', 'cancel']) {
    const tab = await app.context().newPage();
    await tab.goto(`${url}/${suffix}`);
  }
  await app.bringToFront();
  const tabs = await app.evaluate(async () => ({
    own: (await chrome.tabs.getCurrent())!.id!,
    sources: (await chrome.tabs.query({}))
      .filter((t) => t.url?.startsWith('https://example.test/wide-row/'))
      .map((t) => ({ id: t.id!, url: t.url! })),
  }));
  const source = (suffix: string) => {
    const id = tabs.sources.find((t) => t.url.endsWith(`/${suffix}`))!.id;
    return app.locator(`[data-tab-id="${id}"]`);
  };
  const activeId = () =>
    app.evaluate(
      async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id,
    );
  const bookmarks = () =>
    app.evaluate(async () => {
      const { rootId } = await chrome.storage.local.get('rootId');
      const [root] = await chrome.bookmarks.getSubTree(rootId);
      return root.children![0].children![0].children!.map((b) => b.url);
    });
  const target = app.locator('.collection-title');
  await expect(source('text')).toHaveAttribute('data-draggable', 'true');
  await dragSideRow(app, source('text').locator('.tab-link > span').first(), target);
  await expect.poll(bookmarks).toEqual([`${url}/text`]);
  expect(await activeId()).toBe(tabs.own);
  await dragSideRow(app, source('icon').locator('.tab-link > :first-child'), target);
  await expect.poll(bookmarks).toEqual([`${url}/text`, `${url}/icon`]);
  expect(await activeId()).toBe(tabs.own);
  await dragSideRow(app, source('cancel').locator('.tab-link'), target, true);
  expect(await bookmarks()).toEqual([`${url}/text`, `${url}/icon`]);
  expect(await activeId()).toBe(tabs.own);
  expect(await app.evaluate(async () => (await chrome.tabs.query({})).length)).toBe(4);
  await source('text').getByRole('button', { name: '分頁 Row target 選單', exact: true }).click();
  await expect(app.getByRole('menu')).toBeVisible();
  await expect(app.locator('.drag-overlay')).toHaveCount(0);
  await app.keyboard.press('Escape');
  const own = app.locator(`[data-tab-id="${tabs.own}"]`);
  await expect(own).toHaveAttribute('data-draggable', 'false');
  const box = (await own.locator('.tab-link').boundingBox())!;
  await app.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await app.mouse.down();
  await app.mouse.move(box.x - 25, box.y + box.height / 2, { steps: 8 });
  await expect(app.locator('.drag-overlay')).toHaveCount(0);
  await app.mouse.up();
  expect(await bookmarks()).toEqual([`${url}/text`, `${url}/icon`]);
  await source('text').locator('.tab-link').click();
  await expect.poll(activeId).toBe(tabs.sources.find((t) => t.url.endsWith('/text'))!.id);
  await app.bringToFront();
  await app.reload();
  await expect(app.locator('.bookmark-card')).toHaveCount(2);
});
