# Desktop App - Convert CLI ke GUI

## Pendekatan
Aplikasi desktop yang menjalankan `vuma` CLI sebagai child process. GUI akan:
1. Mengkonfigurasi semua setting sebelum start
2. Menulis config ke file yang dibaca CLI
3. Spawn CLI sebagai child process
4. Capture stdout/stderr untuk live logs
5. Kirim SIGINT/taskkill untuk stop

## Struktur Halaman

### 1. Login Page
- Field: Access Key
- Simpan key ke config CLI (~/.vuma/config.json)

### 2. Dashboard
- Tombol START / STOP besar
- Status: Running / Idle
- Live hit counter
- Thread counter aktif

### 3. Traffic Setup (Tab)
**Direct Traffic:**
- Target URL input
- Proxy list (textarea: socks5://user:pass@host:port)
- Enable/disable proxy

**Search Traffic:**
- Target URL
- Keywords (multi-line)
- Search Engine: Google, Bing, Yandex, Yahoo, Google-CSE
- Custom proxy
- User agent override
- Thread count slider (1-10)

**Platform:**
- Checklist: Website, Facebook, Instagram, TikTok, YouTube, Adult, Direct Ads

### 4. Ad Networks
- Enable/disable tiap network: AdSense, Adsterra, MGID, Monetag
- Auto click ads (1x per session) - toggle
- Boost RPM - toggle

### 5. Browser Settings
- Fingerprint: Verified / Random
- Bypass CSP, WebRTC, Service Worker
- Auto clear history & cache
- No footprint mode
- Auto cleanup on stop

### 6. Live Logs
- Terminal-style output dari CLI
- Filter: stdout/stderr/system
- Auto-scroll
- Clear button

## File yang Akan Dibuat
| File | Fungsi |
|------|--------|
| `main/main.js` | Electron: window, tray, IPC, child process manager |
| `main/preload.js` | Bridge IPC ke renderer |
| `main/cli.js` | Child process manager + config writer |
| `renderer/index.html` | Full GUI dengan semua tab |

## Teknologi
- Electron 33
- Alpine.js + Tailwind (CDN)
- Inline CSS (no build step)
- Child process: spawn vuma CLI