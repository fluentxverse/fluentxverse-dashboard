const { chromium, expect } = require('@playwright/test');
const base = process.env.ADMIN_AUTH_URL || 'http://127.0.0.1:5205';
const routes = ['/business-english-preview/business-english-L3-C1-1-listening-1772772288728',
  '/conversational-skills-preview/example', '/daily-dispatch-preview/example',
  '/daily-dispatch/preview/example', '/daily-dispatch/archives/2026-10',
  '/daily-dispatch/student/example', '/young-learners-preview/example',
  '/lesson-material-maker?previewToken=example', '/lesson-material-maker?src=example',
  '/interview-room/example', '/workplace-communication', '/'];
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const context = await browser.newContext();
  let signedIn = false;
  let dataRequests = 0;
  await context.route('**/admin/me', route => route.fulfill({ status: signedIn ? 200 : 401,
    json: signedIn ? { success: true, user: { userId: 'test-admin', username: 'Test', role: 'admin' } } : { success: false } }));
  await context.route('**/lesson-materials/**', route => { dataRequests++; return route.fulfill({ status: 404, json: { success: false } }); });
  const page = await context.newPage();
  for (const route of routes) {
    await page.goto(base + route);
    await expect(page.locator('.login-page')).toBeVisible();
    await expect(page.locator('.dashboard-layout')).toHaveCount(0);
  }
  if (dataRequests) throw new Error('Signed-out previews requested lesson data');
  signedIn = true;
  await page.goto(base + routes[0]);
  await expect(page.locator('.login-page')).toHaveCount(0);
  await expect.poll(() => dataRequests).toBeGreaterThan(0);
  console.log(`PASS: ${routes.length} dashboard routes require sign-in; authenticated preview loads`);
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
