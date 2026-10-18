const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { chromium } = require('playwright');
const { io } = require('socket.io-client');
const api = 'http://127.0.0.1:18765';
const dashboard = process.env.INTERVIEW_DASHBOARD_URL || 'http://127.0.0.1:5186';
const tutorApp = process.env.INTERVIEW_TUTOR_URL || 'http://127.0.0.1:5178';
const screenshots = resolve(__dirname, '../../../output/screenshots');

async function main() {
  const tokens = await (await fetch(`${api}/fixture/tokens`)).json();
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const results = [], uploads = [], errors = [], consoleErrors = [], signals = [];
  let failUpload = true;
  let loseResultResponse = true;
  async function context(role, base, viewport) {
    const ctx = await browser.newContext({ viewport, permissions: ['camera', 'microphone'] });
    await ctx.addInitScript(forceRelay => {
      window.__interviewStreams = []; window.__interviewPeers = [];
      const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async constraints => { const stream = await get(constraints); window.__interviewStreams.push(stream); return stream; };
      const Peer = window.RTCPeerConnection;
      window.RTCPeerConnection = class extends Peer {
        constructor(configuration) { super(forceRelay ? {...configuration,iceTransportPolicy:'relay'} : configuration); window.__interviewPeers.push(this); }
        setConfiguration(configuration) { super.setConfiguration(forceRelay ? {...configuration,iceTransportPolicy:'relay'} : configuration); }
      };
    }, process.env.INTERVIEW_TEST_RELAY === 'true');
    await ctx.route(`${api}/**`, async route => {
      const req = route.request(), path = new URL(req.url()).pathname;
      const cors = { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,cache-control,pragma,range' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      if (path === '/schedule/week') return route.fulfill({ headers: cors, json: { success:true,data:{slots:[],weekStart:'2026-10-12',weekEnd:'2026-10-18'} } });
      const headers = { ...req.headers(), origin: role === 'admin' ? 'https://dashboard.fluentxverse.com' : 'https://tutor.fluentxverse.com', cookie: `${role === 'admin' ? 'adminAuth' : 'tutorAuth'}=${tokens[role]}` };
      if (path === '/interview/recording' && req.method() === 'POST') {
        const raw = req.postDataBuffer()?.toString() || '';
        uploads.push({ fields: [...raw.matchAll(/name="([^"]+)"(?:;|\r\n)/g)].map(match => match[1]), id: raw.match(/name="recordingId"\r\n\r\n([^\r]+)/)?.[1] });
        if (failUpload) { failUpload = false; return route.fulfill({ status: 503, headers: cors, json: { success: false, error: 'Fixture retry required' } }); }
      }
      if (path === '/interview/result' && req.method() === 'POST') results.push(req.postDataJSON());
      if (!path.startsWith('/interview/') && !['/admin/me','/admin/socket-token','/tutor/me','/tutor/socket-token','/tutor/refresh'].includes(path)) {
        return route.fulfill({ headers: cors, json: { success: true, data: [], notifications: [], count: 0 } });
      }
      const response = await route.fetch({ headers });
      if (path === '/interview/result' && response.ok() && loseResultResponse) {
        loseResultResponse = false;
        return route.fulfill({ status:503,headers:cors,json:{success:false,error:'Fixture lost response after commit'} });
      }
      return route.fulfill({ response, headers: { ...response.headers(), ...cors } });
    });
    const page = await ctx.newPage(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(`${role}: ${error.message}`));
    page.on('websocket', socket => {
      const frame = (direction, data) => {
        if (typeof data.payload !== 'string' || !data.payload.startsWith('42')) return;
        try { const event=JSON.parse(data.payload.slice(2)); signals.push({role,direction,event:event[0],negotiationId:event[1]?.negotiationId,from:event[1]?.from,peerId:event[1]?.peerId}); } catch {}
      };
      socket.on('framesent', data=>frame('sent',data)); socket.on('framereceived',data=>frame('received',data));
    });
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(`${role}: ${message.text()}`); });
    return { ctx, page };
  }
  const admin = await context('admin', dashboard, { width:1440,height:1000 });
  const tutor = await context('tutor', tutorApp, { width:375,height:812 });
  const live = async page => { await page.waitForFunction(() => document.querySelector('.call-status')?.textContent.includes('Live')); await page.waitForFunction(() => document.querySelector('.video-container.remote video')?.videoWidth > 0); };
  const stopped = async page => assert.equal(await page.evaluate(() => window.__interviewStreams.flatMap(stream => stream.getTracks()).filter(track => track.readyState === 'live').length), 0);
  try {
    const deniedJoin = async (token,role) => {
      const socket = io('http://127.0.0.1:18767',{auth:{token},autoConnect:false,reconnection:false,transports:['websocket']});
      try { await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('Unauthorized interview join was not rejected')),5000);
        socket.on('connect',()=>socket.emit('interview:join',{roomId:'interview-audit-fixture',role}));
        socket.on('interview:error',()=>{clearTimeout(timer);resolve();});
        socket.on('interview:joined',()=>{clearTimeout(timer);reject(Error('Unauthorized interview join succeeded'));});
        socket.connect();
      }); } finally {socket.disconnect();}
    };
    await deniedJoin(tokens.other,'tutor'); await deniedJoin(tokens.support,'admin');
    for (const [cookie, token] of [['tutorAuth',tokens.other],['adminAuth',tokens.support],['adminAuth','invalid']]) {
      const response = await fetch(`${api}/interview/room/audit-fixture`, { headers:{Cookie:`${cookie}=${token}`,Origin:'https://dashboard.fluentxverse.com'} });
      assert.equal(response.status,403);
    }
    await tutor.page.goto(`${tutorApp}/interview/room/audit-fixture`, { waitUntil:'domcontentloaded' });
    await tutor.page.waitForFunction(() => document.querySelector('.btn-join') && !document.querySelector('.btn-join').disabled);
    await tutor.page.locator('.device-group select').nth(1).selectOption({index:1});
    assert(await tutor.page.locator('.btn-join').isDisabled());
    await tutor.page.locator('.btn-test-devices').click();
    await tutor.page.waitForFunction(() => !document.querySelector('.btn-join').disabled);
    await tutor.page.locator('.btn-join').click();
    await admin.page.goto(`${dashboard}/interview-room/audit-fixture`, { waitUntil:'domcontentloaded' });
    await admin.page.getByText('Candidate Fixture', { exact:true }).waitFor();
    await admin.page.waitForFunction(() => document.querySelector('.btn-join') && !document.querySelector('.btn-join').disabled);
    await admin.page.locator('.btn-join').click();
    await live(admin.page); await live(tutor.page);
    if (process.env.INTERVIEW_TEST_RELAY === 'true') {
      for (const page of [admin.page,tutor.page]) {
        const relayed = await page.evaluate(async()=>{
          const pc=window.__interviewPeers.at(-1), stats=await pc.getStats();
          let relay=false;
          stats.forEach(stat=>{if(stat.type==='candidate-pair'&&stat.state==='succeeded'&&stat.nominated&&stats.get(stat.localCandidateId)?.candidateType==='relay')relay=true;});
          return relay;
        });
        assert(relayed,'Forced relay test must use an actual TURN candidate pair');
      }
      console.log('PASS: both browsers are using actual Cloudflare TURN relay candidates');
    }
    mkdirSync(screenshots,{recursive:true});
    await admin.page.screenshot({path:resolve(screenshots,'interview-operational-desktop.png'),fullPage:true});
    await tutor.page.screenshot({path:resolve(screenshots,'interview-operational-tutor-mobile.png'),fullPage:true});
    assert(await admin.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    assert(await tutor.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await admin.page.getByTitle('Mute',{exact:true}).click();
    assert(await admin.page.evaluate(() => window.__interviewStreams.at(-1).getAudioTracks().every(track=>!track.enabled)));
    await admin.page.getByTitle('Unmute',{exact:true}).click();
    await admin.page.getByTitle('Turn off camera',{exact:true}).click();
    assert(await admin.page.evaluate(() => window.__interviewStreams.at(-1).getVideoTracks().every(track=>!track.enabled)));
    await admin.page.getByTitle('Turn on camera',{exact:true}).click();
    await admin.page.getByTitle('Reconnect interview',{exact:true}).click();
    await live(admin.page); await live(tutor.page);
    await tutor.page.reload({waitUntil:'domcontentloaded'});
    await tutor.page.waitForFunction(() => document.querySelector('.btn-join') && !document.querySelector('.btn-join').disabled);
    await tutor.page.locator('.btn-join').click();
    await live(admin.page); await live(tutor.page);
    await admin.page.getByTitle('Start recording',{exact:true}).click();
    await tutor.page.getByText('Recording for screening and quality review',{exact:true}).waitFor();
    await admin.page.waitForTimeout(2000);
    await admin.page.getByTitle('Stop recording',{exact:true}).click();
    await admin.page.getByRole('button',{name:'Retry recording upload',exact:true}).waitFor();
    assert.equal((await(await fetch(`${api}/fixture/storage`)).json()).files,0);
    await admin.page.getByRole('button',{name:'Retry recording upload',exact:true}).click();
    await admin.page.getByText('Saved recording',{exact:true}).waitFor();
    assert.equal(uploads[0].id,uploads[1].id);
    assert(uploads[1].fields.includes('recording') && uploads[1].fields.includes('slotId') && uploads[1].fields.includes('tutorId'));
    const recording = await fetch(`${api}/interview/recording/audit-fixture`, {headers:{Cookie:`adminAuth=${tokens.admin}`,Origin:'https://dashboard.fluentxverse.com'}});
    assert.equal(recording.status,200); assert((await recording.arrayBuffer()).byteLength>1000);
    const unauthorizedPlayback = await fetch(`${api}/interview/recording/audit-fixture`, {headers:{Cookie:`tutorAuth=${tokens.tutor}`,Origin:'https://tutor.fluentxverse.com'}});
    assert.equal(unauthorizedPlayback.status,403);
    await admin.page.getByTitle('Start recording',{exact:true}).click();
    await admin.page.waitForTimeout(1500);
    await admin.page.getByTitle('End interview',{exact:true}).click();
    await admin.page.locator('.confirm-modal').getByRole('button',{name:'End Interview',exact:true}).click();
    await admin.page.getByText('Interview ended',{exact:true}).waitFor();
    await tutor.page.getByText('Interview ended',{exact:true}).waitFor();
    await stopped(admin.page); await stopped(tutor.page);
    await admin.page.waitForFunction(() => !document.querySelector('.interview-recording-state')?.textContent.includes('Saving recording'));
    const storage = await(await fetch(`${api}/fixture/storage`)).json(); assert.equal(storage.files,2);
    await admin.page.locator('.btn-pass').click();
    await admin.page.locator('.confirm-actions .btn-confirm.success').click();
    await admin.page.getByText('Fixture lost response after commit',{exact:true}).waitFor();
    await admin.page.locator('.btn-pass').click();
    await admin.page.locator('.confirm-actions .btn-confirm.success').click();
    await admin.page.getByText('Interview Result Submitted!',{exact:true}).waitFor();
    assert.equal(results.length,2); assert.deepEqual(results[0],results[1]); assert.equal(results[0].slotId,'audit-fixture'); assert.equal(results[0].tutorId,'interview-tutor');
    const deniedRejoin = await fetch(`${api}/interview/room/audit-fixture`,{headers:{Cookie:`tutorAuth=${tokens.tutor}`,Origin:'https://tutor.fluentxverse.com'}});
    const closedRoom = (await deniedRejoin.json()).data;
    assert.equal(closedRoom.mediaClosed,true); assert.equal(closedRoom.result,'pass');
    assert.deepEqual(errors,[]);
    console.log('PASS: actual dashboard/tutor WebRTC media, room authorization, refresh/reconnect, controls, private recording upload/retry/playback, end-call track cleanup and result binding. All data and storage isolated.');
  } catch(error) {
    const videos = async page => page.locator('video').evaluateAll(nodes=>nodes.map(video=>({class:video.parentElement.className,width:video.videoWidth,readyState:video.readyState,stream:Boolean(video.srcObject),paused:video.paused})));
    const peers = async page => page.evaluate(()=>window.__interviewPeers.map(pc=>({state:pc.connectionState,ice:pc.iceConnectionState,signaling:pc.signalingState,local:pc.localDescription?.type,remote:pc.remoteDescription?.type})));
    console.error(JSON.stringify({errors,consoleErrors,signals:signals.filter(signal=>signal.event !== 'interview:ice-candidate').slice(-35),adminPeers:await peers(admin.page),tutorPeers:await peers(tutor.page),adminVideos:await videos(admin.page),tutorVideos:await videos(tutor.page),adminText:(await admin.page.locator('body').innerText()).slice(-1200),tutorText:(await tutor.page.locator('body').innerText()).slice(-1200)}));
    throw error;
  } finally { await admin.ctx.close(); await tutor.ctx.close(); await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
