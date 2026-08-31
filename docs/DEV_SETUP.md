# Dev Setup — the-M Mobile App

## Environment

| Component | Location |
|---|---|
| the-M gateway | Remote Linux server — `http://10.55.125.43:8088` |
| This machine | Windows laptop — Metro + EAS builds only |
| Phone | Samsung S24 Ultra — USB or WiFi to `10.55.125.43:8088` |

**The gateway is NOT local. Never start Docker or the-M gateway on this Windows machine.**

---

## Connectivity

The Windows machine reaches the gateway over **VPN**. If `10.55.125.43` is unreachable, reconnect VPN first.

To tunnel gateway through localhost (when needed):
```
netsh interface portproxy add v4tov4 listenport=8088 listenaddress=127.0.0.1 connectport=8088 connectaddress=10.55.125.43
```

The phone connects **directly** to `10.55.125.43:8088` over WiFi — no tunnel needed on the phone.

---

## Before Touching Any Endpoint URL

Always verify the gateway is up and the endpoint is correct **before** changing mobile client code:

```powershell
# Health check
Invoke-RestMethod http://10.55.125.43:8088/health/live

# Test A2A endpoint — Freddy (non-streaming)
$body = '{"jsonrpc":"2.0","id":"1","method":"message/send","params":{"message":{"role":"user","parts":[{"type":"text","text":"hello"}]}}}'
Invoke-RestMethod -Method POST -Uri http://10.55.125.43:8088/a2a/a2a-1 `
  -Headers @{ Authorization = "Bearer XMItLlhMUn1wGKJ88UudZ7irAcHEqONhZ4VFDDi0O1k"; "Content-Type" = "application/json" } `
  -Body $body

# Or use the Python test script (covers health + all agents + TTS + agent cards):
python scripts/test_gateway.py
```

---

## Gateway Endpoints Used by the App

| Purpose | Method | URL |
|---|---|---|
| A2A non-streaming | POST | `http://10.55.125.43:8088/a2a/{appSlug}` |
| A2A streaming (SSE) | POST | `http://10.55.125.43:8088/a2a/{appSlug}` |
| TTS | POST | `http://10.55.125.43:8088/apps/{voiceSlug}/voice/tts` |

The agent is selected by the **URL path** (`/a2a/a2a-1`, `/a2a/a2a-2`, etc.) — **not** via `metadata.skill`.

## Dev Profile Slugs

| Profile | appSlug | URL |
|---|---|---|
| Freddy — Smoke Test | `a2a-1` | `http://10.55.125.43:8088/a2a/a2a-1` |
| File Agent (SSE) | `a2a-2` | `http://10.55.125.43:8088/a2a/a2a-2` |
| Freddy — USB | `a2a-1` | `http://localhost:8088/a2a/a2a-1` |

---

## Metro

```powershell
cd C:\Users\acohen.SHIFT4CORP\Desktop\PythonProjects\theM\app\theM
npm start                         # normal start
npx expo start --localhost --scheme them --reset-cache   # after npm install / package changes
```

## Reconnect Phone

```
! powershell -File "C:\Users\acohen.SHIFT4CORP\Desktop\PythonProjects\theM\app\theM\reconnect.ps1"
```

## EAS Builds (native changes only)

```powershell
eas build --platform android --profile development   # dev build
eas build --platform android --profile preview       # standalone beta
```

Required after: adding a native package, changing `app.config.js` plugins.
Not required after: JS/TS code changes (hot reload).
