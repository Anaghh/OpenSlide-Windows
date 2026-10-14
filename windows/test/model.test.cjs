'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Planner, defaults, load, save, validate, dayKey, display, focusOnDay } = require('../model.cjs');
const { inCorner, panelBounds } = require('../geometry.cjs');
test('countdown stops at its target even after a delayed tick, excluding pause time', () => {
  let now = 1000000; const p = new Planner(defaults(), () => now);
  p.action('duration', { minutes: 1 }); p.action('focus'); now += 15000; p.action('pause');
  now += 900000; assert.equal(display(p.data.clock,now),45);
  p.action('focus'); now += 70000; assert.equal(p.tick(),true);
  assert.equal(p.data.clock.accumulated,60); assert.equal(p.data.clock.startedAt,null);
  assert.equal(p.data.sessions.reduce((n,s) => n+(s.end-s.start)/1000,0),60);
  assert.equal(p.events.length,1); p.tick(); assert.equal(p.events.length,1);
});
test('stopwatch checkpoints and crash reopening preserve only recorded time', () => {
  let now = 1000000; const p = new Planner(defaults(), () => now);
  p.action('mode', { mode:'stopwatch' }); p.action('focus'); now += 15000; p.checkpoint();
  const recovered = new Planner(structuredClone(p.data), () => now+1000000);
  assert.equal(recovered.data.clock.startedAt,null); assert.equal(recovered.data.clock.accumulated,15);
  now += 12000; p.action('pause'); assert.equal(p.data.clock.accumulated,27);
});
test('focus time is split across local midnight', () => {
  const data = defaults(), start = new Date(2026,9,2,23,59,30), end = new Date(2026,9,3,0,0,45);
  data.sessions.push({ start:+start,end:+end });
  assert.equal(focusOnDay(data,'2026-10-02'),30); assert.equal(focusOnDay(data,'2026-10-03'),45);
});
test('task operations, order, date and reminders remain coherent', () => {
  let now = Date.now(); const p = new Planner(defaults(), () => now);
  p.action('add', { title:'Write',day:dayKey() }); p.action('add', { title:'Read',day:dayKey() });
  const [a,b] = p.data.tasks.map(t => t.id);
  p.action('reorder', { id:b,before:a }); assert.equal(p.data.tasks[0].id,b);
  p.action('edit', { id:a,reminderAt:now+5000 }); now += 5001; p.tick(); p.tick();
  assert.equal(p.events.length,1); assert.equal(p.task(a).reminderAt,null);
  p.action('focus', { id:a }); now += 10000; p.action('toggle', { id:a });
  assert.equal(p.data.clock.startedAt,null); assert.equal(p.data.clock.taskId,null); assert.equal(p.task(a).completedAt,now);
  p.action('duplicate', { id:a }); assert.equal(p.data.tasks.at(-1).completedAt,null);
  p.action('delete', { id:b }); assert.equal(p.data.tasks.some(t => t.id===b),false);
});
test('rejects invalid actions before changing task data', () => {
  const p = new Planner(); p.action('add', { title:'Original',day:dayKey() }); const id=p.data.tasks[0].id;
  assert.throws(() => p.action('edit', { id,title:'Changed',duration:-1 })); assert.equal(p.task(id).title,'Original');
  assert.throws(() => p.action('add', { title:'Bad date',day:'2026-02-30' }));
  assert.throws(() => p.action('preferences', { corner:'center' }));
  assert.throws(() => p.action('preferences', { opacity:0 }));
  assert.throws(() => p.action('preferences', { unknown:true }));
});
test('atomic save round trip; corrupt and structurally invalid originals are preserved', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'openslide-model-')), file=path.join(dir,'planner.json');
  try {
    assert.equal(load(file).error,null); save(file,defaults()); assert.deepEqual(load(file).data,defaults());
    assert.equal(fs.existsSync(`${file}.tmp`),false);
    for (const bad of ['broken',JSON.stringify({ version:1,tasks:[] })]) { fs.writeFileSync(file,bad); assert.ok(load(file).error); assert.equal(fs.readFileSync(file,'utf8'),bad); }
  } finally { fs.rmSync(dir,{ recursive:true,force:true }); }
});
test('planner validation rejects duplicate IDs and invalid focus references', () => {
  const p = new Planner(); p.action('add', { title:'A',day:dayKey() });
  const dup = structuredClone(p.data); dup.tasks.push({...dup.tasks[0]}); assert.throws(() => validate(dup));
  const bad = structuredClone(p.data); bad.clock.taskId='missing'; assert.throws(() => validate(bad));
});
test('hot corners respect nonzero and negative monitor coordinates', () => {
  const bounds={ x:-1920,y:100,width:1920,height:1080 };
  assert.equal(inCorner({x:-1,y:1179},bounds,'bottom-right'),true);
  assert.equal(inCorner({x:0,y:1179},bounds,'bottom-right'),false);
  assert.equal(inCorner({x:-1919,y:101},bounds,'top-left'),true);
  assert.equal(inCorner({x:-950,y:500},bounds,'bottom-right'),false);
  const p=defaults().preferences, b=panelBounds(bounds,p);
  assert.equal(b.x+b.width,-12); assert.equal(b.y+b.height,1168);
  p.corner='top-left'; const left=panelBounds(bounds,p); assert.equal(left.x,-1908); assert.equal(left.y,112);
});

test('companion choices migrate and reject unsupported settings', () => {
 const data=defaults();delete data.preferences.companion;delete data.preferences.companionMotion;
 assert.equal(validate(data).preferences.companion,'moon');assert.equal(data.preferences.companionMotion,true);
 const planner=new Planner(data);for(const companion of ['icon','moon','koi','jelly','cat','cloud','leaf','sprout','duck','star'])planner.action('preferences',{companion});
 assert.throws(()=>planner.action('preferences',{companion:'unknown'}));assert.throws(()=>planner.action('preferences',{companionMotion:'yes'}));
});
test('panels stay inside small, scaled, large, and negative-coordinate work areas', () => {
 for(const area of [{x:0,y:0,width:640,height:480},{x:0,y:0,width:800,height:600},{x:0,y:0,width:1280,height:720},{x:0,y:0,width:1920,height:1040},{x:-2560,y:-120,width:2560,height:1360}])for(const corner of ['bottom-left','bottom-right','top-left','top-center','top-right']){
  const b=panelBounds(area,{...defaults().preferences,width:560,corner});assert.ok(b.x>=area.x && b.y>=area.y);assert.ok(b.x+b.width<=area.x+area.width);assert.ok(b.y+b.height<=area.y+area.height);
 }
});
