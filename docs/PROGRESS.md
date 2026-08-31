# The-M Mobile App — Progress

Last updated: 2026-08-31

---

## Milestone 1 — Foundation & UI Shell ✅ COMPLETE

### Done
- [x] Expo SDK 57 project initialized (React Native 0.86, TypeScript strict)
- [x] Babel config with Reanimated plugin
- [x] All core dependencies installed: Reanimated 3, Skia, Gesture Handler, Safe Area, Blur, Zustand
- [x] Theme system: `colors.ts` + `motion.ts` (durations, easings, springs)
- [x] Three Zustand stores: `sessionStore`, `cardStore`, `transcriptStore`
- [x] `AudioReactivityProvider` — userLevel + aiLevel as SharedValues
- [x] **GlowOrb** — layered Skia glow, breathing animation, amplitude pulse, color-driven
- [x] **OrbWaveform** — procedural sine ribbon, 32 samples, idle heartbeat
- [x] **OrbParticles** — 16 orbiting sparks, energy + amplitude reactive
- [x] **ParticleField** — 60 ambient background particles with twinkle + drift
- [x] **ContentCard** — glass base card, BlurView (iOS) / fallback (Android), swipe-to-dismiss
- [x] **CardVariants** — ImageCard, FileCard, TextCard, ChartCard, StatusCard
- [x] **FloatingCardSystem** — 6-slot elliptical orbit around orb, spring positioning
- [x] **GlassButton** — glass pill with glow, breathing animation, press scale
- [x] **LiveTranscriptBar** — bottom strip, live text, speaker dot pulse, mute toggle
- [x] **SplashScreen** — 2.4s ignition sequence (orb ignites, particles spawn, wordmark fades in)
- [x] **LoginScreen** — dormant orb, Face ID button, Google ghost button
- [x] **HomeScreen** — full session screen with demo mode auto-play
- [x] Demo mode: full conversation cycle simulation (no backend needed)
- [x] TypeScript zero errors
- [x] Git initialized, committed as avicoiot@gmail.com
- [x] Architecture and progress docs
- [x] `expo-dev-client` installed — enables physical device dev workflow
- [x] `eas.json` configured — development/preview/production build profiles
- [x] `app.json` updated — proper package name `com.avicoiot.them`, EAS plugin
- [x] `docs/PHONE_SETUP.md` — complete guide for Samsung S24 Ultra USB dev setup

---

## Milestone 2 — Real Authentication 🔲 TODO

- [ ] Wire `expo-local-authentication` (Face ID / fingerprint) in LoginScreen
- [ ] Wire `expo-auth-session` for Google OAuth
- [ ] JWT storage in `react-native-keychain` (secure enclave)
- [ ] Token refresh logic
- [ ] Auth state in a new `authStore`
- [ ] Protected navigation (redirect to Login if no valid token)
- [ ] Logout flow

---

## Milestone 3 — WebRTC Connection 🔲 TODO

This is the core milestone. Everything in Milestone 1 is mocked — this wires it to a real AI Gateway.

- [ ] Install `react-native-webrtc`
- [ ] Create `src/transport/` directory
  - [ ] `types.ts` — Transport interface (`connect`, `send`, `onMessage`, `disconnect`)
  - [ ] `webrtc/WebRTCAdapter.ts` — implements Transport interface
  - [ ] `webrtc/SignalingClient.ts` — WebSocket for SDP/ICE exchange
  - [ ] `pool.ts` — ConnectionPool for multi-gateway support
- [ ] `WebRTCProvider` — wraps the app, manages peer connection lifecycle
- [ ] Wire `getStats()` @25Hz → one-euro filter → `AudioReactivityProvider` SharedValues
- [ ] Replace demo mode in HomeScreen with real session state from WebRTC events
- [ ] Wire data channel messages to `transcriptStore.appendToken`
- [ ] Wire data channel binary messages to `cardStore.addCard` (file/image arrivals)
- [ ] iOS background mode: VoIP push / CallKit integration (WebRTC drops on background without this)
- [ ] STUN/TURN server configuration

**Backend dependency:** AI Gateway must expose a WebSocket signaling endpoint for SDP/ICE. Confirm gateway URL and auth header format before starting this milestone.

---

## Milestone 4 — Voice Polish 🔲 TODO

