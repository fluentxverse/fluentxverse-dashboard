const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.DASHBOARD_TEST_URL||'http://127.0.0.1:5272';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 fs.mkdirSync('/tmp/fluentxverse-booking-settings',{recursive:true});
 try{for(const width of [1440,390,320])for(const role of ['superadmin','admin']){
  const page=await browser.newPage({viewport:{width,height:950},colorScheme:width===390?'dark':'light',reducedMotion:'reduce'});
  let settings={mode:'paid',trialLessonLimit:1,revision:0,updatedAt:null},fail=false,loads=0;
  const writes=[];
  await page.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());if(url.origin===base)return route.continue();
   let json={success:true,data:[]};
   if(url.pathname==='/admin/me')json={success:true,user:{userId:'settings-qa-admin',username:'QA',role}};
   if(url.pathname==='/admin/booking-settings'){
    if(request.method()==='PUT'){
     const body=request.postDataJSON();writes.push(body);
     if(fail)return route.fulfill({status:409,json:{success:false,error:'Booking settings changed in another session. Reload before saving.'}});
     settings={...body,revision:settings.revision+1,updatedAt:new Date().toISOString()};
    }else loads++;
    json.data=settings;
   }
   if(url.pathname==='/admin/notifications')json.data={notifications:[],unreadCount:0};
   return route.fulfill({json});
  });
  await page.goto(`${base}/settings`,{waitUntil:'networkidle'});
  const section=page.getByRole('region',{name:'Lesson Booking',exact:true});
  if(role==='admin'){await expect(section).toHaveCount(0);assert.equal(loads,0);}
  else{
   await expect(section).toBeVisible();await expect(section).toContainText('Paid bookings');
   await section.getByLabel('Free trial',{exact:true}).check();
   await section.getByLabel('Free trials per student',{exact:true}).fill('2');
   await section.getByRole('button',{name:'Save booking settings',exact:true}).click();
   await expect(section.getByRole('status')).toContainText('Free-trial booking is enabled.');
   assert.deepEqual(writes[0],{mode:'trial',trialLessonLimit:2,revision:0});
   await page.reload({waitUntil:'networkidle'});await expect(section.getByLabel('Free trial',{exact:true})).toBeChecked();
   await expect(section.getByLabel('Free trials per student',{exact:true})).toHaveValue('2');
   fail=true;await section.getByLabel('Paid bookings',{exact:true}).check();
   await section.getByRole('button',{name:'Save booking settings',exact:true}).click();
   await expect(section.getByRole('alert')).toContainText('Reload before saving');
   await expect(section.getByLabel('Paid bookings',{exact:true})).toBeChecked();
   await section.getByRole('button',{name:'Reload',exact:true}).click();
   await expect(section.getByLabel('Free trial',{exact:true})).toBeChecked();
   await page.screenshot({path:`/tmp/fluentxverse-booking-settings/${width}.png`,fullPage:true});
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.close();console.log(`PASS ${width}px ${role}: booking settings visibility, save, persistence, conflict and reload`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
