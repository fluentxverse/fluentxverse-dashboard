const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || 'playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const admin = process.env.ADMIN_TEST_URL || 'http://127.0.0.1:5180';
const tutor = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';
const output = process.env.BUSINESS_HEADER_SCREENSHOTS || '/tmp/business-material-header';
const kinds = (process.env.BUSINESS_HEADER_KINDS || 'editor,preview,tutor,tutor-embedded').split(',');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir(output, { recursive: true });
  try {
    for (const kind of kinds) for (const theme of ['dark', 'light']) for (const width of kind === 'editor' ? [1566, 1024] : kind === 'tutor-embedded' ? [768, 375, 320] : [1566, 768, 375, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      await context.addInitScript(theme => {
        localStorage.setItem('beve-theme', theme);
        localStorage.setItem('theme-storage', JSON.stringify({ state: { themeMode: theme, isDarkMode: theme === 'dark' }, version: 2 }));
      }, theme);
      const lesson = { id: 'header-fixture', course: 'business-english', level: 3, chapter: 2, chapterName: 'Work introductions', lessonNumber: 1,
        lessonName: width <= 320 ? 'Introducing Your Team and Building Professional Relationships Across International Departments' : 'Introducing Your Team',
        levelBadge: 'BEGINNER', skill: 'listening', status: 'published', goalTextEn: 'Introduce yourself and a coworker.', beData: { lessonType: 'LISTENING' }, sections: [] };
      const writes = [], errors = [];
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname;
        const headers = { 'access-control-allow-origin': new URL(request.headers().origin || admin).origin, 'access-control-allow-credentials': 'true',
          'access-control-allow-headers': 'Content-Type, Authorization', 'access-control-allow-methods': 'GET, PATCH, OPTIONS' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (request.method() !== 'GET') {
          assert(kind === 'editor' && request.method() === 'PATCH' && path === '/lesson-materials/header-fixture/header', 'Only the explicit fixture save is permitted');
          writes.push(request.postDataJSON());
          return route.fulfill({ json: { success: true, lesson }, headers });
        }
        let json = { success: true, data: [], lessons: [], status: { passed: true } };
        if (path === '/admin/me') json.user = { userId: 'header-admin', username: 'Admin', role: 'superadmin' };
        else if (path === '/tutor/me') json.user = { userId: 'header-tutor', firstName: 'Alex', lastName: 'Teacher', role: 'tutor' };
        else if (path.startsWith('/lesson-materials/')) json.lesson = lesson;
        else if (path === '/schedule/week') json.data = { slots: [] };
        else if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        else if (path.endsWith('/unread-count')) json.data = { unreadCount: 0 };
        return route.fulfill({ json, headers });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      const path = kind === 'editor' ? '/business-english-visual-editor/header-fixture' : kind === 'preview' ? '/business-english-preview/header-fixture' : '/materials/business-english/header-fixture';
      const url = (kind.startsWith('tutor') ? tutor : admin) + path;
      const embedded = kind === 'tutor-embedded';
      if (embedded) {
        await context.route(tutor + '/__header-embed-fixture', route => route.fulfill({ contentType: 'text/html',
          body: `<!doctype html><html><head><style>html,body{margin:0;height:100%}iframe{display:block;width:100%;height:100%;border:0}</style></head><body><iframe title="Lesson material" src="${url}"></iframe></body></html>` }));
      }
      await page.goto(embedded ? tutor + '/__header-embed-fixture' : url, { waitUntil: 'domcontentloaded' });
      const surface = embedded ? page.frameLocator('iframe') : page;
      const header = surface.locator('.beve-page-header').first();
      await header.waitFor().catch(async error => { console.error({ kind, theme, width, url: page.url(), errors, body: await page.locator('body').innerText() }); throw error; });
      await expect(surface.locator('.beve')).toHaveClass(new RegExp('(^| )' + theme + '( |$)'));
      if (embedded) await expect(surface.locator('.beve')).toHaveClass(/beve-preview--embedded/);
      assert.equal(await surface.locator('.beve-page-header').count(), 7);
      await expect(header.getByRole('heading', { name: 'Lesson 1 ' + lesson.lessonName, exact: true })).toBeVisible();
      await expect(header.locator('.beve-header-brand-sub')).toHaveText('Business English');
      await expect(header.locator('.beve-header-lesson-number')).toHaveText('Lesson 1');
      await expect(header.locator('.beve-header-lesson-title')).toHaveText(lesson.lessonName);
      await expect(header.locator('.beve-header-chapter')).toHaveText('Chapter 2 / Work introductions');
      await expect(header.locator('.beve-header-level')).toHaveText('Level 3');
      await expect(header.locator('.beve-header-page')).toHaveText('Page 1');
      assert.equal(await header.locator('.beve-preview-type-pill').count(), 0);
      assert(await header.evaluate(async () => {
        const pattern = new Image();
        pattern.src = '/assets/img/materials/business-header-pattern.svg';
        await pattern.decode();
        const response = await fetch(pattern.src);
        const art = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
        return pattern.naturalWidth === 660 && !art.querySelector('parsererror')
          && ['briefcase', 'conversation', 'presentation', 'document', 'gear'].every(id => art.getElementById(id) && art.querySelector(`use[href="#${id}"]`))
          && !art.querySelector('animate, animateTransform');
      }), 'Business artwork must render with workplace motifs and no animation');
      assert.equal(await header.evaluate(el => getComputedStyle(el).backgroundImage), 'none');
      const masthead = await header.evaluate(el => {
        const style = getComputedStyle(el), watermark = getComputedStyle(el, '::after'), panel = getComputedStyle(el, '::before');
        return { background: style.backgroundColor, accent: style.borderBottomWidth, watermark: watermark.backgroundImage,
          artworkOpacity: parseFloat(watermark.opacity), panelShape: panel.clipPath,
          animated: [style, watermark, panel].some(s => s.animationName !== 'none') };
      });
      assert.equal(masthead.background, 'rgb(19, 16, 25)');
      assert(parseFloat(masthead.accent) >= 1 && parseFloat(masthead.accent) <= 2, 'Violet trim stays thin at the material canvas zoom');
      assert(masthead.watermark.includes('business-header-pattern.svg'));
      assert(masthead.artworkOpacity >= .3, 'Business artwork remains visible rather than a faint watermark');
      assert(masthead.panelShape.startsWith('polygon('), 'Angular violet framing remains present');
      assert.equal(masthead.animated, false);
      for (const selector of ['.beve-header-brand-text', '.beve-header-lesson-title']) {
        assert.equal(await header.locator(selector).evaluate(el => getComputedStyle(el).color), 'rgb(245, 242, 250)', `${kind} ${theme}: masthead titles keep their contrast`);
      }
      if (width >= 1024) assert((await header.boundingBox()).height < 165, 'Default desktop masthead stays below 165px');
      const layout = await header.evaluate(el => {
        const r = el.getBoundingClientRect();
        return [...el.querySelectorAll('.beve-header-brand,.beve-header-meta,.beve-header-lesson,.beve-header-lesson-number,.beve-header-lesson-title,.beve-header-chapter,.beve-header-row2-right')].map(child => {
          const b = child.getBoundingClientRect();
          return { class: child.className, fits: b.left >= r.left - 1 && b.right <= r.right + 1 && b.top >= r.top - 1 && b.bottom <= r.bottom + 1, contentFits: child.scrollWidth <= child.clientWidth + 1 };
        });
      });
      assert(layout.every(item => item.fits && item.contentFits), JSON.stringify({ kind, theme, width, layout }));
      if (kind === 'editor') {
        assert.equal(await header.locator('.beve-skill-badge').count(), 0);
        assert.equal(await header.getByLabel('Lesson skill', { exact: true }).evaluate(el => getComputedStyle(el).color), 'rgb(211, 187, 255)', 'Skill selector remains readable in both themes');
        await header.getByLabel('Lesson skill', { exact: true }).selectOption('WRITING');
        await expect(page.getByLabel('Lesson skill', { exact: true }).last()).toHaveValue('WRITING');
        await page.locator('.beve-toolbar-right button').filter({ hasText: /^Save$/ }).click();
        await expect.poll(() => writes.length).toBe(1);
        assert.equal(writes[0].beData.lessonType, 'WRITING');
      } else {
        await expect(header.locator('.beve-skill-badge')).toHaveText('listening');
        assert.equal(writes.length, 0);
      }
      await header.screenshot({ path: `${output}/${kind}-${theme}-${width}-header.png`, animations: 'disabled' });
      if (width >= 1024) await page.screenshot({ path: `${output}/${kind}-${theme}-${width}.png`, animations: 'disabled' });
      assert.deepEqual(errors, []);
      console.log(`PASS ${kind} ${theme} ${width}: black/violet masthead, static business pattern, single skill, title/metadata fit${kind === 'editor' ? ', skill save preserved' : ''}`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
