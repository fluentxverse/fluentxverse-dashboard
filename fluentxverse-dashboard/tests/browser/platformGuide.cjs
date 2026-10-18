const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { mkdir } = require('node:fs/promises');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const base = process.env.GUIDE_URL || 'http://127.0.0.1:5192';
const output = process.env.GUIDE_SCREENSHOTS || '/tmp/fluentxverse-platform-guide';

(async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1440, 768, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      let signedIn = true;
      const mutations = [];
      await context.route(/\/(admin|interview)\//, async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        if (request.method() !== 'GET') { mutations.push(path); throw Error('Reading the guide must not mutate data'); }
        let result = { success: true, data: [] }, status = 200;
        if (path === '/admin/me') {
          result = signedIn ? { success: true, user: { userId: 'guide-test-admin', username: 'Reader', role: 'admin' } } : { success: false, error: 'Unauthorized' };
          status = signedIn ? 200 : 401;
        } else if (path === '/admin/operations/access') result.data = { permissions: ['support'] };
        return route.fulfill({ status, json: result, headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true' } });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/platform-overview');
      await expect(page.getByRole('heading', { name: 'Platform Guide', exact: true })).toBeVisible();
      await expect(page.locator('.guide-reading .guide-chapter')).toHaveCount(20);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const art = await page.locator('.platform-guide .admin-art').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0));
      assert.ok(art, 'Guide artwork must render');
      await page.screenshot({ path: `${output}/top-${width}.png` });
      const chapterToggle = page.getByRole('button', { name: 'Chapters', exact: true });
      if (width <= 800) await chapterToggle.click();
      await page.locator('.guide-navigation a[href="#guide-engine-and-networks"]').click();
      await expect(page.locator('#guide-engine-and-networks')).toBeFocused();
      assert.ok(page.url().endsWith('#guide-engine-and-networks'));
      const top = await page.locator('#guide-engine-and-networks').evaluate(element => element.getBoundingClientRect().top);
      assert.ok(top >= 70 && top < 200, 'Chapter must appear below the fixed header');
      if (width > 800) {
        const navigationTop = await page.locator('.guide-navigation').evaluate(element => element.getBoundingClientRect().top);
        assert.ok(navigationTop >= 70 && navigationTop < 150, 'Contents should stay visible when reading a later chapter');
      }
      await page.screenshot({ path: `${output}/networks-${width}.png` });
      await page.reload();
      await expect(page.locator('#guide-engine-and-networks')).toBeFocused();
      await page.getByRole('searchbox', { name: 'Search the platform guide' }).fill('VFY ETH');
      await expect(page.locator('.guide-results')).toContainText('matching');
      assert.ok(await page.locator('.guide-reading #guide-engine-and-networks').count());
      await page.getByRole('button', { name: 'Clear search' }).click();
      await page.getByRole('group', { name: 'Reading topics' }).getByRole('button', { name: 'Business', exact: true }).click();
      const topics = await page.locator('.guide-reading section[data-topic]').evaluateAll(sections => sections.map(section => section.dataset.topic));
      assert.ok(topics.length > 0 && topics.every(topic => topic === 'Business'));
      await page.getByRole('searchbox').fill('nonsense-query-no-matches');
      await expect(page.getByRole('heading', { name: 'No matching topics' })).toBeVisible();
      await page.getByRole('button', { name: 'Show full guide', exact: true }).first().click();
      await expect(page.locator('.guide-reading .guide-chapter')).toHaveCount(20);
      await page.evaluate(() => { window.__printedGuide = 0; window.print = () => { window.__printedGuide++; }; });
      await page.getByRole('button', { name: 'Print', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__printedGuide), 1);
      await page.emulateMedia({ media: 'print' });
      await expect(page.locator('.sidebar')).toBeHidden();
      await expect(page.locator('.guide-tools')).toBeHidden();
      await expect(page.locator('.guide-reading')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'What is ready, what is gated, and what comes next' })).toBeVisible();
      if (width === 1440) {
        const pdf = `${output}/platform-guide.pdf`;
        await page.pdf({ path: pdf, format: 'A4', printBackground: true });
        if (process.env.GUIDE_CHECK_PDF_TEXT === 'true') {
          const printedText = execFileSync('pdftotext', [pdf, '-'], { encoding: 'utf8' });
          for (const text of ['The business in plain English', 'What is ready, what is gated, and what comes next', 'Reconciliation', 'Further reading', 'FluentXVerse / Platform Guide']) assert.ok(printedText.includes(text), `Printed guide is missing ${text}`);
        }
      }
      await page.emulateMedia({ media: 'screen' });
      assert.deepEqual(errors, []);
      assert.deepEqual(mutations, []);
      signedIn = false;
      await page.goto(base + '/platform-overview');
      await expect(page.locator('.platform-guide')).toHaveCount(0);
      await expect(page.locator('.login-page')).toBeVisible();
      await context.close();
      console.log(`Platform guide content, navigation, search, topic filters, print and auth checks passed: ${width}px`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
