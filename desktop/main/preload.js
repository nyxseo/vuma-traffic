const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vuma', {
  // Auth
  login: (email, password) => ipcRenderer.invoke('auth:login', { email, password }),
  getMe: () => ipcRenderer.invoke('auth:me'),

  // Config
  saveConfig: (s) => ipcRenderer.invoke('config:save', s),
  getStatus: () => ipcRenderer.invoke('config:getStatus'),

  // Traffic
  startTraffic: () => ipcRenderer.invoke('traffic:start'),
  stopTraffic: () => ipcRenderer.invoke('traffic:stop'),
  getTrafficStatus: () => ipcRenderer.invoke('traffic:status'),

  // Stats
  getStats: () => ipcRenderer.invoke('stats:get'),
  listFingerprints: () => ipcRenderer.invoke('fingerprint:list'),

  // Logs
  onLog: (cb) => {
    const h = (_, d) => cb(d);
    ipcRenderer.on('log:data', h);
    return () => ipcRenderer.removeListener('log:data', h);
  },
});
