const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_NODE_PACKAGE || 'playwright');
const base = process.env.COMPENSATION_UI_URL || 'http://localhost:5185';
const screenshots = resolve(__dirname, '../../../output/screenshots');
mkdirSync(screenshots, { recursive: true });

async function fixture(browser, permissions, viewport) {
  const context = await browser.newContext({ viewport });
  const state = { cents: null, version: 0, history: [], puts: [], privateReads: 0, failOnce: false, conflictOnce: false, nextBefore: null, revokeReads: false, tutorStatus: 'certified' };
  const summary = () => ({ tutorId: 'compensation-ui', currency: 'USD', baseRateCents: state.cents, version: state.version,
    updatedAt: state.version ? '2026-10-12T07:00:00.000Z' : null, updatedBy: state.version ? 'finance-ui' : null, updatedByName: state.version ? 'Finance Operator' : null });
  await context.route('**/admin/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const headers = { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,PUT,POST,OPTIONS', 'access-control-allow-headers': 'content-type' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let response = { success: true, data: [] }, status = 200;
    if (path === '/admin/me') response = { success: true, user: { userId: 'finance-ui', username: 'finance', firstName: 'Finance', lastName: 'Operator', role: 'admin' } };
    else if (path === '/admin/operations/access') response.data = { id: 'finance-ui', role: 'admin', permissions };
    else if (path === '/admin/tutors') response.data = { total: 1, tutors: [{ id: 'compensation-ui', name: 'Tutor Compensation Fixture', email: 'tutor@example.test', languages: ['English'], status: state.tutorStatus, totalSessions: 3, rating: 5, zkCertificationStatus: 'requirements_incomplete', writtenExamPassed: state.tutorStatus === 'certified', speakingExamPassed: state.tutorStatus === 'certified' }] };
    else if (path === '/admin/operations/people/tutor/compensation-ui') response.data = { person: { name: 'Tutor Compensation Fixture', email: 'tutor@example.test' }, lessons: [], penalties: [], reports: [], transactions: [], performance: null, progress: [], role: 'tutor' };
    else if (path.startsWith('/admin/operations/compensation')) {
      if(path.endsWith('/earnings')||path.endsWith('/payouts')) { state.privateReads++;response.data=[]; }
      else if(path.endsWith('/payout-authorization/readiness')) response.data={ready:false,transferEnabled:false};
      else if (request.method() === 'PUT') {
        const input = request.postDataJSON(); state.puts.push(input);
        if (state.failOnce) { state.failOnce = false; status = 503; response = { success: false, error: 'Temporarily unavailable. Please retry.' }; }
        else if (state.conflictOnce) { state.conflictOnce = false; state.version++; state.cents = 2000; status = 409; response = { success: false, error: 'This rate was changed by another administrator. Reload it before saving.' }; }
        else {
          const previous = state.cents;
          const [whole, fractional = ''] = input.amount.split('.');
          state.cents = Number(whole) * 100 + Number(fractional.padEnd(2, '0')); state.version++;
          const change = { id: input.requestId, tutorId: 'compensation-ui', currency: 'USD', baseRateCents: state.cents, previousRateCents: previous,
            version: state.version, previousVersion: input.expectedVersion, changedAt: '2026-10-12T07:00:00.000Z', changedBy: 'finance-ui', changedByName: 'Finance Operator', reason: input.reason || 'Initial base rate' };
          state.history.unshift(change); response.data = { change, replayed: false };
        }
      } else {
        state.privateReads++;
        if (state.revokeReads) { status = 403; response = { success: false, error: 'Finance permission required.' }; }
        else response.data = path.endsWith('/compensation') ? [summary()] : { compensation: summary(), history: state.history, nextHistoryBeforeVersion: state.nextBefore };
      }
    }
    return route.fulfill({ status, json: response, headers });
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  return { context, page, state, errors };
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true });
  try {
    const desktop = await fixture(browser, ['finance'], { width: 1440, height: 1000 });
    const { page, state } = desktop;
    await page.goto(`${base}/tutors`);
    await page.getByRole('columnheader', { name: 'Base rate (USD)' }).waitFor();
    await page.getByRole('button', { name: 'Not set', exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.locator('.tutors-table-card').evaluate(element => { element.scrollLeft = element.scrollWidth; });
    const actionBounds = await page.getByRole('button', { name: 'Operations detail', exact: true }).boundingBox();
    assert(actionBounds.x + actionBounds.width <= 1440, 'Tutor action controls must be reachable without clipping');
    await page.locator('.tutors-table-card').evaluate(element => { element.scrollLeft = 0; });
    await page.screenshot({ path: resolve(screenshots, 'compensation-tutor-list.png'), fullPage: true });
    await page.getByRole('button', { name: 'Not set', exact: true }).click();
    await page.locator('.account-dialog').waitFor();
    assert.equal(new URL(page.url()).pathname, '/tutors', 'List actions must open a modal without navigating');
    await page.getByLabel('Base rate per completed lesson', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Base rate per completed lesson', { exact: true }).inputValue(), '');
    await page.getByLabel('Base rate per completed lesson', { exact: true }).fill('12.345');
    await page.getByRole('button', { name: 'Save rate', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'at most two decimal places' }).waitFor();
    assert.equal(state.puts.length, 0);
    await page.getByLabel('Base rate per completed lesson', { exact: true }).fill('12.34');
    await page.getByRole('button', { name: 'Save rate', exact: true }).click();
    await page.locator('.compensation-confirmation').waitFor();
    await page.screenshot({ path: resolve(screenshots, 'compensation-confirmation.png'), fullPage: true });
    await page.locator('.compensation-confirmation').getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(state.puts.length, 0);
    await page.getByRole('button', { name: 'Save rate', exact: true }).click();
    state.failOnce = true;
    await page.getByRole('button', { name: 'Confirm rate', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Temporarily unavailable' }).waitFor();
    await page.getByRole('button', { name: 'Confirm rate', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Base rate saved' }).waitFor();
    assert.equal(state.puts.length, 2); assert.equal(state.puts[0].requestId, state.puts[1].requestId);
    await page.locator('.compensation-current').getByText('$12.34', { exact: true }).waitFor();
    await page.getByRole('cell', { name: 'Initial base rate', exact: true }).waitFor();
    await page.screenshot({ path: resolve(screenshots, 'compensation-desktop.png'), fullPage: true });
    await page.getByLabel('Base rate per completed lesson', { exact: true }).fill('15.00');
    await page.getByLabel('Change reason', { exact: true }).fill('New agreed base rate');
    await page.getByRole('button', { name: 'Save rate', exact: true }).click();
    state.conflictOnce = true;
    await page.getByRole('button', { name: 'Confirm rate', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'changed by another' }).waitFor();
    assert(await page.getByRole('button', { name: 'Save rate', exact: true }).isDisabled());
    await page.getByRole('button', { name: 'Reload compensation', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#tutor-base-rate')?.value === '20.00');
    assert(!(await page.getByRole('button', { name: 'Save rate', exact: true }).isDisabled()));
    state.nextBefore = 1;
    await page.getByRole('button', { name: 'Reload compensation', exact: true }).click();
    await page.getByRole('button', { name: 'Earlier changes', exact: true }).waitFor();
    state.revokeReads = true;
    await page.getByRole('button', { name: 'Earlier changes', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Finance permission required' }).waitFor();
    assert.equal(await page.locator('.compensation-summary').count(), 0, 'Revoked access must clear salary data');
    assert.equal(await page.locator('.compensation-history').count(), 0);
    await page.getByRole('tab', { name: 'profile', exact: true }).click();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab', { name: 'lessons', exact: true }).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Home');
    assert.equal(await page.getByRole('tab', { name: 'profile', exact: true }).getAttribute('aria-selected'), 'true');
    await page.getByRole('button', { name: 'Close tutor details', exact: true }).click();
    assert.equal(await page.locator('.account-dialog').count(), 0);
    assert(await page.evaluate(() => document.body.style.overflow !== 'hidden'));
    await page.locator('.tutors-table-card').evaluate(element => { element.scrollLeft = element.scrollWidth; });
    await page.getByRole('button', { name: 'Operations detail', exact: true }).click();
    await page.getByRole('tab', { name: 'profile', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.account-dialog').count(), 0);
    assert.deepEqual(desktop.errors, []);

    const mobile = await fixture(browser, ['finance'], { width: 375, height: 812 });
    await mobile.page.goto(`${base}/operations/people/tutor/compensation-ui?tab=compensation`);
    await mobile.page.getByLabel('Base rate per completed lesson', { exact: true }).waitFor();
    await mobile.page.getByLabel('Base rate per completed lesson', { exact: true }).fill('8.50');
    await mobile.page.screenshot({ path: resolve(screenshots, 'compensation-mobile.png'), fullPage: true });
    assert(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mobile page must not overflow horizontally');
    await mobile.page.getByRole('button', { name: 'Save rate', exact: true }).click();
    await mobile.page.locator('.compensation-confirmation').waitFor();
    const bounds = await mobile.page.locator('.compensation-confirmation').boundingBox(); assert(bounds.x >= 0 && bounds.x + bounds.width <= 375);
    await mobile.page.screenshot({ path: resolve(screenshots, 'compensation-mobile-confirmation.png'), fullPage: true });
    await mobile.page.keyboard.press('Escape');
    assert.equal(await mobile.page.locator('.compensation-confirmation').count(), 0);
    assert.equal(await mobile.page.locator('.account-dialog').count(), 1, 'Closing confirmation must preserve the account modal');
    const accountBounds = await mobile.page.locator('.account-dialog').boundingBox();
    assert(accountBounds.x >= 0 && accountBounds.x + accountBounds.width <= 375 && accountBounds.y >= 0 && accountBounds.y + accountBounds.height <= 812);
    await mobile.page.keyboard.press('Escape');
    await mobile.page.waitForURL(`${base}/tutors`);
    assert.equal(await mobile.page.locator('.account-dialog').count(), 0); assert.deepEqual(mobile.errors, []);

    const compact = await fixture(browser, ['finance'], { width: 320, height: 568 });
    await compact.page.goto(`${base}/operations/people/tutor/compensation-ui?tab=compensation`);
    await compact.page.getByLabel('Base rate per completed lesson', { exact: true }).waitFor();
    const compactBounds = await compact.page.locator('.account-dialog').boundingBox();
    assert(compactBounds.x >= 0 && compactBounds.x + compactBounds.width <= 320 && compactBounds.y >= 0 && compactBounds.y + compactBounds.height <= 568);
    assert(await compact.page.locator('.account-dialog').evaluate(element => element.scrollWidth <= element.clientWidth + 1));
    await compact.page.locator('.account-panel').evaluate(element => { element.scrollTop = element.scrollHeight; });
    assert(await compact.page.getByRole('button', { name: 'Close tutor details', exact: true }).isVisible());
    await compact.page.screenshot({ path: resolve(screenshots, 'compensation-compact-modal.png'), fullPage: false });
    await compact.page.getByRole('button', { name: 'Close tutor details', exact: true }).click();
    await compact.page.waitForURL(`${base}/tutors`);
    assert.deepEqual(compact.errors, []);

    const support = await fixture(browser, ['support'], { width: 1280, height: 900 });
    await support.page.goto(`${base}/operations/people/tutor/compensation-ui?tab=compensation`);
    await support.page.getByRole('heading', { name: 'Tutor Compensation Fixture' }).waitFor();
    assert.equal(await support.page.getByRole('tab', { name: 'compensation', exact: true }).count(), 0);
    assert.equal(support.state.privateReads, 0);
    await support.page.goto(`${base}/tutors`);
    await support.page.getByRole('heading', { name: 'Tutors Management', exact: true }).waitFor();
    assert.equal(await support.page.getByRole('columnheader', { name: 'Base rate (USD)' }).count(), 0);
    assert.equal(support.state.privateReads, 0); assert.deepEqual(support.errors, []);
    const qualified = await fixture(browser, ['finance'], { width: 1440, height: 1000 });
    qualified.state.tutorStatus = 'test_qualified';
    await qualified.page.goto(`${base}/tutors`);
    await qualified.page.getByText('Test Qualified', { exact: true }).waitFor();
    await qualified.page.getByText('Incomplete', { exact: true }).waitFor();
    assert.equal(await qualified.page.getByTitle('Retry zkVerify proof submission', { exact: true }).count(), 0);
    await qualified.page.getByRole('button', { name: 'Not set', exact: true }).click();
    await qualified.page.getByLabel('Base rate per completed lesson', { exact: true }).waitFor();
    assert.deepEqual(qualified.errors, []);
    console.log('PASS: compensation desktop/mobile, unset rates, validation, confirmation, retry IDs, conflict recovery and finance-only visibility. Browser uses fixture API responses.');
    await desktop.context.close(); await mobile.context.close(); await compact.context.close(); await support.context.close(); await qualified.context.close();
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
