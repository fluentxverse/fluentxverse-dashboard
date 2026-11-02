const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.DASHBOARD_TEST_URL || 'http://127.0.0.1:5277';
const widths = (process.env.ANALYTICS_WIDTHS || '1566,1024,390,320').split(',').map(Number);

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync('/tmp/fluentxverse-analytics', { recursive: true });
  try {
    for (const width of widths) for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height: 950 }, colorScheme: theme, reducedMotion: 'reduce' });
      const errors = [], periods = [];
      let releaseInitial, initial = true, fail = false;
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin === base) return route.continue();
        assert(['GET', 'OPTIONS'].includes(request.method()), 'Read-only test');
        let json = { success: true, data: [] };
        if (url.pathname === '/admin/me') json.user = { userId: 'qa-admin', username: 'QA', role: 'superadmin' };
        if (url.pathname === '/admin/notifications') json.data = { notifications: [], unreadCount: 0 };
        if (url.pathname === '/admin/analytics') {
          const period = url.searchParams.get('period'); periods.push(period);
          if (initial) { initial = false; await new Promise(resolve => { releaseInitial = resolve; }); }
          if (fail) return route.fulfill({ status: 503, json: { success: false, error: 'Analytics unavailable' } });
          json.data = { period, summary: { totalTutors: 12, totalStudents: 18, suspendedTutors: 1, suspendedStudents: 0, newTutors: 2, newStudents: 3 },
            tutorTrend: Array.from({ length: 7 }, (_, index) => ({ date: `2026-10-${21 + index}`, count: index + 1 })), studentTrend: [],
            examStats: period === 'quarter' ? [] : period === 'year' ? [{ type: 'written', total: 0, passed: 0 }] : [
              { type: 'written', total: 10, passed: 8 }, { type: 'speaking', total: 4, passed: 3 }
            ], suspensionStats: period === 'quarter' ? [] : [{ action: 'suspended', targetType: 'tutor', count: 2 }] };
        }
        if (url.pathname === '/admin/analytics/suspensions') json.data = {
          reasonDistribution: [{ reason: 'Attendance', count: 2 }], monthlyTrend: [],
          recentLogs: [{ id: 'qa-log', action: 'suspended', targetType: 'tutor', reason: 'Attendance', createdAt: '2026-10-28T12:00:00Z', adminName: 'QA' }]
        };
        return route.fulfill({ json });
      });
      await page.goto(`${base}/analytics`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Loading analytics...', { exact: true })).toBeVisible();
      await expect.poll(() => !!releaseInitial).toBe(true); releaseInitial();
      const heading = page.getByRole('heading', { name: /Analytics Dashboard/ });
      await expect(heading).toBeVisible();
      const exposed = await heading.evaluate(el => {
        const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return el === hit || el.contains(hit);
      });
      assert.equal(exposed, true, 'Analytics heading must not be covered by an expanded chart fill');
      const checkProgress = async ratios => {
        const fills = page.locator('.simple-chart-progress-fill, .progress-stat .progress-fill');
        await expect(fills).toHaveCount(ratios.length);
        const geometry = await fills.evaluateAll(elements => elements.map(el => {
          const r = el.getBoundingClientRect(), parent = el.parentElement.getBoundingClientRect();
          return { height: r.height, width: r.width, parentWidth: parent.width,
            contained: r.left >= parent.left - 1 && r.right <= parent.right + 1 && r.top >= parent.top - 1 && r.bottom <= parent.bottom + 1 };
        }));
        geometry.forEach((value, index) => {
          assert.equal(value.height, 8, 'Exam progress fill stays eight pixels tall');
          assert(value.contained, 'Progress fill stays inside its track');
          assert(Math.abs(value.width - value.parentWidth * ratios[index]) < 1, 'Pass rate width matches its data');
        });
      };
      await checkProgress([0.8, 0.75]);
      const bar = page.locator('.simple-chart-bar .simple-chart-container');
      await expect(bar).toBeVisible(); assert.equal((await bar.boundingBox()).height, 200);
      await expect(page.locator('.simple-chart-bar-fill')).toHaveCount(7);
      assert((await page.locator('.simple-chart-bar-fill').last().boundingBox()).height > 50, 'Registration bars are nonblank');
      const donut = page.locator('.simple-chart-donut svg'); await expect(donut).toBeVisible();
      assert.equal((await donut.boundingBox()).width, 150);
      assert(await donut.evaluate(el => {
        const r = el.getBoundingClientRect(), parent = el.closest('.chart-card').getBoundingClientRect();
        return r.left >= parent.left && r.right <= parent.right && r.bottom <= parent.bottom;
      }), 'Donut fits its card');
      await page.screenshot({ path: `/tmp/fluentxverse-analytics/${width}-${theme}-overview.png`, fullPage: true });
      await page.locator('.analytics-page .tab-buttons button').filter({ hasText: 'Suspensions' }).click();
      await expect(page.getByRole('heading', { name: /Recent Suspension Activity/ })).toBeVisible();
      await page.screenshot({ path: `/tmp/fluentxverse-analytics/${width}-${theme}-suspensions.png`, fullPage: true });
      await page.locator('.analytics-page .tab-buttons button').filter({ hasText: 'Overview' }).click();
      await page.locator('.period-select').selectOption('quarter');
      await expect(page.getByText('No exam data available', { exact: true })).toBeVisible();
      await expect(page.locator('.simple-chart-empty')).toContainText('No data available');
      await page.locator('.period-select').selectOption('year'); await checkProgress([0]);
      fail = true; await page.locator('.period-select').selectOption('month');
      await expect(page.locator('.analytics-page .error-state')).toContainText('503');
      fail = false; await page.locator('.analytics-page .retry-btn').click(); await checkProgress([0.8, 0.75]);
      assert(periods.includes('quarter') && periods.includes('year') && periods.includes('month'));
      // Other pages share the compiled stylesheet; returning must not restore a collision.
      await page.goto(`${base}/sessions`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('navigation', { name: 'Sessions pagination (top)', exact: true })).toBeVisible();
      await page.locator('.sidebar a[href="/analytics"]').evaluate(el => el.click());
      await expect(heading).toBeVisible(); await checkProgress([0.8, 0.75]);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await page.close(); console.log(`PASS ${width}px ${theme}: analytics visible, bounded progress/bars/donut, tabs, periods, loading, empty/error/retry and route return`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