- [ ] VAD (Voice Activity Detection) — threshold-based on `userLevel` SharedValue
- [ ] Audio waveform: upgrade OrbWaveform from procedural sine to real FFT bands
  - [ ] Requires native audio worklet or `getStats()` multi-band data
- [ ] Push-to-talk mode (hold orb)
- [ ] Continuous listening mode (auto-VAD)
- [ ] Audio waveform visualization upgrade (Skia radial bars from FFT)
- [ ] Mute/unmute animates orb desaturation

---

## Milestone 5 — Rich Content 🔲 TODO

- [ ] File upload via WebRTC data channel (chunked, 16KB pieces)
- [ ] Image picker + camera integration (`expo-image-picker`)
- [ ] File download + local storage
- [ ] ImageCard: progressive loading with blurhash placeholder (`expo-image`)
- [ ] FileCard: download progress bar (SharedValue width animation)
- [ ] Markdown rendering in TextCard (proper parser, not plain text)
- [ ] ChartCard: animated draw-on (Skia path length animation)
- [ ] Fullscreen card viewer (tap to expand, orb shrinks but stays visible)

---

## Milestone 6 — Notifications & Background 🔲 TODO

- [ ] `expo-notifications` setup (APNs + FCM)
- [ ] Push notification on incoming message while app is backgrounded
- [ ] `expo-background-fetch` for lightweight background tasks
- [ ] Conversation history persistence (WatermelonDB)
- [ ] Offline queue: messages sent while offline, delivered on reconnect

---

## Milestone 7 — Multi-Gateway & Agent-to-Agent 🔲 TODO

- [ ] Gateway registry: multiple simultaneous WebRTC connections
- [ ] Connection pool routing (which conversation → which gateway)
- [ ] Conversation list screen (multiple active sessions)
- [ ] Agent-to-agent handoff protocol (nested session model)
- [ ] User profile screen

---

## Milestone 8 — Polish & Performance 🔲 TODO

- [ ] Upgrade OrbParticles to Skia `Atlas` (single draw call)
- [ ] Upgrade ParticleField to Skia `Atlas`
- [ ] Throttle transcript token flush to 10Hz
- [ ] Startup trace + memory profile
- [ ] Battery impact audit (WebRTC + Skia at 60fps)
- [ ] Accessibility: reduced motion support (`AccessibilityInfo.isReduceMotionEnabled`)
- [ ] Shake-to-organize: cards collapse into side rail
- [ ] Haptic feedback on card appear, dismiss, state change
- [ ] App Store / Play Store submission prep

---

## Known Issues / Tech Debt

| Issue | Priority | Notes |
|---|---|---|
| `hooks-in-loops` in OrbParticles | Medium | `useDerivedValue` called inside `.map()` — works but violates React rules. Refactor to a single `useDerivedValue` that returns an array of positions. |
| Transcript not throttled | Low | `appendToken` writes directly to Zustand. Add a 100ms debounce buffer before Milestone 3. |
| Android blur fallback untested | Medium | ContentCard has a Platform.select fallback but it hasn't been tested on a real Android device. |
| Navigation is state-based | Low | Simple `useState` navigator works for MVP. Replace with React Navigation stack before Milestone 7 (multi-screen complexity). |
| expo-speech-recognition requires new build | High | Adding expo-speech-recognition to app.config.js plugins requires a new EAS development build before the plugin takes effect on device. Run: `eas build --platform android --profile development` |
| No error boundary | Medium | Add a React error boundary around HomeScreen before real WebRTC wiring. |

---

## Architecture Decisions Log

**Why Skia for the orb?** Skia runs off the JS thread and renders at GPU speed. Reanimated SharedValues drive it directly via `useDerivedValue`. The orb reacts to 30Hz audio updates with zero JS overhead.

**Why not one global clock?** `useClock()` is per-screen so off-screen screens don't tick and burn battery.

**Why three Zustand stores?** Split by update frequency. Audio amplitude bypasses Zustand entirely (SharedValues). Session state changes rarely. Cards and transcript are medium-frequency. Separating them means a card addition doesn't re-render session subscribers.

**Why simple state navigator?** React Navigation adds ~300KB and navigation complexity that isn't needed for 3 screens. Will add it at Milestone 7 when multiple conversation screens are needed.

**Why not Expo Router?** File-based routing adds constraints to conversation flow that would require workarounds. Programmatic navigation gives full control for dynamic session routing.
