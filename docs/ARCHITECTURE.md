# The-M Mobile App — Architecture

## Overview

Voice-first AI mobile app. The user speaks to an AI Gateway over WebRTC. The central UI element is a glowing animated orb that reacts to voice. AI responses appear as floating glass cards orbiting the orb.

**Stack:** React Native 0.86 · Expo SDK 57 · TypeScript (strict) · Reanimated 3 · Skia · Zustand · Gesture Handler

---

## The Three-Surface Model

Every screen has exactly three rendering surfaces. Never mix them.

| Surface | Technology | What lives here | Thread |
|---|---|---|---|
| **Canvas layer** | Skia `<Canvas>` (full-screen) | Orb glow, waveform, orb particles, background particle field | UI thread (GPU) |
| **View layer** | RN Views + BlurView | Glass cards, transcript bar, buttons, text | UI thread (Reanimated transforms), JS thread (mount/unmount) |
| **Logic layer** | Zustand + WebRTC | Session state, audio levels, transcript tokens, card data | JS thread |

**Critical rule:** Audio amplitude never touches React state. It flows as a Reanimated `SharedValue` directly into Skia via `useDerivedValue`. Writing audio level to Zustand or `useState` would re-render the tree at 30-60Hz and kill performance.

---

## Z-Index Layering (canonical, all screens)

```
0    Background color (#050510)
10   Skia Canvas (particles, orb, waveform, orb-particles)
20   FloatingCardSystem cards (BlurView blurs the canvas behind it — intentional)
30   TopBar / status pill
40   LiveTranscriptBar (bottom)
90   Connection overlay / reconnecting
100  Modals / fullscreen viewers / auth overlays
```

The BlurView on cards sits above the Canvas at z=20, which means cards genuinely blur the orb's light behind them. This is the effect that makes cards feel like they float in the orb's glow. Do not reorder these layers.

---

## Directory Structure

```
theM/
├── App.tsx                          # Root: GestureHandler > SafeArea > AudioReactivity > Navigator
├── babel.config.js                  # Reanimated plugin required here
├── app.json                         # Expo config, dark mode, portrait lock
│
├── src/
│   ├── theme/
│   │   ├── colors.ts                # All color constants (orb states, cards, text)
│   │   └── motion.ts                # Durations, Easings, Springs — single source of truth
│   │
│   ├── store/
│   │   ├── sessionStore.ts          # Session state machine (idle/connecting/userSpeaking/aiSpeaking/thinking/error)
│   │   ├── cardStore.ts             # Floating card FIFO queue (max 6)
│   │   └── transcriptStore.ts       # Live token buffer + finalized turns ring buffer (max 50)
│   │
│   ├── providers/
│   │   └── AudioReactivityProvider.tsx  # userLevel + aiLevel as SharedValues (never React state)
│   │
│   ├── components/
│   │   ├── orb/
│   │   │   ├── GlowOrb.tsx          # Layered radial glow, breathing + amplitude pulse (Skia)
│   │   │   ├── OrbWaveform.tsx      # Procedural sine ribbon inside orb core (Skia, 32 samples)
│   │   │   ├── OrbParticles.tsx     # 12-16 sparks orbiting rim, react to amplitude (Skia)
│   │   │   └── ParticleField.tsx    # 60 ambient background particles with twinkle (Skia)
│   │   │
│   │   ├── cards/
│   │   │   ├── ContentCard.tsx      # Base glass card: BlurView + Reanimated + swipe gesture
│   │   │   ├── CardVariants.tsx     # ImageCard, FileCard, TextCard, ChartCard, StatusCard
│   │   │   └── FloatingCardSystem.tsx  # Slot algorithm: 6 elliptical positions flanking the orb
│   │   │
│   │   └── ui/
│   │       ├── GlassButton.tsx      # Glass pill button with glow + breathing animation
│   │       └── LiveTranscriptBar.tsx # Bottom strip: live token stream, mute toggle
│   │
│   ├── screens/
│   │   ├── SplashScreen.tsx         # 2.4s ignition sequence, then navigates to Login
│   │   ├── LoginScreen.tsx          # Dormant orb, Face ID + Google buttons (auth not wired yet)
│   │   └── HomeScreen.tsx           # Full session screen, runs demo mode automatically
│   │
│   └── navigation/
│       └── AppNavigator.tsx         # Simple state-based navigator (Splash → Login → Home)
│
└── docs/
    ├── ARCHITECTURE.md              # This file
    └── PROGRESS.md                  # What's done, what's next
```

---

## State Architecture

### Three Zustand Stores (split by update frequency)

**`sessionStore`** — low frequency, React-subscribed
```ts
state: 'idle' | 'connecting' | 'userSpeaking' | 'aiSpeaking' | 'thinking' | 'error'
isConnected: boolean
isMuted: boolean
sessionId: string | null
```

