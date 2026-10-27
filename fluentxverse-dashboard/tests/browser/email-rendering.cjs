const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.EMAIL_TEST_URL || 'http://127.0.0.1:5198';
const backgroundMetadata = '<template data-mail-backgrounds>{"--mail-bg-0":"https://images.example.test/hero.png","--mail-bg-1":"https://images.example.test/mobile.png"}</template>';
const fixture = `<style>.newsletter{width:580px;max-width:100%;margin:auto;background:#fff;color:#202124}.hero{background-image:var(--mail-bg-0,none);background-position:center;background-size:cover}.dark-logo{display:none}@media(max-width:480px){.hero{background-image:var(--mail-bg-1,none)!important}}@media(prefers-color-scheme:dark){.newsletter{background:#252628;color:#fff}.light-logo{display:none}.dark-logo{display:block}}</style><table class="newsletter" cellspacing="0" cellpadding="0"><tr><td style="padding:24px"><img class="light-logo" data-mail-src="https://images.example.test/logo.png" height="32" alt="Brand logo"><img class="dark-logo" data-mail-src="https://images.example.test/logo-dark.png" height="32" alt="Brand logo"></td></tr><tr><td class="hero" height="240"><h1>Welcome to your mailbox</h1></td></tr><tr><td style="padding:24px"><p>Your account is ready.</p><table cellspacing="0" cellpadding="0"><tr>${['Facebook', 'X', 'Instagram'].map(name => `<td width="48"><a href="https://example.test"><img data-mail-src="https://images.example.test/${name}.png" width="32" style="display:block;width:32px" alt="${name}"></a></td>`).join('')}</tr></table></td></tr></table>${backgroundMetadata}`;

(async () => {
  const sample = process.env.EMAIL_RENDER_SAMPLE ? JSON.parse(await fs.readFile(process.env.EMAIL_RENDER_SAMPLE, 'utf8')).html : fixture;
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6d6kAAAAASUVORK5CYII=', 'base64');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir('../output/email', { recursive: true });
  try {
    for (const width of (process.env.EMAIL_TEST_WIDTHS || '1440,375,320').split(',').map(Number)) {
      for (const colorScheme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme, reducedMotion: 'reduce' });
        const remoteRequests = [], failedRequests = [];
        await context.route('https://images.example.test/**', route => { remoteRequests.push(route.request().url()); return route.fulfill({ body: image, contentType: 'image/png' }); });
        await context.route('https://mktg.spaceship.com/**', route => { remoteRequests.push(route.request().url()); return route.continue(); });
        await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):8765|https:\/\/api\.fluentxverse\.(com|xyz))\//, route => {
          const request = route.request(), path = new URL(request.url()).pathname;
          if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
          if (path === '/admin/me') return route.fulfill({ json: { success: true, user: { userId: 'render-fixture', username: 'Operations', role: 'superadmin' } } });
          const reply = data => route.fulfill({ json: { success: true, data } });
          const message = { uid: 1, subject: 'Welcome message rendering', from: [{ name: 'Welcome Team', address: 'welcome@example.test' }], to: [{ address: 'support@fluentxverse.com', name: 'Support' }], cc: [], replyTo: [], date: '2026-10-22T00:00:00Z', seen: true, starred: false, hasAttachments: false, messageId: '<render@example.test>', references: [], attachments: [], text: 'Welcome', html: sample };
          if (path === '/admin/mail/status') return reply({ configured: true, accounts: [{ id: 'support', address: 'support@fluentxverse.com', label: 'Support' }] });
          if (path === '/admin/mail/support/folders') return reply([{ path: 'INBOX', role: 'inbox', name: 'Inbox', total: 1, unread: 0 }]);
          if (path === '/admin/mail/preferences') return reply({ signature: '', contacts: [] });
          if (path === '/admin/mail/support/messages') return reply({ messages: [message], total: 1, page: 1, pages: 1, uidValidity: '1' });
          if (path === '/admin/mail/support/messages/1') return reply(message);
          if (path === '/admin/operations/access') return reply({ permissions: ['support', 'operations'] });
          return reply([]);
        });
        const page = await context.newPage();
        page.on('response', response => { if (response.url().startsWith('https://mktg.spaceship.com/') && !response.ok()) failedRequests.push(response.status()); });
        page.on('requestfailed', request => { if (request.url().startsWith('https://mktg.spaceship.com/')) failedRequests.push(request.failure()?.errorText); });
        await page.goto(base + '/email', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.locator('.mail-row-content').click();
        const frame = page.frameLocator('.mail-html-body');
        await expect(frame.locator('img[data-mail-image-state=blocked]').first()).toBeAttached();
        await expect.poll(() => frame.locator('img[data-mail-image-state=blocked]').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
        assert.equal(remoteRequests.length, 0, 'Images, including CSS backgrounds, stay inert before consent');
        assert.equal(await frame.locator('*').evaluateAll(nodes => nodes.some(node => /url\(/.test(getComputedStyle(node).backgroundImage))), false);
        await expect(page.getByText('External images are blocked.', { exact: true })).toBeVisible();
        await page.screenshot({ path: `../output/email/images-blocked-${width}-${colorScheme}.png` });
        await page.getByRole('button', { name: 'Show images', exact: true }).click();
        await expect.poll(() => frame.locator('img').evaluateAll(images => images.filter(image => image.getClientRects().length && getComputedStyle(image).display !== 'none' && image.src.startsWith('https:')).every(image => image.complete && image.naturalWidth > 0)), { timeout: 30000 }).toBe(true);
        assert.ok(remoteRequests.length >= 4, 'Logos and social images are actually fetched after consent');
        assert.ok(await frame.locator('*').evaluateAll(nodes => nodes.some(node => /url\(/.test(getComputedStyle(node).backgroundImage))), 'Background artwork is restored');
        assert.ok(remoteRequests.some(url => /Hero|hero|mobile/.test(url)), 'Background artwork is fetched, not just declared');
        const social = await frame.locator('img[alt="Facebook"],img[alt="X"],img[alt="Instagram"]').evaluateAll(images => images.map(image => ({ x: image.getBoundingClientRect().x, y: image.getBoundingClientRect().y, width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height, loaded: image.naturalWidth > 0 })));
        assert.equal(social.length, 3);
        assert.ok(social.every(image => image.loaded && Math.abs(image.width - 32) < 1 && Math.abs(image.height - 32) < 1), 'Social icons keep their intended size, without wrapped fallback text');
        assert.ok(Math.max(...social.map(image => image.y)) - Math.min(...social.map(image => image.y)) < 2, 'Social icons stay on one row');
        assert.equal(await frame.locator('html').evaluate(node => node.scrollWidth > innerWidth + 1), false, 'Message fits the reader width');
        assert.deepEqual(failedRequests, []);
        await page.screenshot({ path: `../output/email/images-enabled-${width}-${colorScheme}.png` });
        await frame.locator('img[alt="Facebook"]').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `../output/email/images-footer-${width}-${colorScheme}.png` });
        await page.locator('.mail-reader-scroll').evaluate(node => { node.scrollTop = 0; });
        await page.getByRole('button', { name: 'Hide images', exact: true }).click();
        assert.equal(await frame.locator('*').evaluateAll(nodes => nodes.some(node => /url\(/.test(getComputedStyle(node).backgroundImage))), false, 'Hiding images removes background network references too');
        console.log(`PASS email image rendering ${width} ${colorScheme}${process.env.EMAIL_RENDER_SAMPLE ? ' (actual Spacemail welcome)' : ''}`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
