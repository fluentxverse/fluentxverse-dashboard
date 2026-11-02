const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.INTERVIEW_DASHBOARD_URL || 'http://127.0.0.1:5242';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const [width, timezoneId] of [[1440, 'America/Los_Angeles'], [390, 'Asia/Tokyo']]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, timezoneId });
      let reads = 0;
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api/, '');
        if (!/^\/(admin|interview|notifications|inbox)(\/|$)/.test(path)) return route.continue();
        const headers = { 'access-control-allow-origin': new URL(base).origin, 'access-control-allow-credentials': 'true',
          'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,cache-control,pragma' };
        const reply = data => route.fulfill({ headers, json: { success: true, data } });
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (path === '/admin/me') return route.fulfill({ headers, json: { success: true, user: { userId: 'period-admin', username: 'Reviewer', role: 'superadmin' } } });
        if (path === '/admin/socket-token') return route.fulfill({ headers, json: { success: false } });
        if (path === '/interview/week') { reads++; return reply({ slots: [], weekStart: '2026-10-26', weekEnd: '2026-11-01' }); }
        return reply([]);
      });
      const start = new Date('2026-10-28T11:59:00+08:00');
      await page.clock.install({ time: start });
      await page.goto(`${base}/interviews`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('region', { name: 'Interview calendar' }).waitFor();
      await page.clock.pauseAt(new Date('2026-10-28T11:59:59+08:00'));
      const periods = page.getByRole('group', { name: 'Time of day' });
      const morning = periods.getByRole('button', { name: /^Morning/ });
      const afternoon = periods.getByRole('button', { name: /^Afternoon/ });
      const evening = periods.getByRole('button', { name: /^Evening/ });
      await expect(morning).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.time-label').first()).toHaveText('5:00 AM');
      const originalReads = reads;
      await evening.click();
      await expect(evening).toHaveAttribute('aria-pressed', 'true');
      await page.clock.fastForward(1500);
      await expect(afternoon).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.time-label').first()).toHaveText('12:00 PM');
      await morning.click();
      await page.clock.fastForward(2000);
      await expect(morning).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: 'Today', exact: true }).click();
      await expect(afternoon).toHaveAttribute('aria-pressed', 'true');
      await page.clock.setSystemTime(new Date('2026-10-28T17:59:59+08:00'));
      await page.clock.fastForward(1500);
      await expect(evening).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.time-label').last()).toHaveText('11:30 PM');
      await page.clock.setSystemTime(new Date('2026-10-29T00:00:00+08:00'));
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await expect(morning).toHaveAttribute('aria-pressed', 'true');
      await page.clock.setSystemTime(new Date('2026-10-29T14:00:00+08:00'));
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect(afternoon).toHaveAttribute('aria-pressed', 'true');
      assert.equal(reads, originalReads, 'Period switching does not reload calendar data');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.clock.runFor(1000);
      await expect(afternoon).toHaveAttribute('aria-pressed', 'true');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px ${timezoneId}: initial Manila period, noon/evening/midnight, wake, manual browsing and Today`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
