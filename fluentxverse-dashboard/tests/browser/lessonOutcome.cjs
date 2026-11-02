const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.DASHBOARD_TEST_URL || 'http://127.0.0.1:5295';
const output = path.resolve(__dirname, '../../../output/screenshots/lesson-outcome');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1440, 375, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
      const errors = [], writes = [];
      let queued = false, revoked = false, activeTa301 = false;
      let report = { id: 'outcome-report', bookingId: 'outcome-lesson', source: 'student', duration: 'up_to_ten',
        reason: 'audio', details: 'Audio interruption during the lesson', status: 'submitted', resolution: '',
        priority: 'normal', createdAt: '2026-10-25T01:25:00Z', dueAt: '2026-10-26T01:25:00Z', internalHistory: [], reviewHistory: [],
        completionDecision: 'not_assessed', completionOutcome: null };
      await context.route('**/*', route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin === base) return route.continue();
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        let json = { success: true, data: [] };
        if (url.pathname === '/admin/me') json = { success: true, user: { userId: 'support-fixture', username: 'Support', role: 'admin' } };
        if (url.pathname === '/admin/operations/access') json.data = { role: 'admin', permissions: ['support'] };
        if (url.pathname === '/admin/operations/reports') json.data = [report];
        if (url.pathname === '/admin/operations/reports/student/outcome-report/review') {
          const body = req.postDataJSON(); writes.push(body);
          report = { ...report, ...body, reviewedAt: new Date().toISOString() }; json.data = report;
        }
        if (url.pathname === '/admin/operations/lessons/outcome-lesson/outcome') {
          const eligible = !activeTa301 && report.status === 'resolved' && report.completionDecision === 'alternative_approved';
          json.data = { policy: 'fluentxverse.lesson-outcome.v2.draft2', state: eligible ? 'eligible' : 'review_required',
            reason: activeTa301 ? 'ta301_attendance_conflict' : eligible ? 'review_approved' : 'reports_require_explicit_approval', outcome: eligible ? 'early_ended' : null,
            reportingClosesAt: '2026-10-27T01:25:00Z', proofStatus: 'not_generated', generationAvailable: false, zkVerified: false,
            proofRequest: queued ? { id: 'request-fixture', phase: eligible ? 'awaiting_prover' : 'needs_reassessment', requestedAt: new Date().toISOString() } : null };
        }
        if (url.pathname === '/admin/operations/lessons/outcome-lesson/outcome-proof') {
          if (revoked) return route.fulfill({ status: 403, json: { success: false, error: 'Support permission required.' } });
          assert.equal(report.completionDecision, 'alternative_approved');
          queued = true; writes.push({ request: req.postDataJSON() });
          json.data = { id: 'request-fixture', phase: 'awaiting_prover', requestedAt: new Date().toISOString() };
        }
        return route.fulfill({ json });
      });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/lesson-operations?tab=issues', { waitUntil: 'networkidle' });
      const panel = page.getByRole('region', { name: 'Lesson outcome eligibility' });
      const generate = panel.getByRole('button', { name: 'Generate completion proof' });
      await expect(generate).toBeDisabled();
      await page.getByRole('button', { name: 'Review', exact: true }).click();
      const dialog = page.getByRole('dialog');
      if (process.env.LESSON_OUTCOME_DEBUG) {
        await page.waitForTimeout(500);
        console.log({ errors, dialogs: await page.locator('dialog').count(), text: (await page.locator('body').innerText()).slice(-3500) });
      }
      await dialog.getByLabel('Status', { exact: true }).selectOption('resolved');
      await dialog.getByLabel('Resolution visible to reporter').fill('Attendance and audio evidence reviewed; early-ended outcome approved.');
      await dialog.getByLabel('Completion decision').selectOption('alternative_approved');
      await dialog.getByLabel('Approved outcome').selectOption('early_ended');
      assert.equal(await generate.isDisabled(), true);
      await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(generate).toBeEnabled();
      assert.equal(writes[0].completionDecision, 'alternative_approved');
      assert.equal(writes[0].completionOutcome, 'early_ended');
      revoked = true; await generate.click();
      await expect(panel.getByRole('alert')).toContainText('Support permission required.');
      await expect(generate).toBeEnabled();
      revoked = false; await generate.click();
      await expect(panel).toContainText('Generation requested; awaiting prover setup. No proof generated.');
      await expect(generate).toBeDisabled();
      assert.equal(writes.filter(w => w.request).length, 1);
      await panel.scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(output, `support-${width}.png`), fullPage: true });
      activeTa301 = true;
      await panel.getByRole('button', { name: 'Refresh lesson outcome' }).click();
      await expect(panel).toContainText('Tutor attendance says present, but TA-301 remains.');
      await expect(panel).toContainText('Previous request requires reassessment.');
      await expect(generate).toBeDisabled();
      await page.screenshot({ path: path.join(output, `ta301-${width}.png`), fullPage: true });
      activeTa301 = false;
      await page.getByRole('button', { name: 'Review', exact: true }).click();
      await dialog.getByLabel('Status', { exact: true }).selectOption('under_review');
      await expect(dialog.getByLabel('Completion decision')).toHaveValue('not_assessed');
      await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
      await expect(generate).toBeDisabled();
      assert.deepEqual(errors, []);
      console.log(`PASS support ${width}: explicit approval, manual request, permission failure, duplicate protection, reopen and layout`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
