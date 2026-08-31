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

### Which profile to use on the phone

| Location | Profile to use | How it works |
|---|---|---|
| **Office** | Freddy — Smoke Test (WiFi) | Phone is on office network → can reach `10.55.125.43` directly |
| **Outside office / remote** | Freddy — USB | Phone → USB cable → ADB reverse → Windows VPN → `10.55.125.43` |

**Rule:** If the phone shows "connect timeout", switch to the USB profile. The USB profile always works as long as the phone is connected via cable and `reconnect.ps1` has been run.

The ADB reverse tunnel is set up by `reconnect.ps1`:
```powershell
adb reverse tcp:8088 tcp:8088
```
This makes `localhost:8088` on the phone route through the Windows machine to the gateway.

---

## Before Touching Any Endpoint URL

Always verify the gateway is up and the endpoint is correct **before** changing mobile client code:

```powershell
# Health check
Invoke-RestMethod http://10.55.125.43:8088/health/live

# Test A2A endpoint — Freddy (non-streaming)
$body = '{"jsonrpc":"2.0","id":"1","method":"message/send","params":{"message":{"role":"user","parts":[{"type":"text","text":"hello"}]}}}'
Invoke-RestMethod -Method POST -Uri http://10.55.125.43:8088/a2a/freddy/a2a-1 `
  -Headers @{ Authorization = "Bearer XMItLlhMUn1wGKJ88UudZ7irAcHEqONhZ4VFDDi0O1k"; "Content-Type" = "application/json" } `
  -Body $body

# Or use the Python test script (covers health + all agents + TTS + agent cards):
python scripts/test_gateway.py
```

---

## Gateway Endpoints Used by the App

| Purpose | Method | URL |
|---|---|---|
| A2A non-streaming | POST | `{baseUrl}/a2a/{appSlug}/{epSlug}` |
| A2A streaming (SSE) | POST | `{baseUrl}/a2a/{appSlug}/{epSlug}` |
| TTS | POST | `{baseUrl}/apps/{voiceAppSlug}/{voiceSlug}/voice/tts` |
| Agent card | GET | `{baseUrl}/a2a/{appSlug}/{epSlug}/.well-known/agent.json` |

Each profile has two slugs: `appSlug` (DB application record) and `epSlug` (entry point).

## Dev Profile Slugs

| Profile | appSlug | epSlug | A2A URL |
|---|---|---|---|
| Freddy — Smoke Test | `freddy` | `a2a-1` | `.../a2a/freddy/a2a-1` |
| File Agent (SSE) | `stream` | `a2a-2` | `.../a2a/stream/a2a-2` |
| Freddy — USB | `freddy` | `a2a-1` | `http://localhost:8088/a2a/freddy/a2a-1` |

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
