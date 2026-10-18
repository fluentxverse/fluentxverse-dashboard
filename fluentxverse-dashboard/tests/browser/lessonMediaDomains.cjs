const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || 'playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

const originalId = 'conversational-skills-L3-C1-1-speaking-1774155960030';
const liveOriginal = process.env.LESSON_MEDIA_LIVE_ORIGINAL === '1';
const id = liveOriginal ? originalId : 'media-domain-fixture';
const publicApi = 'https://api.fluentxverse.com';
const selected = (process.env.LESSON_MEDIA_APPS || 'dashboard,tutor,student').split(',');
const widths = (process.env.LESSON_MEDIA_WIDTHS || '1566,375').split(',').map(Number);
const states = liveOriginal ? ['live'] : (process.env.LESSON_MEDIA_STATES || 'api,cache').split(',');
const output = process.env.LESSON_MEDIA_SCREENSHOTS || '/tmp/lesson-media-domains';
const apps = [
  { name: 'dashboard', base: process.env.ADMIN_TEST_URL || 'http://127.0.0.1:5180', path: `/conversational-skills-preview/${id}` },
  { name: 'tutor', base: process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177', path: `/materials/conversational-skills/${id}` },
  { name: 'student', base: process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176', path: `/materials/conversational-skills/${id}` },
].filter(app => selected.includes(app.name));

(async () => {
  const response = await fetch(`${publicApi}/lesson-materials/public/${originalId}`);
  assert.equal(response.status, 200);
  const { lesson: original } = await response.json();
  const legacyPaths = new Set();
  const collect = data => {
    if (typeof data === 'string' && data.startsWith('https://api.fluentxverse.xyz/lesson/files/')) legacyPaths.add(new URL(data).pathname);
    else if (data && typeof data === 'object') Object.values(data).forEach(collect);
  };
  collect(original);
  assert.equal(legacyPaths.size, 8, 'Regression uses all eight persisted broken image URLs');
  const lesson = { ...original, id };
  const legacyImage = lesson.learnData.steps[0].vocabularyItems[0].image;
  lesson.backgroundImage = legacyImage;
  lesson.exerciseData.instructions = `Read the image. <img src="${legacyImage}" alt="Legacy rich-text image" width="80" height="60">`;
  const assets = new Map();
  const asset = path => {
    if (!assets.has(path)) assets.set(path, (async () => {
      const result = await fetch(publicApi + path);
      assert.equal(result.status, 200, `Stored image still exists: ${path}`);
      assert.match(result.headers.get('content-type'), /^image\//);
      return { body: Buffer.from(await result.arrayBuffer()), contentType: result.headers.get('content-type') };
    })());
    return assets.get(path);
  };
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  await fs.mkdir(output, { recursive: true });
  try {
    for (const app of apps) for (const width of widths) for (const state of states) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      const failures = [], oldRequests = [], imageRequests = new Set();
      await context.addInitScript(({ lesson, state }) => {
        localStorage.setItem('csve-theme', 'light');
        if (state === 'cache') sessionStorage.setItem(`preview-${lesson.id}`, JSON.stringify(lesson));
      }, { lesson, state });
      await context.route('https://images.unsplash.com/**', route => route.fulfill({ contentType: 'image/png',
        body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jW1kAAAAASUVORK5CYII=', 'base64') }));
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//, async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname;
        const headers = { 'access-control-allow-origin': request.headers().origin || app.base,
          'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'Content-Type, Authorization, Cache-Control, Pragma',
          'access-control-allow-methods': 'GET, OPTIONS' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (request.method() !== 'GET') return route.fulfill({ status: 403, json: { error: 'No test writes permitted' }, headers });
        if (path.startsWith('/lesson/files/')) {
          if (url.hostname === 'api.fluentxverse.xyz') {
            oldRequests.push(request.url());
            return route.abort('namenotresolved');
          }
          imageRequests.add(path);
          if (liveOriginal) return route.continue();
          return route.fulfill({ ...await asset(path), headers });
        }
        let json = { success: true, data: [], lessons: [], status: { passed: true } };
        if (path === '/admin/me') json.user = { userId: 'media-admin', username: 'Admin', role: 'superadmin' };
        else if (path === '/tutor/me') json.user = { userId: 'media-tutor', firstName: 'Alex', lastName: 'Teacher', role: 'tutor' };
        else if (path === '/student/me') json.user = { userId: 'media-student', givenName: 'Mika', role: 'student' };
        else if (path === `/lesson-materials/public/${id}`) {
          if (liveOriginal) return route.continue();
          if (state === 'cache') return route.fulfill({ status: 503, json: { error: 'Cached preview regression' }, headers });
          json.lesson = lesson;
        } else if (path === '/schedule/week') json.data = { slots: [] };
        else if (path === '/notifications') json.data = { notifications: [], unreadCount: 0 };
        else if (path.endsWith('/unread-count')) json.data = { unreadCount: 0 };
        return route.fulfill({ json, headers });
      });
      const page = await context.newPage();
      page.on('pageerror', error => failures.push(error.message));
      await page.goto(app.base + app.path, { waitUntil: 'domcontentloaded' });
      const images = page.locator('.csp-vocab-image img');
      await expect(images).toHaveCount(6, { timeout: 20000 }).catch(async error => {
        console.error({ app: app.name, width, state, url: page.url(), failures, body: await page.locator('body').innerText() });
        throw error;
      });
      if (!liveOriginal) await expect(page.getByAltText('Legacy rich-text image')).toHaveCount(1, { timeout: 20000 });
      const media = await page.locator('img').evaluateAll(async elements => {
        const images = elements.filter(image => image.src.includes('/lesson/files/'));
        for (const image of images) await image.decode();
        return images.map(image => ({ src: image.src, width: image.naturalWidth, height: image.naturalHeight }));
      });
      assert(media.length >= 9, 'Vocabulary, apply, trivia, mission and rich-text images all render');
      assert(media.every(image => new URL(image.src).hostname !== 'api.fluentxverse.xyz' && image.width > 32 && image.height > 32), JSON.stringify(media));
      assert.deepEqual([...imageRequests].sort(), [...legacyPaths].sort(), 'All eight stored images load through the current API');
      assert.deepEqual(oldRequests, [], 'No media request depends on retired .xyz DNS');
      assert.deepEqual(failures, []);
      const background = await page.locator('.csp-hero').first().evaluate(el => getComputedStyle(el).backgroundImage);
      assert(!background.includes('api.fluentxverse.xyz'), 'Lesson cover backgrounds migrate too');
      await images.first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/${app.name}-${width}-${state}.png` });
      console.log(`PASS ${app.name} ${width} ${state}: all eight real images, ${liveOriginal ? 'original live lesson' : 'rich-text image and background'}, no retired-domain requests`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
