'use strict';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const api = window.openslide;
const isHandle = new URLSearchParams(location.search).has('handle');
if (isHandle) document.title = 'OpenSlide corner';
let taskListKey = '', previousCorner;
const icons = { panel:'M4 4h16v16H4z M10 4v16', pin:'M9 3h6l-1 5 3 3v2H7v-2l3-3z M12 13v8', up:'m6 14 6-6 6 6', left:'m14 6-6 6 6 6', right:'m10 6 6 6-6 6', clock:'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', tasks:'M9 6h11 M9 12h11 M9 18h11 M3 6l1 1 2-2 M3 12l1 1 2-2 M3 18l1 1 2-2', notes:'M6 3h12v18H6z M9 8h6 M9 12h6 M9 16h4', bell:'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5z M10 21h4', calendar:'M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4', edit:'m15 4 5 5-10 10-6 1 1-6z M13 6l5 5', grip:'M9 5h.01 M15 5h.01 M9 12h.01 M15 12h.01 M9 19h.01 M15 19h.01', check:'m5 12 4 4L19 6', reset:'M4 10a8 8 0 1 1 1 8 M4 4v6h6' };
function icon(name) { return `<svg class="line-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[name]}"/></svg>`; }
function setupIcons() { for(const el of $$('.brand-symbol')) el.innerHTML=icon('panel'); $('#pin').innerHTML=icon('pin'); const headings=[['.focus-card h2 span','clock'],['.tasks-card h2 span','tasks'],['.notes-card h2 span','notes'],['#workspace .events-card h2 span','bell'],['.date-trigger span','calendar']]; for(const [selector,name] of headings) $(selector).innerHTML=icon(name); $('#reset').innerHTML=icon('reset'); $('#finish').innerHTML=icon('check'); }
setupIcons();
let state, page = 'workspace', selectedDay = localDay(), showDone = false, toastTimeout, dialogSave, draggedId, lastTimerNow = Date.now();
function localDay(date = new Date()) { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function dateLabel(day, opts = { month: 'short', day: 'numeric' }) { return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, opts); }
function escape(text) { return String(text).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
function timerLabel(clock, now) {
  const elapsed = clock.accumulated + (clock.startedAt === null ? 0 : Math.max(0, (now - clock.startedAt)/1000));
  const seconds = Math.ceil(clock.mode === 'countdown' ? Math.max(0, clock.target - elapsed) : elapsed);
  return `${seconds >= 3600 ? Math.floor(seconds/3600)+':' : ''}${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
}
function toast(text) { $('#toast').textContent = text; $('#toast').hidden = false; clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('#toast').hidden = true, 4000); }
async function request(type, payload) {
  try { const response = await api.request(type, payload); if (!response.ok) { toast(response.error); return null; } if (response.state) receive(response.state); return response; }
  catch (error) { toast(`OpenSlide couldn't complete that action: ${error.message}`); return null; }
}
function receive(next) { state = next; lastTimerNow = next.now; render(); }
function applyStyle() {
  const p = state.data.preferences;
  if(previousCorner !== p.corner) { $('main').scrollTop=0; previousCorner=p.corner; }
  document.documentElement.style.setProperty('--glass-sheen', `${Math.round(4+(p.opacity-.85)*50)}%`);
  document.body.dataset.font = p.font;
  document.body.dataset.companion = p.companion;
  document.documentElement.style.fontSize = `${p.textSize}px`;
  document.body.className = [isHandle ? 'handle' : '', p.theme, p.accent, p.corner, p.compact ? 'compact' : '', p.glass ? 'glass' : '', p.corner.endsWith('left') ? 'left' : ''].join(' ');
}
function render() {
  applyStyle();
  const d = state.data, c = d.clock, p = d.preferences;
  document.body.classList.toggle('focusing', c.startedAt !== null);
  $('#focus-badge').hidden = c.startedAt === null;
  window.updateCompanion(p, !state.expanded);
  $('#companion-name').textContent = {moon:'Little moon',koi:'Pond fish',jelly:'Jellyfish',cat:'Sleepy cat',cloud:'Little cloud',leaf:'Drifting leaf',sprout:'Tiny sprout',duck:'Little duck',star:'Little star',icon:'Original icon'}[p.companion];
  $('#handle-companion').hidden = p.companion === 'icon';
  $('#corner-handle .brand-symbol').hidden = p.companion !== 'icon';
  if (isHandle) { $('#pill').textContent = p.showTimer && (c.startedAt !== null || c.accumulated > 0) ? timerLabel(c, lastTimerNow) : ''; return; }
  $('#error').hidden = !state.error; $('#error').textContent = state.error || '';
  $('#demo-badge').hidden = !state.demo;
  $('#pin').classList.toggle('active', state.pinned); $('#pin').setAttribute('aria-pressed', String(state.pinned));
  $('#pin').title = state.pinned ? 'Unpin panel' : 'Keep panel open';
  $('#close').innerHTML = icon(p.corner.startsWith('top') ? 'up' : p.corner.endsWith('left') ? 'left' : 'right');
  $('#day').value = selectedDay;
  $('#day-title').textContent = selectedDay === localDay() ? 'Today' : dateLabel(selectedDay, { weekday:'short', month:'short', day:'numeric' });
  $('#timer').textContent = timerLabel(c, lastTimerNow);
  $('#focus-mode').value = c.mode;
  $('#focus-status').textContent = c.startedAt !== null ? 'In your own little flow' : c.accumulated > 0 ? (c.mode === 'countdown' && c.accumulated >= c.target ? 'A moment well spent' : 'Paused. Take your time.') : 'A fresh start';
  $('#toggle-timer').textContent = c.startedAt !== null ? 'Pause  Ⅱ' : c.accumulated > 0 && !(c.mode === 'countdown' && c.accumulated >= c.target) ? 'Resume  ▶' : 'Start focus  ▶';
  $('#duration').textContent = `${Math.round(c.target/60)} min`;
  $('#duration').hidden = $('#extend').hidden = c.mode === 'stopwatch';
  $('#active-task').textContent = d.tasks.find(t => t.id === c.taskId)?.title || 'One thing at a time.';
  $('#active-task').hidden = !c.taskId;
  $('#finish').disabled = !c.taskId;
  const allDates = $('#task-all-dates').checked;
  const query = $('#task-search').value.trim().toLowerCase();
  const tasks = d.tasks.filter(t => allDates || t.day === selectedDay);
  $('#task-count').textContent = tasks.filter(t => !t.completedAt).length;
  $('#done-count').textContent = tasks.filter(t => t.completedAt).length;
  $('#show-completed').classList.toggle('selected', showDone);
  $('#show-completed').setAttribute('aria-pressed', String(showDone));
  const visible = tasks.filter(t => (showDone || !t.completedAt) && t.title.toLowerCase().includes(query));
  const nextTaskListKey = JSON.stringify([visible, c.taskId, c.startedAt !== null, c.mode, c.target, showDone, allDates]);
  if (nextTaskListKey !== taskListKey) {
  taskListKey = nextTaskListKey;
  $('#tasks').innerHTML = visible.length ? visible.map(t => `<div class="task-row ${t.completedAt ? 'done' : c.taskId === t.id ? 'active' : ''}" data-id="${escape(t.id)}"><button class="task-drag" draggable="true" aria-label="Drag to reorder" title="Drag to reorder">${icon('grip')}</button><button class="task-check" data-action="toggle" aria-label="${t.completedAt ? 'Reopen' : 'Complete'} ${escape(t.title)}">${t.completedAt ? icon('check') : ''}</button><button class="task-title" data-action="edit">${escape(t.title)}${allDates ? `<small>${escape(dateLabel(t.day))}</small>` : ''}${t.reminderAt ? `<small>◷ ${escape(new Date(t.reminderAt).toLocaleString([], { month:'short',day:'numeric',hour:'2-digit',minute:'2-digit' }))}</small>` : ''}</button>${!t.completedAt ? `<button class="task-action task-timer" data-action="${c.taskId === t.id && c.startedAt !== null ? 'pause' : 'focus'}" aria-label="${c.taskId === t.id && c.startedAt !== null ? 'Pause task timer' : 'Focus on task'}"><span data-clock="${escape(t.id)}">${c.taskId === t.id ? timerLabel(c, lastTimerNow) : `${t.duration}:00`}</span><small>${c.taskId === t.id && c.startedAt !== null ? 'Ⅱ Pause' : c.taskId === t.id && c.accumulated > 0 ? '▶ Resume' : '▶ Start'}</small></button>` : ''}<button class="task-action" data-action="edit" aria-label="Edit task" title="Edit task">${icon('edit')}</button></div>`).join('') : '<div class="empty"><strong>A clear space to start.</strong><span>Add a task below, or capture a thought in Notes.</span></div>';
  }
  for (const label of $$('[data-clock]')) if (label.dataset.clock === c.taskId) label.textContent = timerLabel(c, lastTimerNow);
  if (document.activeElement !== $('#note')) $('#note').value = d.notes[selectedDay] || '';
  updateWords();
  const reminders = d.tasks.filter(t => !t.completedAt && t.reminderAt).sort((a,b) => a.reminderAt - b.reminderAt);
  $('#reminders').innerHTML = reminders.length ? reminders.map(t => `<div class="reminder-row"><div>${escape(t.title)}<small>${escape(new Date(t.reminderAt).toLocaleString())}</small></div><button class="text-button" data-reminder="${escape(t.id)}" aria-label="Remove reminder">×</button></div>`).join('') : '<div class="empty"><span>Nothing coming up. Breathe easy.</span></div>';
  if (page === 'insights') renderInsights();
  if (page === 'calendar') renderCalendar();
  for (const input of $$('[data-pref]')) { const value = p[input.dataset.pref]; if (input.type === 'checkbox') input.checked = value; else if (document.activeElement !== input) input.value = value; }
  for (const output of $$('[data-value]')) { const key = output.dataset.value; output.textContent = key === 'opacity' ? `${Math.round(p[key]*100)}%` : key === 'width' ? `${p[key]}px` : `${p[key]}ms`; }
  $('.screen-preview').classList.toggle('left', p.corner.endsWith('left')); $('.screen-preview').classList.toggle('top', p.corner.startsWith('top'));
  $('#startup').checked = state.startup; $('#startup').disabled = !state.startupAvailable;
  $('#startup-hint').textContent = state.startupAvailable ? 'Reminders need OpenSlide running. Windows notification settings control whether banners appear.' : 'Available after installing OpenSlide. Reminders need the app running.';
}
function updateWords() { const words = $('#note').value.trim().split(/\s+/).filter(Boolean).length; $('#words').textContent = `${words} ${words === 1 ? 'word' : 'words'}`; }
function renderInsights() {
  const days = state.days.slice(-Number($('#chart-range').value)), seconds = days.reduce((sum,d) => sum+d.seconds,0), minutes = Math.floor(seconds/60);
  $('#focus-total').textContent = minutes >= 60 ? `${Math.floor(minutes/60)}h ${minutes%60}m` : `${minutes}m`;
  $('#completed-total').textContent = days.reduce((sum,d) => sum+d.completed,0);
  $('#active-days').textContent = days.filter(d => d.seconds > 0 || d.completed > 0).length;
  const max = Math.max(60,...days.map(d => d.seconds));
  $('#chart').replaceChildren(...days.map(d => { const button = document.createElement('button'); button.title = `${dateLabel(d.day)}: ${Math.floor(d.seconds/60)} min, ${d.completed} tasks`; button.setAttribute('aria-label',button.title); const bar = document.createElement('i'); bar.style.setProperty('--bar', Math.max(.018,d.seconds/max)); button.append(bar); button.onclick = () => $('#chart-detail').textContent = `${dateLabel(d.day, { weekday:'short',month:'short',day:'numeric' })} · ${Math.floor(d.seconds/60)} minutes focused · ${d.completed} tasks finished`; return button; }));
  $('#range-start').textContent = dateLabel(days[0].day);
}
function navigate(to) { page = to; for (const section of $$('.page')) section.hidden = section.id !== page; for (const button of $$('[data-page]')) button.classList.toggle('selected', button.dataset.page === page); $('main').scrollTop = 0; if (state) { render(); if (to === 'calendar') refreshCalendar(); } }
function showDialog(title, fields, save) {
  const dialog=$('#edit-dialog');
  $('#dialog-title').textContent=title; $('#dialog-fields').innerHTML=fields; $('#dialog-fields').scrollTop=0;
  const taskEditor=fields.includes('id="edit-title"'); dialog.classList.toggle('task-editor',taskEditor); $('#task-options').hidden=!taskEditor;
  const menu=$('#dialog-fields .task-commands');
  if(menu){
    menu.id='task-actions-menu';menu.setAttribute('popover','auto');$('#task-options').setAttribute('aria-controls',menu.id);
    $('#task-options').setAttribute('popovertarget',menu.id);$('#task-options').setAttribute('aria-expanded','false');
    menu.addEventListener('toggle',()=>{
      const open=menu.matches(':popover-open');$('#task-options').setAttribute('aria-expanded',String(open));
      if(open){const r=$('#task-options').getBoundingClientRect();
        menu.style.left=Math.max(12,Math.min(r.right-menu.offsetWidth,innerWidth-menu.offsetWidth-12))+'px';
        menu.style.top=Math.max(12,Math.min(r.bottom+6,innerHeight-menu.offsetHeight-12))+'px';
        menu.querySelector('button')?.focus();
      }
    });
  }
  dialogSave=save;dialog.showModal();request('editing',true);
}
function closeDialog() { const menu=$('#task-actions-menu');if(menu?.matches(':popover-open'))menu.hidePopover();$('#edit-dialog').close(); request('editing', false); }
function editTask(id) {
  const t = state.data.tasks.find(t => t.id === id); if (!t) return;
  let reminder = '';
  if (t.reminderAt) { const time = new Date(t.reminderAt); reminder = `${localDay(time)}T${String(time.getHours()).padStart(2,'0')}:${String(time.getMinutes()).padStart(2,'0')}`; }
  showDialog('Manage task', `<label class="field-wide">Task<input id="edit-title" required maxlength="500" value="${escape(t.title)}"></label><label>Day<input id="edit-day" type="text" readonly data-date-picker aria-haspopup="dialog" required value="${escape(t.day)}"></label><label>Focus minutes<input id="edit-duration" type="number" min="1" max="240" required value="${t.duration}"></label><div class="field-wide reminder-group"><label for="reminder-day">Remind me</label><input id="edit-reminder" type="hidden" value="${reminder}"><div class="reminder-editor"><input id="reminder-day" type="text" readonly data-date-picker aria-label="Reminder day" placeholder="Choose a day" value="${reminder.slice(0,10)}"><input id="reminder-time" type="time" aria-label="Reminder time" value="${reminder.slice(11)}"><button id="clear-reminder" type="button" class="text-button">Clear</button></div></div><div class="task-commands field-wide"><button type="button" id="complete-task">${t.completedAt ? 'Reopen task' : 'Complete task'}</button><button type="button" id="remind-soon">Remind in 30 minutes</button><button type="button" id="move-tomorrow">Move to tomorrow</button><button type="button" id="duplicate-task">Duplicate</button><button type="button" id="delete-task" class="danger">Delete task</button></div>`, async () => {
    const when = $('#edit-reminder').value;
    const changes = { id, title: $('#edit-title').value, day: $('#edit-day').value };
    const duration = Number($('#edit-duration').value);
    if (duration !== t.duration) changes.duration = duration;
    if (when !== reminder) changes.reminderAt = when ? +new Date(when) : null;
    return request('edit', changes);
  });
  function updateReminderFields() { const value = $('#edit-reminder').value; $('#reminder-day').value = value.slice(0,10); $('#reminder-time').value = value.slice(11); }
  function syncReminder() { const day = $('#reminder-day').value, time = $('#reminder-time').value; $('#edit-reminder').value = day && time ? day + 'T' + time : ''; }
  $('#reminder-day').onchange = () => { if (!$('#reminder-time').value) $('#reminder-time').value = '09:00'; syncReminder(); };
  $('#reminder-time').onchange = syncReminder;
  $('#clear-reminder').onclick = () => { $('#edit-reminder').value = ''; updateReminderFields(); };
  $('#complete-task').onclick = async () => { if (await request('toggle', { id })) closeDialog(); };
  $('#remind-soon').onclick = () => { const when = new Date(Date.now()+1800000); $('#edit-reminder').value = `${localDay(when)}T${String(when.getHours()).padStart(2,'0')}:${String(when.getMinutes()).padStart(2,'0')}`; updateReminderFields(); $('#task-actions-menu').hidePopover(); };
  $('#move-tomorrow').onclick = () => { const tomorrow = new Date(`${t.day}T12:00:00`); tomorrow.setDate(tomorrow.getDate()+1); $('#edit-day').value = localDay(tomorrow); $('#task-actions-menu').hidePopover(); };
  $('#duplicate-task').onclick = async () => { if (await request('duplicate', { id })) { closeDialog(); toast('A fresh copy, ready for you.'); } };
  $('#delete-task').onclick = async () => { if ($('#delete-task').dataset.confirm !== 'yes') { $('#delete-task').dataset.confirm = 'yes'; $('#delete-task').textContent = 'Confirm delete'; return; } if (await request('delete', { id })) closeDialog(); };
}
function attach() {
  $('#corner-handle').onclick = () => request('open');
  $('#close').onclick = $('#shortcut').onclick = () => request('collapse');
  $('#pin').onclick = () => request('pin');
  for (const button of $$('[data-page]')) button.onclick = () => navigate(button.dataset.page);
  $('#day').onchange = () => { if ($('#day').value) { selectedDay = $('#day').value; const date = new Date(selectedDay + 'T12:00:00'); calendarMonth = new Date(date.getFullYear(), date.getMonth(), 1); $('#note').blur(); render(); } };
  $('#add-task').onsubmit = async e => { e.preventDefault(); const title = $('#task-title').value; if (await request('add', { title, day: selectedDay })) { $('#task-title').value = ''; $('#task-title').focus(); } };
  $('#tasks').onclick = e => { const button = e.target.closest('[data-action]'), row = e.target.closest('[data-id]'); if (!button || !row) return; if (button.dataset.action === 'edit') editTask(row.dataset.id); else request(button.dataset.action, { id: row.dataset.id }); };
  $('#tasks').ondragstart = e => { const row = e.target.closest('[data-id]'); if (!row || !e.target.closest('.task-drag')) { e.preventDefault(); return; } draggedId = row.dataset.id; e.dataTransfer.setData('text/plain',draggedId); row.classList.add('dragging'); };
  $('#tasks').ondragover = e => e.preventDefault();
  $('#tasks').ondrop = e => { e.preventDefault(); const row = e.target.closest('[data-id]'); if (row && draggedId) request('reorder', { id: draggedId, before: row.dataset.id }); draggedId = null; };
  $('#tasks').ondragend = () => { draggedId = null; $$('.dragging').forEach(row => row.classList.remove('dragging')); };
  $('#task-search').oninput = render;
  $('#task-all-dates').onchange = render;
  $('#manage-tasks').onclick = () => { const controls = $('#task-tools'); controls.hidden = !controls.hidden; $('#manage-tasks').setAttribute('aria-expanded', String(!controls.hidden)); if (!controls.hidden) $('#task-search').focus(); };
  $('#show-completed').onclick = () => { showDone = !showDone; render(); };
  $('#toggle-timer').onclick = () => request(state.data.clock.startedAt !== null ? 'pause' : 'focus');
  $('#focus-mode').onchange = () => request('mode', { mode: $('#focus-mode').value });
  $('#extend').onclick = () => request('extend'); $('#reset').onclick = () => request('reset'); $('#finish').onclick = () => request('finish');
  $('#duration').onclick = () => showDialog('Focus duration', `<label>Minutes<input id="new-duration" type="number" min="1" max="240" value="${Math.min(240,Math.round(state.data.clock.target/60))}" required></label>`, () => request('duration', { minutes: Number($('#new-duration').value) }));
  $('#note').oninput = async () => { updateWords(); $('#note-state').textContent = 'Saving…'; const response = await request('note', { day: selectedDay, text: $('#note').value }); $('#note-state').textContent = response && !response.state.error ? 'Saved on this device' : 'Not saved'; };
  $('#note').onkeydown = e => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); const el = e.target; const value = el.value; const start = el.selectionStart, end = el.selectionEnd; const title = (start !== end ? value.slice(start,end) : value.slice(value.lastIndexOf('\n',start-1)+1, value.indexOf('\n',end) < 0 ? value.length : value.indexOf('\n',end))).trim(); if (title) request('add', { title, day: selectedDay }).then(result => { if (result) toast('Thought → task. A little more clarity.'); }); } };
  $('#reminders').onclick = e => { const button = e.target.closest('[data-reminder]'); if (button) request('edit', { id: button.dataset.reminder, reminderAt: null }); };
  attachCalendar();
  $('#chart-range').onchange = renderInsights;
  for (const input of $$('[data-pref]')) input.onchange = () => { const value = input.type === 'checkbox' ? input.checked : ['range','number'].includes(input.type) ? Number(input.value) : input.dataset.pref === 'textSize' ? Number(input.value) : input.value; request('preferences', { [input.dataset.pref]: value }); };
  $('#startup').onchange = () => request('startup', $('#startup').checked);
  $('#export').onclick = () => request('export'); $('#quit').onclick = () => request('quit');
  $('#dialog-close').onclick = $('#dialog-cancel').onclick = closeDialog;
  $('#edit-dialog').addEventListener('close', () => request('editing', false));
  $('#edit-form').onsubmit = async e => { e.preventDefault(); if (dialogSave && await dialogSave()) closeDialog(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) request('collapse'); });
  document.addEventListener('focusin', e => request('editing', ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName) || !!document.querySelector('dialog[open]')));
  document.addEventListener('focusout', () => setTimeout(() => request('editing', ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) || !!document.querySelector('dialog[open]')),0));
}
api.on('state', receive);
api.on('tick', tick => {
  lastTimerNow = tick.now; if (!state) return;
  if (isHandle) { const c = state.data.clock; $('#pill').textContent = state.data.preferences.showTimer && (c.startedAt !== null || c.accumulated > 0) ? tick.label : ''; }
  else { $('#timer').textContent = tick.label; for (const label of $$('[data-clock]')) if (label.dataset.clock === state.data.clock.taskId) label.textContent = tick.label; }
});
api.on('visibility', value => {
  $('#panel').classList.toggle('closed', !value.expanded);
  if (value.expanded) { $('#panel').classList.remove('enter'); void $('#panel').offsetWidth; $('#panel').classList.add('enter'); if (value.section) navigate(value.section); }
  else { if ($('#date-picker').open) $('#date-picker').close(); if ($('#edit-dialog').open) closeDialog(); }
});
api.on('toast', toast);
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let calendarEvents = [], calendarConnected = false, calendarMessage = 'Connect Google to show calendar events.', calendarSequence = 0;
function renderCalendar() {
  $('#month-label').textContent = calendarMonth.toLocaleDateString(undefined, {month:'long', year:'numeric'});
  const year = calendarMonth.getFullYear(), month = calendarMonth.getMonth();
  const cells = Array.from({length:calendarMonth.getDay()}, () => '<span></span>');
  for (let n = 1; n <= new Date(year, month+1, 0).getDate(); n++) {
    const day = localDay(new Date(year,month,n)), count = state.data.tasks.filter(t => t.day === day && !t.completedAt).length;
    cells.push('<button data-day="'+day+'" class="'+(day === selectedDay ? 'selected ' : '')+(day === localDay() ? 'today' : '')+'" aria-label="'+day+(count ? ', '+count+' tasks' : '')+'" aria-pressed="'+(day === selectedDay)+'">'+n+(count ? '<i></i>' : '')+'</button>');
  }
  $('#month-grid').innerHTML = cells.join('');
  $('#agenda-title').textContent = dateLabel(selectedDay, {weekday:'short',month:'short',day:'numeric'});
  $('#calendar-status').textContent = calendarMessage;
  $('#google-connect').textContent = calendarConnected ? 'Reconnect Google Calendar' : 'Connect Google Calendar';
  $('#google-disconnect').hidden = !calendarConnected;
  $('#calendar-events').innerHTML = calendarEvents.map(e => '<div class="agenda-event"><small>'+escape(e.allDay ? 'All day' : new Date(e.start).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))+'</small><strong>'+escape(e.title)+'</strong></div>').join('');
  const tasks = state.data.tasks.filter(t => t.day === selectedDay && !t.completedAt);
  $('#calendar-tasks').innerHTML = tasks.length ? tasks.map(t => '<div class="agenda-event"><small>Task · '+t.duration+' min</small><strong>'+escape(t.title)+'</strong></div>').join('') : '<p class="subtle">No tasks planned for this day.</p>';
}
async function refreshCalendar() {
  const seq = ++calendarSequence; calendarEvents = []; calendarMessage = 'Loading calendar…'; renderCalendar();
  try {
    const result = await api.request('calendar-events', {day:selectedDay});
    if (seq !== calendarSequence) return;
    if (!result.ok) throw Error(result.error);
    calendarConnected = result.connected; calendarEvents = result.events;
    calendarMessage = result.connected ? (result.events.length ? 'Google Calendar · primary calendar' : 'No Google events for this day.') : 'Connect Google to show calendar events.';
  } catch (e) { if (seq !== calendarSequence) return; calendarMessage = e.message; }
  renderCalendar();
}
function attachCalendar() {
  $('#month-prev').onclick = () => { calendarMonth.setMonth(calendarMonth.getMonth()-1); renderCalendar(); };
  $('#month-next').onclick = () => { calendarMonth.setMonth(calendarMonth.getMonth()+1); renderCalendar(); };
  $('#month-grid').onclick = e => { const button = e.target.closest('[data-day]'); if (button) { selectedDay = button.dataset.day; refreshCalendar(); } };
  $('#calendar-today').onclick = () => { selectedDay = localDay(); calendarMonth = new Date(new Date().getFullYear(),new Date().getMonth(),1); refreshCalendar(); };
  $('#calendar-refresh').onclick = refreshCalendar;
  $('#google-connect').onclick = async () => {
    $('#google-connect').disabled = true; calendarMessage = 'Choose your OAuth JSON, then sign in in your browser.'; renderCalendar();
    try { const result = await api.request('calendar-connect'); if (!result.ok) throw Error(result.error); await refreshCalendar(); }
    catch(e) { calendarMessage = e.message; renderCalendar(); }
    finally { $('#google-connect').disabled = false; }
  };
  $('#google-disconnect').onclick = async () => { if (await request('calendar-disconnect')) refreshCalendar(); };
  for (const button of $$('[data-provider]')) button.onclick = () => request('calendar-open', {provider:button.dataset.provider});
}
attach(); request('get');
