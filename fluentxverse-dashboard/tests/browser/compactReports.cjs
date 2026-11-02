const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.DASHBOARD_TEST_URL || 'http://127.0.0.1:5280';
const details = 'The participant could not connect. Please review the complete classroom timeline and attendance records before making a decision. '.repeat(4);

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync('/tmp/fluentxverse-compact-reports', { recursive: true });
  try {
    for (const width of [1566, 1024, 850, 768, 390, 320]) for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin === base) return route.continue();
        assert(['GET', 'OPTIONS'].includes(request.method()), 'Read-only layout test');
        let json = { success: true, data: [] };
        if (url.pathname === '/admin/me') json.user = { userId: 'qa-admin', username: 'QA', role: 'superadmin' };
        if (url.pathname === '/admin/operations/access') json.data = { id: 'qa-admin', role: 'superadmin', permissions: ['support', 'qa', 'finance', 'operations'] };
        if (url.pathname === '/admin/operations/reports') json.data = [
          { id: 'short-report', bookingId: 'lesson-short', source: 'student', tutorIssueLabel: 'Tutor did not join the classroom', details: '', status: 'resolved', priority: 'normal', createdAt: '2026-10-12T02:17:00Z', internalHistory: [], reviewHistory: [] },
          { id: 'long-report', bookingId: 'lesson-long', source: 'student', tutorIssueLabel: 'Tutor did not join the classroom', details, status: 'under_review', priority: 'urgent', createdAt: '2026-10-08T11:33:00Z', dueAt: '2026-10-08T12:00:00Z', internalHistory: [], reviewHistory: [] },
          { id: 'title-report', bookingId: 'lesson-with-a-long-identifier-for-testing', source: 'tutor', tutorIssueLabel: 'Student disconnected repeatedly during the lesson and could not return to the classroom', details: '', status: 'submitted', priority: 'high', createdAt: '2026-10-08T11:33:00Z', internalHistory: [], reviewHistory: [] },
        ];
        return route.fulfill({ json });
      });
      await page.goto(`${base}/lesson-operations?tab=issues`, { waitUntil: 'networkidle' });
      const reports = page.locator('.ops-report-item'); await expect(reports).toHaveCount(3);
      const first = reports.first(), second = reports.nth(1);
      const firstBox = await first.boundingBox(), secondBox = await second.boundingBox();
      assert(firstBox.height <= (width > 850 ? 140 : 245), `Short report is compact at ${width}px: ${firstBox.height}px`);
      assert(secondBox.height <= (width > 850 ? 170 : 280), `Detailed report is compact at ${width}px: ${secondBox.height}px`);
      const overlap = await reports.evaluateAll(elements => elements.some(el => {
        const visible = [...el.querySelectorAll(':scope > .ops-report-heading, :scope > .ops-report-meta, :scope > .ops-report-actions, :scope > .ops-report-details')].map(child => child.getBoundingClientRect());
        return visible.some((a, index) => visible.slice(index + 1).some(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1));
      }));
      assert.equal(overlap, false, 'Report fields and actions never overlap');
      if (width > 850) {
        const actions = await first.locator('.ops-report-actions').boundingBox(), heading = await first.locator('.ops-report-heading').boundingBox();
        assert(actions.x >= heading.x + heading.width && actions.y < heading.y + heading.height, 'Desktop actions sit beside the heading');
      }
      await page.screenshot({ path: `/tmp/fluentxverse-compact-reports/${width}-${theme}.png`, fullPage: true });
      await second.locator('.ops-report-details > summary').click();
      await expect(second.locator('.ops-report-details-body p').first()).toHaveText(details.trim());
      assert((await second.boundingBox()).height > secondBox.height, 'Full details expand normally');
      await second.locator('.ops-report-details > summary').click();
      await first.getByRole('button', { name: 'Review', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible(); await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px ${theme}: compact rows (${firstBox.height}px / ${secondBox.height}px), no overlaps, full details and review action`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
