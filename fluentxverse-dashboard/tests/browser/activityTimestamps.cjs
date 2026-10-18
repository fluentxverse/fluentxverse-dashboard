const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { mkdirSync } = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ADMIN_TEST_URL || 'http://127.0.0.1:5180';
const output = resolve(__dirname,'../../../output/screenshots/admin-activity');
mkdirSync(output,{recursive:true});
const now = Date.parse('2026-10-12T01:30:00Z');
const items = [
  {id:'recent',type:'booking',message:'A recently booked lesson',timestamp:new Date(now-30_000).toISOString()},
  {id:'old',type:'exam_passed',message:'An earlier completed exam',timestamp:'2026-10-12T00:30:00Z'},
  {id:'future',type:'booking',message:'A timestamp ahead of this browser clock',timestamp:'2026-10-12T02:30:00Z'},
  {id:'unknown',type:'student_joined',message:'A legacy record without its event time',timestamp:null},
  {id:'invalid',type:'tutor_registered',message:'A record with an invalid event time',timestamp:'invalid'},
];
(async()=>{
  const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  try {
    for (const width of [1440,375]) {
      const context = await browser.newContext({viewport:{width,height:1000}});
      let activityReads=0;
      await context.route(/\/(admin|interview)\//, route=>{
        const path = new URL(route.request().url()).pathname;
        let data={success:true,data:[]};
        if(path==='/admin/me') data={success:true,user:{userId:'time-admin',username:'Time Admin',role:'superadmin'}};
        else if(path==='/admin/operations/access') data.data={permissions:['support']};
        else if(path==='/admin/stats') data.data={totalTutors:2,certifiedTutors:1,pendingTutors:1,totalStudents:3,totalSessions:4,totalRevenue:0};
        else if(path==='/admin/exam-stats') data.data={writtenExams:{total:0,passed:0,failed:0},speakingExams:{total:0,passed:0,failed:0,processing:0}};
        else if(path==='/admin/activity'){data.data=items;activityReads++;}
        else if(path==='/interview/stats') data.data=null;
        return route.fulfill({json:data});
      });
      const page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.clock.install({time:new Date(now)});
      await page.goto(base);
      await page.locator('.activity-timestamp').first().waitFor();
      const list=page.locator('.activity-list');
      assert((await list.locator('time').nth(0).innerText()).startsWith('Just now'));
      assert((await list.locator('time').nth(1).innerText()).startsWith('1 hour ago'));
      assert((await list.locator('time').nth(2).innerText()).startsWith('in '));
      assert.equal(await list.locator('time').nth(3).innerText(),'Date unavailable');
      assert.equal(await list.locator('time').nth(4).innerText(),'Date unavailable');
      assert.equal(await list.locator('time').nth(1).getAttribute('title'),'Oct 12, 2026, 8:30 AM PHT');
      await page.getByRole('button',{name:'Activity feed',exact:true}).click();
      const dropdown=page.locator('.notification-dropdown');
      assert((await dropdown.locator('time').nth(1).innerText()).startsWith('1 hour ago'));
      assert.equal(await dropdown.locator('time').nth(1).getAttribute('dateTime'),'2026-10-12T00:30:00.000Z');
      await page.clock.fastForward(45_000);
      await page.waitForFunction(()=>document.querySelector('.notification-dropdown time')?.textContent.startsWith('1 minute ago'));
      assert((await list.locator('time').first().innerText()).startsWith('1 minute ago'));
      assert.equal(await dropdown.locator('time').first().getAttribute('dateTime'),items[0].timestamp);
      assert(activityReads>=3,'Polling must keep using the original event timestamp');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:resolve(output,'feed-'+width+'.png')});
      assert.deepEqual(errors,[]);
      await context.close();
      console.log('PASS activity timestamps '+width+': exact PHT, missing/invalid/future values, clock aging and stable refresh');
    }
  } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
