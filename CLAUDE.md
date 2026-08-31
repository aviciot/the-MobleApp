@AGENTS.md

# The-M Mobile App

## MANDATORY: Read these files at the start of EVERY session — before asking the user anything

| File | Why |
|------|-----|
| `docs/DEV_SETUP.md` | **READ FIRST** — gateway is remote, endpoint URLs, test commands, VPN setup |
| `docs/PHONE_SETUP.md` | ADB path, Metro start command, reconnect script, EAS build command, troubleshooting |
| `docs/PROGRESS.md` | Current milestone, what is done, what is next, known issues |
| `docs/ARCHITECTURE.md` | Full system design, component map, state architecture, performance rules |

Do NOT ask the user how to start the server, connect the phone, or run a build — all answers are in the docs above.

## CRITICAL: Gateway is on a REMOTE server

**the-M gateway runs at `http://10.55.125.43:8088` on a remote Linux server.**
- NEVER start Docker or any gateway service locally on this Windows machine
- NEVER assume the gateway is down just because local Docker is not running
- ALWAYS test an endpoint with `Invoke-RestMethod` against `10.55.125.43:8088` before changing any URL in the mobile client
- If the gateway is unreachable from this machine, the fix is to reconnect VPN — not to start anything locally
- See `docs/DEV_SETUP.md` for the test commands

## Quick context

Voice-first AI mobile app. Central animated orb (Skia) reacts to audio. AI responses appear as floating glass cards. Three screens: Splash → Login → Home.

**Stack:** React Native 0.86 · Expo SDK 57 · TypeScript · Reanimated 3 · Skia · Zustand · Gesture Handler

**Current state:** Voice pipeline fully working end-to-end (record → STT → A2A orchestrator → TTS → playback). Auth not yet wired.

**Voice pipeline:** `src/audio/VoiceController.ts` → `src/audio/GatewayClient.ts` (STT/TTS) + `src/ai/A2AClient.ts` (A2A orchestrator). See `docs/GATEWAY_INTEGRATION.md` for full API details including A2A JSON-RPC format, contextId handling, and endpoint specs.

**Gateway config:** `src/config.ts` — baseUrl, appSlug, token.

**Next milestone:** Milestone 2 (Real Authentication) — see `docs/PROGRESS.md`.

## Rules

1. Read `docs/ARCHITECTURE.md` before touching any component — the three-surface model and z-index layering are critical.
2. Audio amplitude must never enter React state or Zustand — SharedValues only.
3. Never animate BlurView intensity.
4. Keep `docs/PROGRESS.md` updated: mark tasks complete as you finish them, add new issues to the Known Issues table.
5. Keep `docs/ARCHITECTURE.md` updated when adding new components, stores, or changing the transport layer.
6. All animations via Reanimated 3 (UI thread). No `Animated` from React Native core.
7. Skia components render into the single full-screen `<Canvas>` per screen — do not add additional Canvas elements unless you have a documented reason.
8. **Native packages require a new EAS build before testing on device.** Any package that contains native code (has an `android/` or `ios/` folder — e.g. `expo-av`, `expo-local-authentication`, `react-native-webrtc`) must be followed by `eas build --platform android --profile development` before the app will work on a physical device. Pure JS packages (Zustand, etc.) hot-reload and do not need a rebuild.

## Git

- Remote: to be added (GitHub, avicoiot@gmail.com)
- Branch: master
- Commit style: `feat:`, `fix:`, `refactor:`, `docs:` prefixes
