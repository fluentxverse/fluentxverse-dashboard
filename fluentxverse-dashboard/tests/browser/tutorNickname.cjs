const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.INTERVIEW_DASHBOARD_URL||'http://127.0.0.1:5242';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 fs.mkdirSync('/tmp/fluentxverse-nickname',{recursive:true});
 try{for(const width of [1440,390,320]){
  const page=await browser.newPage({viewport:{width,height:900}}),writes=[],errors=[];
  const profile={id:'nickname-fixture',name:'LegalFirst PrivateSurname',nickname:'Mary Ann',email:'fixture@example.invalid',profileStatus:'pending_review',submittedAt:'2026-10-28',profileItemStatuses:{}};
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname.replace(/^\/api/,'');
   if(!/^\/(admin|notifications|inbox|interview)(\/|$)/.test(path))return route.continue();
   const headers={'access-control-allow-origin':new URL(base).origin,'access-control-allow-credentials':'true','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,cache-control,pragma'};
   const ok=data=>route.fulfill({headers,json:{success:true,data}});
   if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(path==='/admin/me')return route.fulfill({headers,json:{success:true,user:{userId:'nickname-admin',username:'Reviewer',role:'superadmin'}}});
   if(path==='/admin/socket-token')return route.fulfill({headers,json:{success:false}});
   if(path==='/admin/pending-profiles')return ok([profile]);
   if(path==='/admin/applications')return ok({items:[],counts:{total:1,pendingProfile:1},total:0,page:1,pageCount:1,pageSize:10});
   if(path==='/admin/profile/nickname-fixture/review-item'&&request.method()==='POST'){
    const body=request.postDataJSON();writes.push(body);profile.profileItemStatuses.nickname={status:body.action==='approve'?'approved':'rejected',rejectionReason:body.reason};
    return ok({profileItemStatuses:profile.profileItemStatuses,allApproved:false});
   }
   return ok([]);
  });
  await page.goto(`${base}/applications`,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:/Profile Reviews/}).click();
  await page.getByRole('button',{name:`Review ${profile.name}`,exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Review Profile',exact:true}),section=dialog.getByRole('region',{name:'Preferred nickname review'});
  await expect(section).toContainText('Mary Ann');
  await expect(dialog.getByRole('progressbar')).toHaveAttribute('aria-valuemax','6');
  await section.getByRole('button',{name:'Reject',exact:true}).click();assert.equal(writes.length,0);
  await section.getByLabel('Nickname rejection reason').fill('Use the nickname from your introduction.');
  await section.getByRole('button',{name:'Reject',exact:true}).click();await expect(section).toContainText('Use the nickname from your introduction.');
  await section.getByRole('button',{name:'Approve',exact:true}).click();await expect(dialog.getByRole('progressbar')).toHaveAttribute('aria-valuenow','1');
  assert.deepEqual(writes.map(x=>[x.itemKey,x.action]),[['nickname','reject'],['nickname','approve']]);
  assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
  await page.screenshot({path:`/tmp/fluentxverse-nickname/admin-${width}.png`,fullPage:true});
  assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${width}px: nickname review, required rejection feedback and six-item approval progress`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
