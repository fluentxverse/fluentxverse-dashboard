const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { chromium, expect } = require('@playwright/test');
const base = process.env.CONTAINER_STATS_URL || 'http://127.0.0.1:5214';
const output = resolve(process.cwd(), 'output/screenshots/container-stats');
mkdirSync(output, { recursive: true });
const metric = { cpuPercent: 2.35, memoryBytes: 177.9*1024**2, memoryLimitBytes:1024**3, receivedBytes:20.5*1024**2, sentBytes:19.2*1024**2, blockReadBytes:51.6*1024**2, blockWrittenBytes:0, pids:17 };
function fixture() {
  return { status:'live', ageSeconds:0, snapshot:{ version:1,sampledAt:new Date().toISOString(),hostname:'fluentxverse.com',containers:[
    { id:'a'.repeat(64),name:'fluentxverse-server',state:'running',status:'Up 2 hours (healthy)',metrics:{...metric} },
    { id:'b'.repeat(64),name:'budol-gmr-engine-1',state:'running',status:'Up 2 hours (healthy)',metrics:{...metric,cpuPercent:6.52,memoryBytes:6.73*1024**2,pids:16} },
    { id:'c'.repeat(64),name:'fluentxverse-memgraph',state:'running',status:'Up 2 hours (healthy)',metrics:{...metric,cpuPercent:0.2,memoryBytes:388.9*1024**2,memoryLimitBytes:1536*1024**2,pids:60} },
    { id:'d'.repeat(64),name:'fluentxverse-server-review-tally-prover-1',state:'exited',status:'Exited (0) 1 hour ago',metrics:null },
    { id:'e'.repeat(64),name:'fluentxverse-seaweed-volume',state:'paused',status:'Up 2 hours (Paused)',metrics:{...metric,cpuPercent:0} },
  ]}};
}
(async()=>{
  const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  try {
    for (const width of [1440,1024,375,320]) {
      const context=await browser.newContext({viewport:{width,height:960},colorScheme:'light'});
      let mode='live',calls=0, permissions=['operations']; const errors=[];
      await context.route('**/*',route=>route.request().url().startsWith(base)||/^https:\/\/api\.fluentxverse\.(com|xyz)\//.test(route.request().url())?route.continue():route.abort());
      await context.route(/^https:\/\/api\.fluentxverse\.(com|xyz)\//,async route=>{
        const path=new URL(route.request().url()).pathname;
        if(route.request().method()==='OPTIONS')return route.fulfill({status:204});
        if(path==='/admin/me')return route.fulfill({json:{success:true,user:{userId:'ops',username:'Operations',role:'superadmin'}}});
        if(path==='/admin/operations/access')return route.fulfill({json:{success:true,data:{permissions}}});
        if(path==='/admin/container-stats'){
          calls++;
          if(mode==='error')return route.fulfill({status:503,json:{success:false,error:'Unavailable'}});
          if(mode==='denied')return route.fulfill({status:403,json:{success:false,error:'Denied'}});
          const data=fixture();
          if(mode==='stale'){data.status='stale';data.ageSeconds=65;data.snapshot.sampledAt=new Date(Date.now()-65000).toISOString();}
          if(mode==='partial'){data.status='partial';data.snapshot.containers[0].metrics=null;}
          if(mode==='empty')data.snapshot.containers=[];
          return route.fulfill({json:{success:true,data}});
        }
        return route.fulfill({json:{success:true,data:[]}});
      });
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/stats');
      await expect(page.getByRole('heading',{name:'Stats',exact:true})).toBeVisible();
      await expect(page.getByText('Live container stats',{exact:true})).toBeVisible();
      await expect(page.locator('.cs-table tbody tr')).toHaveCount(5);
      if(width===1440){
        const links=page.locator('.management-never-match');
        assert.equal(await page.locator('a[href="/server-health"]').evaluate(el=>el.closest('li').nextElementSibling.querySelector('a').getAttribute('href')),'/stats');
        await page.getByRole('button',{name:'CPU',exact:true}).click();
        await expect(page.locator('.cs-table tbody tr').first()).toContainText('budol-gmr-engine-1');
      }else if(width<=760){
        await page.getByRole('combobox',{name:'Sort containers'}).selectOption('memory');
        await expect(page.locator('.cs-table tbody tr').first()).toContainText('fluentxverse-memgraph');
      }
      for(const theme of ['light','dark']){
        if(theme==='dark')await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
        await page.screenshot({path:resolve(output,`stats-${theme}-${width}.png`),fullPage:width>760});
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
        if(width<=760)assert(await page.locator('.cs-table tbody tr').evaluateAll(rows=>rows.every(row=>row.scrollWidth<=row.clientWidth+1)),'No mobile row overflow');
      }
      await page.getByRole('searchbox',{name:'Search containers'}).fill('SERVER');
      await expect(page.locator('.cs-table tbody tr')).toHaveCount(2);
      await page.getByRole('combobox',{name:'Container state'}).selectOption('running');
      await expect(page.locator('.cs-table tbody tr')).toHaveCount(1);
      await page.getByRole('searchbox',{name:'Search containers'}).fill('not-present');
      await expect(page.getByRole('heading',{name:'No matching containers'})).toBeVisible();
      await page.getByRole('button',{name:'Clear filters'}).click();
      await expect(page.locator('.cs-table tbody tr')).toHaveCount(5);
      await page.getByRole('searchbox',{name:'Search containers'}).fill('dddddddddddd');
      await expect(page.locator('.cs-table tbody tr')).toHaveCount(1);
      assert(!await page.locator('.cs-table tbody').innerText().then(text=>text.includes('0.00%')),'Stopped metrics must not become zero');
      await page.getByRole('searchbox',{name:'Search containers'}).fill('');
      if(width===1440){
        await page.getByRole('checkbox',{name:'Auto-refresh'}).uncheck();
        const before=calls;await page.waitForTimeout(5500);assert.equal(calls,before,'No paused polling');
        mode='error';await page.getByRole('button',{name:'Refresh container statistics'}).click();
        await expect(page.getByRole('alert')).toContainText('Last successful readings');
        await expect(page.getByText('Stale readings',{exact:true})).toBeVisible();
        mode='stale';await page.getByRole('button',{name:'Refresh container statistics'}).click();
        await expect(page.getByRole('alert')).toHaveCount(0);
        await expect(page.getByText('Stale readings',{exact:true})).toBeVisible();
        mode='partial';await page.getByRole('button',{name:'Refresh container statistics'}).click();
        await expect(page.getByText('1 metrics unavailable',{exact:true})).toBeVisible();
        mode='empty';await page.getByRole('button',{name:'Refresh container statistics'}).click();
        await expect(page.getByRole('heading',{name:'No containers',exact:true})).toBeVisible();
        mode='denied';await page.getByRole('button',{name:'Refresh container statistics'}).click();
        await expect(page.getByRole('heading',{name:'Restricted access'})).toBeVisible();
        await expect(page.locator('.cs-table')).toHaveCount(0);
        permissions=['support'];await page.reload();
        await expect(page.getByRole('heading',{name:'Restricted access'})).toBeVisible();
        await expect(page.locator('a[href="/stats"]')).toHaveCount(0);
        await expect(page.locator('a[href="/server-health"]')).toHaveCount(0);
        mode='error';await page.reload();
        await expect(page.getByRole('heading',{name:'Monitoring unavailable'})).toBeVisible();
      }
      assert.deepEqual(errors,[],'No browser errors');await context.close();
    }
    console.log('PASS container stats desktop/mobile, themes, ordering, filters, polling, stopped/partial/stale/offline and permissions.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
