@AGENTS.md

# The-M Mobile App

## MANDATORY: Read these files at the start of EVERY session — before asking the user anything

| File | Why |
|------|-----|
| `docs/PHONE_SETUP.md` | ADB path, Metro start command, reconnect script, EAS build command, troubleshooting |
| `docs/PROGRESS.md` | Current milestone, what is done, what is next, known issues |
| `docs/ARCHITECTURE.md` | Full system design, component map, state architecture, performance rules |

Do NOT ask the user how to start the server, connect the phone, or run a build — all answers are in `docs/PHONE_SETUP.md`.

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
