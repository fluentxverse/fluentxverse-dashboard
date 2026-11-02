const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.INTERVIEW_DASHBOARD_URL || 'http://127.0.0.1:5242';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const fixturePage = await browser.newPage();
  const photos = await fixturePage.evaluate(() => [[512, 512], [300, 600], [600, 300]].map(([width, height]) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#102432'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#50b6d3'; ctx.beginPath(); ctx.arc(width / 2, height / 2, Math.min(width, height) / 2 - 2, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, width - 4, height - 4);
    return canvas.toDataURL('image/png').split(',')[1];
  }));
  await fixturePage.close();
  fs.mkdirSync('/tmp/fluentxverse-profile-review', { recursive: true });
  try {
    for (const width of [1440, 768, 390, 320]) for (const theme of ['light', 'dark']) for (const valid of [true, false]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: theme });
      const requests = [], writes = [], errors = [];
      const profile = { id: 'review-fixture', name: 'Paul Anthony Review Applicant', email: 'long.review.applicant@example.invalid', profilePicture: valid ? 'http://fluentxverse-seaweed-filer:8888/user/review-fixture/photo.png' : 'https://api.fluentxverse.xyz/lesson/files/user/review-fixture/photo.png', bio: 'Tutor introduction', schoolAttended: 'Sample University', major: 'English', interests: ['Reading'], submittedAt: '2026-10-28', profileStatus: 'pending_review', profileItemStatuses: {} };
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', request => requests.push(request.url()));
      await page.route('**/*', route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/api/, '');
        if (path.startsWith('/lesson/files/user/')) return valid ? route.fulfill({ contentType: 'image/png', body: Buffer.from(photos[[1440, 768, 390, 320].indexOf(width) % 3], 'base64') }) : route.fulfill({ status: 404, json: { error: 'Missing fixture photo' } });
        if (!/^\/(admin|interview|notifications|inbox)(\/|$)/.test(path)) return route.continue();
        const headers = { 'access-control-allow-origin': new URL(base).origin, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,cache-control,pragma' };
        const reply = data => route.fulfill({ headers, json: { success: true, data } });
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (path === '/admin/me') return route.fulfill({ headers, json: { success: true, user: { userId: 'review-admin', username: 'Reviewer', role: 'superadmin' } } });
        if (path === '/admin/socket-token') return route.fulfill({ headers, json: { success: false } });
        if (path === '/admin/pending-profiles') return reply([profile]);
        if (path === '/admin/applications') return reply({ items: [], counts: { total: 1, pendingProfile: 1 }, total: 0, page: 1, pageCount: 1, pageSize: 10 });
        if (path === '/admin/profile/review-fixture/review-item' && request.method() === 'POST') {
          const body = request.postDataJSON(); writes.push(body);
          profile.profileItemStatuses[body.itemKey] = { status: body.action === 'approve' ? 'approved' : 'rejected' };
          return reply({ profileItemStatuses: profile.profileItemStatuses, allApproved: false });
        }
        return reply([]);
      });
      await page.goto(`${base}/applications`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Profile Reviews/ }).click();
      const card = page.getByRole('button', { name: `Review ${profile.name}`, exact: true });
      await expect(card).toBeVisible();
      if (valid) await expect(card.locator('.review-avatar img')).toBeVisible();
      else await expect(card.locator('.review-avatar img')).toHaveCount(0);
      await card.focus(); await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Review Profile', exact: true });
      await expect(dialog).toBeVisible();
      if (valid) {
        await expect(dialog.locator('.review-image')).toBeVisible();
        assert.equal(await dialog.locator('.review-image').evaluate(el => el.complete && el.naturalWidth > 0), true);
        const photo = dialog.locator('.profile-review-photo');
        await photo.scrollIntoViewIfNeeded();
        const beforeHover = await photo.boundingBox();
        await photo.hover();
        assert.deepEqual(await photo.boundingBox(), beforeHover);
        await expect(dialog.locator('.review-image')).toHaveCSS('transform', 'none');
        await expect(dialog.locator('.review-image')).toHaveCSS('object-fit', 'contain');
        assert.equal(await dialog.locator('.review-image').evaluate(img => {
          const box = img.getBoundingClientRect(), frame = img.parentElement.getBoundingClientRect();
          return box.left >= frame.left && box.top >= frame.top && box.right <= frame.right && box.bottom <= frame.bottom && Math.abs(frame.width - frame.height) < 2;
        }), true, 'Full photo stays inside its square frame on hover, including portrait and landscape files');
        await expect(dialog.getByRole('link', { name: 'Open profile photo', exact: true })).toHaveAttribute('href', /\/lesson\/files\/user\/review-fixture\/photo.png$/);
      } else await expect(dialog.getByText('Profile photo could not be loaded.', { exact: true })).toBeVisible();
      await expect(dialog.getByRole('progressbar', { name: 'Profile approval' })).toHaveAttribute('aria-valuenow', '0');
      const header = await dialog.locator('.modal-header').boundingBox();
      const geometry = await dialog.evaluate(el => {
        const header = el.querySelector('.modal-header').getBoundingClientRect(), body = el.querySelector('.modal-body').getBoundingClientRect();
        return { overlap: body.top < header.bottom - 1, clipping: [...el.querySelectorAll('.modal-header h2,.progress-text,.modal-profile-info p')].some(node => node.scrollWidth > node.clientWidth + 1), overflow: el.scrollWidth > el.clientWidth + 1 };
      });
      assert.deepEqual(geometry, { overlap: false, clipping: false, overflow: false });
      const contrast = await dialog.locator('.progress-text').evaluate(el => {
        const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
        const a = luminance(getComputedStyle(el).color), b = luminance(getComputedStyle(el.closest('.modal-header')).backgroundColor);
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      });
      assert.ok(contrast >= 4.5, `Progress text contrast ${contrast}`);
      const bio = dialog.locator('.review-item-card').filter({ has: page.getByRole('heading', { name: 'Bio', exact: true }) });
      await bio.getByRole('button', { name: /Reject/ }).click();
      assert.equal(writes.length, 0, 'Rejection requires a reason');
      await bio.getByRole('button', { name: /Approve/ }).click();
      await expect(dialog.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
      await dialog.locator('.modal-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
      assert.deepEqual(await dialog.locator('.modal-header').boundingBox(), header);
      await dialog.locator('.modal-body').evaluate(el => { el.scrollTop = 0; });
      await page.screenshot({ path: `/tmp/fluentxverse-profile-review/${width}-${theme}-${valid}.png`, fullPage: true });
      const mediaReads = requests.filter(url => url.includes('/photo.png')).length;
      await page.waitForTimeout(100);
      assert.equal(requests.filter(url => url.includes('/photo.png')).length, mediaReads, 'Broken media does not retry');
      assert.equal(requests.some(url => /fluentxverse-seaweed-filer|api\.fluentxverse\.xyz/.test(url)), false);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px ${theme} ${valid ? 'photo' : 'fallback'}: proxied media, readable header, fixed progress, review actions and keyboard close`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
