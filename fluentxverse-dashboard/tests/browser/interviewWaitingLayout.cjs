const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.INTERVIEW_DASHBOARD_URL || 'http://127.0.0.1:5242';

// Local UI fixture: acknowledge the interview room with no candidate present.
const waitingSocket = `export function createRealtimeSocket() {
  const listeners = new Map();
  const socket = {
    connected: false,
    on(event, listener) { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(listener); return socket; },
    off(event, listener) { if (listener) listeners.get(event)?.delete(listener); else listeners.delete(event); return socket; },
    emit(event, data) { if (event === 'interview:join') queueMicrotask(() => {
      for (const listener of listeners.get('interview:joined') || []) listener({roomId:data.roomId,configuration:{iceServers:[]},peerPresent:false});
    }); return socket; },
    async connect() { socket.connected = true; for (const listener of listeners.get('connect') || []) listener(); return socket; },
    disconnect() { socket.connected = false; return socket; }
  }; return socket;
}`;

(async () => {
  fs.mkdirSync('/tmp/fluentxverse-interview-waiting', { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  try {
    for (const width of [1440, 1024, 768, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, permissions: ['camera', 'microphone'] });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const url = new URL(route.request().url()), path = url.pathname;
        if (path === '/src/client/realtimeSocket.ts') return route.fulfill({ contentType: 'application/javascript', body: waitingSocket });
        if (!/^\/(admin|interview|notifications|inbox)(\/|$)/.test(path)) return route.continue();
        const headers = { 'access-control-allow-origin': new URL(base).origin, 'access-control-allow-credentials': 'true' };
        if (path === '/admin/me') return route.fulfill({ headers, json: { success: true, user: { userId: 'waiting-admin', username: 'Reviewer', role: 'superadmin' } } });
        if (path === '/interview/room/waiting-slot') return route.fulfill({ headers, json: { success: true, data: {
          id: 'waiting-slot', tutorId: 'waiting-tutor', tutorName: 'Candidate', status: 'booked', result: null, mediaClosed: false,
        } } });
        return route.fulfill({ headers, json: { success: true, data: [] } });
      });
      await page.goto(`${base}/interview-room/waiting-slot`, { waitUntil: 'networkidle' });
      await expect(page.locator('.btn-join')).toBeEnabled();
      await page.locator('.btn-join').click();
      await expect(page.locator('.call-status')).toContainText('Waiting for candidate');
      const remote = page.locator('.video-container.remote');
      const avatar = remote.locator('.interview-candidate-avatar');
      await expect(avatar).toBeVisible();
      const geometry = await remote.evaluate(el => {
        const rect = node => node.getBoundingClientRect().toJSON();
        const avatar = el.querySelector('.interview-candidate-avatar');
        return { remote: rect(el), avatar: rect(avatar), icon: rect(avatar.querySelector('i')),
          text: rect(el.querySelector('p')), label: rect(el.querySelector('.video-label')), borderRadius: getComputedStyle(avatar).borderRadius };
      });
      const size = width <= 480 ? 48 : 80;
      assert.ok(Math.abs(geometry.remote.width / geometry.remote.height - 16 / 9) < 0.02, `${width}px: stable video frame`);
      assert.equal(geometry.avatar.width, size, `${width}px: fixed avatar width`);
      assert.equal(geometry.avatar.height, size, `${width}px: fixed avatar height, not an ellipse`);
      assert.equal(geometry.borderRadius, '50%');
      assert.ok(Math.abs(geometry.avatar.x + size / 2 - geometry.remote.x - geometry.remote.width / 2) < 1, 'Avatar horizontally centered');
      assert.ok(Math.abs(geometry.icon.y + geometry.icon.height / 2 - geometry.avatar.y - size / 2) < 1, 'Icon vertically centered');
      assert.ok(geometry.avatar.bottom <= geometry.text.top, 'Avatar and waiting text do not overlap');
      assert.ok(geometry.text.bottom <= geometry.remote.bottom && geometry.text.left >= geometry.remote.left && geometry.text.right <= geometry.remote.right, 'Waiting text fits inside the video frame');
      assert.ok(geometry.label.bottom <= geometry.text.top || geometry.label.top >= geometry.text.bottom, 'Candidate label does not overlap waiting text');
      assert.deepEqual(errors, []);
      await remote.screenshot({ path: `/tmp/fluentxverse-interview-waiting/waiting-${width}.png` });
      console.log(`PASS ${width}px: absent-candidate avatar stays circular in a stable rectangular video frame`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
