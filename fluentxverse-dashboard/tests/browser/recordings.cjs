const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const id='a5fda17a-7206-489e-8207-f7499bc3ed23';
(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  try{
    for(const width of [1566,375]){
      const context=await browser.newContext({viewport:{width,height:900}});
      let deleted=false,listFailed=false,search='',plays=0;
      const errors=[];
      const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
      await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(localhost|127\.0\.0\.1):8765)\//,route=>{
        const url=new URL(route.request().url()),path=url.pathname;
        let data={success:true,data:[]};
        if(path==='/admin/me')data={success:true,user:{userId:'qa-admin',username:'QA Admin',role:'admin'}};
        if(path==='/admin/recordings/'){
          if(listFailed)return route.fulfill({status:503,json:{success:false}});
          search=url.searchParams.get('booking');
          data.data=[{id,booking_id:'test-booking-with-long-identifier-for-mobile-layout',provider_status:'UPLOADED',local_status:deleted?'deleted':'stored',invoked_at:new Date().toISOString(),expires_at:new Date(Date.now()+30*86400000).toISOString(),byte_size:12345678,error:null}];
        }
        if(path.endsWith('/audit'))data.data=[{admin_id:'qa-admin',action:'playback',detail:'0-1048575',created_at:new Date().toISOString()}];
        if(path.endsWith('/playback')){plays++;return route.fulfill({status:404,body:'Fixture playback unavailable'});}
        if(route.request().method()==='DELETE'){deleted=true;data={success:true};}
        return route.fulfill({json:data});
      });
      await context.routeWebSocket('**/socket.io/**',ws=>{ws.onMessage(message=>{if(String(message).startsWith('40'))ws.send('40{"sid":"fixture"}');});ws.send('0{"sid":"fixture","upgrades":[],"pingInterval":25000,"pingTimeout":20000}');});
      await page.goto(process.env.QA_DASHBOARD_URL || 'http://127.0.0.1:5185/recordings');
      await page.getByRole('heading',{name:'QA Recordings',exact:true}).waitFor();
      await page.getByRole('button',{name:'Play recording',exact:true}).waitFor();
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:`../output/screenshots/qa-recordings-admin-${width}.png`,fullPage:true});
      await page.getByRole('button',{name:'View access history'}).click();
      await page.getByRole('dialog').getByText('playback',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Close recording'}).click();
      await page.getByRole('button',{name:'Play recording',exact:true}).click();
      await page.getByRole('dialog').locator('video').waitFor();
      await page.waitForTimeout(300);assert(plays>0);
      await page.getByRole('button',{name:'Close recording'}).click();
      await page.getByRole('textbox',{name:'Booking ID'}).fill('booking-test');
      await page.getByRole('button',{name:'Search',exact:true}).click();
      await page.waitForTimeout(100);assert.equal(search,'booking-test');
      page.once('dialog',dialog=>dialog.accept());
      await page.getByRole('button',{name:'Delete recording'}).click();
      await page.locator('td[data-label="Local archive"]').filter({hasText:'deleted'}).waitFor();
      assert(await page.getByRole('button',{name:'Play recording',exact:true}).isDisabled());
      listFailed=true;await page.getByRole('button',{name:'Refresh recordings'}).click();
      await page.getByText('Could not load recordings.',{exact:true}).waitFor();
      listFailed=false;await page.getByRole('button',{name:'Refresh recordings'}).click();
      await page.locator('td[data-label="Local archive"]').filter({hasText:'deleted'}).waitFor();
      assert.deepEqual(errors,[]);console.log(`PASS: ${width}px admin recordings list, search, playback state, audit, deletion, error recovery and layout`);
      await context.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
