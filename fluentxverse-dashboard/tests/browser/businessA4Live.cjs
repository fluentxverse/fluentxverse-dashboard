const { chromium, expect } = require('playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.ADMIN_TEST_URL || 'https://dashboard.fluentxverse.com';
const lessonId = 'business-english-L3-C1-1-listening-1772772288728';
const output = process.env.BUSINESS_A4_OUTPUT || '/tmp/business-a4-live';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir(output, { recursive: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1566, height: 1400 }, reducedMotion: 'reduce' });
    const errors = [], blockedWrites = [];
    await context.addInitScript(() => localStorage.setItem('beve-theme', 'light'));
    await context.route('**/*', route => {
      if (new URL(route.request().url()).pathname === '/cdn-cgi/rum') return route.abort();
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
        blockedWrites.push(new URL(route.request().url()).pathname);
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const url = `${base}/business-english-preview/${lessonId}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.beve-a4-paper')).toHaveCount(10);
    await expect(page.locator('.beve-a4-paper[data-overflow="true"]')).toHaveCount(0);
    const pages = await page.locator('.beve-a4-paper').evaluateAll(papers => papers.map(paper => {
      const rect = paper.getBoundingClientRect();
      const footer = paper.querySelector('.beve-page-footer').getBoundingClientRect();
      return {
        page: paper.getAttribute('aria-label'), width: rect.width, height: rect.height,
        fits: [...paper.querySelectorAll('[data-a4-section]')].every(block => block.getBoundingClientRect().bottom <= footer.top + 1),
        notesInside: paper.querySelectorAll('.beve-col-tutor').length,
      };
    }));
    assert(pages.every(page => Math.abs(page.width / page.height - 210 / 297) < .001 && page.fits && !page.notesInside));
    await expect(page.locator('.beve-a4-guide').first()).toContainText('Teaching Notes');
    assert(await page.locator('.beve-a4-view-controls').evaluate(element => element.getBoundingClientRect().bottom <= innerHeight));
    assert(await page.locator('.beve-a4-canvas').evaluate(element => element.clientHeight < element.scrollHeight));
    await page.screenshot({ path: `${output}/lesson-1-desktop.png` });
    await page.setViewportSize({ width: 375, height: 1000 });
    await expect(page.locator('.beve-a4-paper')).toHaveCount(10);
    await page.screenshot({ path: `${output}/lesson-1-mobile.png` });
    assert.deepEqual(errors, []);
    assert.deepEqual(blockedWrites, []);
    await fs.writeFile(`${output}/verification.json`, JSON.stringify({ url, pages, errors, blockedWrites }, null, 2));
    console.log('PASS live Lesson 1 preview: 10 A4 pages, complete activities, teaching notes outside paper, desktop/mobile, no writes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
