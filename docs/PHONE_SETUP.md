# Phone Dev Setup — Samsung S24 Ultra

## Where things are installed

| Tool | Location |
|------|----------|
| ADB (Android Debug Bridge) | `C:\platform-tools\platform-tools\adb.exe` |
| Project | `C:\Users\acohen.SHIFT4CORP\Desktop\PythonProjects\theM\app\theM` |
| Reconnect script | `C:\Users\acohen.SHIFT4CORP\Desktop\PythonProjects\theM\app\theM\reconnect.ps1` |

---

## Every time you replug the USB — one command only

Run this in the Claude Code prompt:

```
! powershell -File "C:\Users\acohen.SHIFT4CORP\Desktop\PythonProjects\theM\app\theM\reconnect.ps1"
```

This script does two things automatically:
1. `adb reverse tcp:8081 tcp:8081` — tunnels Metro to the phone
2. Launches the app directly into Metro via deep link — **no IP prompt, no manual entry**

The app slug is `avi` (from `app.json`), so the deep link is `exp+avi://expo-development-client/?url=http://localhost:8081`.

---

## How Metro is started

Metro is started with `--localhost` flag so it always advertises `localhost:8081` (not a network IP):

```powershell
cd C:\Users\acohen.SHIFT4CORP\Desktop\PythonProjects\theM\app\theM
npm start
# equivalent to: expo start --localhost
```

This is set in `package.json` `"start"` script.

---

## First-time phone setup (done once)

1. **Settings → About phone → Software information → tap "Build number" 7 times** (enables Developer Options)
2. **Settings → Developer options → USB debugging → ON**
3. Plug USB into laptop, tap **"Allow USB debugging"** on the phone when prompted

---

## Full reconnect (Metro not running)

1. Start Metro: `npm start` in the project folder
2. Run reconnect script: `! powershell -File "...\reconnect.ps1"`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `adb` not recognized | Use full path `C:\platform-tools\platform-tools\adb.exe` |
| `unauthorized` in device list | Check phone screen, tap Allow |
| `Port 8081 already in use` | Kill node: `Get-Process -Name "node" | Stop-Process -Force`, then restart Metro |
| App still shows IP prompt | Make sure Metro was started with `npm start` (uses `--localhost`), then re-run reconnect script |
| Phone not detected | Different USB cable — some are charge-only, not data |
| App opens but shows old code | Run reconnect script again, then shake phone → Reload JS |

---

## Two builds on the phone at once

| Build | Package name | App label | Purpose |
|-------|-------------|-----------|---------|
| Dev | `com.avicoiot.them` | theM | Development — needs PC + Metro running |
| Preview | `com.avicoiot.them.preview` | theM (preview) | Standalone — share with friends, no PC needed |

They coexist on the phone as separate apps — installing one does not overwrite the other.

## When you need a full EAS cloud rebuild

Only needed when adding a new native package or changing `app.json` plugins. Regular code changes hot reload instantly.

```powershell
# Dev build (for development on device)
eas build --platform android --profile development

# Preview build (standalone beta for sharing)
eas build --platform android --profile preview
```
