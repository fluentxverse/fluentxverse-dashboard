const { chromium } = require('playwright');
const { expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { execFileSync } = require('node:child_process');
const base = process.env.TESTING_URL || 'http://127.0.0.1:5194';
const catalog = JSON.parse(execFileSync('bun', ['-e', "import {testingChecklist} from './fluentxverse-server/src/shared/testingChecklist'; console.log(JSON.stringify(testingChecklist))"], { cwd: require('node:path').resolve(__dirname, '../../..'), encoding: 'utf8' }));

(async () => {
  await mkdir('/tmp/fluentxverse-testing', { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1440, 768, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      let signedIn = true, canEdit = true, unavailable = false, failSave = false;
      let items = catalog.map(item => ({ ...item, completed: false, notes: '', revision: 0, updatedBy: null, updatedAt: null }));
      await context.route(/\/(admin|interview)\//, async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        let json = { success: true, data: [] }, status = 200;
        if (path === '/admin/me') { json = signedIn ? { success: true, user: { userId: 'test-admin', username: 'QA', role: 'admin' } } : { success: false }; status = signedIn ? 200 : 401; }
        else if (path === '/admin/operations/access') json.data = { permissions: canEdit ? ['operations'] : ['support'] };
        else if (path === '/admin/testing/') {
          if (unavailable) { status = 500; json = { success: false, error: 'Temporary checklist outage' }; }
          else json.data = { runId: 'test-pilot', canEdit, items };
        } else if (path.startsWith('/admin/testing/') && req.method() === 'PATCH') {
          const id = path.split('/').pop(), input = req.postDataJSON(), item = items.find(item => item.id === id);
          if (failSave || input.revision !== item.revision) { status = 409; json = { success: false, error: 'A teammate updated this item. Refresh before saving again.' }; }
          else {
            Object.assign(item, input, { revision: item.revision + 1, updatedBy: 'QA teammate', updatedAt: new Date().toISOString() });
            json.data = item;
          }
        }
        return route.fulfill({ status, json, headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true' } });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/testing');
      await expect(page.getByRole('heading', { name: 'Testing', exact: true })).toBeVisible();
      await expect(page.getByRole('checkbox')).toHaveCount(31);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const first = page.getByRole('checkbox', { name: 'Passed: Student social sign-in', exact: true });
      await first.click();
      await expect(first).toBeChecked();
      await expect(page.locator('.testing-progress')).toContainText('1 / 29 passed');
      await page.reload();
      await expect(first).toBeChecked();
      const row = page.locator('.testing-row').filter({ has: first });
      await row.locator('summary').click();
      await row.getByRole('textbox').fill('Chrome desktop and Android mobile: passed');
      await row.getByRole('button', { name: 'Save notes' }).click();
      await expect(row.getByRole('button', { name: 'Save notes' })).toBeDisabled();
      await page.reload();
      await row.locator('summary').click();
      await expect(row.getByRole('textbox')).toHaveValue('Chrome desktop and Android mobile: passed');
      await row.getByRole('textbox').fill('Unsaved issue note');
      await page.getByRole('button', { name: 'Refresh team progress' }).click();
      await expect(row.getByRole('textbox')).toHaveValue('Unsaved issue note');
      failSave = true;
      await first.click();
      await expect(row.getByRole('alert')).toContainText('A teammate updated');
      await expect(first).toBeChecked();
      failSave = false;
      await first.click();
      await expect(first).not.toBeChecked();
      await page.getByRole('group', { name: 'Test status' }).getByRole('button', { name: /^Gated/ }).click();
      await expect(page.getByRole('checkbox')).toHaveCount(2);
      for (const checkbox of await page.getByRole('checkbox').all()) await expect(checkbox).toBeDisabled();
      await page.getByRole('group', { name: 'Test status' }).getByRole('button', { name: /^All/ }).click();
      await page.getByRole('searchbox', { name: 'Search tests' }).fill('mobile data');
      assert.ok(await page.getByRole('checkbox').count() > 0);
      await page.getByRole('searchbox').fill('impossible-no-test');
      await expect(page.getByText('No tests in this view.')).toBeVisible();
      await page.getByRole('searchbox').fill('');
      await page.screenshot({ path: `/tmp/fluentxverse-testing/checklist-${width}.png`, fullPage: false });
      unavailable = true;
      await page.getByRole('button', { name: 'Refresh team progress' }).click();
      await expect(page.getByRole('alert')).toContainText('Temporary checklist outage');
      unavailable = false;
      await page.getByRole('button', { name: 'Retry', exact: true }).click();
      await expect(page.getByRole('alert')).toHaveCount(0);
      canEdit = false;
      await page.reload();
      await expect(page.getByText(/Read-only/)).toBeVisible();
      for (const checkbox of await page.getByRole('checkbox').all()) await expect(checkbox).toBeDisabled();
      signedIn = false;
      await page.reload();
      await expect(page.locator('.testing-page')).toHaveCount(0);
      await expect(page.locator('.login-page')).toBeVisible();
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`Checklist interaction, persistence, conflicts, errors, permissions and layout passed: ${width}px`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
