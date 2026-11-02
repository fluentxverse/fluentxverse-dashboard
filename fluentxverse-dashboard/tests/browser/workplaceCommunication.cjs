const { chromium, expect } = require('playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.ADMIN_TEST_URL || 'http://127.0.0.1:5175';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir('/tmp/workplace-communication', { recursive: true });
  try {
    for (const [width, theme] of [[1440, 'light'], [390, 'dark']]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await context.addInitScript(theme => localStorage.setItem('fxv_admin_theme', theme), theme);
      const lessons = [], writes = [], errors = [];
      let failSave = false;
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):8765)\//, async route => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        const headers = { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS', 'access-control-allow-headers': 'Content-Type,Authorization' };
        const reply = (json, status = 200) => route.fulfill({ json, status, headers });
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (path === '/admin/me') return reply({ success: true, user: { userId: 'wc-admin', username: 'Editor', role: 'superadmin' } });
        if (request.method() === 'POST' && /^\/lesson-materials\/?$/.test(path)) {
          const payload = request.postDataJSON();
          assert.equal(payload.course, 'workplace-communication');
          assert.equal(payload.beData, undefined);
          const lesson = { ...payload, id: `wc-${lessons.length + 1}`, status: 'draft', updatedAt: new Date().toISOString() };
          lessons.push(lesson); writes.push(payload);
          return reply({ success: true, lesson });
        }
        if (request.method() === 'PATCH' && path.endsWith('/header')) {
          if (failSave) return reply({ success: false, error: 'Test save unavailable' }, 503);
          const lesson = lessons.find(item => path.includes(`/${item.id}/`));
          assert(lesson, 'Only this course fixture may be edited');
          Object.assign(lesson, request.postDataJSON()); writes.push(request.postDataJSON());
          return reply({ success: true, lesson });
        }
        if (path.includes('/lesson-materials/course/')) {
          assert(path.endsWith('/workplace-communication'));
          return reply({ success: true, lessons });
        }
        return reply({ success: true, data: [], lessons: [], tutors: [], notifications: [], permissions: [] });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/lesson-material-maker`);
      await page.getByRole('heading', { name: 'Workplace Communication', exact: true }).click();
      await expect(page).toHaveURL(`${base}/workplace-communication`);
      await expect(page.getByText('No Prepare lessons yet')).toBeVisible();
      await page.getByRole('button', { name: 'New Prepare lesson', exact: true }).click();
      await page.getByLabel('Lesson title', { exact: true }).fill('Welcoming a colleague');
      await page.getByLabel('Lesson objective', { exact: true }).fill('I can explain my role to a new colleague.');
      await page.getByLabel('Student material', { exact: true }).fill('A new colleague joins your team.');
      await page.getByLabel('Facilitator notes', { exact: true }).fill('Private tutor opening.');
      await page.getByRole('button', { name: 'Preview', exact: true }).click();
      await expect(page.locator('.wc-preview')).not.toContainText('Private tutor opening.');
      await page.getByRole('checkbox', { name: 'Facilitator notes' }).check();
      await expect(page.locator('.wc-preview')).toContainText('Private tutor opening.');
      await page.getByRole('button', { name: 'Save draft', exact: true }).click();
      await expect.poll(() => writes.length).toBe(1);
      await page.reload();
      await page.getByRole('button', { name: 'Edit Welcoming a colleague', exact: true }).click();
      await expect(page.getByLabel('Student material', { exact: true })).toHaveValue('A new colleague joins your team.');
      await page.getByLabel('Translation', { exact: true }).selectOption('ko');
      await page.getByLabel('Student material (Korean)', { exact: true }).fill('새로운 동료가 팀에 합류합니다.');
      await page.getByRole('button', { name: /Words at Work/ }).click();
      await page.getByLabel('Student material', { exact: true }).fill('colleague\ndepartment');
      failSave = true;
      await page.getByRole('button', { name: 'Save draft', exact: true }).click();
      await expect(page.getByText('Test save unavailable')).toBeVisible();
      await expect(page.locator('.wc-header .wc-status')).toHaveText('Unsaved');
      failSave = false;
      await page.getByRole('button', { name: 'Save draft', exact: true }).click();
      await expect.poll(() => writes.length).toBe(2);
      await page.screenshot({ path: `/tmp/workplace-communication/editor-${width}.png`, fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal page overflow');
      await page.getByRole('button', { name: 'All lessons', exact: true }).click();
      await page.getByRole('button', { name: 'Perform', exact: true }).click();
      await expect(page.getByText('No Perform lessons yet')).toBeVisible();
      await expect(page.getByText('Complete the Task', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'New Perform lesson', exact: true }).click();
      await page.getByLabel('Lesson title', { exact: true }).fill('Your first team meeting');
      await page.getByLabel('Lesson objective', { exact: true }).fill('I can introduce my role at a team meeting.');
      await page.getByRole('button', { name: 'Save draft', exact: true }).click();
      await expect.poll(() => writes.length).toBe(3);
      assert.equal(writes[2].workplaceData.mode, 'perform');
      await page.getByRole('button', { name: 'All lessons', exact: true }).click();
      await page.screenshot({ path: `/tmp/workplace-communication/library-${width}.png`, fullPage: true });
      await page.getByRole('searchbox', { name: 'Search lessons' }).fill('not present');
      await expect(page.getByText('No matching lessons')).toBeVisible();
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}: category navigation, both formats, save/reopen, failed-save retention, preview notes, search`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
