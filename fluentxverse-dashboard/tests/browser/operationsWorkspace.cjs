const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.DASHBOARD_TEST_URL || 'http://127.0.0.1:5279';
const widths = (process.env.OPERATIONS_WIDTHS || '1566,1024,390,320').split(',').map(Number);
const views = [['live', 'Live', 'Live lessons'], ['lessons', 'Lessons', 'All lessons'], ['schedule', 'Schedule', 'Schedule'], ['notes', 'Notes', 'Outstanding notes'], ['issues', 'Issues', 'Issue reports'], ['feedback', 'Feedback', 'Student feedback'], ['performance', 'Performance', 'Tutor performance'], ['payments', 'Payments', 'Payments'], ['audit', 'Audit', 'Audit log'], ['permissions', 'Permissions', 'Admin permissions']];
const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const start = `${day}T10:00:00+08:00`;
const lesson = { bookingId: 'lesson-001', slotDateTime: start, durationMinutes: 25, outcome: 'both_attended',
  tutor: { id: 'tutor-1', name: 'Alex Rivera', email: 'alex@example.test' }, student: { id: 'student-1', name: 'Mika Tanaka', email: 'mika@example.test' },
  notes: { notesStatus: 'submitted' }, presence: [{ role: 'tutor', callState: 'connected' }, { role: 'student', callState: 'unknown' }], alert: 'In progress' };

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync('/tmp/fluentxverse-operations-workspace', { recursive: true });
  try {
    for (const width of widths) for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
      const errors = [], requests = [], writes = [];
      let caps = ['support', 'qa', 'operations', 'finance'], role = 'superadmin', failRead = false, failSave = false, empty = false;
      const reports = Array.from({ length: 13 }, (_, index) => ({ id: `report-${index + 1}`, bookingId: `lesson-${String(index + 1).padStart(3, '0')}`, source: index % 2 ? 'tutor' : 'student',
        tutorIssueLabel: index % 2 ? 'Student connection was interrupted' : 'Tutor did not join the classroom', reason: 'connection', details: 'The participant could not connect to the lesson. Please review the attendance and classroom timeline.',
        priority: index === 0 ? 'urgent' : 'normal', status: ['submitted', 'resolved', 'under_review'][index % 3], createdAt: start,
        dueAt: '2026-10-01T10:00:00Z', internalHistory: [{ action: 'case_updated', comment: 'Waiting for support follow-up', actorId: 'admin-1', at: start }], reviewHistory: [] }));
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin === base) return route.continue();
        const path = url.pathname;
        let json = { success: true, data: [] };
        if (path === '/admin/me') json.user = { userId: 'admin-1', username: 'QA', role };
        if (path === '/admin/notifications') json.data = { notifications: [], unreadCount: 0 };
        if (path === '/admin/tutors') json.data = { tutors: [{ id: 'tutor-1', givenName: 'Alex', familyName: 'Rivera', email: 'alex@example.test' }], total: 1 };
        if (path.startsWith('/admin/operations/')) {
          const resource = path.slice('/admin/operations'.length); requests.push({ resource, query: Object.fromEntries(url.searchParams), method: request.method() });
          if (!['GET', 'OPTIONS'].includes(request.method())) {
            assert(resource.match(/^\/(reports\/(student|tutor)\/report-\d+(\/review)?|admins\/admin-2\/permissions|lessons\/refund-pending\/refund)$/), 'Only mocked workflow mutations');
            const body = request.postDataJSON(); writes.push({ resource, body });
            if (failSave) return route.fulfill({ status: 409, json: { success: false, error: 'This record changed. Refresh before saving.' } });
            if (resource.startsWith('/reports/')) Object.assign(reports.find(report => resource.includes('/' + report.id)), body);
            return route.fulfill({ json });
          }
          if (resource === '/access') json.data = { id: 'admin-1', role, permissions: caps };
          if (failRead && resource !== '/access') return route.fulfill({ status: 503, json: { success: false, error: 'Operations temporarily unavailable' } });
          if (resource === '/lessons') json.data = { rows: empty ? [] : [{ ...lesson, bookingId: url.searchParams.get('page') === '2' ? 'lesson-page-two' : lesson.bookingId }], total: empty ? 0 : 51, totalPages: empty ? 0 : 2 };
          if (resource === '/slots') json.data = empty ? [] : [{ slotId: 'slot-1', slotDate: day, slotTime: '10:00', status: 'open', tutor: lesson.tutor }];
          if (resource === '/reports') json.data = empty ? [] : reports;
          if (resource === '/admins') json.data = empty ? [] : [{ id: 'admin-1', name: 'QA Owner', role: 'superadmin', permissions: ['support', 'qa', 'operations', 'finance'] }, { id: 'admin-2', name: 'Support Agent', role: 'admin', permissions: ['support'] }];
          if (resource === '/lessons/' + lesson.bookingId) json.data = { transactions: [{ id: 'refund-transaction', type: 'refund', status: 'completed', createdAt: start }] };
          if (resource === '/surveys') json.data = { total: empty ? 0 : 12, responseRate: empty ? null : 60, average: empty ? null : 4.8,
            topics: empty ? [] : [{ id: 'audio', label: 'Audio quality', positiveEnabled: true, positive: 10, improvement: 2 }],
            rows: empty ? [] : Array.from({ length: 12 }, (_, index) => ({ bookingId: 'feedback-' + index, tutor: lesson.tutor, startsAt: start, rating: 5, comment: 'Clear explanations and helpful feedback ' + (index + 1) })) };
          if (resource === '/performance/tutor-1') json.data = { slots: { bookable: 24, booked: 16 }, lessons: { total: 16, attended: 14, teachingHours: 5.8 },
            cancellation: { rate: 6.2 }, reliability: { score: 95 }, notes: { overdue: 1 }, rating: { average: 4.9 }, attendance: { present: 14, absent: 1, unverified: 1 }, recentLessons: [lesson], totalPages: 1 };
          if (resource === '/payments') json.data = { review: empty ? [] : [{ bookingId: 'refund-review', refundStatus: 'review', refundError: 'Uncertain transfer' }, { bookingId: 'refund-pending', refundStatus: 'pending', refundReviewReason: 'Cancelled lesson' }],
            rows: empty ? [] : [{ id: 'transaction-001', type: 'refund', status: 'completed', bookingId: lesson.bookingId, createdAt: start }] };
          if (resource === '/audit') json.data = empty ? [] : [{ id: 'audit-1', action: 'notes_reopened', actorId: 'admin-1', subjectId: lesson.bookingId, createdAt: start, reason: 'Support checked the lesson notes', beforeJson: '{"state":"closed"}', afterJson: '{"state":"open"}' }];
        } else if (path.startsWith('/lesson-privacy/admin/reports/')) json.data = [];
        else assert(['GET', 'OPTIONS'].includes(request.method()), 'No unmocked writes');
        return route.fulfill({ json });
      });
      await page.goto(`${base}/lesson-operations`, { waitUntil: 'networkidle' });
      const root = page.locator('.ops-workspace');
      const switchView = async key => {
        const view = views.find(view => view[0] === key);
        if (width <= 650) await root.locator('.ops-mobile-view select').selectOption(key);
        else await page.getByRole('navigation', { name: 'Operations views', exact: true }).getByRole('button', { name: view[1], exact: true }).click();
        await expect(root.locator('.ops-view-heading h2')).toHaveText(view[2]);
        await expect(root.locator('.ops-results')).toHaveAttribute('aria-busy', 'false');
      };
      await expect(root.locator('.ops-live-item')).toHaveCount(1);
      await expect(root).toContainText('Call reported connected'); await expect(root).toContainText('Call unconfirmed');
      assert(await root.locator('.admin-art').evaluate(image => image.complete && image.naturalWidth > 0), 'Existing artwork renders');
      for (const [key] of views) {
        await switchView(key);
        if (key === 'lessons') {
          await expect(root.getByRole('link', { name: 'Open lesson', exact: true })).toHaveAttribute('href', '/lesson-operations/lesson-001');
          await root.getByRole('button', { name: 'Next page', exact: true }).click(); await expect(root.locator('.ops-results')).toContainText('lesson-page-two');
          await root.locator('.ops-search-field input').fill('Alex'); await root.getByRole('button', { name: 'Search', exact: true }).click();
          await expect.poll(() => requests.filter(request => request.resource === '/lessons').at(-1)?.query.search).toBe('Alex');
          assert.equal(requests.filter(request => request.resource === '/lessons').at(-1).query.page, '1');
          await root.getByRole('button', { name: 'Clear search', exact: true }).click();
        }
        if (key === 'schedule') await expect(root.getByRole('heading', { name: /Published slots/ })).toBeVisible();
        if (key === 'issues') {
          await expect(root.locator('.ops-report-item')).toHaveCount(10);
          const report = root.locator('.ops-report-item').first();
          await expect(report.getByText('Review overdue', { exact: true })).toBeVisible();
          assert.equal(requests.filter(request => request.resource.includes('/outcome')).length, 0, 'No unreleased outcome workflow requests');
          await expect(report.getByRole('button', { name: 'Private evidence', exact: true })).toBeHidden();
          await report.locator('.ops-report-details > summary').click();
          await report.getByRole('button', { name: 'Private evidence', exact: true }).click();
          await expect(report).toContainText("No unexpired evidence is shared by this report's author.");
          await report.getByRole('button', { name: 'Assign & update', exact: true }).click();
          const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
          await dialog.getByLabel('Assigned admin').selectOption('admin-2'); await dialog.getByLabel('Priority').selectOption('high');
          await dialog.getByLabel('Internal update').fill('Support follow-up assigned.');
          await dialog.getByRole('button', { name: 'Confirm', exact: true }).click(); await expect(dialog).toHaveCount(0);
          await expect(root.locator('.ops-results')).toHaveAttribute('aria-busy', 'false');
          assert.equal(writes.at(-1).body.assigneeId, 'admin-2');
          await root.locator('.ops-report-item').first().getByRole('button', { name: 'Review', exact: true }).click();
          await expect(dialog).toBeVisible();
          await dialog.getByLabel('Status').selectOption('resolved');
          await dialog.getByLabel('Resolution visible to reporter').fill('Attendance and classroom timeline reviewed.');
          failSave = true; await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
          await expect(dialog.getByRole('alert')).toContainText('record changed');
          await expect(dialog.getByLabel('Resolution visible to reporter')).toHaveValue('Attendance and classroom timeline reviewed.');
          const box = await dialog.boundingBox(); assert(box.x >= 8 && box.x + box.width <= width - 8, 'Dialog fits viewport');
          failSave = false; await dialog.getByRole('button', { name: 'Confirm', exact: true }).click(); await expect(dialog).toHaveCount(0);
          await expect(root.locator('.ops-results')).toHaveAttribute('aria-busy', 'false');
          await root.getByLabel('Status', { exact: true }).selectOption('resolved');
          await expect(root.locator('.ops-report-item')).toHaveCount(reports.filter(report => report.status === 'resolved').length);
          await root.getByLabel('Status', { exact: true }).selectOption('all');
          await root.getByRole('button', { name: 'Next page', exact: true }).click(); await expect(root.locator('.ops-report-item')).toHaveCount(3);
          await root.getByRole('button', { name: 'Previous page', exact: true }).click();
        }
        if (key === 'feedback') { await expect(root.locator('.ops-comments article')).toHaveCount(10); await root.getByRole('button', { name: 'Next page', exact: true }).click(); await expect(root.locator('.ops-comments article')).toHaveCount(2); }
        if (key === 'performance') { await root.getByLabel('Tutor', { exact: true }).selectOption('tutor-1'); await expect(root.getByText('Bookable slots', { exact: true })).toBeVisible(); }
        if (key === 'payments') {
          const review = root.locator('tr').filter({ hasText: 'refund-review' }); await expect(review.getByRole('button', { name: 'Approve refund' })).toHaveCount(0);
          await root.getByRole('button', { name: 'Approve refund', exact: true }).click();
          const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible(); await dialog.getByLabel('Reason', { exact: true }).fill('Cancellation approved by support.');
          await dialog.getByRole('button', { name: 'Confirm', exact: true }).click(); await expect(dialog).toHaveCount(0);
          assert.equal(writes.at(-1).resource, '/lessons/refund-pending/refund');
        }
        if (key === 'audit') {
          await expect(root).toContainText('Support checked the lesson notes'); await root.locator('.ops-search-field input').fill('lesson-001');
          await root.getByRole('button', { name: 'Search', exact: true }).click();
          await expect.poll(() => requests.filter(request => request.resource === '/audit').at(-1)?.query.subjectId).toBe('lesson-001');
        }
        if (key === 'permissions') {
          await root.getByRole('button', { name: 'Edit permissions', exact: true }).click(); const dialog = page.getByRole('dialog');
          await dialog.getByLabel('qa', { exact: true }).check(); await dialog.getByLabel('Reason', { exact: true }).fill('QA access approved.');
          await dialog.getByRole('button', { name: 'Confirm', exact: true }).click(); await expect(dialog).toHaveCount(0); assert(writes.at(-1).body.permissions.includes('qa'));
        }
        await expect(root.locator('.ops-results')).toHaveAttribute('aria-busy', 'false');
        await root.locator('.ops-workspace-heading').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `/tmp/fluentxverse-operations-workspace/${width}-${theme}-${key}.png` });
        const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
          overflow: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth && !el.closest('.ops-table-scroll'))
            .slice(0, 10).map(el => ({ tag: el.tagName, className: el.className, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right })) }));
        assert(layout.scrollWidth <= layout.width, key + ': no horizontal page overflow: ' + JSON.stringify(layout));
        const clipped = await root.locator('.ops-filter-bar input, .ops-filter-bar select, .ops-report-actions button').evaluateAll(elements => elements.some(el => {
          const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < 0 || r.right > innerWidth);
        }));
        assert.equal(clipped, false, key + ': filters and primary actions fit');
      }
      failRead = true; await switchView('lessons'); await expect(root.getByRole('alert')).toContainText('temporarily unavailable');
      failRead = false; await root.getByRole('button', { name: 'Retry', exact: true }).click(); await expect(root.locator('.ops-table tbody tr')).toHaveCount(1);
      empty = true; await root.getByRole('button', { name: 'Refresh', exact: true }).click(); await expect(root).toContainText('No lessons in this date range.');
      role = 'admin'; caps = ['support']; await page.goto(`${base}/lesson-operations?tab=issues`, { waitUntil: 'networkidle' });
      if (width <= 650) { assert.equal(await root.locator('.ops-mobile-view option[value="payments"]').count(), 0); assert.equal(await root.locator('.ops-mobile-view option[value="permissions"]').count(), 0); }
      else { await expect(page.getByRole('navigation', { name: 'Operations views' }).getByRole('button', { name: 'Feedback', exact: true })).toHaveCount(0); await expect(page.getByRole('navigation', { name: 'Operations views' }).getByRole('button', { name: 'Permissions', exact: true })).toHaveCount(0); }
      const before = requests.filter(request => request.resource === '/payments').length;
      await page.goto(`${base}/lesson-operations?tab=payments`, { waitUntil: 'networkidle' });
      await expect(root.getByRole('alert')).toContainText('do not have access'); assert.equal(requests.filter(request => request.resource === '/payments').length, before);
      assert.deepEqual(errors, []); await page.close();
      console.log(`PASS ${width}px ${theme}: all ten views, filters, pagination, evidence, review/assignment/refund/permission workflows, errors and role restrictions`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
