'use strict';
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const dayKey = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const defaults = () => ({
  version: 1, tasks: [], notes: {}, sessions: [],
  clock: { mode: 'countdown', taskId: null, target: 1500, accumulated: 0, startedAt: null },
  preferences: { corner: 'bottom-right', theme: 'dark', accent: 'mint', width: 360, opacity: 1,
    hoverToOpen: true, hoverDelay: 300, autoHide: true, hideDelay: 900, showTimer: true,
    sound: true, defaultMinutes: 25, compact: false, glass: true, textSize: 15, font: 'inter', companion: 'moon', companionMotion: true }
});
const number = (n, min, max) => { if (!Number.isFinite(n) || n < min || n > max) throw Error('Number is out of range.'); return n; };
const text = (s, max = 500) => { if (typeof s !== 'string' || s.length > max) throw Error('Invalid text.'); return s; };
const dateKey = s => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s) || dayKey(new Date(`${s}T12:00:00`)) !== s) throw Error('Choose a valid date.');
  return s;
};
const oneOf = (v, values) => { if (!values.includes(v)) throw Error('Invalid option.'); return v; };
function preferences(p) {
  const result = {};
  for (const [key, value] of Object.entries(p)) {
    if (['hoverToOpen','autoHide','showTimer','sound','compact','glass','companionMotion'].includes(key)) {
      if (typeof value !== 'boolean') throw Error('Invalid preference.'); result[key] = value;
    } else if (key === 'corner') result[key] = oneOf(value, ['bottom-right','top-right','bottom-left','top-left','top-center']);
    else if (key === 'companion') result[key] = oneOf(value, ['icon','moon','koi','jelly','cat','cloud','leaf','sprout','duck','star']);
    else if (key === 'font') result[key] = oneOf(value, ['avenir','dm-sans','metropolis','roboto-condensed','inconsolata','inter']);
    else if (key === 'textSize') result[key] = number(value, 14, 18);
    else if (key === 'theme') result[key] = oneOf(value, ['dark','light','midnight']);
    else if (key === 'accent') result[key] = oneOf(value, ['mint','lavender','peach','blue']);
    else if (key === 'width') result[key] = Math.min(380, number(value, 340, 560));
    else if (key === 'opacity') result[key] = number(value, .85, 1);
    else if (key === 'hoverDelay') result[key] = number(value, 100, 1500);
    else if (key === 'hideDelay') result[key] = number(value, 300, 3000);
    else if (key === 'defaultMinutes') result[key] = number(value, 1, 240);
    else throw Error('Unknown preference.');
  }
  return result;
}
function validate(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.tasks) || !Array.isArray(data.sessions)
      || !data.notes || typeof data.notes !== 'object' || Array.isArray(data.notes)) throw Error('Unrecognized planner format.');
  const ids = new Set();
  for (const t of data.tasks) {
    text(t.id); if (ids.has(t.id)) throw Error('Duplicate task ID.'); ids.add(t.id);
    text(t.title); dateKey(t.day); number(t.duration, 1, 240);
    for (const key of ['completedAt','reminderAt']) if (t[key] !== null) number(t[key], 0, 8640000000000000);
  }
  for (const [day, note] of Object.entries(data.notes)) { dateKey(day); text(note, 200000); }
  for (const s of data.sessions) { number(s.start, 0, 8640000000000000); number(s.end, s.start, 8640000000000000); }
  const c = data.clock;
  oneOf(c.mode, ['countdown','stopwatch']); number(c.target, 60, 8640000); number(c.accumulated, 0, Number.MAX_SAFE_INTEGER);
  if (c.startedAt !== null) number(c.startedAt, 0, 8640000000000000);
  if (c.taskId !== null && !ids.has(c.taskId)) throw Error('Missing focus task.');
  data.preferences = { ...defaults().preferences, ...preferences(data.preferences) };
  return data;
}
function load(file) {
  try { return { data: validate(JSON.parse(fs.readFileSync(file, 'utf8'))), error: null }; }
  catch (error) {
    if (error.code === 'ENOENT') return { data: defaults(), error: null };
    return { data: defaults(), error: `Saved data could not be read. Your original file is preserved; saving is disabled. ${error.message}` };
  }
}
function save(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  const fd = fs.openSync(temporary, 'w');
  try { fs.writeFileSync(fd, JSON.stringify(data, null, 2)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temporary, file);
}
function elapsed(clock, now) { return clock.accumulated + (clock.startedAt === null ? 0 : Math.max(0, (now - clock.startedAt) / 1000)); }
function display(clock, now) { return clock.mode === 'stopwatch' ? elapsed(clock, now) : Math.max(0, clock.target - elapsed(clock, now)); }
function format(seconds) {
  const s = Math.ceil(Math.max(0, seconds));
  return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}` : `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}
