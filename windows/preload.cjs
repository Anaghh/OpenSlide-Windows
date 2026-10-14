'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('openslide', {
  request: (type, payload) => ipcRenderer.invoke('request', type, payload),
  on: (channel, callback) => {
    if (!['state','tick','visibility','toast'].includes(channel)) return;
    const listener = (_event, data) => callback(data); ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});
