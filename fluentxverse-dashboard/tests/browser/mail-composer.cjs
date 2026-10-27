const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.EMAIL_TEST_URL || 'http://127.0.0.1:5200';
const output = path.resolve(__dirname,'../../../output/email/composer'); fs.mkdirSync(output,{recursive:true});
const widths=(process.env.EMAIL_TEST_WIDTHS||'1440,768,375,320').split(',').map(Number);
const height=Number(process.env.EMAIL_TEST_HEIGHT||900);
(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  try {
    for(const width of widths) for(const theme of ['light','dark']) {
      const context=await browser.newContext({viewport:{width,height},colorScheme:theme,reducedMotion:'reduce'});
      const drafts=new Map(), requests=[], errors=[];
      await context.route('**/*',route=>route.request().url().startsWith(base)||/\/\/api\.fluentxverse\./.test(route.request().url())?route.continue():route.abort());
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):8765)\//,route=>{
        const req=route.request(), endpoint=new URL(req.url()).pathname;
        requests.push({method:req.method(),path:endpoint});
        if(req.method()==='OPTIONS')return route.fulfill({status:204});
        const reply=data=>route.fulfill({json:{success:true,data}});
        if(endpoint==='/admin/me')return route.fulfill({json:{success:true,user:{userId:'composer-fixture',username:'Operations',role:'superadmin'}}});
        if(endpoint==='/admin/mail/status')return reply({configured:true,accounts:[{id:'support',label:'Support',address:'support@fluentxverse.com'}]});
        if(endpoint==='/admin/mail/preferences')return reply({signature:'',contacts:[]});
        if(endpoint==='/admin/mail/support/folders')return reply([{path:'INBOX',role:'inbox',name:'Inbox',total:0,unread:0}]);
        if(endpoint==='/admin/mail/support/messages')return reply({messages:[],total:0,page:1,pages:1,uidValidity:'42'});
        if(endpoint==='/admin/mail/support/drafts') {
          if(req.method()==='PUT'){const input=req.postDataJSON(),value={...input,revision:input.revision+1,updatedAt:new Date().toISOString()};drafts.set(input.id,value);return reply(value)}
          return reply([...drafts.values()]);
        }
        if(endpoint.startsWith('/admin/mail/support/drafts/')&&req.method()==='DELETE'){drafts.delete(endpoint.split('/').pop());return reply({})}
        return reply([]);
      });
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/email',{waitUntil:'domcontentloaded'});
      if(width<=700)await page.getByRole('button',{name:'Toggle mail folders',exact:true}).click();
      await page.getByRole('button',{name:'Compose',exact:true}).click();
      const dialog=page.getByRole('dialog',{name:'New message',exact:true}), body=dialog.getByRole('textbox',{name:'Message body',exact:true});
      await body.waitFor();
      const canvas = await body.evaluate(node => {
        const style = getComputedStyle(node), container = getComputedStyle(node.parentElement), placeholder = getComputedStyle(node, '::before');
        return {background:style.backgroundColor,container:container.backgroundColor,text:style.color,placeholder:placeholder.color,scheme:style.colorScheme};
      });
      assert.equal(canvas.container,theme==='dark'?'rgb(29, 31, 35)':'rgb(255, 255, 255)');
      if(theme==='dark') {
        assert.equal(canvas.background,'rgb(29, 31, 35)'); assert.equal(canvas.text,'rgb(230, 232, 236)');
        assert.equal(canvas.placeholder,'rgb(166, 173, 184)'); assert.equal(canvas.scheme,'dark');
      }
      const rect=await dialog.boundingBox();
      assert(rect.width>width*.82 && rect.height>height*.88,'Composer should use most of the viewport');
      if(width<=700)assert(Math.abs(rect.width-width)<1 && Math.abs(rect.x)<1,'Mobile composer is genuinely full width');
      const toolbar=dialog.getByRole('toolbar',{name:'Message formatting'});
      const bar=await toolbar.boundingBox(),editorBox=await body.boundingBox();
      assert(bar.y>=editorBox.y+editorBox.height-2,'Formatting is below the writing area');
      await page.screenshot({path:path.join(output,`empty-${width}-${theme}.png`)});
      await dialog.getByLabel('To recipients').fill('student@example.test');
      await dialog.getByLabel('Subject',{exact:true}).fill('A better composing experience');
      await body.fill('Hello FluentXVerse'); await body.press('Control+a');
      await dialog.getByRole('button',{name:'Bold',exact:true}).click();
      await dialog.getByRole('button',{name:'Underline',exact:true}).click();
      await dialog.getByLabel('Font family',{exact:true}).selectOption('Georgia');
      await dialog.getByLabel('Font size',{exact:true}).selectOption('18px');
      await dialog.getByLabel('Text color',{exact:true}).fill('#9a3045');
      await dialog.getByLabel('Highlight color',{exact:true}).fill('#fff099');
      await dialog.getByLabel('Text alignment',{exact:true}).selectOption('center');
      await expect.poll(()=>[...drafts.values()][0]?.html||'').toContain('font-family: Georgia');
      const styled=[...drafts.values()][0];
      assert(styled.html.includes('text-align: center')&&styled.html.includes('font-size: 18px')&&styled.html.includes('rgb(154, 48, 69)'));
      assert(!styled.html.includes('ql-'),'Email formatting must not rely on Quill CSS');
      await page.emulateMedia({colorScheme:theme==='dark'?'light':'dark'});
      await expect(page.locator('html')).toHaveAttribute('data-admin-theme',theme==='dark'?'light':'dark');
      assert.equal([...drafts.values()][0].html,styled.html,'Switching app theme must not rewrite authored message colors');
      await page.emulateMedia({colorScheme:theme});
      await expect(page.locator('html')).toHaveAttribute('data-admin-theme',theme);
      await body.press('Control+End'); await page.waitForTimeout(600);
      await body.pressSequentially(' UndoTest');
      await dialog.getByRole('button',{name:'Undo',exact:true}).click(); await expect(body).not.toContainText('UndoTest');
      await dialog.getByRole('button',{name:'Redo',exact:true}).click(); await expect(body).toContainText('UndoTest');
      await body.press('Control+End');
      await dialog.getByRole('button',{name:'Insert link',exact:true}).click();
      let popup=dialog.getByRole('dialog',{name:'Insert link',exact:true});
      await popup.getByLabel('Link display text').fill('Lesson details'); await popup.getByLabel('Link URL').fill('javascript:alert(1)');
      await popup.getByRole('button',{name:'Insert link',exact:true}).click(); await expect(popup.getByRole('alert')).toBeVisible();
      await popup.getByLabel('Link URL').fill('https://fluentxverse.com');await popup.getByRole('button',{name:'Insert link',exact:true}).click();
      await expect(body.locator('a[href="https://fluentxverse.com/"]')).toHaveText('Lesson details');
      await dialog.getByRole('button',{name:'Insert emoji',exact:true}).click();
      await dialog.getByRole('dialog',{name:'Emoji',exact:true}).getByRole('button',{name:'Smile',exact:true}).click();
      await expect(body).toContainText('\u{1F642}');
      await dialog.getByRole('button',{name:'Insert signature',exact:true}).click();
      popup=dialog.getByRole('dialog',{name:'Signature',exact:true});
      await popup.getByLabel('Signature text').fill('Operations Team');await popup.getByRole('button',{name:'Insert signature',exact:true}).click();
      await expect(body).toContainText('Operations Team');
      await dialog.getByRole('button',{name:'Insert Google Drive link',exact:true}).click();
      popup=dialog.getByRole('dialog',{name:'Insert Google Drive link',exact:true});
      await popup.getByLabel('Link display text').fill('Lesson plan');await popup.getByLabel('Link URL').fill('https://docs.google.com/document/d/fixture/edit');
      await popup.getByRole('button',{name:'Insert link',exact:true}).click();await expect(body.locator('a[href^="https://docs.google.com/"]')).toHaveText('Lesson plan');
      await dialog.getByLabel('Inline photo',{exact:true}).setInputFiles({name:'brand.png',mimeType:'image/png',buffer:fs.readFileSync('public/assets/img/logo/icon_logo.png')});
      await expect(body.locator('img')).toHaveCount(1);await expect.poll(()=>body.locator('img').evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
      await dialog.getByLabel('Attachment files',{exact:true}).setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('Composer fixture')});
      await expect(dialog.locator('.mail-file-list')).toContainText('notes.txt');
      await dialog.getByRole('button',{name:'Formatting options',exact:true}).click();await expect(toolbar).toBeHidden();
      await dialog.getByRole('button',{name:'Formatting options',exact:true}).click();await expect(toolbar).toBeVisible();
      await expect(dialog.getByRole('status')).toHaveText('Draft saved');
      const saved=[...drafts.values()][0];assert(/data:image\/(png|jpeg);base64,/.test(saved.html)&&saved.text.includes('[Image: brand.png]'), 'Saved inline image and plain-text alternative');
      await page.screenshot({path:path.join(output,`formatted-${width}-${theme}.png`)});
      await dialog.getByRole('button',{name:'Send options',exact:true}).click();
      await dialog.getByRole('button',{name:'Save and close',exact:true}).click();await expect(dialog).toHaveCount(0);
      await page.locator('.mail-folders nav button').filter({hasText:'Drafts'}).click();
      await page.locator('.mail-draft-row > button').first().click();
      await expect(body).toContainText('Operations Team');await expect(body.locator('img')).toHaveCount(1);
      assert(await body.locator('[style*="font-family"]').count()>0,'Formatting survives reopening the saved draft');
      await dialog.getByRole('button',{name:'Maximize composer',exact:true}).click();
      await expect(body).toContainText('Operations Team');
      await dialog.getByRole('button',{name:'Restore composer size',exact:true}).click();
      await dialog.getByRole('button',{name:'Minimize composer',exact:true}).click();
      await expect(body).toBeHidden();assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
      await page.screenshot({path:path.join(output,`minimized-${width}-${theme}.png`)});
      await dialog.getByRole('button',{name:'Restore composer',exact:true}).click();await expect(body).toContainText('Operations Team');
      await dialog.getByRole('button',{name:'Insert link',exact:true}).click();await page.keyboard.press('Escape');
      await expect(dialog.getByRole('dialog',{name:'Insert link',exact:true})).toHaveCount(0);await expect(dialog).toBeVisible();
      await dialog.getByRole('button',{name:'More compose options',exact:true}).click();
      page.once('dialog',prompt=>prompt.accept());await dialog.getByRole('checkbox',{name:'Plain text mode',exact:true}).click();
      await expect(toolbar).toBeHidden();await expect(body.locator('img')).toHaveCount(0);
      await expect.poll(()=>[...drafts.values()][0]?.html).toBe('');
      await page.evaluate(()=>{window.__printed=0;window.print=()=>window.__printed++});
      await dialog.getByRole('button',{name:'More compose options',exact:true}).click();await dialog.getByRole('button',{name:'Print draft',exact:true}).click();
      assert.equal(await page.evaluate(()=>window.__printed),1);
      await dialog.getByRole('button',{name:'Discard draft',exact:true}).click();
      await dialog.getByRole('dialog',{name:'Discard draft',exact:true}).getByRole('button',{name:'Discard',exact:true}).click();
      await expect(dialog).toHaveCount(0);assert.equal(drafts.size,0);
      assert(!requests.some(request=>request.path.endsWith('/send')),'Composer tests never send an email');
      assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await context.close();console.log(`PASS composer ${width} ${theme}: formatting, images, links, emoji, signature, Drive links, maximize/minimize, draft persistence and discard`);
    }
  } finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
