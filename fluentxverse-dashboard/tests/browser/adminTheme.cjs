const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { chromium, expect } = require('@playwright/test');
const base = process.env.ADMIN_THEME_URL || 'http://127.0.0.1:5200';
const output = resolve(__dirname, '../../../output/screenshots/admin-theme');
mkdirSync(output, { recursive: true });
const key = 'fxv_admin_theme';
const message = { uid: 1, folder: 'INBOX', subject: 'Your next lesson', from: [{name:'Tutor Operations',address:'team@example.test'}], to:[{address:'support@fluentxverse.com'}], date:'2026-10-21T08:00:00Z', seen: true, starred:false, hasAttachments:false, messageId:'<fixture@example.test>' };
async function mock(context) {
  await context.route('**/*', route => route.request().url().startsWith(base) || /\/\/api\.fluentxverse\./.test(route.request().url()) ? route.continue() : route.abort());
  await context.route(/^https:\/\/api\.fluentxverse\.(com|xyz)\//, async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'OPTIONS') return route.fulfill({status:204});
    let data = [];
    if(path === '/admin/me') return route.fulfill({json:{success:true,user:{userId:'theme-admin',username:'Operations',role:'superadmin'}}});
    if(path === '/admin/operations/access') data={permissions:['support','operations']};
    if(path === '/admin/stats') data={totalTutors:128,certifiedTutors:96,totalStudents:842,pendingTutors:14,totalSessions:1256,totalRevenue:4215};
    if(path === '/admin/exam-stats') data={writtenExams:{total:100,passed:86,failed:14},speakingExams:{total:80,passed:64,failed:10,processing:6}};
    if(path === '/interview/stats') data={total:40,passed:30,failed:6,pending:4,passRate:75,avgScores:{overall:4.1},weeklyData:[],rubricDistribution:[]};
    if(path === '/admin/tutors') data={total:1,tutors:[{id:'tutor',name:'Alex Morgan',email:'tutor@example.test',status:'certified',languages:['English'],totalSessions:23,rating:4.8,writtenExamPassed:true,speakingExamPassed:true,isSuspended:false}]};
    if(path === '/admin/mail/status') data={configured:true,accounts:[{id:'support',label:'Support',address:'support@fluentxverse.com'}]};
    if(path === '/admin/mail/preferences') data={signature:'',contacts:[]};
    if(path === '/admin/mail/support/folders') data=[{path:'INBOX',role:'inbox',name:'Inbox',unread:0,total:1}];
    if(path === '/admin/mail/support/messages') data={messages:[message],page:1,pages:1,total:1,uidValidity:'42'};
    if(path === '/admin/mail/support/messages/1') data={...message,cc:[],replyTo:[],html:'<div style="background:#fff;color:#202124;padding:20px"><h1>Hello, FluentXVerse</h1><p>An isolated, light email document.</p></div>',text:'Hello, FluentXVerse',attachments:[],references:[]};
    return route.fulfill({json:{success:true,data}});
  });
}
async function theme(page, value) { await expect(page.locator('html')).toHaveAttribute('data-admin-theme',value); }
async function screenshot(page, name) {
  await page.waitForTimeout(150);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
  await page.screenshot({path:resolve(output,name+'.png'),fullPage:false});
}
async function palette(page, selector, expected) {
  assert.equal(await page.locator(selector).first().evaluate(el=>getComputedStyle(el).backgroundColor),expected,selector);
}
(async()=>{
  const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  try {
    for(const width of [1440,375,320]) {
      const context=await browser.newContext({viewport:{width,height:960},colorScheme:'light'});
      await mock(context);
      const page=await context.newPage(), errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/settings');
      await page.getByRole('radio',{name:'System',exact:true}).waitFor({state:'attached'});
      await theme(page,'light');
      await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
      await theme(page,'dark');
      assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),'dark');
      await palette(page,'.settings-card','rgb(29, 31, 35)');
      await screenshot(page,'settings-dark-'+width);
      await page.reload(); await theme(page,'dark');
      await expect(page.getByRole('radio',{name:'Dark',exact:true})).toBeChecked();
      await page.emulateMedia({colorScheme:'light'}); await theme(page,'dark');
      await page.getByRole('radio',{name:'System',exact:true}).check({force:true});
      await theme(page,'light');
      await page.emulateMedia({colorScheme:'dark'}); await theme(page,'dark');
      await page.getByRole('radio',{name:'Light',exact:true}).check({force:true});
      await theme(page,'light');
      await screenshot(page,'settings-light-'+width);
      // Real storage events, not synthetic ones, synchronize two tabs.
      const tab=await context.newPage();
      await tab.goto(base+'/settings'); await theme(tab,'light');
      await tab.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
      await theme(page,'dark'); await tab.close();
      if(width===1440) {
        for(const path of ['/', '/tutors']) {
          await page.goto(base+path);
          await page.locator('.dashboard-route').waitFor();
          await theme(page,'dark');
          if(path==='/tutors') await page.locator('.tutors-table tbody tr').first().waitFor();
          await screenshot(page,path==='/'?'overview-dark':'tutors-dark');
          await page.getByRole('button',{name:'Account menu',exact:true}).click();
          await palette(page,'.user-dropdown','rgb(29, 31, 35)');
          await page.keyboard.press('Escape');
        }
      } else {
        await page.getByRole('button',{name:'Open navigation menu',exact:true}).click();
        await expect(page.locator('.sidebar')).toBeVisible();
        await palette(page,'.sidebar','rgb(29, 31, 35)');
        await screenshot(page,'navigation-dark-'+width);
        await page.keyboard.press('Escape');
      }
      await page.goto(base+'/email');
      await page.locator('.mail-message-row').waitFor();
      await palette(page,'.mail-workspace','rgb(29, 31, 35)');
      await screenshot(page,'inbox-dark-'+width);
      await page.getByText('Your next lesson',{exact:true}).click();
      await page.locator('.mail-html-body').waitFor();
      const iframe = page.frameLocator('.mail-html-body');
      await expect(iframe.getByRole('heading',{name:'Hello, FluentXVerse'})).toBeVisible();
      assert.equal(await iframe.locator('div').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)','Sender colors are not recolored by app theme');
      await screenshot(page,'reader-dark-'+width);
      await page.evaluate(()=>window.dispatchEvent(new CustomEvent('fxv:session-expired',{detail:{message:'Fixture session timeout'}})));
      await page.getByRole('heading',{name:'Session Expired',exact:true}).waitFor();
      await palette(page,'.session-expired-modal','rgb(29, 31, 35)');
      assert.deepEqual(errors,[]);
      await context.close();
      console.log('PASS dark/light admin, persistence, OS changes, cross-tab, mobile and email '+width);
    }
    const blocked=await browser.newContext({colorScheme:'dark'});
    await mock(blocked);
    await blocked.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked')};Storage.prototype.setItem=()=>{throw Error('blocked')};});
    const page=await blocked.newPage(); await page.goto(base+'/settings');
    await theme(page,'dark');
    await page.getByRole('button',{name:'Switch to light mode',exact:true}).click(); await theme(page,'light');
    await blocked.close();
    const login=await browser.newContext({colorScheme:'dark'});
    await mock(login);
    await login.route('**/admin/me',route=>route.fulfill({status:401,json:{success:false}}));
    const signedOut=await login.newPage(); await signedOut.goto(base+'/');
    await signedOut.locator('.login-card').waitFor();
    await theme(signedOut,'dark'); await palette(signedOut,'.login-card','rgb(29, 31, 35)');
    await screenshot(signedOut,'login-dark');
    await login.close();
    // Bootstrap must apply the saved mode before application JS runs, without touching material themes.
    const early=await browser.newContext({colorScheme:'light'});
    await early.addInitScript(key=>localStorage.setItem(key,'dark'),key);
    await early.route('**/*.js',route=>route.abort());
    const first=await early.newPage(); await first.goto(base+'/settings'); await theme(first,'dark');
    await first.goto(base+'/business-english-preview/fixture?theme=light');
    assert.equal(await first.locator('html').getAttribute('data-admin-theme'),null);
    await expect(first.locator('html')).toHaveAttribute('data-material-theme','light');
    await early.close();
    console.log('PASS unavailable storage, first-paint bootstrap and independent material theme');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
