'use strict';
const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'../..'),output=path.join(root,'.test-output');
const dataDir=fs.mkdtempSync(path.join(output,'management-'));
async function launch(){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const app=await electron.launch({executablePath:process.env.OPENSLIDE_TEST_EXE||require('electron'),args:[...(process.env.OPENSLIDE_TEST_EXE?[]:[root]),'--test-mode','--data-dir='+dataDir],env});await app.firstWindow();let page;for(let n=0;n<100;n++){page=app.windows().find(p=>p.url().endsWith('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}await page.waitForFunction(()=>document.querySelector('#day').value);await page.evaluate(()=>window.openslide.request('preferences',{autoHide:false}));return{app,page};}
(async()=>{let {app,page}=await launch();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Renderer:',e.message);});
try{
 const add=async title=>{await page.locator('#task-title').fill(title);await page.locator('#add-task button').click();await page.locator('.task-title').filter({hasText:title}).waitFor();};
 await add('Plan the next release');await add('Review the design');
 // Focus events used to replace the clicked button between pointer down and up.
 await page.locator('#task-title').focus();const b=await page.locator('.task-title').first().boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForTimeout(350);await page.mouse.up();await page.locator('#edit-title').waitFor();
 await page.locator('#edit-title').fill('Plan the launch');await page.locator('#edit-form button[type=submit]').click();await page.locator('.task-title').filter({hasText:'Plan the launch'}).waitFor();
 await page.locator('.task-timer').first().click();await page.waitForTimeout(1200);
 await page.locator('.task-action[data-action=edit]').first().click();await page.locator('#edit-title').fill('Plan the launch carefully');await page.locator('#edit-form button[type=submit]').click();
 const clock=await page.evaluate(async()=> (await window.openslide.request('get')).state.data.clock);assert.notEqual(clock.startedAt,null);assert.ok(clock.startedAt < Date.now()-1000,'Renaming must not restart the timer');
 await page.locator('.task-timer[data-action=pause]').click();
 await page.locator('.task-action[data-action=edit]').first().click();await page.locator('#task-options').click();await page.locator('#complete-task').click();assert.equal(await page.locator('.task-row').count(),1);
 await page.locator('#show-completed').click();await page.locator('.task-row.done .task-action[data-action=edit]').click();await page.locator('#task-options').click();await page.locator('#complete-task').click();assert.equal(await page.locator('.task-row.done').count(),0);
 await page.locator('.task-action[data-action=edit]').first().click();await page.locator('#task-options').click();await page.locator('#duplicate-task').click();assert.equal(await page.locator('.task-row').count(),3);
 await page.locator('.task-action[data-action=edit]').last().click();await page.locator('#task-options').click();await page.locator('#delete-task').click();await page.locator('#delete-task').click();assert.equal(await page.locator('.task-row').count(),2);await page.waitForFunction(()=>!document.querySelector('#edit-dialog').open);
 await page.locator('.task-action[data-action=edit]').first().click();await page.locator('#edit-day').click();
 const monthsToTarget = (2030-new Date().getFullYear())*12-new Date().getMonth();
 for(let n=0;n<monthsToTarget;n++)await page.locator('#picker-next').click();
 await page.locator('[data-date="2030-01-02"]').click();await page.locator('#edit-form button[type=submit]').click();assert.equal(await page.locator('.task-row').count(),1);
 await page.locator('#manage-tasks').click();await page.locator('#task-all-dates').check();assert.equal(await page.locator('.task-row').count(),2);
 await page.locator('#task-search').fill('launch');assert.equal(await page.locator('.task-row').count(),1);await page.locator('#task-search').fill('');
 // Confirm the public build renders the bundled default font, not an installed substitute.
 const font=await page.evaluate(async()=>{const faces=await document.fonts.load('400 15px Inter');await document.fonts.ready;return {count:faces.length,status:faces[0]?.status,family:getComputedStyle(document.querySelector('.task-title')).fontFamily};});assert.equal(font.count,1);assert.equal(font.status,'loaded');assert.match(font.family,/Inter/);
 const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const doc=await cdp.send('DOM.getDocument');const node=await cdp.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'.task-title'});const used=await cdp.send('CSS.getPlatformFontsForNode',{nodeId:node.nodeId});assert.ok(used.fonts.some(f=>f.isCustomFont && /Inter/i.test(f.familyName)),JSON.stringify(used));
 await page.screenshot({path:path.join(output,'tasks-inter.png')});
 await page.locator('.task-action[data-action=edit]').first().click();await page.screenshot({path:path.join(output,'manage-task-inter.png')});await page.locator('#dialog-cancel').click();
 await page.locator('[data-page=settings]').click();for(const [value,family]of [['dm-sans','DM Sans'],['metropolis','Metropolis'],['roboto-condensed','Roboto Condensed'],['inconsolata','Inconsolata'],['inter','Inter']]){await page.locator('[data-pref=font]').selectOption(value);assert.equal(await page.evaluate(async family=>(await document.fonts.load('400 15px "'+family+'"'))[0].status,family),'loaded');}
 await page.locator('[data-pref=font]').selectOption('avenir');
 await page.locator('[data-pref=textSize]').selectOption('18');await page.evaluate(()=>window.openslide.request('preferences',{width:340}));await page.locator('[data-page=workspace]').click();await page.locator('.task-action[data-action=edit]').first().click();await page.locator('#edit-form button[type=submit]').scrollIntoViewIfNeeded();assert.ok(await page.locator('#edit-form button[type=submit]').isVisible());await page.locator('#dialog-cancel').click();assert.equal(await page.evaluate(()=>document.querySelector('main').scrollWidth<=document.querySelector('main').clientWidth),true);
 await app.close();({app,page}=await launch());const saved=JSON.parse(fs.readFileSync(path.join(dataDir,'planner.json'),'utf8'));assert.equal(saved.preferences.font,'avenir');assert.equal(saved.tasks.length,2);assert.equal(saved.tasks[0].day,'2030-01-02');assert.match(saved.tasks[0].title,/carefully/);assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: held-click regression, rename without timer reset, edit, complete/reopen, duplicate, delete, reschedule, all-date management, search, five bundled fonts, actual Inter glyph rendering, optional Avenir preference, narrow layout and restart persistence.');
}catch(e){await page.screenshot({path:path.join(output,'management-failure.png')}).catch(()=>{});throw e;}finally{await app.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
