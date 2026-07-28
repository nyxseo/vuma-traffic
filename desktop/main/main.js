const { app, BrowserWindow, ipcMain, globalShortcut, Notification } = require('electron');
const path = require('path');
const cli = require('./cli');
const api = require('./api');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320, height: 840, minWidth: 1024, minHeight: 680,
    backgroundColor: '#0F172A',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', () => cli.stop());
}

// ── IPC ──
const handlers = {
  // Auth
  'auth:login': async (_, { email, password }) => {
    try {
      const data = await api.login(email, password);
      return { success: true, token: data.token, user: data.user, plan: data.plan };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  },
  'auth:me': async () => {
    try {
      const data = await api.getMe();
      return { success: true, user: data.user, plan: data.plan };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // Config
  'config:save': (_, settings) => cli.writeConfig(settings),
  'config:getStatus': () => ({
    cliPath: cli.jtPath,
    cliExists: require('fs').existsSync(cli.jtPath),
  }),

  // Traffic
  'traffic:start': async () => await cli.start(),
  'traffic:stop': () => cli.stop(),
  'traffic:status': () => cli.getStatus(),

  // Stats
  'stats:get': async () => {
    try {
      const data = await api.getStats();
      return { success: true, ...data };
    } catch (e) { return { success: false, error: e.message }; }
  },
  'fingerprint:list': async () => {
    try {
      const data = await api.listFingerprints();
      return { success: true, ...data };
    } catch (e) { return { success: false, error: e.message }; }
  },
};

app.whenReady().then(() => {
  cli.onLog = (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log:data', data);
    }
  };

  for (const [ch, h] of Object.entries(handlers)) {
    ipcMain.handle(ch, h);
  }

  createWindow();

  globalShortcut.register('CommandOrControl+Shift+V', () => {
    if (mainWindow?.isVisible()) mainWindow.hide();
    else mainWindow?.show();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => { cli.stop(); globalShortcut.unregisterAll(); app.quit(); });
