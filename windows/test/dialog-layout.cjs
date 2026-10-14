'use strict';
const {_electron:electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.test-output');
(async()=>{const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const exe=process.env.OPENSLIDE_TEST_EXE;const app=await electron.launch({executablePath:exe||require('electron'),args:[...(exe?[]:[root]),'--test-mode','--data-dir='+fs.mkdtempSync(path.join(out,'dialogs-'))],env});let page;try{
 await app.firstWindow();for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().endsWith('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}await page.waitForFunction(()=>document.querySelector('#day').value);
 await page.evaluate(()=>window.openslide.request('preferences',{autoHide:false,hoverToOpen:false}));await page.locator('#task-title').fill('Plan a quiet afternoon');await page.locator('#add-task button').click();
 for(const [corner,width,height,textSize] of [['top-center',640,380,15],['top-right',640,300,18],['bottom-right',340,540,18],['bottom-left',360,460,15]]){
  await page.evaluate(p=>window.openslide.request('preferences',p),{corner,textSize,theme:'midnight'});
  await app.evaluate(({BrowserWindow},b)=>BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('handle=1')).setBounds({x:12,y:12,...b}),{width,height});await page.waitForFunction(b=>innerWidth===b.width&&innerHeight===b.height,{width,height});
  await page.locator('[data-page=workspace]').click();await page.locator('.task-action[data-action=edit]').click();
  const save=page.locator('#edit-form button[type=submit]');
  for(const selector of ['#edit-title','#edit-day','#edit-duration','#reminder-day','#reminder-time','#clear-reminder']){
   const control=page.locator(selector);await control.scrollIntoViewIfNeeded();
   const visible=await control.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);const d=document.querySelector('#dialog-fields').getBoundingClientRect();return el.contains(hit)&&r.top>=d.top-1&&r.bottom<=d.bottom+1;});assert.equal(visible,true,selector+' must be unobscured at '+width+'x'+height);
   assert.equal(await save.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'Save stays reachable while fields scroll');
  }
  await page.locator('#task-options').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#edit-dialog').evaluate(el=>el.open),true);assert.equal(await page.locator('#task-actions-menu').isVisible(),false);await page.locator('#task-options').click();
  for(const selector of ['#complete-task','#remind-soon','#move-tomorrow','#duplicate-task','#delete-task']){
   const control=page.locator(selector);await control.scrollIntoViewIfNeeded();assert.equal(await control.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,selector+' menu action is visible');
  }
  if(corner==='top-center')await page.screenshot({path:path.join(out,'task-actions-menu.png')});
  await page.locator('#task-options').click();
  await page.locator('#edit-title').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'editor-'+corner+'.png')});
  await page.locator('#edit-title').fill('A calm plan');await page.locator('#edit-day').click();await page.locator('#picker-cancel').click();assert.equal(await page.locator('#edit-title').inputValue(),'A calm plan');await save.click();
  await page.locator('#duration').click();await page.locator('#new-duration').fill('35');await save.click();assert.equal(await page.locator('#duration').textContent(),'35 min');
  for(const section of ['workspace','calendar','insights','settings']){await page.locator('[data-page='+section+']').click();assert.equal(await page.evaluate(()=>document.querySelector('main').scrollWidth<=document.querySelector('main').clientWidth),true);}
 }
 console.log('PASS: every task-editor field and action remains unobscured; Save/Cancel stay reachable; nested calendar preserves edits; focus duration saves; all pages fit at short top and narrow side sizes.');
 }catch(e){if(page)await page.screenshot({path:path.join(out,'dialog-audit-failure.png')});throw e;}finally{await app.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
