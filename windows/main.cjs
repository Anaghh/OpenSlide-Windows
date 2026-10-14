'use strict';
const { app, BrowserWindow, Menu, Tray, nativeImage, globalShortcut, ipcMain, screen, Notification, dialog, powerMonitor, shell, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { Planner, defaults, dayKey, load, save, display, format, focusOnDay } = require('./model.cjs');
const { GoogleCalendar } = require('./calendar.cjs');
let calendar;
const { inCorner, panelBounds } = require('./geometry.cjs');
const demo = process.argv.includes('--demo'), test = process.argv.includes('--test-mode');
const customData = process.argv.find(x => x.startsWith('--data-dir='));
app.setName('OpenSlide');
if (customData && (test || demo)) app.setPath('userData', path.resolve(customData.slice(11)));
else if (demo) app.setPath('userData', path.join(app.getPath('temp'), 'OpenSlide-demo'));
else app.setPath('userData', path.join(app.getPath('appData'), 'OpenSlide'));
app.setAppUserModelId('dev.openslide.app');
let win, handle, tray, planner, file, storageError = null, readonly = false, quitting = false;
let expanded = false, pinned = false, editing = false, nativeDialog = false, activeDisplay, hoverSince = null, awaySince = null, inhibitUntil = 0;
let poll, ticker, lastCheckpoint = Date.now(), shortcutError = null;
const url = pathToFileURL(path.join(__dirname, 'index.html')).href;
function snapshot() {
  const now = Date.now(), days = [];
  for (let i = 29; i >= 0; i--) { const date = new Date(now); date.setDate(date.getDate() - i); const day = dayKey(date);
    days.push({ day, seconds: focusOnDay(planner.data, day, now), completed: planner.data.tasks.filter(t => t.completedAt && dayKey(t.completedAt) === day).length }); }
  return { data: planner.data, now, days, error: storageError || shortcutError, pinned, expanded, demo,
    startupAvailable: app.isPackaged && !demo && !test && !process.env.PORTABLE_EXECUTABLE_FILE,
    startup: app.isPackaged && !demo && !test ? app.getLoginItemSettings().openAtLogin : false };
}
function send(channel, value) { for (const w of [win, handle]) if (w && !w.isDestroyed()) w.webContents.send(channel, value); }
function broadcast() { send('state', snapshot()); }
function persist() {
  if (readonly) return;
  try { save(file, planner.data); storageError = null; } catch (e) { storageError = `Changes could not be saved: ${e.message}`; }
}
function displayInfo() { return screen.getAllDisplays().find(d => d.id === activeDisplay) || screen.getPrimaryDisplay(); }
function position() {
  const d = displayInfo(), p = planner.data.preferences;
  win.setBounds(panelBounds(d.workArea, p)); win.setOpacity(1);
  const animated = p.companion !== 'icon', height = animated ? 48 : 32;
  const width = p.showTimer && (planner.data.clock.startedAt !== null || planner.data.clock.accumulated > 0) ? (animated ? 144 : 130) : (animated ? 64 : 42);
  handle.setBounds({ x: p.corner === 'top-center' ? Math.round(d.workArea.x + (d.workArea.width - width) / 2) : p.corner.endsWith('right') ? d.workArea.x + d.workArea.width - width : d.workArea.x,
    y: p.corner.startsWith('bottom') ? d.workArea.y + d.workArea.height - height : d.workArea.y, width, height });
}
function open(focus = true, section) {
  if (!win) return;
  expanded = true; awaySince = null; hoverSince = null; position(); handle.hide();
  if (focus) { win.show(); win.focus(); } else win.showInactive();
  win.webContents.send('visibility', { expanded: true, section: section || (planner.data.preferences.corner === 'top-center' ? 'calendar' : undefined) }); broadcast();
}
function collapse() {
  if (!expanded || nativeDialog) return;
  expanded = false; editing = false; inhibitUntil = Date.now() + 1000;
  win.webContents.send('visibility', { expanded: false });
  setTimeout(() => { if (!expanded && !quitting) { win.hide(); position(); handle.showInactive(); broadcast(); } }, 210);
  persist();
}
function contains(p, b, margin = 0) { return p.x >= b.x - margin && p.x < b.x + b.width + margin && p.y >= b.y - margin && p.y < b.y + b.height + margin; }
function pollPointer() {
  if (nativeDialog || Date.now() < inhibitUntil) return;
  const point = screen.getCursorScreenPoint(), prefs = planner.data.preferences, now = Date.now();
  const d = screen.getDisplayNearestPoint(point);
  const hot = inCorner(point, d.bounds, prefs.corner) || inCorner(point, d.workArea, prefs.corner)
    || (!expanded && contains(point, handle.getBounds()));
  if (!expanded) {
    if (prefs.hoverToOpen && hot) {
      if (hoverSince === null) hoverSince = now;
      if (now - hoverSince >= prefs.hoverDelay) { activeDisplay = d.id; open(false); }
    } else hoverSince = null;
  } else if (contains(point, win.getBounds(), 8) || hot || pinned || (editing && win.isFocused()) || !prefs.autoHide) awaySince = null;
  else { if (awaySince === null) awaySince = now; if (now - awaySince >= prefs.hideDelay) collapse(); }
}
function notify(event) {
  if (Notification.isSupported() && !test) { const n = new Notification({ ...event, silent: !planner.data.preferences.sound, icon: path.join(__dirname, 'assets/icon.png') }); n.on('click', () => open(true)); n.show(); }
  send('toast', event.body);
}
function createWindow(isHandle = false) {
  const w = new BrowserWindow({ title: isHandle ? 'OpenSlide corner' : 'OpenSlide', width: isHandle ? 42 : 420, height: isHandle ? 32 : 780,
    frame: false, transparent: true, backgroundColor: '#00000000', resizable: false, maximizable: false,
    skipTaskbar: true, alwaysOnTop: true, show: false, hasShadow: !isHandle, roundedCorners: true,
    icon: path.join(__dirname, 'assets/icon.ico'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false } });
  w.setMenu(null); w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', e => e.preventDefault());
  w.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  w.on('close', e => { if (!quitting) { e.preventDefault(); collapse(); } });
  w.loadFile(path.join(__dirname, 'index.html'), { query: isHandle ? { handle: '1' } : {} });
  return w;
}
function registerIPC() {
  ipcMain.handle('request', async (event, type, payload) => {
    if (![win?.webContents, handle?.webContents].includes(event.sender) || event.senderFrame !== event.sender.mainFrame
      || !event.senderFrame.url.startsWith(url)) throw Error('Untrusted sender.');
    try {
      if (type === 'get') return { ok: true, state: snapshot() };
      if (type === 'open') open(true);
      else if (type === 'collapse') collapse();
      else if (type === 'pin') { pinned = !pinned; broadcast(); }
      else if (type === 'editing') { editing = payload === true; return { ok: true }; }
      else if (type === 'quit') app.quit();
      else if (type === 'calendar-events') return {ok:true,...await calendar.events(payload?.day)};
      else if (type === 'calendar-disconnect') { if (calendar.busy) throw Error('Finish Google sign-in first.'); calendar.disconnect(); }
      else if (type === 'calendar-connect') {
        if (calendar.busy || nativeDialog) throw Error('A connection or file chooser is already open.');
        nativeDialog = true;
        try {
          const chosen = await dialog.showOpenDialog(win,{title:'Select Google Desktop OAuth credentials',properties:['openFile'],filters:[{name:'Google OAuth credentials',extensions:['json']}]});
          if (!chosen.canceled) await calendar.connect(chosen.filePaths[0]);
        } finally { nativeDialog = false; awaySince = null; }
      }
      else if (type === 'calendar-open') {
        const providers = { google: 'https://calendar.google.com/', notion: 'https://calendar.notion.so/' };
        if (!Object.hasOwn(providers, payload?.provider)) throw Error('Unknown calendar provider.');
        await shell.openExternal(providers[payload.provider]);
      }
      else if (type === 'export') {
        nativeDialog = true;
        try { const result = await dialog.showSaveDialog(win, { defaultPath: `OpenSlide-${dayKey()}.json`, filters: [{ name: 'Planner backup', extensions: ['json'] }] });
          if (!result.canceled) { planner.checkpoint(); persist(); fs.writeFileSync(result.filePath, JSON.stringify(planner.data, null, 2)); } }
        finally { nativeDialog = false; awaySince = null; }
      } else if (type === 'startup') {
        if (!snapshot().startupAvailable || typeof payload !== 'boolean') throw Error('Install OpenSlide before enabling startup.');
        app.setLoginItemSettings({ openAtLogin: payload, path: process.execPath, args: ['--hidden'] }); broadcast();
      } else {
        if (readonly) throw Error(storageError);
        planner.action(type, payload); persist();
        if (type === 'preferences') position();
        broadcast();
      }
      return { ok: true, state: snapshot() };
    } catch (error) { return { ok: false, error: error.message }; }
  });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => open(true));
  app.whenReady().then(() => {
    file = path.join(app.getPath('userData'), 'planner.json');
    fs.mkdirSync(app.getPath('userData'), {recursive:true});
    calendar = new GoogleCalendar(path.join(app.getPath('userData'), 'google-calendar.enc'), safeStorage, url => shell.openExternal(url));
    const loaded = load(file); readonly = !!loaded.error; storageError = loaded.error;
    if (demo && !fs.existsSync(file)) {
      loaded.data = defaults(); const seed = new Planner(loaded.data);
      ['Make space for deep work', 'Capture the next good idea', 'Take a real break'].forEach(title => seed.action('add', { title, day: dayKey() }));
      seed.action('note', { day: dayKey(), text: 'A little space for big ideas.\n\nWhat matters today?\nOne thing at a time.' });
    }
    planner = new Planner(loaded.data); activeDisplay = screen.getPrimaryDisplay().id;
    win = createWindow(); handle = createWindow(true); registerIPC();
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets/icon.png')).resize({ width: 20, height: 20 }));
    tray.setToolTip('OpenSlide · Alt+N');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open OpenSlide   Alt+N', click: () => open(true, 'workspace') },
      { label: 'Insights', click: () => open(true, 'insights') }, { label: 'Customize', click: () => open(true, 'settings') },
      { type: 'separator' }, { label: 'Quit OpenSlide', click: () => app.quit() }
    ])); tray.on('click', () => expanded ? collapse() : open(true));
    if (!globalShortcut.register('Alt+N', () => expanded ? collapse() : open(true))) shortcutError = 'Alt+N is in use. Use the corner or tray icon to open OpenSlide.';
    win.once('ready-to-show', () => { position(); if (process.argv.includes('--hidden')) handle.showInactive(); else open(true); });
    handle.webContents.on('did-finish-load', () => { position(); broadcast(); });
    screen.on('display-metrics-changed', position); screen.on('display-removed', position);
    powerMonitor.on('suspend', () => { planner.pause(); persist(); broadcast(); });
    powerMonitor.on('lock-screen', () => { planner.pause(); persist(); broadcast(); });
    poll = setInterval(pollPointer, 80);
    ticker = setInterval(() => {
      let changed = planner.tick();
      if (Date.now() - lastCheckpoint >= 15000 && planner.data.clock.startedAt !== null) { planner.checkpoint(); lastCheckpoint = Date.now(); changed = true; }
      if (changed) { persist(); broadcast(); }
      while (planner.events.length) notify(planner.events.shift());
      send('tick', { now: Date.now(), label: format(display(planner.data.clock, Date.now())) });
      if (!expanded) position();
    }, 500);
  }).catch(error => { dialog.showErrorBox('OpenSlide could not start', error.stack || error.message); app.quit(); });
}
app.on('before-quit', () => { quitting = true; clearInterval(poll); clearInterval(ticker); if (planner) { planner.pause(); persist(); } globalShortcut.unregisterAll(); tray?.destroy(); });
app.on('window-all-closed', () => { if (quitting) app.quit(); });
