const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const base = process.env.INTERVIEW_DASHBOARD_URL || 'http://127.0.0.1:5242';
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=10', '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '/tmp/pending-intro-fixture.mp4']);
const bytes = fs.readFileSync('/tmp/pending-intro-fixture.mp4');
(async () => {
 const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
 try {
  for (const width of [1440,390]) for (const variant of ['canonical','legacy','field']) {
   const page = await browser.newPage({ viewport: { width, height: 900 } });
   const requests = [], errors = [];
   page.on('pageerror', e => errors.push(e.message));
   const change = { itemKey: variant === 'legacy' ? 'videoIntroUrl' : variant === 'field' ? 'education' : 'videoIntro', ...(variant !== 'canonical' ? { fieldKey: 'videoIntroUrl' } : {}), newValue: 'http://fluentxverse-seaweed-filer:8888/user/pending-fixture/video/new.mp4', submittedAt: '2026-10-28', status: 'pending' };
   await page.route('**/*', route => {
    const req=route.request(), url=new URL(req.url()), path=url.pathname.replace(/^\/api/,'');
    if(path === '/lesson/files/user/pending-fixture/video/new.mp4/stream') {
      requests.push(path); const m=req.headers().range?.match(/^bytes=(\d+)-(\d*)$/), start=m?Number(m[1]):0,end=m?.[2]?Math.min(Number(m[2]),bytes.length-1):bytes.length-1;
      return route.fulfill({ status:m?206:200, headers:{'Content-Type':'video/mp4','Accept-Ranges':'bytes',...(m?{'Content-Range':`bytes ${start}-${end}/${bytes.length}`}:{})},body:bytes.subarray(start,end+1)});
    }
    if(!/^\/(admin|notifications|interview|inbox)(\/|$)/.test(path))return route.continue();
    const reply=data=>route.fulfill({json:{success:true,data}});
    if(req.method()==='OPTIONS')return route.fulfill({status:204});
    if(path==='/admin/me')return route.fulfill({json:{success:true,user:{userId:'fixture-admin',username:'Reviewer',role:'superadmin'}}});
    if(path==='/admin/socket-token')return route.fulfill({json:{success:false}});
    if(path==='/admin/pending-changes')return reply([{id:'pending-fixture',name:'Video Applicant',email:'fixture@example.invalid',pendingChanges:[change]}]);
    if(path==='/admin/applications')return reply({items:[],counts:{total:1,pendingProfile:0},total:0,page:1,pageCount:1});
    return reply([]);
   });
   await page.goto(`${base}/applications`,{waitUntil:'networkidle'});
   await page.getByRole('button',{name:/Pending Changes/}).click();
   await page.locator('.profile-review-card').click();
   const modal=page.locator('.changes-review-modal');
   await expect(modal.getByRole('heading',{name:'Introduction Video',exact:true})).toBeVisible();
   const video=modal.getByLabel('Submitted introduction video');
   await expect.poll(()=>video.evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(2);
   await video.evaluate(async v=>{v.muted=true;await v.play()});
   await expect.poll(()=>video.evaluate(v=>v.currentTime)).toBeGreaterThan(.1);
   assert.ok(await video.evaluate(v=>!v.error&&v.duration>0));
   assert.ok(requests.length>0);
   await expect(modal.locator('.change-preview')).not.toContainText('fluentxverse-seaweed-filer');
   const box=await video.boundingBox();assert.ok(box.width<=561&&box.width>100);
   assert.deepEqual(errors,[]);
   console.log(`PASS ${width}px ${variant}: readable label, playable submitted video and safe stream URL`);
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
