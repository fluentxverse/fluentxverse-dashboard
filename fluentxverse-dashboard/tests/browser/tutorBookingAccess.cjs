const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ADMIN_TEST_URL || 'http://127.0.0.1:5180';
const output = '/tmp/admin-tutor-booking-access';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const photo = await fs.readFile('public/assets/img/logo/icon_logo.png');
  await fs.mkdir(output, { recursive: true });
  try {
    for (const [width, permitted] of [[1566, true], [375, true], [1280, false]]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const now = Date.now(), future = new Date(now + 3 * 86400000).toISOString();
      const tutors = [
        { id: 'blocked', name: 'Blocked Tutor', profilePicture: 'http://fluentxverse-seaweed-filer:8888/user/tutor/profile/photo.png', isBlocked: true, blockExpiresAt: future },
        { id: 'open', name: 'Open Tutor', isBlocked: false },
        { id: 'expired', name: 'Expired Tutor', isBlocked: true, blockExpiresAt: '2020-01-01T00:00:00Z' },
        { id: 'suspended', name: 'Suspended Tutor', isBlocked: false, isSuspended: true, suspendedUntil: future },
        { id: 'indefinite', name: 'Indefinite Tutor', isBlocked: true, profilePicture: '/user/tutor/missing.png' },
        { id: 'waived', name: 'Waived Tutor', isBlocked: false, penaltyBlockOverrideUntil: future },
        { id: 'legacy', name: 'Legacy Tutor' },
      ].map(t => ({ email: `${t.id}@example.test`, status: 'certified', languages: ['English'], isSuspended: false, totalSessions: 0, rating: 5, ...t }));
      const writes = [], requests = [], errors = [];
      let fail = true;
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):8765)\//, async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname;
        requests.push(request.url());
        const headers = { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'Content-Type, Authorization' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (request.method() !== 'GET') {
          writes.push({ path, method: request.method(), body: request.postDataJSON() });
          assert(permitted && path === '/admin/operations/tutors/blocked/unblock' && request.method() === 'POST', 'Only the intended test unblock is allowed');
          if (fail) return route.fulfill({ status: 403, json: { success: false, error: 'Operations permission was removed.' }, headers });
          tutors[0].isBlocked = false; tutors[0].blockExpiresAt = undefined;
          tutors[0].penaltyBlockOverrideUntil = new Date(now + 7 * 86400000).toISOString();
          return route.fulfill({ json: { success: true }, headers });
        }
        if (path.startsWith('/lesson/files/')) return path.endsWith('missing.png') ? route.fulfill({ status: 404, headers }) : route.fulfill({ contentType: 'image/png', body: photo, headers });
        let json = { success: true, data: [] };
        if (path === '/admin/me') json = { success: true, user: { userId: 'tutor-admin', username: 'Admin', role: 'admin' } };
        else if (path === '/admin/operations/access') json.data = { permissions: permitted ? ['support', 'operations', 'finance'] : ['support'] };
        else if (path === '/admin/tutors') json.data = { tutors, total: tutors.length };
        else if (path === '/admin/operations/compensation') json.data = tutors.map(t => ({ tutorId: t.id, currency: 'USD', baseRateCents: 1000 }));
        return route.fulfill({ json, headers });
      });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/tutors');
      const rows = page.locator('.tutors-table tbody tr');
      await rows.nth(6).waitFor().catch(async error => {
        await page.screenshot({ path: `${output}/debug-${width}.png` });
        console.error({ url: page.url(), errors, requests, body: await page.locator('body').innerText() });
        throw error;
      });
      await page.waitForFunction(() => [...document.querySelectorAll('.tutors-table img')].every(img => img.complete && img.naturalWidth > 0)
        && document.querySelectorAll('.tutors-table img').length === 1);
      await page.waitForFunction(finance => document.querySelectorAll('.tutors-table thead th').length === (finance ? 11 : 10), permitted);
      assert.equal(await rows.nth(0).locator('.booking-access-status').innerText(), 'Blocked');
      assert((await rows.nth(0).locator('.tutor-booking-access small').innerText()).includes('PHT'));
      assert.equal(await rows.nth(1).locator('.booking-access-status').innerText(), 'No block');
      assert.equal(await rows.nth(2).locator('.booking-access-status').innerText(), 'No block');
      assert.equal(await rows.nth(3).locator('.booking-access-status').innerText(), 'Suspended');
      assert.equal(await rows.nth(4).locator('.tutor-booking-access small').innerText(), 'Until lifted');
      assert.equal(await rows.nth(5).locator('.booking-access-status').innerText(), 'Block waived');
      assert.equal(await rows.nth(6).locator('.booking-access-status').innerText(), 'Unavailable');
      assert.equal(await page.getByRole('button', { name: 'Lift block', exact: true }).count(), permitted ? 2 : 0);
      const geometry = await page.locator('.tutors-table').evaluate(table => {
        const rect = cell => ({ x: cell.getBoundingClientRect().x, width: cell.getBoundingClientRect().width, display: getComputedStyle(cell).display });
        return { heads: [...table.tHead.rows[0].cells].map(rect), rows: [...table.tBodies[0].rows].map(row => [...row.cells].map(rect)) };
      });
      for (const row of geometry.rows) row.forEach((cell, i) => {
        assert.equal(cell.display, 'table-cell'); assert(Math.abs(cell.x - geometry.heads[i].x) < 1); assert(Math.abs(cell.width - geometry.heads[i].width) < 1);
      });
      await rows.nth(0).getByTitle('View Profile', { exact: true }).click();
      await page.locator('.profile-modal .profile-avatar img').waitFor();
      assert.equal(await page.locator('.profile-modal .profile-avatar img').getAttribute('src'), new URL(requests.find(url => url.includes('/lesson/files/user/tutor/profile/photo.png'))).href);
      await page.locator('.profile-modal .modal-close').click();
      await page.locator('.tutors-table-card').evaluate((el, mobile) => { el.scrollLeft = mobile ? 650 : 0; }, width < 1025);
      await page.screenshot({ path: `${output}/tutors-${width}-${permitted}.png` });
      if (permitted) {
        await rows.nth(0).getByRole('button', { name: 'Lift block', exact: true }).click();
        const dialog = page.locator('dialog.operations-dialog');
        await dialog.getByRole('heading', { name: 'Remove booking restriction' }).waitFor();
        assert(await dialog.evaluate(el => el.matches(':modal')));
        assert((await dialog.innerText()).includes('Blocked Tutor'));
        assert((await dialog.innerText()).includes('Account suspensions are not changed.'));
        await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
        assert.equal(writes.length, 0, 'A reason is mandatory');
        await dialog.getByLabel('Reason', { exact: true }).fill('Verified attendance evidence; lift temporary block.');
        await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
        await dialog.getByRole('alert').waitFor();
        assert.equal(await dialog.getByRole('alert').innerText(), 'Operations permission was removed.');
        assert.equal(tutors[0].isBlocked, true, 'A rejected action cannot clear the block');
        fail = false;
        await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
        await dialog.waitFor({ state: 'detached' });
        await page.waitForFunction(() => document.querySelector('.tutors-table tbody tr .booking-access-status')?.textContent.includes('Block waived'));
        assert.equal(await rows.nth(0).getByRole('button', { name: 'Lift block', exact: true }).count(), 0);
        assert.equal(await rows.nth(3).locator('.booking-access-status').innerText(), 'Suspended');
        assert.equal(writes.length, 2);
        assert(writes.every(write => write.body.reason === 'Verified attendance evidence; lift temporary block.'));
      } else assert.deepEqual(writes, []);
      assert(requests.filter(url => url.includes('/lesson/files/')).every(url => !url.includes('fluentxverse-seaweed-filer') && !url.includes('api.fluentxverse.xyz')));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width} operations=${permitted}: decoded photos/fallbacks, booking states, aligned columns, audited-action UI, permission failure and refresh`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
