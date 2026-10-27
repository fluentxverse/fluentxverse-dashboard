const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.ADMIN_AUTH_URL || 'http://127.0.0.1:5205';
const user = { userId: 'auth-recovery-admin', username: 'Alex', role: 'superadmin' };

async function fixture(browser, theme, width) {
  const context = await browser.newContext({ viewport: { width, height: 950 } });
  await context.addInitScript(theme => localStorage.setItem('fxv_admin_theme', theme), theme);
  const state = { authenticated: true, expireMessages: false, rejectLogin: false, loginCount: 0 };
  await context.route(/\/(admin|interview|inbox\/admin)\//, async route => {
    const path = new URL(route.request().url()).pathname;
    let json = { success: true, data: [] };
    if (path === '/admin/me') return route.fulfill({ status: state.authenticated ? 200 : 401, json: state.authenticated ? { success: true, user } : { success: false } });
    if (path === '/admin/login') {
      state.loginCount++;
      if (state.rejectLogin) return route.fulfill({ status: 400, json: { success: false, error: 'Incorrect test credentials' } });
      state.authenticated = true; state.expireMessages = false;
      return route.fulfill({ json: { success: true, user } });
    }
    if (path === '/inbox/admin/messages') {
      if (state.expireMessages) {
        state.authenticated = false;
        return route.fulfill({ status: 401, json: { success: false, error: 'Fixture session expired' } });
      }
      json.data = { messages: [], total: 0 };
    }
    if (path === '/admin/operations/access') json.data = { permissions: ['support'] };
    if (path === '/admin/stats') json.data = { totalTutors: 0, certifiedTutors: 0, pendingTutors: 0, totalStudents: 0, totalSessions: 0, totalRevenue: 0 };
    if (path === '/admin/exam-stats') json.data = { writtenExams: { total: 0, passed: 0, failed: 0 }, speakingExams: { total: 0, passed: 0, failed: 0, processing: 0 } };
    if (path === '/interview/stats') json.data = { total: 0, passed: 0, failed: 0, pending: 0, passRate: 0, avgScores: {}, weeklyData: [], rubricDistribution: [] };
    await route.fulfill({ json });
  });
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(8000);
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, state, errors };
}
async function signIn(page) {
  await page.getByLabel('Username', { exact: true }).fill('fixture-admin');
  await page.getByLabel('Password', { exact: true }).fill('fixture-password-not-a-real-secret');
  await page.locator('.login-form button[type="submit"]').click();
}
async function dashboard(page) {
  await expect(page).toHaveURL(base + '/');
  await expect(page.locator('.dashboard-route')).toHaveAttribute('data-route', '/');
  await expect(page.locator('.dashboard-page')).toBeVisible();
  await expect(page.locator('.login-page,.session-expired-overlay')).toHaveCount(0);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir('../output/screenshots/admin-auth-recovery', { recursive: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1566, 375]) {
      const { context, page, state, errors } = await fixture(browser, theme, width);
      await page.goto(base + '/login', { waitUntil: 'networkidle' });
      if (process.env.AUTH_EXPECT_BUG === '1') {
        await expect(page.locator('.dashboard-layout')).toBeVisible();
        assert.equal(new URL(page.url()).pathname, '/login');
        assert.equal(await page.locator('.dashboard-route').innerText(), '');
        await page.screenshot({ path: '../output/screenshots/admin-auth-recovery/before-blank-login.png' });
        console.log('REPRODUCED: authenticated /login displays the dashboard shell with an empty route');
        await context.close(); return;
      }
      await dashboard(page);
      for (const loginPath of ['/login?expired=1', '/login/', '/login#session']) {
        await page.goto(base + loginPath, { waitUntil: 'networkidle' });
        await dashboard(page);
      }
      state.authenticated = false;
      await page.goto(base + '/login');
      await expect(page.locator('.login-page')).toBeVisible();
      state.rejectLogin = true;
      await signIn(page);
      await expect(page.locator('.login-error')).toBeVisible();
      assert.equal(new URL(page.url()).pathname, '/login');
      await expect(page.locator('.dashboard-layout')).toHaveCount(0);
      state.rejectLogin = false;
      await signIn(page); await dashboard(page);
      await page.goto(base + '/inbox');
      await expect(page.getByRole('heading', { name: 'System Messages', exact: true })).toBeVisible();
      state.expireMessages = true;
      await page.getByRole('button', { name: 'Refresh messages' }).click();
      await expect(page.getByRole('heading', { name: 'Session Expired', exact: true })).toBeVisible();
      await expect(page.locator('.dashboard-layout')).toHaveCount(0);
      await page.getByRole('button', { name: /Go to Login/ }).click();
      await expect(page).toHaveURL(base + '/login');
      await expect(page.locator('.login-page')).toBeVisible();
      await signIn(page); await dashboard(page);
      await page.screenshot({ path: `../output/screenshots/admin-auth-recovery/recovered-${theme}-${width}.png` });
      await page.goto(base + '/inbox');
      await expect(page.locator('.sysmsg-page')).toBeVisible();
      await page.evaluate(() => { const link = document.createElement('a'); link.href = '/login'; document.body.append(link); link.click(); link.remove(); });
      await dashboard(page);
      await page.goBack();
      await expect(page).toHaveURL(base + '/inbox');
      await expect(page.locator('.sysmsg-page')).toBeVisible();
      state.authenticated = false;
      await page.goto(base + '/inbox');
      await expect(page.locator('.login-page')).toBeVisible();
      await signIn(page);
      await expect(page).toHaveURL(base + '/inbox');
      await expect(page.locator('.sysmsg-page')).toBeVisible();
      assert.deepEqual(errors, []);
      console.log(`PASS ${theme} ${width}: signed-in /login redirects, failed login stays signed out, expired session re-login restores content, history replaces login, protected deep link preserved`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
