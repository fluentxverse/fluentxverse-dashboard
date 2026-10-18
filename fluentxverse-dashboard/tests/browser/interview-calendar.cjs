const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { chromium } = require('playwright');
const base = process.env.INTERVIEW_DASHBOARD_URL || 'http://127.0.0.1:5187';
const screenshots = resolve(__dirname, '../../../output/screenshots');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  mkdirSync(screenshots, { recursive: true });
  try {
    for (const width of [1440, 1024, 768, 375, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Asia/Manila' });
      const page = await context.newPage(), errors = [], mutations = [];
      await page.clock.install({ time: new Date('2026-10-13T01:00:00Z') });
      let slots = [
        { id: 'open-fixture', date: '2026-10-15', time: '1:00 PM', status: 'open' },
        { id: 'booked-fixture', date: '2026-10-16', time: '1:30 PM', status: 'booked', tutorName: 'Alexandrianaverylongfirstname Candidate', tutorId: 'candidate-fixture' },
        { id: 'completed-fixture', date: '2026-10-12', time: '2:00 PM', status: 'completed', tutorName: 'Completed Candidate', tutorId: 'completed-candidate' },
      ];
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/api/, '');
        if (!/^\/(admin|interview|notifications|inbox)(\/|$)/.test(path)) return route.continue();
        const headers = { 'access-control-allow-origin': new URL(base).origin, 'access-control-allow-credentials': 'true',
          'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type,cache-control,pragma' };
        const reply = data => route.fulfill({ headers, json: { success: true, data } });
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (path === '/admin/me') return route.fulfill({ headers, json: { success: true, user: { userId: 'calendar-admin', username: 'Calendar', firstName: 'Calendar', role: 'superadmin' } } });
        if (path === '/admin/socket-token') return route.fulfill({ headers, json: { success: false } });
        if (path === '/interview/week') return reply({ slots: url.searchParams.get('weekOffset') === '0' ? slots : [], weekStart: '2026-10-12', weekEnd: '2026-10-18' });
        if (path === '/interview/pending') return reply([]);
        if (path.startsWith('/interview/result/')) return reply(null);
        if (path === '/interview/slots' && request.method() === 'POST') {
          const body = request.postDataJSON(); mutations.push(body);
          slots = [...slots, ...body.slots.map((slot, index) => ({ ...slot, status: 'open', id: `created-fixture-${index}` }))];
          return reply(slots);
        }
        return reply([]);
      });
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/interviews`, { waitUntil: 'networkidle' });
      await page.getByRole('region', { name: 'Interview calendar', exact: true }).waitFor();
      assert.equal(await page.locator('.time-label').count(), 12);
      const geometry = await page.evaluate(() => ({
        rowHeight: document.querySelector('.slot-cell').getBoundingClientRect().height,
        calendarHeight: document.querySelector('.calendar-grid').getBoundingClientRect().height,
        pageOverflow: document.documentElement.scrollWidth > innerWidth,
        fits: [...document.querySelectorAll('.period-tab,.nav-btn,.time-label,.slot-badge')].every(n => n.scrollWidth <= n.clientWidth),
      }));
      assert.equal(geometry.rowHeight, 32); assert.equal(geometry.calendarHeight, 432);
      assert(!geometry.pageOverflow, `No document overflow at ${width}`); assert(geometry.fits, `Labels fit at ${width}`);
      if (width === 1440) {
        const nav = await page.locator('.week-navigation').boundingBox(), periods = await page.locator('.period-tabs').boundingBox();
        assert(Math.abs(nav.y - periods.y) < 8, 'Week navigation and period selector share one compact toolbar');
        const bounds = await page.locator('.schedule-card').boundingBox(); assert(bounds.height < 520);
      }
      if (width < 660) {
        const scroll = page.getByRole('region', { name: 'Interview calendar', exact: true });
        assert(await scroll.evaluate(n => n.scrollWidth > n.clientWidth), 'Only the calendar scrolls horizontally');
        await scroll.evaluate(n => { n.scrollLeft = n.scrollWidth; });
        await scroll.evaluate(n => { n.scrollLeft = 0; });
      }
      await page.screenshot({ path: resolve(screenshots, `interview-calendar-compact-${width}.png`), fullPage: true });
      const booked = page.getByRole('button', { name: /Friday, Oct 16, 1:30 PM, booked/ });
      assert(await booked.isDisabled(), 'Booked slots remain non-selectable');
      assert(await page.getByRole('button', { name: 'Monday, Oct 12, 12:00 PM, available', exact: true }).isDisabled(), 'Past empty slots remain disabled');
      const completed = page.getByRole('button', { name: /Monday, Oct 12, 2:00 PM, completed/ });
      assert(!(await completed.isDisabled()), 'Completed results remain accessible even in the past');
      await completed.click(); await page.locator('.interview-result-modal').waitFor();
      await page.locator('.interview-result-modal .modal-close').click();
      const available = page.getByRole('button', { name: 'Thursday, Oct 15, 12:00 PM, available', exact: true });
      await available.focus(); await page.keyboard.press('Enter');
      assert.equal(await available.getAttribute('aria-pressed'), 'true');
      await page.getByRole('button', { name: 'Open 1 New Slot', exact: true }).click();
      await page.getByRole('button', { name: 'Open Slots', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('.selection-bar'));
      assert.deepEqual(mutations, [{ slots: [{ date: '2026-10-15', time: '12:00 PM' }] }]);
      await page.getByRole('button', { name: 'Morning (5AM-12PM)', exact: true }).click(); assert.equal(await page.locator('.time-label').count(), 14);
      await page.getByRole('button', { name: 'Evening (6PM-12AM)', exact: true }).click(); assert.equal(await page.locator('.time-label').count(), 12);
      await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.locator('.week-range').filter({ hasText: 'Oct 19 - Oct 25' }).waitFor();
      await page.getByRole('button', { name: 'Today', exact: true }).click(); await page.locator('.week-range').filter({ hasText: 'Oct 12 - Oct 18' }).waitFor();
      assert.deepEqual(errors, []); await context.close();
      console.log(`PASS interview calendar ${width}: compact grid, responsive scrolling, labels, keyboard selection, opening slots, completed results and navigation`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