class Planner {
  constructor(data = defaults(), now = Date.now) { this.data = data; this.now = now; this.events = []; this.data.clock.startedAt = null; }
  task(id) { const t = this.data.tasks.find(t => t.id === id); if (!t) throw Error('Task no longer exists.'); return t; }
  pause(at = this.now()) {
    const c = this.data.clock;
    if (c.startedAt !== null) {
      const end = Math.max(c.startedAt, c.mode === 'countdown' ? Math.min(at, c.startedAt + Math.max(0, c.target - c.accumulated) * 1000) : at);
      if (end > c.startedAt) this.data.sessions.push({ taskId: c.taskId, start: c.startedAt, end });
      c.accumulated = elapsed(c, end); c.startedAt = null;
    }
  }
  checkpoint() { const running = this.data.clock.startedAt !== null; this.pause(); if (running) this.data.clock.startedAt = this.now(); }
  tick() {
    let changed = false;
    const c = this.data.clock;
    if (c.startedAt !== null && c.mode === 'countdown' && elapsed(c, this.now()) >= c.target) {
      this.pause(); this.events.push({ title: 'Focus complete', body: 'A little pause. You earned it.' }); changed = true;
    }
    for (const t of this.data.tasks) if (!t.completedAt && t.reminderAt !== null && t.reminderAt <= this.now()) {
      this.events.push({ title: 'A little reminder', body: t.title }); t.reminderAt = null; changed = true;
    }
    return changed;
  }
  action(type, payload = {}) {
    const d = this.data, c = d.clock, now = this.now();
    const cleanTitle = value => { const title = text(value).trim(); if (!title) throw Error('Give your task a name.'); return title; };
    switch (type) {
      case 'add': d.tasks.push({ id: randomUUID(), title: cleanTitle(payload.title), day: dateKey(payload.day), duration: d.preferences.defaultMinutes, completedAt: null, reminderAt: null }); break;
      case 'edit': {
        const t = this.task(payload.id);
        const changes = {};
        if (payload.title !== undefined) changes.title = cleanTitle(payload.title);
        if (payload.day !== undefined) changes.day = dateKey(payload.day);
        if (payload.duration !== undefined) changes.duration = number(payload.duration, 1, 240);
        if (payload.reminderAt !== undefined) changes.reminderAt = payload.reminderAt === null ? null : number(payload.reminderAt, now + 1000, 8640000000000000);
        Object.assign(t, changes);
        if (changes.duration !== undefined && c.taskId === t.id) { this.pause(); c.target = t.duration * 60; c.accumulated = 0; }
        break;
      }
      case 'toggle': { const t = this.task(payload.id); if (c.taskId === t.id) { this.pause(); c.taskId = null; c.accumulated = 0; } t.completedAt = t.completedAt ? null : now; t.reminderAt = null; break; }
      case 'delete': this.task(payload.id); if (c.taskId === payload.id) { this.pause(); c.taskId = null; c.accumulated = 0; } d.tasks = d.tasks.filter(t => t.id !== payload.id); break;
      case 'duplicate': { const t = this.task(payload.id); d.tasks.push({ ...t, id: randomUUID(), completedAt: null, reminderAt: null }); break; }
      case 'reorder': {
        const t = this.task(payload.id); this.task(payload.before);
        if (t.id !== payload.before) { d.tasks = d.tasks.filter(x => x.id !== t.id); d.tasks.splice(d.tasks.findIndex(x => x.id === payload.before), 0, t); } break;
      }
      case 'note': d.notes[dateKey(payload.day)] = text(payload.text, 200000); break;
      case 'focus': {
        if (payload.id && c.taskId !== payload.id) { const t = this.task(payload.id); if (t.completedAt) throw Error('Reopen this task before focusing.'); this.pause(); c.taskId = t.id; c.target = t.duration * 60; c.accumulated = 0; }
        if (c.mode === 'countdown' && display(c, now) <= 0) c.accumulated = 0;
        if (c.startedAt === null) c.startedAt = now; break;
      }
      case 'pause': this.pause(); break;
      case 'reset': this.pause(); c.accumulated = 0; c.taskId = null; break;
      case 'finish': this.pause(); if (c.taskId) { const t = this.task(c.taskId); t.completedAt = now; t.reminderAt = null; } c.accumulated = 0; c.taskId = null; break;
      case 'mode': oneOf(payload.mode, ['countdown','stopwatch']); this.pause(); c.mode = payload.mode; c.accumulated = 0; break;
      case 'duration': number(payload.minutes, 1, 240); this.pause(); c.target = payload.minutes * 60; c.accumulated = 0; if (c.taskId) this.task(c.taskId).duration = payload.minutes; break;
      case 'extend': c.target = Math.min(8640000, c.target + 300); break;
      case 'preferences': Object.assign(d.preferences, preferences(payload)); break;
      default: throw Error('Unknown action.');
    }
  }
}
function focusOnDay(data, day, now = Date.now()) {
  const start = new Date(`${dateKey(day)}T00:00:00`), end = new Date(start); end.setDate(end.getDate() + 1);
  const sessions = [...data.sessions];
  if (data.clock.startedAt !== null) sessions.push({ start: data.clock.startedAt, end: Math.min(now, data.clock.mode === 'countdown' ? data.clock.startedAt + Math.max(0, data.clock.target - data.clock.accumulated) * 1000 : now) });
  return sessions.reduce((sum, s) => sum + Math.max(0, Math.min(s.end, +end) - Math.max(s.start, +start)) / 1000, 0);
}
module.exports = { dayKey, defaults, validate, load, save, elapsed, display, format, Planner, focusOnDay };
