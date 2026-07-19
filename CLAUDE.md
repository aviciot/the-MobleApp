@AGENTS.md

# The-M Mobile App

## Start every session by reading these two files first

- `docs/ARCHITECTURE.md` — full system design, component map, state architecture, performance rules, platform notes
- `docs/PROGRESS.md` — what is done, what is next, known issues, architecture decision log

## Quick context

Voice-first AI mobile app. Central animated orb (Skia) reacts to WebRTC audio. AI responses appear as floating glass cards. Three screens: Splash → Login → Home.

**Stack:** React Native 0.86 · Expo SDK 57 · TypeScript · Reanimated 3 · Skia · Zustand · Gesture Handler

**Current state:** UI shell complete with demo mode. WebRTC not yet wired. Auth not yet wired.

**Next milestone:** Milestone 2 (Real Authentication) or Milestone 3 (WebRTC) — see `docs/PROGRESS.md`.

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
