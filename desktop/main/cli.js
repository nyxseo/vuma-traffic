const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class CliManager {
  constructor() {
    this.process = null;
    this.isRunning = false;
    this.onLog = null;
    this.onExit = null;
    this.jtPath = this._findJt();
    this.configDir = path.join(os.homedir(), '.vuma');
  }

  _findJt() {
    const appData = process.env.APPDATA
      ? path.join(process.env.APPDATA, 'npm')
      : path.join(os.homedir(), 'AppData', 'Roaming', 'npm');

    const candidates = [
      path.join(appData, 'vuma.cmd'),
      path.join(appData, 'node_modules', 'vuma', 'bin', 'CLI.js'),
      path.join(appData, 'vuma'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }

    try {
      const which = execSync('where vuma', { encoding: 'utf-8', timeout: 3000 })
        .trim().split('\n')[0];
      if (which && fs.existsSync(which)) return which;
    } catch {}

    return 'vuma';
  }

  // Write config files that vuma CLI reads
  writeConfig(settings) {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    // Main config
    const config = {
      'access-key': settings.accessKey || '',
      'url': settings.targetUrl || '',
      'keywords': settings.keywords || '',
      'search-engine': settings.searchEngine || 'google',
      'threads': settings.threads || 3,
      'platforms': settings.platforms || ['website', 'search-engine'],
      'proxy': {
        enabled: settings.proxyEnabled || false,
        list: settings.proxyList || '',
      },
      'fingerprint': {
        mode: settings.fingerprintMode || 'random', // verified | random
        bypassCSP: settings.bypassCSP !== false,
        bypassWebrtc: settings.bypassWebrtc !== false,
        bypassServiceWorker: settings.bypassServiceWorker || false,
      },
      'ads': {
        networks: settings.adNetworks || [],
        autoClick: settings.autoClickAds || false,
        boostRPM: settings.boostRPM || false,
      },
      'browser': {
        userAgent: settings.userAgent || '',
        autoClearHistory: settings.autoClearHistory || false,
        autoClearCache: settings.autoClearCache || false,
        noFootprint: settings.noFootprint || false,
        autoCleanup: settings.autoCleanup || false,
      },
      'interaction': {
        humanize: settings.humanize !== false,
        readable: settings.readable !== false,
        scrollDelay: settings.scrollDelay || 3000,
        autoAdsClick: settings.autoAdsClick || false,
      },
    };

    fs.writeFileSync(
      path.join(this.configDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    this._emitLog('system', 'Config written to ' + path.join(this.configDir, 'config.json'));
  }

  // Save access key
  saveAccessKey(key) {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
    const configPath = path.join(this.configDir, 'config.json');
    let config = {};
    try { config = JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch {}
    config['access-key'] = key;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  // Load saved access key
  loadAccessKey() {
    try {
      const configPath = path.join(this.configDir, 'config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return config['access-key'] || '';
    } catch { return ''; }
  }

  async start() {
    if (this.isRunning) {
      this._emitLog('system', 'Already running');
      return { error: 'Already running' };
    }

    const cwd = path.join(__dirname, '..', '..', '..');
    const args = ['start'];

    return new Promise((resolve) => {
      try {
        let command = this.jtPath;
        let spawnArgs = [...args];

        if (this.jtPath.endsWith('.js')) {
          command = process.execPath;
          spawnArgs = [this.jtPath, ...args];
        }

        this._emitLog('system', 'Starting vuma...');

        this.process = spawn(command, spawnArgs, {
          env: { ...process.env, NODE_ENV: 'production' },
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: this.jtPath.endsWith('.cmd'),
          cwd,
        });

        this.isRunning = true;
        const pid = this.process.pid;
        this._emitLog('system', `Process started (PID: ${pid})`);

        this.process.stdout.on('data', (data) => {
          const lines = data.toString().split('\n').filter(Boolean);
          lines.forEach((line) => this._emitLog('stdout', line));
        });

        this.process.stderr.on('data', (data) => {
          const lines = data.toString().split('\n').filter(Boolean);
          lines.forEach((line) => this._emitLog('stderr', line));
        });

        this.process.on('error', (err) => {
          this.isRunning = false;
          this._emitLog('system', `Error: ${err.message}`);
          if (this.onError) this.onError(err.message);
          resolve({ error: err.message });
        });

        this.process.on('exit', (code, signal) => {
          this.isRunning = false;
          const msg = signal
            ? `Terminated (signal: ${signal})`
            : `Exited (code: ${code})`;
          this._emitLog('system', msg);
          if (this.onExit) this.onExit(code);
          resolve({ code, signal });
        });

        resolve({ running: true, pid });
      } catch (err) {
        this._emitLog('system', `Failed: ${err.message}`);
        resolve({ error: err.message });
      }
    });
  }

  stop() {
    if (!this.process) {
      this._emitLog('system', 'No running process');
      return { error: 'Not running' };
    }

    try {
      this._emitLog('system', 'Stopping...');
      const pid = this.process.pid;

      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${pid} /f /t 2>nul`, { timeout: 5000 });
      } else {
        this.process.kill('SIGINT');
        setTimeout(() => {
          try { this.process.kill('SIGKILL'); } catch {}
        }, 5000);
      }

      this.isRunning = false;
      this._emitLog('system', 'Stopped');
      return { stopped: true };
    } catch (err) {
      this.isRunning = false;
      this.process = null;
      return { stopped: true, warning: err.message };
    }
  }

  getStatus() {
    return {
      running: this.isRunning,
      pid: this.process ? this.process.pid : null,
    };
  }

  _emitLog(type, text) {
    if (this.onLog) {
      this.onLog({ type, text: String(text), timestamp: Date.now() });
    }
  }
}

module.exports = new CliManager();
