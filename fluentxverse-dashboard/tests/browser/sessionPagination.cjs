const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.DASHBOARD_TEST_URL || 'http://127.0.0.1:5276';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync('/tmp/fluentxverse-session-pagination', { recursive: true });
  try {
    for (const width of [1566, 390, 320]) for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height: 950 }, colorScheme: theme, reducedMotion: 'reduce' });
      const errors = [], requests = [];
      let fail = false, delayed = false, releaseDelayed, total = 63;
      const records = Array.from({ length: 63 }, (_, index) => ({
        id: `session-${index + 1}`, tutorId: 'qa-tutor', tutorName: `Tutor ${index + 1}`, tutorEmail: 'tutor@example.test',
        studentId: 'qa-student', studentName: 'Student', studentEmail: 'student@example.test',
        slotDate: '2026-10-28', slotTime: '21:30', status: 'completed', durationMinutes: 25,
        attendanceTutor: 'present', attendanceStudent: null
      }));
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin === base) return route.continue();
        assert(['GET', 'OPTIONS'].includes(request.method()), 'No customer data writes');
        let json = { success: true, data: [] };
        if (url.pathname === '/admin/me') json.user = { userId: 'qa-admin', username: 'QA', role: 'superadmin' };
        if (url.pathname === '/admin/notifications') json.data = { notifications: [], unreadCount: 0 };
        if (url.pathname === '/admin/sessions/stats') json.data = { totalBookings: 63, completedSessions: 63, upcomingSessions: 0,
          cancelledSessions: 0, todaySessions: 0, totalHours: 26.25, completionRate: 100, noShowSessions: 0 };
        if (url.pathname === '/admin/sessions') {
          const query = Object.fromEntries(url.searchParams); requests.push(query);
          const current = Number(query.page), size = Number(query.limit);
          const count = query.search === 'none' ? 0 : query.search === 'Tutor 63' ? 1 : total;
          const rows = query.search === 'Tutor 63' ? records.slice(-1) : records.slice(0, count);
          json.data = { sessions: rows.slice((current - 1) * size, current * size), page: current, total: count, totalPages: Math.ceil(count / size) };
          if (delayed) { delayed = false; await new Promise(resolve => { releaseDelayed = resolve; }); }
          if (fail) return route.fulfill({ status: 503, json: { success: false, error: 'Sessions temporarily unavailable' } });
        }
        return route.fulfill({ json });
      });
      await page.goto(`${base}/sessions`, { waitUntil: 'networkidle' });
      const top = page.getByRole('navigation', { name: 'Sessions pagination (top)', exact: true });
      const bottom = page.getByRole('navigation', { name: 'Sessions pagination (bottom)', exact: true });
      const rows = page.locator('.sessions-table tbody tr');
      const ready = async text => {
        await expect(top).toContainText(text);
        await expect(top.getByRole('combobox')).toBeEnabled();
        await expect(bottom).toContainText(text);
      };
      await ready('1-10 of 63 sessions'); await expect(rows).toHaveCount(10);
      await expect(top.getByRole('button', { name: 'Previous page', exact: true })).toBeDisabled();
      await top.getByRole('button', { name: 'Next page', exact: true }).click();
      await ready('11-20 of 63 sessions'); await expect(rows.first()).toContainText('Tutor 11');
      for (let current = 3; current <= 7; current++) {
        await bottom.getByRole('button', { name: 'Next page', exact: true }).click();
        await ready(`${(current - 1) * 10 + 1}-${Math.min(current * 10, 63)} of 63 sessions`);
      }
      await ready('61-63 of 63 sessions'); await expect(rows).toHaveCount(3);
      await expect(top.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled();
      await page.getByPlaceholder('Search by tutor or student name...').fill('Tutor 63');
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await ready('1-1 of 1 sessions'); await expect(rows).toHaveCount(1);
      await expect.poll(() => requests.at(-1)?.search).toBe('Tutor 63'); assert.equal(requests.at(-1).page, '1');
      await page.getByPlaceholder('Search by tutor or student name...').fill('');
      await page.getByRole('button', { name: 'Search', exact: true }).click(); await ready('1-10 of 63 sessions');
      await top.getByRole('button', { name: 'Page 3', exact: true }).click(); await ready('21-30 of 63 sessions');
      await top.getByRole('combobox').selectOption('25'); await ready('1-25 of 63 sessions'); await expect(rows).toHaveCount(25);
      await expect(bottom.getByRole('combobox')).toHaveValue('25');
      await top.getByRole('button', { name: 'Next page', exact: true }).click(); await ready('26-50 of 63 sessions');
      await page.getByLabel('From date', { exact: true }).fill('2026-10-01'); await ready('1-25 of 63 sessions');
      await expect.poll(() => requests.at(-1)?.startDate).toBe('2026-10-01'); assert.equal(requests.at(-1).page, '1');
      await top.getByRole('button', { name: 'Next page', exact: true }).click(); await ready('26-50 of 63 sessions');
      await page.locator('.status-tabs button').filter({ hasText: 'Upcoming' }).click(); await ready('1-25 of 63 sessions');
      await expect.poll(() => requests.at(-1)?.status).toBe('confirmed'); await ready('1-25 of 63 sessions');
      // An older page response must not overwrite a newer filter response.
      delayed = true;
      await top.getByRole('button', { name: 'Next page', exact: true }).click();
      await expect.poll(() => !!releaseDelayed).toBe(true);
      await page.locator('.status-tabs button').filter({ hasText: 'Completed' }).click(); await ready('1-25 of 63 sessions');
      await expect.poll(() => requests.at(-1)?.status).toBe('completed'); await ready('1-25 of 63 sessions');
      releaseDelayed(); await page.waitForTimeout(150); await expect(rows.first()).toContainText('Tutor 1');
      total = 1;
      await top.getByRole('button', { name: 'Page 3', exact: true }).click(); await ready('1-1 of 1 sessions');
      await expect(top).toContainText('Page 1 of 1');
      await page.getByPlaceholder('Search by tutor or student name...').fill('none');
      await page.getByRole('button', { name: 'Search', exact: true }).click(); await ready('0 of 0 sessions');
      await expect(page.getByText('No sessions found', { exact: true })).toBeVisible();
      fail = true; await page.locator('.sessions-page .btn-refresh').click();
      await expect(page.locator('.error-message')).toContainText('503');
      await expect(top.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled();
      fail = false; total = 63;
      await page.getByPlaceholder('Search by tutor or student name...').fill('');
      await page.getByRole('button', { name: 'Search', exact: true }).click(); await ready('1-25 of 63 sessions');
      await top.getByRole('combobox').selectOption('10'); await ready('1-10 of 63 sessions');
      await top.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `/tmp/fluentxverse-session-pagination/${width}-${theme}.png` });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No horizontal page overflow');
      for (const pager of [top, bottom]) {
        const clipped = await pager.evaluate(el => {
          const parent = el.getBoundingClientRect();
          return [...el.querySelectorAll('button,select')].filter(item => getComputedStyle(item).display !== 'none')
            .some(item => { const r = item.getBoundingClientRect(); return r.left < Math.max(0, parent.left) || r.right > Math.min(innerWidth, parent.right); });
        });
        assert.equal(clipped, false, 'All pagination controls fit');
      }
      assert.deepEqual(errors, []);
      await page.close(); console.log(`PASS ${width}px ${theme}: paging, sizes, filters, stale responses, empty/error, bounds and responsive controls`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
