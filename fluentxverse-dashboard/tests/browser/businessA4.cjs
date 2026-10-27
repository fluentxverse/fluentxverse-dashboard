const { chromium, expect } = require('playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { execFileSync } = require('node:child_process');
const base = process.env.ADMIN_TEST_URL || 'http://127.0.0.1:5180';
const output = process.env.BUSINESS_A4_OUTPUT || '/tmp/business-a4';

const fixture = {
  id: 'a4-fixture', course: 'business-english', level: 3, chapter: 1, chapterName: 'Work Introductions', lessonNumber: 1,
  lessonName: 'Introducing Your Team', skill: 'listening', status: 'published', sections: [],
  beData: { lessonType: 'LISTENING', introduce: { goalEn: 'Introduce yourself and a coworker.', goalKr: '자신과 동료를 소개할 수 있습니다.', situationEn: 'A new coworker joins your team.', situationKr: '', tutorNotes: [{ type: 'script', text: 'Please introduce yourself and your coworker.' }] } },
};

(async () => {
  const source = process.env.BUSINESS_A4_FIXTURE ? JSON.parse(await fs.readFile(process.env.BUSINESS_A4_FIXTURE, 'utf8')) : fixture;
  const sourceLesson = source.lesson || source;
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir(output, { recursive: true });
  try {
    for (const mode of (process.env.BUSINESS_A4_MODES || 'editor,preview').split(',')) for (const theme of (process.env.BUSINESS_A4_THEMES || 'light,dark').split(',')) for (const width of process.env.BUSINESS_A4_WIDTHS ? process.env.BUSINESS_A4_WIDTHS.split(',').map(Number) : mode === 'editor' ? [1566] : [1566, 768, 375]) {
      let lesson = structuredClone(sourceLesson);
      const writes = [], errors = [];
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      await context.addInitScript(theme => localStorage.setItem('beve-theme', theme), theme);
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, async route => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        const headers = { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,PATCH,OPTIONS', 'access-control-allow-headers': 'Content-Type,Authorization' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (request.method() !== 'GET') {
          assert.equal(mode, 'editor');
          assert.equal(request.method(), 'PATCH');
          assert.equal(path, `/lesson-materials/${lesson.id}/header`);
          const payload = request.postDataJSON();
          writes.push(payload);
          lesson = { ...lesson, ...payload };
        }
        return route.fulfill({ json: { success: true, lesson, user: { userId: 'a4-admin', username: 'Admin', role: 'superadmin' } }, headers });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/business-english-${mode === 'editor' ? 'visual-editor' : 'preview'}/${lesson.id}`, { waitUntil: 'networkidle' });
      await expect(page.locator('.beve-a4-canvas')).toHaveAttribute('aria-busy', 'false');
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('.beve-a4-paper[data-overflow="true"]')).toHaveCount(0);
      const geometry = await page.locator('.beve-a4-paper').evaluateAll(pages => pages.map(page => {
        const paper = page.getBoundingClientRect();
        const body = page.querySelector('.beve-a4-paper-body').getBoundingClientRect();
        const footer = page.querySelector('.beve-page-footer').getBoundingClientRect();
        const blocks = [...page.querySelectorAll('[data-a4-section]')].map(block => block.getBoundingClientRect());
        return { ratio: paper.width / paper.height, fits: blocks.every(block => block.top >= body.top - 1 && block.bottom <= footer.top + 1 && block.right <= paper.right + 1), notesInside: page.querySelectorAll('.beve-col-tutor').length };
      }));
      assert(geometry.length > 0);
      assert(geometry.every(page => Math.abs(page.ratio - 210 / 297) < .001 && page.fits && !page.notesInside), JSON.stringify(geometry));
      const pageCount = geometry.length;
      assert(await page.locator('.beve-a4-canvas').evaluate(element => element.clientHeight < element.scrollHeight), 'Lesson pages scroll inside the document canvas');
      if (width > 700) assert(await page.locator('.beve-a4-view-controls').evaluate(element => element.getBoundingClientRect().bottom <= innerHeight), 'Zoom and print controls stay inside the viewport');
      await fs.writeFile(`${output}/${mode}-${theme}-${width}-measurements.json`, JSON.stringify(await page.locator('.beve-a4-measure [data-measure]').evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.measure, height: node.getBoundingClientRect().height }))), null, 2));
      assert.equal(await page.locator('.beve-a4-sidebar .beve-sidebar-page').count(), pageCount);
      if (mode === 'editor') {
        const updatedGoal = 'Introduce yourself and a coworker clearly.';
        await page.locator('.beve-a4-paper .beve-goal-en .beve-rich-input').first().fill(updatedGoal);
        const breakButton = page.getByRole('button', { name: 'Start Key Expressions on a new page', exact: true });
        await breakButton.click();
        await expect(breakButton).toHaveAttribute('aria-pressed', 'true');
        await expect.poll(() => page.locator('.beve-a4-paper').count()).toBeGreaterThan(pageCount);
        await page.locator('.beve-toolbar-right button').filter({ hasText: /^Save$/ }).click();
        await expect.poll(() => writes.length).toBe(1);
        assert(writes[0].beData.a4Layout.breaksBefore.includes('section-0-1'));
        assert.equal(writes[0].beData.introduce.goalEn, updatedGoal);
        await page.reload({ waitUntil: 'networkidle' });
        await expect(page.getByRole('button', { name: 'Start Key Expressions on a new page', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('.beve-a4-paper .beve-goal-en .beve-rich-input').first()).toHaveText(updatedGoal);
      } else assert.equal(writes.length, 0);
      await page.screenshot({ path: `${output}/${mode}-${theme}-${width}.png` });
      await page.setViewportSize({ width, height: 1600 });
      await page.locator('.beve-a4-paper').first().screenshot({ path: `${output}/${mode}-${theme}-${width}-page1.png` });
      if (mode === 'preview' && theme === 'light' && width === 1566) {
        for (let index = 0; index < pageCount; index++) await page.locator('.beve-a4-paper').nth(index).screenshot({ path: `${output}/page-${index + 1}.png` });
        await page.emulateMedia({ media: 'print' });
        await page.waitForTimeout(150);
        await expect(page.locator('.beve-a4-paper')).toHaveCount(pageCount);
        await expect(page.locator('.beve-a4-guide').first()).toBeHidden();
        await page.pdf({ path: `${output}/lesson-1-a4.pdf`, preferCSSPageSize: true, printBackground: true });
        const pdf = execFileSync('pdfinfo', [`${output}/lesson-1-a4.pdf`], { encoding: 'utf8' });
        assert.equal(Number(pdf.match(/^Pages:\s+(\d+)/m)[1]), pageCount, 'PDF contains every A4 sheet');
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${mode} ${theme} ${width}: ${pageCount} A4 pages, no clipped activities, teaching notes outside paper${mode === 'editor' ? ', page break persisted and restored' : ''}`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
