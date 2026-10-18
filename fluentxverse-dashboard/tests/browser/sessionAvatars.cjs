const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ADMIN_TEST_URL || 'http://127.0.0.1:5180';
const output = '/tmp/admin-session-avatars';
const sessions = [
  { id: 'loaded', tutorAvatar: 'http://fluentxverse-seaweed-filer:8888/user/tutor/profile/photo.png?t=1', studentAvatar: 'https://api.fluentxverse.xyz/lesson/files/user/student/photo.png' },
  { id: 'broken', tutorAvatar: '/user/tutor/profile/missing.png', studentAvatar: '/user/student/missing.png' },
  { id: 'empty', tutorAvatar: null, studentAvatar: null },
].map((session, index) => ({
  ...session, tutorId: 'tutor', tutorName: `Tutor ${index + 1}`, tutorEmail: 'tutor@example.test',
  studentId: 'student', studentName: `Student ${index + 1}`, studentEmail: 'student@example.test',
  slotDate: '2026-10-11', slotTime: '19:30', durationMinutes: 25, status: 'completed',
  attendanceTutor: 'present', attendanceStudent: 'present', bookedAt: '2026-10-10T00:00:00Z',
}));

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const photo = await fs.readFile('public/assets/img/logo/icon_logo.png');
  await fs.mkdir(output, { recursive: true });
  try {
    for (const width of [1566, 1280, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const writes = [], images = [], errors = [], requests = [];
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):8765)\//, route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname;
        requests.push({ path, method: request.method() });
        const headers = { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'Content-Type, Authorization' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (!['GET', 'OPTIONS'].includes(request.method())) { writes.push(path); return route.abort(); }
        if (path.startsWith('/lesson/files/')) {
          images.push(request.url());
          return path.endsWith('missing.png') ? route.fulfill({ status: 404, headers }) : route.fulfill({ contentType: 'image/png', body: photo, headers });
        }
        let json = { success: true, data: [] };
        if (path === '/admin/me') json = { success: true, user: { userId: 'avatar-admin', username: 'Admin', role: 'superadmin' } };
        else if (path === '/admin/operations/access') json.data = { permissions: ['support', 'qa'] };
        else if (path === '/admin/sessions') json.data = { sessions, total: sessions.length, page: 1, totalPages: 1 };
        else if (path === '/admin/sessions/stats') json.data = { totalBookings: 3, completedSessions: 3 };
        else if (path.startsWith('/admin/sessions/')) {
          const session = sessions.find(session => path.endsWith(`/${session.id}`));
          json.data = session.id === 'empty' ? session : {
            id: session.id,
            tutor: { id: session.tutorId, name: session.tutorName, email: session.tutorEmail, avatar: session.tutorAvatar },
            student: { id: session.studentId, name: session.studentName, email: session.studentEmail, avatar: session.studentAvatar },
            schedule: { date: session.slotDate, time: session.slotTime, durationMinutes: session.durationMinutes, timezone: 'PHT' },
            status: session.status,
            attendance: { tutor: session.attendanceTutor, student: session.attendanceStudent },
            timestamps: { bookedAt: session.bookedAt, completedAt: null, cancelledAt: null },
            ticketUsed: null,
          };
        }
        return route.fulfill({ json, headers });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/sessions');
      await page.locator('.sessions-table tbody tr').nth(2).waitFor().catch(async error => {
        await page.screenshot({ path: `${output}/debug-${width}.png` });
        console.error({ url: page.url(), requests, errors, body: await page.locator('body').innerText() });
        throw error;
      });
      await page.waitForFunction(() => {
        const table = document.querySelector('.sessions-table');
        return table && [...table.querySelectorAll('img')].every(img => img.complete && img.naturalWidth > 0)
          && table.querySelectorAll('.avatar-placeholder').length === 4;
      });
      const geometry = await page.locator('.sessions-table').evaluate(table => {
        const bounds = cell => { const rect = cell.getBoundingClientRect(); return { x: rect.x, width: rect.width, display: getComputedStyle(cell).display }; };
        return { heads: [...table.tHead.rows[0].cells].map(bounds), rows: [...table.tBodies[0].rows].map(row => [...row.cells].map(bounds)) };
      });
      for (const row of geometry.rows) {
        assert.equal(row.length, 7);
        row.forEach((cell, index) => {
          assert.equal(cell.display, 'table-cell');
          assert(Math.abs(cell.x - geometry.heads[index].x) < 1, 'Session columns align with their headings');
          assert(Math.abs(cell.width - geometry.heads[index].width) < 1);
        });
      }
      assert.equal(await page.locator('.sessions-table tbody tr').first().locator('img').count(), 2);
      assert.equal(await page.locator('.sessions-table tbody tr').nth(1).locator('img').count(), 0);
      assert(await page.locator('.sessions-table .session-avatar').evaluateAll(avatars => avatars.every(avatar => {
        const rect = avatar.getBoundingClientRect(); return rect.width === 40 && rect.height === 40;
      })));
      assert(images.every(url => !url.includes('api.fluentxverse.xyz') && !url.includes('fluentxverse-seaweed-filer')));
      assert(images.some(url => url.includes('/lesson/files/user/tutor/profile/photo.png?t=1')));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `${output}/sessions-${width}.png`, animations: 'disabled' });
      for (const index of [0, 1, 2]) {
        await page.locator('.sessions-table tbody tr').nth(index).getByTitle('View Details', { exact: true }).click();
        await page.locator('.session-detail-modal .participant-info').nth(1).waitFor();
        assert.equal(await page.locator('.session-detail-modal .participant-name').first().innerText(), sessions[index].tutorName);
        assert.equal(await page.locator('.session-detail-modal .participant-name').nth(1).innerText(), sessions[index].studentName);
        await page.waitForFunction(expected => {
          const modal = document.querySelector('.session-detail-modal');
          const images = [...modal.querySelectorAll('.session-avatar img')];
          return images.length === expected && images.every(img => img.complete && img.naturalWidth > 0);
        }, index === 0 ? 2 : 0);
        assert.equal(await page.locator('.session-detail-modal .avatar-placeholder').count(), index === 0 ? 0 : 2);
        assert(await page.locator('.session-detail-modal .session-avatar').evaluateAll(avatars => avatars.every(avatar => avatar.getBoundingClientRect().width === 48)));
        if (index === 0) await page.screenshot({ path: `${output}/details-${width}.png`, animations: 'disabled' });
        await page.locator('.session-detail-modal .modal-close').click();
      }
      assert.deepEqual(writes, []);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}: public photo URLs, decoded tutor/student images, failed/missing photo fallbacks, aligned columns and detail avatars`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
