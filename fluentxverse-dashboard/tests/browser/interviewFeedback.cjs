const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.INTERVIEW_DASHBOARD_URL || 'http://127.0.0.1:5242';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      let saved = false, attempts = 0;
      const errors = [], payloads = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api/, '');
        if (!/^\/(admin|interview|notifications|inbox)(\/|$)/.test(path)) return route.continue();
        const headers = { 'access-control-allow-origin': new URL(base).origin, 'access-control-allow-credentials': 'true',
          'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,cache-control,pragma' };
        const reply = data => route.fulfill({ headers, json: { success: true, data } });
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (path === '/admin/me') return route.fulfill({ headers, json: { success: true, user: { userId: 'feedback-admin', username: 'Reviewer', role: 'superadmin' } } });
        if (path === '/admin/socket-token') return route.fulfill({ headers, json: { success: false } });
        const slot = { id: 'feedback-slot', tutorId: 'feedback-candidate', tutorName: 'Candidate', date: '2026-10-28', time: '2:00 PM', status: 'completed', mediaClosed: true };
        if (path === '/interview/week') return reply({ slots: [], weekStart: '2026-10-26', weekEnd: '2026-11-01' });
        if (path === '/interview/pending') return reply(saved ? [] : [slot]);
        if (path === '/interview/room/feedback-slot') return reply({ ...slot, result: null, reviewedAt: null, notes: 'Existing notes',
          rubricScores: { grammar: 2, fluency: 3, pronunciation: 4, vocabulary: 3, professionalism: 4 }, timestamps: [{ time: '01:00', note: 'Saved context' }] });
        if (path === '/interview/result') {
          payloads.push(route.request().postDataJSON());
          if (++attempts === 1) return route.fulfill({ status: 503, headers, json: { success: false, error: 'Temporary save failure' } });
          saved = true;
          return reply(null);
        }
        return reply([]);
      });
      await page.goto(`${base}/interviews`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Feedback', exact: true }).click({ timeout: 7000 }).catch(async error => {
        console.error(await page.locator('body').innerText(), errors);
        throw error;
      });
      const modal = page.locator('.interview-feedback-modal');
      await expect(modal.locator('textarea')).toHaveValue('Existing notes');
      await modal.getByRole('button', { name: 'Fail', exact: true }).click();
      await modal.getByLabel('grammar score').selectOption('4');
      await modal.locator('textarea').fill('Reviewed after the video call.');
      await modal.getByRole('button', { name: 'Submit Feedback', exact: true }).click();
      await expect(modal).toContainText('Temporary save failure');
      await expect(modal.locator('textarea')).toHaveValue('Reviewed after the video call.');
      await modal.getByRole('button', { name: 'Submit Feedback', exact: true }).click();
      await expect(modal).toHaveCount(0);
      assert.equal(payloads.length, 2);
      assert.deepEqual(payloads[0], payloads[1]);
      assert.equal(payloads[1].result, 'fail');
      assert.equal(payloads[1].tutorId, 'feedback-candidate');
      assert.equal(payloads[1].rubricScores.grammar, 4);
      assert.equal(payloads[1].rubricScores.pronunciation, 4);
      assert.deepEqual(payloads[1].timestamps, [{ time: '01:00', note: 'Saved context' }]);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: post-call Feedback loads saved evaluation and persists a decision; failed saves retain the form`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
