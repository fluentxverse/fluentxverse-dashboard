const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.EMAIL_TEST_URL || 'http://127.0.0.1:5198';
const height = Number(process.env.EMAIL_TEST_HEIGHT || 960);
(async () => {
  await fs.mkdir('../output/email', { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  let diagnostics;
  const image = await fs.readFile('public/assets/img/logo/icon_logo.png');
  const richHtml = `<style>.welcome{width:600px;max-width:100%;margin:0 auto;font-family:Arial,sans-serif}.welcome td{padding:28px}.welcome h1{font-size:28px;line-height:1.25}.welcome .footer{background:#f4f6f8;color:#64748b;font-size:12px}@media(max-width:600px){.welcome td{padding:18px}.welcome h1{font-size:24px}}</style>
    <table class="welcome" role="presentation" width="600" cellpadding="0" cellspacing="0" align="center"><tr><td style="background-color:#edf5ff"><img src="data:image/png;base64,${image.toString('base64')}" width="48" height="48" alt="Embedded FluentXVerse logo"><h1>Your teaching journey starts here.</h1></td></tr>
    <tr><td><p>Hello <strong>FluentXVerse</strong>,</p><p>Please find the onboarding documents attached.</p><img data-mail-src="https://images.example.test/welcome.png" width="180" height="180" alt="Welcome illustration"><h2>A place for every lesson</h2><p>Your account is ready. Meet your students, prepare your teaching materials, and bring your next conversation to life.</p><p style="padding:24px;background-color:#f0f9f5">Your first lesson is the start of something meaningful.</p><h2>Before your first session</h2><p>Review your schedule and lesson materials, check your microphone and camera, and take a moment to prepare your notes.</p><p>Thank you,<br>Tutor Operations</p></td></tr><tr><td class="footer">FluentXVerse Team<br>Teaching, learning, and connecting.<p><a href="https://fluentxverse.com">Visit FluentXVerse</a></p></td></tr></table><script>parent.window.mailInjected=true;</script>`;
  try {
    for (const width of (process.env.EMAIL_TEST_WIDTHS || '1440,1100,768,375,320').split(',').map(Number)) {
      const reducedMotion = width !== 1440;
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
      if (process.env.EMAIL_TEST_THEME) await context.addInitScript(theme => { try { localStorage.setItem('fxv_admin_theme', theme); } catch {} }, process.env.EMAIL_TEST_THEME);
      let connected = true, failList = false, failSave = false, failAction = false, listDelay = 0, messageDelay = 0, sendDelay = 0, sendUnknown = false, sendCount = 0, actions = [];
      const requests = { status: 0, folders: 0, drafts: 0, list: 0, message: 0 };
      let preferences = { signature: 'FluentXVerse Support', contacts: [{ name: 'Example contact', email: 'contact@example.test' }] };
      const drafts = new Map(), errors = [], downloadRequests = []; let remoteImages = 0;
      await context.route('https://tracker.test/**', route => { remoteImages++; return route.fulfill({ body: '' }); });
      await context.route('https://images.example.test/**', route => { remoteImages++; return route.fulfill({ body: image, contentType: 'image/png' }); });
      const folders = [{ path: 'INBOX', role: 'inbox', name: 'Inbox', unread: 3, total: 31 }, { path: 'Sent', role: 'sent', name: 'Sent', unread: 0, total: 12 }, { path: 'Archive', role: 'archive', name: 'Archive', unread: 0, total: 5 }, { path: 'Spam', role: 'junk', name: 'Spam', unread: 0, total: 0 }, { path: 'Trash', role: 'trash', name: 'Trash', unread: 0, total: 2 }];
      const messages = Array.from({ length: 31 }, (_, index) => ({ uid: 31 - index, subject: index === 0 ? 'Tutor onboarding documents' : index === 1 ? 'Question about my next lesson' : `Lesson follow-up ${31 - index}`, from: [{ name: index % 2 ? 'Student Services' : 'Tutor Operations', address: 'team@example.test' }], to: [{ name: 'Support', address: 'support@fluentxverse.com' }], date: `2026-10-${String(20 - index % 15).padStart(2, '0')}T08:00:00Z`, seen: index > 2, starred: index === 1, hasAttachments: index === 0, messageId: `<message-${31 - index}@example.test>` }));
      messages.forEach(message => { message.folder = 'INBOX'; });
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):8765|https:\/\/api\.fluentxverse\.(com|xyz))\//, async route => {
        const req = route.request(), url = new URL(req.url()), path = url.pathname;
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
        const reply = data => route.fulfill({ json: { success: true, data } });
        const bad = error => route.fulfill({ status: 503, json: { success: false, error } });
        if (path === '/admin/me') return route.fulfill({ json: { success: true, user: { userId: 'mail-admin', username: 'Operations', role: 'superadmin' } } });
        if (path === '/admin/operations/access') return reply({ permissions: ['support', 'operations'] });
        if (!path.startsWith('/admin/mail/')) return reply([]);
        const parts = path.slice('/admin/mail/'.length);
        if (parts === 'status') { requests.status++; return reply({ accounts: connected ? [{ id: 'support', label: 'FluentXVerse Support', address: 'support@fluentxverse.com' }] : [], configured: connected }); }
        if (parts === 'preferences') { if (req.method() === 'PUT') preferences = req.postDataJSON(); return reply(preferences); }
        if (parts === 'support/folders') { requests.folders++; if (req.method() === 'POST') folders.push({ path: req.postDataJSON().name, name: req.postDataJSON().name, role: '', total: 0, unread: 0 }); return reply(folders); }
        if (parts === 'support/verify') return reply({});
        if (parts === 'support/actions') {
          if (failAction) return bad('Message action failed.');
          const value = req.postDataJSON(); actions.push(value);
          for (const message of messages.filter(message => value.uids.includes(message.uid))) {
            if (value.action === 'read' || value.action === 'unread') message.seen = value.action === 'read';
            else if (value.action === 'star' || value.action === 'unstar') message.starred = value.action === 'star';
            else message.folder = value.destination || ({ archive: 'Archive', trash: 'Trash', spam: 'Spam' })[value.action];
          }
          return reply({});
        }
        if (parts === 'support/drafts') {
          if (req.method() === 'PUT') {
            if (failSave) return bad('Draft save failed.');
            const value = req.postDataJSON(), draft = { ...value, revision: value.revision + 1, updatedAt: new Date().toISOString() }; drafts.set(value.id, draft); return reply(draft);
          }
          requests.drafts++; return reply([...drafts.values()]);
        }
        if (parts.startsWith('support/drafts/')) { drafts.delete(parts.split('/').pop()); return reply({}); }
        if (parts === 'support/send') { sendCount++; if (sendDelay) await new Promise(resolve => setTimeout(resolve, sendDelay)); return reply(sendUnknown ? { status: 'unknown', warning: 'Check the provider Sent folder before sending a new copy.' } : { status: 'sent', messageId: '<sent@example.test>' }); }
        if (parts.includes('/attachments/')) { downloadRequests.push(parts); return route.fulfill({ body: 'Fixture attachment', contentType: 'application/octet-stream', headers: { 'content-disposition': 'attachment; filename=notes.txt' } }); }
        if (/^support\/messages\/\d+$/.test(parts)) {
          requests.message++;
          if (messageDelay) await new Promise(resolve => setTimeout(resolve, messageDelay));
          const message = messages.find(item => item.uid === Number(parts.split('/').pop()));
          return reply({ ...message, replyTo: [{ name: 'Reply team', address: 'replies@example.test' }], cc: [{ name: 'Coordinator', address: 'coordinator@example.test' }], html: richHtml, text: 'Hello FluentXVerse,\n\nPlease find the onboarding documents attached.\n\n<img src="https://tracker.test/pixel">\n\nThank you,\nTutor Operations', references: [], attachments: [{ name: 'onboarding-notes.txt', type: 'text/plain', size: 2096, index: 0 }] });
        }
        if (parts === 'support/messages') {
          requests.list++;
          if (failList) return bad('Mailbox temporarily unavailable.');
          const query = url.searchParams.get('search') || '', filter = url.searchParams.get('filter');
          const matches = messages.filter(item => item.folder === url.searchParams.get('folder') && item.subject.toLowerCase().includes(query.toLowerCase()) && (filter === 'unread' ? !item.seen : filter === 'starred' ? item.starred : true)).map(item => ({ ...item }));
          const page = Math.min(Number(url.searchParams.get('page') || 1), Math.max(1, Math.ceil(matches.length / 25)));
          if (listDelay) await new Promise(resolve => setTimeout(resolve, listDelay));
          return reply({ messages: matches.slice((page - 1) * 25, page * 25), page, total: matches.length, pages: Math.max(1, Math.ceil(matches.length / 25)), uidValidity: '42' });
        }
        return bad('Unexpected mail route: ' + parts);
      });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      diagnostics = async () => { console.error('Email browser failure', { width, errors, requests, downloadRequests, actions, body: (await page.locator('.email-page').innerText()).slice(0, 3000) }); await page.screenshot({ path: `../output/email/failure-${width}.png` }); };
      const checkSpinner = async locator => {
        await expect(locator).toBeVisible();
        const first = await locator.evaluate(node => ({ transform: getComputedStyle(node).transform, animation: getComputedStyle(node).animationName, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }));
        assert.equal(first.animation, reducedMotion ? 'none' : 'mail-spin');
        if (!reducedMotion) {
          await page.waitForTimeout(150);
          assert.notEqual(await locator.evaluate(node => getComputedStyle(node).transform), first.transform, 'Loading indicator must visibly rotate');
        }
        assert.ok(Math.abs(first.width - first.height) < 1, 'Loading indicator keeps a square rotation box');
      };
      await page.goto(base + '/email', { waitUntil: 'domcontentloaded', timeout: 60000 });
      try { await expect(page.locator('.mail-message-row')).toHaveCount(25, { timeout: base.startsWith('https://') ? 20000 : 5000 }); }
      catch (error) { console.error('Email startup state', { width, url: page.url(), errors, body: (await page.locator('body').innerText()).slice(0, 2000) }); await page.screenshot({ path: `../output/email/startup-failure-${width}.png` }); throw error; }
      await page.screenshot({ path: `../output/email/inbox-${width}.png` });
      const fit = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'viewport overflow');
      await fit();
      const workspace = await page.locator('.mail-workspace').boundingBox(), listBounds = await page.locator('.mail-mailbox').boundingBox();
      const contentBounds = await page.locator('.dashboard-content').boundingBox();
      await expect(page.locator('.email-page-heading')).toHaveCount(0);
      assert.ok(Math.abs(workspace.x - contentBounds.x) < 1 && Math.abs(workspace.width - contentBounds.width) < 1, 'Email fills the entire content width without outer padding or a max-width cap');
      assert.ok(Math.abs(workspace.y - contentBounds.y) < 1 && Math.abs(workspace.y + workspace.height - height) < 1, 'Email fills the available viewport height');
      assert.equal(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1), false, 'Email scrolls internally, not the whole page');
      assert.ok(Math.abs(workspace.x + workspace.width - listBounds.x - listBounds.width) < 3, 'Inbox fills the full right-hand content area');
      await expect(page.locator('.mail-reader')).toBeHidden();
      const initialRequests = { ...requests };
      await page.getByRole('button', { name: 'Star Tutor onboarding documents', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Unstar Tutor onboarding documents', exact: true })).toBeEnabled();
      assert.deepEqual(requests, initialRequests, 'Starring must not refetch status, folders, drafts, list or reader');
      await page.getByRole('button', { name: 'Unstar Tutor onboarding documents', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Star Tutor onboarding documents', exact: true })).toBeEnabled();
      failAction = true; await page.getByRole('button', { name: 'Star Tutor onboarding documents', exact: true }).click();
      await expect(page.getByRole('alert').filter({ hasText: 'Message action failed.' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Star Tutor onboarding documents', exact: true })).toBeEnabled();
      assert.deepEqual(requests, initialRequests, 'Failed actions keep the existing mailbox intact'); failAction = false;
      await page.getByRole('button', { name: 'Next message page' }).click(); await expect(page.locator('.mail-message-row')).toHaveCount(6);
      const beforeCachedPage = requests.list;
      await page.getByRole('button', { name: 'Previous message page' }).click(); await expect(page.locator('.mail-message-row')).toHaveCount(25);
      assert.equal(requests.list, beforeCachedPage, 'Returning to a cached page must not refetch it');
      await page.getByRole('searchbox', { name: 'Search email' }).fill('no-such-subject'); await page.getByRole('searchbox', { name: 'Search email' }).press('Enter');
      await expect(page.getByRole('heading', { name: 'No matching messages' })).toBeVisible(); await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
      await expect(page.locator('.mail-message-row')).toHaveCount(25);
      await page.getByLabel('Select Tutor onboarding documents', { exact: true }).check();
      const beforeRead = { ...requests };
      await page.getByRole('button', { name: 'Mark selected as unread', exact: true }).click(); await expect.poll(() => actions.some(item => item.action === 'unread' && item.uidValidity === '42')).toBe(true);
      await expect(page.getByRole('button', { name: 'Refresh email', exact: true })).toBeEnabled();
      assert.deepEqual(requests, beforeRead, 'Read/unread actions must not reload the mailbox');
      messageDelay = 1000;
      await page.locator('.mail-row-content').first().click();
      await checkSpinner(page.locator('.mail-reader .ri-loader-4-line'));
      await expect(page.locator('.mail-message-heading h2')).toHaveText('Tutor onboarding documents'); messageDelay = 0;
      await expect(page.frameLocator('.mail-html-body').locator('strong')).toHaveText('FluentXVerse');
      await expect(page.locator('.mail-mailbox')).toBeHidden();
      const readerBounds = await page.locator('.mail-reader').boundingBox();
      await expect(page.getByRole('button', { name: 'Refresh email', exact: true })).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Email settings', exact: true })).toBeEnabled();
      const header = page.locator('.mail-message-heading'), details = header.locator('details'), detailsButton = header.locator('summary');
      await expect(details.locator('dl')).toBeHidden(); await expect(detailsButton).toContainText('to me');
      const headerBounds = await header.boundingBox();
      assert.ok(headerBounds.height <= (width <= 700 ? 130 : 100), 'Message header stays compact with details collapsed');
      assert.equal(await header.evaluate(node => getComputedStyle(node).borderBottomWidth), '0px', 'Header flows into the message without a divider');
      if (width > 700) {
        const contentBounds = await page.locator('.mail-content').boundingBox(), senderBounds = await header.locator('.mail-sender-line').boundingBox(), subjectBounds = await header.locator('h2').boundingBox();
        assert.ok(Math.abs(contentBounds.x - senderBounds.x) < 1 && Math.abs(subjectBounds.x - senderBounds.x) < 1, 'Subject, sender text and message body share an alignment');
        await expect(header.locator('.mail-sender-email')).toContainText('team@example.test');
      }
      const beforeDetails = { ...requests };
      await detailsButton.click(); await expect(details.locator('dl')).toBeVisible();
      await expect(details.locator('dl')).toContainText('coordinator@example.test'); await expect(details.locator('dl')).toContainText('replies@example.test');
      const detailsBounds = await details.locator('dl').boundingBox();
      assert.ok(detailsBounds.x >= 0 && detailsBounds.x + detailsBounds.width <= width + 1, 'Message details fit the viewport');
      await page.screenshot({ path: `../output/email/details-${width}.png` });
      await page.keyboard.press('Escape'); await expect(details.locator('dl')).toBeHidden(); await expect(detailsButton).toBeFocused();
      await detailsButton.press('Enter'); await expect(details.locator('dl')).toBeVisible();
      await header.locator('h2').click(); await expect(details.locator('dl')).toBeHidden();
      assert.deepEqual(requests, beforeDetails, 'Opening and closing message details never refetches mail');
      await page.screenshot({ path: `../output/email/compact-header-${width}.png` });
      assert.ok(Math.abs(readerBounds.width - listBounds.width) < 3, 'Opening a message replaces the list at the same full width');
      assert.equal(remoteImages, 0); assert.equal(await page.evaluate(() => Boolean(window.mailInjected)), false);
      const bodyFrame = page.frameLocator('.mail-html-body');
      await expect.poll(() => bodyFrame.getByAltText('Embedded FluentXVerse logo').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
      assert.equal(await bodyFrame.locator('td').first().evaluate(node => getComputedStyle(node).borderTopWidth), '0px');
      await expect.poll(() => page.locator('.mail-html-body').evaluate(frame => frame.clientHeight)).toBeGreaterThan(600);
      await page.getByRole('button', { name: 'Show images', exact: true }).click();
      await expect.poll(() => remoteImages).toBeGreaterThan(0);
      await expect.poll(() => bodyFrame.getByAltText('Welcome illustration').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
      assert.equal(await bodyFrame.locator('html').evaluate(node => node.scrollWidth > innerWidth + 1), false, 'Formatted email fits without a nested horizontal scrollbar');
      await page.screenshot({ path: `../output/email/formatted-${width}.png` });
      await page.getByRole('button', { name: 'Hide images', exact: true }).click();
      await page.locator('.mail-reader-scroll').evaluate(node => { node.scrollTop = 500; });
      await page.getByRole('button', { name: 'Next message', exact: true }).click();
      await expect(page.locator('.mail-message-heading h2')).toHaveText('Question about my next lesson');
      await expect.poll(() => page.locator('.mail-reader-scroll').evaluate(node => node.scrollTop)).toBe(0);
      await page.getByRole('button', { name: 'Previous message', exact: true }).click();
      await expect(page.locator('.mail-message-heading h2')).toHaveText('Tutor onboarding documents');
      await page.getByRole('button', { name: 'Plain text', exact: true }).click(); await expect(page.locator('.mail-text-body')).toContainText('<img src=');
      assert.equal(await page.locator('.mail-text-body img').count(), 0, 'Received markup is never rendered as HTML');
      await page.getByRole('button', { name: 'Formatted', exact: true }).click();
      await expect.poll(() => page.locator('.mail-html-body').evaluate(frame => frame.clientHeight)).toBeGreaterThan(600);
      await expect.poll(() => page.frameLocator('.mail-html-body').getByAltText('Embedded FluentXVerse logo').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
      const download = page.getByRole('button', { name: 'Download onboarding-notes.txt' });
      await download.scrollIntoViewIfNeeded();
      await expect(download).toBeInViewport({ ratio: 1 });
      const downloaded = page.waitForEvent('download');
      await download.click(); await downloaded; await expect.poll(() => downloadRequests.length).toBe(1);
      await page.screenshot({ path: `../output/email/reader-${width}.png` }); await fit();
      const beforeReaderStar = { ...requests };
      const star = page.getByRole('button', { name: 'Star message', exact: true });
      await star.scrollIntoViewIfNeeded(); await expect(star).toBeInViewport({ ratio: 1 });
      await star.click();
      await expect(page.getByRole('button', { name: 'Unstar message', exact: true })).toBeEnabled();
      await expect(page.locator('.mail-message-heading h2')).toHaveText('Tutor onboarding documents');
      assert.deepEqual(requests, beforeReaderStar, 'Starring the open message must preserve its body without any GET');
      const backToList = async () => { if (await page.getByRole('button', { name: 'Back to message list' }).isVisible()) await page.getByRole('button', { name: 'Back to message list' }).click(); };
      await backToList();
      await page.getByRole('button', { name: /Tutor Operations.*Lesson follow-up 27/ }).click();
      await expect(page.locator('.mail-message-heading h2')).toHaveText('Lesson follow-up 27');
      const beforeCachedReader = { ...requests }; await backToList();
      await page.locator('.mail-row-content').first().click(); await expect(page.locator('.mail-message-heading h2')).toHaveText('Tutor onboarding documents');
      assert.deepEqual(requests, beforeCachedReader, 'Reopening a cached read message must not fetch its body again');
      await backToList();
      const navigateFolder = async name => {
        if (width <= 700) await page.getByRole('button', { name: 'Toggle mail folders' }).click();
        await page.getByRole('button', { name, exact: true }).click();
      };
      await navigateFolder('Sent'); await expect(page.getByRole('heading', { name: 'No messages', exact: true })).toBeVisible();
      const beforeCachedFolder = { ...requests };
      await navigateFolder('Inbox 1'); await expect(page.locator('.mail-message-row')).toHaveCount(25);
      assert.deepEqual(requests, beforeCachedFolder, 'Returning to Inbox must reuse its cached list and existing folder tree');
      await page.locator('.mail-row-content').first().click(); await expect(page.locator('.mail-message-heading h2')).toHaveText('Tutor onboarding documents');
      const messageCommand = async (top, bottom) => {
        await expect.poll(() => page.locator('.mail-html-body').evaluate(frame => frame.clientHeight)).toBeGreaterThan(600);
        const button = page.getByRole('button', { name: top, exact: true }), target = await button.isVisible() ? button : page.getByRole('button', { name: bottom, exact: true });
        await target.scrollIntoViewIfNeeded(); await expect(target).toBeInViewport({ ratio: 1 }); await target.click();
      };
      await messageCommand('Forward message', 'Forward');
      const forward = page.getByRole('dialog', { name: 'Forward message', exact: true });
      await expect(forward.getByLabel('Subject', { exact: true })).toHaveValue('Fwd: Tutor onboarding documents'); await expect(forward.locator('.mail-file-list')).toContainText('onboarding-notes.txt');
      await page.keyboard.press('Escape'); await expect(forward).toHaveCount(0);
      await messageCommand('Reply to all', 'Reply all');
      let composer = page.getByRole('dialog', { name: 'Reply', exact: true }); await expect(composer).toBeVisible();
      await expect(composer.getByLabel('To recipients')).toHaveValue('replies@example.test'); await expect(composer.getByLabel('Cc recipients')).toHaveValue('coordinator@example.test');
      await expect(composer.getByLabel('Subject', { exact: true })).toHaveValue('Re: Tutor onboarding documents');
      await composer.getByRole('textbox', { name: 'Message body' }).press('Control+Home'); await composer.getByRole('textbox', { name: 'Message body' }).pressSequentially('Thank you for the update. ');
      await expect(composer.getByRole('status')).toHaveText('Draft saved');
      await composer.getByLabel('Attachment files', { exact: true }).setInputFiles({ name: 'reply.txt', mimeType: 'text/plain', buffer: Buffer.from('Reply attachment') });
      await expect(composer.locator('.mail-file-list')).toContainText('reply.txt');
      await page.screenshot({ path: `../output/email/compose-${width}.png` });
      const bounds = await composer.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
      const beforeSend = { ...requests };
      sendDelay = 1000;
      await composer.getByRole('button', { name: 'Send', exact: true }).click();
      await checkSpinner(composer.locator('.ri-loader-4-line'));
      await expect(composer).toHaveCount(0); sendDelay = 0; assert.equal(sendCount, 1);
      assert.equal(requests.status, beforeSend.status); assert.equal(requests.drafts, beforeSend.drafts); assert.equal(requests.list, beforeSend.list); assert.equal(requests.message, beforeSend.message);
      await expect(page.getByRole('status').filter({ hasText: 'Message accepted by the email provider.' })).toBeVisible();
      await page.getByRole('button', { name: 'Email settings', exact: true }).click();
      const settings = page.getByRole('dialog', { name: 'Email settings', exact: true });
      await settings.getByLabel('Your outgoing signature').fill('FluentXVerse Support Team');
      await settings.getByRole('textbox', { name: 'Contact name' }).fill('New contact'); await settings.getByRole('textbox', { name: 'Contact email' }).fill('new@example.test');
      await settings.getByRole('button', { name: 'Add contact' }).click(); await settings.getByRole('button', { name: 'Test connection' }).click();
      await expect(settings.getByRole('status')).toContainText('IMAP and SMTP connected');
      await settings.getByRole('button', { name: 'Save settings' }).click(); await expect(settings).toHaveCount(0); assert.equal(preferences.contacts.length, 2);
      if (await page.getByRole('button', { name: 'Back to message list' }).isVisible()) await page.getByRole('button', { name: 'Back to message list' }).click();
      if (width <= 700) await page.getByRole('button', { name: 'Toggle mail folders' }).click();
      await page.getByRole('button', { name: 'Compose', exact: true }).click(); composer = page.getByRole('dialog', { name: 'New message', exact: true });
      await composer.getByLabel('To recipients').fill('new@example.test'); await composer.getByLabel('Subject', { exact: true }).fill('Unknown outcome fixture');
      failSave = true; await composer.getByRole('textbox', { name: 'Message body' }).press('Control+Home'); await composer.getByRole('textbox', { name: 'Message body' }).pressSequentially('A new message. ');
      await expect(composer.getByRole('alert')).toContainText('Draft save failed'); failSave = false;
      await composer.getByRole('button', { name: 'Save draft', exact: true }).click(); await expect(composer.getByRole('status')).toHaveText('Draft saved');
      sendUnknown = true; await composer.getByRole('button', { name: 'Send', exact: true }).click(); await expect(composer.getByRole('alert')).toContainText('Check the provider Sent');
      await expect(composer.getByRole('button', { name: 'Send', exact: true })).toBeDisabled(); assert.equal(sendCount, 2);
      await page.keyboard.press('Escape'); await expect(composer).toHaveCount(0);
      if (await page.getByRole('button', { name: 'Back to message list' }).isVisible()) await page.getByRole('button', { name: 'Back to message list' }).click();
      const beforeMove = { ...requests }; listDelay = 1000;
      await page.getByLabel('Select Lesson follow-up 7', { exact: true }).check();
      await page.getByRole('button', { name: 'Archive selected messages', exact: true }).click();
      await expect.poll(() => requests.list).toBe(beforeMove.list + 1);
      await expect(page.locator('.mail-message-row')).toHaveCount(24);
      await expect(page.getByRole('heading', { name: 'Loading messages...', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Star Lesson follow-up 8', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Unstar Lesson follow-up 8', exact: true })).toBeEnabled();
      await expect(page.locator('.mail-message-row')).toHaveCount(25); listDelay = 0;
      await expect(page.getByRole('button', { name: 'Unstar Lesson follow-up 8', exact: true })).toBeEnabled();
      assert.equal(requests.status, beforeMove.status); assert.equal(requests.folders, beforeMove.folders); assert.equal(requests.drafts, beforeMove.drafts); assert.equal(requests.message, beforeMove.message);
      failList = true; await page.getByRole('button', { name: 'Refresh email', exact: true }).click(); await expect(page.getByRole('alert').filter({ hasText: 'Mailbox temporarily unavailable.' })).toBeVisible();
      failList = false; await page.getByRole('alert').filter({ hasText: 'Mailbox temporarily unavailable.' }).getByRole('button', { name: 'Retry', exact: true }).click(); await expect(page.locator('.mail-message-row')).toHaveCount(25);
      connected = false; await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      try { await expect(page.getByRole('heading', { name: 'No mailbox connected' })).toBeVisible({ timeout: base.startsWith('https://') ? 20000 : 5000 }); }
      catch (error) { console.error('Email reload state', { width, url: page.url(), errors, body: (await page.locator('body').innerText()).slice(0, 2000) }); await page.screenshot({ path: `../output/email/reload-failure-${width}.png` }); throw error; }
      if (width <= 700) await page.getByRole('button', { name: 'Toggle mail folders' }).click();
      await expect(page.getByRole('button', { name: 'Compose', exact: true })).toBeDisabled();
      await page.screenshot({ path: `../output/email/disconnected-${width}.png` }); await fit();
      connected = true;
      messages[0].from = [{ name: 'InternationalCustomerSuccessAndLearningOperationsCoordinator', address: 'averylongunbrokenmailboxaddressforlearningoperations@example.test' }];
      messages[0].subject = 'Following up on your teaching schedule and upcoming lesson arrangements';
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.locator('.mail-row-content').first().click(); await expect(page.locator('.mail-message-heading h2')).toHaveText(messages[0].subject);
      const longName = await page.locator('.mail-sender-line').boundingBox(), recipientLine = await page.locator('.mail-header-details summary').boundingBox(), starBounds = await page.locator('.mail-header-end .mail-tool').boundingBox();
      assert.ok(longName.y + longName.height <= recipientLine.y + 1, 'Long sender names do not overlap the recipient disclosure');
      assert.ok(longName.x + longName.width <= starBounds.x && starBounds.x + starBounds.width <= width, 'Long sender addresses do not overlap or push actions offscreen');
      await page.locator('.mail-header-details summary').click();
      await expect(page.locator('.mail-address-details')).toContainText(messages[0].from[0].address);
      const longDetails = await page.locator('.mail-address-details').boundingBox();
      assert.ok(longDetails.x + longDetails.width <= width, 'Full long addresses remain available without overflowing the details panel');
      await page.screenshot({ path: `../output/email/long-header-${width}.png` }); await fit();
      assert.deepEqual(errors, []); console.log(`PASS email ${width}: no broad action reloads, cached pages/folders/readers, quiet move refill, failure retention, safe content, composer, send-once, settings, recovery and no-provider state`);
      await context.close();
    }
  } catch (error) { if (diagnostics) await diagnostics(); throw error; } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
