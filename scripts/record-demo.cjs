'use strict';
// Real Electron UI captures, composed into a tutorial with synthetic sample data.
const { _electron: electron } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { defaults, Planner, dayKey } = require('../windows/model.cjs');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.test-output');
const media = path.join(root, 'docs/media');
fs.mkdirSync(output, { recursive: true }); fs.mkdirSync(media, { recursive: true });
const work = fs.mkdtempSync(path.join(output, 'tutorial-'));
const profile = path.join(work, 'profile'); fs.mkdirSync(profile);
const frames = path.join(work, 'frames'); fs.mkdirSync(frames);
const data = defaults();
Object.assign(data.preferences, { width:380, autoHide:false, sound:false, theme:'dark', font:'inter', companion:'moon' });
const planner = new Planner(data);
['Review the proposal', 'Make room for deep work'].forEach(title => planner.action('add', {title,day:dayKey()}));
fs.writeFileSync(path.join(profile,'planner.json'), JSON.stringify(data));
const stageFile = path.join(work, 'tutorial-stage.html');
fs.writeFileSync(stageFile, `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Inter;src:url('${new URL('../windows/assets/fonts/Inter-Regular.ttf', 'file:///'+__filename.replaceAll('\\','/')).href}')}*{box-sizing:border-box}body{margin:0;width:1280px;height:800px;overflow:hidden;background:#f3f5f1;font-family:Inter,'Segoe UI',sans-serif;color:#273b31}.board{height:100%;position:relative;background:radial-gradient(ellipse at 87% 20%,#d6e7db,transparent 45%),radial-gradient(ellipse at 70% 95%,#e6dff1,transparent 42%)}.brand{position:absolute;top:55px;left:62px;display:flex;align-items:center;gap:13px;font-size:24px;font-weight:600;letter-spacing:-1px}.brand img{width:40px;height:40px}.tag{position:absolute;top:65px;right:57px;font-size:12px;color:#64776b;letter-spacing:1px}.copy{position:absolute;left:62px;top:247px;width:535px}.step{font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#668b72;font-weight:600;margin-bottom:20px}h1{font-size:53px;letter-spacing:-2.5px;line-height:1.1;font-weight:600;margin:0 0 24px}p{font-size:19px;line-height:1.65;color:#68766d;margin:0;max-width:425px}.shortcut{margin-top:28px;font-size:12px;color:#63766a}kbd{font-family:inherit;background:#fff9;border:1px solid #d5ddd4;border-bottom-width:3px;border-radius:6px;padding:6px 10px;font-size:13px;color:#385341}.visual{position:absolute;right:20px;top:140px;width:640px;height:620px;border:1px solid #dbe4da;border-radius:24px;background:linear-gradient(145deg,#e4ece2cc,#e3e6edcc);overflow:hidden;box-shadow:inset 0 1px 0 #fff9}.visual:before{content:'WINDOWS WORKSPACE';position:absolute;top:22px;left:24px;font-size:10px;letter-spacing:2px;color:#8a9c8d}.shot{position:absolute;right:18px;bottom:20px;width:380px;height:540px;object-fit:contain;border-radius:18px;filter:drop-shadow(0 14px 22px #26362d22);transform-origin:right bottom}.shot.top{right:15px;top:65px;bottom:auto;width:610px;height:auto}.handle{position:absolute;bottom:4px;right:0;width:64px;height:48px;object-fit:contain}.cursor{position:absolute;width:24px;height:30px;filter:drop-shadow(0 2px 2px #0003);z-index:4}.halo{position:absolute;width:48px;height:48px;border:2px solid #6c9275;border-radius:50%;z-index:3;background:#92be9a22}.foot{position:absolute;bottom:42px;left:62px;font-size:11px;color:#87928a;letter-spacing:.2px}.steps{display:flex;gap:9px;margin-bottom:18px}.dot{width:28px;height:3px;border-radius:3px;background:#cdd8cd}.dot.active{background:#577c61}.sample{position:absolute;bottom:21px;right:46px;font-size:10px;color:#7e8f83}.complete{color:#446c50;font-size:11px;letter-spacing:1.4px;margin-top:20px}
</style></head><body><div class="board"><div class="brand"><img id="icon">OpenSlide</div><span class="tag">YOUR DAY, ONE CORNER AWAY.</span><div class="copy"><div class="step" id="step"></div><h1 id="title"></h1><p id="description"></p><div class="shortcut"><kbd>Alt</kbd> + <kbd>N</kbd> <span> · Open from anywhere</span></div></div><div class="visual"><img id="shot" class="shot" hidden><img id="handle" class="handle"><svg id="cursor" class="cursor" viewBox="0 0 24 30"><path d="M2 1L2 23L8 18L13 28L17 26L12 16L21 16Z" fill="#fff" stroke="#3d5044" stroke-width="1.5"/></svg><div id="halo" class="halo" hidden></div></div><div class="foot"><div class="steps" id="steps"></div>Designed by Anagh · github.com/Anaghh/OpenSlide-Windows</div><div class="sample">Real app captures · sample data · no account required</div></div></body></html>`);
let app, main, stage, handle;
let frame=0;
const imageUrl = bytes => `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
const captions = [
  ['01 / OPEN', 'A workspace.<br>One corner away.', 'Hover in the bottom-right corner. Your workspace slides into view.'],
  ['02 / PLAN', 'Give your next<br>step a place.', 'Add a task, choose its day, and keep the small things together.'],
  ['03 / FOCUS', 'One task.<br>Your full attention.', 'Start a task timer. Pause when you need to. Your focus time stays recorded.'],
  ['04 / CAPTURE', 'A thought today.<br>A task tomorrow.', 'Daily notes save as you type. Ctrl + Enter turns a thought into a task.'],
  ['05 / PERSONALIZE', 'Your corner.<br>Your style.', 'Choose a theme, accent, font, companion, and how your panel opens.'],
  ['06 / YOUR DAY', 'Make a little<br>room for your day.', 'Try the top calendar drawer, or keep your workspace at the right. Start with Alt + N.']
];
async function capture() { return imageUrl(await main.screenshot({omitBackground:true,animations:'disabled'})); }
async function draw(step,shot,progress=1,extra={}) {
  await stage.evaluate(({caption,step,shot,progress,extra})=>{
    document.querySelector('#step').textContent=caption[0]; document.querySelector('#title').innerHTML=caption[1]; document.querySelector('#description').textContent=caption[2];
    const el=document.querySelector('#shot');el.hidden=!shot;el.src=shot||'';el.classList.toggle('top',!!extra.top);el.style.transform=`translateX(${(1-progress)*430}px)`;el.style.opacity=progress;
    document.querySelector('#handle').hidden=!!shot&&progress>.7;
    document.querySelector('#steps').innerHTML=Array.from({length:6},(_,i)=>'<i class="dot '+(i===step?'active':'')+'"></i>').join('');
    const cursor=document.querySelector('#cursor');cursor.style.display=extra.pointer===false?'none':'block';cursor.style.left=(extra.x??603)+'px';cursor.style.top=(extra.y??584)+'px';
    const halo=document.querySelector('#halo');halo.hidden=!extra.halo;halo.style.left=(extra.x??603)-12+'px';halo.style.top=(extra.y??584)-12+'px';
  },{caption:captions[step],step,shot,progress,extra});
  await stage.evaluate(async()=>{await Promise.all([...document.images].filter(i=>i.src).map(i=>i.decode().catch(()=>{})));});
  await stage.screenshot({path:path.join(frames,`${String(frame++).padStart(5,'0')}.png`)});
}
async function hold(step,shot,seconds,extra={}) {for(let n=0;n<Math.round(seconds*8);n++)await draw(step,shot,1,extra);}
async function start() {
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({executablePath:require('electron'),args:[root,'--test-mode',`--data-dir=${profile}`],env});
  await app.firstWindow();
  for(let n=0;n<100;n++){main=app.windows().find(p=>p.url().endsWith('/index.html'));handle=app.windows().find(p=>p.url().includes('handle=1'));if(main&&handle)break;await new Promise(r=>setTimeout(r,50));}
  await main.waitForFunction(()=>document.querySelector('#day').value);
  await app.evaluate(({screen,BrowserWindow})=>{globalThis.demoCursor=null;screen.getCursorScreenPoint=()=>{if(globalThis.demoCursor)return globalThis.demoCursor;const b=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='OpenSlide').getBounds();return{x:b.x+50,y:b.y+50};};});
  await app.evaluate(async({BrowserWindow},file)=>{globalThis.tutorialWindow=new BrowserWindow({width:1280,height:800,show:false,frame:false,skipTaskbar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});await tutorialWindow.loadFile(file);tutorialWindow.showInactive();},stageFile);
  stage=app.windows().find(p=>p.url().endsWith('tutorial-stage.html'));if(!stage)throw Error('Tutorial stage did not load');
  await main.evaluate(()=>window.openslide.request('collapse'));await main.waitForTimeout(1100);
  await stage.evaluate(({icon,handle})=>{document.querySelector('#icon').src=icon;document.querySelector('#handle').src=handle;},{icon:imageUrl(fs.readFileSync(path.join(root,'windows/assets/icon.png'))),handle:imageUrl(await handle.screenshot({omitBackground:true}))});
  for(let n=0;n<16;n++)await draw(0,null,0,{x:430+n*11,y:440+n*9});
  await app.evaluate(({screen})=>{const b=screen.getPrimaryDisplay().bounds;globalThis.demoCursor={x:b.x+b.width-1,y:b.y+b.height-1};});
  await main.waitForFunction(()=>!document.querySelector('#panel').classList.contains('closed'));await main.waitForTimeout(350);
  let shot=await capture();for(let n=0;n<8;n++)await draw(0,shot,1-(1-n/7)**3,{halo:n<4});await hold(0,shot,1.8,{pointer:false});
  await main.locator('#task-title').fill('Plan the launch');shot=await capture();await hold(1,shot,1.5,{pointer:false});await main.locator('#add-task button').click();shot=await capture();await hold(1,shot,2,{pointer:false});
  await main.locator('.task-timer').first().click();await main.waitForTimeout(1100);shot=await capture();await hold(2,shot,3.5,{pointer:false});await main.locator('.task-timer[data-action=pause]').click();
  await main.locator('#note').scrollIntoViewIfNeeded();await main.locator('#note').fill('Draft the release notes.\nKeep one clear priority.');shot=await capture();await hold(3,shot,2,{pointer:false});
  await main.locator('#note').evaluate(el=>{el.focus();el.setSelectionRange(0,23);});await main.locator('#note').press('Control+Enter');await main.waitForTimeout(400);shot=await capture();await hold(3,shot,1.8,{pointer:false});
  await main.locator('[data-page=settings]').click();await main.locator('[data-pref=theme]').scrollIntoViewIfNeeded();await main.locator('[data-pref=theme]').selectOption('light');await main.locator('[data-pref=accent]').selectOption('blue');shot=await capture();await hold(4,shot,3.5,{pointer:false});
  await main.evaluate(()=>window.openslide.request('preferences',{corner:'top-center'}));await main.locator('[data-page=calendar]').click();await main.waitForTimeout(400);shot=await capture();await hold(5,shot,3,{top:true,pointer:false});
  await main.evaluate(()=>window.openslide.request('preferences',{corner:'bottom-right',theme:'dark',accent:'mint'}));await main.locator('[data-page=workspace]').click();await main.evaluate(()=>document.querySelector('#toast').hidden=true);shot=await capture();await hold(5,shot,1.5,{pointer:false});
  fs.copyFileSync(path.join(frames,`${String(frame-1).padStart(5,'0')}.png`),path.join(media,'overview.png'));
  console.log(`Captured ${frame} tutorial frames from the real app.`);
}
(async()=>{
  try{await start();}finally{if(app)await app.close();}
  const ffmpeg=require('ffmpeg-static');
  const run=args=>{const result=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{stdio:'inherit'});if(result.status!==0)throw Error('Tutorial encoding failed');};
  const sequence=path.join(frames,'%05d.png');
  run(['-framerate','8','-i',sequence,'-vf','format=yuv420p','-c:v','libx264','-preset','slow','-crf','20','-movflags','+faststart',path.join(media,'tutorial.mp4')]);
  run(['-framerate','8','-i',sequence,'-filter_complex','[0:v]scale=1024:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle','-loop','0',path.join(media,'tutorial.gif')]);
  for(const file of ['tutorial.gif','tutorial.mp4','overview.png'])console.log(`${file}: ${(fs.statSync(path.join(media,file)).size/1024/1024).toFixed(2)} MB`);
})().catch(e=>{console.error(e);process.exitCode=1;});
