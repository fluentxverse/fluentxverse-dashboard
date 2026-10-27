const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { chromium, expect } = require('@playwright/test');
const base = process.env.ALERTS_UI_URL || 'http://127.0.0.1:5216';
mkdirSync('output/screenshots/operational-alerts', { recursive: true });
const id = '11111111-1111-4111-8111-111111111111';
const fixture = () => ({ version: 1, checkedAt: new Date().toISOString(), apiAvailable: true, notifications: { browser: true, external: false }, incidents: [
  { id, key: 'disk', category: 'disk', severity: 'critical', title: 'Server disk space is low', message: '96.0% of disk capacity is used; 0.8 GiB remains available. Review recordings, backups and logs.', href: '/server-health', openedAt: new Date(Date.now()-3600000).toISOString(), lastSeenAt: new Date().toISOString(), resolvedAt: null, acknowledgedAt: null, acknowledgedBy: null, events: [{ at: new Date().toISOString(), action: 'opened' }] },
  { id: '22222222-2222-4222-8222-222222222222', key: 'proofs', category: 'proofs', severity: 'warning', title: 'Proof verification has remained pending', message: '2 application proof workflows are awaiting receipt verification. Inspect the original operation; do not resubmit a paid proof.', href: '/alerts', openedAt: new Date(Date.now()-7200000).toISOString(), lastSeenAt: new Date().toISOString(), resolvedAt: new Date().toISOString(), acknowledgedAt: null, acknowledgedBy: null, events: [{ at: new Date().toISOString(), action: 'resolved' }] },
] });
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1440, 1024, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 960 } });
      if (width === 1440) {
        await context.grantPermissions(['notifications']);
        await context.addInitScript(() => {
          window.__opsNotifications = [];
          window.Notification = new Proxy(window.Notification, { construct(target, args) {
            window.__opsNotifications.push(args[0]); return Reflect.construct(target, args);
          } });
        });
      }
      let mode = 'live', permissions = ['operations'], data = fixture(), ackCalls = 0;
      await context.route('**/*', route => {
        const url = route.request().url();
        if (url.startsWith(base) || url.startsWith('https://api.fluentxverse.com') || url.startsWith('https://fluentxverse-alerts.paulanthonyarriola.workers.dev')) return route.continue();
        return route.abort();
      });
      await context.route('https://fluentxverse-alerts.paulanthonyarriola.workers.dev/availability', route => route.fulfill({ json: { apiAvailable: false, checkedAt: new Date().toISOString() } }));
      await context.route('https://api.fluentxverse.com/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
        if (path === '/admin/me') return route.fulfill({ json: { success: true, user: { userId: 'ops', username: 'Operations', role: 'superadmin' } } });
        if (path === '/admin/operations/access') return route.fulfill({ json: { success: true, data: { permissions } } });
        if (path === '/admin/alerts' || path.endsWith('/acknowledge')) {
          if (mode === 'denied') return route.fulfill({ status: 403, json: { success: false } });
          if (mode === 'offline') return route.fulfill({ status: 503, json: { success: false } });
          if (path.endsWith('/acknowledge')) { ackCalls++; data.incidents[0].acknowledgedAt = new Date().toISOString(); data.incidents[0].acknowledgedBy = 'ops'; data.incidents[0].events.push({ at: new Date().toISOString(), action: 'acknowledged', actor: 'ops' }); }
          const payload = structuredClone(data);
          if (mode === 'stale') payload.checkedAt = new Date(Date.now()-240000).toISOString();
          if (mode === 'empty') payload.incidents = [];
          return route.fulfill({ json: { success: true, data: payload } });
        }
        return route.fulfill({ json: { success: true, data: [] } });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/alerts');
      await expect(page.getByRole('heading', { name: 'Alerts', exact: true })).toBeVisible();
      await expect(page.locator('.oa-incident')).toHaveCount(1);
      await expect(page.getByText('External watchdog active', { exact: true })).toBeVisible();
      if (width === 1440) assert.equal(await page.locator('a[href="/stats"]').evaluate(el => el.closest('li').nextElementSibling.querySelector('a').getAttribute('href')), '/alerts');
      for (const theme of ['light','dark']) {
        if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
        await page.screenshot({ path: `output/screenshots/operational-alerts/${width}-${theme}.png`, fullPage: true });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Page overflow');
        assert(await page.locator('.oa-incident').evaluateAll(rows => rows.every(row => row.scrollWidth <= row.clientWidth + 1)), 'Incident overflow');
      }
      await page.getByRole('button', { name: 'Acknowledge', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Acknowledge', exact: true })).toHaveCount(0); assert.equal(ackCalls, 1);
      await page.getByRole('group', { name: 'Incident status' }).getByRole('button', { name: 'Acknowledged', exact: true }).click();
      await expect(page.locator('.oa-incident')).toHaveCount(1);
      await page.getByText('Incident history', { exact: true }).click(); await expect(page.getByText('acknowledged by ops', { exact: false })).toBeVisible();
      await page.getByRole('group', { name: 'Incident status' }).getByRole('button', { name: 'Recovered', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Proof verification has remained pending' })).toBeVisible();
      await page.getByRole('combobox', { name: 'Alert category' }).selectOption('disk');
      await expect(page.getByRole('heading', { name: 'No matching incidents' })).toBeVisible();
      await page.getByRole('combobox', { name: 'Alert category' }).selectOption('');
      await page.getByRole('group', { name: 'Incident status' }).getByRole('button', { name: 'All', exact: true }).click();
      await page.getByRole('searchbox', { name: 'Search incidents' }).fill(id); await expect(page.locator('.oa-incident')).toHaveCount(1);
      await page.getByRole('searchbox', { name: 'Search incidents' }).fill('');
      if (width === 1440) {
        await page.getByRole('checkbox', { name: 'Browser notifications' }).check();
        await expect(page.getByRole('checkbox', { name: 'Browser notifications' })).toBeChecked();
        data.incidents[0].resolvedAt = new Date().toISOString();
        await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
        await page.getByRole('button', { name: 'Refresh alerts', exact: true }).click();
        await expect.poll(() => page.evaluate(() => window.__opsNotifications)).toContain('Operational incident recovered');
        await page.evaluate(() => delete document.hidden);
      }
      mode = 'stale'; await page.getByRole('button', { name: 'Refresh alerts', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('not checked in');
      mode = 'offline'; await page.getByRole('button', { name: 'Refresh alerts', exact: true }).click();
      await expect(page.getByText('External availability check: API is unavailable.')).toBeVisible();
      await expect(page.locator('.oa-incident')).toHaveCount(2);
      mode = 'denied'; permissions = ['support']; await page.reload();
      await expect(page.getByRole('heading', { name: 'Operations access required' })).toBeVisible();
      await expect(page.locator('a[href="/alerts"]')).toHaveCount(0);
      assert.deepEqual(errors, []); await context.close();
      console.log(`PASS alerts ${width}: light/dark, filters, acknowledgement, history, stale data, API outage and permissions`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
