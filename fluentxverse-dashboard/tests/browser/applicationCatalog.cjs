const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.INTERVIEW_DASHBOARD_URL || 'http://127.0.0.1:5242';

(async () => {
  const { applicationPage } = await import('../../../shared/tutorApplications.ts');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync('/tmp/fluentxverse-application-catalog', { recursive: true });
  try {
    for (const width of [1440, 1024, 768, 390, 320]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme });
      const page = await context.newPage();
      const errors = [], requests = [], mutations = [];
      let failRefresh = false;
      const applicant = (id, extra = {}) => ({ id, name: id, email: `${id}@example.invalid`, registeredAt: '2026-10-28',
        status: 'pending_written', writtenExamPassed: false, speakingExamPassed: false, interviewResult: null, interviewSlotId: null, interviewDate: null, profileStatus: 'incomplete', ...extra });
      const items = Array.from({ length: 55 }, (_, index) => applicant(`New Applicant ${index}`));
      items.push(applicant('Passed Candidate', { writtenExamPassed: true, speakingExamPassed: true, interviewResult: 'pass', interviewSlotId: 'passed-slot', status: 'interview_passed' }));
      items.push(applicant('Profile Candidate', { writtenExamPassed: true, speakingExamPassed: true, interviewResult: 'pass', interviewSlotId: 'profile-slot', profileStatus: 'pending_review', status: 'pending_profile' }));
      items.push(applicant('Approved Candidate', { registeredAt: null, writtenExamPassed: true, speakingExamPassed: true, interviewResult: 'pass', interviewSlotId: 'approved-slot', profileStatus: 'approved', status: 'certified' }));
      items.push(applicant('Failed Candidate', { writtenExamPassed: true, speakingExamPassed: true, interviewResult: 'fail', interviewSlotId: 'failed-slot', status: 'interview_failed' }));
      items.push(applicant('Processing Candidate', { writtenExamPassed: true, status: 'processing' }));
      let reviewedAt = '2026-10-28T01:00:00Z';
      await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/api/, '');
        if (!/^\/(admin|interview|notifications|inbox)(\/|$)/.test(path)) return route.continue();
        const headers = { 'access-control-allow-origin': new URL(base).origin, 'access-control-allow-credentials': 'true',
          'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,cache-control,pragma' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        requests.push(path);
        const reply = data => route.fulfill({ headers, json: { success: true, data } });
        if (path === '/admin/me') return route.fulfill({ headers, json: { success: true, user: { userId: 'catalog-admin', username: 'Reviewer', role: 'superadmin' } } });
        if (path === '/admin/socket-token') return route.fulfill({ headers, json: { success: false } });
        if (path === '/admin/applications') {
          if (failRefresh) return route.fulfill({ status: 503, headers, json: { success: false, error: 'Application refresh unavailable' } });
          const filter = url.searchParams.get('filter') || 'all';
          if (filter === 'pending_speaking') await new Promise(resolve => setTimeout(resolve, 300));
          return reply(applicationPage(items, filter, Number(url.searchParams.get('page') || 1), 10));
        }
        if (path === '/interview/room/passed-slot') return reply({ id: 'passed-slot', tutorId: 'Passed Candidate', tutorName: 'Passed Candidate', status: 'completed', mediaClosed: true,
          result: items.find(item => item.id === 'Passed Candidate').interviewResult, reviewedAt,
          rubricScores: { grammar: 4, fluency: 4, pronunciation: 4, vocabulary: 4, professionalism: 4 }, notes: 'Saved review', timestamps: [] });
        if (path === '/interview/result' && request.method() === 'POST') {
          const payload = request.postDataJSON(); mutations.push(payload);
          assert.equal(payload.slotId, 'passed-slot');
          assert.equal(payload.expectedReviewedAt, reviewedAt);
          const item = items.find(item => item.id === 'Passed Candidate'); item.interviewResult = payload.result; item.status = 'interview_failed';
          reviewedAt = '2026-10-28T02:00:00Z';
          return reply(null);
        }
        return reply([]);
      });
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/applications`, { waitUntil: 'networkidle' });
      const metric = label => page.getByRole('button', { name: label, exact: true });
      await expect(metric('Total Applications').locator('.stat-number')).toHaveText('60');
      await expect(metric('Interview Passed').locator('.stat-number')).toHaveText('3');
      await expect(metric('Profile Review').locator('.stat-number')).toHaveText('1');
      await expect(metric('Approved').locator('.stat-number')).toHaveText('1');
      await expect(page.locator('.application-card')).toHaveCount(10);
      await page.getByRole('button', { name: 'Next application page' }).click();
      await expect(page.getByRole('navigation', { name: 'Application pages' })).toContainText('Page 2 of 6');
      await expect(metric('Interview Passed').locator('.stat-number')).toHaveText('3');
      await metric('Interview Passed').focus(); await page.keyboard.press('Enter');
      await expect(page.locator('.application-card')).toHaveCount(3);
      const rowSizes = await page.locator('.application-card').evaluateAll(rows => rows.map(row => ({
        height: row.getBoundingClientRect().height,
        overflow: row.scrollWidth > row.clientWidth + 1,
      })));
      assert.equal(rowSizes.every(row => row.height <= (width >= 1200 ? 110 : 270) && !row.overflow), true, 'Applicant rows remain compact without clipping');
      await expect(page.locator('.application-card .card-footer')).toHaveCount(0);
      await expect(page.locator('.application-card').filter({ has: page.getByRole('heading', { name: 'Approved Candidate', exact: true }) }).locator('.applied-date')).toHaveCount(0);
      await expect(page.getByRole('navigation', { name: 'Application pages' })).toContainText('Page 1 of 1');
      const passedCard = page.locator('.application-card').filter({ has: page.getByRole('heading', { name: 'Passed Candidate', exact: true }) });
      await expect(passedCard.getByRole('link', { name: 'Review interview', exact: true })).toHaveAttribute('href', '/interview-room/passed-slot');
      assert.equal(await page.locator('.exam-progress').getByText('Certified', { exact: true }).count(), 0);
      await metric('Pending Speaking').click(); await metric('Interview Passed').click();
      await page.waitForTimeout(400);
      await expect(page.locator('.application-card')).toHaveCount(3);
      failRefresh = true;
      await page.getByRole('button', { name: /Refresh/ }).click();
      await expect(page.locator('.alert-error')).toContainText('Application refresh unavailable');
      await expect(metric('Interview Passed').locator('.stat-number')).toHaveText('3');
      failRefresh = false;
      await page.getByRole('button', { name: /Refresh/ }).click();
      await expect(page.locator('.alert-error')).toHaveCount(0);
      await expect(page.locator('.application-card')).toHaveCount(3);
      const clipping = await page.locator('.applications-page').evaluate(el => [...el.querySelectorAll('.header-content p,.page-tabs button,.application-stage-filter,.card-actions a')].some(node => node.scrollWidth > node.clientWidth + 1));
      assert.equal(clipping, false, 'Headings, tabs and review actions fit their containers');
      await page.screenshot({ path: `/tmp/fluentxverse-application-catalog/applications-${width}-${theme}.png`, fullPage: true });
      await passedCard.getByRole('link', { name: 'Review interview', exact: true }).click();
      await expect(page.getByText('Saved result: Passed', { exact: true })).toBeVisible();
      await page.locator('.btn-fail').click();
      await page.locator('.confirm-actions .btn-confirm.danger').click();
      await expect(page.getByText('Saved result: Failed', { exact: true })).toBeVisible();
      await page.getByRole('link', { name: 'Back to applications', exact: true }).click();
      await expect(metric('Interview Passed').locator('.stat-number')).toHaveText('2');
      await expect(metric('Interview Failed').locator('.stat-number')).toHaveText('2');
      await metric('Interview Failed').click();
      await expect(page.locator('.application-card')).toHaveCount(2);
      assert.equal(requests.includes('/admin/applications'), true);
      assert.equal(mutations.length, 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px ${theme}: full totals, pagination, filters, refresh recovery and applicant-specific result correction`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
