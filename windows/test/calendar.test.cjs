'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {GoogleCalendar}=require('../calendar.cjs');
const {defaults,validate}=require('../model.cjs');
const {inCorner,panelBounds}=require('../geometry.cjs');
test('top-edge drawer is centered on monitors with negative coordinates; old preferences migrate',()=>{
 const area={x:-1600,y:-100,width:1600,height:1000},p={...defaults().preferences,corner:'top-center'};
 const b=panelBounds(area,p);assert.equal(b.x+b.width/2,-800);assert.equal(b.y,-88);
 assert.ok(inCorner({x:-800,y:-99},area,p.corner));assert.ok(!inCorner({x:-800,y:-70},area,p.corner));
 const old=defaults();delete old.preferences.glass;delete old.preferences.textSize;
 assert.equal(validate(old).preferences.glass,true);assert.equal(old.preferences.textSize,15);
});
test('Google uses PKCE and state, reads paginated events, keeps credentials out of event response',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'openslide-calendar-'));
 const file=path.join(dir,'tokens'),client=path.join(dir,'client.json');
 fs.writeFileSync(client,JSON.stringify({installed:{client_id:'test.apps.googleusercontent.com',client_secret:'test-only'}}));
 const secure={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s),decryptString:b=>b.toString()};
 let challenge,redirect,tokenCalls=0,eventCalls=0;
 const calendar=new GoogleCalendar(file,secure,async u=>{
   const auth=new URL(u);challenge=auth.searchParams.get('code_challenge');redirect=auth.searchParams.get('redirect_uri');
   assert.equal(auth.origin,'https://accounts.google.com');assert.equal(auth.searchParams.get('code_challenge_method'),'S256');
   assert.equal((await fetch(redirect+'?state=wrong&code=fake')).status,400);
   assert.equal((await fetch(redirect+'?'+new URLSearchParams({state:auth.searchParams.get('state'),code:'test-code'}))).status,200);
 },async (url,options)=>{
   if(String(url).includes('/token')) {
     tokenCalls++;const p=options.body;
     if(p.get('grant_type')==='authorization_code') {
       assert.equal(p.get('redirect_uri'),redirect);
       assert.equal(require('node:crypto').createHash('sha256').update(p.get('code_verifier')).digest('base64url'),challenge);
       return {ok:true,json:async()=>({access_token:'access',refresh_token:'refresh'})};
     }
     assert.equal(p.get('refresh_token'),'refresh');return {ok:true,json:async()=>({access_token:'access'})};
   }
   eventCalls++;assert.equal(options.headers.Authorization,'Bearer access');
   return {ok:true,json:async()=>eventCalls===1?{items:[{summary:'Meeting',start:{dateTime:'2026-10-02T10:00:00+05:30'}}],nextPageToken:'next'}:{items:[{summary:'Away',start:{date:'2026-10-02'}}]}};
 });
 try {
   await calendar.connect(client);assert.equal(calendar.busy,false);
   const result=await calendar.events('2026-10-02');assert.equal(result.connected,true);assert.equal(result.events.length,2);assert.equal(result.events[1].allDay,true);
   assert.ok(!JSON.stringify(result).includes('refresh'));assert.equal(tokenCalls,2);
   await assert.rejects(calendar.events('2026-02-30'));calendar.disconnect();assert.deepEqual(await calendar.events('2026-10-02'),{connected:false,events:[]});
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('Google rejects unsupported credentials and unavailable encryption',async()=>{
 const c=new GoogleCalendar('unused',{isEncryptionAvailable:()=>false},()=>{});
 await assert.rejects(c.connect('unused'),/encryption/);assert.equal(c.busy,false);
});

test('all top positions use landscape bounds, clamped to the available monitor', () => {
 const area={x:-1600,y:100,width:1600,height:1000};
 for(const corner of ['top-left','top-center','top-right']){
  const b=panelBounds(area,{...defaults().preferences,corner});
  assert.equal(b.width,640);assert.equal(b.height,380);assert.equal(b.y,112);
  assert.ok(b.x>=area.x && b.x+b.width<=area.x+area.width);
 }
 const small=panelBounds({x:0,y:0,width:800,height:600},{...defaults().preferences,corner:'top-center'});
 assert.equal(small.width,640);assert.equal(small.height,300);
});
