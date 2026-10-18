const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ADMIN_DESIGN_URL || 'http://127.0.0.1:5180';
const output = resolve(__dirname, '../../../output/screenshots/admin-design');
mkdirSync(output, { recursive: true });
const tutors = [
  { id:'verified', name:'ZK Local Tutor', email:'zk-local-test-tutor@example.test', status:'certified', languages:['English','Japanese'], totalSessions:23, rating:4.8, writtenExamScore:null, speakingExamScore:null, writtenExamPassed:true, speakingExamPassed:true, zkCertificationStatus:'verified', zkVerifyTxHash:'0x7120ae123456789', zkVerifyAggregationId:269566, isSuspended:false },
  { id:'pending', name:'Paul Anthony Arriola', email:'paulanthonyarriola@example.test', status:'pending', languages:['English'], totalSessions:0, rating:5, writtenExamPassed:false, speakingExamPassed:false, zkCertificationStatus:'requirements_incomplete', isSuspended:false },
  { id:'suspended', name:'Alex Morgan', email:'alex@example.test', status:'certified', languages:[], totalSessions:12, rating:0, writtenExamScore:0, speakingExamScore:86, writtenExamPassed:false, speakingExamPassed:true, isSuspended:true, suspendedUntil:'2026-11-12', suspendedReason:'Attendance review' }
];
async function fixture(browser, width, finance, accessDelay=0) {
  const context = await browser.newContext({viewport:{width,height:1000}});
  const requests = [];
  await context.route(/\/(admin|interview)\//,async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    requests.push({path,method:request.method()});
    if (request.method() === 'OPTIONS') return route.fulfill({status:204});
    let result = {success:true,data:[]};
    if(path === '/admin/me') result = {success:true,user:{userId:'design-admin',username:'Paul',role:'superadmin'}};
    else if(path === '/admin/operations/access') {
      if(accessDelay) await new Promise(r=>setTimeout(r,accessDelay));
      result.data = {permissions:finance?['finance','qa','support']:['support']};
    } else if(path === '/admin/tutors') result.data = {total:3,tutors};
    else if(path === '/admin/students') result.data = {total:0,students:[]};
    else if(path.startsWith('/admin/operations/people/tutor/')) result.data = {person:{name:'ZK Local Tutor',email:'tutor@example.test'},lessons:[],penalties:[],reports:[],transactions:[],performance:null,progress:[],role:'tutor'};
    else if(path === '/admin/operations/compensation') result.data = tutors.map(t=>({tutorId:t.id,currency:'USD',baseRateCents:t.id==='pending'?1250:null,version:0}));
    else if(path === '/admin/stats') result.data = {totalTutors:128,certifiedTutors:96,totalStudents:842,pendingTutors:14,totalSessions:1256,totalRevenue:4215};
    else if(path === '/admin/exam-stats') result.data = {writtenExams:{total:100,passed:86,failed:14},speakingExams:{total:80,passed:64,failed:10,processing:6}};
    else if(path === '/admin/activity') result.data = [{id:'activity',type:'booking',message:'A student booked a lesson with Paul Anthony Arriola.',timestamp:new Date().toISOString()}];
    else if(path === '/admin/pending-tutors') result.data = [{id:'pending',name:'Alex Morgan',email:'alex@example.test',registeredAt:'2026-10-12',status:'pending_speaking',writtenExamPassed:true,speakingExamPassed:false}];
    else if(path === '/interview/stats') result.data = {total:40,passed:30,failed:6,pending:4,passRate:75,avgScores:{grammar:4,fluency:4.2,pronunciation:3.8,vocabulary:4,professionalism:4.5,overall:4.1},weeklyData:[],rubricDistribution:[]};
    return route.fulfill({json:result,headers:{'access-control-allow-origin':base,'access-control-allow-credentials':'true'}});
  });
  const page = await context.newPage(), errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  return {context,page,errors,requests};
}
(async()=>{
  const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  try {
    for(const [width,finance,delay] of [[1566,true,900],[1280,false,0],[375,true,900]]) {
      const {context,page,errors,requests}=await fixture(browser,width,finance,delay);
      await page.goto(base+'/tutors');
      await page.locator('.tutors-table tbody tr').first().waitFor();
      if(finance) await page.getByRole('button',{name:'$12.50',exact:true}).waitFor();
      await page.waitForTimeout(200);
      const geometry = await page.locator('.tutors-table').evaluate(table=>{
        const bounds=e=>({x:e.getBoundingClientRect().x,w:e.getBoundingClientRect().width,display:getComputedStyle(e).display});
        return {heads:[...table.tHead.rows[0].cells].map(bounds),rows:[...table.tBodies[0].rows].map(row=>[...row.cells].map(e=>({...bounds(e),text:e.innerText})))};
      });
      for(const row of geometry.rows){
        assert.equal(row.length,finance?11:10);
        row.forEach((cell,i)=>{
          assert.equal(cell.display,'table-cell','Table cells must remain in the table formatting context');
          assert(Math.abs(cell.x-geometry.heads[i].x)<1,'Header and body column offsets must match');
          assert(Math.abs(cell.w-geometry.heads[i].w)<1,'Header and body column widths must match');
        });
      }
      assert(!await page.locator('.tutors-table .exam-score').allTextContents().then(scores=>scores.includes('%')));
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.locator('.tutors-table-card').evaluate(e=>{e.scrollLeft=e.scrollWidth});
      const bounds=await page.getByTitle('Suspend Tutor',{exact:true}).first().boundingBox();
      assert(bounds.x>=0&&bounds.x+bounds.width<=width+1,'Actions must remain reachable');
      await page.locator('.tutors-table-card').evaluate(e=>{e.scrollLeft=0});
      await page.screenshot({path:resolve(output,'tutors-'+width+'-'+finance+'.png')});
      await page.locator('.tutor-tab').filter({hasText:'All Tutors'}).click();
      await page.locator('.tutors-table tbody tr').first().waitFor();
      if(width<1025) {
        await page.getByRole('button',{name:'Open navigation menu',exact:true}).click();
        await page.waitForFunction(()=>Math.abs(document.querySelector('.sidebar').getBoundingClientRect().x)<1);
      }
      await page.locator('.sidebar a[href="/"]').click();
      await page.waitForURL(base+'/');
      await page.locator('.stat-card').first().waitFor();
      await page.screenshot({path:resolve(output,'route-transition-'+width+'.png')});
      assert.equal(await page.locator('.tutors-page').count(),0,'Tutors Management must unmount after navigating away');
      assert.equal(await page.locator('.dashboard-content > div').count(),1,'Only the selected route should remain mounted');
      assert.equal(await page.locator('.dashboard-route').getAttribute('data-route'),'/');
      const art=await page.locator('.admin-art').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0));
      assert(art,'All custom artwork must load');
      const ratio=await page.locator('.exam-stat-section').first().evaluate(element=>{
        const bar=element.querySelector('.progress-bar'), track=element.querySelector('.progress-bar-container');
        return bar.getBoundingClientRect().width/track.getBoundingClientRect().width;
      });
      assert(Math.abs(ratio-.86)<.01,'Exam progress bar must reflect the real percentage');
      assert.equal(await page.locator('.quick-actions-grid').getByText('0',{exact:true}).count(),0);
      await page.getByRole('button',{name:'Activity feed',exact:true}).click();
      await page.getByText('Activity Feed',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Activity feed',exact:true}).click();
      await page.getByRole('button',{name:'Account menu',exact:true}).click();
      assert(await page.locator('.user-dropdown a[href="/settings"]').isVisible());
      await page.getByRole('button',{name:'Account menu',exact:true}).click();
      if(width<1025){
        const toggle=page.getByRole('button',{name:'Open navigation menu',exact:true});
        await toggle.click();
        assert(await page.locator('.sidebar').isVisible());
        await page.waitForFunction(()=>Math.abs(document.querySelector('.sidebar').getBoundingClientRect().x)<1);
        await page.screenshot({path:resolve(output,'navigation-'+width+'.png')});
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.sidebar').isVisible(),false);
        assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
        assert(await toggle.evaluate(element=>element===document.activeElement));
      }
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:resolve(output,'overview-'+width+'.png')});
      await page.evaluate(()=>{window.__navigationDocument='same-document'});
      const navigate = async href => {
        if(width<1025 && !await page.locator('.sidebar').isVisible()){
          await page.getByRole('button',{name:'Open navigation menu',exact:true}).click();
          await page.waitForFunction(()=>Math.abs(document.querySelector('.sidebar').getBoundingClientRect().x)<1);
        }
        await page.locator('.sidebar a[href="'+href+'"]').click();
        await page.waitForURL(base+href);
        assert.equal(await page.evaluate(()=>window.__navigationDocument),'same-document','Use in-app navigation, not page reloads');
        await page.waitForFunction(path=>document.querySelector('.dashboard-route')?.dataset.route===path,href);
        assert.equal(await page.locator('.dashboard-route').count(),1);
      };
      await navigate('/tutors');
      await page.getByRole('heading',{name:'Tutors Management',exact:true}).waitFor();
      await page.getByRole('button',{name:'All Tutors',exact:true}).click();
      await navigate('/students');
      await page.getByRole('heading',{name:'Students Management',exact:true}).waitFor();
      assert.equal(await page.locator('.tutors-page,.dashboard-page').count(),0);
      await page.goBack();
      await page.getByRole('heading',{name:'Tutors Management',exact:true}).waitFor();
      assert.equal(await page.locator('.students-page').count(),0);
      await page.goForward();
      await page.getByRole('heading',{name:'Students Management',exact:true}).waitFor();
      assert.equal(await page.locator('.tutors-page').count(),0);
      await navigate('/tutors');
      await page.locator('.tutors-table tbody tr').first().waitFor();
      await page.locator('.tutors-table-card').evaluate(e=>{e.scrollLeft=e.scrollWidth});
      await page.getByRole('button',{name:'Operations detail',exact:true}).first().click();
      await page.getByRole('button',{name:'Close tutor details',exact:true}).waitFor();
      await page.getByRole('button',{name:'Close tutor details',exact:true}).click();
      await navigate('/');
      await page.locator('.stat-card').first().waitFor();
      assert.equal(await page.locator('.tutors-page,.account-dialog').count(),0);
      assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
      assert.deepEqual(errors,[]);
      assert(requests.every(r=>r.method==='GET'||r.method==='OPTIONS'),'Visual test must not mutate accounts');
      await context.close();
      console.log('PASS admin design '+width+' finance='+finance);
    }
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
