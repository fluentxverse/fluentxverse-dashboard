const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.ADMIN_TEST_URL || 'https://dashboard.fluentxverse.com';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const width of [1440, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const lesson = { id: 'footer-fixture', course: 'business-english', level: 3, chapter: 2, chapterName: 'Work introductions', lessonNumber: 1, lessonName: 'Introducing Your Team', levelBadge: 'BEGINNER', skill: 'listening', status: 'published', goalTextEn: 'Introduce yourself.', beData: { lessonType: 'LISTENING' }, sections: [] };
    await context.route(/https:\/\/api\.fluentxverse\.com\//, route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/admin/me') return route.fulfill({ json: { success: true, user: { userId: 'fixture', username: 'Admin', role: 'superadmin' } } });
      if (path.startsWith('/lesson-materials/')) return route.fulfill({ json: { success: true, lesson } });
      return route.fulfill({ json: { success: true, data: [] } });
    });
    const page = await context.newPage();
    await page.goto(base + '/business-english-preview/footer-fixture');
    const footer = page.locator('.beve-page-footer').first();
    await expect(footer).toBeVisible();
    for (const selector of ['.beve-footer-course', '.beve-footer-copy']) {
      const value = await footer.locator(selector).evaluate(element => getComputedStyle(element).color);
      assert.equal(value, 'rgb(226, 222, 240)');
    }
    await footer.screenshot({ path: `/tmp/fluentxverse-business-footer-${width}.png` });
    console.log(`PASS ${width}: footer text uses the improved contrast`);
    await context.close();
  }
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
