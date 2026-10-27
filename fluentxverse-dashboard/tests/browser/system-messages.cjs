const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.ADMIN_MESSAGES_URL || 'http://127.0.0.1:5203';
const widths = (process.env.ADMIN_MESSAGES_WIDTHS || '1566,1024,768,375,320').split(',').map(Number);

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir('../output/screenshots/admin-system-messages', { recursive: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      await context.addInitScript(theme => localStorage.setItem('fxv_admin_theme', theme), theme);
      let messages = [], failSave = false, failDelete = false, failList = false;
      const mutations = [];
      await context.route(/\/(admin|interview|inbox\/admin)\//, async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname;
        let json = { success: true, data: [] };
        if (path === '/admin/me') json.user = { userId: 'system-message-admin', username: 'Alex', role: 'superadmin' };
        if (path === '/admin/operations/access') json.data = { permissions: ['support'] };
        if (path === '/inbox/admin/messages') {
          if (failList) return route.fulfill({ status: 503, json: { success: false, error: 'Messages temporarily unavailable' } });
          const rows = messages.filter(m => (!url.searchParams.get('category') || m.category === url.searchParams.get('category')) && (!url.searchParams.get('targetAudience') || m.targetAudience === url.searchParams.get('targetAudience')));
          const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 20);
          json.data = { messages: rows.slice(offset, offset + limit), total: rows.length };
        }
        if (path === '/inbox/admin/create' || path.startsWith('/inbox/admin/update/')) {
          mutations.push({ path, method: request.method(), body: request.postDataJSON() });
          await new Promise(resolve => setTimeout(resolve, 180));
          if (failSave) return route.fulfill({ status: 400, json: { success: false, error: 'Message was not saved' } });
          const id = path.includes('/update/') ? path.split('/').pop() : 'created-message';
          const message = { id, ...request.postDataJSON(), createdAt: '2026-10-22T05:31:00Z', updatedAt: '2026-10-22T05:31:00Z' };
          messages = [message, ...messages.filter(m => m.id !== id)]; json.data = message;
        }
        if (path.startsWith('/inbox/admin/delete/')) {
          mutations.push({ path, method: request.method() });
          await new Promise(resolve => setTimeout(resolve, 120));
          if (failDelete) return route.fulfill({ status: 400, json: { success: false, error: 'Message was not deleted' } });
          messages = messages.filter(m => m.id !== path.split('/').pop());
        }
        await route.fulfill({ json });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/inbox', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'No messages yet' })).toBeVisible();
      const button = page.getByRole('button', { name: 'Create message', exact: true });
      const bounds = await button.boundingBox(); assert(bounds.height <= 42 && bounds.width < 200, 'Empty-state button stays compact');
      const style = await button.locator('i').evaluate(el => ({ fontSize: getComputedStyle(el).fontSize, width: el.getBoundingClientRect().width }));
      assert.equal(style.fontSize, '16px'); assert(style.width <= 18);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: page fits`);
      await page.screenshot({ path: `../output/screenshots/admin-system-messages/empty-${theme}-${width}.png` });
      await page.getByLabel('Category', { exact: true }).selectOption('alert');
      await expect(page.getByRole('heading', { name: 'No matching messages' })).toBeVisible();
      await page.locator('.sysmsg-empty button').click();
      await button.click();
      const dialog = page.getByRole('dialog', { name: 'New message', exact: true });
      await expect(dialog).toBeVisible(); assert(await dialog.evaluate(el => el.matches(':modal')));
      await dialog.getByLabel('Title', { exact: true }).fill('Schedule maintenance notice');
      await dialog.getByLabel('Message', { exact: true }).fill('Scheduled maintenance begins this evening.\nExisting lessons remain visible.');
      await dialog.getByLabel('Category', { exact: true }).selectOption('alert');
      await dialog.getByLabel('Audience', { exact: true }).selectOption('tutors');
      await dialog.getByLabel('Priority', { exact: true }).selectOption('high');
      assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), 'Composer content fits');
      await page.screenshot({ path: `../output/screenshots/admin-system-messages/compose-${theme}-${width}.png` });
      failSave = true;
      await dialog.getByRole('button', { name: 'Send message', exact: true }).click();
      await expect(dialog.getByRole('alert')).toBeVisible();
      await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue('Schedule maintenance notice');
      failSave = false;
      await dialog.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
      await expect(dialog).toHaveCount(0);
      assert.equal(mutations.filter(m => m.path === '/inbox/admin/create').length, 2, 'One failed create and one successful create; double submission is blocked');
      await expect(page.locator('.sysmsg-row')).toHaveCount(1);
      await page.getByRole('button', { name: 'Schedule maintenance notice', exact: true }).click();
      const preview = page.getByRole('dialog', { name: 'Message details' });
      await expect(preview.locator('.sysmsg-preview > p')).toContainText('Existing lessons remain visible.');
      await preview.getByRole('button', { name: 'Edit message', exact: true }).click();
      const edit = page.getByRole('dialog', { name: 'Edit message', exact: true });
      await edit.getByLabel('Message', { exact: true }).fill('Maintenance has been completed.');
      await edit.getByRole('button', { name: 'Save changes', exact: true }).click();
      await expect(edit).toHaveCount(0);
      await expect(page.locator('.sysmsg-message-copy > p')).toHaveText('Maintenance has been completed.');
      await page.screenshot({ path: `../output/screenshots/admin-system-messages/list-${theme}-${width}.png` });
      await page.getByRole('button', { name: 'Delete Schedule maintenance notice', exact: true }).click();
      const deletion = page.getByRole('dialog', { name: 'Delete message', exact: true });
      failDelete = true;
      await deletion.getByRole('button', { name: 'Delete message', exact: true }).click();
      await expect(deletion.getByRole('alert')).toBeVisible();
      failDelete = false;
      await deletion.getByRole('button', { name: 'Delete message', exact: true }).click();
      await expect(deletion).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'No messages yet' })).toBeVisible();
      messages = Array.from({ length: 25 }, (_, i) => ({ id: `message-${i}`, title: `Platform update ${i + 1}`, content: 'A platform update for the teaching community.', category: 'update', targetAudience: i % 2 ? 'students' : 'tutors', priority: i % 2 ? 'normal' : 'urgent', createdAt: '2026-10-22T05:31:00Z' }));
      await page.getByRole('button', { name: 'Refresh messages' }).click();
      await expect(page.locator('.sysmsg-row')).toHaveCount(20);
      await page.getByRole('button', { name: 'Next page' }).click();
      await expect(page.locator('.sysmsg-row')).toHaveCount(5);
      await expect(page.locator('.sysmsg-pagination')).toContainText('Page 2 of 2');
      await page.getByLabel('Audience', { exact: true }).selectOption('students');
      await expect(page.locator('.sysmsg-row')).toHaveCount(12);
      await expect(page.locator('.sysmsg-pagination')).toContainText('Page 1 of 1');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Populated list fits');
      failList = true;
      await page.getByRole('button', { name: 'Refresh messages' }).click();
      await expect(page.locator('.sysmsg-error')).toBeVisible();
      failList = false;
      await page.getByRole('button', { name: 'Retry', exact: true }).click();
      await expect(page.locator('.sysmsg-error')).toHaveCount(0);
      await page.getByRole('button', { name: 'New message', exact: true }).click();
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog.sysmsg-dialog')).toHaveCount(0);
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
      assert(await page.getByRole('button', { name: 'New message', exact: true }).evaluate(el => el === document.activeElement), 'Dismissal restores focus');
      assert.deepEqual(errors, []);
      console.log(`PASS ${theme} ${width}: compact empty state, filters, native dialogs, preview, mocked create/edit/delete, failure recovery, send-once, pagination, Escape and focus`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
