const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { chromium, expect } = require('@playwright/test');
const base = process.env.SERVER_HEALTH_URL || 'http://127.0.0.1:5213';
const output = resolve(process.cwd(), 'output/screenshots/server-health');
mkdirSync(output, { recursive: true });
function fixture() {
  return { status:'live', ageSeconds:1, snapshot:{version:1,sampledAt:new Date().toISOString(),hostname:'fluentxverse.com',uptimeSeconds:93210,
    cpu:{model:'AMD EPYC 7763',cores:1,usagePercent:13.7},
    memory:{totalBytes:7.7*1024**3,usedBytes:1.58*1024**3,availableBytes:6.12*1024**3},
    disk:{totalBytes:80*1024**3,usedBytes:14.9*1024**3,availableBytes:61.1*1024**3},
    network:{interface:'ens3',addresses:['185.184.223.23/24','2403:71c0:2000:11ca::a/64'],receivedBytes:2.94*1024**3,sentBytes:62.44*1024**2,receiveBytesPerSecond:51200,sendBytesPerSecond:4608},
    bandwidth:{allowanceBytes:2048*1024**3,billingSource:'not_connected'}} };
}
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  try {
    for (const width of [1440, 375, 320]) {
      const context = await browser.newContext({viewport:{width,height:960},colorScheme:'light'});
      let mode = 'live', calls = 0;
      const errors = [];
      await context.route('**/*', route => route.request().url().startsWith(base) || /^https:\/\/api\.fluentxverse\.(com|xyz)\//.test(route.request().url()) ? route.continue() : route.abort());
      await context.route(/^https:\/\/api\.fluentxverse\.(com|xyz)\//, async route => {
        const path = new URL(route.request().url()).pathname;
        if (route.request().method() === 'OPTIONS') return route.fulfill({status:204});
        if (path === '/admin/me') return route.fulfill({json:{success:true,user:{userId:'ops',username:'Operations',role:'superadmin'}}});
        if (path === '/admin/operations/access') return route.fulfill({json:{success:true,data:{permissions:['operations']}}});
        if (path === '/admin/server-health') {
          calls++;
          if (mode === 'denied') return route.fulfill({status:403,json:{success:false,error:'Operations permission required.'}});
          if (mode === 'error') return route.fulfill({status:503,json:{success:false,error:'Host monitoring is unavailable.'}});
          const data = fixture();
          if (mode === 'stale') { data.status='stale'; data.ageSeconds=60; data.snapshot.sampledAt=new Date(Date.now()-60000).toISOString(); }
          if (mode === 'first') { data.snapshot.cpu.usagePercent=null; data.snapshot.network.receiveBytesPerSecond=null; data.snapshot.network.sendBytesPerSecond=null; }
          return route.fulfill({json:{success:true,data}});
        }
        return route.fulfill({json:{success:true,data:[]}});
      });
      const page = await context.newPage(); page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base+'/server-health');
      await expect(page.getByRole('heading',{name:'Server Health',exact:true})).toBeVisible();
      await expect(page.getByText('Live host metrics',{exact:true})).toBeVisible();
      await expect(page.getByRole('region',{name:'CPU'}).locator('strong')).toContainText('13.7');
      await expect(page.getByText('Provider billing usage',{exact:true})).toBeVisible();
      await expect(page.getByText('Not connected',{exact:true})).toBeVisible();
      await expect(page.getByText('50 KiB/s',{exact:true})).toBeVisible();
      for (const theme of ['light','dark']) {
        if (theme === 'dark') await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
        await expect(page.locator('html')).toHaveAttribute('data-admin-theme',theme);
        await page.screenshot({path:resolve(output,`host-${theme}-${width}.png`),fullPage:true});
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
        assert(await page.locator('.sh-metric').evaluateAll(elements=>elements.every(el=>el.scrollWidth<=el.clientWidth+1)),'Metric text fits');
      }
      if (width === 1440) {
        await page.getByRole('checkbox',{name:'Auto-refresh'}).uncheck();
        await expect(page.getByText('Updates paused',{exact:true})).toBeVisible();
        await page.waitForTimeout(300);
        const before = calls; await page.waitForTimeout(5300); assert.equal(calls,before,'Paused means no polling');
        mode='error'; await page.getByRole('button',{name:'Refresh metrics'}).click();
        await expect(page.getByRole('alert')).toContainText('Last successful readings are shown.');
        await expect(page.getByText('Stale readings',{exact:true})).toBeVisible();
        mode='stale'; await page.getByRole('button',{name:'Refresh metrics'}).click();
        await expect(page.getByRole('alert')).toHaveCount(0);
        await expect(page.getByText('Stale readings',{exact:true})).toBeVisible();
        mode='first'; await page.getByRole('button',{name:'Refresh metrics'}).click();
        await expect(page.getByText('Sampling...',{exact:true})).toHaveCount(2);
        mode='denied'; await page.getByRole('button',{name:'Refresh metrics'}).click();
        await expect(page.getByRole('heading',{name:'Restricted access'})).toBeVisible();
        await expect(page.getByText('185.184.223.23/24',{exact:true})).toHaveCount(0);
        await expect(page.getByRole('button',{name:'Refresh metrics'})).toBeDisabled();
        await page.screenshot({path:resolve(output,'restricted.png'),fullPage:true});
        mode='error'; await page.reload();
        await expect(page.getByRole('heading',{name:'Monitoring unavailable'})).toBeVisible();
      }
      assert.deepEqual(errors,[],'No browser runtime errors');
      await context.close();
    }
    console.log('PASS host dashboard desktop/mobile, light/dark, polling, stale, initial sample, offline and permission states.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
