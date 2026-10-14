'use strict';
const fs = require('node:fs');
const http = require('node:http');
const crypto = require('node:crypto');
const { dayKey } = require('./model.cjs');
const tokenEndpoint = 'https://oauth2.googleapis.com/token';
class GoogleCalendar {
  constructor(file, secure, openExternal, fetcher = fetch) { this.file=file; this.secure=secure; this.openExternal=openExternal; this.fetch=fetcher; this.busy=false; }
  read() {
    if (!fs.existsSync(this.file)) return null;
    try { return JSON.parse(this.secure.decryptString(fs.readFileSync(this.file))); }
    catch { throw Error('Calendar credentials could not be unlocked. Reconnect Google Calendar.'); }
  }
  write(data) {
    if (!this.secure.isEncryptionAvailable()) throw Error('Windows credential encryption is unavailable.');
    fs.writeFileSync(this.file+'.tmp',this.secure.encryptString(JSON.stringify(data)));
    fs.renameSync(this.file+'.tmp',this.file);
  }
  disconnect() { fs.rmSync(this.file,{force:true}); }
  async token(parameters) {
    const response=await this.fetch(tokenEndpoint,{method:'POST',body:new URLSearchParams(parameters),signal:AbortSignal.timeout(20000)});
    if (!response.ok) throw Error('Google authorization failed. Check your OAuth client and reconnect.');
    const value=await response.json();
    if (!value.access_token) throw Error('Google did not return an access token.');
    return value;
  }
  async connect(credentialsPath) {
    if (this.busy) throw Error('Google sign-in is already open.');
    if (!this.secure.isEncryptionAvailable()) throw Error('Windows credential encryption is unavailable.');
    let client;
    try { client=JSON.parse(fs.readFileSync(credentialsPath,'utf8')).installed; } catch { throw Error('Choose a valid Google Desktop app OAuth JSON file.'); }
    if (!client || typeof client.client_id !== 'string' || !client.client_id.endsWith('.apps.googleusercontent.com') || typeof client.client_secret !== 'string') throw Error('Choose credentials for a Google OAuth Desktop app.');
    this.busy=true;
    const state=crypto.randomBytes(32).toString('base64url'), verifier=crypto.randomBytes(32).toString('base64url');
    const challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
    let server, timeout;
    try {
      let resolveCode, rejectCode;
      const codePromise=new Promise((resolve,reject)=>{resolveCode=resolve;rejectCode=reject;});
      // Attach immediately: a timeout/browser failure must never become unhandled.
      codePromise.catch(()=>{});
      server=http.createServer((req,res)=>{
        const u=new URL(req.url,'http://127.0.0.1');
        if (u.pathname !== '/callback' || u.searchParams.get('state') !== state) {res.writeHead(400);res.end('Invalid authorization response.');return;}
        res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
        if (u.searchParams.has('error')) {res.end('Sign-in cancelled. Return to OpenSlide.');rejectCode(Error('Google sign-in was cancelled.'));}
        else if (u.searchParams.get('code')) {res.end('Sign-in received. You can return to OpenSlide.');resolveCode(u.searchParams.get('code'));}
        else {res.end('Missing authorization code.');rejectCode(Error('Missing Google authorization code.'));}
      });
      await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
      const redirect='http://127.0.0.1:'+server.address().port+'/callback';
      timeout=setTimeout(()=>rejectCode(Error('Google sign-in timed out. Try connecting again.')),180000);
      const auth=new URL('https://accounts.google.com/o/oauth2/v2/auth');
      auth.search=new URLSearchParams({client_id:client.client_id,redirect_uri:redirect,response_type:'code',scope:'https://www.googleapis.com/auth/calendar.events.readonly',access_type:'offline',prompt:'consent',state,code_challenge:challenge,code_challenge_method:'S256'}).toString();
      await this.openExternal(auth.href);
      const code=await codePromise;
      const token=await this.token({client_id:client.client_id,client_secret:client.client_secret,code,redirect_uri:redirect,grant_type:'authorization_code',code_verifier:verifier});
      if (!token.refresh_token) throw Error('Google did not grant offline access. Reconnect and approve calendar access.');
      this.write({client_id:client.client_id,client_secret:client.client_secret,refresh_token:token.refresh_token});
    } finally {clearTimeout(timeout);server?.close();server?.closeAllConnections();this.busy=false;}
  }
  async events(day) {
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || dayKey(new Date(day+'T12:00:00')) !== day) throw Error('Choose a valid calendar date.');
    const credentials=this.read(); if (!credentials) return {connected:false,events:[]};
    const token=await this.token({...credentials,grant_type:'refresh_token'});
    const start=new Date(day+'T00:00:00'),end=new Date(start);end.setDate(end.getDate()+1);
    const events=[];let next;
    do {
      const url=new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      url.search=new URLSearchParams({timeMin:start.toISOString(),timeMax:end.toISOString(),singleEvents:'true',orderBy:'startTime',maxResults:'250',...(next?{pageToken:next}:{})}).toString();
      const response=await this.fetch(url,{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(20000)});
      if (!response.ok) throw Error('Calendar could not load. Check that Google Calendar API is enabled and your account has access, then retry.');
      const data=await response.json();
      for (const e of data.items || []) if(e.status !== 'cancelled' && e.start) events.push({title:e.summary || 'Untitled event',start:e.start.dateTime || e.start.date,allDay:!!e.start.date});
      next=data.nextPageToken;
    } while(next);
    return {connected:true,events};
  }
}
module.exports={GoogleCalendar};
