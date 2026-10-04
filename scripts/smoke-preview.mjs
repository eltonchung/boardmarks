import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
let server, browser;
try {
  let url = process.env.PREVIEW_URL;
  if (!url) {
    server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
    await server.listen();
    url = server.resolvedUrls.local[0];
  }
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await expect(page.locator('.preview-banner')).toContainText('不會存取 Chrome 書籤或分頁');
  await page.getByRole('button', { name: '建立我的工作區' }).click();
  await expect(page.getByRole('heading', { name: 'Favorites', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '新增書籤至 Favorites', exact: true }).click();
  await page.getByRole('textbox', { name: '名稱', exact: true }).fill('Preview persistence');
  await page
    .getByRole('textbox', { name: '網址', exact: true })
    .fill('https://example.test/preview');
  await page.getByRole('button', { name: '儲存', exact: true }).click();
  await page.reload();
  await expect(
    page.locator('.bookmark-link').filter({ hasText: 'Preview persistence' }),
  ).toBeVisible();
  expect(await page.evaluate(() => !!globalThis.chrome?.bookmarks)).toBe(false);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/preview-1280.png' });
  console.log(
    'Preview smoke PASS: onboarding, bookmark creation, reload persistence, isolated data, no page errors.',
  );
} finally {
  await browser?.close();
  await server?.close();
}
