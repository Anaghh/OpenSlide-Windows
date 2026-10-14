'use strict';
const {_electron:electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.test-output');
(async()=>{const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const exe=process.env.OPENSLIDE_TEST_EXE;const app=await electron.launch({executablePath:exe||require('electron'),args:[...(exe?[]:[root]),'--test-mode','--data-dir='+fs.mkdtempSync(path.join(out,'compact-'))],env});try{
 await app.firstWindow();let page;for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().endsWith('/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}await page.waitForFunction(()=>document.querySelector('#day').value);
 await page.evaluate(()=>window.openslide.request('preferences',{autoHide:false,hoverToOpen:false,width:560,opacity:.85}));
 await page.locator('#task-title').fill('Read a little');await page.locator('#add-task button').click();
 for(const corner of ['top-left','top-center','top-right','bottom-left','bottom-right']){
  await page.evaluate(corner=>window.openslide.request('preferences',{corner}),corner);await page.locator('[data-page=workspace]').click();
  const dims=await page.evaluate(()=>{const row=document.querySelector('.task-row'),check=document.querySelector('.task-check'),m=document.querySelector('main');return{w:innerWidth,h:innerHeight,check:getComputedStyle(check,':before').width,row:row.getBoundingClientRect().height,overflow:m.scrollWidth>m.clientWidth};});
  assert.ok(dims.w<=(corner.startsWith('top')?640:380));assert.ok(dims.h<=(corner.startsWith('top')?380:540));assert.equal(dims.check,'15px');assert.ok(dims.row<50);assert.equal(dims.overflow,false);
  const native=await app.evaluate(({BrowserWindow,screen})=>{const w=BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('handle=1'));const b=w.getBounds(),a=screen.getDisplayMatching(b).workArea;return{opacity:w.getOpacity(),inside:b.x>=a.x&&b.y>=a.y&&b.x+b.width<=a.x+a.width&&b.y+b.height<=a.y+a.height};});assert.equal(native.opacity,1);assert.equal(native.inside,true);
  if(corner==='top-center'||corner==='bottom-right'){await page.evaluate(()=>document.querySelector('#toast').hidden=true);await page.screenshot({path:path.join(out,'compact-'+corner+'.png')});}
 }
 for(const textSize of [15,18]){for(const theme of ['dark','midnight','light']){for(const corner of ['top-center','bottom-right']){
  await page.evaluate(p=>window.openslide.request('preferences',p),{theme,corner,textSize});const bounds=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('handle=1')).getBounds());await page.waitForFunction(b=>innerWidth===b.width&&innerHeight===b.height,bounds);await page.locator('[data-page=insights]').click();
  const layout=await page.evaluate(()=>{const m=document.querySelector('main'),chart=document.querySelector('.chart-card'),metrics=document.querySelector('.insight-stats article');return{display:getComputedStyle(document.querySelector('#insights')).display,columns:getComputedStyle(document.querySelector('#insights')).gridTemplateColumns,top:chart.getBoundingClientRect().top,height:chart.getBoundingClientRect().height,chartHeight:document.querySelector('#chart').getBoundingClientRect().height,overflow:m.scrollWidth>m.clientWidth,chart:chart.getBoundingClientRect().bottom,bottom:m.getBoundingClientRect().bottom,background:getComputedStyle(metrics).backgroundColor,foreground:getComputedStyle(metrics).color};});
  assert.equal(layout.overflow,false);assert.ok(layout.chart<=layout.bottom,'Whole insights chart should fit at '+corner+' '+JSON.stringify(layout));assert.notEqual(layout.foreground,layout.background);
  await page.screenshot({path:path.join(out,'insights-'+theme+'-'+corner+'.png')});
 }}}
 await page.locator('[data-page=workspace]').click();
 await page.locator('.task-check').click();assert.equal(await page.locator('.task-row').count(),0);await page.locator('#show-completed').click();await page.locator('.task-check').click();await page.locator('.task-timer').click();await page.waitForFunction(()=>document.querySelector('.task-timer').dataset.action==='pause');await page.locator('.task-timer').click();
 console.log('PASS: all five corners fit monitor bounds, compact native dimensions, 15px checkboxes, single-line task rows, opaque text backing, complete/reopen and task start/pause.');
 }finally{await app.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