**`cardStore`** — medium frequency
```ts
cards: CardModel[]   // max 6, FIFO eviction on add
// Types: image | file | text | chart | status
```

**`transcriptStore`** — medium frequency
```ts
liveText: string          // current in-flight utterance
liveSpeaker: 'user' | 'ai'
finalizedTurns: Turn[]   // ring buffer, max 50
```

**Audio amplitude — NOT in Zustand**
```ts
// Lives in AudioReactivityProvider as SharedValues
userLevel: SharedValue<number>   // 0..1 RMS
aiLevel: SharedValue<number>     // 0..1
```

### Orb Color State Mapping

| Session State | Primary Color | Secondary Color |
|---|---|---|
| `idle` | `#4A0080` | `#2A0050` |
| `userSpeaking` | `#00D4FF` | `#0088FF` |
| `aiSpeaking` | `#9B59B6` | `#E91E8C` |
| `thinking` | `#7B2FFF` | `#4A0080` |

---

## Key Components

### GlowOrb
Skia-only. Composed of 4 layers (back→front): outer aura (blur 60), mid glow (blur 30), core sphere (blur 8), rim highlight stroke. All driven by SharedValues — zero JS work per frame. Breathing is a sine on the clock, amplitude adds pulse multiplicatively.

### OrbWaveform
Two mirrored Catmull-Rom ribbon paths (32 sample points each) inside the orb core. Recomputed every frame via `useDerivedValue` worklet. When amplitude → 0, flattens to an idle heartbeat sine. **Profile this first on low-end Android** — it's the most CPU-intensive Skia element.

### OrbParticles
16 particles on an elliptical orbit. Position computed per-frame from clock + amplitude. Each particle has precomputed constants (angle offset, orbit speed, size, jitter). Currently rendered as individual `<Circle>` elements — upgrade to Skia `Atlas` for a single draw call when optimizing.

### FloatingCardSystem
Computes 6 slot positions on an ellipse around the orb (3 left, 3 right). Slots avoid the bottom transcript area. Assigns cards to slots in order, springs them to new positions on change. Cards handle their own entrance (spring scale+opacity) and swipe-to-dismiss gesture.

### ContentCard
BlurView (iOS) or semi-transparent fallback (Android) + Reanimated absolute-positioned view. Swipe gesture on UI thread via Gesture Handler. Dismiss animates out then calls `runOnJS(removeCard)`.

---

## Networking (Not Yet Wired)

**Planned transport stack:**
```
Audio Track    → WebRTC media track (voice)
Text/Files     → WebRTC data channel (same connection)
Signaling      → WebSocket (SDP exchange only, then WebSocket is idle)
```

**Transport abstraction** (to be built in `src/transport/`):
```ts
interface Transport {
  connect(config): Promise<void>
  send(message: TransportMessage): void
  onMessage(handler): void
  disconnect(): void
}
```
Feature code must never import WebRTC directly — only use the Transport interface. This allows future adapters (WebSocket, gRPC, local model) without touching feature code.

**Audio amplitude pipeline** (to be wired):
```
WebRTC getStats() @25Hz (JS thread)
  → one-euro filter (smooth)
  → AudioContext.userLevel.value = filtered   (SharedValue write)
  → useDerivedValue in Skia reads it → GPU
```

---

## Performance Rules

1. Never animate `BlurView` intensity — forces native re-render
2. Never put audio amplitude in React state or Zustand
3. Cap OrbWaveform at 32 sample points
4. Cap live cards at 6 (FIFO eviction already in cardStore)
5. Throttle transcript token flush to ~10Hz (currently direct — needs throttle)
6. Particle systems should use Skia `Atlas` for single draw call (currently individual circles)
7. One `useClock()` per screen, not global — off-screen screens don't tick

---

## Platform Notes

**iOS:** BlurView works natively. Full effect as designed.

**Android:** BlurView blur-behind is unreliable. `ContentCard` has a `Platform.select` fallback: `rgba(10,8,30,0.82)` semi-transparent fill instead of blur. Flag `USE_NATIVE_BLUR = Platform.OS === 'ios'` in ContentCard.

---

## Provider Mount Order

```
GestureHandlerRootView
  SafeAreaProvider
    AudioReactivityProvider      ← creates userLevel/aiLevel SharedValues
      (future: WebRTCProvider)   ← peer connection lifecycle
        AppNavigator             ← Splash → Login → Home
```

---

## What Is Mocked / Not Yet Real

| Feature | Current State |
|---|---|
| Authentication | Fake 900ms delay then navigates to Home |
| WebRTC connection | Not wired — demo mode simulates session |
| Audio amplitude | Fixed values per session state, not real mic input |
| Transcript streaming | Demo script with timed `appendToken` calls |
| Card data | Hardcoded demo cards with timeouts |
| Face ID | `expo-local-authentication` imported but not called |
| Google OAuth | `Alert` placeholder |
